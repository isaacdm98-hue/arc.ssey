// From-scratch WebGL renderer — no three.js. Draws flat-shaded boxes, spheres
// and a ground plane with one directional light. Standard WebGL1 patterns.
import { M, V } from "./math3.js";

const VERT = `
attribute vec3 aPos; attribute vec3 aNormal;
uniform mat4 uProj, uView, uModel; uniform mat3 uNorm;
varying vec3 vN; varying float vY;
void main(){ vN = uNorm * aNormal; vec4 wp = uModel * vec4(aPos,1.0); vY = wp.y;
  gl_Position = uProj * uView * wp; }`;
const FRAG = `
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
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
  return s;
}

function cubeGeo() {
  // 24 verts (per-face normals), 36 indices
  const p = [
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],     // +z
    [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1],  // -z
    [-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1],      // +y
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],  // -y
    [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1],      // +x
    [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1],  // -x
  ];
  const n = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const pos = [], nor = [], idx = [];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) { pos.push(...p[f * 4 + v]); nor.push(...n[f]); }
    const o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
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
      pos.push(nx, ny, nz); nor.push(nx, ny, nz);
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

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true })
      || canvas.getContext("experimental-webgl");
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
      uLightDir: gl.getUniformLocation(prog, "uLightDir"),
    };
    gl.enable(gl.DEPTH_TEST);
    this.geos = { box: this._geo(cubeGeo()), sphere: this._geo(sphereGeo()), plane: this._geo(planeGeo()) };
    this.nodes = [];
    this.clear = [0.92, 0.90, 0.82];
    this.light = V.norm([0.5, 1.0, 0.35]);
  }

  _geo(g) {
    const gl = this.gl;
    const pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.pos), gl.STATIC_DRAW);
    const nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nor); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.nor), gl.STATIC_DRAW);
    const idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
    return { pos, nor, idx, count: g.idx.length };
  }

  /** Add a renderable. shape: "box"|"sphere"|"plane". color: hex string or [r,g,b]. */
  add(shape, color = "#cccccc", scale = [1, 1, 1]) {
    const node = { geo: this.geos[shape], color: toRGB(color), pos: [0, 0, 0], quat: [0, 0, 0, 1], scale, visible: true };
    this.nodes.push(node);
    return node;
  }
  remove(node) { const i = this.nodes.indexOf(node); if (i >= 0) this.nodes.splice(i, 1); }
  clearNodes() { this.nodes.length = 0; }

  resize() {
    const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== (w * dpr | 0) || c.height !== (h * dpr | 0)) { c.width = w * dpr | 0; c.height = h * dpr | 0; }
    this.aspect = (c.width || 1) / (c.height || 1);
  }

  render(eye, target, transparent) {
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (transparent) gl.clearColor(0, 0, 0, 0); else gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1);
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
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(this.loc.aPos); gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.nor); gl.enableVertexAttribArray(this.loc.aNormal); gl.vertexAttribPointer(this.loc.aNormal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
    }
  }
}

function toRGB(c) {
  if (Array.isArray(c)) return c;
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
