import { ROLE_DEFS, roleOf } from './tactics.js';
// Team & player AI: tactical shape, pressing, marking, support runs, ball carrier decisions,
// goalkeeper positioning and set piece positioning. Runs at AI_DT (10 Hz).
import { clamp, lerp } from '../core/rng.js';
import { HALF_L, HALF_W, GOAL_HW, PEN_D, PEN_HW, AI_DT, PEN_SPOT } from './constants.js';
import { predictBall, solveRollSpeed } from './ball.js';

// ---------- coordinate helpers (team-local: attacking towards +x) ----------
export const toLocal = (E, t, x, z) => { const d = E.dirOf(t); return { x: x * d, z: z * d }; };
export const toWorld = (E, t, x, z) => { const d = E.dirOf(t); return { x: x * d, z: z * d }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az; const l2 = vx * vx + vz * vz || 1e-6;
  let t = ((px - ax) * vx + (pz - az) * vz) / l2; t = clamp(t, 0, 1);
  return { d: Math.hypot(px - (ax + vx * t), pz - (az + vz * t)), t };
}

export function offsideLine(E, t) {
  const opp = E.teams[1 - t].active;
  const xs = opp.map((p) => toLocal(E, t, p.pos.x, p.pos.z).x).sort((a, b) => b - a);
  const second = xs.length > 1 ? xs[1] : 0;
  const bl = toLocal(E, t, E.ball.pos.x, E.ball.pos.z).x;
  return Math.max(second, bl, 0);
}

// Expected-threat-like value of a local position
export function threat(lx, lz) {
  const d = Math.hypot(HALF_L - lx, lz * 0.8);
  return 0.01 + 0.3 * Math.exp(-d / 11);
}

export function shotXg(lx, lz) {
  const dx = Math.max(0.5, HALF_L - lx);
  const d = Math.hypot(dx, lz);
  let xg = 0.9 / (1 + Math.exp((d - 6) / 5.2));
  const ang = Math.abs(Math.atan2(GOAL_HW - lz, dx) - Math.atan2(-GOAL_HW - lz, dx));
  xg *= clamp(ang / 0.55, 0.12, 1.25);
  return xg;
}

function setMove(p, x, z, speed, face = null) {
  p.target.x = clamp(x, -HALF_L - 1.5, HALF_L + 1.5);
  p.target.z = clamp(z, -HALF_W - 1.5, HALF_W + 1.5);
  p.targetSpeed = speed;
  p.faceTarget = face;
}

function moveSpeed(p, d, urgency = 0) {
  const top = p.topSpeed();
  if (urgency >= 1) return top;
  if (d > 12) return top * (0.78 + urgency * 0.2);
  if (d > 5) return top * 0.58;
  return top * 0.42;
}

// ---------------------------------------------------------------------------
export function think(E) {
  const min = E.minute();
  for (const T of E.teams) {
    T.active = T.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff);
    for (const p of T.active) p.roleDef = ROLE_DEFS[roleOf(T.tactic, p.slotIndex, p.role)];
    // game-state awareness: chasing a result late → more risk; protecting a lead → safety & time-wasting
    const diff = T.score - E.teams[1 - T.idx].score, late = clamp((min - 60) / 30, 0, 1);
    T.gs = globalThis.__noCoach ? { urgency: 0, protect: 0, nerves: 0 } : { urgency: diff < 0 ? late * (diff <= -2 ? 0.7 : 1) : 0, protect: diff > 0 ? late : 0, nerves: min >= 80 && Math.abs(diff) <= 1 ? 1 : 0 };
  }
  E.prediction = E.ball.owner ? null : predictBall(E.ball, 3.0, 0.1);
  if (E.phase === 'play') playThink(E);
  else if (E.phase === 'setpiece') setPieceThink(E);
  else if (E.phase === 'goal') goalThink(E);
  for (const T of E.teams) for (const p of T.players) if (p.leaving) leaveThink(E, p);
}

function leaveThink(E, p) {
  const tz = HALF_W + 2.5;
  setMove(p, clamp(p.pos.x, -8, 8), tz, p.sentOff ? 2.2 : 1.8);
  if (Math.abs(p.pos.z - tz) < 0.8) p.offPitch = true;
}

// ---------- tactical shape ----------
function shapeTarget(E, T, p, inPoss, ballL) {
  const tac = T.tactic;
  const slot = T.slots[p.slotIndex];
  const role = slot[0], sx = slot[1], sz = slot[2];
  const bx = ballL.x, bz = ballL.z;
  let lx, lz;
  if (inPoss) {
    let line = clamp(bx * 0.55 - 12 + tac.line * 10 + tac.mentality * 6, -38, 14);
    const span = 42 + tac.mentality * 12 + (1 - tac.compactness) * 8;
    lx = line + sx * span;
    const width = 31 * (0.6 + 0.4 * tac.width);
    lz = sz * width + bz * 0.12;
    if (role === 'LV' || role === 'RV') { lx += 4 + tac.mentality * 12; lz = Math.sign(sz) * Math.max(Math.abs(lz), 22 + 6 * tac.width); }
    if (role === 'LA' || role === 'RA' || role === 'LM' || role === 'RM') lz = Math.sign(sz) * Math.max(Math.abs(lz), 24 + 8 * tac.width);
    if (role === 'IV') lz = sz * (14 + 6 * tac.width);
    lx = Math.min(lx, T.offLine - 0.8);
  } else {
    let line = clamp(bx * 0.5 - 17 + tac.line * 17, -41, 2);
    line = Math.min(line, bx - 3);
    if (!tac.offsideTrap) line = Math.min(line, T.deepestOpp + 0.8);
    line = Math.max(line, -46);
    const span = 24 + (1 - tac.compactness) * 14 + tac.mentality * 6;
    lx = line + sx * span;
    if (sx < 0.1) lx = line + sx * 10;
    const width = 20 * (0.72 + 0.28 * (1 - tac.compactness));
    lz = sz * width + bz * (0.32 + 0.18 * tac.compactness);
    // forwards stay a bit higher for counters when mentality is high
    if (sx > 0.8) lx += 6 * (1 - tac.compactness) + tac.mentality * 4;
  }
  // individual player role (v1.0)
  const R = p.roleDef;
  if (R) {
    if (inPoss) {
      lx += R.px || 0;
      if (R.pz != null) lz *= R.pz;
      if (R.wide) lz = Math.sign(sz || lz || 1) * Math.max(Math.abs(lz), R.wide);
      lx = Math.min(lx, T.offLine - 0.8);
    } else lx += R.dx || 0;
  }
  lx = clamp(lx, -49, 49); lz = clamp(lz, -32.5, 32.5);
  return { x: lx, z: lz };
}

function gkTarget(E, T, gk, ballL) {
  const tac = T.tactic;
  const goal = { x: -HALF_L, z: 0 };
  const dx = ballL.x - goal.x, dz = ballL.z - goal.z;
  const d = Math.hypot(dx, dz) || 1;
  let off;
  if (d < 25) off = clamp(d * 0.16 + (gk.a.herauslaufen - 50) * 0.02, 0.6, 4.2);
  else off = 4 + clamp((ballL.x + 20) / 70, 0, 1) * (5 + 9 * tac.line) + (gk.roleDef?.gk || 0) * clamp((ballL.x + 10) / 50, 0, 1);
  const lx = goal.x + (dx / d) * off, lz = clamp((dz / d) * off, -GOAL_HW + 0.3, GOAL_HW - 0.3) * (d < 25 ? 1 : 0.5);
  return { x: Math.max(lx, -HALF_L + 0.3), z: lz };
}

// ---------- open play ----------
function playThink(E) {
  const b = E.ball;
  const owner = b.owner;
  const attT = owner ? owner.team : (E.pass ? E.pass.team : (E.lastTouch.team ?? null));
  for (const T of E.teams) {
    const t = T.idx;
    T.ballL = toLocal(E, t, b.pos.x, b.pos.z);
    T.offLine = offsideLine(E, t);
    const opp = E.teams[1 - t].active.filter((o) => !o.isGK).map((o) => toLocal(E, t, o.pos.x, o.pos.z).x);
    T.deepestOpp = opp.length ? Math.min(...opp) : 0;
  }
  // interceptors for loose balls
  const chasers = [null, null];
  if (!owner && E.prediction) {
    for (const T of E.teams) chasers[T.idx] = bestInterceptor(E, T);
  }
  for (const T of E.teams) {
    const inPoss = attT === T.idx;
    const ballL = T.ballL;
    for (const p of T.active) {
      if (p.injured) { setMove(p, p.pos.x, p.pos.z, 0); continue; }
      p.mode = 'shape';
      if (p.isGK) { gkThink(E, T, p, ballL, chasers[T.idx]); continue; }
      const s = shapeTarget(E, T, p, inPoss, ballL);
      p.shape = s;
      const w = toWorld(E, T.idx, s.x, s.z);
      const d = dist(w, p.pos);
      setMove(p, w.x, w.z, moveSpeed(p, d), d < 8 ? b.pos : null);
    }
    if (owner) {
      if (owner.team === T.idx) attackThink(E, T, owner);
      else defendThink(E, T, owner);
    } else {
      looseThink(E, T, chasers[T.idx], inPoss);
    }
  }
}

function bestInterceptor(E, T) {
  const pred = E.prediction;
  let best = null;
  for (const p of T.active) {
    if (p.injured || p.stun > 0.3) continue;
    const ownBox = p.isGK && inOwnBox(E, T.idx, E.ball.pos);
    if (p.isGK && !ownBox) continue;
    const top = p.topSpeed() * 0.95;
    const pl = toLocal(E, T.idx, p.pos.x, p.pos.z);
    const headerZone = (pl.x > 30 && Math.abs(pl.z) < 22) || pl.x < -28;
    const maxY = ownBox ? 2.6 : headerZone ? 2.3 : 1.6;
    for (const s of pred) {
      if (s.y > maxY) continue;
      if (Math.abs(s.z) > HALF_W + 0.5 || Math.abs(s.x) > HALF_L + 0.5) break;
      const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
      const reach = Math.max(0, d - 0.7) / top + 0.12;
      if (reach <= s.t) {
        if (!best || s.t < best.t) best = { p, t: s.t, x: s.x, z: s.z };
        break;
      }
    }
  }
  if (!best) {
    // ball will stop outside prediction: nearest player to final point
    const last = pred[pred.length - 1];
    for (const p of T.active) {
      if (p.isGK || p.injured) continue;
      const d = Math.hypot(last.x - p.pos.x, last.z - p.pos.z);
      if (!best || d < best.d) best = { p, d, t: 9, x: last.x, z: last.z };
    }
  }
  return best;
}

export function inOwnBox(E, t, pos) {
  const l = toLocal(E, t, pos.x, pos.z);
  return l.x < -HALF_L + PEN_D && Math.abs(l.z) < PEN_HW;
}

function looseThink(E, T, chase, inPoss) {
  const pass = E.pass;
  let chaser = chase?.p;
  if (pass && pass.team === T.idx && pass.to && !pass.to.offPitch) {
    const r = pass.to;
    // intended receiver moves onto the ball path: closest reachable point of the predicted trajectory
    let tx = pass.tx, tz = pass.tz, bestD = 1e9;
    const pl = toLocal(E, T.idx, r.pos.x, r.pos.z);
    const maxY = (pl.x > 30 && Math.abs(pl.z) < 22) || pl.x < -28 ? 2.3 : 1.6;
    for (const s of E.prediction || []) {
      if (s.y > maxY) continue;
      const d = Math.hypot(s.x - r.pos.x, s.z - r.pos.z);
      const reach = Math.max(0, d - 0.6) / (r.topSpeed() * 0.8) + 0.2;
      // prefer the nearest point that we can reach in time, slightly favouring meeting the ball early
      const sc = d + s.t * 0.8;
      if (reach <= s.t && sc < bestD) { bestD = sc; tx = s.x; tz = s.z; }
    }
    setMove(r, tx, tz, r.topSpeed(), E.ball.pos);
    r.mode = 'receive';
    if (chaser === r) chaser = null;
    if (chaser && chase.t > 0.8) chaser = null;
  }
  // defenders need a moment to read a pass
  if (!inPoss && pass && pass.team !== T.idx && E.simTime - pass.t < 0.28) chaser = null;
  if (chaser && !chaser.isGK) {
    setMove(chaser, chase.x, chase.z, chaser.topSpeed());
    chaser.mode = 'chase';
  }
  // second man for the team not in possession closes down the landing zone
  if (!inPoss && chase) {
    let second = null, bd = 1e9;
    for (const p of T.active) {
      if (p === chaser || p.isGK) continue;
      const d = Math.hypot(p.pos.x - chase.x, p.pos.z - chase.z);
      if (d < bd) { bd = d; second = p; }
    }
    if (second && bd < 14) setMove(second, lerp(second.pos.x, chase.x, 0.6), lerp(second.pos.z, chase.z, 0.6), second.topSpeed() * 0.8, E.ball.pos);
  }
}

// ---------- goalkeeper ----------
function gkThink(E, T, gk, ballL, chase) {
  const b = E.ball;
  if (gk.action && gk.action.type === 'dive') return;
  if (b.owner === gk) return; // distribution handled by carrier logic
  // shot reaction
  if (E.shot && E.shot.team !== T.idx && !b.owner) {
    const vxL = b.vel.x * E.dirOf(T.idx);
    if (vxL < -3) {
      const s = E.prediction?.find((q) => toLocal(E, T.idx, q.x, q.z).x <= toLocal(E, T.idx, gk.pos.x, gk.pos.z).x + 0.1);
      if (s) {
        const need = s.z - gk.pos.z;
        const reaction = 0.13 + (100 - gk.a.reflexe) * 0.003;
        if (!gk.diveQueued || (!gk.diveQueued.locked && gk.diveQueued.t == null)) {
          gk.diveQueued = { at: E.simTime + reaction, dir: Math.sign(need) || 1, need: Math.abs(need), y: s.y, t: s.t };
        }
        // step across while waiting
        setMove(gk, gk.pos.x, gk.pos.z + clamp(need, -1.2, 1.2), gk.topSpeed(), b.pos);
        return;
      }
    }
  }
  if (!gk.diveQueued?.locked) gk.diveQueued = null;
  if (chase && chase.p === gk) {
    setMove(gk, chase.x, chase.z, gk.topSpeed(), b.pos);
    gk.mode = 'chase';
    return;
  }
  // one-on-one: rush out if attacker with ball is close and alone
  if (b.owner && b.owner.team !== T.idx) {
    const ol = toLocal(E, T.idx, b.owner.pos.x, b.owner.pos.z);
    const dGoal = Math.hypot(ol.x + HALF_L, ol.z);
    if (dGoal < 16 && Math.abs(ol.z) < 14) {
      const k = clamp((16 - dGoal) / 16, 0, 1) * (0.4 + gk.a.herauslaufen / 200);
      const tx = lerp(-HALF_L + 1, ol.x - 1.2, k * 0.85), tz = ol.z * (0.4 + k * 0.5);
      const w = toWorld(E, T.idx, tx, tz);
      setMove(gk, w.x, w.z, gk.topSpeed() * (0.6 + k * 0.4), b.pos);
      if (dist(gk.pos, b.owner.pos) < 1.4 && gk.tackleCooldown <= 0) E.tryTackle(gk, b.owner, true);
      return;
    }
  }
  const s = gkTarget(E, T, gk, ballL);
  const w = toWorld(E, T.idx, s.x, s.z);
  setMove(gk, w.x, w.z, moveSpeed(gk, dist(w, gk.pos), 0.3), b.pos);
}

// ---------- attacking team ----------
function attackThink(E, T, carrier) {
  const tac = T.tactic;
  const cl = toLocal(E, T.idx, carrier.pos.x, carrier.pos.z);
  // support players: two nearest
  const mates = T.active.filter((p) => p !== carrier && !p.isGK && !p.injured);
  mates.sort((a, b) => dist(a.pos, carrier.pos) - dist(b.pos, carrier.pos));
  const support = mates.slice(0, 2);
  const opp = E.teams[1 - T.idx].active;
  for (const p of mates) {
    // runs in behind
    if (p.runTimer > 0) {
      p.runTimer -= AI_DT;
      const lx = Math.min(HALF_L - 6, T.offLine + 14), lz = clamp(p.runZ, -28, 28);
      const w = toWorld(E, T.idx, lx, lz);
      setMove(p, w.x, w.z, p.topSpeed());
      p.mode = 'run';
      if (p.runTimer <= 0) p.runCooldown = 4 + E.rng.next() * 3;
      continue;
    }
    p.runCooldown -= AI_DT;
    const runner = ['ST', 'LA', 'RA', 'OM'].includes(p.role) || ((p.role === 'LV' || p.role === 'RV') && tac.mentality > 0.55) || (p.role === 'ZM' && tac.mentality > 0.7);
    const pl = toLocal(E, T.idx, p.pos.x, p.pos.z);
    if (runner && p.runCooldown <= 0 && cl.x > -20 && pl.x < T.offLine - 0.5 && pl.x > T.offLine - 16 &&
        E.rng.chance(0.05 * (0.6 + tac.mentality) * (0.5 + tac.directness))) {
      p.runTimer = 2.2 + E.rng.next(); p.runZ = pl.z * 0.55 + (p.role === 'LV' || p.role === 'LA' ? -6 : p.role === 'RV' || p.role === 'RA' ? 6 : 0);
      continue;
    }
    let base = p.shape ? { ...p.shape } : pl;
    if (support.includes(p) && dist(p.pos, carrier.pos) < 30) {
      // offer a passing angle around the carrier
      let best = null, bs = -1e9;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const r = 11 + (k % 2) * 4;
        const cx = cl.x + Math.cos(ang) * r, cz = cl.z + Math.sin(ang) * r;
        if (Math.abs(cz) > 32 || cx > T.offLine - 0.5 || cx < -50) continue;
        const w = toWorld(E, T.idx, cx, cz);
        let open = 12, lane = 6;
        for (const o of opp) {
          open = Math.min(open, dist(o.pos, w));
          lane = Math.min(lane, segDist(o.pos.x, o.pos.z, carrier.pos.x, carrier.pos.z, w.x, w.z).d);
        }
        const sc = open + lane * 1.2 + (cx - cl.x) * 0.12 - Math.hypot(cx - base.x, cz - base.z) * 0.12;
        if (sc > bs) { bs = sc; best = { x: cx, z: cz }; }
      }
      if (best) base = { x: lerp(base.x, best.x, 0.75), z: lerp(base.z, best.z, 0.75) };
    } else {
      // find space near shape position
      p.spaceTimer -= AI_DT;
      if (p.spaceTimer <= 0) {
        p.spaceTimer = 0.6 + E.rng.next() * 0.5;
        let best = { x: 0, z: 0 }, bs = -1e9;
        for (let k = 0; k < 6; k++) {
          const ox = k === 0 ? 0 : E.rng.range(-6, 6), oz = k === 0 ? 0 : E.rng.range(-6, 6);
          const cx = base.x + ox, cz = base.z + oz;
          if (cx > T.offLine - 0.6) continue;
          const w = toWorld(E, T.idx, cx, cz);
          let open = 10, lane = 6;
          for (const o of opp) {
            open = Math.min(open, dist(o.pos, w));
            lane = Math.min(lane, segDist(o.pos.x, o.pos.z, carrier.pos.x, carrier.pos.z, w.x, w.z).d);
          }
          const sc = open + lane * 0.8 - Math.hypot(ox, oz) * 0.2;
          if (sc > bs) { bs = sc; best = { x: ox, z: oz }; }
        }
        p.spaceOffset = best;
      }
      base = { x: base.x + p.spaceOffset.x, z: base.z + p.spaceOffset.z };
    }
    base.x = Math.min(base.x, T.offLine - 0.6);
    const w = toWorld(E, T.idx, base.x, clamp(base.z, -33, 33));
    const d = dist(w, p.pos);
    setMove(p, w.x, w.z, moveSpeed(p, d, tac.tempo * 0.5), d < 7 ? E.ball.pos : null);
  }
  carrierThink(E, T, carrier);
}

// ---------- defending team ----------
function defendThink(E, T, carrier) {
  const tac = T.tactic;
  const ownGoal = toWorld(E, T.idx, -HALF_L, 0);
  const cl = toLocal(E, T.idx, carrier.pos.x, carrier.pos.z);
  const pressLine = lerp(-18, 44, tac.pressing);
  const engage = cl.x < pressLine || cl.x < -25;
  const field = T.active.filter((p) => !p.isGK && !p.injured);
  field.sort((a, b) => dist(a.pos, carrier.pos) / a.topSpeed() - dist(b.pos, carrier.pos) / b.topSpeed());
  const pressers = [];
  if (field.length && !carrier.held) {
    const p1 = field[0];
    pressers.push(p1);
    const gx = ownGoal.x - carrier.pos.x, gz = ownGoal.z - carrier.pos.z, gl = Math.hypot(gx, gz) || 1;
    const d = dist(p1.pos, carrier.pos);
    if (engage) {
      const stand = d > 4 ? 1.2 : 1.3;
      setMove(p1, carrier.pos.x + (gx / gl) * stand, carrier.pos.z + (gz / gl) * stand, d > 3 ? p1.topSpeed() : p1.topSpeed() * 0.75, carrier.pos);
      p1.mode = 'press';
      const rate = 0.09 + tac.pressing * 0.09 + (cl.x < -30 ? 0.08 : 0);
      if (d < 1.9 && p1.tackleCooldown <= 0 && E.rng.chance(rate)) E.tryTackle(p1, carrier);
      else if (d < 3.2 && d > 1.5 && carrier.speed > 4.5 && p1.tackleCooldown <= 0 && E.rng.chance(0.04 + tac.pressing * 0.03)) E.tryTackle(p1, carrier, false, true);
    } else {
      // contain: block route to goal at distance
      const k = 7;
      setMove(p1, carrier.pos.x + (gx / gl) * k, carrier.pos.z + (gz / gl) * k, p1.topSpeed() * 0.6, carrier.pos);
      p1.mode = 'contain';
    }
    // second presser cuts the nearest passing option
    if (engage && tac.pressing > 0.62 && field.length > 1) {
      const p2 = field[1];
      const opts = E.teams[carrier.team].active.filter((q) => q !== carrier && !q.isGK);
      let near = null, nd = 1e9;
      for (const q of opts) { const dd = dist(q.pos, carrier.pos); if (dd < nd) { nd = dd; near = q; } }
      if (near && nd < 25) {
        setMove(p2, lerp(carrier.pos.x, near.pos.x, 0.55), lerp(carrier.pos.z, near.pos.z, 0.55), p2.topSpeed(), carrier.pos);
        p2.mode = 'press2';
        pressers.push(p2);
      }
    }
  }
  // man marking inside the danger zone
  const attackers = E.teams[carrier.team].active.filter((q) => q !== carrier && !q.isGK)
    .map((q) => ({ q, l: toLocal(E, T.idx, q.pos.x, q.pos.z) }))
    .filter((e) => e.l.x < 8)
    .sort((a, b) => a.l.x - b.l.x);
  const used = new Set(pressers);
  for (const { q, l } of attackers) {
    let best = null, bd = 1e9;
    for (const p of field) {
      if (used.has(p) || !p.shape) continue;
      const d = Math.hypot(p.shape.x - l.x, p.shape.z - l.z);
      if (d < bd && d < 15) { bd = d; best = p; }
    }
    if (!best) continue;
    used.add(best);
    const gx = -HALF_L - l.x, gz = -l.z, gl = Math.hypot(gx, gz) || 1;
    const tight = 1.4 + (1 - tac.pressing) * 1.2;
    let mx = l.x + (gx / gl) * tight, mz = l.z + (gz / gl) * tight;
    const isDef = T.slots[best.slotIndex][1] < 0.1;
    const wgt = isDef ? 0.62 : 0.5;
    let tx = lerp(best.shape.x, mx, wgt), tz = lerp(best.shape.z, mz, wgt);
    if (isDef && tac.offsideTrap && l.x > best.shape.x) tx = best.shape.x; // hold the line
    const w = toWorld(E, T.idx, tx, tz);
    setMove(best, w.x, w.z, moveSpeed(best, dist(w, best.pos), 0.6), E.ball.pos);
    best.mode = 'mark';
  }
}

// ---------- ball carrier decision making ----------
function carrierThink(E, T, p) {
  if (p.busy()) return;
  const rng = E.rng, tac = T.tactic, a = p.a;
  const me = toLocal(E, T.idx, p.pos.x, p.pos.z);
  const opp = E.teams[1 - T.idx].active;
  let pressure = 99;
  for (const o of opp) pressure = Math.min(pressure, dist(o.pos, p.pos));

  if (p.held) { // goalkeeper with the ball in his hands
    p.holdTime = (p.holdTime || 0) + AI_DT;
    setMove(p, p.pos.x, p.pos.z, 0, null);
    if (p.holdTime < 1.4 + (T.gs?.protect || 0) * 2.2) return; // keepers waste time when leading late
  }
  p.decisionTimer -= AI_DT;
  if (p.decisionTimer > 0 && pressure > 2.4 && !p.held) return;
  p.decisionTimer = lerp(0.6, 0.25, tac.tempo) * (0.75 + rng.next() * 0.5);

  const vision = a.uebersicht / 100;
  const gs = T.gs || { urgency: 0, protect: 0, nerves: 0 };
  // tired players and big moments make decisions less precise (experience helps)
  const tired = 1 + (1 - p.energy) * 0.9;
  const nerves = 1 + gs.nerves * clamp((26 - (p.data.age || 26)) / 20 + 0.15, 0, 0.35);
  const noise = () => rng.normal(0, 0.02 * (1.25 - vision) * (1.4 - 0.6 * (T.familiarity ?? 0.8)) * tired * nerves * (E.weatherNoise || 1));
  const lossCost = (me.x < -25 ? 0.32 : me.x < 0 ? 0.2 : me.x < 25 ? 0.13 : 0.07) * (1.2 - tac.directness * 0.4) * (1 - gs.urgency * 0.4 + gs.protect * 0.6);
  const options = [];

  // --- shot
  if (me.x > 17.5) E.d && E.d('ftDecisions');
  if (!p.held && me.x > 14) {
    let xg = shotXg(me.x, me.z);
    let block = 0;
    for (const o of opp) {
      const ol = toLocal(E, T.idx, o.pos.x, o.pos.z);
      if (ol.x <= me.x) continue;
      const sd = segDist(ol.x, ol.z, me.x, me.z, HALF_L, 0).d;
      if (!o.isGK && sd < 1.0) block += 0.25;
    }
    xg *= Math.max(0.15, 1 - block) * (pressure < 1.5 ? 0.7 : 1);
    const skill = 0.6 + a.abschluss / 160;
    const longShot = me.x < 30 ? a.schusskraft / 99 : 1;
    const score = xg * skill * longShot * (4.0 + tac.mentality * 1.2) * (1 + gs.urgency * 0.45) * (p.roleDef?.shot || 1) + noise();
    if (xg > 0.012 - gs.urgency * 0.004) options.push({ kind: 'shot', score });
  }

  // --- passes
  const mates = T.active.filter((q) => q !== p && !q.injured && !q.leaving);
  for (const q of mates) {
    const ql = toLocal(E, T.idx, q.pos.x, q.pos.z);
    const qf = toLocal(E, T.idx, q.pos.x + q.vel.x * 0.3, q.pos.z + q.vel.z * 0.3);
    if (ql.x > T.offLine - 0.1 || (qf.x > 0 && qf.x > T.offLine - 0.2)) continue; // would be offside at release
    const d0 = dist(q.pos, p.pos);
    if (d0 < 4 || d0 > 60) continue;
    const lofted = d0 > 32 || (d0 > 20 && tac.directness > 0.6 && rng.chance(0.5));
    const travel = lofted ? 1.2 + d0 / 22 : d0 / 15;
    const lead = q.mode === 'run' ? 1.0 : 0.5;
    let tx = q.pos.x + q.vel.x * travel * lead, tz = q.pos.z + q.vel.z * travel * lead;
    tx = clamp(tx, -HALF_L + 1, HALF_L - 1); tz = clamp(tz, -HALF_W + 1, HALF_W - 1);
    const tl = toLocal(E, T.idx, tx, tz);
    const d = Math.hypot(tx - p.pos.x, tz - p.pos.z);
    let risk = 0;
    if (!lofted) {
      const vEnd = clamp(4 + d * 0.3, 5, 14), avg = (Math.min(30, solveRollSpeed(d, vEnd)) + vEnd) / 2;
      for (const o of opp) {
        const sd = segDist(o.pos.x, o.pos.z, p.pos.x, p.pos.z, tx, tz);
        const ballT = (sd.t * d) / avg;
        const oppT = Math.max(0, sd.d - 0.75) / (o.topSpeed() * 0.85) + 0.18;
        let r = 1 / (1 + Math.exp(-(ballT - oppT) * 6));
        if (sd.d < 0.9) r = Math.max(r, 0.92);         // opponent stands in the lane
        else if (sd.d < 1.6 && sd.t * d < 6) r = Math.max(r, 0.6);
        if (r > risk) risk = r;
      }
    } else {
      const qd = Math.hypot(q.pos.x - tx, q.pos.z - tz);
      let oppT = 99;
      const p8x = p.pos.x + (tx - p.pos.x) * 0.76, p8z = p.pos.z + (tz - p.pos.z) * 0.76;
      for (const o of opp) {
        const sd = segDist(o.pos.x, o.pos.z, p8x, p8z, tx, tz);
        oppT = Math.min(oppT, Math.max(0, sd.d - 1) / (o.topSpeed() * 0.9) + 0.3);
      }
      const recvT = qd / (q.topSpeed() * 0.9);
      const contest = oppT < travel * 0.85 ? 0.55 : 0.2;
      risk = clamp(contest + 0.3 + (recvT - oppT) * 0.15, 0.3, 0.97) * (1.25 - a.passspiel / 125);
    }
    let recvPress = 99;
    for (const o of opp) recvPress = Math.min(recvPress, Math.hypot(o.pos.x - tx, o.pos.z - tz));
    risk = clamp(risk + clamp((3.5 - recvPress) / 3.5, 0, 1) * 0.35, 0, 1);
    risk *= 1.15 - a.passspiel / 160;
    const gain = threat(tl.x, tl.z);
    const prog = (tl.x - me.x) * 0.0028 * (0.5 + tac.directness);
    const freeBonus = clamp(recvPress / 8, 0, 1) * 0.012 + clamp((2.5 - pressure) / 2.5, 0, 1) * 0.02;
    let score = (gain * 0.9 + prog + freeBonus) * (1 - risk) - risk * lossCost + noise();
    if (q.isGK) score -= 0.03;
    if (lofted) score -= (0.012 + d * 0.0004) * (1.4 - tac.directness);
    // crossing from wide final third into the box
    const cross = me.x > 30 && Math.abs(me.z) > 16 && tl.x > 36 && Math.abs(tl.z) < 12;
    if (cross) score += 0.03 + q.a.kopfball / 2500;
    options.push({ kind: cross ? 'cross' : lofted ? 'longpass' : 'pass', score, q, tx, tz, d, risk });
  }

  // --- dribble / carry
  if (!p.held && !p.isGK) {
    const goalDir = Math.atan2(-me.z * 0.6, HALF_L - me.x);
    for (const off of [-1.1, -0.55, 0, 0.55, 1.1]) {
      const ang = goalDir + off;
      const ahead = 6;
      const lx = me.x + Math.cos(ang) * ahead, lz = me.z + Math.sin(ang) * ahead;
      if (Math.abs(lz) > HALF_W - 1.5 || lx > HALF_L - 1) continue;
      const w = toWorld(E, T.idx, lx, lz);
      let space = 15;
      for (const o of opp) space = Math.min(space, segDist(o.pos.x, o.pos.z, p.pos.x, p.pos.z, w.x, w.z).d);
      const risk = clamp((3.2 - space) / 3.2 + clamp((2.2 - pressure) * 0.22, 0, 0.5), 0, 1) * (1.15 - a.dribbling / 120);
      const free = clamp(space / 8, 0, 1);
      let score = threat(lx, lz) * (0.72 + free * 0.12) * (1 - risk) - risk * lossCost + noise();
      score += (a.dribbling - 60) * 0.0004 - tac.tempo * 0.008 + Math.cos(off) * 0.006 * (0.6 + tac.mentality) - gs.protect * 0.008 + (p.roleDef?.drib || 0);
      // protecting a lead near the corner flag: run the clock down
      if (gs.protect > 0.8 && lx > 38 && Math.abs(lz) > 18) score += 0.02;
      options.push({ kind: 'dribble', score, ang, w, space });
    }
  }
  if (!options.length) return;
  options.sort((x, y) => y.score - x.score);
  const o = options[0];
  if (E.debugFT && me.x > 22) E.debugFT(me, options.slice(0, 4), options.find((q) => q.kind === 'shot'));
  E.d && E.d('opt_' + o.kind); if (o.risk != null) { E.dbg['risk_' + o.kind] = (E.dbg['risk_' + o.kind] || 0) + o.risk; }
  execute(E, T, p, o, pressure);
}

function execute(E, T, p, o, pressure) {
  if (o.kind === 'dribble') {
    const top = p.topSpeed();
    const sp = o.space > 6 ? top * (0.8 + p.a.dribbling * 0.002) : top * (0.55 + p.a.dribbling * 0.003);
    setMove(p, clamp(o.w.x + (o.w.x - p.pos.x) * 0.5, -HALF_L + 1, HALF_L - 1), clamp(o.w.z + (o.w.z - p.pos.z) * 0.5, -HALF_W + 1, HALF_W - 1), sp, null);
    p.mode = 'dribble';
    return;
  }
  if (o.kind === 'shot') {
    const g = toWorld(E, T.idx, HALF_L, 0);
    p.faceTarget = g;
    setMove(p, p.pos.x, p.pos.z, p.speed * 0.5, g);
    p.startAction('shot', 0.42, { kick: true, release: 0.2, done: false, pressure });
    return;
  }
  p.faceTarget = { x: o.tx, z: o.tz };
  setMove(p, p.pos.x, p.pos.z, p.held ? 0 : p.speed * 0.6, p.faceTarget);
  const type = p.held ? (o.d > 30 ? 'longpass' : 'throw') : o.kind;
  p.startAction(type === 'throw' ? 'throw' : type, type === 'throw' ? 0.55 : 0.4,
    { kick: true, release: type === 'throw' ? 0.32 : 0.2, done: false, receiver: o.q, tx: o.tx, tz: o.tz, pressure, kind: type, estRisk: o.risk });
}

// ---------- set pieces ----------
function setPieceThink(E) {
  const sp = E.setPiece; if (!sp) return;
  const b = E.ball;
  const att = E.teams[sp.team], def = E.teams[1 - sp.team];
  for (const T of E.teams) {
    T.ballL = toLocal(E, T.idx, b.pos.x, b.pos.z);
    T.offLine = 60; T.deepestOpp = -60;
  }
  const spotL = toLocal(E, sp.team, sp.spot.x, sp.spot.z);
  for (const T of E.teams) {
    const inPoss = T === att;
    for (const p of T.active) {
      if (p === sp.taker) continue;
      if (p.isGK) {
        const s = gkTarget(E, T, p, T.ballL);
        const w = sp.type === 'penalty' && !inPoss ? toWorld(E, T.idx, -HALF_L + 0.2, 0) : toWorld(E, T.idx, s.x, s.z);
        setMove(p, w.x, w.z, moveSpeed(p, dist(w, p.pos), 0.5), b.pos);
        continue;
      }
      let s = shapeTarget(E, T, p, inPoss, T.ballL);
      p.shape = s;
      if (sp.type === 'kickoff') {
        s = { x: Math.min(s.x, -1.2), z: s.z };
        if (!inPoss && Math.hypot(s.x, s.z) < 10) { const k = 10 / (Math.hypot(s.x, s.z) || 1); s = { x: s.x * k, z: s.z * k }; s.x = Math.min(s.x, -1.2); }
      }
      const w = toWorld(E, T.idx, s.x, s.z);
      setMove(p, w.x, w.z, moveSpeed(p, dist(w, p.pos), 0.4), b.pos);
    }
  }
  // taker approaches the ball
  const tk = sp.taker;
  if (tk) {
    const g = toWorld(E, sp.team, HALF_L, 0);
    let bx = sp.spot.x, bz = sp.spot.z;
    if (sp.type === 'throw') { bz = Math.sign(sp.spot.z) * (HALF_W + 0.35); }
    else {
      const dx = g.x - sp.spot.x, dz = g.z - sp.spot.z, dl = Math.hypot(dx, dz) || 1;
      const back = sp.type === 'penalty' ? 1.6 : 0.9;
      bx -= (dx / dl) * back; bz -= (dz / dl) * back;
      if (sp.type === 'corner') { bx = sp.spot.x + Math.sign(sp.spot.x) * 0.8; bz = sp.spot.z + Math.sign(sp.spot.z) * 0.8; }
    }
    setMove(tk, bx, bz, tk.topSpeed() * 0.8, sp.type === 'throw' ? { x: sp.spot.x, z: 0 } : b.pos);
    tk.atSpot = Math.hypot(tk.pos.x - bx, tk.pos.z - bz) < 0.6;
  }
  if (sp.type === 'corner') cornerPositions(E, att, def, spotL);
  if (sp.type === 'freekick' && sp.direct) wallPositions(E, def, sp);
  if (sp.type === 'penalty') penaltyPositions(E, att, def, sp);
  if (sp.type === 'throw' || (sp.type === 'freekick' && !sp.direct)) {
    // two nearest team-mates come short
    const mates = att.active.filter((q) => q !== tk && !q.isGK).sort((a, b) => dist(a.pos, sp.spot) - dist(b.pos, sp.spot)).slice(0, 2);
    mates.forEach((q, i) => {
      const lz = spotL.z - Math.sign(spotL.z || 1) * (sp.type === 'throw' ? 7 + i * 5 : 6);
      const w = toWorld(E, sp.team, clamp(spotL.x + (i ? -8 : 6), -48, 48), lz);
      setMove(q, w.x, w.z, q.topSpeed() * 0.7, b.pos);
    });
  }
  // defenders keep 9.15m
  if (['freekick', 'corner', 'kickoff', 'goalkick'].includes(sp.type)) {
    for (const p of def.active) {
      if (p.isGK) continue;
      const d = Math.hypot(p.target.x - sp.spot.x, p.target.z - sp.spot.z);
      if (d < 9.3 && !(sp.type === 'freekick' && p.inWall)) {
        const k = 9.4 / (d || 1);
        p.target.x = sp.spot.x + (p.target.x - sp.spot.x) * k; p.target.z = sp.spot.z + (p.target.z - sp.spot.z) * k;
      }
    }
  }
}

function cornerPositions(E, att, def, spotL) {
  const side = Math.sign(spotL.z) || 1;
  const spots = [[47.5, side * 2.5], [46, -side * 3.5], [41.5, 0], [44, side * 0.5], [40, -side * 6], [36, side * 8]];
  const atk = att.active.filter((p) => !p.isGK && p !== E.setPiece.taker)
    .sort((a, b) => (b.a.kopfball + b.height * 20) - (a.a.kopfball + a.height * 20));
  atk.forEach((p, i) => {
    if (i < spots.length) {
      const w = toWorld(E, att.idx, spots[i][0] + E.rng.range(-0.5, 0.5), spots[i][1]);
      setMove(p, w.x, w.z, p.topSpeed() * 0.7, E.ball.pos);
    } else {
      const w = toWorld(E, att.idx, i === spots.length ? 8 : 2, i % 2 ? 12 : -12);
      setMove(p, w.x, w.z, p.topSpeed() * 0.6, E.ball.pos);
    }
  });
  // defenders: mark the box occupants, rest zonal
  const dfs = def.active.filter((p) => !p.isGK).sort((a, b) => (b.a.kopfball + b.a.stellungsspiel) - (a.a.kopfball + a.a.stellungsspiel));
  const targets = atk.slice(0, spots.length);
  dfs.forEach((p, i) => {
    let w;
    if (i < targets.length) {
      const q = targets[i].target; const ownGoal = toWorld(E, def.idx, -HALF_L, 0);
      const dx = ownGoal.x - q.x, dz = ownGoal.z - q.z, dl = Math.hypot(dx, dz) || 1;
      w = { x: q.x + (dx / dl) * 0.9, z: q.z + (dz / dl) * 0.9 };
    } else if (i < targets.length + 2) {
      w = toWorld(E, def.idx, -HALF_L + 2, (i - targets.length ? -1 : 1) * 3.2 * side * -1);
    } else w = toWorld(E, def.idx, -20, (i % 2 ? 8 : -8));
    setMove(p, w.x, w.z, p.topSpeed() * 0.75, E.ball.pos);
  });
}

function wallPositions(E, def, sp) {
  const g = toWorld(E, def.idx, -HALF_L, 0);
  const dx = g.x - sp.spot.x, dz = g.z - sp.spot.z, dl = Math.hypot(dx, dz) || 1;
  const ux = dx / dl, uz = dz / dl;
  const n = dl < 22 ? 4 : 3;
  const wall = def.active.filter((p) => !p.isGK).sort((a, b) => dist(a.pos, sp.spot) - dist(b.pos, sp.spot)).slice(0, n);
  wall.forEach((p, i) => {
    const off = (i - (n - 1) / 2) * 0.6 + 0.3;
    p.inWall = true;
    setMove(p, sp.spot.x + ux * 9.15 - uz * off, sp.spot.z + uz * 9.15 + ux * off, p.topSpeed() * 0.7, E.ball.pos);
  });
}

function penaltyPositions(E, att, def, sp) {
  for (const T of [att, def]) {
    T.active.forEach((p, i) => {
      if (p.isGK || p === sp.taker) return;
      const l = toLocal(E, att.idx, p.target.x, p.target.z);
      const lx = Math.min(l.x, HALF_L - PEN_D - 1.5), lz = clamp(l.z, -18, 18);
      const w = toWorld(E, att.idx, Math.max(lx, HALF_L - PEN_D - 8 + (i % 4)), lz);
      setMove(p, w.x, w.z, p.topSpeed() * 0.6, E.ball.pos);
    });
  }
}

// ---------- after a goal ----------
function goalThink(E) {
  const g = E.goalInfo; if (!g) return;
  const scorer = g.scorerP;
  for (const T of E.teams) for (const p of T.active) {
    if (T.idx === g.team) {
      if (p === scorer) {
        const cx = Math.sign(scorer.pos.x || 1) * (HALF_L - 6), cz = Math.sign(scorer.pos.z || 1) * (HALF_W - 4);
        setMove(p, cx, cz, p.topSpeed() * 0.7);
        if (!p.action || p.action.type !== 'celebrate') p.startAction('celebrate', 3.8, { style: g.style });
      } else if (!p.isGK && scorer) {
        setMove(p, scorer.pos.x, scorer.pos.z, p.topSpeed() * 0.65, scorer.pos);
        if (dist(p.pos, scorer.pos) < 3 && (!p.action || p.action.type !== 'celebrate')) p.startAction('celebrate', 2.5, { style: Math.random() < 0.6 ? 'hug' : 'jump' });
      }
    } else {
      setMove(p, p.pos.x * 0.98, p.pos.z, 1.3, null);
      if (!p.action) p.startAction('frustrate', 3);
    }
  }
}

export { PEN_SPOT };
