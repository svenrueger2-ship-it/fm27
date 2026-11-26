// 3D stadium: pitch with markings, goals with nets, flags, ad boards, stands with instanced crowd,
// roofs, floodlights, dugouts, technical areas and tunnel. Size scales with stadium capacity.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF_L, HALF_W, GOAL_HW, GOAL_H, GOAL_D, PEN_D, PEN_HW, SIX_D, SIX_HW, PEN_SPOT, CIRCLE_R } from '../match/constants.js';
import { SPONSORS } from '../data/leagues.js';
import { crestImage } from './crestImages.js';
import { rowsForSize } from '../manager/stadiumBuild.js';

const LINE = 0.15;

function grassTexture(quality, pattern = 'streifen') {
  const w = quality === 'niedrig' ? 512 : quality === 'mittel' ? 1024 : 2048, h = w / 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const stripes = 22;
  for (let i = 0; i < stripes; i++) {
    for (let j = 0; j < (pattern === 'karo' ? 12 : 1); j++) {
      const light = pattern === 'karo' ? (i + j) % 2 : i % 2;
      g.fillStyle = light ? '#478a3a' : '#3a7631';
      const rh = pattern === 'karo' ? h / 12 : h;
      g.fillRect((i * w) / stripes, j * rh, w / stripes + 1, rh + 1);
    }
  }
  // wear: goal mouths, centre circle and the penalty spots get lighter & browner
  const wear = (x, y, rx, ry, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, `rgba(150,140,80,${a})`); gr.addColorStop(1, 'rgba(150,140,80,0)');
    g.save(); g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(x, y * rx / ry, rx, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const sx = w / 115, sy = h / 78;
  for (const side of [-1, 1]) { wear((57.5 + side * 51) * sx, 39 * sy, 7 * sx, 7 * sy, 0.35); wear((57.5 + side * 46) * sx, 39 * sy, 4 * sx, 4 * sy, 0.25); }
  wear(57.5 * sx, 39 * sy, 6 * sx, 6 * sy, 0.18);
  // fine noise
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] += n * 0.8; img.data[i + 1] += n * 1.2; img.data[i + 2] += n * 0.5;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Tiling blade-detail texture multiplied over the base grass (shows up close to the camera)
function grassDetail() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + Math.random() * 90; g.strokeStyle = `rgb(${v},${v + 10},${v})`;
    const x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y - 3 - Math.random() * 4); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 48); t.anisotropy = 8;
  return t;
}

function adTexture(names, color) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1530'; g.fillRect(0, 0, 2048, 64);
  const seg = 2048 / names.length;
  names.forEach((n, i) => {
    g.fillStyle = i % 2 ? '#0e1d45' : color;
    g.fillRect(i * seg, 0, seg, 64);
    g.fillStyle = i % 2 ? '#7fe3a5' : '#ffffff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 34; g.font = `bold ${fs}px Arial, sans-serif`;
    while (fs > 14 && g.measureText(n).width > seg * 0.86) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; }
    g.fillText(n, i * seg + seg / 2, 34);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#151515';
  const spots = [[32, 20], [96, 20], [160, 20], [224, 20], [0, 64], [64, 64], [128, 64], [192, 64], [256, 64], [32, 108], [96, 108], [160, 108], [224, 108]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBall(quality) {
  const seg = quality === 'niedrig' ? 10 : 18;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, seg, seg - 4), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
  m.castShadow = true;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  return { mesh: m, shadow };
}

// Static meshes are collected per material and merged to keep draw calls low.
function bake(group, m) { m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix); (group.userData.parts ||= []).push(g); }
function flush(group, mat, opts = {}) {
  const parts = group.userData.parts; if (!parts?.length) return null;
  const nonIndexed = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of nonIndexed) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); }
  const mesh = new THREE.Mesh(mergeGeometries(nonIndexed), mat);
  Object.assign(mesh, opts);
  group.add(mesh); group.userData.parts = [];
  return mesh;
}
function addLine(group, mat, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len + LINE, LINE), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
  m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  bake(group, m);
}
function addArc(group, mat, x, z, r, start, length, y = 0.02) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - LINE / 2, r + LINE / 2, 48, 1, start, length), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  bake(group, m);
}

function buildGoal(side, quality) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, GOAL_H + 0.06, 12);
  for (const z of [-GOAL_HW - 0.06, GOAL_HW + 0.06]) {
    const p = new THREE.Mesh(postGeo, white); p.position.set(0, (GOAL_H + 0.06) / 2, z); p.castShadow = true; g.add(p);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, GOAL_H, 6), white); back.position.set(side * GOAL_D, GOAL_H / 2, z); g.add(back);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, GOAL_D, 6), white); top.rotation.z = Math.PI / 2; top.position.set(side * GOAL_D / 2, GOAL_H, z); g.add(top);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_HW * 2 + 0.24, 12), white);
  bar.rotation.x = Math.PI / 2; bar.position.set(0, GOAL_H + 0.06, 0); bar.castShadow = true; g.add(bar);
  // net as line grid
  const pts = [];
  const step = quality === 'niedrig' ? 0.3 : 0.15;
  const W = GOAL_HW, H = GOAL_H, D = GOAL_D * side;
  for (let z = -W; z <= W + 1e-6; z += step) { pts.push(D, 0, z, D, H, z); pts.push(0, H, z, D, H, z); }
  for (let y = 0; y <= H + 1e-6; y += step) { pts.push(D, y, -W, D, y, W); pts.push(0, y, -W, D, y, -W); pts.push(0, y, W, D, y, W); }
  for (let x = 0; Math.abs(x) <= Math.abs(D) + 1e-6; x += step * side) { pts.push(x, 0, -W, x, H, -W); pts.push(x, 0, W, x, H, W); pts.push(x, H, -W, x, H, W); }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const net = new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
  g.add(net);
  g.position.x = side * HALF_L;
  return g;
}

export function buildStadium(scene, opts = {}) {
  const { capacity = 30000, home, quality = 'mittel' } = opts;
  const root = new THREE.Group();
  scene.add(root);
  const crowdScale = ({ niedrig: 0.28, mittel: 0.5, hoch: 0.75, ultra: 1 }[quality] ?? 0.6) * (opts.fill ?? 0.92);
  // surrounding ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshLambertMaterial({ color: 0x1d2a22 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; root.add(ground);
  // pitch
  const tex = grassTexture(quality, opts.pattern);
  const pitchW = HALF_L * 2 + 10, pitchH = HALF_W * 2 + 10;
  let pitchMat;
  if (quality === 'niedrig') pitchMat = new THREE.MeshLambertMaterial({ map: tex });
  else {
    pitchMat = new THREE.MeshStandardMaterial({ map: tex, roughness: opts.wet ? 0.42 : 0.88, metalness: 0 });
    const detail = grassDetail();
    pitchMat.onBeforeCompile = (sh) => {
      sh.uniforms.tDetail = { value: detail };
      sh.fragmentShader = 'uniform sampler2D tDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.rgb *= 0.55 + 0.9 * texture2D(tDetail, vMapUv * vec2(70.0, 48.0)).r;');
    };
  }
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(pitchW, pitchH), pitchMat);
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; root.add(pitch);
  // markings
  const lines = new THREE.Group(); root.add(lines);
  // lit, slightly off-white paint so the lines sit in the grass and do not bloom
  const lm = new THREE.MeshLambertMaterial({ color: 0xdcdcd6 });
  const L = HALF_L, W = HALF_W;
  addLine(lines, lm, -L, -W, L, -W); addLine(lines, lm, -L, W, L, W);
  addLine(lines, lm, -L, -W, -L, W); addLine(lines, lm, L, -W, L, W);
  addLine(lines, lm, 0, -W, 0, W);
  addArc(lines, lm, 0, 0, CIRCLE_R, 0, Math.PI * 2);
  const spot = new THREE.CircleGeometry(0.15, 16);
  for (const s of [-1, 1]) {
    const x0 = s * L, xp = s * (L - PEN_D), x6 = s * (L - SIX_D);
    addLine(lines, lm, x0, -PEN_HW, xp, -PEN_HW); addLine(lines, lm, x0, PEN_HW, xp, PEN_HW); addLine(lines, lm, xp, -PEN_HW, xp, PEN_HW);
    addLine(lines, lm, x0, -SIX_HW, x6, -SIX_HW); addLine(lines, lm, x0, SIX_HW, x6, SIX_HW); addLine(lines, lm, x6, -SIX_HW, x6, SIX_HW);
    const ps = new THREE.Mesh(spot, lm); ps.rotation.x = -Math.PI / 2; ps.position.set(s * (L - PEN_SPOT), 0.013, 0); bake(lines, ps);
    const ang = Math.acos((PEN_D - PEN_SPOT) / CIRCLE_R);
    addArc(lines, lm, s * (L - PEN_SPOT), 0, CIRCLE_R, s > 0 ? Math.PI - ang : -ang, ang * 2);
    for (const zs of [-1, 1]) {
      const start = s > 0 ? (zs > 0 ? Math.PI / 2 : Math.PI) : (zs > 0 ? 0 : -Math.PI / 2);
      addArc(lines, lm, s * L, zs * W, 1, start, Math.PI / 2);
    }
    root.add(buildGoal(s, quality));
  }
  const cs = new THREE.Mesh(spot, lm); cs.rotation.x = -Math.PI / 2; cs.position.y = 0.013; bake(lines, cs);
  // corner flags
  const flagMat = new THREE.MeshLambertMaterial({ color: 0xf5d000, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), poleMat);
    pole.position.set(sx * L, 0.75, sz * W); root.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), flagMat);
    fl.position.set(sx * L + 0.2 * -sx, 1.35, sz * W); root.add(fl);
  }
  // technical areas & dugouts (touchline z = +W)
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc6e8, transparent: true, opacity: 0.35, roughness: 0.1 });
  const seatMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(home?.primary || '#c00') });
  for (const sx of [-1, 1]) {
    const cx = sx * 9;
    addLine(lines, lm, cx - 5, W + 1, cx + 5, W + 1); addLine(lines, lm, cx - 5, W + 1, cx - 5, W + 3.2); addLine(lines, lm, cx + 5, W + 1, cx + 5, W + 3.2);
    const dug = new THREE.Group(); dug.position.set(cx, 0, W + 4.6);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 1.6), benchMat); floor.position.y = 0.05; dug.add(floor);
    const backW = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 0.08), benchMat); backW.position.set(0, 0.8, 0.8); dug.add(backW);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 1.8), glass); roof.position.set(0, 1.7, 0); dug.add(roof);
    for (const ex of [-4, 4]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 1.8), glass); side.position.set(ex, 0.85, 0); dug.add(side); }
    for (let i = 0; i < 8; i++) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.5), seatMat); seat.position.set(-3.5 + i, 0.33, 0.45); dug.add(seat); }
    root.add(dug);
  }
  // markings were only collected – merge them into one mesh so they actually render
  const lmesh = flush(lines, lm);
  if (lmesh) { lmesh.renderOrder = 1; lm.polygonOffset = true; lm.polygonOffsetFactor = -2; lm.polygonOffsetUnits = -2; }
  // 4th official / substitution zone marker
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0x15ff8a }));
  board.position.set(0, 1.0, W + 2.2); root.add(board);
  // ad boards
  const names = [...SPONSORS, ...SPONSORS.slice(0, 4)];
  const adTex = adTexture(names, home?.primary || '#c00');
  adTex.wrapS = THREE.RepeatWrapping;
  const adMat = new THREE.MeshBasicMaterial({ map: adTex });
  const adGeoL = new THREE.BoxGeometry(HALF_L * 2 + 8, 0.9, 0.12);
  for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(adGeoL, adMat); a.position.set(0, 0.45, sz * (W + (sz > 0 ? 7.2 : 4.5))); root.add(a);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, HALF_W - 6), adMat); a.position.set(sx * (L + 4), 0.45, sz * (HALF_W / 2 + 4)); root.add(a);
  }
  // ------------------------------------------------------------------ stands
  // layout from the stadium builder (or a simple one derived from the capacity)
  const layout = opts.layout || (() => {
    const tiers = capacity >= 38000 ? 2 : 1, size = Math.round(Math.min(10, 2 + capacity / 9000));
    return { stands: [0, 1, 2, 3].map((i) => ({ size, tiers, standing: i === 2, roof: 2, boxes: i === 0 ? 1 : 0 })), lights: 2, screens: 2 };
  })();
  const rows3D = (S, t) => Math.max(5, Math.round(rowsForSize(S.size, t) * 0.62));
  const twoTier = layout.stands.some((S) => S.tiers > 1);
  const stepD = 0.85, stepH = 0.5;
  const standMat = new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.95 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.95 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xc3c9d2, roughness: 0.35, metalness: 0.7 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff7e0 });
  const seatA = new THREE.Color(home?.primary || '#b00'), seatB = new THREE.Color(home?.secondary || '#fff');
  const stands = [
    { len: HALF_L * 2 + 12, axis: 'x', sign: 1, off: W + 9.5 },
    { len: HALF_L * 2 + 12, axis: 'x', sign: -1, off: W + 6.5 },
    { len: HALF_W * 2 + 6, axis: 'z', sign: 1, off: L + 7 },
    { len: HALF_W * 2 + 6, axis: 'z', sign: -1, off: L + 7 },
  ];
  const crowdPositions = [];
  const fanSpots = { home: [], away: [] };
  const stepGeo = new THREE.BoxGeometry(1, 1, 1);
  const place = (st, along, depth, y, obj) => {
    if (st.axis === 'x') obj.position.set(along, y, st.sign * depth); else obj.position.set(st.sign * depth, y, along);
  };
  const ribbons = [];
  let topY = 0, backDepth = 0, mainTop = 0, mainBack = W + 20;
  stands.forEach((st, si) => { st.idx = si; });
  let seatEstimate = 0;
  stands.forEach((st) => { const S = layout.stands[st.idx]; for (let t = 0; t < S.tiers; t++) seatEstimate += rows3D(S, t) * (st.len + t * 12) / 0.55; });
  const maxFans = { niedrig: 7000, mittel: 16000, hoch: 28000, ultra: 42000 }[quality] ?? 16000;
  const density = Math.min(crowdScale, maxFans / Math.max(1, seatEstimate));
  for (const st of stands) {
    const g = new THREE.Group();
    const conc = new THREE.Group();
    const S = layout.stands[st.idx];
    const tiers = [];
    { let d0 = st.off, h0 = 0;
      for (let t = 0; t < S.tiers; t++) { const rows = rows3D(S, t); tiers.push({ rows, d0, h0 }); d0 += rows * stepD * 0.72 + 2.5; h0 += rows * stepH + 4.2; } }
    const rows1 = tiers[0].rows;
    st.tiers = tiers; // v6.0 choreo placement
    for (const t of tiers) {
      for (let r = 0; r < t.rows; r++) {
        const h = t.h0 + (r + 1) * stepH, d = t.d0 + r * stepD, len = st.len + (t.d0 - st.off + r * stepD) * 1.4;
        const m = new THREE.Mesh(stepGeo, standMat);
        const y0 = t.h0 > 0 ? t.h0 - 2.5 + r * stepH * 0.6 : 0, hh = h - y0; // upper tiers hang over the lower ones
        if (st.axis === 'x') { m.scale.set(len, hh, stepD); m.position.set(0, y0 + hh / 2, st.sign * (d + stepD / 2)); }
        else { m.scale.set(stepD, hh, len); m.position.set(st.sign * (d + stepD / 2), y0 + hh / 2, 0); }
        bake(g, m);
        const terrace = S.standing && t.h0 === 0; // standing terrace (Stehplatz) from the builder
        const gap = terrace ? 0.46 : 0.55;
        const seats = Math.floor(len / gap);
        for (let i = 0; i < seats; i++) {
          if (Math.random() > (terrace ? Math.min(1, density * 1.25) : density)) continue;
          const u = -len / 2 + 0.3 + i * gap + (terrace ? (Math.random() - 0.5) * 0.15 : 0);
          // away block in the corner of the far end – its size comes from the builder (Gästeblock level)
          const awayCut = [0.62, 0.3, 0.05][layout.away ?? 1] ?? 0.3;
          const away = st.idx === 3 && u > st.len * awayCut && t.h0 === 0;
          const family = !away && (layout.family ?? 0) > 0 && st.idx === 1 && t.h0 === 0 && u < -st.len * (0.5 - 0.18 * layout.family);
          const p = st.axis === 'x' ? [u, h, st.sign * (d + stepD * 0.5)] : [st.sign * (d + stepD * 0.5), h, u];
          p.push(terrace ? 1 : 0, away ? 1 : 0, st.axis === 'x' ? (st.sign > 0 ? Math.PI : 0) : (st.sign > 0 ? -Math.PI / 2 : Math.PI / 2), family ? 1 : 0);
          crowdPositions.push(p);
          // pyro spots: front rows of the home end and of the away block (v1.0)
          if (t.h0 === 0 && h < 4.5 && (st.idx === 2 || away) && Math.random() < 0.06) (away ? fanSpots.away : fanSpots.home).push([p[0], p[1], p[2]]);
        }
      }
    }
    const last = tiers[tiers.length - 1];
    const top = last.h0 + last.rows * stepH, back = last.d0 + last.rows * stepD;
    topY = Math.max(topY, top); backDepth = Math.max(backDepth, back - st.off);
    if (st.axis === 'x' && st.sign > 0) { mainTop = top; mainBack = back; }
    const alongLen = st.len + (back - st.off) * 1.4;
    // back wall / facade
    const wall = new THREE.Mesh(stepGeo, concreteMat);
    if (st.axis === 'x') { wall.scale.set(alongLen, top + 9, 1.2); } else { wall.scale.set(1.2, top + 9, alongLen); }
    place(st, 0, back + 0.6, (top + 9) / 2, wall); bake(conc, wall);
    // VIP boxes: glazed hospitality band at the back of the lower tier
    if (S.boxes > 0) {
      const gl = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({ color: 0x2a2f3a, emissive: 0xffd9a0, emissiveIntensity: 0.25 + S.boxes * 0.18, roughness: 0.15, metalness: 0.6 }));
      const bd = tiers[0].d0 + rows1 * stepD + 0.4, by = rows1 * stepH + 1.1;
      if (st.axis === 'x') gl.scale.set(st.len * (0.35 + S.boxes * 0.2), 1.6 + S.boxes * 0.4, 1); else gl.scale.set(1, 1.6 + S.boxes * 0.4, st.len * (0.35 + S.boxes * 0.2));
      place(st, 0, bd, by, gl); g.add(gl);
    }
    // fascia LED ribbon between tiers
    if (S.tiers > 1) {
      const rib = new THREE.Mesh(new THREE.PlaneGeometry(st.len + rows1 * stepD * 1.4, 1.6), new THREE.MeshBasicMaterial({ map: adTex.clone() }));
      rib.material.map.wrapS = THREE.RepeatWrapping; rib.material.map.repeat.set(2, 1); rib.material.map.needsUpdate = true;
      const fd = st.off + rows1 * stepD + 0.2;
      place(st, 0, fd, rows1 * stepH + 1.6, rib);
      if (st.axis === 'x') rib.rotation.y = st.sign > 0 ? Math.PI : 0; else rib.rotation.y = st.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(rib); ribbons.push(rib.material.map);
    }
    // cantilever roof (none / partial / full) with steel trusses and a floodlight strip along the front edge
    if (S.roof > 0) {
    const roofD = S.roof === 2 ? back - st.off + 5 : (back - st.off) * 0.55 + 3;
    const roofFront = back + 1 - roofD;
    const roofY = top + 8.5;
    const roof = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({ color: 0x6b717c, roughness: 0.62, metalness: 0.35, ...(opts.xray ? { transparent: true, opacity: 0.28, depthWrite: false } : {}) }));
    if (st.axis === 'x') roof.scale.set(alongLen + 4, 0.45, roofD); else roof.scale.set(roofD, 0.45, alongLen + 4);
    place(st, 0, roofFront + roofD / 2, roofY, roof); roof.rotation[st.axis === 'x' ? 'x' : 'z'] = (st.axis === 'x' ? -1 : 1) * st.sign * 0.06;
    g.add(roof);
    const trussN = Math.max(4, Math.round(alongLen / 14));
    for (let i = 0; i <= trussN; i++) {
      const u = -alongLen / 2 + (i / trussN) * alongLen;
      const beam = new THREE.Mesh(stepGeo, steelMat);
      if (st.axis === 'x') beam.scale.set(0.35, 0.9, roofD); else beam.scale.set(roofD, 0.9, 0.35);
      place(st, u, roofFront + roofD / 2, roofY + 0.65, beam); bake(conc, beam);
      if (quality !== 'niedrig' && i % 2 === 0) {
        const lamp = new THREE.Mesh(stepGeo, lampMat);
        if (st.axis === 'x') lamp.scale.set(3.2, 0.35, 0.5); else lamp.scale.set(0.5, 0.35, 3.2);
        place(st, u, roofFront + 0.4, roofY - 0.4, lamp); g.add(lamp);
      }
    }
    }
    flush(g, standMat, { receiveShadow: quality !== 'niedrig' });
    flush(conc, concreteMat); conc.children.forEach((c) => { c.material = concreteMat; });
    g.add(conc);
    root.add(g);
  }
  // closed corners so the skyline does not show through the gaps between the stands
  {
    const cm = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.95 });
    const sz2 = backDepth + 10;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(sz2, topY + 9, sz2), cm);
      c.position.set(sx * (L + 7 + sz2 / 2 - 2), (topY + 9) / 2, sz * (W + 7 + sz2 / 2 - 2));
      c.rotation.y = sx * sz * Math.PI / 4 * 0.0; root.add(c);
    }
  }
  // corner pylons for smaller grounds
  if (layout.stands.some((S) => S.roof < 2) || !twoTier) {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8892a0, metalness: 0.5, roughness: 0.5 });
    const th = topY + 24;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, th, 8), towerMat);
      const px = sx * (L + 14 + backDepth * 0.5), pz = sz * (W + 14 + backDepth * 0.5);
      tw.position.set(px, th / 2, pz); root.add(tw);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 0.4), lampMat);
      panel.position.set(px, th + 1, pz); panel.lookAt(0, 0, 0); root.add(panel);
    }
  }
  // video walls in two corners
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 256;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  for (const [sx, sz] of [[1, -1], [-1, 1]].slice(0, layout.screens ?? 2)) {
    const scr = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 8.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x111418 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), screenMat); face.position.z = 0.31;
    scr.add(frame, face);
    scr.position.set(sx * (L + 4), topY + 6, sz * (W + 4));
    scr.lookAt(0, topY * 0.3, 0);
    root.add(scr);
  }
  const drawScreen = (lines = [], shorts = []) => {
    const g = screenCanvas.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#071026'); grd.addColorStop(1, '#0f2a4d');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    g.fillStyle = home?.primary || '#c00'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 246, 512, 10);
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.font = 'bold 34px Arial'; g.fillText(lines[0] || '', 256, 70);
    g.font = 'bold 92px Arial'; g.fillStyle = '#3ddc84'; g.fillText(lines[1] || '', 256, 165);
    g.font = 'bold 30px Arial'; g.fillStyle = '#cfe0ff'; g.fillText(lines[2] || '', 256, 225);
    const [a, b] = shorts.map((x) => crestImage(x));
    if (a) g.drawImage(a, 24, 90, 92, 92);
    if (b) g.drawImage(b, 396, 90, 92, 92);
    screenTex.needsUpdate = true;
  };
  drawScreen([opts.name || 'WILLKOMMEN', '0 : 0', 'ANSTOSS']);
  // tunnel to the dressing rooms (main stand)
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 6), new THREE.MeshStandardMaterial({ color: 0x111820 }));
  tunnel.position.set(0, 1.5, W + 12); root.add(tunnel);
  const tunnelSign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.6, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(home?.primary || '#c00') }));
  tunnelSign.position.set(0, 3.3, W + 8.95); root.add(tunnelSign);
  const hc = opts.homeShort && crestImage(opts.homeShort);
  if (hc) {
    const ct = new THREE.CanvasTexture(hc); ct.colorSpace = THREE.SRGBColorSpace;
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ct, transparent: true }));
    badge.position.set(0, 4.9, W + 8.9); badge.rotation.y = Math.PI; root.add(badge);
    // crest banners on the opposite stand (visible in the TV picture)
    for (const sx of [-1, 1]) { const b2 = badge.clone(); b2.scale.setScalar(1.25); b2.rotation.y = 0; b2.position.set(sx * 26, 1.75, -(W + 6.35)); root.add(b2); }
  }
  // ------------------------------------------------------------------ animated crowd
  // Articulated low-poly fans (legs, torso, arms, head, hair) instanced on the GPU. Per-fan clothing,
  // skin and hair colours; seated fans stand up on chances, raise their arms on goals; the home end is
  // a standing terrace with waving flags; away fans react to their own team only.
  const crowdUniforms = { uTime: { value: 0 }, uHome: { value: 0 }, uAway: { value: 0 }, uTense: { value: 0 } };
  if (crowdPositions.length) {
    const seg = quality === 'niedrig' ? 5 : 7;
    const partG = [];
    const addPart = (g, part, arm = 0) => {
      const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv');
      const c = n.attributes.position.count;
      n.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(c).fill(part), 1));
      n.setAttribute('aArm', new THREE.Float32BufferAttribute(new Array(c).fill(arm), 1));
      partG.push(n);
    };
    // ~350 vertices per fan: legs, torso, head (hair = top of the head), arms with forearm skin
    const legs = new THREE.BoxGeometry(0.32, 0.46, 0.2); legs.translate(0, 0.23, 0.02); addPart(legs, 2);
    const torso = new THREE.CylinderGeometry(0.2, 0.16, 0.52, 6); torso.scale(1, 1, 0.68); torso.translate(0, 0.72, 0); addPart(torso, 0);
    const head = new THREE.SphereGeometry(0.11, 6, 4); head.scale(0.92, 1.12, 1); head.translate(0, 1.1, 0.01); addPart(head, 1);
    for (const sx of [-1, 1]) { const arm = new THREE.BoxGeometry(0.085, 0.48, 0.09, 1, 2, 1); arm.translate(sx * 0.235, 0.72, 0); addPart(arm, 3, sx); }
    const fanGeo = mergeGeometries(partG);
    const n = crowdPositions.length;
    const aPhase = new Float32Array(n), aSkin = new Float32Array(n * 3), aHair = new Float32Array(n * 3), aMode = new Float32Array(n * 2);
    const skins = ['#f1cfb4', '#e6b896', '#d9a47c', '#c48a60', '#a06a45', '#7a4b2e', '#5a3620'].map((c) => new THREE.Color(c));
    const hairs = ['#1b1410', '#2e2017', '#4d3422', '#7a5532', '#b78c52', '#d8c08a', '#6d6d6d', '#cfcfcf'].map((c) => new THREE.Color(c));
    const awayA = new THREE.Color(opts.away?.primary || '#ffffff'), awayB = new THREE.Color(opts.away?.secondary || '#222222');
    const neutral = ['#1c1f26', '#262c38', '#343c4a', '#4a4f58', '#5a4c3e', '#7d828a', '#22304a', '#4a2626', '#b9b9b9'].map((c) => new THREE.Color(c));
    const FAMILY = ['#f2c14e', '#7cc6fe', '#f78fb3', '#9be38a', '#ffffff', '#ffb26b'].map((c) => new THREE.Color(c)); // colourful family stand
    const crowd = new THREE.InstancedMesh(fanGeo, null, n);
    const mtx = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    crowdPositions.forEach((p, i) => {
      const [x, y, z, terrace, away, rot, family] = p;
      aPhase[i] = Math.random();
      const sk = skins[Math.min(skins.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * skins.length))]; aSkin.set([sk.r, sk.g, sk.b], i * 3);
      const hc = hairs[(Math.random() * hairs.length) | 0]; aHair.set([hc.r, hc.g, hc.b], i * 3);
      aMode.set([terrace, away], i * 2);
      const r = Math.random();
      if (away) col.copy(r < 0.6 ? awayA : r < 0.85 ? awayB : neutral[(Math.random() * neutral.length) | 0]);
      else if (family) col.copy(r < 0.3 ? seatA : r < 0.45 ? seatB : FAMILY[(Math.random() * FAMILY.length) | 0]);
      else if (terrace) col.copy(r < 0.55 ? seatA : r < 0.8 ? seatB : neutral[(Math.random() * 4) | 0]);
      else col.copy(r < 0.38 ? seatA : r < 0.52 ? seatB : neutral[(Math.random() * neutral.length) | 0]);
      col.multiplyScalar(0.62 + Math.random() * 0.25);
      crowd.setColorAt(i, col);
      const s = 0.9 + Math.random() * 0.2;
      q.setFromAxisAngle(up, rot + (Math.random() - 0.5) * 0.35);
      pos.set(x + (Math.random() - 0.5) * 0.08, y - (terrace ? 0 : 0.42), z);
      sc.set(s * (0.92 + Math.random() * 0.16), s, s);
      crowd.setMatrixAt(i, mtx.compose(pos, q, sc));
    });
    fanGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    fanGeo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(aSkin, 3));
    fanGeo.setAttribute('aHair', new THREE.InstancedBufferAttribute(aHair, 3));
    fanGeo.setAttribute('aMode', new THREE.InstancedBufferAttribute(aMode, 2));
    const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
    cm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, crowdUniforms);
      sh.vertexShader = `attribute float aPhase; attribute float aPart; attribute float aArm; attribute vec3 aSkin; attribute vec3 aHair; attribute vec2 aMode;
        uniform float uTime; uniform float uHome; uniform float uAway; uniform float uTense;\n` + sh.vertexShader
        .replace('#include <color_vertex>', `#include <color_vertex>
          if (aPart > 0.5 && aPart < 1.5) vColor = position.y > 1.14 ? aHair : aSkin;
          else if (aPart > 2.5 && aPart < 3.5 && position.y < 0.6) vColor = aSkin;
          else if (aPart > 1.5 && aPart < 2.5) vColor = mix(vec3(0.09, 0.1, 0.13), vec3(0.22, 0.26, 0.36), fract(aPhase * 13.7));
          else if (aPart > 3.5) vColor = aHair;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float joy = aMode.y > 0.5 ? uAway : uHome;            // own team scored
          float down = aMode.y > 0.5 ? uHome : uAway;           // other team scored
          float stand = aMode.x > 0.5 ? 1.0 : clamp(max(joy * 1.3, uTense * step(0.45, fract(aPhase * 5.1))), 0.0, 1.0);
          float t = uTime * (1.6 + fract(aPhase * 7.31) * 1.6) + aPhase * 6.2831;
          // terrace: constant bouncing and clapping; seats: subtle idle sway
          float bounce = aMode.x * (0.035 + 0.05 * step(0.5, fract(aPhase * 2.3))) * max(sin(t * 1.6), 0.0);
          float jump = joy * max(sin(t * 2.4), 0.0) * (0.18 + 0.2 * fract(aPhase * 4.1));
          float raise = clamp(joy * 1.4 + aMode.x * 0.35 * step(0.8, fract(aPhase * 9.7 + floor(uTime * 0.25) * 0.37)), 0.0, 1.0);
          if (abs(aArm) > 0.5) {
            // rotate arm (and hand) up around the shoulder pivot
            vec3 piv = vec3(aArm * 0.235, 0.96, 0.0);
            float ang = raise * (2.55 + 0.25 * sin(t * 3.0)) + (1.0 - raise) * (0.12 + 0.08 * aMode.x * sin(t * 2.0));
            vec3 r = transformed - piv;
            float c = cos(ang), s = sin(ang);
            vec3 rr = vec3(r.x * c - r.y * s * aArm, r.x * s * aArm + r.y * c, r.z);
            rr.z += raise * 0.05 + (1.0 - raise) * aMode.x * 0.12 * max(sin(t * 4.0), 0.0) * step(0.6, fract(aPhase * 3.3));
            transformed = piv + rr;
          }
          // seated fans sit lower and lean forward; standing ones rise up
          transformed.y += stand * 0.42 + bounce + jump;
          transformed.z += (1.0 - stand) * 0.06 * (transformed.y / 1.2);
          transformed.y -= down * (1.0 - aMode.x) * 0.04 * (transformed.y / 1.2);   // slump
          transformed.x += sin(uTime * 0.9 + aPhase * 20.0) * 0.02 * (transformed.y / 1.2);`);
    };
    crowd.material = cm;
    crowd.instanceMatrix.needsUpdate = true;
    crowd.frustumCulled = false;
    root.add(crowd);
    // waving flags on the terrace
    if (quality !== 'niedrig') {
      const terr = crowdPositions.filter((p) => p[3]);
      const nf = Math.min(48, Math.floor(terr.length / 70));
      if (nf > 0) {
        const fg = new THREE.PlaneGeometry(1.5, 1, 6, 1); fg.translate(0.75, 0, 0);
        const fUni = { uTime: crowdUniforms.uTime };
        const fm = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        fm.onBeforeCompile = (sh) => { sh.uniforms.uTime = fUni.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = float(gl_InstanceID) * 1.7; transformed.z += sin(uTime * 3.0 + position.x * 3.0 + ph) * 0.18 * position.x; transformed.y += sin(uTime * 2.0 + ph) * 0.2;`); };
        const flags = new THREE.InstancedMesh(fg, fm, nf);
        for (let i = 0; i < nf; i++) {
          const p = terr[Math.floor(((i + Math.random() * 0.6) / nf) * terr.length)];
          q.setFromAxisAngle(up, p[5] + Math.PI / 2 + (Math.random() - 0.5) * 0.8);
          flags.setMatrixAt(i, mtx.compose(pos.set(p[0], p[1] + 2.2, p[2]), q, sc.set(1, 1, 1)));
          flags.setColorAt(i, i % 3 === 2 ? seatB : seatA);
        }
        flags.frustumCulled = false; root.add(flags);
      }
    }
  }
  // ------------------------------------------------------------------ city skyline around the ground
  if (quality === 'hoch' || quality === 'ultra') {
    const winC = document.createElement('canvas'); winC.width = 64; winC.height = 128;
    const wg = winC.getContext('2d'); wg.fillStyle = '#0b0f17'; wg.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (Math.random() < 0.35) { wg.fillStyle = Math.random() < 0.7 ? '#ffd98a' : '#9fd0ff'; wg.fillRect(x, y, 4, 4); }
    const winT = new THREE.CanvasTexture(winC); winT.colorSpace = THREE.SRGBColorSpace; winT.wrapS = winT.wrapT = THREE.RepeatWrapping;
    const bm = new THREE.MeshLambertMaterial({ color: 0x1a2130, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: opts.night ? 0.9 : 0.15 });
    const bg = [];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + Math.random() * 0.05, r = 230 + Math.random() * 90;
      const hgt = 15 + Math.random() * 55, wd = 10 + Math.random() * 14;
      const b = new THREE.BoxGeometry(wd, hgt, wd);
      b.translate(Math.cos(a) * r, hgt / 2, Math.sin(a) * r * 0.85);
      bg.push(b);
    }
    const city = new THREE.Mesh(mergeGeometries(bg), bm); root.add(city);
  }
  // ------------------------------------------------------------------ v6.0 choreo (Blockfahne over the lower tier of the home end)
  let choreo = null;
  const showChoreo = (canvas) => {
    if (choreo) { root.remove(choreo.mesh); choreo = null; }
    if (!canvas) return;
    const st = stands[2], T = st.tiers?.[0]; if (!T) return;
    const d0 = T.d0 + 0.2, d1 = T.d0 + T.rows * stepD - 0.2, h0 = 0.7, h1 = T.rows * stepH + 1.1, len = st.len + (d1 - d0) * 0.9;
    const SX = 28, SY = 8;
    const geo = new THREE.PlaneGeometry(1, 1, SX, SY);
    const base = [];
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const u = uv.getX(i), v = uv.getY(i); base.push([u, v]); }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }));
    mesh.frustumCulled = false;
    root.add(mesh);
    choreo = { mesh, geo, base, d0, d1, h0, h1, len, roll: 0, rolling: false, t: 0 };
    layoutChoreo(0);
  };
  const layoutChoreo = (time) => {
    const C = choreo, pos = C.geo.attributes.position, st = stands[2];
    const top = 1 - C.roll; // rolling up from the top edge towards the front row
    for (let i = 0; i < C.base.length; i++) {
      const [u, v0] = C.base[i], v = v0 * top;
      const d = C.d0 + (C.d1 - C.d0) * v, h = C.h0 + (C.h1 - C.h0) * v;
      const along = (u - 0.5) * C.len;
      const wave = Math.sin(time * 1.6 + u * 9 + v * 4) * 0.18 * (0.4 + v);
      pos.setXYZ(i, st.sign * (d - wave * 0.5), h + wave, along);
    }
    pos.needsUpdate = true; C.geo.computeVertexNormals();
  };
  // ------------------------------------------------------------------ per-frame updates
  let t = 0;
  return {
    showChoreo,
    rollChoreo() { if (choreo) choreo.rolling = true; },
    fanSpots,
    root,
    tvAnchor: { z: mainBack - 1.5, y: mainTop + 4.5 },
    // side: 0 home goal, 1 away goal, null = big chance (everyone rises)
    excite(v, side = null) {
      if (side === 0) crowdUniforms.uHome.value = Math.max(crowdUniforms.uHome.value, v);
      else if (side === 1) crowdUniforms.uAway.value = Math.max(crowdUniforms.uAway.value, v);
      else crowdUniforms.uTense.value = Math.max(crowdUniforms.uTense.value, v);
    },
    setScreen: drawScreen,
    update(dt) {
      t += dt;
      crowdUniforms.uTime.value = t;
      for (const k of ['uHome', 'uAway']) crowdUniforms[k].value = Math.max(0, crowdUniforms[k].value - dt * 0.09);
      crowdUniforms.uTense.value = Math.max(0, crowdUniforms.uTense.value - dt * 0.45);
      adTex.offset.x = (adTex.offset.x + dt * 0.02) % 1;
      for (const r of ribbons) r.offset.x = (r.offset.x - dt * 0.03) % 1;
      if (choreo) {
        if (choreo.rolling) choreo.roll = Math.min(1, choreo.roll + dt * 0.35);
        if (choreo.roll >= 1) { root.remove(choreo.mesh); choreo.geo.dispose(); choreo = null; }
        else layoutChoreo(t);
      }
    },
  };
}

// ------------------------------------------------------------------ sky, lighting, weather
const TOD = {
  tag: { top: 0x3f7fd0, horizon: 0xbfd8f0, fog: 0xa8c4e0, hemi: 1.1, sun: 2.4, sunColor: 0xfff2dc, sunPos: [-40, 95, 50], flood: 0, bloom: 0.18, exposure: 1.0 },
  abend: { top: 0x1c2d5c, horizon: 0xf09a5a, fog: 0x5a4a5e, hemi: 0.7, sun: 1.6, sunColor: 0xffb070, sunPos: [-120, 30, 60], flood: 250, bloom: 0.45, exposure: 1.05 },
  nacht: { top: 0x02060f, horizon: 0x0d1a33, fog: 0x070d1a, hemi: 0.35, sun: 1.15, sunColor: 0xdfe9ff, sunPos: [10, 110, 30], flood: 700, bloom: 0.75, exposure: 1.1 },
};

export function setupLights(scene, quality, tod = 'nacht') {
  const P = TOD[tod] || TOD.nacht;
  scene.background = new THREE.Color(P.fog);
  scene.fog = new THREE.Fog(P.fog, 220, 520);
  // gradient sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(P.top) }, horizon: { value: new THREE.Color(P.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }',
  }));
  scene.add(sky);
  if (tod === 'nacht') {
    const pts = [];
    for (let i = 0; i < 1500; i++) { const u = Math.random() * Math.PI * 2, v = Math.random() * 0.45 + 0.08; pts.push(Math.cos(u) * Math.cos(v) * 460, Math.sin(v) * 460, Math.sin(u) * Math.cos(v) * 460); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false })));
  }
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x22301f, P.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(P.sunColor, P.sun);
  sun.position.set(...P.sunPos);
  const shadowSize = { niedrig: 0, mittel: 1024, hoch: 2048, ultra: 4096 }[quality] ?? 1024;
  if (shadowSize) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const c = sun.shadow.camera; c.left = -72; c.right = 72; c.top = 50; c.bottom = -50; c.near = 10; c.far = 300;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd2ff, tod === 'tag' ? 0.5 : 0.35); fill.position.set(50, 60, -40); scene.add(fill);
  if (P.flood && quality !== 'niedrig') {
    const n = quality === 'mittel' ? 2 : 4;
    const spots = n === 2 ? [[1, 1], [-1, -1]] : [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [sx, sz] of spots) {
      const s = new THREE.SpotLight(0xfff4e0, P.flood * (4 / n), 260, 0.75, 0.7, 1.5);
      s.position.set(sx * 80, 48, sz * 62); s.target.position.set(sx * 18, 0, sz * 6);
      scene.add(s); scene.add(s.target);
    }
  }
  return { sun, hemi, params: P };
}

// Rain: falling streaks around the camera
export function createRain(scene, count = 6000) {
  const pos = new Float32Array(count * 6);
  const g = new THREE.BufferGeometry();
  const seeds = [];
  for (let i = 0; i < count; i++) seeds.push([(Math.random() - 0.5) * 140, Math.random() * 45, (Math.random() - 0.5) * 100]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc9d6e6, transparent: true, opacity: 0.16, depthWrite: false }));
  lines.frustumCulled = false;
  scene.add(lines);
  return {
    update(dt, center) {
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        s[1] -= dt * 22; if (s[1] < 0) s[1] += 45;
        const x = center.x + s[0], z = center.z + s[2];
        pos.set([x, s[1], z, x + 0.04, s[1] + 0.5, z + 0.015], i * 6);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

// Snow (v1.0): slow, drifting flakes around the camera
export function createSnow(scene, count = 3000) {
  const pos = new Float32Array(count * 3), seeds = [];
  for (let i = 0; i < count; i++) seeds.push([(Math.random() - 0.5) * 140, Math.random() * 40, (Math.random() - 0.5) * 100, Math.random() * 6.28]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  let t = 0;
  return {
    update(dt, center) {
      t += dt;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        s[1] -= dt * 2.2; if (s[1] < 0) s[1] += 40;
        pos[i * 3] = center.x + s[0] + Math.sin(t * 0.8 + s[3]) * 0.8; pos[i * 3 + 1] = s[1]; pos[i * 3 + 2] = center.z + s[2] + Math.cos(t * 0.6 + s[3]) * 0.6;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

// Pyro (v1.0): burning flares with glow and drifting smoke in the fan blocks
export function createPyro(scene) {
  const flares = [];
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.25, 'rgba(255,80,30,0.9)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(220,220,220,0.55)'); gr.addColorStop(1, 'rgba(200,200,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const light = new THREE.PointLight(0xff4a1a, 0, 60, 1.6); scene.add(light);
  return {
    fire(spots, n = 8, color = 0xff5522) {
      if (!spots?.length) return;
      const center = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const s = spots[Math.floor(Math.random() * spots.length)];
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        glow.position.set(s[0], s[1] + 2.1, s[2]); glow.scale.setScalar(3.2);
        scene.add(glow);
        const smoke = [];
        for (let k = 0; k < 6; k++) { const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0 })); sm.position.copy(glow.position); scene.add(sm); smoke.push({ sm, off: k * 0.9 }); }
        flares.push({ glow, smoke, life: 9 + Math.random() * 4, t: 0 });
        center[0] += s[0] / n; center[1] += s[1] / n; center[2] += s[2] / n;
      }
      light.position.set(center[0], center[1] + 4, center[2]); light.intensity = 140;
    },
    update(dt) {
      let alive = 0;
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i]; f.t += dt;
        const k = f.t < f.life ? 1 : Math.max(0, 1 - (f.t - f.life) / 3);
        f.glow.material.opacity = k * (0.75 + Math.random() * 0.25);
        f.glow.scale.setScalar(3 + Math.random() * 0.9);
        for (const s of f.smoke) {
          const tt = (f.t + s.off) % 5.4;
          s.sm.position.set(f.glow.position.x + tt * 0.6, f.glow.position.y + tt * 1.6, f.glow.position.z + Math.sin(tt) * 0.5);
          s.sm.scale.setScalar(2.5 + tt * 2.2);
          s.sm.material.opacity = Math.min(1, k * 1.5) * 0.45 * (1 - tt / 5.4);
        }
        if (k > 0) alive++;
        if (f.t > f.life + 3) { scene.remove(f.glow); f.smoke.forEach((s) => scene.remove(s.sm)); flares.splice(i, 1); }
      }
      light.intensity = alive ? 90 + Math.random() * 70 : Math.max(0, light.intensity - dt * 200);
    },
  };
}
