// Tiny Web Audio sound kit — all synthesized, no asset files. Gives the menus
// a tactile, papery feel: pops, clicks, whooshes, a countdown beep and a win
// jingle. Audio is created lazily on first user gesture (mobile autoplay rules).
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = "sine", gain = 0.18, slideTo = null, delay = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap()    { tone(420, 0.08, { type: "triangle", gain: 0.12 }); },
  pop()    { tone(300, 0.12, { type: "sine", slideTo: 620, gain: 0.16 }); },
  back()   { tone(360, 0.1, { type: "triangle", slideTo: 220, gain: 0.12 }); },
  slide()  { tone(680, 0.04, { type: "sine", gain: 0.05 }); },
  whoosh() { tone(180, 0.22, { type: "sawtooth", slideTo: 520, gain: 0.07 }); },
  beep()   { tone(540, 0.14, { type: "square", gain: 0.13 }); },
  go()     { tone(720, 0.32, { type: "square", slideTo: 980, gain: 0.16 }); },
  save()   { tone(523, 0.1, { type: "sine" }); tone(784, 0.16, { type: "sine", delay: 0.09 }); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: "triangle", gain: 0.16, delay: i * 0.11 })); },
  lose()   { tone(330, 0.3, { type: "sawtooth", slideTo: 160, gain: 0.12 }); },
};

export function toggleMute() { muted = !muted; return muted; }
export function isMuted() { return muted; }
export function primeAudio() { ac(); }
