// Séquences 3b → 6 : un seul monde 3D, une seule caméra continue.
//  3b  intérieur de la goutte : champ de particules (molécules / cellules) + micro-légendes
//  4   recul : les particules se regroupent en une goutte, lévitation, chute courbe, tache sur le tissu
//  5   plongée dans la tache → fibres 3D tissées, le rouge circule dans les fils
//  6   la caméra remonte à la verticale, le tissage s'enroule en spirale (rotation du tambour)
import * as THREE from "three";
import {
  W, H, FOV, RED, WHITE, WINE, STUDIO, IVORY, K, DROP_R, STAIN_R, THREAD_SPACING, FIBER_COUNT,
  TOP_HEIGHT, SEED,
} from "./config.js";
import { TAU, prog, lerp, clamp, ease, rng, hex3, catmull } from "./util.js";
import { DROP_SHADER } from "./drop.js";

// ---- Positions (unités monde) --------------------------------------------------
const D = new THREE.Vector3(-0.25, 1.55, -0.3);       // formation de la goutte
const FALL_PATH = [[-0.25, 1.55, -0.3], [0.06, 1.12, -0.2], [0.14, 0.6, -0.07], [0.0, DROP_R, 0.0]];
const N_PARTICLES = 420;
const S = THREAD_SPACING;
const HALF = (FIBER_COUNT / 2) * S;                  // demi-côté de la zone de fils 3D
const THREAD_R = 0.30 * S;
const WAVE_A = 0.26 * S;
const THREAD_H0 = THREAD_R + WAVE_A;

// ---- Caméra : poses clés [temps, position, cible] -------------------------------
// (les poses intermédiaires sont interpolées ; la verticale finale est gérée à part)
const CAM = {
  inside0: [D.x, D.y, D.z + 3.0],
  inside1: [D.x + 0.05, D.y - 0.02, D.z + 1.55],
  out: [D.x + 0.30, D.y - 0.18, D.z + 2.75],
  levit: [D.x + 0.42, D.y - 0.10, D.z + 2.35],
  fallEnd: [0.16, 1.18, 2.05],
  impactEnd: [0.08, 1.12, 1.92],
  pushEnd: [0.0, 0.52, 0.26],
  pushTarget: [0.0, 0.0, -0.10],
  glideEnd: [0.22, 0.40, -0.06],
  glideTarget: [0.40, 0.0, -0.38],
};

const SHARED_GLSL = `
  #define PI 3.14159265
  uniform float uSpacing; uniform float uStainR; uniform float uFlow; uniform float uTime;
  uniform vec3 uBase; uniform vec3 uRed; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
  uniform float uDesat; uniform float uWhite;
  float hash1(float n){ n = floor(n * 100.0 + 0.5) / 100.0; return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
  // Part de rouge d'un fil : la tache, plus une remontée capillaire le long des fils qui la traversent.
  float threadRed(float along, float across, float idx, float axis, float R){
    float hl = sqrt(max(R * R - across * across, 0.0));
    float has = step(1e-5, hl);
    float h = hash1(idx * 1.37 + axis * 91.7);
    float L = uFlow * (0.30 + 0.70 * h) * has;
    float front = hl + L;
    float edge = uSpacing * 0.8;
    float red = has * (1.0 - smoothstep(front - edge, front + edge, abs(along)));
    // impulsions qui courent vers l'extérieur
    float pulse = 0.5 + 0.5 * sin((abs(along) - uTime * 0.22) * 55.0 + h * 6.28);
    return red * mix(1.0, 0.82 + 0.18 * pulse, step(hl, abs(along)));
  }
  vec3 finish(vec3 col, float dist){
    col = mix(col, vec3(1.0), uDesat);           // la tache se dilue
    col = mix(col, vec3(1.0), uWhite);           // blanc pur
    float f = smoothstep(uFogNear, uFogFar, dist);
    return mix(col, uFogColor, f);
  }
`;

function toSRGBVec3(color) {
  const c = color.clone().convertLinearToSRGB();
  return new THREE.Vector3(c.r, c.g, c.b);
}

export function createWorld() {
  const scene = new THREE.Scene();
  const bgColor = new THREE.Color(WINE);
  scene.background = bgColor;
  scene.fog = new THREE.Fog(bgColor.clone(), 1, 8);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.004, 120);

  const cRed = new THREE.Color(RED), cWhite = new THREE.Color("#fff4f4"), cWine = new THREE.Color(WINE);
  const cStudio = new THREE.Color(STUDIO), cPure = new THREE.Color(WHITE);
  const cRedEntry = new THREE.Color().setRGB(...hex3(RED).map((v) => v * 0.9), THREE.SRGBColorSpace);

  // ===========================================================================
  // Particules (séq. 3b, 4)
  // ===========================================================================
  const rand = rng(SEED);
  const P = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    let x = (rand() - 0.5) * 5.4, y = (rand() - 0.5) * 6.4, z = -5.5 + rand() * 7.6;
    // garder le couloir de la caméra dégagé
    const dxy = Math.hypot(x, y);
    if (z > -0.4 && dxy < 0.32) { const k = 0.32 / Math.max(dxy, 1e-3); x *= k; y *= k; }
    const red = rand() < 0.42;
    // cible sur la goutte : sphère de Fibonacci
    const fy = 1 - (2 * (i + 0.5)) / N_PARTICLES, fr = Math.sqrt(1 - fy * fy), fa = i * 2.399963;
    P.push({
      base: new THREE.Vector3(D.x + x, D.y + y, D.z + z),
      r: 0.016 + Math.pow(rand(), 2.2) * 0.062,
      red,
      ph: [rand() * TAU, rand() * TAU, rand() * TAU],
      fr: [0.6 + rand() * 0.6, 0.5 + rand() * 0.6, 0.5 + rand() * 0.5],
      delay: rand() * 0.35 * clamp((D.z + 1.55 - (D.z + z)) / 2.5),   // les plus proches de la caméra partent d'abord
      target: new THREE.Vector3(D.x + Math.cos(fa) * fr * DROP_R * 0.9, D.y + fy * DROP_R * 0.9, D.z + Math.sin(fa) * fr * DROP_R * 0.9),
      pos: new THREE.Vector3(),
    });
  }
  const sphereGeo = new THREE.IcosahedronGeometry(1, 2);
  const pMat = new THREE.MeshBasicMaterial({ toneMapped: false, fog: true });
  const pMesh = new THREE.InstancedMesh(sphereGeo, pMat, N_PARTICLES);
  pMesh.frustumCulled = false;
  scene.add(pMesh);

  // halos lumineux (additifs)
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(N_PARTICLES * 3), glowCol = new Float32Array(N_PARTICLES * 3), glowSize = new Float32Array(N_PARTICLES);
  glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute("aColor", new THREE.BufferAttribute(glowCol, 3));
  glowGeo.setAttribute("aSize", new THREE.BufferAttribute(glowSize, 1));
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: H / (2 * Math.tan(((FOV / 2) * Math.PI) / 180)) }, uAlpha: { value: 1 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = aColor;
        gl_PointSize = clamp(aSize * uScale / -mv.z, 0.0, 220.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uAlpha; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-d * d * 4.0) * (1.0 - d);
        gl_FragColor = vec4(vC * a * uAlpha, 1.0); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Points(glowGeo, glowMat);
  glow.frustumCulled = false;
  scene.add(glow);

  // liaisons : 2 plus proches voisins
  const pairs = [];
  P.forEach((a, i) => {
    const near = P.map((b, j) => ({ j, d: j === i ? 1e9 : a.base.distanceTo(b.base) }))
      .sort((u, v) => u.d - v.d).slice(0, 3).filter((n) => n.d < 0.85);
    near.forEach((n) => { if (!pairs.some(([p, q]) => (p === n.j && q === i))) pairs.push([i, n.j]); });
  });
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(pairs.length * 6), lineCol = new Float32Array(pairs.length * 6);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, fog: true, toneMapped: false, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  scene.add(lines);

  // ===========================================================================
  // Goutte (séq. 4)
  // ===========================================================================
  const dropUniforms = {
    uRed: { value: new THREE.Vector3(...hex3(RED)) }, uVolume: { value: 1 }, uOpacity: { value: 0 },
    uWobble: { value: 0.02 }, uTime: { value: 0 }, uCenterPx: { value: new THREE.Vector2() }, uRadiusPx: { value: 100 },
    uHiC: { value: new THREE.Vector2(0.4, 0.5) }, uHiR: { value: 0.2 }, uHiSoft: { value: 0.12 }, uHiAmt: { value: 0.92 },
    uLightDir: { value: new THREE.Vector3(0.35, 0.55, 0.75) },
  };
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(DROP_R, 96, 72),
    new THREE.ShaderMaterial({ uniforms: dropUniforms, vertexShader: DROP_SHADER.vertex, fragmentShader: DROP_SHADER.fragment, transparent: true }),
  );
  drop.renderOrder = 3;
  scene.add(drop);

  // ===========================================================================
  // Tissu (séq. 4–6) : plan + tissage procédural, la tache, la spirale, la dilution
  // ===========================================================================
  const fabricUniforms = {
    uSpacing: { value: S }, uStainR: { value: 0 }, uFlow: { value: 0 }, uTime: { value: 0 },
    uBase: { value: new THREE.Vector3(...hex3(IVORY)) }, uRed: { value: new THREE.Vector3(...hex3(RED)) },
    uFogColor: { value: new THREE.Vector3() }, uFogNear: { value: 1 }, uFogFar: { value: 10 },
    uDesat: { value: 0 }, uWhite: { value: 0 },
    uOpacity: { value: 0 }, uWeave: { value: 1 }, uHole: { value: 0 }, uHoleR: { value: HALF - 0.07 },
    uTwist: { value: 0 }, uSpin: { value: 0 }, uStainWeave: { value: 0 },
  };
  const fabric = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: fabricUniforms, transparent: true,
      vertexShader: `
        varying vec3 vWorld; varying float vDist;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
          vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: SHARED_GLSL + `
        uniform float uOpacity; uniform float uWeave; uniform float uHole; uniform float uHoleR;
        uniform float uTwist; uniform float uSpin; uniform float uStainWeave;
        varying vec3 vWorld; varying float vDist;
        mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
        void main(){
          vec2 p0 = vWorld.xz;
          float r0 = length(p0);
          vec2 p = rot(uSpin + uTwist * exp(-r0 * 1.25)) * p0;
          float R = uStainR + uDesat * 0.35;
          vec2 uv = p / uSpacing;
          vec2 cell = floor(uv);
          vec2 f = fract(uv) - 0.5;
          float warpTop = 1.0 - mod(cell.x + cell.y, 2.0);
          float warpBody = smoothstep(0.45, 0.33, abs(f.y));
          float weftBody = smoothstep(0.45, 0.33, abs(f.x));
          float onWarp = warpTop > 0.5 ? warpBody : (1.0 - weftBody) * warpBody;
          float onWeft = warpTop > 0.5 ? (1.0 - warpBody) * weftBody : weftBody;
          float gap = clamp(1.0 - onWarp - onWeft, 0.0, 1.0);
          float arch = cos(f.x * PI) * (warpTop * 2.0 - 1.0);
          float shWarp = 0.84 + 0.16 * cos(f.y * PI) * (0.7 + 0.3 * arch);
          float shWeft = 0.84 + 0.16 * cos(f.x * PI) * (0.7 - 0.3 * cos(f.y * PI) * (warpTop * 2.0 - 1.0));
          float aa = max(fwidth(length(p)), 1e-5);
          float disk = 1.0 - smoothstep(R - aa, R + aa, length(p));
          float rWarp = max(threadRed(p.x, (cell.y + 0.5) * uSpacing, cell.y, 0.0, R), disk);
          float rWeft = max(threadRed(p.y, (cell.x + 0.5) * uSpacing, cell.x, 1.0, R), disk);
          vec3 woven = mix(uBase, uRed, rWarp) * shWarp * onWarp
                     + mix(uBase, uRed, rWeft) * shWeft * onWeft
                     + mix(uBase * 0.86, uRed * 0.72, max(disk, 0.5 * (rWarp + rWeft))) * gap;
          vec3 flatc = mix(uBase, uRed, max(disk, 0.5 * (rWarp + rWeft)));
          float detail = clamp(1.25 - fwidth(uv.x) * 1.6, 0.0, 1.0) * uWeave;
          vec3 col = mix(flatc, woven, detail);
          col = mix(col, uRed, disk * (1.0 - uStainWeave));   // la tache reste un aplat #fc0017 jusqu'à la plongée
          // ouverture centrale : laisse voir les fils 3D (séq. 5)
          float box = max(abs(p0.x), abs(p0.y));
          float inHole = uHole * (1.0 - smoothstep(uHoleR - 0.03, uHoleR, box));
          vec3 shadowCol = mix(uBase, uRed, max(disk, 0.5 * (rWarp + rWeft))) * 0.42;
          col = mix(col, shadowCol, inHole);
          gl_FragColor = vec4(finish(col, vDist), uOpacity);
        }`,
    }),
  );
  fabric.renderOrder = 1;
  scene.add(fabric);

  // ===========================================================================
  // Fibres 3D (séq. 5) : chaîne (le long de x) et trame (le long de z), dessus / dessous
  // ===========================================================================
  const fiberUniforms = {
    uSpacing: { value: S }, uStainR: { value: STAIN_R }, uFlow: { value: 0 }, uTime: { value: 0 },
    uBase: { value: new THREE.Vector3(...hex3(IVORY)) }, uRed: { value: new THREE.Vector3(...hex3(RED)) },
    uFogColor: { value: new THREE.Vector3() }, uFogNear: { value: 1 }, uFogFar: { value: 10 },
    uDesat: { value: 0 }, uWhite: { value: 0 }, uSink: { value: 0.06 },
    uLight: { value: new THREE.Vector3(-0.45, 0.8, 0.4).normalize() },
  };
  const fibers = new THREE.Mesh(buildFiberGeometry(), new THREE.ShaderMaterial({
    uniforms: fiberUniforms,
    vertexShader: `
      attribute float aAxis; attribute float aIdx; attribute float aAlong; attribute float aAcross;
      uniform float uSink;
      varying vec3 vN; varying float vDist; varying float vAxis; varying float vIdx; varying float vAlong; varying float vAcross;
      varying vec3 vWorld;
      void main(){
        vec3 p = position; p.y -= uSink;
        vec4 w = modelMatrix * vec4(p, 1.0); vWorld = w.xyz;
        vec4 mv = viewMatrix * w; vDist = -mv.z;
        vN = normalize(mat3(modelMatrix) * normal);
        vAxis = aAxis; vIdx = aIdx; vAlong = aAlong; vAcross = aAcross;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SHARED_GLSL + `
      uniform vec3 uLight;
      varying vec3 vN; varying float vDist; varying float vAxis; varying float vIdx; varying float vAlong; varying float vAcross;
      varying vec3 vWorld;
      void main(){
        vec3 n = normalize(vN);
        float R = uStainR + uDesat * 0.35;
        // index et axe arrondis : une valeur interpolée varie de quelques ulp et ferait « grésiller » le hachage
        float idx = floor(vIdx + 0.5), axis = floor(vAxis + 0.5);
        float red = max(threadRed(vAlong, (idx + 0.5) * uSpacing, idx, axis, R), 1.0 - smoothstep(R - 0.004, R + 0.004, length(vWorld.xz)));
        vec3 base = mix(uBase, uRed, red);
        float diff = clamp(dot(n, uLight) * 0.6 + 0.4, 0.0, 1.0);
        float ang = axis < 0.5 ? atan(n.y, n.z) : atan(n.y, n.x);
        float yarn = 0.93 + 0.07 * sin(vAlong * 420.0 + ang * 2.0);          // torsion du fil
        vec3 col = base * (0.42 + 0.62 * diff) * yarn;
        vec3 h = normalize(uLight + vec3(0.0, 0.3, 1.0));
        col += vec3(1.0) * pow(clamp(dot(n, h), 0.0, 1.0), 24.0) * 0.12;
        gl_FragColor = vec4(finish(col, vDist), 1.0);
      }`,
  }));
  fibers.renderOrder = 0;
  scene.add(fibers);

  // ===========================================================================
  // Mise à jour en fonction du temps
  // ===========================================================================
  const tmp = new THREE.Color();
  const v3 = new THREE.Vector3();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), m4 = new THREE.Matrix4();

  function dropState(t) {
    const pos = new THREE.Vector3().copy(D);
    let sy = 1, sxz = 1, opacity = 0;
    const kc = prog(t, K.converge);
    if (t < K.fall[0]) {
      opacity = ease.inOutSine(clamp((kc - 0.7) / 0.3));
      const bob = Math.sin(((t - K.levitate[0]) / 1.1) * TAU) * 0.03 * prog(t, K.levitate[0], K.levitate[0] + 0.3);
      pos.y += bob;
    } else if (t < K.impact[0]) {
      const u = ease.inOutCubic(prog(t, K.fall));
      pos.set(...catmull(FALL_PATH, u));
      opacity = 1;
      const st = Math.sin(Math.PI * u) * 0.09;
      sy = 1 + st; sxz = 1 - st * 0.4;
    } else {
      const k = ease.outCubic(prog(t, K.impact));
      sy = 1 - 0.97 * k; sxz = 1 + 0.55 * k;
      pos.set(0, DROP_R * sy, 0);
      opacity = 1 - ease.inQuad(clamp((k - 0.7) / 0.3));
    }
    return { pos, sy, sxz, opacity };
  }

  function lookQuat(pos, target, up = THREE.Object3D.DEFAULT_UP) {
    m4.lookAt(v3.set(...pos), new THREE.Vector3(...target), up);
    return new THREE.Quaternion().setFromRotationMatrix(m4);
  }
  const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

  function cameraPose(t, dropPos) {
    const Dv = [D.x, D.y, D.z];
    if (t < K.converge[0]) {
      const k = ease.inOutSine(prog(t, K.innerClear[0], K.converge[0]));
      const pos = L3(CAM.inside0, CAM.inside1, k);
      const yaw = lerp(-0.05, 0.12, k), pitch = lerp(0.03, -0.04, k);
      return { pos, target: [pos[0] + Math.sin(yaw), pos[1] + pitch, pos[2] - Math.cos(yaw)], roll: lerp(-0.04, 0.03, k) };
    }
    if (t < K.levitate[0]) {
      const k = ease.inOutCubic(prog(t, K.converge));
      const pos = L3(CAM.inside1, CAM.out, k);
      const fwd = [CAM.inside1[0] + Math.sin(0.12), CAM.inside1[1] - 0.04, CAM.inside1[2] - Math.cos(0.12)];
      return { pos, target: L3(fwd, Dv, ease.inOutSine(clamp(k * 1.4))), roll: lerp(0.03, 0, k) };
    }
    if (t < K.fall[0]) {
      const k = ease.inOutSine(prog(t, K.levitate));
      return { pos: L3(CAM.out, CAM.levit, k), target: Dv, roll: 0 };
    }
    if (t < K.impact[0]) {
      const k = ease.inOutCubic(prog(t, K.fall));
      const dp = [dropPos.x, dropPos.y, dropPos.z];
      return { pos: L3(CAM.levit, CAM.fallEnd, k), target: L3(dp, [dp[0], dp[1] - 0.12 * k, dp[2]], 1), roll: 0 };
    }
    if (t < K.pushIn[0]) {
      const k = ease.outSine(prog(t, K.impact[0], K.pushIn[0]));
      return { pos: L3(CAM.fallEnd, CAM.impactEnd, k), target: L3([0, DROP_R - 0.12, 0], [0, 0.0, 0], k), roll: 0 };
    }
    if (t < K.glide[0]) {
      const k = ease.inOutQuart(prog(t, K.pushIn));
      // trajectoire en arc : on plonge au-dessus de la tache
      const pos = L3(CAM.impactEnd, CAM.pushEnd, k);
      pos[1] += Math.sin(k * Math.PI) * 0.05;
      return { pos, target: L3([0, 0, 0], CAM.pushTarget, ease.inOutSine(k)), roll: 0 };
    }
    const k = ease.inOutSine(prog(t, K.glide));
    return { pos: L3(CAM.pushEnd, CAM.glideEnd, k), target: L3(CAM.pushTarget, CAM.glideTarget, k), roll: lerp(0, -0.05, k) };
  }

  function applyCamera(t, dropPos) {
    if (t >= K.rise[0]) {
      // remontée à la verticale : position en arc, orientation par slerp
      const g = cameraPose(K.rise[0] - 1e-4, dropPos);
      const k = ease.inOutCubic(prog(t, K.rise));
      qA.copy(lookQuat(g.pos, g.target));
      qB.copy(lookQuat([0, TOP_HEIGHT, 0], [0, 0, 0], new THREE.Vector3(0, 0, -1)));
      const hk = Math.pow(k, 1.6);
      camera.position.set(lerp(g.pos[0], 0, k), Math.exp(lerp(Math.log(g.pos[1]), Math.log(TOP_HEIGHT), hk)), lerp(g.pos[2], 0, k));
      camera.quaternion.copy(qA).slerp(qB, ease.inOutSine(clamp(k * 1.15)));
      camera.rotateZ(lerp(-0.05, 0, k));
    } else {
      const p = cameraPose(t, dropPos);
      camera.position.set(...p.pos);
      camera.quaternion.copy(lookQuat(p.pos, p.target));
      camera.rotateZ(p.roll);
    }
    camera.updateMatrixWorld();
  }

  function setEnv(t) {
    // fond et brouillard
    let fogNear = 1.2, fogFar = 7;
    if (t < K.innerClear[1]) {
      const k = ease.outCubic(prog(t, K.innerClear));
      bgColor.copy(cRedEntry).lerp(cWine, k);
      fogNear = lerp(0.02, 1.2, k); fogFar = lerp(0.25, 7, k);
    } else if (t < K.levitate[0]) {
      const k = ease.inOutSine(clamp((prog(t, K.converge) - 0.64) / 0.24));
      bgColor.copy(cWine).lerp(cStudio, k);
      fogNear = lerp(1.2, 3, k); fogFar = lerp(7, 16, k);
    } else if (t < K.pushIn[1]) {
      bgColor.copy(cStudio);
      const k = ease.inOutSine(prog(t, K.pushIn));
      fogNear = lerp(3, 0.35, k); fogFar = lerp(16, 1.3, k);
    } else if (t < K.rise[0]) {
      bgColor.copy(cStudio);
      fogNear = 0.35; fogFar = 1.3;
    } else {
      const k = ease.inOutSine(prog(t, K.rise));
      bgColor.copy(cStudio).lerp(cPure, k);
      fogNear = lerp(0.35, 40, k); fogFar = lerp(1.3, 60, k);
    }
    scene.fog.color.copy(bgColor);
    scene.fog.near = fogNear; scene.fog.far = fogFar;
    const fogSRGB = toSRGBVec3(bgColor);
    [fabricUniforms, fiberUniforms].forEach((u) => {
      u.uFogColor.value.copy(fogSRGB); u.uFogNear.value = fogNear; u.uFogFar.value = fogFar; u.uTime.value = t;
    });
  }

  function update(t) {
    setEnv(t);
    const ds = dropState(t);

    // --- particules ---------------------------------------------------------
    const kc = prog(t, K.converge);
    const showP = t < K.levitate[0] + 0.05;
    pMesh.visible = glow.visible = lines.visible = showP;
    if (showP) {
      const m = new THREE.Matrix4();
      P.forEach((p, i) => {
        const drift = 0.07;
        p.pos.set(
          p.base.x + drift * Math.sin(t * p.fr[0] + p.ph[0]),
          p.base.y + drift * Math.sin(t * p.fr[1] + p.ph[1]),
          p.base.z + drift * Math.sin(t * p.fr[2] + p.ph[2]),
        );
        const k = ease.inOutCubic(clamp((kc - p.delay) / (1 - 0.35)));
        p.pos.lerp(p.target, k);
        const rr = lerp(p.r, 0.032, k) * (1 - ease.inQuad(clamp((kc - 0.82) / 0.18)));
        m.makeScale(Math.max(rr, 1e-4), Math.max(rr, 1e-4), Math.max(rr, 1e-4)).setPosition(p.pos);
        pMesh.setMatrixAt(i, m);
        tmp.copy(p.red ? cRed : cWhite).lerp(cRed, ease.inOutSine(clamp((kc - 0.12) / 0.4)));
        pMesh.setColorAt(i, tmp);
        glowPos.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
        const gc = p.red ? [1.0, 0.0, 0.09] : [0.55, 0.42, 0.44];
        glowCol.set(gc, i * 3);
        glowSize[i] = rr * 7.0;
      });
      pMesh.instanceMatrix.needsUpdate = true;
      pMesh.instanceColor.needsUpdate = true;
      glowGeo.attributes.position.needsUpdate = true;
      glowGeo.attributes.aColor.needsUpdate = true;
      glowGeo.attributes.aSize.needsUpdate = true;
      glowMat.uniforms.uAlpha.value = (1 - ease.inOutSine(clamp(kc * 1.5))) * 0.55;
      pairs.forEach(([a, b], n) => {
        const A = P[a].pos, B = P[b].pos;
        linePos.set([A.x, A.y, A.z, B.x, B.y, B.z], n * 6);
        const red = P[a].red && P[b].red;
        const c = red ? cRed : cWhite;
        lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], n * 6);
      });
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      lineMat.opacity = 0.6 * (1 - ease.inOutSine(clamp(kc * 2.2)));
    }

    // --- goutte -------------------------------------------------------------
    drop.visible = ds.opacity > 0.001;
    drop.position.copy(ds.pos);
    drop.scale.set(ds.sxz, ds.sy, ds.sxz);
    dropUniforms.uOpacity.value = ds.opacity;
    dropUniforms.uTime.value = t;
    dropUniforms.uWobble.value = t < K.impact[0] ? 0.012 : 0;

    // --- tissu ----------------------------------------------------------------
    fabricUniforms.uOpacity.value = ease.inOutSine(clamp((kc - 0.35) / 0.65));
    fabric.visible = fabricUniforms.uOpacity.value > 0.001;
    const stainK = ease.outCubic(prog(t, K.impact[0], K.impact[1] + 0.1));
    const stainR = STAIN_R * stainK;
    fabricUniforms.uStainR.value = stainR;
    const flow = ease.inOutSine(prog(t, K.flow)) * 0.42;
    fabricUniforms.uFlow.value = flow;
    fiberUniforms.uFlow.value = flow;
    fiberUniforms.uStainR.value = stainR;
    // ouverture vers les fils 3D, puis refermeture pendant la remontée
    const hole = ease.inOutSine(prog(t, K.fiberReveal)) * (1 - ease.inOutSine(prog(t, K.rise[0], K.rise[0] + 0.45)));
    fabricUniforms.uHole.value = hole;
    fibers.visible = t > K.fiberReveal[0] - 0.05 && t < K.rise[0] + 0.5;
    fiberUniforms.uSink.value = lerp(0.07, 0, hole);
    // spirale + rotation (tambour) + dilution
    const kt = prog(t, K.twist);
    fabricUniforms.uTwist.value = ease.inOutSine(kt) * 15.0;
    fabricUniforms.uSpin.value = spinAt(t);
    const dil = ease.inOutSine(prog(t, K.dilute));
    fabricUniforms.uDesat.value = dil;
    fiberUniforms.uDesat.value = dil;
    fabricUniforms.uWhite.value = ease.inOutSine(prog(t, K.whiteOut));
    fabricUniforms.uWeave.value = 1;
    fabricUniforms.uStainWeave.value = ease.inOutSine(prog(t, K.pushIn[0], K.pushIn[0] + 0.45));

    applyCamera(t, ds.pos);

    // centre/rayon écran de la goutte pour son reflet
    if (drop.visible) {
      v3.copy(ds.pos).project(camera);
      dropUniforms.uCenterPx.value.set((v3.x * 0.5 + 0.5) * W, (v3.y * 0.5 + 0.5) * H);
      const dist = camera.position.distanceTo(ds.pos);
      dropUniforms.uRadiusPx.value = (H / 2) * (DROP_R * ds.sxz) / (dist * Math.tan(((FOV / 2) * Math.PI) / 180));
    }
  }

  /** Projection écran (px) d'un point monde — pour les micro-légendes. */
  function project(p) {
    v3.copy(p).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (1 - (v3.y * 0.5 + 0.5)) * H, z: v3.z, dist: camera.position.distanceTo(p) };
  }

  /** Choisit 4 particules bien placées à l'écran pour porter les légendes (déterministe). */
  function pickLabelAnchors() {
    const tRef = (K.labelsIn[1] + K.labelsOut[0]) / 2;
    update(tRef);
    const zones = [[0.25, 0.27], [0.74, 0.36], [0.30, 0.66], [0.70, 0.76]];
    const used = new Set();
    return zones.map(([zx, zy]) => {
      let best = -1, bestD = 1e9;
      P.forEach((p, i) => {
        if (used.has(i)) return;
        const s = project(p.pos);
        if (s.z > 1 || s.dist < 1.2 || s.dist > 3.6 || p.r < 0.03) return;
        const d = Math.hypot(s.x / W - zx, s.y / H - zy);
        if (d < bestD) { bestD = d; best = i; }
      });
      used.add(best);
      return best;
    });
  }

  function render(renderer, t) {
    update(t);
    renderer.autoClear = true;
    renderer.render(scene, camera);
  }

  return { render, update, project, particles: P, pickLabelAnchors, camera };
}

/** Rotation du tambour (radians) — partagée par le tissu, l'eau et la grande roue. */
export function spinAt(t) {
  const a = K.rise[0], b = K.pushOut[1];
  if (t <= a) return 0;
  // accélération douce puis vitesse de croisière
  const x = Math.min(t, b) - a;
  const ramp = 1.2;
  const w = 2.4; // rad/s
  return x < ramp ? (w * x * x) / (2 * ramp) : w * (x - ramp / 2);
}

function buildFiberGeometry() {
  const N = FIBER_COUNT;
  const segPerCell = 6;
  const M = N * segPerCell;
  const RAD = 6;
  const pos = [], nor = [], axisA = [], idxA = [], alongA = [], acrossA = [], index = [];
  let base = 0;
  for (let axis = 0; axis < 2; axis++) {
    for (let j = 0; j < N; j++) {
      const across = (j - N / 2 + 0.5) * S;
      for (let k = 0; k <= M; k++) {
        const along = -HALF + (2 * HALF * k) / M;
        const u = along / S + N / 2;
        const wave = Math.cos(Math.PI * (u - 0.5) + Math.PI * j);
        let yc = THREAD_H0 + (axis === 0 ? 1 : -1) * WAVE_A * wave;
        // les extrémités plongent sous le tissu (raccord invisible avec le tissage procédural)
        const endK = clamp((Math.abs(along) - (HALF - 0.1)) / 0.08);
        yc -= endK * (THREAD_H0 + THREAD_R + 0.01);
        for (let a = 0; a <= RAD; a++) {
          const th = (a / RAD) * TAU;
          const c = Math.cos(th), s = Math.sin(th);
          if (axis === 0) { pos.push(along, yc + c * THREAD_R, across + s * THREAD_R); nor.push(0, c, s); }
          else { pos.push(across + s * THREAD_R, yc + c * THREAD_R, along); nor.push(s, c, 0); }
          axisA.push(axis); idxA.push(j - N / 2); alongA.push(along); acrossA.push(across);
        }
      }
      for (let k = 0; k < M; k++) {
        for (let a = 0; a < RAD; a++) {
          const i0 = base + k * (RAD + 1) + a, i1 = i0 + 1, i2 = i0 + RAD + 1, i3 = i2 + 1;
          if (axis === 0) index.push(i0, i1, i2, i1, i3, i2);
          else index.push(i0, i2, i1, i1, i2, i3);
        }
      }
      base += (M + 1) * (RAD + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aAxis", new THREE.Float32BufferAttribute(axisA, 1));
  g.setAttribute("aIdx", new THREE.Float32BufferAttribute(idxA, 1));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(alongA, 1));
  g.setAttribute("aAcross", new THREE.Float32BufferAttribute(acrossA, 1));
  g.setIndex(index);
  return g;
}
