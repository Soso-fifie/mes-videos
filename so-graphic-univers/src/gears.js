// Séquences 1–2 : mécanisme horloger stylisé (Three.js).
// Des engrenages métalliques dorés s'emboîtent ; la caméra recule ; ils se rangent en anneau,
// passent en silhouette et dessinent le contour du cadran ; puis l'anneau se referme et disparaît.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import {
  W, H, FOV, GEAR_MODULE, RING_COUNT, CAM_S1, DIAL_R, K, GOLD, GOLD_LIGHT, NIGHT_CENTER, NIGHT_EDGE,
} from "./config.js";
import { TAU, prog, lerp, ease, clamp, hex3 } from "./util.js";

const C0_SPEED = -0.62;            // vitesse angulaire de la roue centrale (rad/s)
const DOF_BLUR_PX = 16;            // flou de la couche arrière au début (px, plein cadre) — profondeur de champ
const BACK_LAYER = 1;              // couche Three.js des engrenages d'arrière-plan (rendus flous)
const SILHOUETTE = "#2b2119";      // teinte des engrenages en silhouette

// Engrenages : N dents, couche z ; position fixe (at) ou engrènement sur un autre (mesh, dir en °).
const SPECS = [
  { id: "C0", N: 40, z: 0, at: [0, 0], spokes: 5 },
  { id: "C1", N: 20, z: 0, mesh: "C0", dir: 35, spokes: 4 },
  { id: "C2", N: 16, z: 0, mesh: "C0", dir: 150 },
  { id: "C3", N: 28, z: 0, mesh: "C0", dir: 245, spokes: 5 },
  { id: "C4", N: 12, z: 0, mesh: "C1", dir: 95 },
  { id: "C5", N: 24, z: 0, mesh: "C3", dir: 320, spokes: 4 },
  { id: "C6", N: 18, z: 0, mesh: "C2", dir: 110 },
  { id: "C7", N: 30, z: 0, mesh: "C1", dir: -20, spokes: 5 },
  { id: "B0", N: 56, z: -2.4, at: [1.9, 1.8], spokes: 6, speed: 0.28 },
  { id: "B1", N: 36, z: -2.4, mesh: "B0", dir: 205, spokes: 5 },
  { id: "B2", N: 44, z: -2.4, at: [-2.1, -1.7], spokes: 6, speed: -0.33 },
  { id: "B3", N: 24, z: -2.4, mesh: "B2", dir: 60, spokes: 4 },
  { id: "B4", N: 32, z: -2.4, mesh: "B2", dir: -55, spokes: 5 },
  { id: "F0", N: 34, z: 1.5, at: [-1.8, 2.0], spokes: 5, speed: 0.4 },
  { id: "F1", N: 22, z: 1.5, at: [1.6, -2.15], spokes: 4, speed: -0.5 },
  { id: "F2", N: 14, z: 1.5, mesh: "F1", dir: 150 },
];

const pitchR = (N) => (GEAR_MODULE * N) / 2;

/** Profil d'engrenage horloger : dents trapézoïdales, moyeu percé, bras (rayons). */
function gearGeometry(N, spokes) {
  const rp = pitchR(N);
  const rTip = rp + GEAR_MODULE * 0.95;
  const rRoot = rp - GEAR_MODULE * 1.15;
  const pitch = TAU / N;
  const shape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const c = i * pitch;
    const pts = [
      [rRoot, c - pitch * 0.5],
      [rRoot, c - pitch * 0.29],
      [rTip, c - pitch * 0.15],
      [rTip, c + pitch * 0.15],
      [rRoot, c + pitch * 0.29],
    ];
    pts.forEach(([r, a], k) => {
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const rHole = Math.max(0.035, rp * 0.09);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rHole, 0, TAU, true);
  shape.holes.push(hole);
  if (spokes) {
    const rimIn = rRoot - Math.max(0.06, rp * 0.13);
    const hubOut = Math.max(rHole + 0.05, rp * 0.24);
    const spokeW = Math.max(0.035, rp * 0.075);
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * TAU, a1 = ((s + 1) / spokes) * TAU;
      const pad = (r) => spokeW / r;
      const cut = new THREE.Path();
      cut.absarc(0, 0, rimIn, a0 + pad(rimIn), a1 - pad(rimIn), false);
      cut.absarc(0, 0, hubOut, a1 - pad(hubOut), a0 + pad(hubOut), true);
      cut.closePath();
      shape.holes.push(cut);
    }
  }
  const depth = 0.06 + rp * 0.04;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 18,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createGears(renderer) {
  // --- fond : dégradé radial chaud, tramé pour éviter les bandes -------------
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      uC: { value: new THREE.Vector3(...hex3(NIGHT_CENTER)) },
      uE: { value: new THREE.Vector3(...hex3(NIGHT_EDGE)) },
      uGlow: { value: 1.0 },
      uRes: { value: new THREE.Vector2(W, H) },
    },
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform vec3 uC; uniform vec3 uE; uniform float uGlow; uniform vec2 uRes;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
        float r = length(p * vec2(1.0, 0.92));
        vec3 c = mix(uC, uE, smoothstep(0.02, 0.78, r));
        c += vec3(0.20, 0.12, 0.04) * uGlow * exp(-r * r * 9.0) * 0.55;   // halo doré
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  // --- scène des engrenages --------------------------------------------------
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.Fog(new THREE.Color(NIGHT_EDGE), 4, 22);

  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x1a120a, 0.55);
  const key = new THREE.DirectionalLight(new THREE.Color(GOLD_LIGHT), 3.2);
  key.position.set(-3, 4, 6);
  const rim = new THREE.DirectionalLight(0xff9a4a, 2.2);
  rim.position.set(4, -2, -3);
  const warm = new THREE.PointLight(0xffb060, 18, 14, 1.6);
  warm.position.set(0.6, 0.8, 3.2);
  scene.add(hemi, key, rim, warm);
  [hemi, key, rim, warm].forEach((l) => l.layers.enableAll());

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(GOLD), metalness: 1.0, roughness: 0.3, envMapIntensity: 1.0,
  });
  const matBack = material.clone();
  matBack.color = new THREE.Color("#a57c3e");
  matBack.roughness = 0.42;

  const goldC = new THREE.Color(GOLD), silC = new THREE.Color(SILHOUETTE), goldBackC = new THREE.Color("#a57c3e");

  // Construction et engrènement
  const byId = {};
  const geoCache = {};
  const gears = SPECS.map((s) => {
    const key2 = `${s.N}-${s.spokes || 0}`;
    geoCache[key2] = geoCache[key2] || gearGeometry(s.N, s.spokes || 0);
    const mesh = new THREE.Mesh(geoCache[key2], s.z < 0 ? matBack : material);
    const g = { ...s, mesh, r: pitchR(s.N) };
    if (s.mesh) {
      const p = byId[s.mesh];
      const d = p.r + g.r;
      const a = (s.dir * Math.PI) / 180;
      g.pos = [p.pos[0] + d * Math.cos(a), p.pos[1] + d * Math.sin(a)];
      g.parent = p;
      g.phi = a;
    } else {
      g.pos = s.at;
    }
    byId[s.id] = g;
    if (s.z < 0) mesh.layers.set(BACK_LAYER);
    scene.add(mesh);
    return g;
  });
  byId.C0.speed = C0_SPEED;

  // Angle d'une roue : roue libre (speed) ou entraînée par sa roue mère (rapport des dents + calage).
  function clusterAngle(g, t) {
    if (!g.parent) return (g.speed || 0) * t;
    const pa = clusterAngle(g.parent, t);
    return -(g.parent.N / g.N) * (pa - g.phi) + g.phi + Math.PI - Math.PI / g.N;
  }

  // Anneau final : rayon calculé pour que le bord intérieur des dents dessine le cadran.
  const ppuEnd = H / (2 * CAM_S1[1] * Math.tan(((FOV / 2) * Math.PI) / 180));
  const dialR = DIAL_R / ppuEnd;
  const sinA = Math.sin(Math.PI / RING_COUNT);
  const ringR = dialR / (1 - 0.92 * sinA);
  const ringGearR = ringR * sinA;
  // Attribution des places sur l'anneau selon la position angulaire de départ (pas de croisements).
  const order = gears
    .map((g, i) => ({ i, a: Math.atan2(g.pos[1], g.pos[0]) }))
    .sort((p, q) => q.a - p.a);
  order.forEach((o, k) => {
    const g = gears[o.i];
    const beta = Math.PI / 2 - (k / RING_COUNT) * TAU + 0.35;
    g.slot = k;
    g.ring = [ringR * Math.cos(beta), ringR * Math.sin(beta)];
    g.ringScale = ringGearR / g.r;
  });

  // --- profondeur de champ simulée : couche arrière rendue à mi-résolution puis floutée --------
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat };
  const rtA = new THREE.WebGLRenderTarget(W / 2, H / 2, { ...rtOpts, depthBuffer: true });
  const rtB = new THREE.WebGLRenderTarget(W / 2, H / 2, { ...rtOpts, depthBuffer: false });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec4 c = vec4(0.0); float wsum = 0.0;
        for (int i = -6; i <= 6; i++) {
          float x = float(i) / 6.0;
          float w = exp(-x * x * 3.0);
          c += texture2D(tex, vUv + dir * x) * w; wsum += w;
        }
        gl_FragColor = c / wsum;   // couleurs prémultipliées
      }`,
    depthTest: false, depthWrite: false,
  });
  const compMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null } },
    vertexShader: quadVS,
    fragmentShader: `
      uniform sampler2D tex; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tex, vUv);
        gl_FragColor = vec4(c.rgb / max(c.a, 1e-4), c.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const clearC = new THREE.Color();

  function renderBlurredBackLayer(blurPx) {
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearC);
    renderer.setClearColor(0x000000, 0);
    camera.layers.set(BACK_LAYER);
    renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, camera);
    const r = blurPx / 2;                                    // rayon en texels de la cible mi-résolution
    quad.material = blurMat;
    blurMat.uniforms.tex.value = rtA.texture; blurMat.uniforms.dir.value.set(r / (W / 2), 0);
    renderer.setRenderTarget(rtB); renderer.clear(); renderer.render(quadScene, quadCam);
    blurMat.uniforms.tex.value = rtB.texture; blurMat.uniforms.dir.value.set(0, r / (H / 2));
    renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(quadScene, quadCam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearC, prevAlpha);
    quad.material = compMat;
    compMat.uniforms.tex.value = rtA.texture;
    renderer.render(quadScene, quadCam);
    camera.layers.set(0);
  }

  let blurNow = 0;

  function cameraDistance(t) {
    return lerp(CAM_S1[0], CAM_S1[1], ease.inOutCubic(prog(t, K.camPull)));
  }

  function update(t) {
    const d = cameraDistance(t);
    camera.position.set(0.0, 0.0, d);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    scene.fog.near = d - 0.5;
    scene.fog.far = d + 7.5;

    const kRing = ease.inOutCubic(prog(t, K.ringForm));
    const kSil = ease.inOutSine(prog(t, K.silhouette));
    // flou de la couche arrière : décroît avec le recul de la caméra et quand les roues rejoignent l'anneau
    blurNow = DOF_BLUR_PX * (CAM_S1[0] / camera.position.z) * (1 - kRing);
    material.color.copy(goldC).lerp(silC, kSil);
    matBack.color.copy(goldBackC).lerp(silC, kSil);
    material.envMapIntensity = lerp(1.0, 0.22, kSil);
    matBack.envMapIntensity = lerp(0.8, 0.22, kSil);
    material.roughness = lerp(0.3, 0.5, kSil);
    key.intensity = lerp(3.2, 0.9, kSil);
    warm.intensity = lerp(18, 3, kSil);
    rim.intensity = lerp(2.2, 3.4, kSil);
    bgMat.uniforms.uGlow.value = lerp(1.0, 0.65, kSil);

    gears.forEach((g, i) => {
      const a0 = clusterAngle(g, t);
      const aRing = (g.slot % 2 === 0 ? 1 : -1) * 0.9 * t + g.slot * 0.4;
      // décalage individuel : les roues ne partent pas toutes en même temps
      const lag = (g.slot / RING_COUNT) * 0.18;
      const k = ease.inOutCubic(clamp((kRing - lag) / (1 - 0.18)));
      const x = lerp(g.pos[0], g.ring[0], k);
      const y = lerp(g.pos[1], g.ring[1], k);
      const z = lerp(g.z, 0, k) + Math.sin(k * Math.PI) * 0.6;
      let s = lerp(1, g.ringScale, k);
      // S2 : l'anneau se referme — chaque roue se résorbe à son tour
      const kOut = ease.inCubic(clamp(prog(t, K.gearsOut) * 1.6 - (g.slot / RING_COUNT) * 0.6));
      s *= 1 - kOut;
      g.mesh.position.set(x, y, z);
      g.mesh.rotation.set(0, 0, lerp(a0, aRing, k) + kOut * 1.2 * (g.slot % 2 ? 1 : -1));
      g.mesh.scale.setScalar(Math.max(1e-4, s));
      g.mesh.visible = s > 1e-3;
    });
  }

  function render(t, withGears = true) {
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(bgScene, bgCam);
    if (withGears) {
      update(t);
      if (blurNow > 0.8) renderBlurredBackLayer(blurNow);
      else camera.layers.enableAll();
      renderer.clearDepth();
      renderer.render(scene, camera);
      camera.layers.set(0);
    }
  }

  return { render, cameraDistance, ppuAt: (t) => H / (2 * cameraDistance(t) * Math.tan(((FOV / 2) * Math.PI) / 180)) };
}
