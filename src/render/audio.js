// Stadium sound (v2.0) – everything synthesised live with the Web Audio API, no audio files:
// crowd bed that breathes with the game, chants with clapping, goal roar with air horns, "uuuh" on
// near misses, whistles & boos, referee whistle, ball contacts – plus a stadium announcer and an
// optional TV commentator via the browser's speech synthesis.
let ctx = null;

export class StadiumAudio {
  constructor({ volume = 0.7, announcer = true, commentary = false, homeName = '', awayName = '' } = {}) {
    this.enabled = volume > 0;
    this.vol = volume; this.announcer = announcer; this.commentary = commentary;
    this.home = homeName; this.away = awayName;
    this.tension = 0; this.level = 0.35; this.nextChant = 8; this.t = 0; this.lastKick = 0;
    if (!this.enabled) return;
    try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; return; }
    if (ctx.state === 'suspended') ctx.resume();
    this.master = ctx.createGain(); this.master.gain.value = volume; this.master.connect(ctx.destination);
    this.noiseBuf = makeNoise(4);
    this.brownBuf = makeNoise(4, true);
    // crowd bed: brown + band-passed noise, slowly modulated
    this.bed = this.loop(this.brownBuf);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
    this.bedGain = ctx.createGain(); this.bedGain.gain.value = 0.0;
    this.bed.connect(bp).connect(this.bedGain).connect(this.master);
    const hiss = this.loop(this.noiseBuf);
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = 0.7;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    hiss.connect(hp).connect(this.hissGain).connect(this.master);
    this.bedGain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 2);
    this.voice = pickVoice();
  }

  loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

  // ---------- one-shot sounds ----------
  noiseBurst({ dur = 0.5, f = 1000, q = 1, gain = 0.5, attack = 0.01, type = 'bandpass', at = 0 }) {
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(fl).connect(g).connect(this.master); s.start(t0, Math.random() * 3); s.stop(t0 + dur + 0.05);
    return { g, fl };
  }
  tone({ f = 440, dur = 0.3, gain = 0.2, type = 'sine', at = 0, vib = 0, slide = 0 }) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.linearRampToValueAtTime(f + slide, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.015); g.gain.setValueAtTime(gain, t0 + dur * 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
    if (vib) { const l = ctx.createOscillator(); l.frequency.value = vib; const lg = ctx.createGain(); lg.gain.value = f * 0.025; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur); }
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  whistle(kind = 'short') {
    if (!this.enabled) return;
    const n = kind === 'end' ? 3 : kind === 'double' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const long = kind === 'end' && i === 2;
      this.tone({ f: 2950, dur: long ? 1.1 : 0.32, gain: 0.13, type: 'sine', at: i * 0.45, vib: 32 });
      this.tone({ f: 3550, dur: long ? 1.1 : 0.32, gain: 0.05, type: 'sine', at: i * 0.45, vib: 32 });
    }
  }
  kick(strength = 1) {
    if (!this.enabled) return;
    this.tone({ f: 115, dur: 0.09, gain: 0.18 * strength, type: 'sine', slide: -50 });
    this.noiseBurst({ dur: 0.05, f: 1800, q: 0.8, gain: 0.08 * strength });
  }
  // a crowd choir: detuned saw voices through vowel formants
  choir(notes, { vowel = 'o', beat = 0.42, gain = 0.06, at = 0 } = {}) {
    const F = { o: [500, 900], a: [750, 1200], u: [350, 800], e: [450, 1900] }[vowel];
    const t0 = ctx.currentTime + at;
    const out = ctx.createGain(); out.gain.value = gain;
    for (const ff of F) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = 4; out.connect(b).connect(this.master); }
    for (let v = 0; v < 7; v++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const g = ctx.createGain(); g.gain.value = 0;
      const det = (Math.random() - 0.5) * 26;
      let t = t0 + Math.random() * 0.05;
      for (const [semi, len] of notes) {
        const f = 196 * Math.pow(2, semi / 12) * (v % 3 === 0 ? 0.5 : 1);
        o.frequency.setValueAtTime(f, t); o.detune.setValueAtTime(det, t);
        g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.06); g.gain.setValueAtTime(0.5, t + len * beat - 0.07); g.gain.linearRampToValueAtTime(0.0, t + len * beat);
        t += len * beat;
      }
      o.connect(g).connect(out); o.start(t0); o.stop(t + 0.1);
    }
  }
  claps(times, at = 0, gain = 0.35) { for (const t of times) for (let k = 0; k < 3; k++) this.noiseBurst({ dur: 0.09, f: 1500 + Math.random() * 600, q: 1.2, gain: gain / 2, at: at + t + k * 0.012 }); }

  chant() {
    const r = Math.random();
    if (r < 0.35) { // "Olé, olé olé olé"
      this.choir([[0, 1], [4, 2], [0, 1], [4, 1], [7, 1], [4, 2]], { vowel: 'e', gain: 0.07 });
    } else if (r < 0.65) { // clapping rhythm with "hey"
      this.claps([0, 0.4, 0.8, 1.6, 2.0, 2.4, 3.2, 3.6, 4.0]);
      this.noiseBurst({ dur: 0.5, f: 900, q: 1.4, gain: 0.35, at: 4.8, attack: 0.03 });
    } else { // long sung chant with a stepping melody
      this.choir([[0, 2], [2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 3]], { vowel: 'o', gain: 0.075, beat: 0.5 });
      this.claps([0, 1, 2, 3, 4, 5], 0, 0.15);
    }
  }
  goal(home) {
    if (!this.enabled) return;
    const big = home ? 1 : 0.45;
    this.noiseBurst({ dur: 7, f: 700, q: 0.4, gain: 0.85 * big, attack: 0.35 });
    this.noiseBurst({ dur: 6, f: 2400, q: 0.6, gain: 0.35 * big, attack: 0.4 });
    for (let i = 0; i < 4; i++) this.tone({ f: 233 + (i % 2) * 2, dur: 0.9, gain: 0.07 * big, type: 'sawtooth', at: 0.6 + i * 1.1 }); // air horns
    if (home) setTimeout(() => this.enabled && this.choir([[0, 1], [0, 1], [4, 2], [7, 3]], { vowel: 'a', gain: 0.09, beat: 0.45 }), 3500);
  }
  miss() { if (this.enabled) { this.noiseBurst({ dur: 1.6, f: 420, q: 1.6, gain: 0.5, attack: 0.25 }); this.tone({ f: 260, dur: 1.2, gain: 0.03, type: 'sawtooth', slide: -80 }); } }
  boo() { if (!this.enabled) return; for (let i = 0; i < 9; i++) this.tone({ f: 1800 + Math.random() * 2200, dur: 1.2 + Math.random(), gain: 0.012, type: 'sine', at: Math.random() * 0.4, vib: 6 }); this.noiseBurst({ dur: 1.8, f: 280, q: 2, gain: 0.25, attack: 0.3 }); }
  applause() { if (!this.enabled) return; for (let i = 0; i < 40; i++) this.noiseBurst({ dur: 0.08, f: 1400 + Math.random() * 1200, q: 1, gain: 0.08, at: Math.random() * 2.5 }); }

  say(text, { rate = 1, pitch = 1, volume = 1 } = {}) {
    if (!this.enabled || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; if (this.voice) u.voice = this.voice;
    u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, volume * this.vol * 1.3);
    window.speechSynthesis.speak(u);
  }
  announce(text) { if (this.announcer) this.say(text, { rate: 0.92, pitch: 0.9 }); }
  comment(text) { if (this.commentary && window.speechSynthesis && !window.speechSynthesis.speaking) this.say(text, { rate: 1.08, pitch: 1.05, volume: 0.9 }); }

  // ---------- continuous update ----------
  update(dt, E) {
    if (!this.enabled || !E) return;
    this.t += dt;
    // tension: ball close to a goal and moving forward
    const b = E.ball.pos, near = Math.max(0, 1 - (52.5 - Math.abs(b.x)) / 35);
    this.tension += ((near * 0.9 + (E.phase === 'setpiece' ? 0.2 : 0)) - this.tension) * Math.min(1, dt * 1.5);
    const target = E.phase === 'halftime' || E.phase === 'fulltime' ? 0.18 : 0.26 + this.tension * 0.35;
    this.bedGain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    this.hissGain.gain.setTargetAtTime(0.02 + this.tension * 0.08, ctx.currentTime, 0.4);
    // chants when the game is calm
    this.nextChant -= dt;
    if (this.nextChant <= 0 && E.phase === 'play') { if (this.tension < 0.5) this.chant(); this.nextChant = 14 + Math.random() * 20; }
    // ball contacts from velocity changes
    const v = E.ball.vel, sp = Math.hypot(v.x, v.y, v.z);
    if (this.prevSp != null && sp - this.prevSp > 5 && this.t - this.lastKick > 0.15) { this.kick(Math.min(1.2, (sp - this.prevSp) / 18)); this.lastKick = this.t; }
    this.prevSp = sp;
  }

  onEvent(e, E) {
    if (!this.enabled) return;
    const home = e.team === 0;
    switch (e.type) {
      case 'goal': {
        this.goal(home);
        const p = E.teams[e.team].players.find((q) => q.id === e.player);
        if (p && home) setTimeout(() => this.announce(`Tor für ${this.home}! Torschütze mit der Nummer ${p.data.number}: ${p.data.firstName} ... ${p.data.lastName}!`), 2600);
        break;
      }
      case 'miss': this.miss(); break;
      case 'save': this.applause(); break;
      case 'foul': this.whistle('short'); if (e.team === 1) this.boo(); break;
      case 'yellow': case 'red': if (e.team === 1) this.applause(); else this.boo(); break;
      case 'offside': this.whistle('short'); break;
      case 'halftime': this.whistle('double'); setTimeout(() => this.applause(), 1200); break;
      case 'fulltime': this.whistle('end'); setTimeout(() => this.applause(), 2500); break;
      case 'kickoff2': this.whistle('short'); break;
      case 'penalty': this.whistle('short'); this.noiseBurst({ dur: 2.5, f: 600, q: 0.6, gain: 0.55, attack: 0.2 }); break;
      case 'sub': if (home) { const p = E.teams[0].players.find((q) => q.id === e.player); if (p && e.text) this.announce(`Auswechslung bei ${this.home}.`); } break;
      case 'var': if (e.overturned) { if (home) this.boo(); else this.goal(true); } break;
      default: break;
    }
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  dispose() {
    if (!this.enabled) return;
    this.enabled = false;
    try { this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(() => { try { this.master.disconnect(); } catch {} }, 800); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  }
}

function makeNoise(sec, brown = false) {
  const n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices?.() || [];
  return vs.find((v) => v.lang?.startsWith('de') && /male|Stefan|Markus|Conrad|Killian/i.test(v.name)) || vs.find((v) => v.lang?.startsWith('de')) || null;
}
