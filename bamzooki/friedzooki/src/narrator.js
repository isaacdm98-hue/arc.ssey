// The Narrator — mystical on-screen text paired with a cute Banjo-Kazooie-style
// gibberish "voice": short pitched blips, synthesized with Web Audio. NO network,
// NO localStorage at load (lazy + guarded), so it can never block or crash boot.
let _ctx = null;
let _enabled = null;          // lazy
let _captionEl = null;
let _hideTimer = null;

function ac() {
  if (!_ctx) { try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { _ctx = false; } }
  if (_ctx && _ctx.state === "suspended") _ctx.resume();
  return _ctx || null;
}
function readEnabled() {
  if (_enabled === null) { try { _enabled = localStorage.getItem("friedzooki.voice") !== "off"; } catch (_) { _enabled = true; } }
  return _enabled;
}
function caption() {
  if (!_captionEl) _captionEl = document.getElementById("narration");
  return _captionEl;
}

// One cute pluck — two detuned oscillators with a fast decay (banjo-ish).
function blip(freq, t0, dur) {
  const a = ac(); if (!a) return;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(a.destination);
  for (const [type, det, gain] of [["triangle", 0, 1], ["sine", 7, 0.6]]) {
    const o = a.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq + det, t0);
    o.frequency.linearRampToValueAtTime(freq * 1.04 + det, t0 + dur * 0.6);
    const gg = a.createGain(); gg.gain.value = gain;
    o.connect(gg).connect(g);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
}

// Turn a line into a friendly run of pitched syllable-blips.
function speakGibberish(text) {
  const a = ac(); if (!a) return;
  const sylls = (text.toLowerCase().match(/[aeiouy]+|[^aeiouy\s]+|\s+/g) || []).filter((s) => s.trim());
  const base = 300, span = 360;
  let t = a.currentTime + 0.02;
  const step = 0.085;
  const max = Math.min(sylls.length, 26);
  for (let i = 0; i < max; i++) {
    const s = sylls[i];
    const isVowel = /[aeiouy]/.test(s[0]);
    const code = s.charCodeAt(0) || 100;
    const semis = (code % 9);                       // pitch picked from the letter
    const freq = base + (semis / 9) * span + (isVowel ? 40 : 0);
    blip(freq, t, isVowel ? 0.13 : 0.07);
    t += step + (isVowel ? 0.02 : 0);
  }
}

function showCaption(text) {
  const el = caption(); if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => el.classList.remove("show"), Math.min(7000, 1800 + text.length * 55));
}

export const narrator = {
  get enabled() { return readEnabled(); },
  toggle() {
    _enabled = !readEnabled();
    try { localStorage.setItem("friedzooki.voice", _enabled ? "on" : "off"); } catch (_) {}
    return _enabled;
  },
  stop() {},
  say(text) {
    if (!text) return;
    showCaption(text);                 // mystical text always shows
    if (readEnabled()) { try { speakGibberish(text); } catch (_) {} }
  },
};
