// The Narrator — a warm, human voice that guides and celebrates, LittleBigPlanet
// style. For the most natural FREE voice with no API key we stream Amazon Polly's
// British "Brian" from the public StreamElements endpoint (audio elements aren't
// CORS-blocked for playback). If that's unavailable (offline), we fall back to
// the device's built-in Web Speech voice — picking the most natural one we can.
const KEY = "friedzooki.narrator";
const POLLY = (voice, text) =>
  `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;

let enabled = localStorage.getItem(KEY) !== "off";
let audio = null;
let lastSpoken = "";

function fallback(text) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  // Prefer richer, less-robotic local voices.
  const pref = ["Daniel", "Arthur", "Google UK English Male", "Samantha", "Google US English", "Aaron", "Martha"];
  u.voice = pref.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) || voices.find((v) => v.lang.startsWith("en")) || null;
  u.rate = 1.0; u.pitch = 1.05;
  synth.speak(u);
}

export const narrator = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    localStorage.setItem(KEY, enabled ? "on" : "off");
    if (!enabled) this.stop();
    return enabled;
  },
  stop() {
    if (audio) { try { audio.pause(); } catch (_) {} audio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  },
  /** Speak a line (interrupts the previous). De-dupes identical back-to-back lines. */
  say(text, { force = false } = {}) {
    if (!enabled || !text) return;
    if (!force && text === lastSpoken) return;
    lastSpoken = text;
    this.stop();
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.src = POLLY("Brian", text);
    a.onerror = () => fallback(text);
    audio = a;
    a.play().catch(() => fallback(text));
  },
};

// Warm up the speech engine list (some browsers populate voices async).
if (window.speechSynthesis) window.speechSynthesis.getVoices();
