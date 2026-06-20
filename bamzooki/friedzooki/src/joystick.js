// A small on-screen touch joystick. Returns a normalized {x,y} each frame
// (y is "forward"). Pointer-based so it works for touch and mouse.
export class Joystick {
  constructor(baseEl, knobEl) {
    this.base = baseEl; this.knob = knobEl;
    this.x = 0; this.y = 0; this.active = false;
    this.R = 46;
    this._id = null;
    base.style.touchAction = "none";
    base.addEventListener("pointerdown", (e) => this._start(e));
    window.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", (e) => this._end(e));
    window.addEventListener("pointercancel", (e) => this._end(e));
  }
  _center() { const r = this.base.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  _start(e) { this._id = e.pointerId; this.active = true; this._move(e); }
  _move(e) {
    if (!this.active || e.pointerId !== this._id) return;
    const { cx, cy } = this._center();
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, this.R);
    dx = dx / d * cl; dy = dy / d * cl;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.x = dx / this.R; this.y = -dy / this.R;   // up = forward
  }
  _end(e) {
    if (e.pointerId !== this._id) return;
    this.active = false; this._id = null; this.x = this.y = 0;
    this.knob.style.transform = "translate(0,0)";
  }
}
