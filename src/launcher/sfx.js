// Launcher sounds, synthesised with Web Audio (no audio files): hover tick, click, kick-off whistle + crowd swell.
let ctx = null, master = null, enabled = true;
const ac = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
const noiseBuf = (c, sec) => { const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };

export function setSfx(on) { enabled = on; }
export function setVolume(v) { if (master) master.gain.value = v; }

export function tick() {
  if (!enabled) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1900, c.currentTime); o.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.04);
  g.gain.setValueAtTime(0.05, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.06);
}
export function click() {
  if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g).connect(master); o.start(t); o.stop(t + 0.18);
}
/** Kick-off: referee whistle (two short + one long) over a swelling crowd roar. */
export function kickoff() {
  if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime;
  const crowd = c.createBufferSource(); crowd.buffer = noiseBuf(c, 3.5);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t + 1.6);
  const cg = c.createGain(); cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.5, t + 1.3); cg.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
  crowd.connect(bp).connect(lp).connect(cg).connect(master); crowd.start(t);
  const blow = (start, dur) => {
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 38; lg.gain.value = 140; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(0.16, start + 0.02); g.gain.setValueAtTime(0.16, start + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(master); o.start(start); lfo.start(start); o.stop(start + dur + 0.02); lfo.stop(start + dur + 0.02);
  };
  blow(t + 0.05, 0.14); blow(t + 0.28, 0.14); blow(t + 0.52, 0.75);
}
