// Three.js match renderer. Reads the engine state every frame; never mutates match logic.
// Features: post-processing (bloom, MSAA), time of day, rain, animated crowd, video walls,
// ball trail, stadium intro flight and instant goal replays from recorded frames.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildStadium, setupLights, createBall, createRain, createSnow, createPyro } from './stadium.js';
import { createPlayerModel, animatePlayer } from './playerModel.js';
import { StadiumAudio } from './audio.js';
import { CameraRig } from './camera.js';
import { SIM_DT, BALL_R, HALF_L } from '../match/constants.js';

const PIXEL_RATIO = { niedrig: 0.75, mittel: 1, hoch: 1.5, ultra: 2 };
const REC_DT = 1 / 30;
const REC_LEN = 300; // 10 s of simulated play

export class MatchView {
  constructor(container, engine, { quality = 'mittel', speed = 1, camera = 'tv', tod = 'nacht', weather = 'klar', intro = true, onFrame, onReplay, audio = null, replays = true } = {}) {
    this.replaysOn = replays;
    this.container = container;
    this.engine = engine;
    this.quality = quality;
    this.speed = speed;
    this.paused = false;
    this.onFrame = onFrame;
    this.onReplay = onReplay;
    const msaa = quality === 'hoch' || quality === 'ultra';
    this.renderer = new THREE.WebGLRenderer({ antialias: quality === 'mittel', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[quality] ?? 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (quality !== 'niedrig') { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = quality === 'mittel' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; }
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'match-canvas';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.3, 1100);
    const lights = setupLights(this.scene, quality, tod);
    this.renderer.toneMappingExposure = lights.params.exposure;
    const home = engine.teams[0].club;
    this.stadium = buildStadium(this.scene, {
      capacity: home.stadium?.capacity || 30000, layout: home.stadium?.layout, home: engine.teams[0].kit, away: engine.teams[1].kit, quality, name: home.stadium?.name?.toUpperCase(),
      night: tod === 'nacht', wet: weather === 'regen', homeShort: home.short, pattern: home.id % 3 === 0 ? 'karo' : 'streifen',
    });
    this.rain = weather === 'regen' && quality !== 'niedrig' ? createRain(this.scene, quality === 'ultra' ? 6000 : 3500) : null;
    this.snow = weather === 'schnee' ? createSnow(this.scene, quality === 'niedrig' ? 1200 : quality === 'ultra' ? 5000 : 3000) : null;
    if (weather === 'nebel') this.scene.fog = new THREE.Fog(tod === 'nacht' ? 0x3a404c : 0xb9c2cc, 55, 240);
    else if (weather === 'schnee') this.scene.fog = new THREE.Fog(tod === 'nacht' ? 0x30343c : 0xd8dee6, 60, 260);
    // pyro in the fan blocks (v1.0): at the intro of big matches and after goals
    this.pyro = createPyro(this.scene);
    this.pyroMode = engine.pyro ?? 'normal';
    if (this.pyroMode !== 'aus' && (engine.bigMatch || Math.random() < 0.35)) setTimeout(() => this.pyro?.fire(this.stadium.fanSpots.home, quality === 'niedrig' ? 5 : 10), 600);

    // post-processing
    if (quality !== 'niedrig') {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: msaa ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lights.params.bloom * (quality === 'mittel' ? 0.8 : 1), 0.55, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    const ball = createBall(quality);
    this.ballMesh = ball.mesh; this.ballShadow = ball.shadow;
    this.scene.add(this.ballMesh, this.ballShadow);
    // ball trail for hard shots
    this.trailPts = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
    this.trail.frustumCulled = false; this.scene.add(this.trail);

    this.ownerRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ownerRing.rotation.x = -Math.PI / 2; this.ownerRing.position.y = 0.02; this.scene.add(this.ownerRing);
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.95, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.position.y = 0.021; this.scene.add(this.selRing);
    this.models = new Map();
    this.rig = new CameraRig(this.camera, this.renderer.domElement);
    this.rig.setMode(camera);
    this.rig.tvAnchor = this.stadium.tvAnchor;
    this.acc = 0; this.recAcc = 0;
    this.frames = []; // replay buffer
    this.replay = null;
    this.fps = 60; this.frameCount = 0; this.fpsTime = 0;
    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(container);
    this.resize();
    this.audio = audio && audio.volume > 0 ? new StadiumAudio({ ...audio, homeName: engine.teams[0].club.name, awayName: engine.teams[1].club.name }) : null;
    this.unsub = engine.on((e) => {
      this.audio?.onEvent(e, engine);
      if (e.type === 'goal') {
        this.rig.shake = 0.8; this.stadium.excite(1, e.team); if (this.replaysOn !== false) this.pendingReplay = { at: performance.now() + 1700, t: engine.simTime };
        if (this.pyroMode !== 'aus' && Math.random() < (engine.bigMatch ? 0.7 : 0.4)) this.pyro.fire(e.team === 0 ? this.stadium.fanSpots.home : this.stadium.fanSpots.away, quality === 'niedrig' ? 3 : 6, e.team === 0 ? 0xff5522 : 0xff3355);
      }
      if (e.type === 'var' && e.overturned) this.stadium.excite(1, 1 - e.team);
      if (e.type === 'fulltime') setTimeout(() => this.fulltimeScene(), 1200);
      if (e.type === 'shot' || e.type === 'save') this.stadium.excite(1);
      if (['goal', 'kickoff2', 'halftime', 'fulltime'].includes(e.type)) this.updateScreen();
    });
    this.updateScreen();
    this.prebuildBench();
    if (intro) this.startIntro();
    window.__ufmView = this; // debug / QA hook
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  updateScreen() {
    const [A, B] = this.engine.teams;
    this.stadium.setScreen([`${A.club.short}  –  ${B.club.short}`, `${A.score} : ${B.score}`, this.engine.phase === 'halftime' ? 'HALBZEIT' : this.engine.phase === 'fulltime' ? 'ENDSTAND' : this.engine.minuteText()], [A.club.short, B.club.short]);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // v2.8: substitutes get their model (canvas kit textures + GPU upload) before kick-off, so a
  // substitution at a free kick no longer freezes the picture for a moment
  prebuildBench() {
    this.benchModels = new Map();
    for (const T of this.engine.teams) for (const id of T.bench || []) {
      const d = this.engine.db[id]; if (!d) continue;
      const m = createPlayerModel({ kit: T.kit, looks: d.looks, number: d.number, isGK: false, quality: this.quality, name: d.lastName, short: T.club.short });
      m.root.visible = false; this.scene.add(m.root); this.benchModels.set(id, m);
    }
    try { this.renderer.compile(this.scene, this.camera); } catch { /* older three */ }
  }

  modelFor(p) {
    let m = this.models.get(p);
    if (!m && this.benchModels?.has(p.id) && !p.isGK) { m = this.benchModels.get(p.id); this.benchModels.delete(p.id); m.root.visible = true; this.models.set(p, m); return m; }
    if (!m) {
      const T = this.engine.teams[p.team];
      m = createPlayerModel({ kit: p.isGK ? T.gkKit : T.kit, looks: p.data.looks, number: p.data.number, isGK: p.isGK, quality: this.quality, name: p.data.lastName, short: T.club.short });
      this.scene.add(m.root);
      this.models.set(p, m);
    }
    return m;
  }

  setSpeed(s) { this.speed = s; }
  setPaused(b) { this.paused = b; }
  setCamera(mode) { this.rig.setMode(mode); }

  // ---------------------------------------------------------------- intro flight
  startIntro() {
    const t0 = performance.now();
    this.intro = true;
    this.rig.override = () => {
      const u = Math.min(1, (performance.now() - t0) / 6500);
      if (u >= 1 || !this.intro) { this.intro = false; this.rig.override = null; return null; }
      // aerial shot from high above the pitch, then a descending sweep into the bowl
      const e = u * u * (3 - 2 * u);
      // stays above the pitch area so it never clips through roofs or upper tiers of big stadiums
      const a = -0.9 + e * 1.9, r = 12 + e * 30;
      return { pos: new THREE.Vector3(Math.sin(a) * r * 1.2, 165 - e * 145, Math.cos(a) * r * 0.75), focus: new THREE.Vector3(0, 0, 0), fov: 46 - e * 8, snap: u < 0.02 };
    };
  }
  skipIntro() { this.intro = false; this.rig.override = null; }

  // ---------------------------------------------------------------- recording & replay
  record() {
    const E = this.engine;
    const f = { players: [], ball: [E.ball.pos.x, E.ball.pos.y, E.ball.pos.z, E.ball.vel.x, E.ball.vel.z], owner: E.ball.owner };
    for (const T of E.teams) for (const p of T.players) {
      f.players.push([p, p.pos.x, p.pos.z, p.vel.x, p.vel.z, p.facing, p.action ? { ...p.action } : null, p.injured, p.offPitch]);
    }
    this.frames.push(f);
    if (this.frames.length > REC_LEN) this.frames.shift();
  }

  // after the final whistle: handshakes and a few shirt swaps (v2.0)
  fulltimeScene() {
    const [A, B] = this.engine.teams;
    const as = A.players.filter((p) => !p.offPitch && !p.sentOff), bs = B.players.filter((p) => !p.offPitch && !p.sentOff);
    const used = new Set(); let swaps = 0;
    for (const p of as) {
      const q = bs.filter((x) => !used.has(x)).sort((x, y) => Math.hypot(x.pos.x - p.pos.x, x.pos.z - p.pos.z) - Math.hypot(y.pos.x - p.pos.x, y.pos.z - p.pos.z))[0];
      if (!q || Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) > 14) continue;
      used.add(q);
      // step towards each other and shake hands
      const mx = (p.pos.x + q.pos.x) / 2, mz = (p.pos.z + q.pos.z) / 2, ang = Math.atan2(q.pos.z - p.pos.z, q.pos.x - p.pos.x);
      p.pos.x = mx - Math.cos(ang) * 0.55; p.pos.z = mz - Math.sin(ang) * 0.55; q.pos.x = mx + Math.cos(ang) * 0.55; q.pos.z = mz + Math.sin(ang) * 0.55;
      p.vel.x = p.vel.z = q.vel.x = q.vel.z = 0; p.facing = ang; q.facing = ang + Math.PI;
      p.action = { type: 'celebrate', style: 'shake', t: 0.5, dur: 1e6 }; q.action = { type: 'celebrate', style: 'shake', t: 0.5, dur: 1e6 };
      if (swaps < 2 && !p.isGK && !q.isGK && Math.random() < 0.5) {
        const mp = this.modelFor(p), mq = this.modelFor(q);
        if (mp.shirtM && mq.shirtM) { const t = mp.shirtM.map; mp.shirtM.map = mq.shirtM.map; mq.shirtM.map = t; mp.shirtM.needsUpdate = mq.shirtM.needsUpdate = true; swaps++; }
      }
    }
  }

  startReplay() {
    if (this.frames.length < 60) return;
    const frames = this.frames.slice(-Math.min(this.frames.length, 7.5 / REC_DT));
    const proxies = new Map();
    const goalX = Math.sign(frames[frames.length - 1].ball[0]) * HALF_L;
    const side = Math.random() < 0.5 ? 1 : -1;
    // multi-angle replay (v2.0): behind the goal → high side view → slow-motion scorer cam
    const goalEv = [...this.engine.events].reverse().find((e) => e.type === 'goal');
    const scorer = goalEv ? this.engine.teams[goalEv.team].players.find((q) => q.id === goalEv.player) : null;
    const ANGLES = [{ name: 'Hinter dem Tor', speed: 0.55 }, { name: 'Führungskamera', speed: 0.7 }, { name: scorer ? `Zeitlupe · ${scorer.data.lastName}` : 'Zeitlupe', speed: 0.32 }];
    this.replay = { frames, i: 0, acc: 0, proxies, speed: ANGLES[0].speed, pass: 0, snapAt: 2, angles: this.quality === 'niedrig' ? ANGLES.slice(0, 2) : ANGLES, scorer };
    this.rig.override = () => {
      const R = this.replay; if (!R) return null;
      const b = this.ballMesh.position;
      const u = R.i / R.frames.length;
      if (R.pass === 1) return { focus: new THREE.Vector3(b.x, 0.8, b.z), pos: new THREE.Vector3(b.x * 0.75, 24, -side * 50), fov: 30, snap: R.i < R.snapAt };
      if (R.pass === 2 && R.scorer) {
        const f = R.frames[R.i]; const e = f.players.find((x) => x[0] === R.scorer);
        const sx = e ? e[1] : b.x, sz = e ? e[2] : b.z;
        const dx = b.x - sx, dz = b.z - sz, d = Math.hypot(dx, dz) || 1;
        return { focus: new THREE.Vector3((sx + b.x) / 2, 1.1, (sz + b.z) / 2), pos: new THREE.Vector3(sx - (dx / d) * 6 + 2, 2.4, sz - (dz / d) * 6 + 1.5), fov: 42, snap: R.i < R.snapAt };
      }
      return {
        focus: new THREE.Vector3(b.x, b.y * 0.6 + 0.5, b.z),
        pos: new THREE.Vector3(goalX * 1.12, 3.2 + u * 1.5, side * (8 + u * 4) + b.z * 0.3),
        fov: 38, snap: R.i < R.snapAt,
      };
    };
    this.onReplay?.(true, `${ANGLES[0].name} · 1/${this.replay.angles.length}`);
  }

  stopReplay() {
    if (!this.replay) return;
    this.replay = null; this.rig.override = null;
    this.onReplay?.(false);
  }

  playReplay(dt) {
    const R = this.replay;
    R.acc += dt * R.speed;
    let adv = 0;
    while (R.acc >= REC_DT) { R.acc -= REC_DT; R.i++; adv++; }
    if (R.i >= R.frames.length - 1) {
      if (R.pass < R.angles.length - 1) {
        R.pass++; R.i = Math.floor(R.frames.length * (R.pass === 2 ? 0.45 : 0.2)); R.snapAt = R.i + 2; R.acc = 0; R.speed = R.angles[R.pass].speed;
        this.onReplay?.(true, `${R.angles[R.pass].name} · ${R.pass + 1}/${R.angles.length}`);
      } else { this.stopReplay(); return; }
    }
    const f = R.frames[R.i];
    const animDt = adv * REC_DT;
    for (const [p, x, z, vx, vz, facing, action, injured, offPitch] of f.players) {
      let q = R.proxies.get(p);
      if (!q) { q = { pos: { x, z }, vel: { x: vx, z: vz }, facing, action, isGK: p.isGK, injured, get speed() { return Math.hypot(this.vel.x, this.vel.z); } }; R.proxies.set(p, q); }
      q.pos.x = x; q.pos.z = z; q.vel.x = vx; q.vel.z = vz; q.facing = facing; q.action = action; q.injured = injured;
      const m = this.modelFor(p);
      m.root.visible = !offPitch;
      if (!offPitch) animatePlayer(m, q, animDt);
    }
    for (const [p, m] of this.models) if (!f.players.some((e) => e[0] === p)) m.root.visible = false;
    const [bx, by, bz, bvx, bvz] = f.ball;
    this.placeBall(bx, by, bz, bvx, bvz, animDt);
    this.ownerRing.visible = false; this.selRing.visible = false;
  }

  // ---------------------------------------------------------------- main loop
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const E = this.engine;
    if (this.pendingReplay && now >= this.pendingReplay.at && !this.replay) {
      this.pendingReplay = null;
      if (this.speed === 'highlights' || this.speed <= 2) this.startReplay();
    }
    if (this.replay) {
      this.playReplay(dt);
    } else {
      let simDt = 0;
      if (!this.paused && !this.intro && E.phase !== 'halftime' && E.phase !== 'fulltime') {
        const mult = this.speed === 'highlights' ? (E.isHighlight() ? 1 : 14) : this.speed;
        this.acc += dt * mult;
        let n = 0;
        const maxSteps = 260;
        while (this.acc >= SIM_DT && n < maxSteps) {
          E.step(SIM_DT); this.acc -= SIM_DT; n++;
          this.recAcc += SIM_DT;
          if (this.recAcc >= REC_DT) { this.recAcc -= REC_DT; this.record(); }
          if (E.phase === 'halftime' || E.phase === 'fulltime') { this.acc = 0; break; }
        }
        if (n >= maxSteps) this.acc = 0;
        simDt = n * SIM_DT;
        if (n && Math.floor(E.time / 60) !== this.lastMinute) { this.lastMinute = Math.floor(E.time / 60); this.updateScreen(); }
      }
      this.sync(E.phase === 'fulltime' || E.phase === 'halftime' ? dt : simDt);
    }
    this.stadium.update(dt);
    this.rain?.update(dt, this.camera.position);
    this.snow?.update(dt, this.camera.position);
    this.pyro?.update(dt);
    if (!this.replay && (this.speed === 1 || this.speed === 2 || this.speed === 0.5)) this.audio?.update(dt, E);
    this.rig.update(dt, E);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.frameCount++; this.fpsTime += dt;
    if (this.fpsTime > 0.5) { this.fps = Math.round(this.frameCount / this.fpsTime); this.frameCount = 0; this.fpsTime = 0; }
    this.onFrame?.(this);
  }

  placeBall(x, y, z, vx, vz, dt) {
    const bm = this.ballMesh;
    bm.position.set(x, Math.max(BALL_R, y), z);
    const sp = Math.hypot(vx, vz);
    if (dt > 0 && sp > 0.05) {
      const axis = new THREE.Vector3(vz, 0, -vx).normalize();
      bm.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, (sp / BALL_R) * dt * (y > 0.3 ? 0.4 : 1)));
    }
    this.ballShadow.position.set(x, 0.015, z);
    const sc = 1 / (1 + y * 0.4);
    this.ballShadow.scale.setScalar(sc);
    this.ballShadow.material.opacity = 0.35 * sc;
    // trail
    const fast = Math.hypot(vx, vz) > 17 || y > 2.5;
    if (dt > 0) {
      this.trailPts.push(fast ? [x, y, z] : null);
      if (this.trailPts.length > 24) this.trailPts.shift();
    }
    const pos = this.trail.geometry.attributes.position, col = this.trail.geometry.attributes.color;
    let last = [x, y, z];
    for (let i = 0; i < 24; i++) {
      const p = this.trailPts[this.trailPts.length - 1 - i] || null;
      if (p) last = p;
      pos.setXYZ(i, last[0], last[1], last[2]);
      const a = p ? 1 - i / 24 : 0;
      col.setXYZ(i, a, a * 0.95, a * 0.7);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.trail.visible = this.trailPts.slice(-8).some(Boolean);
  }

  sync(dt) {
    const E = this.engine;
    for (const T of E.teams) for (const p of T.players) {
      const m = this.modelFor(p);
      m.root.visible = !p.offPitch;
      if (!p.offPitch) animatePlayer(m, p, dt);
    }
    const b = E.ball;
    this.placeBall(b.pos.x, b.pos.y, b.pos.z, b.vel.x, b.vel.z, dt);
    const o = b.owner;
    this.ownerRing.visible = !!o && E.phase === 'play';
    if (o) this.ownerRing.position.set(o.pos.x, 0.02, o.pos.z);
    const s = this.rig.selected;
    this.selRing.visible = !!s && !s.offPitch;
    if (s) this.selRing.position.set(s.pos.x, 0.021, s.pos.z);
  }

  pickPlayer(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    let best = null, bd = 2.5;
    for (const T of this.engine.teams) for (const p of T.players) {
      if (p.offPitch) continue;
      const d = Math.hypot(p.pos.x - hit.x, p.pos.z - hit.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  dispose() {
    this.audio?.dispose();
    cancelAnimationFrame(this.raf);
    this.unsub?.();
    this.ro.disconnect();
    this.rig.dispose();
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
      if (o.material?.map) o.material.map.dispose();
    });
    for (const m of this.models.values()) m.textures?.forEach((t) => t.dispose());
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
