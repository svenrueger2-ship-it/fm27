// Match engine: game state machine, ball control, kicks, tackles, fouls, cards, set pieces,
// goals, substitutions and results. Independent from rendering (can run headless).
import { RNG, clamp, lerp } from '../core/rng.js';
import { Ball, solveRollSpeed, predictBall } from './ball.js';
import { SimPlayer } from './player.js';
import { FORMATIONS, effectiveRating } from './tactics.js';
import * as C from './constants.js';
import { think, toLocal, toWorld, inOwnBox, shotXg, offsideLine } from './ai.js';

const { HALF_L, HALF_W, GOAL_HW, GOAL_H, BALL_R, G } = C;

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function colorDist(a, b) { const x = hexToRgb(a), y = hexToRgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); }

const SETPIECE_DELAY = { kickoff: 1.2, throw: 1.4, corner: 2.6, goalkick: 2.2, freekick: 2.6, penalty: 3.2 };

export class MatchEngine {
  constructor({ home, away, db, homeLineup, awayLineup, seed, userTeam = -1, autoSubsUser = true }) {
    this.rng = new RNG(seed ?? ((Math.random() * 1e9) | 0));
    this.db = db;
    this.userTeam = userTeam;
    this.autoSubsUser = autoSubsUser;
    this.teams = [this.makeTeam(0, home, homeLineup), this.makeTeam(1, away, awayLineup)];
    // kit clash resolution
    if (colorDist(home.colors.primary, away.colors.primary) < 150) {
      this.teams[1].kit = colorDist(home.colors.primary, away.away.primary) > 150 ? away.away
        : { primary: '#f4f4f4', secondary: '#222222', shorts: '#f4f4f4', socks: '#f4f4f4' };
      if (colorDist(home.colors.primary, this.teams[1].kit.primary) < 150) this.teams[1].kit = { primary: '#1b1b1b', secondary: '#e0c050', shorts: '#1b1b1b', socks: '#1b1b1b' };
    }
    this.teams[0].gkKit = { primary: '#1fbf5f', secondary: '#0b3d20', shorts: '#111111', socks: '#1fbf5f' };
    this.teams[1].gkKit = { primary: '#f0c419', secondary: '#3a2a00', shorts: '#222222', socks: '#f0c419' };
    this.ball = new Ball();
    this.time = 0; this.simTime = 0; this.half = 1;
    this.phase = 'setpiece';
    this.events = []; this.listeners = new Set();
    this.addedTime = [this.rng.int(1, 3) * 60, this.rng.int(2, 5) * 60];
    this.aiTimer = 0;
    this.lastTouch = { team: null, player: null };
    this.touchHistory = [];
    this.pass = null; this.shot = null; this.setPiece = null; this.goalInfo = null; this.goalTimer = 0;
    this.possession = [0, 0];
    this.dbg = {};
    this.firstKickoff = this.rng.int(0, 1);
    this.startKickoff(this.firstKickoff, true);
  }

  makeTeam(idx, club, lineup) {
    const slots = FORMATIONS[lineup.formation];
    const players = lineup.xi.map((id, i) => new SimPlayer(this.db[id], idx, i, slots[i][0]));
    return {
      idx, club, tactic: { ...club.tactic }, formation: lineup.formation, slots, players,
      bench: [...lineup.bench], subsLeft: 5, score: 0, active: [],
      stats: { shots: 0, onTarget: 0, passes: 0, passesOk: 0, fouls: 0, corners: 0, yellow: 0, red: 0, xg: 0, offsides: 0, saves: 0, tackles: 0 },
      kit: club.colors, familiarity: club.familiarity ?? 0.8,
      analysis: { heat: new Array(12 * 8).fill(0), links: {}, shots: [], pos: {} }, shout: null,
    };
  }

  setTactic(t, tactic) {
    const T = this.teams[t];
    T.tactic = { ...tactic };
    if (tactic.formation && tactic.formation !== T.formation && FORMATIONS[tactic.formation]) {
      T.formation = tactic.formation; T.slots = FORMATIONS[tactic.formation];
      // re-assign slots by best fit
      const onPitch = T.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff);
      const free = new Set(T.slots.map((_, i) => i));
      const gk = onPitch.find((p) => p.isGK);
      if (gk) { gk.slotIndex = 0; free.delete(0); }
      for (const p of onPitch.filter((q) => !q.isGK).sort((a, b) => b.data.ovr - a.data.ovr)) {
        let best = null, bs = -1;
        for (const i of free) { const s = effectiveRating(p.data, T.slots[i][0]); if (s > bs) { bs = s; best = i; } }
        if (best != null) { p.slotIndex = best; p.role = T.slots[best][0]; free.delete(best); }
      }
    }
  }

  // Analysis data (sampled once per simulated second): team heatmap, average positions, pass links, shots.
  // Coordinates are normalised so that the team always attacks to the right (+x).
  track() {
    for (const T of this.teams) {
      const d = this.dirOf(T.idx), A = T.analysis;
      for (const p of T.players) {
        if (p.offPitch || p.sentOff) continue;
        const x = p.pos.x * d, z = p.pos.z * d;
        const gx = Math.min(11, Math.max(0, Math.floor((x + HALF_L) / (HALF_L * 2) * 12))), gz = Math.min(7, Math.max(0, Math.floor((z + HALF_W) / (HALF_W * 2) * 8)));
        A.heat[gz * 12 + gx]++;
        const s = (A.pos[p.id] ||= { x: 0, z: 0, n: 0, name: p.data.lastName, num: p.data.number, heat: new Array(96).fill(0) });
        s.x += x; s.z += z; s.n++; s.heat[gz * 12 + gx]++;
      }
    }
  }

  // ------------------------------------------------------------------ AI head coach (v0.9)
  // Reads the game (score, minute, xG, energy, cards) and changes plan, formation and players like a
  // real coach. Better coaches react earlier and more precisely. Also runs for the user's team in
  // sports-director mode (autoSubsUser).
  coachThink() {
    const m = this.minute();
    for (const T of this.teams) {
      if (T.idx === this.userTeam && !this.autoSubsUser) continue;
      if (T.shout) continue;
      const O = this.teams[1 - T.idx], diff = T.score - O.score;
      const C = (T.coach ||= { plan: 'normal', last: -99, q: T.club.ai?.coach?.quality ?? 3, base: { ...T.tactic }, baseForm: T.formation, name: T.club.ai?.coach?.name });
      if (m - C.last < 7) continue;
      const lag = (5 - C.q) * 3; // weaker coaches react later
      const men = T.active.length, oppMen = O.active.length;
      let plan = 'normal';
      if (men < oppMen) plan = diff > 0 ? 'protect' : diff < 0 && m >= 70 ? 'attack' : 'compact';
      else if (diff < 0) plan = m >= 78 + lag / 3 && diff <= -1 ? 'allin' : m >= 55 + lag ? 'attack' : m >= 46 && T.stats.xg < O.stats.xg * 0.6 ? 'adjust' : 'normal';
      else if (diff > 0) plan = m >= 72 + lag ? 'protect' : diff >= 2 && m >= 60 ? 'manage' : 'normal';
      else if (m >= 65 + lag) plan = T.stats.xg > O.stats.xg * 1.25 || oppMen < men ? 'push' : T.club.rep + 8 < O.club.rep ? 'compact' : 'normal';
      if (plan === C.plan) continue;
      C.plan = plan; C.last = m;
      const PLANS = {
        normal: { d: {}, label: null },
        adjust: { d: { compactness: 0.12, pressing: -0.1, width: 0.1 }, label: 'stellt nach schwacher Phase um – kompakter und breiter' },
        attack: { d: { mentality: 0.2, tempo: 0.12, directness: 0.12, line: 0.1, pressing: 0.1 }, label: 'geht ins Risiko – mehr Offensive', form: { '5-4-1': '4-4-2', '4-1-4-1': '4-3-3', '4-4-2': '4-3-3' } },
        allin: { d: { mentality: 0.4, tempo: 0.25, directness: 0.3, line: 0.25, pressing: 0.3 }, label: 'wirft alles nach vorne – Brechstange!', form: { '5-4-1': '4-4-2', '4-1-4-1': '4-3-3', '4-2-3-1': '4-3-3', '3-5-2': '4-3-3' } },
        protect: { d: { mentality: -0.3, line: -0.25, compactness: 0.25, tempo: -0.2, pressing: -0.15 }, label: 'zieht sich zurück und verteidigt den Vorsprung', form: { '4-3-3': '4-1-4-1', '4-4-2': '5-4-1', '4-2-3-1': '4-1-4-1', '3-5-2': '5-4-1' } },
        manage: { d: { tempo: -0.2, directness: -0.15, mentality: -0.08 }, label: 'lässt den Ball laufen und verwaltet das Ergebnis' },
        push: { d: { mentality: 0.12, pressing: 0.12, tempo: 0.1 }, label: 'spürt den Sieg – mehr Druck' },
        compact: { d: { mentality: -0.15, compactness: 0.2, line: -0.15 }, label: 'stellt kompakter – der Punkt soll her' },
      };
      const P = PLANS[plan];
      const tac = { ...C.base };
      for (const [k, v] of Object.entries(P.d)) tac[k] = clamp((tac[k] ?? 0.5) + v, 0, 1);
      // better coaches also change the system
      const form = P.form && C.q >= 3 ? P.form[C.baseForm] || C.baseForm : plan === 'normal' ? C.baseForm : T.formation;
      this.setTactic(T.idx, { ...tac, formation: form });
      if (P.label) this.addEvent('coach', T.idx, null, `${T.club.short}: Trainer ${P.label}${form !== C.baseForm && form !== T.formationShown ? ` (${form})` : ''}${P.label.endsWith('!') ? '' : '.'}`, { plan });
      T.formationShown = form;
      // matching substitution
      if (plan === 'attack' || plan === 'allin') this.tacticalSub(T.idx, 'off');
      else if (plan === 'protect') this.tacticalSub(T.idx, 'def');
    }
  }

  tacticalSub(t, kind) {
    const T = this.teams[t];
    if (T.subsLeft <= 1 || !T.bench.length) return;
    const pool = T.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff && !p.isGK);
    const atk = (d) => d.attrs.abschluss + d.attrs.dribbling + d.attrs.tempo;
    const dfn = (d) => d.attrs.tackling + d.attrs.stellungsspiel + d.attrs.kopfball;
    const bench = T.bench.map((id) => this.db[id]).filter((p) => p && p.pos !== 'TW' && !p.injury);
    if (!bench.length) return;
    let out, inn;
    if (kind === 'off') {
      out = pool.filter((p) => ['IV', 'DM', 'LV', 'RV', 'ZM'].includes(p.role)).sort((a, b) => dfn(b.data) - atk(b.data) - (dfn(a.data) - atk(a.data)))[0];
      inn = bench.filter((d) => ['ST', 'LA', 'RA', 'OM'].includes(d.pos)).sort((a, b) => atk(b) - atk(a))[0];
    } else {
      out = pool.filter((p) => ['ST', 'LA', 'RA', 'OM'].includes(p.role)).sort((a, b) => a.energy - b.energy)[0];
      inn = bench.filter((d) => ['IV', 'DM', 'LV', 'RV'].includes(d.pos)).sort((a, b) => dfn(b) - dfn(a))[0];
    }
    if (out && inn) this.substitute(t, out.id, inn.id);
  }

  // Touchline shout: temporary tactical push for ~10 match minutes, then back to the previous plan.
  shout(t, key) {
    const T = this.teams[t];
    const SH = {
      druck: { mentality: 0.2, tempo: 0.2, pressing: 0.15 }, ruhe: { tempo: -0.25, directness: -0.25, mentality: -0.1 },
      pressing: { pressing: 0.3, line: 0.15 }, dicht: { mentality: -0.3, line: -0.2, compactness: 0.2, pressing: -0.15 },
      fluegel: { width: 0.3, directness: 0.1 }, konter: { directness: 0.3, tempo: 0.25, line: -0.15 },
    };
    if (!SH[key]) return false;
    const base = T.shout ? T.shout.base : { ...T.tactic };
    const tac = { ...base };
    for (const [k, v] of Object.entries(SH[key])) tac[k] = Math.min(1, Math.max(0, (tac[k] ?? 0.5) + v));
    this.setTactic(t, { ...tac, formation: T.formation });
    T.shout = { key, base, until: this.simTime + 600 };
    // encouragement lifts the players a little, but intense shouts cost energy
    for (const p of T.players) if (!p.offPitch && (key === 'druck' || key === 'pressing')) p.energy = Math.max(0.2, p.energy - 0.01);
    return true;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e) { for (const fn of this.listeners) fn(e); }

  dirOf(t) { const base = t === 0 ? 1 : -1; return this.half === 1 ? base : -base; }

  minute() {
    if (this.half === 1) return Math.min(45, Math.floor(this.time / 60) + 1);
    return Math.min(90, Math.floor(this.time / 60) + 1);
  }
  clockText() {
    const t = this.time;
    if (this.half === 1 && t >= 2700) return `45+${Math.floor((t - 2700) / 60) + 1}'`;
    if (this.half === 2 && t >= 5400) return `90+${Math.floor((t - 5400) / 60) + 1}'`;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  minuteText() {
    const t = this.time;
    if (this.half === 1 && t >= 2700) return `45+${Math.floor((t - 2700) / 60) + 1}'`;
    if (this.half === 2 && t >= 5400) return `90+${Math.floor((t - 5400) / 60) + 1}'`;
    return `${Math.floor(t / 60) + 1}'`;
  }

  d(k) { this.dbg[k] = (this.dbg[k] || 0) + 1; }

  addEvent(type, team, player, text, extra = {}) {
    const e = { type, team, side: team === 0 ? 'h' : team === 1 ? 'a' : null, player: player?.id ?? player ?? null,
      name: player?.data ? player.data.lastName : null, minute: this.minute(), minuteText: this.minuteText(), text, ...extra };
    this.events.push(e);
    this.emit(e);
    return e;
  }

  allPlayers() { return this.teams[0].players.concat(this.teams[1].players); }

  // ------------------------------------------------------------------
  step(dt = C.SIM_DT) {
    if (this.phase === 'halftime' || this.phase === 'fulltime') return;
    this.simTime += dt;
    this.time += dt * C.CLOCK_FACTOR;
    const limit = this.half === 1 ? 2700 + this.addedTime[0] : 5400 + this.addedTime[1];
    if (this.time >= limit && this.phase !== 'goal') {
      if (this.phase === 'setpiece' || Math.abs(this.ball.pos.x) < 32 || this.time > limit + 100) { this.endHalf(); return; }
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) { this.aiTimer += C.AI_DT; think(this); }

    const b = this.ball;
    for (const T of this.teams) for (const p of T.players) {
      if (p.offPitch) continue;
      p.update(dt);
      const ac = p.action;
      if (ac && ac.kick && !ac.done && ac.t >= ac.release) {
        ac.done = true;
        if (b.owner === p) this.releaseKick(p, ac);
        p.setKick = false;
      }
      if (p.isGK && p.diveQueued && this.simTime >= p.diveQueued.at && !(p.action && p.action.type === 'dive')) this.startDive(p);
      if (p.injured && p.injuryTimer > 0) { p.injuryTimer -= dt; if (p.injuryTimer <= 0 && !p.mustLeave) p.injured = false; }
    }
    this.separate();

    if (b.owner) this.carryBall(dt); else b.update(dt);

    if (this.phase === 'play') {
      if (!b.owner) { this.gkSaves(); if (this.phase === 'play' && !b.owner) this.contacts(); }
      this.checkGoalOrOut();
      const pt = b.owner ? b.owner.team : this.lastTouch.team;
      if (pt != null) this.possession[pt] += dt;
      for (const T of this.teams) if (T.shout && this.simTime > T.shout.until) { this.setTactic(T.idx, { ...T.shout.base, formation: T.formation }); T.shout = null; }
      this.trackT = (this.trackT || 0) + dt;
      if (this.trackT >= 1) { this.trackT = 0; this.track(); }
      this.coachT = (this.coachT || 0) + dt;
      if (this.coachT >= 20) { this.coachT = 0; if (!globalThis.__noCoach) this.coachThink(); }
    } else if (this.phase === 'setpiece') this.updateSetPiece(dt);
    else if (this.phase === 'goal') {
      this.goalTimer -= dt;
      const G = this.goalInfo, V = G.var;
      G.elapsed += dt;
      if (V && V.stage === 0 && G.elapsed > 2.2) { V.stage = 1; this.addEvent('var', G.team, null, `📺 VAR-Check: Das Tor wird überprüft (${V.reason}?) …`, { checking: true }); }
      if (V && V.stage === 1 && G.elapsed > 6.5) {
        V.stage = 2;
        if (V.overturn) {
          const T = this.teams[G.team];
          T.score--;
          if (G.scorerP) { G.scorerP.stats.goals--; G.scorerP.rating -= 1.0; }
          if (G.assist) G.assist.rating -= 0.6;
          if (G.ev) { G.ev.type = 'nogoal'; G.ev.text = `${G.ev.text} – vom VAR aberkannt (${V.reason})`; }
          this.addEvent('var', G.team, null, `❌ Kein Tor! Nach Videobeweis aberkannt: ${V.reason}. Es steht ${this.teams[0].score}:${this.teams[1].score}.`, { overturned: true, score: [this.teams[0].score, this.teams[1].score] });
          // restart with a free kick / goal kick for the defending side
          const side = toWorld(this, 1 - G.team, -HALF_L, 0).x > 0 ? 1 : -1;
          this.phase = 'play';
          this.startSetPiece('goalkick', 1 - G.team, { x: side * (HALF_L - 5.5), z: 5 });
          return;
        }
        this.addEvent('var', G.team, null, '✅ Das Tor zählt! Der VAR bestätigt die Entscheidung.', { confirmed: true });
      }
      if (this.goalTimer <= 0) this.startKickoff(1 - this.goalInfo.team, true);
    }
  }

  separate() {
    const ps = this.allPlayers().filter((p) => !p.offPitch);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j];
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.5 && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (0.707 - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        a.pos.x -= nx * push; a.pos.z -= nz * push; c.pos.x += nx * push; c.pos.z += nz * push;
      }
    }
  }

  carryBall(dt) {
    const b = this.ball, p = b.owner;
    if (p.offPitch || p.leaving || p.sentOff || (p.injured && !p.setKick)) { this.looseBall(p, 1); return; }
    const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
    if (p.setKick && !p.held) { b.vel.x = b.vel.y = b.vel.z = 0; return; }
    if (p.held) {
      const throwing = p.action && p.action.type === 'throw';
      b.pos.x = p.pos.x + fx * (throwing ? -0.05 : 0.32); b.pos.z = p.pos.z + fz * (throwing ? -0.05 : 0.32);
      b.pos.y = throwing ? p.height + 0.25 : 1.05;
      b.vel.x = p.vel.x; b.vel.z = p.vel.z; b.vel.y = 0;
      return;
    }
    p.dribblePhase = (p.dribblePhase || 0) + dt * (2 + p.speed * 1.3);
    const off = 0.42 + 0.22 * Math.max(0, Math.sin(p.dribblePhase)) + p.speed * 0.03;
    const tx = p.pos.x + fx * off, tz = p.pos.z + fz * off;
    const k = Math.min(1, dt * 14);
    b.pos.x += (tx - b.pos.x) * k; b.pos.z += (tz - b.pos.z) * k; b.pos.y = BALL_R;
    b.vel.x = p.vel.x; b.vel.z = p.vel.z; b.vel.y = 0;
    if (Math.abs(b.pos.z) > HALF_W + BALL_R + 0.05 || Math.abs(b.pos.x) > HALF_L + BALL_R + 0.05) this.looseBall(p, p.speed + 1);
  }

  looseBall(p, speed) {
    const b = this.ball;
    b.owner = null;
    if (p) { p.held = false; b.vel.x = Math.cos(p.facing) * speed; b.vel.z = Math.sin(p.facing) * speed; b.vel.y = 0; p.touchCooldown = 0.3; }
  }

  touch(p) {
    this.lastTouch = { team: p.team, player: p };
    const h = this.touchHistory;
    if (!h.length || h[h.length - 1].p !== p) h.push({ p, t: this.simTime });
    if (h.length > 6) h.shift();
  }

  gainPossession(p, held = false) {
    const b = this.ball;
    b.owner = p; p.held = held; p.holdTime = 0;
    b.vel.x = b.vel.y = b.vel.z = 0; b.spin.x = b.spin.y = b.spin.z = 0;
    p.decisionTimer = 0.1 + this.rng.next() * 0.15;
    this.touch(p);
    this.pass = null; this.shot = null;
  }

  // ------------------------------------------------------------------ kicking
  kick(p, vx, vy, vz, spin = null) {
    const b = this.ball;
    b.owner = null; p.held = false;
    b.vel.x = vx; b.vel.y = vy; b.vel.z = vz;
    b.spin.x = spin?.x || 0; b.spin.y = spin?.y || 0; b.spin.z = spin?.z || 0;
    if (b.pos.y < BALL_R) b.pos.y = BALL_R;
    p.touchCooldown = 0.32;
    this.kickTime = this.simTime;
    this.touch(p);
  }

  pressureFactor(pr) { return clamp((2.6 - (pr ?? 9)) / 2.6, 0, 1); }

  computeOffside(t) {
    const line = offsideLine(this, t);
    const set = new Set();
    for (const q of this.teams[t].active) {
      const l = toLocal(this, t, q.pos.x, q.pos.z);
      if (l.x > 0 && l.x > line + 0.5) set.add(q.id);
    }
    return set;
  }

  releaseKick(p, ac) {
    const kind = ac.kind || ac.type;
    if (ac.type === 'shot') this.shoot(p, ac.pressure, false, ac.penalty);
    else if (kind === 'pass') {
      const blk = this.laneBlocked(p, ac.tx, ac.tz);
      if (blk) {
        const d = Math.hypot(ac.tx - p.pos.x, ac.tz - p.pos.z);
        if (blk.s > 2.2 && blk.s < 6 && d > 8 && p.a.technik > 45) { this.d('chip'); this.passLofted(p, ac.tx, ac.tz, ac.receiver, 'chip', ac.pressure); }
        else if (!p.setKickType) { this.d('abort'); p.action = null; p.decisionTimer = 0; return; }
        else this.passGround(p, ac.tx, ac.tz, ac.receiver, ac.pressure);
      } else this.passGround(p, ac.tx, ac.tz, ac.receiver, ac.pressure);
    }
    else if (kind === 'longpass' || kind === 'cross' || kind === 'throw' || kind === 'goalkick' || kind === 'chip') this.passLofted(p, ac.tx, ac.tz, ac.receiver, kind, ac.pressure);
    p.holdTime = 0;
  }

  laneBlocked(p, tx, tz) {
    const b = this.ball, dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    let best = null;
    for (const o of this.teams[1 - p.team].active) {
      const rx = o.pos.x - b.pos.x, rz = o.pos.z - b.pos.z;
      const s = rx * ux + rz * uz;
      if (s < 0 || s > Math.min(d, 9)) continue;
      const lat = Math.abs(rx * uz - rz * ux);
      if (lat < 0.95 && (!best || s < best.s)) best = { o, s };
    }
    return best;
  }

  passGround(p, tx, tz, receiver, pressure) {
    const b = this.ball, a = p.a, rng = this.rng;
    const d = Math.hypot(tx - b.pos.x, tz - b.pos.z);
    const vEnd = clamp(4 + d * 0.3, 5, 14);
    const v0 = Math.min(solveRollSpeed(d, vEnd), 30);
    const err = (0.016 + (100 - a.passspiel) * 0.0011 + (100 - a.technik) * 0.0003) * (1 + this.pressureFactor(pressure) * 1.2) * (1 + (1 - p.energy) * 0.5);
    const ang = Math.atan2(tz - b.pos.z, tx - b.pos.x) + rng.normal(0, err);
    const v = v0 * (1 + rng.normal(0, err * 0.5));
    this.registerPass(p, receiver, tx, tz);
    this.kick(p, Math.cos(ang) * v, 0, Math.sin(ang) * v);
  }

  passLofted(p, tx, tz, receiver, kind, pressure) {
    const b = this.ball, a = p.a, rng = this.rng;
    if (kind === 'throw') { b.pos.y = Math.max(b.pos.y, 2.0); b.pos.z = clamp(b.pos.z, -HALF_W + 0.15, HALF_W - 0.15); }
    const d = Math.max(3, Math.hypot(tx - b.pos.x, tz - b.pos.z));
    let theta = kind === 'cross' ? 0.4 + rng.range(-0.05, 0.08) : kind === 'throw' ? 0.5 : kind === 'chip' ? 0.78 : d > 40 ? 0.62 : 0.52;
    let v = Math.sqrt((d * G) / Math.sin(2 * theta)) * (1 + 0.0034 * d);
    if (kind === 'throw') v = Math.min(v, 16);
    const skill = kind === 'cross' ? (a.passspiel + a.technik) / 2 : kind === 'goalkick' ? (a.abschlag ?? a.passspiel) : a.passspiel;
    const err = (0.028 + (100 - skill) * 0.0013) * (1 + this.pressureFactor(pressure));
    const ang = Math.atan2(tz - b.pos.z, tx - b.pos.x) + rng.normal(0, err);
    v *= 1 + rng.normal(0, err * 0.7);
    const vh = v * Math.cos(theta), vy = v * Math.sin(theta);
    const vx = Math.cos(ang) * vh, vz = Math.sin(ang) * vh;
    let spin = null;
    if (kind === 'cross') {
      const g = toWorld(this, p.team, HALF_L, 0);
      const sgn = Math.sign(vz * (g.x - b.pos.x) - vx * (g.z - b.pos.z)) || 1;
      spin = { x: 0, y: sgn * rng.range(12, 24), z: 0 };
    }
    this.registerPass(p, receiver, tx, tz);
    this.kick(p, vx, vy, vz, spin);
  }

  registerPass(p, receiver, tx, tz) {
    this.d('reg_' + (p.setKickType || (p.action ? p.action.type : 'none')));
    const T = this.teams[p.team];
    T.stats.passes++; p.stats.passes++;
    const noOffside = p.setKickType === 'throw' || p.setKickType === 'goalkick' || p.setKickType === 'corner';
    this.pass = { team: p.team, from: p, to: receiver || null, tx, tz, offside: noOffside ? new Set() : this.computeOffside(p.team), t: this.simTime };
    this.pass.kind = p.setKickType || (p.action ? p.action.type : 'none');
    p.setKickType = null;
    this.shot = null;
  }

  shoot(p, pressure, header = false, penalty = false) {
    const b = this.ball, a = p.a, rng = this.rng, t = p.team, T = this.teams[t];
    const opp = this.teams[1 - t];
    const gk = opp.active.find((q) => q.isGK);
    const gkL = gk ? toLocal(this, t, gk.pos.x, gk.pos.z) : { x: HALF_L, z: 0 };
    let side = gkL.z > 0.2 ? -1 : gkL.z < -0.2 ? 1 : (rng.chance(0.5) ? 1 : -1);
    if (rng.chance(0.25)) side = -side;
    const zt = side * (GOAL_HW - rng.range(0.3, 1.2));
    let yt = rng.chance(0.55) ? rng.range(0.15, 0.6) : rng.range(0.8, 2.05);
    if (header) yt = rng.range(0.2, 1.6);
    const bl = toLocal(this, t, b.pos.x, b.pos.z);
    const dist = Math.hypot(HALF_L - bl.x, zt - bl.z);
    let v = header ? 9 + a.kopfball * 0.075 : 18.5 + a.schusskraft * 0.145;
    if (dist < 13 && !header) v *= 0.88;
    if (penalty) v = 21 + a.schusskraft * 0.08;
    const w = toWorld(this, t, HALF_L + 0.3, zt);
    const dx = w.x - b.pos.x, dz = w.z - b.pos.z, dh = Math.hypot(dx, dz);
    const th = dh / (v * (1 - 0.004 * dh));
    const vy = (yt - b.pos.y + 0.5 * G * th * th) / th;
    const skill = header ? a.kopfball : a.abschluss;
    let err = 0.02 + (100 - skill) * 0.0011 + this.pressureFactor(pressure) * 0.035 + (1 - p.energy) * 0.02 + Math.max(0, dist - 18) * 0.0015;
    if (penalty) err = 0.008 + (100 - a.abschluss) * 0.0006;
    const ang = Math.atan2(dz, dx) + rng.normal(0, err);
    const vh = v * (1 + rng.normal(0, 0.03));
    this.kick(p, Math.cos(ang) * vh, vy + rng.normal(0, err * v * 0.7), Math.sin(ang) * vh, { x: 0, y: rng.range(-8, 8), z: 0 });
    const xg = penalty ? 0.76 : shotXg(bl.x, bl.z) * (header ? 0.6 : 1);
    this.shot = { team: t, player: p, t0: this.simTime, xg };
    this.shot.entry = { x: bl.x, z: bl.z, xg, goal: false, name: p.data.lastName, min: this.minute() };
    T.analysis.shots.push(this.shot.entry);
    this.pass = null;
    T.stats.shots++; T.stats.xg += xg; p.stats.shots++;
    // on target?
    const pred = predictBall(b, 2.5, 0.05);
    const cross = pred.find((s) => Math.abs(s.x) >= HALF_L);
    if (cross && Math.abs(cross.z) < GOAL_HW && cross.y < GOAL_H) { T.stats.onTarget++; p.rating += 0.12; this.shot.onTarget = true; }
    this.emit({ type: 'shot', team: t, player: p.id });
  }

  header(p) {
    const b = this.ball, t = p.team;
    const l = toLocal(this, t, p.pos.x, p.pos.z);
    // spectacular variants: diving header for low balls, bicycle kick with the back to goal (v2.0)
    const by = b.pos.y, toGoal = Math.atan2(toWorld(this, t, HALF_L, 0).z - p.pos.z, toWorld(this, t, HALF_L, 0).x - p.pos.x);
    const backToGoal = Math.abs(Math.atan2(Math.sin(toGoal - p.facing), Math.cos(toGoal - p.facing))) > 1.9;
    const style = l.x > 34 && by > 1.15 && backToGoal && this.rng.chance(0.55) ? 'bicycle' : by < 1.05 && l.x > 30 && this.rng.chance(0.6) ? 'diving' : null;
    p.startAction('header', style ? 0.85 : 0.6, style ? { style } : {});
    if (style === 'bicycle') p.facing = toGoal;
    this.touch(p);
    if (l.x > 36 && Math.abs(l.z) < 14) { this.shoot(p, 3, true); return; }
    if (l.x < -15) {
      const w = toWorld(this, t, Math.min(l.x + 28, 40), clamp(l.z * 1.4, -30, 30));
      const dx = w.x - b.pos.x, dz = w.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      const v = 11 + p.a.kopfball * 0.06;
      this.kick(p, (dx / d) * v * 0.8, v * 0.55, (dz / d) * v * 0.8);
      this.pass = null; this.shot = null;
      return;
    }
    // header pass to nearest team-mate
    let best = null, bd = 1e9;
    for (const q of this.teams[t].active) {
      if (q === p) continue;
      const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
      if (d > 4 && d < 25 && d < bd) { bd = d; best = q; }
    }
    if (best) {
      const dx = best.pos.x - b.pos.x, dz = best.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      const v = Math.min(14, 5 + d * 0.6);
      this.registerPass(p, best, best.pos.x, best.pos.z);
      this.kick(p, (dx / d) * v, 1.5, (dz / d) * v);
    }
    else this.kick(p, b.vel.x * -0.4, 3, b.vel.z * -0.4);
  }

  // ------------------------------------------------------------------ contacts
  contacts() {
    const b = this.ball;
    let best = null, bs = 1e9;
    for (const T of this.teams) for (const p of T.active) {
      if (p.touchCooldown > 0 || p.stun > 0.25 || p.injured) continue;
      if (p.action && p.action.type === 'dive') continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      const hands = p.isGK && inOwnBox(this, p.team, b.pos);
      const maxH = hands ? 2.75 : p.height + 0.5;
      const reach = hands ? 1.1 : (p.action && p.action.type === 'slide' ? 1.45 : b.pos.y < 0.5 ? 1.0 : 0.8);
      if (d < reach && b.pos.y < maxH) {
        const hs = Math.hypot(b.vel.x, b.vel.z);
        if (hs > 3) {
          // ball only hits players that are actually in its path shortly after a kick
          const ahead = ((p.pos.x - b.pos.x) * b.vel.x + (p.pos.z - b.pos.z) * b.vel.z) / hs;
          if (this.simTime - (this.kickTime || -9) < 0.3 && ahead < 0.15) continue;
          // team-mates let a pass run to the intended receiver
          if (this.pass && this.pass.team === p.team && this.pass.to && this.pass.to !== p && !this.pass.to.offPitch && hs > 5 && this.simTime - this.pass.t < 2.5) continue;
        }
        let s = d + (b.pos.y > 1.3 ? (100 - p.a.kopfball - p.a.sprungkraft * 0.5) * 0.004 : 0);
        if (this.pass && this.pass.to === p) s -= 0.35;
        if (s < bs) { bs = s; best = p; }
      }
    }
    if (best) this.receive(best);
  }

  receive(p) {
    const b = this.ball, T = this.teams[p.team], rng = this.rng;
    if (this.pass && this.pass.team === p.team && this.pass.from !== p && this.pass.offside.has(p.id)) { this.d(this.pass.to === p ? 'offInt' : 'offOther'); this.offside(p); return; }
    if (this.pass && this.pass.from !== p) {
      this.d((this.pass.team === p.team ? 'ok_' : 'int_') + (this.pass.kind || 'x'));
      if (this.pass.team === p.team) { T.stats.passesOk++; this.pass.from.stats.passesOk++; this.pass.from.rating += 0.015; const k = `${this.pass.from.id}>${p.id}`; T.analysis.links[k] = (T.analysis.links[k] || 0) + 1; }
      else this.pass.from.rating -= 0.04;
    }
    const rel = Math.hypot(b.vel.x - p.vel.x, b.vel.y, b.vel.z - p.vel.z);
    if (p.isGK && inOwnBox(this, p.team, b.pos)) {
      const pc = clamp(0.6 + p.a.fangen / 230 - rel / 48 - (b.pos.y > 2.2 ? 0.15 : 0), 0.15, 0.98);
      if (rng.chance(pc)) { this.gainPossession(p, true); p.startAction('catch', 0.5); return; }
      this.parry(p);
      return;
    }
    const chest = b.pos.y > 1.0 && b.pos.y < 1.75 && !(toLocal(this, p.team, p.pos.x, p.pos.z).x > 34 && this.lastTouch.team === p.team);
    if (b.pos.y > 1.0 && !chest) { this.header(p); return; }
    const skill = (p.a.ballkontrolle * 0.7 + p.a.technik * 0.3) / 100;
    const pc = clamp(0.74 + skill * 0.3 - rel / 80 - (b.pos.y > 0.4 ? 0.1 : 0) + (this.pass && this.pass.to === p ? 0.06 : 0), 0.15, 0.985);
    if (rng.chance(pc)) {
      this.gainPossession(p);
      p.startAction('control', 0.3);
    } else {
      this.touch(p); this.d('ctrlFail');
      const ang = rng.range(0, Math.PI * 2), s = rng.range(1, 4);
      b.vel.x = b.vel.x * 0.3 + Math.cos(ang) * s; b.vel.z = b.vel.z * 0.3 + Math.sin(ang) * s;
      b.vel.y = Math.abs(b.vel.y) * 0.3 + rng.range(0, 1.5);
      p.touchCooldown = 0.45;
      this.pass = null; this.shot = null;
    }
  }

  parry(gk) {
    const b = this.ball, rng = this.rng;
    this.touch(gk);
    const away = this.dirOf(gk.team);
    const side = Math.sign(b.pos.z - gk.pos.z) || rng.pick([-1, 1]);
    if (rng.chance(0.4)) { // tipped wide / over the bar -> usually a corner
      b.vel.x = -away * rng.range(0.5, 3); b.vel.z = side * rng.range(5, 9); b.vel.y = rng.range(2, 5);
    } else {
      b.vel.x = Math.abs(b.vel.x) * rng.range(0.15, 0.35) * away;
      b.vel.z = side * rng.range(3, 9);
      b.vel.y = rng.range(1, 4.5);
    }
    gk.touchCooldown = 0.7;
    this.pass = null; this.shot = null;
  }

  startDive(gk) {
    const q = gk.diveQueued; gk.diveQueued = null;
    if (!q) return;
    if (q.need < 0.7 && q.y < 2.0) { gk.startAction('set', 0.6); return; }
    const sp = 3.8 + gk.a.reflexe * 0.032;
    gk.startAction('dive', 1.2, { dir: q.dir, high: q.y > 1.3, world: true });
    gk.vel.z = q.dir * sp; gk.vel.x *= 0.3;
    gk.target.x = gk.pos.x; gk.target.z = gk.pos.z + q.dir * 3;
  }

  gkSaves() {
    const b = this.ball;
    for (const T of this.teams) {
      const gk = T.active.find((p) => p.isGK);
      if (!gk || gk.touchCooldown > 0) continue;
      const vxL = b.vel.x * this.dirOf(T.idx);
      if (vxL > -4) continue;
      const bl = toLocal(this, T.idx, b.pos.x, b.pos.z), gl = toLocal(this, T.idx, gk.pos.x, gk.pos.z);
      const dx = bl.x - gl.x;
      if (dx > 0.5 || dx < -0.7) continue;
      const diving = gk.action && gk.action.type === 'dive';
      const lat = Math.abs(b.pos.z - gk.pos.z);
      const reachLat = diving ? 0.45 + gk.height * 0.5 : 0.6;
      const reachUp = diving ? (gk.action.high ? 2.5 : 1.6) : gk.height + 0.5;
      if (lat < reachLat && b.pos.y < reachUp) {
        const speed = b.speed();
        if (this.rng.chance(0.04 + Math.max(0, speed - 24) * 0.01)) { gk.touchCooldown = 0.5; continue; } // fumble
        this.touch(gk);
        const shooter = this.shot?.player;
        T.stats.saves++; gk.stats.saves++; gk.rating += 0.35;
        const pc = clamp(0.18 + gk.a.fangen / 140 - speed / 55, 0.05, 0.85);
        if (this.rng.chance(pc)) { this.gainPossession(gk, true); if (!diving) gk.startAction('catch', 0.5); }
        else this.parry(gk);
        this.addEvent('save', T.idx, gk, `Parade von ${gk.data.lastName}${shooter ? ` gegen ${shooter.data.lastName}` : ''}!`);
      }
    }
  }

  // ------------------------------------------------------------------ tackles / fouls
  tryTackle(def, carrier, isGK = false, slide = false) {
    if (carrier.setKick || carrier.held || this.ball.owner !== carrier || def.stun > 0) return;
    this.d('tackle');
    const rng = this.rng, a = def.a, c = carrier.a;
    def.tackleCooldown = slide ? 2.2 : 1.1;
    const d = Math.hypot(def.pos.x - carrier.pos.x, def.pos.z - carrier.pos.z);
    if (slide) {
      def.startAction('slide', 0.95);
      const dx = this.ball.pos.x - def.pos.x, dz = this.ball.pos.z - def.pos.z, dl = Math.hypot(dx, dz) || 1;
      def.vel.x = (dx / dl) * 7.5; def.vel.z = (dz / dl) * 7.5;
      def.facing = Math.atan2(dz, dx);
    } else def.startAction(isGK ? 'dive' : 'tackle', isGK ? 0.9 : 0.45, isGK ? { dir: 1, high: false } : {});
    let p = 0.36 + (a.tackling - c.dribbling) / 140 + (a.kraft - c.kraft) / 400 + (slide ? 0.06 : 0) - (d > 1.4 ? 0.08 : 0);
    if (isGK) p = 0.45 + (a.herauslaufen - c.dribbling) / 150;
    p = clamp(p * (0.85 + 0.15 * def.energy), 0.08, 0.85);
    const fx = Math.cos(carrier.facing), fz = Math.sin(carrier.facing);
    const behind = (def.pos.x - carrier.pos.x) * fx + (def.pos.z - carrier.pos.z) * fz < -0.4;
    const foulP = (slide ? 0.17 : 0.07) + (behind ? 0.12 : 0) + (100 - (isGK ? a.herauslaufen : a.tackling)) / 1000 + (isGK ? 0.08 : 0);
    const T = this.teams[def.team];
    if (rng.chance(p)) {
      if (rng.chance(foulP * 0.3)) { this.foul(def, carrier, slide, behind); return; }
      def.stats.tackles++; def.rating += 0.1; T.stats.tackles++; this.d('tackleWon');
      carrier.stun = 0.45; carrier.touchCooldown = 0.5;
      if (!slide && !isGK && rng.chance(0.55)) { this.gainPossession(def); }
      else if (isGK && rng.chance(0.6)) { this.gainPossession(def, inOwnBox(this, def.team, this.ball.pos)); }
      else {
        const b = this.ball; b.owner = null;
        const ang = def.facing + rng.range(-0.9, 0.9), s = rng.range(3, 8);
        b.vel.x = Math.cos(ang) * s; b.vel.z = Math.sin(ang) * s; b.vel.y = rng.range(0, 1.5);
        this.touch(def); def.touchCooldown = 0.25;
        this.pass = null;
      }
    } else if (rng.chance(foulP)) this.foul(def, carrier, slide, behind);
    else { def.stun = slide ? 1.3 : 0.6; carrier.rating += 0.05; }
  }

  foul(def, victim, slide, behind) {
    const rng = this.rng, T = this.teams[def.team];
    T.stats.fouls++;
    const spot = { x: clamp(victim.pos.x, -HALF_L + 0.5, HALF_L - 0.5), z: clamp(victim.pos.z, -HALF_W + 0.5, HALF_W - 0.5) };
    this.ball.owner = null;
    this.addEvent('foul', def.team, def, `Foul von ${def.data.lastName} an ${victim.data.lastName}`);
    const vl = toLocal(this, victim.team, spot.x, spot.z);
    const lastMan = vl.x > 20 && Math.abs(vl.z) < 20 && this.teams[def.team].active.filter((q) => !q.isGK && toLocal(this, victim.team, q.pos.x, q.pos.z).x > vl.x).length === 0;
    if (lastMan && rng.chance(0.15)) this.card(def, 'red');
    else if (rng.chance(0.004 + (slide && behind ? 0.015 : 0))) this.card(def, 'red');
    else if (rng.chance((slide ? 0.2 : 0.06) + (behind ? 0.1 : 0))) this.card(def, 'yellow');
    if (rng.chance(0.035)) {
      const weeks = rng.chance(0.4) ? 0 : rng.int(1, 6);
      victim.injured = true; victim.injuryTimer = 4; victim.mustLeave = weeks >= 2;
      victim.injuryWeeks = weeks;
      victim.startAction('injured', 4);
      this.addEvent('injury', victim.team, victim, `${victim.data.lastName} ist verletzt${weeks >= 2 ? ` (ca. ${weeks} Wochen)` : ''}`, { weeks: Math.max(weeks, 0) });
      if (weeks < 2) victim.energy = Math.max(0.3, victim.energy - 0.15);
    }
    def.rating -= 0.1;
    if (inOwnBox(this, def.team, spot)) {
      const ps = toWorld(this, victim.team, HALF_L - C.PEN_SPOT, 0);
      this.startSetPiece('penalty', victim.team, ps);
      this.addEvent('penalty', victim.team, victim, `Elfmeter für ${this.teams[victim.team].club.short}!`);
    } else {
      const direct = vl.x > 20 && Math.abs(vl.z) < 22 && Math.hypot(HALF_L - vl.x, vl.z) < 32;
      this.startSetPiece('freekick', victim.team, spot, { direct });
    }
  }

  card(p, color) {
    const T = this.teams[p.team];
    if (color === 'yellow') {
      p.yellow++; T.stats.yellow++; p.rating -= 0.4;
      this.addEvent('yellow', p.team, p, `Gelbe Karte für ${p.data.lastName}`);
      if (p.yellow >= 2) { this.addEvent('red', p.team, p, `Gelb-Rot für ${p.data.lastName}!`); this.sendOff(p); }
    } else {
      this.addEvent('red', p.team, p, `Rote Karte für ${p.data.lastName}!`);
      this.sendOff(p);
    }
  }

  sendOff(p) {
    const T = this.teams[p.team];
    T.stats.red++; p.sentOff = true; p.leaving = true; p.rating -= 1.2;
    p.startAction('frustrate', 3);
    if (this.ball.owner === p) this.ball.owner = null;
  }

  offside(p) {
    const T = this.teams[p.team];
    T.stats.offsides++;
    this.addEvent('offside', p.team, p, `Abseits: ${p.data.lastName}`);
    this.startSetPiece('freekick', 1 - p.team, { x: p.pos.x, z: clamp(p.pos.z, -HALF_W + 1, HALF_W - 1) }, { direct: false });
  }

  // ------------------------------------------------------------------ goals / out of play
  checkGoalOrOut() {
    const b = this.ball;
    if (b.owner) return;
    if ((Math.abs(b.pos.x) > HALF_L + BALL_R || Math.abs(b.pos.z) > HALF_W + BALL_R) && this.pass) this.d('passOut');
    if (Math.abs(b.pos.x) > HALF_L + BALL_R) {
      const side = Math.sign(b.pos.x);
      const scorer = this.dirOf(0) === side ? 0 : 1;
      if (Math.abs(b.pos.z) < GOAL_HW && b.pos.y < GOAL_H) { this.goal(scorer); return; }
      const defT = 1 - scorer;
      if (this.lastTouch.team === defT) {
        this.teams[scorer].stats.corners++;
        this.startSetPiece('corner', scorer, { x: side * (HALF_L - 0.3), z: Math.sign(b.pos.z || 1) * (HALF_W - 0.3) });
      } else {
        this.startSetPiece('goalkick', defT, { x: side * (HALF_L - 5.5), z: Math.sign(b.pos.z || 1) * 5 });
      }
      if (this.shot) this.addEvent('miss', this.shot.team, this.shot.player, `${this.shot.player.data.lastName} verfehlt das Tor`);
      this.shot = null;
    } else if (Math.abs(b.pos.z) > HALF_W + BALL_R) {
      const t = this.lastTouch.team == null ? 0 : 1 - this.lastTouch.team;
      this.startSetPiece('throw', t, { x: clamp(b.pos.x, -HALF_L + 1, HALF_L - 1), z: Math.sign(b.pos.z) * HALF_W });
    }
  }

  goal(t) {
    const T = this.teams[t];
    T.score++;
    const lt = this.lastTouch.player;
    const own = !lt || lt.team !== t;
    let assist = null;
    if (!own) {
      const h = this.touchHistory;
      for (let i = h.length - 2; i >= 0; i--) {
        if (h[i].p === lt) continue;
        if (h[i].p.team === t && this.simTime - h[i].t < 8) assist = h[i].p;
        break;
      }
      lt.stats.goals++; lt.rating += 1.0;
      if (assist) assist.rating += 0.6;
    }
    for (const p of this.teams[1 - t].players) if (!p.offPitch && (p.isGK || ['IV', 'LV', 'RV'].includes(p.role))) p.rating -= 0.25;
    const scorerName = own ? (lt ? `${lt.data.lastName} (Eigentor)` : 'Eigentor') : lt.data.lastName;
    this.addEvent('goal', t, own ? null : lt, `TOR für ${T.club.short}! ${scorerName}${assist ? ` (Vorlage ${assist.data.lastName})` : ''}`,
      { assist: assist?.id ?? null, own, ownPlayer: own && lt ? lt.id : null, score: [this.teams[0].score, this.teams[1].score] });
    if (own && lt) this.events[this.events.length - 1].player = null;
    this.phase = 'goal';
    this.goalTimer = 4.8;
    this.goalInfo = { team: t, scorerP: own ? null : lt, ev: this.events[this.events.length - 1], assist, elapsed: 0, style: this.rng.pick(['knieslide', 'airplane', 'jump', 'salute', 'backflip', 'shush', 'heart', 'knieslide', 'airplane']) };
    // VAR (v1.0): some goals are checked, a few of them are disallowed
    if (!own && this.rng.chance(this.varRate ?? 0.12)) {
      this.goalInfo.var = { overturn: this.rng.chance(0.38), reason: this.rng.pick(['Abseits', 'Handspiel', 'Foulspiel im Vorfeld']), stage: 0 };
      this.goalTimer = 9;
    }
    if (this.shot?.entry && this.shot.team === t) this.shot.entry.goal = true;
    this.pass = null; this.shot = null;
  }

  // ------------------------------------------------------------------ set pieces
  startKickoff(t, teleport) {
    this.phase = 'setpiece';
    this.ball.owner = null;
    this.ball.place(0, 0);
    this.pass = null; this.shot = null;
    for (const T of this.teams) T.active = T.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff);
    for (const T of this.teams) for (const p of T.players) { if (p.leaving) p.offPitch = true; }
    if (teleport) {
      for (const T of this.teams) {
        for (const p of T.active) {
          const [, sx, sz] = T.slots[p.slotIndex];
          let lx = p.isGK ? -HALF_L + 1 : lerp(-34, -6, sx), lz = p.isGK ? 0 : sz * 22;
          if (T.idx !== t && Math.hypot(lx, lz) < 9.8) { const k = 9.8 / (Math.hypot(lx, lz) || 1); lx *= k; lz *= k; lx = Math.min(lx, -1); }
          const w = toWorld(this, T.idx, lx, lz);
          p.pos.x = w.x; p.pos.z = w.z; p.vel.x = p.vel.z = 0; p.target.x = w.x; p.target.z = w.z;
          p.facing = this.dirOf(T.idx) > 0 ? 0 : Math.PI;
          p.action = null; p.held = false; p.stun = 0; p.runTimer = 0; p.diveQueued = null;
        }
      }
    }
    const T = this.teams[t];
    const fw = T.active.filter((p) => !p.isGK).sort((a, b) => T.slots[b.slotIndex][1] - T.slots[a.slotIndex][1]);
    const taker = fw[0], second = fw[1];
    if (taker) { const w = toWorld(this, t, -0.6, 0); taker.pos.x = w.x; taker.pos.z = w.z; }
    if (second) { const w = toWorld(this, t, -2.5, 3); second.pos.x = w.x; second.pos.z = w.z; }
    this.setPiece = { type: 'kickoff', team: t, spot: { x: 0, z: 0 }, timer: 0, taker, receiver: second };
    if (taker) taker.atSpot = true;
  }

  startSetPiece(type, team, spot, extra = {}) {
    const b = this.ball, T = this.teams[team];
    this.phase = 'setpiece';
    b.owner = null;
    for (const p of this.allPlayers()) { p.held = false; p.inWall = false; p.runTimer = 0; p.diveQueued = null; p.setKick = false; }
    const bz = type === 'throw' ? Math.sign(spot.z) * (HALF_W - 0.1) : spot.z;
    b.place(spot.x, bz, type === 'throw' ? 0.11 : BALL_R);
    this.pass = null; this.shot = null;
    for (const X of this.teams) X.active = X.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff);
    const cand = T.active.filter((p) => !p.isGK && !p.injured);
    const d = (p) => Math.hypot(p.pos.x - spot.x, p.pos.z - spot.z);
    let taker;
    // designated set-piece takers from the tactics screen (v1.0)
    const SPx = T.tactic.setPieces || {};
    const pick = (id) => cand.find((p) => p.id === id);
    const fixed = type === 'corner' ? pick(SPx.corner) : type === 'penalty' ? pick(SPx.penalty) : type === 'freekick' && extra.direct ? pick(SPx.freekick) : null;
    if (type === 'goalkick') taker = T.active.find((p) => p.isGK) || cand[0];
    else if (type === 'corner') taker = cand.sort((a, b) => d(a) - d(b)).slice(0, 4).sort((a, b) => (b.a.passspiel + b.a.technik) - (a.a.passspiel + a.a.technik))[0];
    else if (type === 'penalty') taker = cand.sort((a, b) => (b.a.abschluss + b.a.schusskraft * 0.3) - (a.a.abschluss + a.a.schusskraft * 0.3))[0];
    else if (type === 'freekick' && extra.direct) taker = cand.sort((a, b) => (b.a.abschluss + b.a.schusskraft + b.a.technik) - (a.a.abschluss + a.a.schusskraft + a.a.technik))[0];
    else taker = cand.sort((a, b) => d(a) - d(b))[0];
    if (fixed) taker = fixed;
    this.setPiece = { type, team, spot: { x: spot.x, z: bz }, timer: 0, taker, ...extra };
    if (taker) taker.atSpot = false;
    // substitutions happen during stoppages
    for (const X of this.teams) if (X.idx !== this.userTeam || this.autoSubsUser) this.aiSubs(X.idx);
    for (const X of this.teams) for (const p of X.active) if (p.injured && p.mustLeave && X.idx === this.userTeam && !this.autoSubsUser) this.aiSubs(X.idx, true);
  }

  updateSetPiece(dt) {
    const sp = this.setPiece; if (!sp) return;
    sp.timer += dt;
    const b = this.ball;
    b.vel.x = b.vel.y = b.vel.z = 0;
    const injuredDelay = this.allPlayers().some((p) => p.injured && p.injuryTimer > 0) ? 3 : 0;
    const tk = sp.taker;
    if (!tk || tk.offPitch || tk.leaving) { sp.taker = this.teams[sp.team].active.find((p) => !p.isGK) || null; return; }
    if (sp.timer < (SETPIECE_DELAY[sp.type] || 2) + injuredDelay) return;
    if (!tk.atSpot && sp.timer < 6) return;
    if (!tk.atSpot) { tk.pos.x = tk.target.x; tk.pos.z = tk.target.z; }
    this.executeSetPiece();
  }

  executeSetPiece() {
    const sp = this.setPiece, tk = sp.taker, T = this.teams[sp.team], rng = this.rng, b = this.ball;
    this.setPiece = null;
    this.phase = 'play';
    for (const p of this.allPlayers()) p.inWall = false;
    const mates = T.active.filter((q) => q !== tk && !q.injured);
    const opp = this.teams[1 - sp.team].active;
    const openness = (q) => { let m = 20; for (const o of opp) m = Math.min(m, Math.hypot(o.pos.x - q.pos.x, o.pos.z - q.pos.z)); return m; };
    b.owner = tk; tk.setKick = true; tk.held = sp.type === 'throw'; tk.setKickType = sp.type;
    this.touch(tk);
    const g = toWorld(this, sp.team, HALF_L, 0);
    const doKick = (type, q, tx, tz, extra = {}) => {
      tk.faceTarget = { x: tx, z: tz };
      tk.facing = Math.atan2(tz - tk.pos.z, tx - tk.pos.x);
      tk.startAction(type === 'goalkick' ? 'longpass' : type, type === 'throw' ? 0.6 : 0.45, { kick: true, release: type === 'throw' ? 0.35 : 0.22, done: false, receiver: q, tx, tz, pressure: 9, kind: type, ...extra });
    };
    if (sp.type === 'kickoff') {
      const q = sp.receiver && !sp.receiver.offPitch ? sp.receiver : mates.filter((m) => !m.isGK).sort((a, c) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(c.pos.x, c.pos.z))[0];
      // play it back to a midfielder
      const back = mates.filter((m) => !m.isGK && toLocal(this, sp.team, m.pos.x, m.pos.z).x < -6).sort((a, c) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(c.pos.x, c.pos.z))[0] || q;
      doKick('pass', back, back.pos.x, back.pos.z);
    } else if (sp.type === 'throw') {
      const cands = mates.filter((q) => !q.isGK && Math.hypot(q.pos.x - tk.pos.x, q.pos.z - tk.pos.z) < 24);
      const q = cands.sort((a, c) => openness(c) - openness(a))[0] || mates[0];
      doKick('throw', q, q.pos.x, q.pos.z);
    } else if (sp.type === 'corner') {
      const routine = T.tactic.setPieces?.cornerRoutine || 'mix';
      const side = Math.sign(toLocal(this, sp.team, sp.spot.x, sp.spot.z).z) || 1;
      const short = mates.filter((q) => !q.isGK && Math.hypot(q.pos.x - tk.pos.x, q.pos.z - tk.pos.z) < 16).sort((a, c) => openness(c) - openness(a))[0];
      if (routine === 'kurz' && short) { doKick('pass', short, short.pos.x, short.pos.z); return; }
      let box = mates.filter((q) => { const l = toLocal(this, sp.team, q.pos.x, q.pos.z); return l.x > 36 && Math.abs(l.z) < 14; });
      if (routine === 'nah' || routine === 'fern') {
        const zone = box.filter((q) => { const lz = toLocal(this, sp.team, q.pos.x, q.pos.z).z; return routine === 'nah' ? lz * side > -1 : lz * side < 1; });
        if (zone.length) box = zone;
      }
      const q = box.sort((a, c) => (c.a.kopfball + c.height * 20 + rng.range(0, 25)) - (a.a.kopfball + a.height * 20 + rng.range(0, 25)))[0] || mates[0];
      doKick('cross', q, q.pos.x, q.pos.z);
    } else if (sp.type === 'goalkick') {
      const long = rng.chance(0.35 + T.tactic.directness * 0.5);
      if (long) {
        const fw = mates.filter((q) => toLocal(this, sp.team, q.pos.x, q.pos.z).x > -5).sort((a, c) => (c.a.kopfball + c.a.kraft) - (a.a.kopfball + a.a.kraft))[0] || mates[0];
        doKick('goalkick', fw, fw.pos.x, fw.pos.z);
      } else {
        const cb = mates.filter((q) => ['IV', 'LV', 'RV', 'DM'].includes(q.role)).sort((a, c) => openness(c) - openness(a))[0] || mates[0];
        doKick('pass', cb, cb.pos.x, cb.pos.z);
      }
    } else if (sp.type === 'freekick') {
      if (sp.direct) { tk.faceTarget = g; tk.startAction('shot', 0.5, { kick: true, release: 0.25, done: false, pressure: 9 }); }
      else { tk.setKick = false; b.owner = null; this.gainPossession(tk); }
    } else if (sp.type === 'penalty') {
      const gk = opp.find((q) => q.isGK);
      if (gk) gk.diveQueued = { locked: true, at: this.simTime + 0.32, dir: rng.pick([-1, 1]), need: rng.chance(0.2) ? 0 : 1.8, y: rng.range(0.3, 1.5) };
      tk.faceTarget = g;
      tk.startAction('shot', 0.55, { kick: true, release: 0.3, done: false, pressure: 9, penalty: true });
    }
  }

  // ------------------------------------------------------------------ substitutions
  substitute(t, outId, inId) {
    const T = this.teams[t];
    if (T.subsLeft <= 0 || !T.bench.includes(inId)) return false;
    const out = T.players.find((p) => p.id === outId && !p.offPitch && !p.leaving && !p.sentOff);
    if (!out) return false;
    const np = new SimPlayer(this.db[inId], t, out.slotIndex, out.role);
    np.pos.x = t === 0 ? -4 : 4; np.pos.z = HALF_W + 0.8;
    np.target.x = np.pos.x; np.target.z = HALF_W - 2;
    np.minuteIn = this.minute();
    out.leaving = true; out.subbedOff = true; out.minuteOut = this.minute();
    if (this.ball.owner === out) this.ball.owner = null;
    T.players.push(np);
    T.bench = T.bench.filter((id) => id !== inId);
    T.subsLeft--;
    this.addEvent('sub', t, np, `Wechsel ${T.club.short}: ${np.data.lastName} für ${out.data.lastName}`, { out: out.id });
    return true;
  }

  aiSubs(t, injuredOnly = false) {
    const T = this.teams[t];
    if (T.subsLeft <= 0 || !T.bench.length) return;
    const min = this.time / 60;
    const pool = T.players.filter((p) => !p.offPitch && !p.leaving && !p.sentOff);
    let outs = pool.filter((p) => p.injured && p.mustLeave);
    if (!injuredOnly && min >= 58) outs = outs.concat(pool.filter((p) => !p.isGK && p.energy < 0.6 && !outs.includes(p)).sort((a, b) => a.energy - b.energy).slice(0, 1));
    if (!injuredOnly && min >= 70 && T.subsLeft > 2 && this.rng.chance(0.3)) {
      const weakest = pool.filter((p) => !p.isGK && !outs.includes(p)).sort((a, b) => a.rating - b.rating)[0];
      if (weakest && weakest.rating < 6.2) outs.push(weakest);
    }
    for (const out of outs.slice(0, 2)) {
      if (T.subsLeft <= 0) break;
      const bench = T.bench.map((id) => this.db[id]).filter((p) => p && (out.isGK ? p.pos === 'TW' : p.pos !== 'TW'));
      if (!bench.length) continue;
      bench.sort((a, b) => effectiveRating(b, out.role) - effectiveRating(a, out.role));
      this.substitute(t, out.id, bench[0].id);
    }
  }

  // ------------------------------------------------------------------ flow control
  endHalf() {
    if (this.half === 1) {
      this.phase = 'halftime';
      this.ball.owner = null;
      this.addEvent('halftime', null, null, `Halbzeit: ${this.teams[0].score}:${this.teams[1].score}`);
    } else {
      this.phase = 'fulltime';
      this.addEvent('fulltime', null, null, `Abpfiff: ${this.teams[0].score}:${this.teams[1].score}`);
    }
  }

  resume() {
    if (this.phase !== 'halftime') return;
    this.half = 2; this.time = 2700;
    for (const T of this.teams) for (const p of T.players) p.energy = Math.min(1, p.energy + 0.08);
    this.startKickoff(1 - this.firstKickoff, true);
    this.addEvent('kickoff2', null, null, 'Anpfiff zur zweiten Halbzeit');
  }

  isHighlight() {
    if (this.phase === 'goal' || this.phase === 'halftime' || this.phase === 'fulltime') return true;
    if (this.shot && this.simTime - this.shot.t0 < 2.5) return true;
    const sp = this.setPiece;
    if (sp && (sp.type === 'penalty' || sp.type === 'corner' || (sp.type === 'freekick' && sp.direct))) return true;
    const b = this.ball;
    const t = b.owner ? b.owner.team : this.lastTouch.team;
    if (t == null) return false;
    return toLocal(this, t, b.pos.x, b.pos.z).x > 28;
  }

  // Runs the match without rendering. Returns true when finished.
  runSteps(n) {
    for (let i = 0; i < n; i++) {
      if (this.phase === 'halftime') this.resume();
      if (this.phase === 'fulltime') return true;
      this.step(C.SIM_DT);
    }
    return this.phase === 'fulltime';
  }

  result() {
    const sideOf = (t) => (t === 0 ? 'h' : 'a');
    const events = this.events.filter((e) => ['goal', 'yellow', 'red', 'injury'].includes(e.type)).map((e) => ({
      type: e.type, side: e.side, player: e.player, assist: e.assist ?? null, minute: e.minute, weeks: e.weeks, own: e.own,
    }));
    const fitness = {}, played = { h: [], a: [] }, ratings = {};
    for (const T of this.teams) for (const p of T.players) {
      fitness[p.id] = Math.round(p.energy * 100);
      played[sideOf(T.idx)].push(p.id);
      ratings[p.id] = Math.round(clamp(p.rating, 3, 10) * 10) / 10;
    }
    const total = this.possession[0] + this.possession[1] || 1;
    return {
      hg: this.teams[0].score, ag: this.teams[1].score, events, fitness, played, ratings,
      stats: this.teams.map((T) => ({ ...T.stats, possession: Math.round((this.possession[T.idx] / total) * 100) })),
    };
  }
}
