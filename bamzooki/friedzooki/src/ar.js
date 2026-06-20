// AR for iPhone — "on your desk". iOS Safari has no WebXR, so this uses the
// supported path: the live rear-camera feed behind a transparent 3D scene,
// with DEVICE-ORIENTATION TRACKING so the creature stays anchored in space as
// you move the phone around it. Tap to re-centre; one-finger drag works if
// motion permission is declined. Needs HTTPS + camera/motion permission.
const DEG = Math.PI / 180;

export class ARSession {
  constructor(engine, videoEl) {
    this.engine = engine;
    this.video = videoEl;
    this.stream = null;
    this.active = false;
    this.yawOffset = 0;
    this._theta = 0; this._phi = 1.15;
    this._rawYaw = 0;
    this._onOrient = this._onOrient.bind(this);
    this._touch = null;
  }

  async start(targetObj) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.setAttribute("playsinline", "");
    await this.video.play();

    // Motion permission (iOS 13+ gates device orientation behind a request).
    this.hasOrientation = false;
    try {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        if ((await DOE.requestPermission()) === "granted") this.hasOrientation = true;
      } else if (DOE) { this.hasOrientation = true; }
    } catch (_) { /* declined — fall back to touch drag */ }

    if (this.hasOrientation) window.addEventListener("deviceorientation", this._onOrient, true);
    this._bindTouch();

    this.engine.setTransparent(true);
    this.engine.enableAR(targetObj, 9);
    this.video.style.display = "block";
    this.active = true;
    this.recenter();
  }

  /** Re-anchor the scene to sit in front of where you're currently looking. */
  recenter() { this.yawOffset = this._rawYaw || 0; }

  _onOrient(e) {
    if (e.alpha == null) return;
    this._rawYaw = -e.alpha * DEG;
    this._theta = this._rawYaw - this.yawOffset;
    const beta = e.beta ?? 75;                       // 90° ≈ phone held upright
    this._phi = Math.max(0.25, Math.min(1.5, (110 - beta) * DEG + 0.6));
    this.engine.setARView(this._theta, this._phi);
  }

  _bindTouch() {
    const el = this.engine.canvas;
    let last = null;
    const move = (x, y) => {
      if (!last) { last = { x, y }; return; }
      this._theta -= (x - last.x) * 0.005;
      this._phi = Math.max(0.25, Math.min(1.5, this._phi - (y - last.y) * 0.005));
      this.engine.setARView(this._theta, this._phi);
      last = { x, y };
    };
    this._touch = {
      ts: (e) => (last = { x: e.touches[0].clientX, y: e.touches[0].clientY }),
      tm: (e) => { if (!this.hasOrientation) move(e.touches[0].clientX, e.touches[0].clientY); },
      te: () => (last = null),
    };
    el.addEventListener("touchstart", this._touch.ts, { passive: true });
    el.addEventListener("touchmove", this._touch.tm, { passive: true });
    el.addEventListener("touchend", this._touch.te);
  }

  stop() {
    this.active = false;
    window.removeEventListener("deviceorientation", this._onOrient, true);
    if (this._touch) {
      const el = this.engine.canvas;
      el.removeEventListener("touchstart", this._touch.ts);
      el.removeEventListener("touchmove", this._touch.tm);
      el.removeEventListener("touchend", this._touch.te);
      this._touch = null;
    }
    this.engine.disableAR();
    this.engine.setTransparent(false);
    this.video.style.display = "none";
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
  }

  static get supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
