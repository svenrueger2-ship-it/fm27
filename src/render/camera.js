// Camera rig with six modes: TV, tactical, dynamic, player, stadium, free (orbit controls).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HALF_L, HALF_W } from '../match/constants.js';

export const CAMERA_MODES = [
  ['tv', 'TV'], ['taktik', 'Taktik'], ['dynamisch', 'Dynamisch'], ['spieler', 'Spieler'], ['stadion', 'Stadion'], ['frei', 'Frei'],
];

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.mode = 'tv';
    this.zoom = 1;          // 0.5 .. 2
    this.height = 1;        // 0.5 .. 2
    this.speed = 1;         // smoothing multiplier
    this.focus = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 30, 70);
    this.orbit = 0;
    this.selected = null;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 5; this.controls.maxDistance = 220;
    this.shake = 0;
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'frei';
    if (mode === 'frei') { this.controls.target.copy(this.focus); this.controls.update(); }
  }

  update(dt, engine) {
    const b = engine.ball.pos;
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 3.2 * this.speed);
    const kf = 1 - Math.exp(-dt * 4.5 * this.speed);
    let tp, tf, fov = 34;
    const attackDir = (() => {
      const t = engine.ball.owner ? engine.ball.owner.team : engine.lastTouch.team;
      return t == null ? 1 : engine.dirOf(t);
    })();
    if (this.override) {
      const o = this.override(dt);
      if (o) {
        this.focus.lerp(o.focus, o.snap ? 1 : kf);
        this.pos.lerp(o.pos, o.snap ? 1 : k);
        cam.position.copy(this.pos); cam.lookAt(this.focus);
        if (Math.abs(cam.fov - o.fov) > 0.01) { cam.fov += (o.fov - cam.fov) * (o.snap ? 1 : k); cam.updateProjectionMatrix(); }
        return;
      }
    }
    this.swayT = (this.swayT || 0) + dt;
    switch (this.mode) {
      case 'tv': {
        if (engine.phase === 'goal' && engine.goalInfo?.scorerP) {
          const s = engine.goalInfo.scorerP;
          tf = new THREE.Vector3(s.pos.x, 1.2, s.pos.z);
          tp = new THREE.Vector3(s.pos.x * 0.9, 9 * this.height, s.pos.z + 22);
          fov = 24 / this.zoom;
          break;
        }
        const fx = THREE.MathUtils.clamp(b.x * 0.92, -HALF_L + 6, HALF_L - 6);
        tf = new THREE.Vector3(fx, 0, THREE.MathUtils.clamp(b.z * 0.55, -14, 18));
        const port = (cam.aspect || 1.6) < 1;
        const A = this.tvAnchor || { z: HALF_W + 42, y: 23 };
        const az = port ? HALF_W + 20 : A.z, ay = A.y;
        tp = new THREE.Vector3(fx * 0.72, ay * this.height, az);
        fov = (26 * 84) / Math.hypot(az, ay) / this.zoom;
        tp.y += Math.sin(this.swayT * 0.7) * 0.25; tp.x += Math.sin(this.swayT * 0.43) * 0.4;
        break;
      }
      case 'taktik': {
        tf = new THREE.Vector3(b.x * 0.65, 0, b.z * 0.2);
        tp = new THREE.Vector3(b.x * 0.65, 52 * this.height, 34);
        fov = 42 / this.zoom;
        break;
      }
      case 'dynamisch': {
        tf = new THREE.Vector3(b.x + attackDir * 9, 0.5, b.z * 0.85);
        tp = new THREE.Vector3(b.x - attackDir * 20, 9 * this.height, b.z * 0.6 + 6);
        fov = 50 / this.zoom;
        break;
      }
      case 'spieler': {
        const p = this.selected && !this.selected.offPitch ? this.selected : engine.ball.owner || engine.teams[0].players[10];
        if (p) {
          const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
          tf = new THREE.Vector3(p.pos.x + fx * 6, 1, p.pos.z + fz * 6);
          tp = new THREE.Vector3(p.pos.x - fx * 8, 4.5 * this.height, p.pos.z - fz * 8);
        } else { tf = new THREE.Vector3(b.x, 0, b.z); tp = new THREE.Vector3(b.x, 10, b.z + 20); }
        fov = 55 / this.zoom;
        break;
      }
      case 'stadion': {
        this.orbit += dt * 0.06;
        tf = new THREE.Vector3(0, 0, 0);
        tp = new THREE.Vector3(Math.cos(this.orbit) * 125, 55 * this.height, Math.sin(this.orbit) * 95);
        fov = 45 / this.zoom;
        break;
      }
      case 'frei':
      default: {
        this.controls.update();
        cam.fov += (40 / this.zoom - cam.fov) * k; cam.updateProjectionMatrix();
        this.focus.copy(this.controls.target);
        return;
      }
    }
    // keep a usable horizontal field of view on portrait screens
    const aspect = cam.aspect || 1.6;
    if (aspect < 1.4) {
      const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.6) * 0.78;
      fov = Math.max(fov, Math.min(60, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect))));
    }
    this.focus.lerp(tf, kf);
    this.pos.lerp(tp, k);
    cam.position.copy(this.pos);
    if (this.shake > 0) { this.shake -= dt; cam.position.y += Math.sin(performance.now() / 30) * 0.15 * this.shake; }
    cam.lookAt(this.focus);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); }
  }

  dispose() { this.controls.dispose(); }
}
