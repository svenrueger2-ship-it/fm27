// Procedural footballer: articulated joint hierarchy with shaped body parts, kit textures
// (pattern, sponsor, name & number), face details and several hair styles.
// The builder is isolated so that it can later be swapped for skinned glTF models.
import * as THREE from 'three';
import { shirtTexture, sockTexture, shortsTexture, kitStyleFor } from './kitTexture.js';

const geoCache = new Map();
function geo(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
const matCache = new Map();
function mat(color, quality, extra = {}) {
  const key = color + quality + JSON.stringify(Object.keys(extra)) + (extra.map?.uuid || '');
  if (!matCache.has(key)) {
    const M = quality === 'niedrig' ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
    const m = new M({ color: new THREE.Color(color), ...(M === THREE.MeshStandardMaterial ? { roughness: 0.72, metalness: 0.0 } : {}), ...extra });
    matCache.set(key, m);
  }
  return matCache.get(key);
}

// Tapered limb segment (cylinder with rounded ends), pivot at the top, hanging along -y
function limbGeo(rTop, rBot, len, seg) {
  return geo(`limb${rTop}_${rBot}_${len}_${seg}`, () => {
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + rBot - Math.cos(a) * rBot)); }
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * rTop, -rTop * 0.2 - Math.cos(a) * rTop * 0.6)); }
    const g = new THREE.LatheGeometry(pts, seg);
    return g;
  });
}

// Torso via lathe profile: waist narrower, chest wider, shoulders rounded. Height ~0.56
function torsoGeo(seg) {
  return geo(`torso${seg}`, () => {
    const prof = [[0.0, 0.0], [0.15, 0.0], [0.155, 0.05], [0.145, 0.14], [0.16, 0.26], [0.175, 0.36], [0.18, 0.44], [0.165, 0.5], [0.12, 0.55], [0.06, 0.57], [0.0, 0.575]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg * 2);
    g.scale(1.18, 1, 0.74);
    return g;
  });
}

export function createPlayerModel({ kit, looks, number, isGK, quality = 'mittel', name = '', short = '' }) {
  const seg = quality === 'niedrig' ? 6 : quality === 'mittel' ? 10 : quality === 'hoch' ? 14 : 18;
  const sphere = (r, ws = seg + 2, hs = seg) => geo(`sph${r}_${ws}_${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  const box = (x, y, z) => geo(`box${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
  const detailed = quality !== 'niedrig';
  const style = kitStyleFor(short);
  const shirtTex = shirtTexture({ kit, style, short, number, name, isGK });
  const shirtM = mat('#ffffff', quality, { map: shirtTex });
  const sleeve = mat(kit.primary, quality);
  const trim = mat(kit.secondary, quality);
  const shortsTex = shortsTexture(kit, number);
  const shorts = mat('#ffffff', quality, { map: shortsTex });
  const socks = mat('#ffffff', quality, { map: sockTexture(kit) });
  const skin = mat(looks.skin, quality, quality === 'niedrig' ? {} : { roughness: 0.6 });
  const hair = mat(looks.hair, quality, quality === 'niedrig' ? {} : { roughness: 0.9 });
  const bootColor = isGK ? '#1d1d1d' : ['#111111', '#f2f2f2', '#ff4a1c', '#1e6fff', '#f5c400', '#16d47b'][number % 6];
  const boot = mat(bootColor, quality, quality === 'niedrig' ? {} : { roughness: 0.35, metalness: 0.15 });
  const glove = mat(isGK ? '#f4f4f4' : looks.skin, quality);
  const dark = mat('#141414', quality);
  const white = mat('#f5f5f5', quality);

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = (looks.height || 180) / 180;
  body.scale.set(s * (0.96 + ((number * 37) % 9) / 100), s, s);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const pelvis = new THREE.Mesh(geo(`pelvis${seg}`, () => { const g = new THREE.CylinderGeometry(0.16, 0.17, 0.2, seg * 2); g.scale(1.15, 1, 0.78); return g; }), shorts);
  pelvis.position.y = 0.0; hips.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  const torso = new THREE.Mesh(torsoGeo(seg), shirtM); torso.rotation.y = 0; spine.add(torso);
  const collar = new THREE.Mesh(geo(`collar${seg}`, () => new THREE.TorusGeometry(0.06, 0.016, 6, seg * 2)), trim);
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.56, 0.0); spine.add(collar);
  const neck = new THREE.Group(); neck.position.y = 0.56; spine.add(neck);
  const neckM = new THREE.Mesh(geo(`neck${seg}`, () => new THREE.CylinderGeometry(0.052, 0.06, 0.1, seg)), skin); neckM.position.y = 0.04; neck.add(neckM);
  const headG = new THREE.Group(); headG.position.y = 0.17; neck.add(headG);
  const head = new THREE.Mesh(sphere(0.112, seg + 4, seg + 2), skin); head.scale.set(0.9, 1.08, 1.0); headG.add(head);
  const jaw = new THREE.Mesh(sphere(0.085, seg + 2, seg), skin); jaw.scale.set(0.92, 0.75, 0.95); jaw.position.set(0, -0.06, 0.018); headG.add(jaw);
  if (detailed) {
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(sphere(0.026, 8, 6), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(sx * 0.1, 0.0, -0.005); headG.add(ear);
      const eye = new THREE.Mesh(sphere(0.015, 8, 6), white); eye.position.set(sx * 0.037, 0.014, 0.096); headG.add(eye);
      const pupil = new THREE.Mesh(sphere(0.008, 6, 4), dark); pupil.position.set(sx * 0.037, 0.014, 0.109); headG.add(pupil);
      const brow = new THREE.Mesh(box(0.038, 0.009, 0.012), hair); brow.position.set(sx * 0.038, 0.04, 0.1); brow.rotation.z = sx * -0.12; headG.add(brow);
    }
    const nose = new THREE.Mesh(geo('nose', () => new THREE.ConeGeometry(0.017, 0.05, 6)), skin); nose.rotation.x = Math.PI / 2 + 0.35; nose.position.set(0, -0.005, 0.114); headG.add(nose);
    const mouth = new THREE.Mesh(box(0.04, 0.007, 0.01), mat('#7a3d2a', quality)); mouth.position.set(0, -0.05, 0.098); headG.add(mouth);
  }
  // hair styles: 0 short, 1 medium, 2 long, 3 buzz, 4 bald, (5 afro, 6 mohawk by id)
  const hs = looks.hairStyle === 3 && number % 5 === 0 ? 5 : looks.hairStyle === 0 && number % 7 === 3 ? 6 : looks.hairStyle;
  if (hs !== 4) {
    const theta = { 0: 0.5, 1: 0.58, 2: 0.62, 3: 0.44, 5: 0.7, 6: 0.3 }[hs] * Math.PI;
    const r = hs === 5 ? 0.15 : hs === 3 ? 0.116 : 0.122;
    const hg = geo(`hair${hs}_${seg}`, () => new THREE.SphereGeometry(r, seg + 4, seg + 2, 0, Math.PI * 2, 0, theta));
    const h = new THREE.Mesh(hg, hair);
    h.position.set(0, hs === 5 ? 0.03 : 0.012, -0.012); h.rotation.x = -0.3; h.scale.set(0.95, 1.05, 1.06);
    if (hs !== 6) headG.add(h);
    if (hs === 2) { const back = new THREE.Mesh(box(0.2, 0.18, 0.06), hair); back.position.set(0, -0.06, -0.085); headG.add(back); }
    if (hs === 6) { const m = new THREE.Mesh(box(0.035, 0.06, 0.22), hair); m.position.set(0, 0.1, -0.01); headG.add(m); }
  }
  if (looks.beard) { const b = new THREE.Mesh(sphere(0.088, seg + 2, seg), hair); b.scale.set(0.95, 0.72, 0.95); b.position.set(0, -0.075, 0.02); headG.add(b); }

  const mkArm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.2, 0.48, 0); spine.add(sh);
    const delt = new THREE.Mesh(sphere(0.068), sleeve); delt.position.y = -0.02; sh.add(delt);
    const up = new THREE.Mesh(limbGeo(0.062, 0.05, 0.28, seg), sleeve); sh.add(up);
    const cuff = new THREE.Mesh(geo(`cuff${seg}`, () => new THREE.CylinderGeometry(0.056, 0.056, 0.025, seg)), trim); cuff.position.y = -0.15; sh.add(cuff);
    const armSkin = new THREE.Mesh(limbGeo(0.048, 0.044, 0.14, seg), isGK ? sleeve : skin); armSkin.position.y = -0.15; sh.add(armSkin);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    const fore = new THREE.Mesh(limbGeo(0.044, 0.034, 0.25, seg), isGK ? sleeve : skin); el.add(fore);
    const hand = new THREE.Mesh(sphere(isGK ? 0.058 : 0.043), glove); hand.scale.set(0.8, 1.2, 0.6); hand.position.y = -0.28; el.add(hand);
    return { sh, el };
  };
  const mkLeg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.092, -0.06, 0); hips.add(hip);
    const leg = new THREE.Mesh(geo(`shortleg${seg}`, () => new THREE.CylinderGeometry(0.09, 0.083, 0.2, seg)), shorts); leg.position.y = -0.06; hip.add(leg);
    const th = new THREE.Mesh(limbGeo(0.078, 0.058, 0.43, seg), skin); hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const kneeCap = new THREE.Mesh(sphere(0.055), skin); knee.add(kneeCap);
    const shin = new THREE.Mesh(limbGeo(0.058, 0.04, 0.42, seg), socks); shin.position.y = -0.02; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.42; knee.add(ankle);
    const foot = new THREE.Mesh(geo(`boot${seg}`, () => { const g = new THREE.CapsuleGeometry(0.045, 0.16, 3, seg); g.rotateX(Math.PI / 2); g.scale(1.05, 0.8, 1); return g; }), boot);
    foot.position.set(0, -0.025, 0.06); ankle.add(foot);
    if (detailed) { const sole = new THREE.Mesh(box(0.085, 0.012, 0.25), dark); sole.position.set(0, -0.058, 0.06); ankle.add(sole); }
    return { hip, knee, ankle };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const legL = mkLeg(1), legR = mkLeg(-1);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const m = { root, body, hips, spine, neck, armL, armR, legL, legR, shirtM, phase: Math.random() * 6, wF: 1, wB: 0, wS: 0, amp: 0, yaw: 0, prevAction: null, actionW: 0, textures: [shirtTex, shortsTex] };
  return m;
}

const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const L = (a, b, t) => a + (b - a) * t;

// pose object: joint angles that we blend
function zeroPose() {
  return { hipLx: 0, hipRx: 0, hipLz: 0, hipRz: 0, kneeL: 0.1, kneeR: 0.1, shLx: 0, shRx: 0, shLz: 0.1, shRz: -0.1, elL: -0.3, elR: -0.3, spineX: 0, spineZ: 0, neckX: 0, bodyY: 0, bodyX: 0, bodyZ: 0, ankleL: 0, ankleR: 0 };
}

function locomotion(m, p, dt) {
  const sp = p.speed;
  const f = p.facing;
  const fx = Math.cos(f), fz = Math.sin(f);
  const fwd = p.vel.x * fx + p.vel.z * fz;
  const side = p.vel.x * -fz + p.vel.z * fx;
  const k = 1 - Math.exp(-dt * 8);
  const tot = Math.abs(fwd) + Math.abs(side) + 1e-3;
  m.wF = L(m.wF, Math.max(0, fwd) / tot, k);
  m.wB = L(m.wB, Math.max(0, -fwd) / tot, k);
  m.wS = L(m.wS, Math.abs(side) / tot, k);
  m.sideSign = side >= 0 ? 1 : -1;
  m.amp = L(m.amp, Math.min(1, sp / 8.5), k);
  const freq = sp < 0.25 ? 0 : 0.95 + sp * 0.155;
  m.phase += dt * Math.PI * 2 * freq;
  const ph = m.phase, A = 0.18 + m.amp * 0.85, a = m.amp;
  const P = zeroPose();
  const sF = Math.sin(ph), cF = Math.cos(ph);
  // forward run
  const swing = sF * A;
  P.hipLx = -swing * (m.wF + 0.6 * m.wB) * (m.wB > m.wF ? -0.7 : 1);
  P.hipRx = swing * (m.wF + 0.6 * m.wB) * (m.wB > m.wF ? -0.7 : 1);
  P.kneeL = 0.12 + Math.max(0, cF) * A * 1.5;
  P.kneeR = 0.12 + Math.max(0, -cF) * A * 1.5;
  P.shLx = swing * 0.85 * (1 - m.wS * 0.6);
  P.shRx = -swing * 0.85 * (1 - m.wS * 0.6);
  P.elL = P.elR = -(0.35 + a * 1.0);
  P.spineX = a * 0.22 * m.wF - 0.08 * m.wB;
  // side steps
  P.hipLz = m.wS * Math.max(0, sF) * 0.35 * (sp > 0.25 ? 1 : 0);
  P.hipRz = -m.wS * Math.max(0, -sF) * 0.35 * (sp > 0.25 ? 1 : 0);
  P.bodyY = Math.abs(Math.sin(ph)) * 0.035 * Math.min(1, sp / 2) + (sp < 0.25 ? 0 : -0.01);
  // idle stance
  if (sp < 0.25) {
    const br = Math.sin(performance.now() / 600 + m.phase) * 0.02;
    P.kneeL = P.kneeR = 0.18; P.hipLx = P.hipRx = -0.08; P.spineX = 0.08 + br; P.bodyY = -0.02;
    if (p.isGK) { P.kneeL = P.kneeR = 0.5; P.hipLx = P.hipRx = -0.4; P.spineX = 0.35; P.shLz = 0.5; P.shRz = -0.5; P.shLx = P.shRx = -0.4; P.bodyY = -0.08; }
  }
  return P;
}

function actionPose(m, p, P) {
  const ac = p.action;
  if (!ac) return 0;
  const u = ac.t / ac.dur;
  let w = sm(ac.t / 0.08) * sm((ac.dur - ac.t) / 0.15);
  const t = ac.type;
  if (t === 'pass' || t === 'longpass' || t === 'cross' || t === 'shot' || t === 'clear') {
    const power = t === 'shot' ? 1.25 : t === 'pass' ? 0.75 : 1.05;
    const r = ac.release ? ac.release / ac.dur : 0.45;
    let th, kn;
    if (u < r) { const q = u / r; th = 0.8 * power * sm(q); kn = 0.4 + 1.1 * sm(q); }
    else if (u < r + 0.18) { const q = (u - r) / 0.18; th = L(0.8 * power, -1.25 * power, sm(q)); kn = L(1.5, 0.05, sm(q)); }
    else { const q = (u - r - 0.18) / Math.max(0.01, 1 - r - 0.18); th = L(-1.25 * power, -0.2, sm(q)); kn = L(0.05, 0.25, q); }
    P.hipRx = th; P.kneeR = kn; P.hipLx = -0.15; P.kneeL = 0.3;
    P.shLz = 0.9; P.shRz = -0.5; P.shLx = -0.3; P.shRx = 0.5; P.elL = -0.4; P.elR = -0.4;
    P.spineX = t === 'longpass' || t === 'cross' ? -0.12 : 0.15; P.spineZ = 0.08;
    P.bodyY = -0.03;
  } else if (t === 'throw') {
    const q = u < 0.55 ? sm(u / 0.55) : 1 - sm((u - 0.55) / 0.45);
    P.shLx = P.shRx = L(-2.4, -3.05, q); P.elL = P.elR = L(-0.2, -1.5, q);
    P.spineX = L(0.25, -0.3, q); P.hipLx = -0.3; P.kneeL = 0.3; P.hipRx = 0.3; P.kneeR = 0.4;
  } else if (t === 'header' && ac.style === 'diving') {
    // diving header: body flies horizontally into the ball
    const q = Math.sin(Math.PI * Math.min(1, u * 1.1));
    w = Math.max(w, q);
    P.bodyX = 1.35 * q; P.bodyY = 0.42 * q; P.spineX = -0.25; P.neckX = -0.5;
    P.shLx = P.shRx = 0.7; P.shLz = 0.5; P.shRz = -0.5; P.elL = P.elR = -0.3;
    P.hipLx = P.hipRx = 0.35; P.kneeL = P.kneeR = 0.25;
  } else if (t === 'header' && ac.style === 'bicycle') {
    // bicycle kick (Fallrückzieher): lean back, legs scissor over the head
    const q = Math.sin(Math.PI * Math.min(1, u * 1.05));
    w = Math.max(w, q);
    P.bodyX = -2.45 * sm(u / 0.55); P.bodyY = 0.95 * q;
    P.hipLx = 0.9; P.kneeL = 0.9; P.hipRx = L(0.6, -2.3, sm(u / 0.5)); P.kneeR = L(1.2, 0.1, sm(u / 0.5));
    P.shLz = 1.3; P.shRz = -1.3; P.shLx = P.shRx = 0.4; P.elL = P.elR = -0.2; P.spineX = -0.3;
  } else if (t === 'header') {
    P.bodyY = Math.sin(Math.PI * u) * 0.45;
    P.spineX = u < 0.45 ? L(0, -0.35, sm(u / 0.45)) : L(-0.35, 0.45, sm((u - 0.45) / 0.3));
    P.neckX = P.spineX * 0.6;
    P.shLz = 0.8; P.shRz = -0.8; P.shLx = P.shRx = -0.5; P.elL = P.elR = -0.8;
    P.kneeL = 0.9; P.kneeR = 0.5; P.hipLx = -0.5; P.hipRx = -0.2;
  } else if (t === 'tackle') {
    const q = Math.sin(Math.PI * Math.min(1, u * 1.3));
    P.hipRx = -1.0 * q; P.hipRz = -0.35 * q; P.kneeR = 0.15; P.kneeL = 0.7 * q; P.hipLx = 0.1;
    P.spineX = 0.25 * q; P.shLz = 0.7; P.shRz = -0.6; P.bodyY = -0.12 * q;
  } else if (t === 'slide') {
    const q = sm(u / 0.2) * (1 - sm((u - 0.75) / 0.25));
    w = Math.max(w, q);
    P.bodyY = -0.18 * q; P.bodyX = -1.05 * q;
    P.hipRx = -1.25; P.kneeR = 0.1; P.hipLx = -0.4; P.kneeL = 1.5; P.hipLz = 0.2;
    P.shLx = 0.6; P.shRx = 0.6; P.shLz = 0.6; P.shRz = -0.6; P.spineX = 0.5;
  } else if (t === 'dive') {
    const dir = ac.world ? (ac.dir * Math.cos(p.facing) >= 0 ? 1 : -1) : 1; // + = to player's right
    const q = sm(u / 0.25);
    w = Math.max(w, Math.min(1, q * 1.2) * (1 - sm((u - 0.85) / 0.15)));
    P.bodyZ = dir * 1.3 * q;
    P.bodyY = (ac.high ? 0.75 : 0.35) * Math.sin(Math.PI * Math.min(1, u * 1.4)) - 0.35 * sm((u - 0.5) / 0.4);
    P.shLx = P.shRx = -2.9; P.elL = P.elR = -0.1; P.shLz = 0.2; P.shRz = -0.2;
    P.hipLx = P.hipRx = 0.1; P.kneeL = P.kneeR = 0.2; P.hipLz = 0.3; P.hipRz = -0.3;
  } else if (t === 'catch' || t === 'set') {
    P.shLx = P.shRx = -1.3; P.elL = P.elR = -0.5; P.kneeL = P.kneeR = 0.6; P.hipLx = P.hipRx = -0.45; P.spineX = 0.35; P.bodyY = -0.1;
  } else if (t === 'control') {
    const q = Math.sin(Math.PI * u);
    P.hipRx = -0.45 * q; P.kneeR = 0.6 * q; P.spineX = 0.18; P.shLz = 0.4; P.shRz = -0.4;
  } else if (t === 'celebrate' && ac.style && ac.style !== 'jump') {
    const st = ac.style, tt = ac.t;
    // v2.8: while running to the fans the legs keep their running cycle (only the upper body celebrates);
    // standing still they bounce / step on the spot instead of being frozen
    const moving = (m.amp || 0) > 0.15;
    P._upper = moving ? !['knieslide', 'backflip'].includes(st) : ['airplane', 'salute'].includes(st);
    const stepOnSpot = () => { const s1 = Math.sin(tt * 6.5); P.hipLx = 0.3 * s1; P.hipRx = -0.3 * s1; P.kneeL = 0.25 + 0.45 * Math.max(0, s1); P.kneeR = 0.25 + 0.45 * Math.max(0, -s1); P.bodyY = Math.abs(s1) * 0.05; };
    if (st === 'knieslide') {
      const q = sm(u / 0.25);
      P.bodyY = -0.42 * q; P.kneeL = P.kneeR = 1.75 * q + 0.1; P.hipLx = P.hipRx = 0.25 * q; P.spineX = -0.55 * q; P.neckX = -0.4 * q;
      P.shLx = P.shRx = -2.6; P.shLz = 0.9; P.shRz = -0.9; P.elL = P.elR = -0.15;
    } else if (st === 'airplane') {
      P.shLz = 1.55; P.shRz = -1.55; P.shLx = P.shRx = 0; P.elL = P.elR = -0.05; P.bodyZ = Math.sin(tt * 2.2) * 0.38; P.spineZ = Math.sin(tt * 2.2) * 0.15;
    } else if (st === 'salute') {
      P.shRx = -2.9; P.shRz = -0.6; P.elR = -1.9; P.shLx = -0.3; P.shLz = 0.4; P.elL = -0.6; P.spineX = -0.1;
    } else if (st === 'shush') {
      P.shRx = -1.7; P.shRz = -0.25; P.elR = -2.4; P.shLz = 0.5; P.shLx = 0.2; P.neckX = 0.1; stepOnSpot();
    } else if (st === 'heart') {
      P.shLx = P.shRx = -2.25; P.shLz = -0.25; P.shRz = 0.25; P.elL = P.elR = -1.8; P.spineX = -0.1; stepOnSpot();
    } else if (st === 'backflip') {
      const v = Math.min(1, tt / 1.1);
      if (v < 1) { w = Math.max(w, 1); P.bodyX = -Math.PI * 2 * sm(v); P.bodyY = 1.25 * Math.sin(Math.PI * v); P.kneeL = P.kneeR = 1.7 * Math.sin(Math.PI * v); P.hipLx = P.hipRx = -1.2 * Math.sin(Math.PI * v); P.shLx = P.shRx = -2.6; }
      else { const j = Math.abs(Math.sin(tt * 7)); P.shLx = P.shRx = -2.75; P.shLz = 0.35; P.shRz = -0.35; P.bodyY = j * 0.18; P.kneeL = P.kneeR = 0.3 + j * 0.3; }
    } else if (st === 'hug') {
      const j = Math.abs(Math.sin(tt * 6));
      P.shLx = P.shRx = -1.35; P.shLz = -0.55; P.shRz = 0.55; P.elL = P.elR = -1.25; P.spineX = 0.2; P.hipLx = 0.2 * Math.sin(tt * 6); P.hipRx = -P.hipLx; P.kneeL = 0.3 + j * 0.25; P.kneeR = 0.3 + (1 - j) * 0.25; P.bodyY = j * 0.08;
    } else if (st === 'shake') {
      P.shRx = -1.15; P.shRz = -0.15; P.elR = -0.35; P.shLz = 0.15; P.spineX = 0.08; P.kneeL = P.kneeR = 0.12;
    }
  } else if (t === 'celebrate') {
    const j = Math.abs(Math.sin(ac.t * 7));
    P.shLx = P.shRx = -2.75; P.shLz = 0.35; P.shRz = -0.35; P.elL = P.elR = -0.2; P.spineX = -0.15;
    if ((m.amp || 0) > 0.15) P._upper = true; // running with arms up: legs keep running
    else { P.bodyY = j * 0.18; P.kneeL = P.kneeR = 0.3 + j * 0.45; P.hipLx = P.hipRx = -0.25 * j; P.ankleL = P.ankleR = 0.3 * j; } // jumping: knees and hips push off
  } else if (t === 'frustrate') {
    P.shLx = P.shRx = -2.3; P.shLz = 1.2; P.shRz = -1.2; P.elL = P.elR = -2.2; P.neckX = 0.45; P.spineX = 0.15;
  } else if (t === 'injured') {
    w = Math.max(w, sm(u / 0.1));
    P.bodyY = 0.14; P.bodyX = -1.5; P.hipLx = -1.2; P.kneeL = 1.8; P.hipRx = -0.2; P.kneeR = 0.3;
    P.shLx = P.shRx = -1.0; P.elL = P.elR = -1.8;
  }
  return w;
}

export function animatePlayer(m, p, dt) {
  const base = locomotion(m, p, dt);
  const act = zeroPose();
  let w = actionPose(m, p, act);
  if (p.injured && !(p.action && p.action.type === 'injured')) { const tmp = zeroPose(); p2(tmp); Object.assign(act, tmp); w = 1; }
  function p2(P) { P.bodyY = 0.14; P.bodyX = -1.5; P.hipLx = -1.2; P.kneeL = 1.8; P.shLx = P.shRx = -1.0; P.elL = P.elR = -1.8; }
  const k = 1 - Math.exp(-dt * 12);
  m.actionW = L(m.actionW, w, k);
  const W = m.actionW;
  const P = {};
  const LEGS = act._upper ? new Set(['hipLx', 'hipRx', 'hipLz', 'hipRz', 'kneeL', 'kneeR', 'bodyY', 'ankleL', 'ankleR']) : null;
  for (const key in base) P[key] = LEGS && LEGS.has(key) ? base[key] : L(base[key], act[key], W);
  m.legL.hip.rotation.set(P.hipLx, 0, P.hipLz);
  m.legR.hip.rotation.set(P.hipRx, 0, P.hipRz);
  m.legL.knee.rotation.x = P.kneeL; m.legR.knee.rotation.x = P.kneeR;
  m.legL.ankle.rotation.x = -P.kneeL * 0.3; m.legR.ankle.rotation.x = -P.kneeR * 0.3;
  m.armL.sh.rotation.set(P.shLx, 0, P.shLz);
  m.armR.sh.rotation.set(P.shRx, 0, P.shRz);
  m.armL.el.rotation.x = P.elL; m.armR.el.rotation.x = P.elR;
  m.spine.rotation.set(P.spineX, 0, P.spineZ);
  m.neck.rotation.x = P.neckX;
  m.body.position.y = P.bodyY * m.body.scale.y;
  m.body.rotation.set(P.bodyX, 0, P.bodyZ);
  // root transform
  m.root.position.set(p.pos.x, 0, p.pos.z);
  m.root.rotation.y = Math.PI / 2 - p.facing;
}
