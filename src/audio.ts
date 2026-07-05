// The two sounds the game hangs on (dossier §06):
// THUNK — deep, wet, final. A door closing on something.
// CRACK — ice fracturing under a thumb. High, sharp, intimate.
// All synthesized; no assets.
let ctx: AudioContext | null = null;
let lastClack = 0;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }

function noiseBuf(c: AudioContext, dur: number): AudioBuffer {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Ball-ball contact click, throttled, gain by impact 0..1 */
export function clack(impact: number) {
  const c = ac(); const t = c.currentTime;
  if (t - lastClack < 0.03) return;
  lastClack = t;
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.04);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(Math.min(0.5, 0.08 + impact * 0.4), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(bp).connect(g).connect(c.destination); src.start(t);
}

/** Sinking an enemy. Pitched low, with a half-beat of held silence built into the mix. */
export function thunk() {
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  const g = c.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.32);
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.12);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(lp).connect(ng).connect(c.destination); src.start(t);
}

/** Taking damage. The dread note. */
export function crackSnap() {
  const c = ac(); const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.09);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(hp).connect(g).connect(c.destination); src.start(t);
  const o = c.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
  const og = c.createGain();
  og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.08);
}

/** Launch whoosh */
export function whoosh(power: number) {
  const c = ac(); const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.25);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1400 + power * 1200, t + 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 + power * 0.15, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  src.connect(bp).connect(g).connect(c.destination); src.start(t);
}

/** Shatter — the worse scratch */
export function shatterSound() {
  const c = ac(); const t = c.currentTime;
  for (let i = 0; i < 5; i++) {
    const dt = i * 0.035;
    const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.08);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200 + i * 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.35 - i * 0.05, t + dt);
    g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.1);
    src.connect(hp).connect(g).connect(c.destination); src.start(t + dt);
  }
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.6);
}

/** UI blip */
export function blip() {
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 660;
  const g = c.createGain();
  g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.08);
}
