// v6.0 3D view of the club's training centre: pitches, academy, rehab, gym, analysis, boarding school,
// canteen and indoor hall grow with their levels; a crane marks the current construction site.
import * as THREE from 'three';
import { IS_MOBILE } from '../core/device.js';
import { setupLights } from './stadium.js';
import { campusLevel } from '../manager/campus.js';

function pitchTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 170;
  const g = c.getContext('2d');
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f8f3c' : '#47a044'; g.fillRect((i * 256) / 12, 0, 256 / 12 + 1, 170); }
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
  g.strokeRect(6, 6, 244, 158); g.beginPath(); g.moveTo(128, 6); g.lineTo(128, 164); g.stroke();
  g.beginPath(); g.arc(128, 85, 20, 0, Math.PI * 2); g.stroke();
  g.strokeRect(6, 45, 32, 80); g.strokeRect(218, 45, 32, 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createCampusPreview(container, { club }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE }); }
  catch { container.innerHTML = '<p class="muted" style="padding:1rem">3D-Vorschau nicht verfügbar (WebGL).</p>'; return { rebuild() {}, dispose() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1200);
  let scene, crane = null;
  const ptex = pitchTexture();
  const build = () => {
    if (scene) scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose?.()); });
    scene = new THREE.Scene();
    setupLights(scene, 'niedrig', 'tag');
    const prim = new THREE.Color(club.colors.primary), sec = new THREE.Color(club.colors.secondary);
    const M = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); scene.add(m); return m; };
    // ground, paths, fence
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 220), M(0x2f5a2a, 1)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), M(0x9a9a92)); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.03, 8); scene.add(path);
    const path2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 190), M(0x9a9a92)); path2.rotation.x = -Math.PI / 2; path2.position.set(20, 0.03, 0); scene.add(path2);
    const fenceMat = M(0x5b6470, 0.5);
    for (const [w, d, x, z] of [[300, 0.3, 0, -100], [300, 0.3, 0, 100], [0.3, 200, -150, 0], [0.3, 200, 150, 0]]) box(w || 0.3, 1.8, d || 0.3, fenceMat, x, 0, z);
    // pitches: one per training level
    const nP = Math.max(1, Math.min(5, campusLevel(club, 'training')));
    const pm = new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.95 });
    for (let i = 0; i < nP; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(52, 34), pm); p.rotation.x = -Math.PI / 2;
      p.position.set(-110 + col * 62, 0.05, -70 + row * 44); scene.add(p);
      if (i < 2) for (const sx of [-1, 1]) { const pole = box(0.4, 12, 0.4, fenceMat, p.position.x + sx * 27, 0, p.position.z - 18); pole.castShadow = false; box(1.6, 0.6, 1.6, M(0xfff3d0, 0.2), p.position.x + sx * 27, 12, p.position.z - 18); }
    }
    // buildings (x, z, footprint grows with level)
    const roofMat = M(prim, 0.6), wallMat = M(0xe9e6df), glassMat = new THREE.MeshStandardMaterial({ color: 0x5d7fa3, roughness: 0.15, metalness: 0.5 });
    const building = (key, x, z, base, perLvl, h, opts = {}) => {
      const lv = campusLevel(club, key); if (lv <= 0) return null;
      const w = base[0] + perLvl[0] * (lv - 1), d = base[1] + perLvl[1] * (lv - 1), hh = h + (opts.tall ? lv * 2.2 : 0);
      box(w, hh, d, wallMat, x, 0, z);
      box(w + 0.6, 0.8, d + 0.6, roofMat, x, hh, z);
      box(w * 0.86, hh * 0.32, 0.2, glassMat, x, hh * 0.35, z + d / 2 + 0.05);
      if (opts.stripe) box(w + 0.1, 0.6, d + 0.1, M(sec), x, hh * 0.78, z);
      return { w, d, h: hh };
    };
    building('youth', 70, -55, [26, 14], [6, 3], 8, { tall: true, stripe: true });
    building('medical', 110, -55, [16, 12], [4, 2], 7, { stripe: true });
    building('gym', 70, -20, [22, 14], [5, 2], 9);
    building('analysis', 108, -22, [12, 10], [3, 2], 6, { stripe: true });
    building('internat', 70, 40, [24, 12], [6, 2], 9, { tall: true });
    building('canteen', 110, 40, [16, 12], [4, 2], 5);
    if (campusLevel(club, 'hall') > 0) { const hall = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 70, 24, 1, false, 0, Math.PI), M(0xd7dde4, 0.4)); hall.rotation.z = Math.PI / 2; hall.rotation.y = Math.PI / 2; hall.position.set(-60, 0, 62); hall.scale.set(1, 1, 0.42); scene.add(hall); }
    // main office with club flag
    box(30, 10, 14, wallMat, 70, 0, 72); box(30.6, 0.8, 14.6, roofMat, 70, 10, 72);
    const mast = box(0.4, 18, 0.4, fenceMat, 92, 0, 80);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6), new THREE.MeshStandardMaterial({ color: prim, side: THREE.DoubleSide })); flag.position.set(95, 16, 80); scene.add(flag);
    // parking + trees
    for (let i = 0; i < 14; i++) box(2.2, 1.4, 4.4, M(new THREE.Color().setHSL(Math.random(), 0.4, 0.45), 0.4), 0 - 60 + i * 4.5, 0, 92);
    const trunk = M(0x5b3b22), leaf = M(0x2c6a2c, 0.9);
    for (let i = 0; i < 26; i++) {
      const x = -145 + (i * 23) % 290, z = i % 2 ? -94 : 96 - (i % 3) * 3;
      box(0.8, 3, 0.8, trunk, x, 0, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(3.4, 8, 7), leaf); c.position.set(x, 7, z); scene.add(c);
    }
    // construction crane at the active site
    crane = null;
    const B = club.campus?.build;
    if (B) {
      const spot = { training: [-110, -70], youth: [70, -55], medical: [110, -55], gym: [70, -20], analysis: [108, -22], internat: [70, 40], canteen: [110, 40], hall: [-60, 62] }[B.key] || [0, 0];
      const yel = M(0xf2b705, 0.5);
      box(1.4, 34, 1.4, yel, spot[0] + 12, 0, spot[1]);
      const jib = new THREE.Group(); jib.position.set(spot[0] + 12, 34, spot[1]); scene.add(jib);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 1), yel); arm.position.x = -8; jib.add(arm);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.2, 14, 0.2), fenceMat); cable.position.set(-18, -7, 0); jib.add(cable);
      crane = jib;
      box(10, 4, 10, M(0xbfa27a), spot[0], 0, spot[1]); // site
    }
  };
  build();
  let yaw = 0.9, pitch = 0.75, dist = 230, dragging = false, lx = 0, ly = 0, auto = true;
  const el = renderer.domElement;
  el.style.cursor = 'grab'; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; yaw -= (e.clientX - lx) * 0.006; pitch = Math.min(1.35, Math.max(0.2, pitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(380, Math.max(90, dist + e.deltaY * 0.2)); }, { passive: false });
  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf, last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (auto) yaw += dt * 0.07;
    if (crane) crane.rotation.y += dt * 0.25;
    camera.position.set(Math.cos(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.sin(yaw) * Math.cos(pitch) * dist * 0.8);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return { rebuild() { build(); }, dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); ptex.dispose(); el.remove(); } };
}
