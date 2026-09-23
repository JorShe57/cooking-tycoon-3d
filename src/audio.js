// Tiny WebAudio synth for game feedback. No audio files needed.
let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.08) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

const SOUNDS = {
  pick: () => tone(520, 0.08, { type: 'triangle', slide: 200 }),
  place: () => tone(330, 0.09, { type: 'triangle', slide: -80 }),
  chop: () => { noise(0.05, 0.12); tone(180, 0.05, { type: 'square', vol: 0.05 }); },
  sizzle: () => noise(0.35, 0.05),
  ding: () => { tone(1320, 0.35, { vol: 0.1 }); tone(1980, 0.25, { vol: 0.05, delay: 0.02 }); },
  bell: () => tone(990, 0.3, { vol: 0.07 }),
  cash: () => { tone(880, 0.1, { type: 'square', vol: 0.05 }); tone(1320, 0.18, { type: 'square', vol: 0.05, delay: 0.08 }); },
  fail: () => tone(220, 0.35, { type: 'sawtooth', vol: 0.07, slide: -100 }),
  trash: () => noise(0.15, 0.1),
  tap: () => tone(700, 0.04, { type: 'triangle', vol: 0.04 }),
  fry: () => { noise(0.5, 0.06); tone(160, 0.2, { type: 'sine', vol: 0.03 }); },
  wash: () => { noise(0.12, 0.05); tone(600, 0.08, { type: 'sine', vol: 0.03, slide: 300 }); },
  whistle: () => { tone(1500, 0.15, { vol: 0.06 }); tone(1200, 0.2, { vol: 0.06, delay: 0.16 }); },
  buy: () => { tone(660, 0.07, { type: 'square', vol: 0.04 }); tone(990, 0.12, { type: 'square', vol: 0.04, delay: 0.06 }); },
  error: () => tone(200, 0.12, { type: 'square', vol: 0.05 }),
};

export function sfx(name) {
  SOUNDS[name]?.();
}
