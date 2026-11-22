// Ball physics: flight with drag + Magnus curl, bounces, rolling friction, posts, crossbar, net.
import { HALF_L, GOAL_HW, GOAL_H, GOAL_D, POST_R, BALL_R, G, ROLL_A, ROLL_B, AIR_K, MAGNUS_K } from './constants.js';

export class Ball {
  constructor() {
    this.pos = { x: 0, y: BALL_R, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = { x: 0, y: 0, z: 0 };   // angular velocity used for curl (rad/s)
    this.rot = { x: 0, y: 0, z: 0, w: 1 }; // visual orientation quaternion (renderer)
    this.owner = null;
    this.inNet = false;
    this.hitWoodwork = 0;
  }

  place(x, z, y = BALL_R) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.spin.x = this.spin.y = this.spin.z = 0;
    this.inNet = false;
  }

  speed() { const v = this.vel; return Math.hypot(v.x, v.y, v.z); }
  hspeed() { return Math.hypot(this.vel.x, this.vel.z); }
  onGround() { return this.pos.y <= BALL_R + 0.02 && Math.abs(this.vel.y) < 0.5; }

  update(dt) {
    if (this.owner) return;
    const p = this.pos, v = this.vel, s = this.spin;
    const airborne = p.y > BALL_R + 0.005 || v.y > 0.01;
    if (airborne) {
      const sp = Math.hypot(v.x, v.y, v.z);
      const k = AIR_K * sp * dt;
      v.x -= v.x * k; v.y -= v.y * k; v.z -= v.z * k;
      // Magnus: a = k * (spin x v)
      v.x += MAGNUS_K * (s.y * v.z - s.z * v.y) * dt;
      v.y += MAGNUS_K * (s.z * v.x - s.x * v.z) * dt - G * dt;
      v.z += MAGNUS_K * (s.x * v.y - s.y * v.x) * dt;
    } else {
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0) {
        const dec = (ROLL_A + ROLL_B * hs) * dt;
        const ns = Math.max(0, hs - dec);
        v.x *= ns / hs; v.z *= ns / hs;
      }
      v.y = 0;
    }
    const decay = Math.max(0, 1 - 0.35 * dt);
    s.x *= decay; s.y *= decay; s.z *= decay;

    const ox = p.x;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;

    if (p.y < BALL_R) {
      p.y = BALL_R;
      if (v.y < -1.0) {
        v.y = -v.y * 0.58;
        v.x *= 0.86; v.z *= 0.86;
        s.x *= 0.5; s.y *= 0.6; s.z *= 0.5;
      } else v.y = 0;
    }
    this.collideGoal(ox);
  }

  collideGoal(prevX) {
    const p = this.pos, v = this.vel;
    for (const side of [-1, 1]) {
      const gx = side * HALF_L;
      // posts (vertical cylinders)
      for (const pz of [-GOAL_HW - POST_R, GOAL_HW + POST_R]) {
        if (p.y > GOAL_H + POST_R + BALL_R) continue;
        const dx = p.x - gx, dz = p.z - pz;
        const d = Math.hypot(dx, dz), min = POST_R + BALL_R;
        if (d < min && d > 1e-6) {
          const nx = dx / d, nz = dz / d;
          p.x = gx + nx * min; p.z = pz + nz * min;
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= 1.7 * vn * nx; v.z -= 1.7 * vn * nz; this.hitWoodwork = 1; }
        }
      }
      // crossbar (horizontal cylinder along z)
      if (Math.abs(p.z) < GOAL_HW + POST_R) {
        const dx = p.x - gx, dy = p.y - (GOAL_H + POST_R);
        const d = Math.hypot(dx, dy), min = POST_R + BALL_R;
        if (d < min && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          p.x = gx + nx * min; p.y = GOAL_H + POST_R + ny * min;
          const vn = v.x * nx + v.y * ny;
          if (vn < 0) { v.x -= 1.7 * vn * nx; v.y -= 1.7 * vn * ny; this.hitWoodwork = 1; }
        }
      }
      // net: once inside the goal volume keep the ball inside and kill its energy
      const inside = side * p.x > HALF_L && Math.abs(p.z) < GOAL_HW && p.y < GOAL_H;
      const wasInside = side * prevX > HALF_L;
      if (inside || (wasInside && side * p.x > HALF_L && Math.abs(p.z) < GOAL_HW + 0.3)) {
        if (side * p.x > HALF_L + GOAL_D - BALL_R) { p.x = side * (HALF_L + GOAL_D - BALL_R); v.x *= -0.12; v.z *= 0.5; v.y *= 0.5; }
        if (Math.abs(p.z) > GOAL_HW - BALL_R && wasInside) { p.z = Math.sign(p.z) * (GOAL_HW - BALL_R); v.z *= -0.15; v.x *= 0.6; }
        if (p.y > GOAL_H - BALL_R && wasInside) { p.y = GOAL_H - BALL_R; v.y = Math.min(0, v.y) * 0.2; }
        if (wasInside) this.inNet = true;
      }
    }
  }
}

// Distance a ball rolls when decelerating from v0 to v1 with dv/dt = -(a + b v)
export function rollDistance(v0, v1) {
  const a = ROLL_A, b = ROLL_B;
  if (v0 <= v1) return 0;
  return ((v0 - v1) - (a / b) * Math.log((a + b * v0) / (a + b * v1))) / b;
}

// Initial speed needed so that a rolling pass covers distance d arriving with speed vEnd
export function solveRollSpeed(d, vEnd) {
  let lo = vEnd, hi = 45;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (rollDistance(mid, vEnd) < d) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Lightweight trajectory prediction (no spin), returns samples every `step` seconds
export function predictBall(ball, duration = 3, step = 0.1) {
  const out = [];
  let x = ball.pos.x, y = ball.pos.y, z = ball.pos.z;
  let vx = ball.vel.x, vy = ball.vel.y, vz = ball.vel.z;
  const sub = 4, dt = step / sub;
  for (let t = step; t <= duration + 1e-6; t += step) {
    for (let i = 0; i < sub; i++) {
      if (y > BALL_R + 0.005 || vy > 0.01) {
        const sp = Math.hypot(vx, vy, vz), k = AIR_K * sp * dt;
        vx -= vx * k; vy -= vy * k + G * dt; vz -= vz * k;
      } else {
        const hs = Math.hypot(vx, vz);
        if (hs > 0) { const ns = Math.max(0, hs - (ROLL_A + ROLL_B * hs) * dt); vx *= ns / hs; vz *= ns / hs; }
        vy = 0;
      }
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (y < BALL_R) { y = BALL_R; vy = vy < -1 ? -vy * 0.58 : 0; if (vy) { vx *= 0.86; vz *= 0.86; } }
    }
    out.push({ t, x, y, z });
  }
  return out;
}
