// Séquence 3a : la pupille plate devient une goutte 3D ; la caméra entre dans la goutte.
// À l'instant du relais, l'image 3D est identique au tracé SVG : disque #fc0017 de même rayon,
// même découpe blanche. La découpe se transforme ensuite en reflet spéculaire.
import * as THREE from "three";
import { W, H, FOV, RED, WHITE, CX, CY, K, PUPIL_BIG_R, NOTCH } from "./config.js";
import { prog, lerp, ease, hex3 } from "./util.js";

const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
/** Distance caméra–centre pour qu'une sphère de rayon 1 apparaisse avec un rayon de rpx pixels. */
export const distForRadiusPx = (rpx) => 1 / Math.sin(Math.atan((rpx * TAN) / (H / 2)));
const radiusPxForDist = (d) => ((H / 2) * Math.tan(Math.asin(1 / d))) / TAN;

export const DROP_SHADER = {
  vertex: `
    uniform float uWobble; uniform float uTime;
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 p = position;
      float w = sin(p.x * 3.1 + uTime * 2.3) * sin(p.y * 2.7 - uTime * 1.7) * sin(p.z * 2.3 + uTime * 1.3);
      p += normal * w * uWobble;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  // Couleurs en sRGB, écrites telles quelles (pas de conversion) : la base est exactement #fc0017.
  fragment: `
    uniform vec3 uRed; uniform float uVolume; uniform float uOpacity;
    uniform vec2 uCenterPx; uniform float uRadiusPx;
    uniform vec2 uHiC; uniform float uHiR; uniform float uHiSoft; uniform float uHiAmt;
    uniform vec3 uLightDir;
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 n = normalize(vN);
      vec3 v = normalize(vV);
      vec3 col = uRed;
      float diff = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
      vec3 shaded = uRed * (0.60 + 0.40 * diff);
      float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);
      shaded = mix(shaded, vec3(0.50, 0.0, 0.035), rim * 0.55);           // absorption sur les bords
      float caus = smoothstep(0.45, 0.95, dot(n, normalize(vec3(-0.35, -0.8, 0.5))));
      shaded += vec3(1.0, 0.42, 0.48) * caus * 0.32;                       // lumière transmise (bas)
      col = mix(col, shaded, uVolume);
      // reflet : défini dans le repère écran de la goutte (identique à la découpe de la pupille)
      vec2 q = (gl_FragCoord.xy - uCenterPx) / uRadiusPx;
      float d = length(q - uHiC);
      float hi = 1.0 - smoothstep(uHiR - uHiSoft, uHiR + uHiSoft, d);
      col = mix(col, vec3(1.0), hi * uHiAmt);
      gl_FragColor = vec4(col, uOpacity);
    }`,
};

export function createDrop() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WHITE);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.01, 50);
  const uniforms = {
    uRed: { value: new THREE.Vector3(...hex3(RED)) },
    uVolume: { value: 0 },
    uOpacity: { value: 1 },
    uWobble: { value: 0 },
    uTime: { value: 0 },
    uCenterPx: { value: new THREE.Vector2(CX, H - CY) },
    uRadiusPx: { value: PUPIL_BIG_R },
    uHiC: { value: new THREE.Vector2(NOTCH.dx, -NOTCH.dy) },   // y vers le haut en coordonnées GL
    uHiR: { value: NOTCH.r },
    uHiSoft: { value: 0.0012 },
    uHiAmt: { value: 1 },
    uLightDir: { value: new THREE.Vector3(0.35, 0.55, 0.75) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: DROP_SHADER.vertex, fragmentShader: DROP_SHADER.fragment });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat);
  scene.add(sphere);

  const d0 = distForRadiusPx(PUPIL_BIG_R);
  const dEnd = 1.012;

  function render(renderer, t) {
    const kv = ease.inOutSine(prog(t, K.dropVolume));
    const kd = ease.inCubic(prog(t, K.dive));
    // approche exponentielle de la surface : accélération continue
    const d = 1 + (d0 - 1) * Math.pow((dEnd - 1) / (d0 - 1), kd);
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    uniforms.uRadiusPx.value = radiusPxForDist(d);
    uniforms.uTime.value = t;
    uniforms.uVolume.value = kv;
    uniforms.uWobble.value = lerp(0, 0.025, kv) * (1 - kd);
    // la découpe nette devient un reflet doux, plus petit, légèrement déplacé
    uniforms.uHiC.value.set(lerp(NOTCH.dx, 0.40, kv), lerp(-NOTCH.dy, 0.50, kv));
    uniforms.uHiR.value = lerp(NOTCH.r, 0.2, kv);
    uniforms.uHiSoft.value = lerp(0.0012, 0.12, kv);
    uniforms.uHiAmt.value = lerp(1, 0.92, kv);
    renderer.autoClear = true;
    renderer.render(scene, camera);
  }

  return { render };
}
