// The two sounds the game hangs on (dossier §06):
// THUNK — deep, wet, final. A door closing on something.
// CRACK — ice fracturing under a thumb. High, sharp, intimate.
// All synthesized; no assets.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let lastClack = 0;

const NOISE_DUR = 0.5;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Master bus: gain + limiter so stacked impacts breathe instead of clipping. */
function bus(c: AudioContext): AudioNode {
  if (!master) {
    master = c.createGain();
    master.gain.value = 0.75;
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -12;
    limit.knee.value = 6;
    limit.ratio.value = 12;
    limit.attack.value = 0.002;
    limit.release.value = 0.12;
    master.connect(limit).connect(c.destination);
  }
  return master;
}

export function unlockAudio() { ac(); }

/** One shared noise buffer; each voice plays a random slice of it. */
function noiseSrc(c: AudioContext, dur: number): AudioBufferSourceNode {
  if (!noise) {
    noise = c.createBuffer(1, Math.ceil(c.sampleRate * NOISE_DUR), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  (src as AudioBufferSourceNode & { sliceOffset?: number }).sliceOffset =
    Math.random() * Math.max(0, NOISE_DUR - dur);
  return src;
}

function startSlice(src: AudioBufferSourceNode, t: number, dur: number) {
  const off = (src as AudioBufferSourceNode & { sliceOffset?: number }).sliceOffset ?? 0;
  src.start(t, off, dur);
}

/** Ball-ball contact click, throttled, gain by impact 0..1 */
export function clack(impact: number) {
  const c = ac(); const t = c.currentTime;
  if (t - lastClack < 0.03) return;
  lastClack = t;
  const src = noiseSrc(c, 0.04);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(Math.min(0.5, 0.08 + impact * 0.4), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(bp).connect(g).connect(bus(c)); startSlice(src, t, 0.04);
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
  o.connect(g).connect(bus(c)); o.start(t); o.stop(t + 0.32);
  const src = noiseSrc(c, 0.12);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(lp).connect(ng).connect(bus(c)); startSlice(src, t, 0.12);
}

/** Taking damage. The dread note. */
export function crackSnap() {
  const c = ac(); const t = c.currentTime;
  const src = noiseSrc(c, 0.09);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(hp).connect(g).connect(bus(c)); startSlice(src, t, 0.09);
  const o = c.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
  const og = c.createGain();
  og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(og).connect(bus(c)); o.start(t); o.stop(t + 0.08);
}

/** Launch whoosh */
export function whoosh(power: number) {
  const c = ac(); const t = c.currentTime;
  const src = noiseSrc(c, 0.25);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1400 + power * 1200, t + 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 + power * 0.15, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  src.connect(bp).connect(g).connect(bus(c)); startSlice(src, t, 0.25);
}

/** Scratch — the pocket takes you. A long fall, not an explosion. */
export function scratchSound() {
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.45);
  const og = c.createGain();
  og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(og).connect(bus(c)); o.start(t); o.stop(t + 0.52);
  const src = noiseSrc(c, 0.3);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, t);
  lp.frequency.exponentialRampToValueAtTime(150, t + 0.3);
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  src.connect(lp).connect(g).connect(bus(c)); startSlice(src, t, 0.3);
}

/** Shatter — the worse scratch */
export function shatterSound() {
  const c = ac(); const t = c.currentTime;
  for (let i = 0; i < 5; i++) {
    const dt = i * 0.035;
    const src = noiseSrc(c, 0.08);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200 + i * 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.35 - i * 0.05, t + dt);
    g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.1);
    src.connect(hp).connect(g).connect(bus(c)); startSlice(src, t + dt, 0.08);
  }
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(og).connect(bus(c)); o.start(t); o.stop(t + 0.6);
}

/** UI blip */
export function blip() {
  const c = ac(); const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 660;
  const g = c.createGain();
  g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g).connect(bus(c)); o.start(t); o.stop(t + 0.08);
}
