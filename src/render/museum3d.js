// v7.0 3D club museum: a hall in the club colours with the crest on the back wall, glass showcases with
// every trophy won in the game, a legends wall, the shirt gallery and retired numbers under the roof.
import * as THREE from 'three';
import { IS_MOBILE } from '../core/device.js';
import { CRESTS } from '../data/crests.js';

function labelTex(lines, { w = 512, h = 160, bg = 'rgba(10,8,20,.85)', fg = '#fff', sizes = [44, 30] } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => { g.font = `${i ? 600 : 800} ${sizes[i] || 26}px Inter, Arial`; g.fillText(String(t).slice(0, 34), w / 2, h * ((i + 1) / (lines.length + 1))); });
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function shirtTex(col, season) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 256, 300);
  g.fillStyle = col.primary;
  g.beginPath(); g.moveTo(70, 20); g.lineTo(186, 20); g.lineTo(250, 70); g.lineTo(220, 115); g.lineTo(196, 98); g.lineTo(196, 270); g.lineTo(60, 270); g.lineTo(60, 98); g.lineTo(36, 115); g.lineTo(6, 70); g.closePath(); g.fill();
  g.fillStyle = col.secondary; g.fillRect(60, 120, 136, 18);
  g.beginPath(); g.arc(128, 22, 22, 0, Math.PI); g.fill();
  g.fillStyle = '#fff'; g.font = '800 30px Inter, Arial'; g.textAlign = 'center'; g.fillText(`${season}/${String((season + 1) % 100).padStart(2, '0')}`, 128, 295);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function trophyMesh(kind) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b14a, metalness: 0.95, roughness: 0.22 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.95, roughness: 0.18 });
  const g = new THREE.Group();
  if (kind === 'liga') { // the "Meisterschale"
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 40), silver); plate.rotation.x = Math.PI / 2 - 0.25; plate.position.y = 1.7; g.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 40), gold); ring.rotation.copy(plate.rotation); ring.position.copy(plate.position); ring.position.z += 0.06; g.add(ring);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 0.6, 16), gold); stand.position.y = 0.3; g.add(stand);
    return g;
  }
  const pts = []; const H = kind === 'europa' ? 2.6 : kind === 'jugend' ? 1.4 : 2.1;
  for (let i = 0; i <= 20; i++) { const t = i / 20; const r = t < 0.12 ? 0.55 - t : t < 0.45 ? 0.16 + (t - 0.12) * 0.25 : 0.25 + Math.sin(((t - 0.45) / 0.55) * Math.PI * 0.6) * 0.75; pts.push(new THREE.Vector2(r * (kind === 'jugend' ? 0.7 : 1), t * H)); }
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), kind === 'aufstieg' ? silver : gold); g.add(cup);
  if (kind === 'europa' || kind === 'pokal') for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.TorusGeometry(kind === 'europa' ? 0.55 : 0.35, 0.06, 8, 24, Math.PI * 1.2), gold); ear.position.set(s * (kind === 'europa' ? 0.95 : 0.8), H * 0.7, 0); ear.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6; g.add(ear); }
  return g;
}

export function createMuseum(container, { club, trophies, legends, kits, retired }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE }); }
  catch { container.innerHTML = '<p class="muted" style="padding:1rem">3D-Museum nicht verfügbar (WebGL).</p>'; return { dispose() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0b16);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
  const prim = new THREE.Color(club.colors.primary), sec = new THREE.Color(club.colors.secondary);
  // hall
  const L = 40, W = 18, Hh = 9;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat({ color: 0x3a2a1e, roughness: 0.55, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wallMat = mat({ color: prim.clone().multiplyScalar(0.35), roughness: 0.9 });
  for (const s of [-1, 1]) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, Hh), wallMat); wall.position.set(s * W / 2, Hh / 2, 0); wall.rotation.y = -s * Math.PI / 2; scene.add(wall); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), wallMat); back.position.set(0, Hh / 2, -L / 2); scene.add(back);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat({ color: 0x111018 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = Hh; scene.add(ceil);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.1), mat({ color: sec, emissive: sec, emissiveIntensity: 0.25 })); stripe.position.set(0, 3.2, -L / 2 + 0.06); scene.add(stripe);
  // crest on the back wall
  const crestSrc = club.crest || CRESTS[club.short];
  if (crestSrc) { const img = new Image(); img.onload = () => { const tx = new THREE.Texture(img); tx.needsUpdate = true; tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: tx, transparent: true })); m.position.set(0, 5.8, -L / 2 + 0.08); scene.add(m); }; img.src = crestSrc; }
  const title = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), new THREE.MeshBasicMaterial({ map: labelTex([`${club.name} · Museum`], { w: 1024, h: 140, bg: 'rgba(0,0,0,0)', sizes: [64] }), transparent: true })); title.position.set(0, 2.2, -L / 2 + 0.08); scene.add(title);
  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x221a12, 0.5); scene.add(hemi);
  // showcases down the middle of the hall
  const list = trophies.length ? trophies : [{ kind: 'leer', title: 'Hier ist Platz für deinen ersten Titel', season: '' }];
  const glass = mat({ color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0 });
  const base = mat({ color: 0x1b1626, roughness: 0.4, metalness: 0.3 });
  const spin = [];
  list.slice(0, 24).forEach((t, i) => {
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    const x = side * 3.2, z = L / 2 - 6 - row * 4.2;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.8), base); ped.position.set(x, 0.55, z); scene.add(ped);
    const case_ = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 1.8), glass); case_.position.set(x, 2.7, z); scene.add(case_);
    if (t.kind !== 'leer') { const tr = trophyMesh(t.kind); tr.position.set(x, 1.15, z); tr.scale.setScalar(t.kind === 'liga' ? 0.55 : 0.6); scene.add(tr); spin.push(tr); }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.56), new THREE.MeshBasicMaterial({ map: labelTex([t.title, t.season ? `${t.season}/${String((t.season + 1) % 100).padStart(2, '0')}` : ''], { sizes: [34, 30] }) }));
    lab.position.set(x, 0.62, z + 0.91); scene.add(lab);
    const spot = new THREE.PointLight(0xfff0d0, 6, 6, 2); spot.position.set(x, 4.6, z); scene.add(spot);
  });
  // legends wall (left) and shirt gallery (right)
  legends.slice(0, 8).forEach((l, i) => {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: labelTex([l.name, `${l.seasons} Saisons · ${l.apps} Spiele · ${l.goals} Tore${l.titles ? ` · ${l.titles} Titel` : ''}`], { w: 640, h: 320, bg: 'rgba(28,22,40,.95)', fg: '#f4e7c5', sizes: [52, 30] }) }));
    pl.position.set(-W / 2 + 0.06, 3.4 + (i % 2) * 1.9, L / 2 - 6 - Math.floor(i / 2) * 4.5); pl.rotation.y = Math.PI / 2; scene.add(pl);
  });
  kits.slice(-8).forEach((k, i) => {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ map: shirtTex(k.colors, k.season), transparent: true }));
    sh.position.set(W / 2 - 0.06, 3.6, L / 2 - 4 - i * 4); sh.rotation.y = -Math.PI / 2; scene.add(sh);
  });
  // retired numbers hanging from the roof
  retired.forEach((r, i) => {
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ map: labelTex([String(r.num), r.name], { w: 300, h: 420, bg: club.colors.primary, fg: club.colors.secondary, sizes: [180, 30] }), side: THREE.DoubleSide }));
    ban.position.set(-3 + (i % 4) * 2, Hh - 1.8, -L / 2 + 4 + Math.floor(i / 4) * 3); scene.add(ban);
  });
  // camera: walk slowly through the hall, drag to look around
  let yaw = 0, pitch = -0.08, t = 0, dragging = false, lx = 0, ly = 0, auto = true;
  const el = renderer.domElement; el.style.cursor = 'grab'; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; yaw -= (e.clientX - lx) * 0.005; pitch = Math.max(-0.6, Math.min(0.5, pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  el.addEventListener('pointerup', () => { dragging = false; });
  let z = L / 2 - 2;
  el.addEventListener('wheel', (e) => { e.preventDefault(); auto = false; z = Math.max(-L / 2 + 4, Math.min(L / 2 - 1.5, z + e.deltaY * 0.01)); }, { passive: false });
  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf, last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (auto) { z = L / 2 - 2 - ((t * 0.9) % (L - 6)); yaw = Math.sin(t * 0.35) * 0.55; }
    for (const s of spin) s.rotation.y += dt * 0.6;
    camera.position.set(0, 2.4, z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return { dispose() { cancelAnimationFrame(raf); ro.disconnect(); scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); }); renderer.dispose(); el.remove(); } };
}
