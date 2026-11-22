// Stadium sound (v2.8 – rebuilt). Still no audio files: everything is synthesised with Web Audio, but now
// the crowd is made of hundreds of individual "voices" (pitched + breathy, vowel formants, random pan)
// pre-rendered once per match into loops, everything runs through a generated stadium reverb and a
// limiter, and the referee whistle uses a pea trill. Reactions (roar, "ooh", applause, boos, clapping
// chants, drum) are layered on top of a crowd bed that follows the tension of the game.
let ctx = null;

const VOWELS = { a: [800, 1150], e: [420, 2000], o: [470, 820], u: [330, 720], i: [300, 2300], ae: [650, 1700] };
const rand = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(c, sec, ch = 1) {
  const b = c.createBuffer(ch, Math.floor(c.sampleRate * sec), c.sampleRate);
  for (let k = 0; k < ch; k++) { const d = b.getChannelData(k); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return b;
}
// stadium impulse response: early reflections off the stands, then a ~2.6 s diffuse tail
function stadiumIR(c) {
  const len = Math.floor(c.sampleRate * 2.8), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) { const t = i / c.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / 2.8, 2.2) * (t < 0.02 ? t / 0.02 : 1) * 0.5; }
    for (let r = 0; r < 14; r++) { const at = Math.floor(rand(0.03, 0.22) * c.sampleRate); d[at] += rand(-0.6, 0.6); }
  }
  return b;
}

// ---- direct DSP (fast): voices and claps are computed sample by sample in JS, in small slices so the
// main thread never blocks, and cached for the whole session (rendered once, reused by every match).
const SR = 32000;
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
function bp(f, q) { // RBJ band-pass (constant 0 dB peak gain)
  const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  return { b0: al / a0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0 };
}
function normalize(L, R, peak = 0.5) { let m = 1e-6; for (let i = 0; i < L.length; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); const k = peak / m; for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; } }
function toBuffer(L, R) { const b = new AudioBuffer({ numberOfChannels: 2, length: L.length, sampleRate: SR }); b.copyToChannel(L, 0); b.copyToChannel(R, 1); return b; }

/** Crowd made of many voices: sawtooth glottal source + breath noise through two vowel formants. */
export async function renderCrowd(sec, { voices = 420, mood = 'murmur', peak = 0.5 } = {}) {
  const N = Math.floor(sec * SR), L = new Float32Array(N), R = new Float32Array(N);
  const vowelsFor = { murmur: ['a', 'e', 'o', 'u', 'i', 'ae'], roar: ['a', 'a', 'ae', 'o'], ooh: ['u', 'o', 'u'], boo: ['u', 'u', 'o'] }[mood];
  const loop = mood === 'murmur';
  let work = 0;
  for (let v = 0; v < voices; v++) {
    const male = Math.random() < 0.82, f0 = (male ? rand(95, 165) : rand(180, 270)) * (mood === 'roar' ? 1.55 : mood === 'ooh' ? 1.2 : 1);
    const [F1, F2] = VOWELS[vowelsFor[Math.floor(Math.random() * vowelsFor.length)]];
    const c1 = bp(F1 * rand(0.92, 1.08), 5), c2 = bp(F2 * rand(0.92, 1.08), 7);
    const dur = loop ? rand(0.18, 0.9) : rand(sec * 0.55, sec * 0.95), start = loop ? rand(0, sec) : rand(0, sec * 0.25);
    const n = Math.floor(dur * SR), s0 = Math.floor(start * SR), att = Math.floor((loop ? 0.04 : rand(0.15, 0.5)) * SR), rel = Math.floor(0.22 * SR);
    const amp = (loop ? rand(0.4, 1) : rand(0.6, 1)) * (male ? 1 : 0.8), breath = mood === 'roar' ? 0.6 : 0.35;
    const pan = rand(-0.95, 0.95), gl = Math.sqrt((1 - pan) / 2), gr = Math.sqrt((1 + pan) / 2);
    const vibF = rand(4, 7) / SR, drift = rand(-0.08, 0.08);
    let ph = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      let f = f0 * (1 + drift * u + 0.02 * Math.sin(2 * Math.PI * vibF * i));
      if (mood === 'ooh') f *= u < 0.4 ? 1 + 0.12 * u / 0.4 : 1.12 - 0.27 * (u - 0.4) / 0.6;
      ph += f / SR; if (ph >= 1) ph -= 1;
      const x = (2 * ph - 1) + (Math.random() * 2 - 1) * breath;
      const a = c1.b0 * x + c1.b2 * x2 - c1.a1 * y1 - c1.a2 * y2; y2 = y1; y1 = a;
      const b = c2.b0 * x + c2.b2 * x2 - c2.a1 * z1 - c2.a2 * z2; z2 = z1; z1 = b; x2 = x1; x1 = x;
      const env = amp * (i < att ? i / att : i > n - rel ? (n - i) / rel : 1);
      const o = (a + 0.55 * b) * env, k = loop ? (s0 + i) % N : s0 + i;   // murmur wraps around → seamless loop
      if (k >= N) break;
      L[k] += o * gl; R[k] += o * gr;
    }
    work += n; if (work > 250000) { work = 0; await yieldNow(); }
  }
  normalize(L, R, peak);
  return toBuffer(L, R);
}
/** Applause: thousands of short clap transients (band-limited noise) spread over the stands. */
export async function renderApplause(sec, density = 700, peak = 0.45) {
  const N = Math.floor(sec * SR), L = new Float32Array(N), R = new Float32Array(N);
  const total = Math.floor(density * sec);
  for (let c = 0; c < total; c++) {
    const s0 = Math.floor(Math.random() * N), len = Math.floor(rand(0.025, 0.06) * SR), co = bp(rand(900, 2600), rand(0.8, 1.5));
    const pan = rand(-1, 1), gl = Math.sqrt((1 - pan) / 2), gr = Math.sqrt((1 + pan) / 2), a0 = rand(0.4, 1), dec = 6 / len;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1, y = co.b0 * x + co.b2 * x2 - co.a1 * y1 - co.a2 * y2; y2 = y1; y1 = y; x2 = x1; x1 = x;
      const o = y * a0 * Math.exp(-dec * i), k = (s0 + i) % N; L[k] += o * gl; R[k] += o * gr;
    }
    if (c % 600 === 599) await yieldNow();
  }
  normalize(L, R, peak);
  return toBuffer(L, R);
}
let CACHE = null;
/** Start rendering the crowd early (e.g. when the matchday screen opens). */
export function prefetchCrowd() { try { crowdBuffers(); } catch { /* no Web Audio */ } }
function crowdBuffers() {
  // rendered one after another (murmur first – it is needed right away); each sound is usable as soon as it is done
  if (!CACHE) {
    const murmur = renderCrowd(8, { voices: 520, mood: 'murmur', peak: 0.42 });
    const applause = murmur.then(() => renderApplause(4));
    const ooh = applause.then(() => renderCrowd(2.6, { voices: 200, mood: 'ooh', peak: 0.55 }));
    const roar = ooh.then(() => renderCrowd(5, { voices: 320, mood: 'roar', peak: 0.7 }));
    const boo = roar.then(() => renderCrowd(3, { voices: 180, mood: 'boo', peak: 0.45 }));
    CACHE = { murmur, applause, ooh, roar, boo };
  }
  return CACHE;
}

export class StadiumAudio {
  constructor({ volume = 0.7, announcer = false, commentary = false, crowd = 1, chants = true, homeName = '', awayName = '' } = {}) {
    this.crowd = crowd; this.chantsOn = chants;
    this.enabled = volume > 0;
    this.vol = volume; this.announcer = announcer; this.commentary = commentary;
    this.home = homeName; this.away = awayName;
    this.tension = 0; this.nextChant = 10; this.t = 0; this.lastKick = 0; this.lastRoar = -99;
    this.bufs = {};
    if (!this.enabled) return;
    try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; return; }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // master chain: dry + stadium reverb → limiter → speakers
    this.master = ctx.createGain(); this.master.gain.value = volume;
    this.comp = ctx.createDynamicsCompressor();
    Object.assign(this.comp, {}); this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 6; this.comp.attack.value = 0.005; this.comp.release.value = 0.25;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9;
    this.verb = ctx.createConvolver(); this.verb.buffer = stadiumIR(ctx);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.32;
    this.bus.connect(this.comp); this.bus.connect(this.verb).connect(this.wet).connect(this.comp);
    this.comp.connect(this.master).connect(ctx.destination);
    this.noiseBuf = noiseBuffer(ctx, 3);
    // simple placeholder bed until the crowd loops are rendered
    this.bedGain = ctx.createGain(); this.bedGain.gain.value = 0; this.bedGain.connect(this.bus);
    const tmp = this.loop(this.noiseBuf, this.bedGain, (s) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.4; s.connect(f); return f; });
    this.tmpBed = tmp;
    this.bedGain.gain.linearRampToValueAtTime(0.12 * crowd, ctx.currentTime + 1.5);
    this.prepare();
    this.voice = pickVoice();
  }

  loop(buf, dest, via) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const node = via ? via(s) : s; node.connect(dest); s.start(0, Math.random() * buf.duration); return s; }

  async prepare() {
    const C = crowdBuffers();
    for (const k of ['applause', 'ooh', 'roar', 'boo']) C[k].then((b) => { if (this.enabled) this.bufs[k] = b; }).catch(() => {});
    try {
      const murmur = await C.murmur;
      if (!this.enabled) return;
      this.bufs.murmur = murmur;
      // real crowd bed (two offset copies of the murmur loop so the repetition is not audible)
      this.murGain = ctx.createGain(); this.murGain.gain.value = 0; this.murGain.connect(this.bus);
      this.loop(murmur, this.murGain); const second = ctx.createBufferSource(); second.buffer = murmur; second.loop = true; second.playbackRate.value = 0.97; second.connect(this.murGain); second.start(0, 3.7);
      this.murGain.gain.linearRampToValueAtTime(0.7 * this.crowd, ctx.currentTime + 2);
      this.bedGain.gain.setTargetAtTime(0.03 * this.crowd, ctx.currentTime, 1);
    } catch { /* keep the simple bed */ }
  }

  play(buf, { gain = 1, rate = 1, attack = 0.05, dur = null, at = 0, pan = 0 } = {}) {
    if (!buf) return null;
    const t0 = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); const d = dur ?? buf.duration / rate;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.setValueAtTime(gain, t0 + Math.max(attack, d - 0.6)); g.gain.linearRampToValueAtTime(0, t0 + d);
    let node = s.connect(g); if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.bus); s.start(t0); s.stop(t0 + d + 0.05);
    return g;
  }
  noiseBurst({ dur = 0.5, f = 1000, q = 1, gain = 0.5, attack = 0.01, type = 'bandpass', at = 0, pan = 0 }) {
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    let n = s.connect(fl).connect(g); if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; n = n.connect(p); }
    n.connect(this.bus); s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05);
  }

  // ---------- referee & ball ----------
  whistle(kind = 'short') {
    if (!this.enabled) return;
    const pattern = kind === 'end' ? [[0, 0.28], [0.42, 0.28], [0.84, 1.25]] : kind === 'double' ? [[0, 0.3], [0.45, 0.55]] : [[0, 0.32]];
    for (const [at, dur] of pattern) {
      const t0 = ctx.currentTime + at;
      const out = ctx.createGain(); out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(0.09, t0 + 0.012); out.gain.setValueAtTime(0.09, t0 + dur - 0.04); out.gain.linearRampToValueAtTime(0, t0 + dur);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; out.connect(hp).connect(this.bus);
      // pea trill: amplitude + slight pitch wobble at ~28 Hz
      const am = ctx.createGain(); am.gain.value = 0.6; const trill = ctx.createOscillator(); trill.frequency.value = rand(26, 32); const tg = ctx.createGain(); tg.gain.value = 0.4; trill.connect(tg).connect(am.gain);
      for (const [f, g] of [[2860, 1], [3020, 0.55], [5900, 0.08]]) { const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; const fm = ctx.createGain(); fm.gain.value = 35; trill.connect(fm).connect(o.frequency); o.connect(og).connect(am); o.start(t0); o.stop(t0 + dur + 0.02); }
      am.connect(out); trill.start(t0); trill.stop(t0 + dur + 0.02);
      this.noiseBurst({ dur: dur * 0.9, f: 3000, q: 2, gain: 0.02, at, attack: 0.01 });
    }
  }
  kick(strength = 1) {
    if (!this.enabled) return;
    const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.09);
    g.gain.setValueAtTime(0.11 * strength, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.12);
    o.connect(g).connect(this.bus); o.start(t0); o.stop(t0 + 0.14);
    this.noiseBurst({ dur: 0.035, f: 2200, q: 0.7, gain: 0.05 * strength, type: 'lowpass' });
  }
  drum(at = 0, gain = 0.22) { // big bass drum in the curve
    const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(72, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.25);
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.45);
    const p = ctx.createStereoPanner(); p.pan.value = -0.5; o.connect(g).connect(p).connect(this.bus); o.start(t0); o.stop(t0 + 0.5);
  }
  // a stand claps together: each beat is ~60 loosely synchronised claps
  groupClap(beats, at = 0, gain = 0.03, pan = -0.4) {
    for (const b of beats) for (let k = 0; k < 26; k++) this.noiseBurst({ dur: rand(0.03, 0.06), f: rand(1000, 2400), q: 1.1, gain: gain * rand(0.5, 1), at: at + b + rand(-0.025, 0.035), pan: pan + rand(-0.35, 0.35) });
  }
  chant() {
    const r = Math.random(), pan = Math.random() < 0.5 ? -0.55 : 0.55;
    if (r < 0.45) { // "da – da – dadada" clap + drum rhythm, three rounds
      const bar = [0, 0.5, 1.0, 1.25, 1.5];
      for (let k = 0; k < 3; k++) { this.groupClap(bar, k * 2, 0.03, pan); bar.forEach((b, i) => i % 2 === 0 && this.drum(k * 2 + b, 0.16)); }
    } else if (r < 0.75) { // slow Viking-style "HUH" claps getting faster
      const times = []; let t = 0, gap = 1.6; for (let i = 0; i < 9; i++) { times.push(t); t += gap; gap *= 0.8; }
      times.forEach((tt) => { this.groupClap([tt], 0, 0.04, pan); this.drum(tt, 0.2); this.play(this.bufs.roar, { gain: 0.18, rate: 0.8, attack: 0.02, dur: 0.35, at: tt + 0.02, pan }); });
    } else { // the whole stand sings a sustained "oh-oh" swell
      this.play(this.bufs.roar, { gain: 0.32, rate: 0.62, attack: 0.8, dur: 4.5, pan });
      this.groupClap([0, 1, 2, 3, 4], 0.2, 0.02, pan);
    }
  }
  goal(home) {
    if (!this.enabled) return;
    const big = home ? 1 : 0.35;
    this.lastRoar = this.t;
    this.play(this.bufs.roar, { gain: 0.95 * big, attack: 0.25, dur: 5 });
    this.play(this.bufs.roar, { gain: 0.6 * big, rate: 0.9, attack: 0.6, dur: 4.6, at: 0.9 });
    this.noiseBurst({ dur: 4.5, f: 900, q: 0.5, gain: 0.25 * big, attack: 0.3 });
    if (home) { this.play(this.bufs.applause, { gain: 0.7, attack: 0.4, at: 3.2 }); for (let i = 0; i < 6; i++) this.drum(3.4 + i * 0.5, 0.18); }
  }
  miss() { if (this.enabled) this.play(this.bufs.ooh, { gain: 0.8, attack: 0.15 }) || this.noiseBurst({ dur: 1.6, f: 420, q: 1.6, gain: 0.3, attack: 0.25 }); }
  boo() { if (this.enabled) this.play(this.bufs.boo, { gain: 0.55, attack: 0.3, rate: rand(0.9, 1.05) }); }
  applause(g = 0.55) { if (this.enabled) this.play(this.bufs.applause, { gain: g, attack: 0.3, rate: rand(0.95, 1.05) }); }

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
    const b = E.ball.pos, near = Math.max(0, 1 - (52.5 - Math.abs(b.x)) / 35);
    this.tension += ((near * 0.9 + (E.phase === 'setpiece' ? 0.2 : 0)) - this.tension) * Math.min(1, dt * 1.2);
    const calm = E.phase === 'halftime' || E.phase === 'fulltime';
    if (this.murGain) this.murGain.gain.setTargetAtTime((calm ? 0.45 : 0.6 + this.tension * 0.55) * this.crowd, ctx.currentTime, 0.6);
    this.nextChant -= dt;
    if (this.nextChant <= 0 && E.phase === 'play') { if (this.tension < 0.45 && this.chantsOn && this.bufs.roar && this.t - this.lastRoar > 12) this.chant(); this.nextChant = rand(16, 30); }
    const v = E.ball.vel, sp = Math.hypot(v.x, v.y, v.z);
    if (this.prevSp != null && sp - this.prevSp > 6 && this.t - this.lastKick > 0.18) { this.kick(Math.min(1.2, (sp - this.prevSp) / 20)); this.lastKick = this.t; }
    this.prevSp = sp;
  }

  onEvent(e, E) {
    if (!this.enabled) return;
    const home = e.team === 0;
    switch (e.type) {
      case 'goal': {
        this.goal(home);
        const p = E.teams[e.team].players.find((q) => q.id === e.player);
        if (p && home) setTimeout(() => this.announce(`Tor für ${this.home}! Torschütze mit der Nummer ${p.data.number}: ${p.data.firstName} ... ${p.data.lastName}!`), 3200);
        break;
      }
      case 'miss': this.miss(); break;
      case 'save': this.applause(0.4); break;
      case 'foul': this.whistle('short'); if (e.team === 1) this.boo(); break;
      case 'yellow': case 'red': if (e.team === 1) this.applause(0.35); else this.boo(); break;
      case 'offside': this.whistle('short'); break;
      case 'halftime': this.whistle('double'); setTimeout(() => this.applause(0.5), 1200); break;
      case 'fulltime': this.whistle('end'); setTimeout(() => this.applause(0.7), 2300); break;
      case 'kickoff2': this.whistle('short'); break;
      case 'penalty': this.whistle('short'); this.play(this.bufs.ooh, { gain: 0.5, rate: 0.85, attack: 0.3 }); break;
      case 'sub': if (home) { this.applause(0.3); const p = E.teams[0].players.find((q) => q.id === e.player); if (p && e.text) this.announce(`Auswechslung bei ${this.home}.`); } break;
      case 'var': if (e.overturned) { if (home) this.boo(); else this.goal(true); } break;
      default: break;
    }
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  dispose() {
    if (!this.enabled) return;
    this.enabled = false;
    try { this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); const m = this.master; setTimeout(() => { try { m.disconnect(); } catch {} }, 900); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  }
}

function pickVoice() {
  try {
    const vs = window.speechSynthesis?.getVoices?.() || [];
    return vs.find((v) => /de/i.test(v.lang) && /male|stefan|markus|conrad/i.test(v.name)) || vs.find((v) => /de/i.test(v.lang)) || null;
  } catch { return null; }
}
