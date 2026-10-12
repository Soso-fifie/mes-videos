// Orchestration des séquences 1 → 6 : un seul moteur WebGL, une couche SVG plate au-dessus.
// Chaque image est calculée uniquement à partir du temps HyperFrames (événement hf-seek) :
// aucune horloge, aucun hasard non semé, aucune boucle requestAnimationFrame.
import * as THREE from "three";
import { W, H, K, SEQ } from "./config.js";
import { createGears } from "./gears.js";
import { createDrop } from "./drop.js";
import { createWorld } from "./world.js";
import { createWater } from "./water.js";
import { createOverlay } from "./overlay.js";

const canvas = document.getElementById("u-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const gears = createGears(renderer);
const drop = createDrop();
const world = createWorld();
const water = createWater();
const overlay = createOverlay(document.getElementById("u-svg"));
const labelAnchors = world.pickLabelAnchors();

// Bascule entre les scènes (temps absolus)
const GEARS_UNTIL = K.gearsOut[1] + 0.05;   // l'anneau d'engrenages a disparu
const DROP_FROM = K.dropSwap[0];             // relais net : la goutte 3D reprend l'image exacte de la pupille
const WORLD_FROM = K.dive[1];                // on a traversé la surface de la goutte

let last = -1;
function renderAt(time) {
  const t = Math.max(0, Math.min(SEQ.S6[1] - 1e-4, Number(time) || 0));
  if (t === last) return;
  last = t;
  let labelPos = null;
  if (t < GEARS_UNTIL) gears.render(t, true);
  else if (t < DROP_FROM) gears.render(t, false);
  else if (t < WORLD_FROM) drop.render(renderer, t);
  else {
    world.render(renderer, t);
    if (t >= K.waterIn[0]) water.render(renderer, t);
    if (t >= K.labelsIn[0] && t < K.labelsOut[1]) labelPos = labelAnchors.map((i) => world.project(world.particles[i].pos));
  }
  overlay.update(t, { labelPos });
}

window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
window.__soUniversRender = renderAt;   // aide au débogage
if (window.__soUniversReady) window.__soUniversReady();
