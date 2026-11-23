import { IS_MOBILE } from '../core/device.js';
// Interactive 3D preview of the user's stadium for the stadium builder (drag to rotate, wheel to zoom).
import * as THREE from 'three';
import { buildStadium, setupLights } from './stadium.js';

export function createStadiumPreview(container, { club, quality = 'mittel' }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: IS_MOBILE ? 'default' : 'high-performance' }); }
  catch { container.innerHTML = '<p class="muted" style="padding:1rem">3D-Vorschau nicht verfügbar (WebGL).</p>'; return { rebuild() {}, dispose() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1400);
  let scene, stadium;
  const q = quality === 'niedrig' ? 'niedrig' : 'mittel';
  const build = () => {
    if (scene) scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    scene = new THREE.Scene();
    setupLights(scene, 'niedrig', 'tag');
    const kit = { primary: club.colors.primary, secondary: club.colors.secondary };
    stadium = buildStadium(scene, { capacity: club.stadium.capacity, layout: club.stadium.layout, home: kit, away: { primary: '#888', secondary: '#fff' }, quality: q, fill: 0.55, xray: true, name: club.stadium.name.toUpperCase(), homeShort: club.short });
  };
  build();
  // orbit controls (minimal, no dependency)
  let yaw = 0.7, pitch = 0.62, dist = 175, dragging = false, lx = 0, ly = 0, auto = true;
  const el = renderer.domElement;
  el.style.cursor = 'grab'; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; yaw -= (e.clientX - lx) * 0.006; pitch = Math.min(1.35, Math.max(0.12, pitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  el.addEventListener('pointerup', () => { dragging = false; el.style.cursor = 'grab'; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(320, Math.max(70, dist + e.deltaY * 0.15)); }, { passive: false });
  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf, last = performance.now();
  // v4.0: only render while visible; ~30 fps on phones (the preview turns slowly anyway)
  let visible = true, skip = 0;
  const io = new IntersectionObserver((en) => { visible = en[0]?.isIntersecting ?? true; }); io.observe(container);
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden || (IS_MOBILE && (skip++ & 1))) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (auto) yaw += dt * 0.08;
    camera.position.set(Math.cos(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.sin(yaw) * Math.cos(pitch) * dist * 0.85);
    camera.lookAt(0, 4, 0);
    stadium.update(dt);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return {
    rebuild() { build(); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); el.remove(); },
  };
}
