// Simulated match player: physical state derived from database attributes.
import { clamp } from '../core/rng.js';

export class SimPlayer {
  constructor(data, team, slotIndex, role) {
    this.id = data.id;
    this.data = data;            // reference to the manager database player
    this.team = team;
    this.slotIndex = slotIndex;
    this.role = role;            // tactical position of the slot (TW, IV, ...)
    this.isGK = role === 'TW';
    const a = data.attrs;
    this.a = a;
    this.maxSpeed = 6.2 + a.tempo * 0.031;            // 99 tempo ≈ 9.3 m/s
    this.accel = 3.2 + a.beschleunigung * 0.05;       // m/s²
    this.energy = clamp((data.fitness ?? 100) / 100, 0.3, 1);
    this.height = (data.looks?.height || 180) / 100;
    this.pos = { x: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.facing = 0;             // radians, 0 => +x
    this.target = { x: 0, z: 0 };
    this.targetSpeed = 0;
    this.faceTarget = null;      // optional point to face
    this.mode = 'shape';
    this.action = null;          // { type, t, dur, ... }
    this.stun = 0;
    this.touchCooldown = 0;
    this.tackleCooldown = 0;
    this.decisionTimer = 0;
    this.runTimer = 0; this.runCooldown = Math.random() * 3;
    this.spaceTimer = Math.random();
    this.spaceOffset = { x: 0, z: 0 };
    this.yellow = 0; this.sentOff = false; this.injured = false; this.leaving = false; this.offPitch = false;
    this.minutesOn = 0; this.minuteIn = 0;
    this.rating = 6.5;
    this.stats = { passes: 0, passesOk: 0, shots: 0, goals: 0, tackles: 0, saves: 0 };
    this.celebrate = 0; this.frustrate = 0;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  topSpeed() { return this.maxSpeed * (0.8 + 0.2 * this.energy) * (this.workMul || 1); }

  startAction(type, dur, extra = {}) { this.action = { type, t: 0, dur, ...extra }; }
  busy() { return this.action && ['pass', 'shot', 'cross', 'tackle', 'slide', 'header', 'throw', 'dive', 'clear', 'longpass'].includes(this.action.type); }

  update(dt) {
    if (this.action) { this.action.t += dt; if (this.action.t >= this.action.dur) this.action = null; }
    if (this.stun > 0) this.stun -= dt;
    if (this.touchCooldown > 0) this.touchCooldown -= dt;
    if (this.tackleCooldown > 0) this.tackleCooldown -= dt;
    if (this.offPitch) return;

    const sliding = this.action && (this.action.type === 'slide' || this.action.type === 'dive');
    const grounded = this.injured || (this.action && this.action.type === 'injured');
    let dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    let want = this.targetSpeed;
    if (dist < 2.5) want = Math.min(want, dist * 1.6);   // arrive behaviour
    if (dist < 0.15) want = 0;
    if (this.stun > 0) want *= 0.25;
    if (grounded) want = 0;
    let dvx = 0, dvz = 0;
    if (dist > 1e-4) { dvx = (dx / dist) * want; dvz = (dz / dist) * want; }
    if (sliding) {
      // momentum carries during slide/dive, decelerate
      const k = Math.max(0, 1 - 2.2 * dt); this.vel.x *= k; this.vel.z *= k;
    } else {
      const ax = dvx - this.vel.x, az = dvz - this.vel.z;
      const al = Math.hypot(ax, az);
      // harder to change direction at high speed
      const turnPenalty = 1 - 0.35 * clamp(this.speed / this.maxSpeed, 0, 1);
      const maxA = this.accel * (want < this.speed ? 1.8 : 1) * turnPenalty * dt * (0.85 + 0.15 * this.energy);
      if (al > maxA) { this.vel.x += (ax / al) * maxA; this.vel.z += (az / al) * maxA; }
      else { this.vel.x = dvx; this.vel.z = dvz; }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // facing
    const sp = this.speed;
    let desired = this.facing;
    if (this.faceTarget) desired = Math.atan2(this.faceTarget.z - this.pos.z, this.faceTarget.x - this.pos.x);
    else if (sp > 0.6) desired = Math.atan2(this.vel.z, this.vel.x);
    let diff = desired - this.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const turnRate = (sliding ? 1 : 7) * dt;
    this.facing += clamp(diff, -turnRate, turnRate);

    // stamina drain
    const r = sp / this.maxSpeed;
    const drain = (0.0003 + Math.pow(r, 3) * 0.0022) * (1.45 - this.a.ausdauer / 110);
    this.energy = clamp(this.energy - drain * dt, 0.2, 1);
  }
}
