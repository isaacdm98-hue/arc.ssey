(() => {
  // src/math3.js
  var V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  };
  var M = {
    identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    multiply(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    },
    lookAt(eye, center, up) {
      const z = V.norm(V.sub(eye, center));
      const x = V.norm(V.cross(up, z));
      const y = V.cross(z, x);
      return [
        x[0],
        y[0],
        z[0],
        0,
        x[1],
        y[1],
        z[1],
        0,
        x[2],
        y[2],
        z[2],
        0,
        -V.dot(x, eye),
        -V.dot(y, eye),
        -V.dot(z, eye),
        1
      ];
    },
    // Compose translation * rotation(quat) * scale.
    trs(t, q, s) {
      const [x, y, z, w] = q;
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;
      const [sx, sy, sz] = s;
      return [
        (1 - (yy + zz)) * sx,
        (xy + wz) * sx,
        (xz - wy) * sx,
        0,
        (xy - wz) * sy,
        (1 - (xx + zz)) * sy,
        (yz + wx) * sy,
        0,
        (xz + wy) * sz,
        (yz - wx) * sz,
        (1 - (xx + yy)) * sz,
        0,
        t[0],
        t[1],
        t[2],
        1
      ];
    },
    // Upper-left 3x3 of a TRS matrix, fine as a normal matrix for uniform scale.
    normal3(m) {
      return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
    }
  };
  var Q = {
    identity: () => [0, 0, 0, 1],
    fromYaw: (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)],
    fromAxis(ax, a) {
      const s = Math.sin(a / 2);
      return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)];
    },
    mul(a, b) {
      const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
      return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz
      ];
    },
    // rotate vector v by quaternion q
    rot(q, v) {
      const [x, y, z, w] = q, [vx, vy, vz] = v;
      const ix = w * vx + y * vz - z * vy;
      const iy = w * vy + z * vx - x * vz;
      const iz = w * vz + x * vy - y * vx;
      const iw = -x * vx - y * vy - z * vz;
      return [
        ix * w + iw * -x + iy * -z - iz * -y,
        iy * w + iw * -y + iz * -x - ix * -z,
        iz * w + iw * -z + ix * -y - iy * -x
      ];
    }
  };

  // src/renderer3.js
  var VERT = `
attribute vec3 aPos; attribute vec3 aNormal;
uniform mat4 uProj, uView, uModel; uniform mat3 uNorm;
varying vec3 vN; varying float vY;
void main(){ vN = uNorm * aNormal; vec4 wp = uModel * vec4(aPos,1.0); vY = wp.y;
  gl_Position = uProj * uView * wp; }`;
  var FRAG = `
precision mediump float; varying vec3 vN; varying float vY;
uniform vec3 uColor, uLightDir;
void main(){
  vec3 n = normalize(vN);
  float d = max(dot(n, normalize(uLightDir)), 0.0);
  float amb = 0.5;
  vec3 col = uColor * (amb + 0.7*d);
  gl_FragColor = vec4(col, 1.0);
}`;
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  }
  function cubeGeo() {
    const p = [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
      // +z
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
      [1, -1, -1],
      // -z
      [-1, 1, -1],
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      // +y
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
      // -y
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [1, -1, 1],
      // +x
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1]
      // -x
    ];
    const n = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
    const pos = [], nor = [], idx = [];
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        pos.push(...p[f * 4 + v]);
        nor.push(...n[f]);
      }
      const o = f * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    return { pos, nor, idx };
  }
  function sphereGeo(seg = 12) {
    const pos = [], nor = [], idx = [];
    for (let y = 0; y <= seg; y++) {
      const v = y / seg, phi = v * Math.PI;
      for (let x = 0; x <= seg; x++) {
        const u = x / seg, th = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        pos.push(nx, ny, nz);
        nor.push(nx, ny, nz);
      }
    }
    const row = seg + 1;
    for (let y = 0; y < seg; y++) for (let x = 0; x < seg; x++) {
      const a = y * row + x, b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos, nor, idx };
  }
  function planeGeo(s = 100) {
    return { pos: [-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s], nor: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], idx: [0, 1, 2, 0, 2, 3] };
  }
  var Renderer = class {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext("webgl", { antialias: true, alpha: true }) || canvas.getContext("experimental-webgl");
      if (!gl) throw new Error("WebGL not available");
      this.gl = gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(prog));
      this.prog = prog;
      gl.useProgram(prog);
      this.loc = {
        aPos: gl.getAttribLocation(prog, "aPos"),
        aNormal: gl.getAttribLocation(prog, "aNormal"),
        uProj: gl.getUniformLocation(prog, "uProj"),
        uView: gl.getUniformLocation(prog, "uView"),
        uModel: gl.getUniformLocation(prog, "uModel"),
        uNorm: gl.getUniformLocation(prog, "uNorm"),
        uColor: gl.getUniformLocation(prog, "uColor"),
        uLightDir: gl.getUniformLocation(prog, "uLightDir")
      };
      gl.enable(gl.DEPTH_TEST);
      this.geos = { box: this._geo(cubeGeo()), sphere: this._geo(sphereGeo()), plane: this._geo(planeGeo()) };
      this.nodes = [];
      this.clear = [0.92, 0.9, 0.82];
      this.light = V.norm([0.5, 1, 0.35]);
    }
    _geo(g) {
      const gl = this.gl;
      const pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.pos), gl.STATIC_DRAW);
      const nor = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nor);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.nor), gl.STATIC_DRAW);
      const idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
      return { pos, nor, idx, count: g.idx.length };
    }
    /** Add a renderable. shape: "box"|"sphere"|"plane". color: hex string or [r,g,b]. */
    add(shape, color = "#cccccc", scale = [1, 1, 1]) {
      const node = { geo: this.geos[shape], color: toRGB(color), pos: [0, 0, 0], quat: [0, 0, 0, 1], scale, visible: true };
      this.nodes.push(node);
      return node;
    }
    remove(node) {
      const i = this.nodes.indexOf(node);
      if (i >= 0) this.nodes.splice(i, 1);
    }
    clearNodes() {
      this.nodes.length = 0;
    }
    resize() {
      const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== (w * dpr | 0) || c.height !== (h * dpr | 0)) {
        c.width = w * dpr | 0;
        c.height = h * dpr | 0;
      }
      this.aspect = (c.width || 1) / (c.height || 1);
    }
    render(eye, target, transparent) {
      const gl = this.gl;
      this.resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (transparent) gl.clearColor(0, 0, 0, 0);
      else gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const proj = M.perspective(0.95, this.aspect || 1.5, 0.05, 400);
      const view = M.lookAt(eye, target, [0, 1, 0]);
      gl.uniformMatrix4fv(this.loc.uProj, false, new Float32Array(proj));
      gl.uniformMatrix4fv(this.loc.uView, false, new Float32Array(view));
      gl.uniform3fv(this.loc.uLightDir, new Float32Array(this.light));
      for (const nd of this.nodes) {
        if (!nd.visible) continue;
        const model = M.trs(nd.pos, nd.quat, nd.scale);
        gl.uniformMatrix4fv(this.loc.uModel, false, new Float32Array(model));
        gl.uniformMatrix3fv(this.loc.uNorm, false, new Float32Array(M.normal3(model)));
        gl.uniform3fv(this.loc.uColor, new Float32Array(nd.color));
        const g = nd.geo;
        gl.bindBuffer(gl.ARRAY_BUFFER, g.pos);
        gl.enableVertexAttribArray(this.loc.aPos);
        gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.nor);
        gl.enableVertexAttribArray(this.loc.aNormal);
        gl.vertexAttribPointer(this.loc.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx);
        gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
      }
    }
  };
  function toRGB(c) {
    if (Array.isArray(c)) return c;
    const h = c.replace("#", "");
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  // src/sim.js
  var G = 18;
  var Creature = class {
    constructor(genome2) {
      this.set(genome2);
      this.reset();
    }
    set(g) {
      this.g = g;
      this.H = g.body.h / 2 + g.leg.len;
      this.speed = g.gait.drive * 0.34;
      this.jumpV = Math.max(0, g.gait.jump) * 1.1;
      this.turn = 6;
      this.r = Math.max(g.body.w, g.body.l) / 2 + 0.1;
    }
    reset(x = 0, z = 0, yaw = 0) {
      this.pos = [x, this.H, z];
      this.vel = [0, 0, 0];
      this.yaw = yaw;
      this.onGround = true;
      this.phase = 0;
      this.goal = null;
      this.idle = false;
    }
    forward() {
      return [Math.sin(this.yaw), 0, Math.cos(this.yaw)];
    }
    step(dt) {
      const g = this.g;
      let dx, dz;
      if (this.goal) {
        dx = this.goal[0] - this.pos[0];
        dz = this.goal[1] - this.pos[2];
      } else {
        const f2 = this.forward();
        dx = f2[0];
        dz = f2[2];
      }
      const m = Math.hypot(dx, dz) || 1;
      dx /= m;
      dz /= m;
      const want = Math.atan2(dx, dz);
      let d = want - this.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.yaw += Math.max(-this.turn * dt, Math.min(this.turn * dt, d));
      this.yaw += (g.gait.steer || 0) * dt * 0.4;
      const target = this.idle ? 0 : this.speed;
      const f = this.forward();
      const desired = [f[0] * target, f[2] * target];
      this.vel[0] += (desired[0] - this.vel[0]) * Math.min(1, dt * 6);
      this.vel[2] += (desired[1] - this.vel[2]) * Math.min(1, dt * 6);
      this.vel[1] -= G * dt;
      this.pos[0] += this.vel[0] * dt;
      this.pos[1] += this.vel[1] * dt;
      this.pos[2] += this.vel[2] * dt;
      if (this.pos[1] <= this.H) {
        this.pos[1] = this.H;
        this.vel[1] = 0;
        this.onGround = true;
      } else this.onGround = false;
      const sp = Math.hypot(this.vel[0], this.vel[2]);
      this.phase += dt * (1.5 + sp * 1.6) * g.gait.freq;
    }
    jump() {
      if (this.onGround) {
        this.vel[1] = this.jumpV;
        this.onGround = false;
      }
    }
  };
  var Body = class {
    constructor(kind, pos, half, mass) {
      this.kind = kind;
      this.pos = pos.slice();
      this.vel = [0, 0, 0];
      this.half = half;
      this.mass = mass;
      this.rest = half[1];
      this.fallen = 0;
    }
    step(dt) {
      this.vel[1] -= G * dt;
      for (let i = 0; i < 3; i++) this.pos[i] += this.vel[i] * dt;
      if (this.pos[1] <= this.rest) {
        this.pos[1] = this.rest;
        this.vel[1] = 0;
      }
      this.vel[0] *= 1 - Math.min(1, dt * 2);
      this.vel[2] *= 1 - Math.min(1, dt * 2);
    }
  };
  function pushBody(c, b, dt) {
    const dx = b.pos[0] - c.pos[0], dz = b.pos[2] - c.pos[2];
    const dist = Math.hypot(dx, dz) || 1;
    const reach = c.r + Math.max(b.half[0], b.half[2]);
    if (dist < reach && Math.abs(b.pos[1] - c.pos[1]) < c.H + b.half[1]) {
      const nx = dx / dist, nz = dz / dist;
      const sp = Math.hypot(c.vel[0], c.vel[2]);
      const force = (sp + 1.5) * (6 / b.mass);
      b.vel[0] += nx * force * dt * 10;
      b.vel[2] += nz * force * dt * 10;
      return true;
    }
    return false;
  }
  function shove(a, b, dt) {
    const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2];
    const dist = Math.hypot(dx, dz) || 1;
    if (dist < a.r + b.r) {
      const nx = dx / dist, nz = dz / dist, overlap = a.r + b.r - dist;
      const pa = a.speed, pb = b.speed, tot = pa + pb;
      a.pos[0] -= nx * overlap * (pb / tot);
      a.pos[2] -= nz * overlap * (pb / tot);
      b.pos[0] += nx * overlap * (pa / tot);
      b.pos[2] += nz * overlap * (pa / tot);
    }
  }

  // src/zook3.js
  function defaultGenome(name = "My Zook") {
    return {
      name,
      color: "#46c7ff",
      body: { w: 1.3, h: 0.55, l: 1.9, mass: 6 },
      legCount: 4,
      leg: { len: 0.95, radius: 0.18 },
      gait: { freq: 2.2, amplitude: 0.8, drive: 12, jump: 0, steer: 0 },
      records: {}
    };
  }
  function legHips(g) {
    const n = Math.max(2, Math.min(8, g.legCount | 0)), rows = Math.ceil(n / 2), out = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1, row = i / 2 | 0;
      const z = rows === 1 ? 0 : g.body.l / 2 - 0.25 - row / (rows - 1) * (g.body.l - 0.5);
      out.push({ x: side * g.body.w / 2, z, phase: (side < 0 ? 0 : Math.PI) + row * Math.PI });
    }
    return out;
  }
  var Zook3 = class {
    constructor(genome2, renderer, { x = 0, z = 0, yaw = 0, tint = null } = {}) {
      this.g = genome2;
      this.r = renderer;
      this.color = tint || genome2.color;
      this.sim = new Creature(genome2);
      this.sim.reset(x, z, yaw);
      this.bodyNode = renderer.add("box", this.color, [genome2.body.w / 2, genome2.body.h / 2, genome2.body.l / 2]);
      this.eyeNode = renderer.add("sphere", "#1c1c1c", [0.11, 0.11, 0.11]);
      this.legNodes = legHips(genome2).map((h) => ({
        hip: h,
        node: renderer.add("box", this.color, [genome2.leg.radius, genome2.leg.len / 2, genome2.leg.radius])
      }));
      this.nodes = [this.bodyNode, this.eyeNode, ...this.legNodes.map((l) => l.node)];
      this.sync();
    }
    get object() {
      return this.bodyNode;
    }
    position() {
      return this.sim.pos;
    }
    height() {
      return this.sim.pos[1];
    }
    setGoal(x, z) {
      this.sim.goal = [x, z];
    }
    clearGoal() {
      this.sim.goal = null;
    }
    jump() {
      this.sim.jump();
    }
    update(dt, idle = false) {
      this.sim.idle = idle;
      this.sim.step(dt);
      this.sync();
    }
    sync() {
      const s = this.sim, g = this.g, yawQ = Q.fromYaw(s.yaw);
      this.bodyNode.pos = s.pos.slice();
      this.bodyNode.quat = yawQ;
      const eo = Q.rot(yawQ, [0, g.body.h * 0.2, g.body.l * 0.5]);
      this.eyeNode.pos = V.add(s.pos, eo);
      this.eyeNode.quat = yawQ;
      const L = g.leg.len;
      for (const l of this.legNodes) {
        const swing = (g.gait.amplitude || 0.6) * Math.sin(s.phase + l.hip.phase);
        const legQ = Q.mul(yawQ, Q.fromAxis([1, 0, 0], swing));
        const hipLocal = [l.hip.x, -g.body.h / 2, l.hip.z];
        const hipWorld = V.add(s.pos, Q.rot(yawQ, hipLocal));
        const down = Q.rot(legQ, [0, -L / 2, 0]);
        l.node.pos = V.add(hipWorld, down);
        l.node.quat = legQ;
      }
    }
    dispose() {
      for (const n of this.nodes) this.r.remove(n);
      this.nodes = [];
    }
  };

  // src/sound.js
  var ctx = null;
  var muted = false;
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
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  var sfx = {
    tap() {
      tone(420, 0.08, { type: "triangle", gain: 0.12 });
    },
    pop() {
      tone(300, 0.12, { type: "sine", slideTo: 620, gain: 0.16 });
    },
    back() {
      tone(360, 0.1, { type: "triangle", slideTo: 220, gain: 0.12 });
    },
    slide() {
      tone(680, 0.04, { type: "sine", gain: 0.05 });
    },
    whoosh() {
      tone(180, 0.22, { type: "sawtooth", slideTo: 520, gain: 0.07 });
    },
    beep() {
      tone(540, 0.14, { type: "square", gain: 0.13 });
    },
    go() {
      tone(720, 0.32, { type: "square", slideTo: 980, gain: 0.16 });
    },
    save() {
      tone(523, 0.1, { type: "sine" });
      tone(784, 0.16, { type: "sine", delay: 0.09 });
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: "triangle", gain: 0.16, delay: i * 0.11 }));
    },
    lose() {
      tone(330, 0.3, { type: "sawtooth", slideTo: 160, gain: 0.12 });
    }
  };
  function toggleMute() {
    muted = !muted;
    return muted;
  }
  function primeAudio() {
    ac();
  }

  // src/fx.js
  var COLORS = ["#f2cd49", "#e98aa4", "#7fae7a", "#8fb0c9", "#ff7a59"];
  function confetti(n = 90) {
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      const size = 7 + Math.random() * 9;
      s.style.cssText = `left:${Math.random() * 100}vw;width:${size}px;height:${size * 0.6}px;background:${COLORS[Math.random() * COLORS.length | 0]};--rot:${Math.random() * 720 - 360 | 0}deg;--dx:${Math.random() * 200 - 100 | 0}px;animation-delay:${(Math.random() * 0.3).toFixed(2)}s;animation-duration:${(1.6 + Math.random() * 1.2).toFixed(2)}s;`;
      layer.appendChild(s);
    }
    setTimeout(() => layer.remove(), 3200);
  }

  // src/narrator.js
  var _ctx = null;
  var _enabled = null;
  var _captionEl = null;
  var _hideTimer = null;
  function ac2() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        _ctx = false;
      }
    }
    if (_ctx && _ctx.state === "suspended") _ctx.resume();
    return _ctx || null;
  }
  function readEnabled() {
    if (_enabled === null) {
      try {
        _enabled = localStorage.getItem("friedzooki.voice") !== "off";
      } catch (_) {
        _enabled = true;
      }
    }
    return _enabled;
  }
  function caption() {
    if (!_captionEl) _captionEl = document.getElementById("narration");
    return _captionEl;
  }
  function blip(freq, t0, dur) {
    const a = ac2();
    if (!a) return;
    const g = a.createGain();
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    g.connect(a.destination);
    for (const [type, det, gain] of [["triangle", 0, 1], ["sine", 7, 0.6]]) {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq + det, t0);
      o.frequency.linearRampToValueAtTime(freq * 1.04 + det, t0 + dur * 0.6);
      const gg = a.createGain();
      gg.gain.value = gain;
      o.connect(gg).connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
  }
  function speakGibberish(text) {
    const a = ac2();
    if (!a) return;
    const sylls = (text.toLowerCase().match(/[aeiouy]+|[^aeiouy\s]+|\s+/g) || []).filter((s) => s.trim());
    const base = 300, span = 360;
    let t = a.currentTime + 0.02;
    const step = 0.085;
    const max = Math.min(sylls.length, 26);
    for (let i = 0; i < max; i++) {
      const s = sylls[i];
      const isVowel = /[aeiouy]/.test(s[0]);
      const code = s.charCodeAt(0) || 100;
      const semis = code % 9;
      const freq = base + semis / 9 * span + (isVowel ? 40 : 0);
      blip(freq, t, isVowel ? 0.13 : 0.07);
      t += step + (isVowel ? 0.02 : 0);
    }
  }
  function showCaption(text) {
    const el = caption();
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => el.classList.remove("show"), Math.min(7e3, 1800 + text.length * 55));
  }
  var narrator = {
    get enabled() {
      return readEnabled();
    },
    toggle() {
      _enabled = !readEnabled();
      try {
        localStorage.setItem("friedzooki.voice", _enabled ? "on" : "off");
      } catch (_) {
      }
      return _enabled;
    },
    stop() {
    },
    say(text) {
      if (!text) return;
      showCaption(text);
      if (readEnabled()) {
        try {
          speakGibberish(text);
        } catch (_) {
        }
      }
    }
  };

  // src/app3.js
  var $ = (s) => document.querySelector(s);
  var setStep = (m) => {
    const e = $("#boot-step");
    if (e) e.textContent = m;
  };
  var R;
  var ground;
  var player;
  var genome = defaultGenome();
  var mode = "idle";
  var trial = null;
  var last = performance.now();
  function boot() {
    setStep("starting renderer\u2026");
    R = new Renderer($("#scene"));
    ground = R.add("plane", "#6f9b6a");
    setStep("ready!");
    $("#loading").classList.remove("show");
    showScreen("title");
    requestAnimationFrame(loop);
  }
  try {
    boot();
  } catch (e) {
    const el = $("#boot-err");
    if (el) {
      el.style.display = "block";
      el.textContent = "\u26A0 " + (e.message || e);
      el.onclick = () => location.reload();
    }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    try {
      if (mode === "build" || mode === "test") {
        if (player) player.update(dt);
      } else if (mode === "trial" && trial) trial.step(dt);
    } catch (e) {
      console.error(e);
    }
    let eye = [7, 6, 11], tgt = [0, 1, 0];
    if (player) {
      const p = player.position();
      if (mode === "build") {
        const a = now / 2400;
        eye = [p[0] + Math.sin(a) * 7, p[1] + 3.5, p[2] + Math.cos(a) * 7];
        tgt = [p[0], p[1], p[2]];
      } else {
        eye = [p[0], p[1] + 4.5, p[2] - 9];
        tgt = [p[0], p[1] + 0.4, p[2]];
      }
    }
    if (R) R.render(eye, tgt, false);
  }
  function showScreen(name) {
    for (const el2 of document.querySelectorAll(".screen")) el2.classList.remove("show");
    const playing = name === "play";
    $("#play-ui").classList.toggle("hidden", !playing);
    const el = $("#screen-" + name);
    if (el) el.classList.add("show");
    if (name === "trials") renderTrials();
    if (name !== "play" && name !== "build") {
      mode = "idle";
    }
  }
  var FIELDS = [
    ["legCount", "Legs", 2, 8, 2],
    ["body.w", "Width", 0.6, 2.4, 0.1],
    ["body.l", "Length", 0.8, 3, 0.1],
    ["body.h", "Height", 0.3, 1.2, 0.05],
    ["leg.len", "Leg length", 0.5, 1.8, 0.05],
    ["body.mass", "Mass", 2, 16, 0.5],
    ["gait.freq", "Step speed", 0.5, 4, 0.1],
    ["gait.drive", "Muscle power", 4, 24, 1],
    ["gait.jump", "Jump", 0, 14, 0.5],
    ["gait.steer", "Steer", -3, 3, 0.2]
  ];
  var SWATCH = ["#46c7ff", "#e98aa4", "#f0c64a", "#7fae7a", "#ff7a59", "#9d6bff", "#3f3a33"];
  var get = (o, p) => p.split(".").reduce((a, k) => a[k], o);
  var set = (o, p, v) => {
    const k = p.split(".");
    const l = k.pop();
    k.reduce((a, x) => a[x], o)[l] = v;
  };
  function openBuild() {
    showScreen("build");
    mode = "build";
    spawnPlayer();
    $("#build-name").value = genome.name;
    const sw = $("#build-swatches");
    sw.innerHTML = "";
    for (const c of SWATCH) {
      const b = document.createElement("button");
      b.style.background = c;
      b.onclick = () => {
        genome.color = c;
        sfx.pop();
        spawnPlayer();
      };
      sw.appendChild(b);
    }
    const box = $("#build-controls");
    box.innerHTML = "";
    for (const [path, label, min, max, step] of FIELDS) {
      const row = document.createElement("div");
      row.className = "slider-row";
      const head = document.createElement("div");
      head.className = "slider-head";
      const val = document.createElement("span");
      val.className = "v";
      const inp = document.createElement("input");
      inp.type = "range";
      inp.min = min;
      inp.max = max;
      inp.step = step;
      inp.value = get(genome, path);
      val.textContent = (+inp.value).toFixed(step < 1 ? 2 : 0);
      inp.oninput = () => {
        const v = parseFloat(inp.value);
        set(genome, path, v);
        val.textContent = v.toFixed(step < 1 ? 2 : 0);
        sfx.slide();
        rebuildOrTune(path);
        updateStats();
      };
      head.append(Object.assign(document.createElement("span"), { textContent: label }), val);
      row.append(head, inp);
      box.append(row);
    }
    updateStats();
    maybeCoach();
  }
  function spawnPlayer() {
    if (player) player.dispose();
    player = new Zook3(genome, R, { x: 0, z: 0 });
  }
  function rebuildOrTune(path) {
    if (path.startsWith("gait")) {
      player.sim.set(genome);
    } else spawnPlayer();
  }
  function updateStats() {
    $("#build-stats").innerHTML = `<span>\u2696\uFE0F ${genome.body.mass.toFixed(1)}</span><span>\u{1F9B5} ${genome.legCount}</span><span>\u{1F4AA} ${genome.gait.drive}</span><span>\u{1F3C3} ${(genome.gait.drive * 0.34).toFixed(1)} m/s</span><span>\u2B06\uFE0F ${genome.gait.jump}</span>`;
  }
  $("#build-name").oninput = (e) => {
    genome.name = e.target.value || "Zook";
  };
  $("#build-new").onclick = () => {
    sfx.pop();
    genome = defaultGenome("Zook");
    openBuild();
  };
  $("#build-test").onclick = () => {
    sfx.whoosh();
    showScreen("play");
    mode = "test";
    player.sim.reset(0, 0, 0);
    $("#hud").textContent = "Test run \u2014 watch it scamper!";
    narrator.say("Here it goes \u2014 watch your Zook run!");
  };
  var COACH = [
    "Welcome to FriedZooki! Let's build your first creature \u2014 a Zook.",
    "This is your Zook, here on stage. It feels every change at once.",
    "Use BODY and LEGS to shape it. More legs make it steadier.",
    "MUSCLE POWER and STEP SPEED set how fast it scampers.",
    "When it looks right, tap TEST to watch it run \u2014 then hit the Trials!"
  ];
  var coachI = 0;
  var coachSeen = false;
  function maybeCoach() {
    if (coachSeen) return;
    coachSeen = true;
    try {
      if (localStorage.getItem("fz.coached") === "1") return;
    } catch (_) {
    }
    coachI = 0;
    $("#coach").classList.remove("hidden");
    coachShow();
  }
  function coachShow() {
    const t = COACH[coachI];
    $("#coach-text").textContent = t;
    narrator.say(t);
  }
  $("#coach-next").onclick = () => {
    sfx.tap();
    if (++coachI >= COACH.length) {
      $("#coach").classList.add("hidden");
      try {
        localStorage.setItem("fz.coached", "1");
      } catch (_) {
      }
    } else coachShow();
  };
  $("#coach-skip").onclick = () => {
    sfx.back();
    $("#coach").classList.add("hidden");
    try {
      localStorage.setItem("fz.coached", "1");
    } catch (_) {
    }
  };
  var TRIALS = {
    sprint: { label: "Sprint", icon: "\u{1F3C3}", desc: "First past the line." },
    hurdles: { label: "Hurdles", icon: "\u{1F6A7}", desc: "Bowl through the bars." },
    highjump: { label: "High Jump", icon: "\u2B06\uFE0F", desc: "Tune your spring." },
    football: { label: "Football", icon: "\u26BD", desc: "Dribble into the goal." },
    blockpush: { label: "Block Push", icon: "\u{1F4E6}", desc: "Shove the block home." },
    sumo: { label: "Sumo", icon: "\u{1F93C}", desc: "Shove your rival out." }
  };
  function renderTrials() {
    const box = $("#trials-list");
    box.innerHTML = "";
    $("#trials-zook").textContent = "Competing: " + genome.name;
    for (const [k, t] of Object.entries(TRIALS)) {
      const card = document.createElement("div");
      card.className = "trial panel";
      card.append(Object.assign(document.createElement("span"), { className: "ic", textContent: t.icon }));
      card.append(Object.assign(document.createElement("span"), { className: "cname", textContent: t.label }));
      const go = document.createElement("button");
      go.className = "btn-blob";
      go.textContent = "Enter";
      go.onclick = () => {
        sfx.whoosh();
        startTrial(k);
      };
      card.append(go);
      const d = document.createElement("div");
      d.className = "tag small";
      d.textContent = t.desc;
      d.style.gridColumn = "2";
      card.append(d);
      box.append(card);
    }
  }
  function clearArena() {
    if (player) {
      player.dispose();
      player = null;
    }
    if (trial) {
      trial.dispose();
      trial = null;
    }
  }
  function startTrial(key) {
    clearArena();
    showScreen("play");
    $("#result").classList.remove("show");
    trial = new Trial(key);
    mode = "idle";
    runCountdown(() => {
      mode = "trial";
    });
  }
  function runCountdown(then) {
    const el = $("#countdown");
    el.classList.remove("hidden");
    const seq = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      el.innerHTML = `<b>${seq[i]}</b>`;
      i < 3 ? sfx.beep() : sfx.go();
      i++;
      if (i <= seq.length) setTimeout(tick, i === seq.length ? 450 : 650);
      else {
        el.classList.add("hidden");
        then();
      }
    };
    tick();
  }
  var Trial = class {
    constructor(key) {
      this.key = key;
      this.t = 0;
      this.done = false;
      this.extra = [];
      this.bodies = [];
      const T = TRIALS[key];
      narrator.say(`${T.label}! ${T.desc}`);
      player = new Zook3(genome, R, { x: 0, z: 0 });
      this[key]();
    }
    _box(x, y, z, hx, hy, hz, color) {
      const n = R.add("box", color, [hx, hy, hz]);
      n.pos = [x, y, z];
      this.extra.push(n);
      return n;
    }
    _line(z, color) {
      const n = R.add("box", color, [7, 0.03, 0.25]);
      n.pos = [0, 0.03, z];
      this.extra.push(n);
    }
    _ai(n) {
      for (let i = 0; i < n; i++) {
        const g = structuredClone(genome);
        g.gait.freq *= 0.85 + Math.random() * 0.3;
        g.gait.drive *= 0.8 + Math.random() * 0.35;
        this.rivals = this.rivals || [];
        this.rivals.push(new Zook3(g, R, { x: (i + 1) * 3 - 1.5, z: 0, tint: ["#ff7a59", "#9d6bff", "#3ddc97"][i % 3] }));
      }
    }
    sprint() {
      this.finishZ = 26;
      this.limit = 30;
      this._line(this.finishZ, "#46c7ff");
      this._ai(3);
    }
    hurdles() {
      this.finishZ = 26;
      this.limit = 30;
      this._line(this.finishZ, "#46c7ff");
      this._ai(3);
      for (let i = 1; i <= 4; i++) {
        const b = new Body("bar", [0, 0.35, i * 5], [3.2, 0.35, 0.08], 0.5);
        this.bodies.push(b);
        b.node = R.add("box", "#ff5470", b.half);
        this.extra.push(b.node);
      }
    }
    highjump() {
      this.limit = 16;
      this.maxH = 0;
      const g = structuredClone(genome);
      g.gait.jump = Math.max(g.gait.jump, 7);
      player.dispose();
      player = new Zook3(g, R, { x: 0, z: 0 });
    }
    football() {
      this.limit = 40;
      this.goalZ = 16;
      this.goalW = 3;
      this._line(this.goalZ, "#3ddc97");
      this._box(-3, 0.9, this.goalZ, 0.12, 0.9, 0.12, "#46c7ff");
      this._box(3, 0.9, this.goalZ, 0.12, 0.9, 0.12, "#46c7ff");
      this.ball = new Body("ball", [0, 0.6, 6], [0.6, 0.6, 0.6], 1);
      this.bodies.push(this.ball);
      this.ball.node = R.add("sphere", "#f2f2f2", [0.6, 0.6, 0.6]);
      this.extra.push(this.ball.node);
    }
    blockpush() {
      this.limit = 30;
      this.goalZ = 8;
      this._line(this.goalZ, "#3ddc97");
      this.block = new Body("block", [0, 0.6, 3], [0.6, 0.6, 0.6], 3);
      this.bodies.push(this.block);
      this.block.node = R.add("box", "#ffb454", [0.6, 0.6, 0.6]);
      this.extra.push(this.block.node);
    }
    sumo() {
      this.limit = 20;
      this.Rr = 4;
      const ring = R.add("box", "#ff7a59", [this.Rr, 0.02, this.Rr]);
      ring.pos = [0, 0.02, 0];
      this.extra.push(ring);
      player.sim.reset(0, -2.4, 0);
      const g = structuredClone(genome);
      g.gait.drive *= 0.85;
      this.rival = new Zook3(g, R, { x: 0, z: 2.4, yaw: Math.PI, tint: "#ff7a59" });
    }
    step(dt) {
      if (this.done) return;
      this.t += dt;
      const race = ["sprint", "hurdles"].includes(this.key);
      if (this.rivals) for (const r of this.rivals) {
        r.setGoal(r.position()[0], 1e3);
        r.update(dt);
      }
      if (this.key === "football") {
        const b = this.ball.pos;
        let dx = b[0], dz = b[2] - this.goalZ;
        const m = Math.hypot(dx, dz) || 1;
        player.setGoal(b[0] + dx / m * 1.3, b[2] + dz / m * 1.3);
      }
      if (this.key === "sumo") {
        player.setGoal(this.rival.position()[0], this.rival.position()[2]);
        this.rival.setGoal(player.position()[0], player.position()[2]);
        this.rival.update(dt);
      }
      player.update(dt);
      for (const b of this.bodies) {
        if (b.kind === "bar" || b.kind === "ball" || b.kind === "block") pushBody(player, b, dt);
        b.step(dt);
        if (b.node) {
          b.node.pos = b.pos.slice();
        }
      }
      if (this.key === "sumo") shove(player.sim, this.rival.sim, dt);
      this._judge();
      if (!this.done && this.t > this.limit) this.finish(this._timeout());
      $("#hud").textContent = this.hud();
    }
    _judge() {
      const p = player.position();
      if (["sprint", "hurdles"].includes(this.key)) {
        const all = [player, ...this.rivals || []].filter((z) => z.position()[2] >= this.finishZ).sort((a, b) => b.position()[2] - a.position()[2]);
        if (p[2] >= this.finishZ) {
          const place = [player, ...this.rivals || []].sort((a, b) => b.position()[2] - a.position()[2]).indexOf(player) + 1;
          this.finish({ win: place === 1, text: place === 1 ? "1st place \u2014 you win!" : `${place}th place`, metric: this.t, unit: "s" });
        }
      } else if (this.key === "highjump") {
        this.maxH = Math.max(this.maxH, p[1]);
      } else if (this.key === "football") {
        const b = this.ball.pos;
        if (b[2] >= this.goalZ && Math.abs(b[0]) <= this.goalW) this.finish({ win: true, text: `GOAL in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" });
      } else if (this.key === "blockpush") {
        if (this.block.pos[2] >= this.goalZ) this.finish({ win: true, text: `Pushed home in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" });
      } else if (this.key === "sumo") {
        const rr = Math.hypot(this.rival.position()[0], this.rival.position()[2]);
        const pr = Math.hypot(p[0], p[2]);
        if (rr > this.Rr) this.finish({ win: true, text: `Out of the ring in ${this.t.toFixed(1)}s!`, metric: this.t, unit: "s" });
        else if (pr > this.Rr) this.finish({ win: false, text: "You were shoved out!" });
      }
    }
    _timeout() {
      if (this.key === "highjump") {
        const s = Math.max(0, this.maxH - 0.8);
        return { win: s > 1.2, text: `Best height ${s.toFixed(2)}m`, metric: s, unit: "m" };
      }
      return { win: false, text: "Out of time" };
    }
    finish(r) {
      this.done = true;
      this.result = r;
      showResult(r, this.key);
    }
    hud() {
      const p = player.position();
      if (["sprint", "hurdles"].includes(this.key)) return `${TRIALS[this.key].label.toUpperCase()} \xB7 ${Math.max(0, this.finishZ - p[2]).toFixed(1)}m \xB7 ${this.t.toFixed(1)}s`;
      if (this.key === "highjump") return `HIGH JUMP \xB7 best ${Math.max(0, this.maxH - 0.8).toFixed(2)}m \xB7 ${(this.limit - this.t).toFixed(1)}s`;
      if (this.key === "football") return `FOOTBALL \xB7 ${this.t.toFixed(1)}s`;
      if (this.key === "blockpush") return `BLOCK PUSH \xB7 ${Math.max(0, this.goalZ - this.block.pos[2]).toFixed(1)}m \xB7 ${this.t.toFixed(1)}s`;
      if (this.key === "sumo") return `SUMO \xB7 ${this.t.toFixed(1)}s`;
      return "";
    }
    dispose() {
      if (this.rivals) this.rivals.forEach((r) => r.dispose());
      if (this.rival) this.rival.dispose();
      for (const n of this.extra) R.remove(n);
    }
  };
  function showResult(r, key) {
    if (r.metric != null) {
      try {
        genome.records = genome.records || {};
        const prev = genome.records[key];
        if (prev == null || (r.unit === "m" ? r.metric > prev : r.metric < prev)) genome.records[key] = r.metric;
      } catch (_) {
      }
    }
    $("#result-title").textContent = r.win ? "\u{1F3C6} Winner!" : "Nice try!";
    $("#result-metric").textContent = r.metric != null ? `${r.metric.toFixed(r.unit === "m" ? 2 : 1)}${r.unit}` : "";
    $("#result-text").textContent = r.text;
    $("#result").classList.add("show");
    if (r.win) {
      sfx.win();
      confetti();
      narrator.say("A win! Beautifully done.");
    } else {
      sfx.lose();
      narrator.say("So close \u2014 tweak it and try again.");
    }
  }
  $("#result-retry").onclick = () => {
    sfx.pop();
    $("#result").classList.remove("show");
    startTrial(trial.key);
  };
  $("#result-trials").onclick = () => {
    sfx.tap();
    $("#result").classList.remove("show");
    clearArena();
    showScreen("trials");
  };
  for (const b of document.querySelectorAll("[data-go]")) b.onclick = () => {
    sfx.tap();
    const n = b.getAttribute("data-go");
    if (n === "build") openBuild();
    else {
      clearArena();
      showScreen(n);
    }
  };
  $("#play-back").onclick = () => {
    sfx.back();
    clearArena();
    showScreen("title");
  };
  $("#mute-btn").onclick = (e) => {
    e.target.textContent = toggleMute() ? "\u{1F507}" : "\u{1F50A}";
  };
  $("#narrate-btn").onclick = (e) => {
    const on = narrator.toggle();
    e.target.textContent = on ? "\u{1F5E3}\uFE0F" : "\u{1F507}";
    if (on) narrator.say("Narrator on.");
  };
  document.body.addEventListener("pointerdown", () => {
    primeAudio();
    narrator.say("Welcome to FriedZooki! Build a creature, then race it.");
  }, { once: true });
})();
