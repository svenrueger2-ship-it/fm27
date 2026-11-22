// Animated 3D stadium backdrop for the main menu (evening atmosphere, orbiting camera, jogging players).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildStadium, setupLights, createBall } from './stadium.js';
import { createPlayerModel, animatePlayer } from './playerModel.js';

export function startMenuScene(container, quality = 'mittel') {
  const q = quality === 'ultra' ? 'hoch' : quality;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: q !== 'niedrig', powerPreference: 'high-performance' }); }
  catch { return () => {}; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'niedrig' ? 0.7 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1100);
  setupLights(scene, q === 'niedrig' ? 'niedrig' : 'mittel', 'abend');
  const home = { primary: '#d01b3a', secondary: '#ffffff', shorts: '#ffffff', socks: '#d01b3a' };
  const away = { primary: '#1c3f94', secondary: '#ffffff', shorts: '#1c3f94', socks: '#ffffff' };
  const stadium = buildStadium(scene, { capacity: 62000, home, quality: q === 'niedrig' ? 'niedrig' : 'mittel', name: 'ULTIMATE FM 3D' });
  stadium.setScreen(['ULTIMATE FOOTBALL', 'MANAGER 3D', 'WILLKOMMEN']);
  const ball = createBall('mittel'); scene.add(ball.mesh);
  const runners = [];
  const looks = (i) => ({ skin: ['#f1cfb2', '#c68e64', '#6e4128', '#e0b090'][i % 4], hair: ['#2b1d14', '#d9b86a', '#111', '#6b4a2b'][i % 4], hairStyle: i % 5, height: 176 + (i * 7) % 16, beard: i % 3 === 0 });
  for (let i = 0; i < 8; i++) {
    const m = createPlayerModel({ kit: i % 2 ? away : home, looks: looks(i), number: [7, 10, 9, 4, 11, 8, 23, 5][i], isGK: false, quality: 'mittel', name: 'Spieler', short: i % 2 ? 'AWY' : 'HOM' });
    scene.add(m.root);
    runners.push({ m, r: 8 + i * 2.2, a: i * 0.8, w: (0.18 + (i % 3) * 0.05) * (i % 2 ? 1 : -1), p: { pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, facing: 0, action: null, isGK: false, injured: false, get speed() { return Math.hypot(this.vel.x, this.vel.z); } } });
  }
  let composer = null;
  if (q !== 'niedrig') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.8));
    composer.addPass(new OutputPass());
  }
  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); composer?.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf, last = performance.now(), t = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    for (const R of runners) {
      R.a += R.w * dt;
      const x = Math.cos(R.a) * R.r, z = Math.sin(R.a) * R.r * 0.7;
      R.p.vel.x = (x - R.p.pos.x) / Math.max(dt, 1e-3); R.p.vel.z = (z - R.p.pos.z) / Math.max(dt, 1e-3);
      R.p.pos.x = x; R.p.pos.z = z; R.p.facing = Math.atan2(R.p.vel.z, R.p.vel.x);
      animatePlayer(R.m, R.p, dt);
    }
    ball.mesh.position.set(Math.sin(t * 2) * 0.3, 0.6 + Math.abs(Math.sin(t * 4)) * 1.2, 0); ball.mesh.rotation.x += dt * 4;
    const a = t * 0.07;
    camera.position.set(Math.cos(a) * 55, 14 + Math.sin(t * 0.2) * 4, Math.sin(a) * 42);
    camera.lookAt(0, 2, 0);
    stadium.update(dt);
    if (composer) composer.render(); else renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
}
