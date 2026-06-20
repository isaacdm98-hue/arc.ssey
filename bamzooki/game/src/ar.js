// AR mode for iPhone. iOS Safari does NOT support WebXR immersive-ar, so this
// uses the supported path: a live camera feed behind a transparent WebGL canvas
// ("camera passthrough"), with the scene placed on a virtual floor in front of
// you. Device orientation lets you look around; pinch/drag still frame the shot.
//
// Requires HTTPS (Netlify provides it) and a user gesture to grant camera +
// motion permissions.

export class ARSession {
  constructor(engine, videoEl) {
    this.engine = engine;
    this.video = videoEl;
    this.stream = null;
    this.active = false;
  }

  async start() {
    // 1) camera
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.setAttribute("playsinline", "");   // iOS: don't go fullscreen
    await this.video.play();

    // 2) motion permission (iOS 13+ gates it behind a request)
    try {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        await DOE.requestPermission();
      }
    } catch (_) { /* user declined orientation; camera AR still works */ }

    this.engine.setTransparent(true);
    this.video.style.display = "block";
    this.active = true;
  }

  stop() {
    this.active = false;
    this.engine.setTransparent(false);
    this.video.style.display = "none";
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
  }

  static get supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
