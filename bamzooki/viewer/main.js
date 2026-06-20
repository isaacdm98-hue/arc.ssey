// BAMZOOKi WebGL reconstruction — phase 1 viewer.
// Renders a placeholder "contest arena" (the seed of the engine) and a gallery
// of the real plaintext assets extracted from your own copy of the game.
//
// Assets live in ./assets/ with ./assets/manifest.json, both produced by
// tools/extract_assets.sh and git-ignored (no copyrighted assets in the repo).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const statusEl = document.getElementById("status");
const gallery = document.getElementById("gallery");
const canvas = document.getElementById("scene");

/* ---------------------------------------------------------------- 3D arena -- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // crisp on retina
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
camera.position.set(6, 5, 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
// Touch: one finger orbits, two fingers dolly/pan — natural on iPhone.
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x202830, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(5, 10, 7);
scene.add(key);

// Contest floor + grid (stand-in for the real arena defined in the data files).
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(8, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x223044, roughness: 0.9 })
);
scene.add(floor);
scene.add(new THREE.PolarGridHelper(8, 16, 8, 64, 0x2c3a52, 0x18222f));

// A placeholder "Zook": jointed limbs hint at the creature model that the
// decrypted .sax data will eventually drive (phase 3-4).
function placeholderZook() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x46c7ff, roughness: 0.4, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 2), mat);
  body.position.y = 1.4;
  g.add(body);
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.9, 4, 8);
  for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]]) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(x, 0.7, z);
    g.add(leg);
  }
  return g;
}
const zook = placeholderZook();
scene.add(zook);

let lastW = 0, lastH = 0;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w !== lastW || h !== lastH) {
    lastW = w; lastH = h;
    renderer.setSize(w, h, false); // false: drive the buffer, keep CSS size from layout
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
}
function animate(t) {
  resize();
  zook.rotation.y = t * 0.0003;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* -------------------------------------------------------------- asset load -- */
async function loadAssets() {
  try {
    const res = await fetch("./assets/manifest.json");
    if (!res.ok) throw new Error("no manifest");
    const { assets } = await res.json();
    statusEl.textContent =
      `Loaded ${assets.length} plaintext assets.\n` +
      `Encrypted .sax/.ssx: not yet decryptable (roadmap phase 2).`;
    for (const rel of assets) {
      const card = document.createElement("div");
      card.className = "thumb";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = `./assets/${rel}`;
      const label = document.createElement("span");
      label.textContent = rel;
      card.append(img, label);
      gallery.append(card);
    }
  } catch {
    statusEl.textContent =
      "No assets found.\nRun  tools/extract_assets.sh /path/to/your/installer.exe\n" +
      "then reload this page.";
  }
}
loadAssets();

/* ------------------------------------------------------------------- tabs -- */
const tab3d = document.getElementById("tab-3d");
const tabAssets = document.getElementById("tab-assets");
tab3d.onclick = () => {
  gallery.classList.remove("show");
  tab3d.classList.add("active"); tabAssets.classList.remove("active");
};
tabAssets.onclick = () => {
  gallery.classList.add("show");
  tabAssets.classList.add("active"); tab3d.classList.remove("active");
};

/* -------------------------------------------------------- PWA: SW + install -- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) =>
      console.warn("SW registration failed:", e));
  });
}

let deferredPrompt = null;
const installBtn = document.getElementById("install");
const iosHint = document.getElementById("iosHint");

// Detect iPhone/iPad Safari (which never fires beforeinstallprompt) and, when
// not already installed, show the "Share -> Add to Home Screen" instructions.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;
if (isIOS && !isStandalone) iosHint.style.display = "block";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "block";
});
installBtn.onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = "none";
};
window.addEventListener("appinstalled", () => { installBtn.style.display = "none"; });
