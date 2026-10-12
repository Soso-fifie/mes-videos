// Séquence 6 : eau du tambour (shader plein écran bleu-blanc translucide) + bulles.
// Le contour du hublot est la grande roue flat (couche SVG) ; l'eau se dessine au centre du cadre.
import * as THREE from "three";
import { W, H, CX, CY, K, WATER, SEED, WHEEL_HOLE_R, WHEEL_BIG_S } from "./config.js";
import { TAU, prog, ease, clamp, rng, hex3 } from "./util.js";
import { spinAt } from "./world.js";

const N_BUBBLES = 36;
const HOLE_PX = WHEEL_HOLE_R * WHEEL_BIG_S;
const WATER_ALPHA = 0.8;

export function createWater() {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rand = rng(SEED + 7);
  const B = Array.from({ length: N_BUBBLES }, () => ({
    period: 1.1 + rand() * 1.3, offset: rand() * 3, a0: rand() * TAU, r0: 0.12 + rand() * 0.78, size: 5 + rand() * 15,
  }));
  const uniforms = {
    uCenter: { value: new THREE.Vector2(CX, H - CY) },
    uRadius: { value: HOLE_PX },
    uTime: { value: 0 }, uSpin: { value: 0 },
    uAlpha: { value: 0 }, uWhite: { value: 0 }, uBubbleAlpha: { value: 0 },
    uWater: { value: new THREE.Vector3(...hex3(WATER)) },
    uBubbles: { value: Array.from({ length: N_BUBBLES }, () => new THREE.Vector3()) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      #define NB ${N_BUBBLES}
      uniform vec2 uCenter; uniform float uRadius; uniform float uTime; uniform float uSpin;
      uniform float uAlpha; uniform float uWhite; uniform float uBubbleAlpha; uniform vec3 uWater;
      uniform vec3 uBubbles[NB];
      void main(){
        vec2 q = (gl_FragCoord.xy - uCenter) / uRadius;
        float r = length(q); float a = atan(q.y, q.x);
        float s1 = 0.5 + 0.5 * sin(a * 3.0 + r * 7.0 - uSpin * 1.0);
        float s2 = 0.5 + 0.5 * sin(a * 5.0 - r * 11.0 - uSpin * 1.6 + 1.3);
        float s3 = 0.5 + 0.5 * sin(a * 2.0 + r * 15.0 - uTime * 3.0);
        float caustic = pow(s1 * s2, 2.0) * 0.8 + pow(s3, 6.0) * 0.3;
        vec3 col = mix(uWater, vec3(1.0), clamp(caustic + r * 0.18, 0.0, 1.0));
        float alpha = uAlpha * (0.62 + 0.30 * caustic);
        float b = 0.0, bh = 0.0;
        for (int i = 0; i < NB; i++) {
          vec3 Bb = uBubbles[i];
          if (Bb.z <= 0.5) continue;
          vec2 dp = gl_FragCoord.xy - Bb.xy;
          float d = length(dp);
          float inside = smoothstep(Bb.z, Bb.z - 1.5, d);
          float ring = inside - smoothstep(Bb.z - 2.0, Bb.z - 3.5, d);
          float hl = smoothstep(Bb.z * 0.32, Bb.z * 0.12, length(dp - vec2(-0.38, 0.38) * Bb.z));
          b = max(b, max(ring, inside * 0.22));
          bh = max(bh, hl);
        }
        col = mix(col, vec3(1.0), clamp(b * 0.9 + bh, 0.0, 1.0));
        alpha = max(alpha, clamp(b + bh, 0.0, 1.0) * uBubbleAlpha);
        col = mix(col, vec3(1.0), uWhite);
        alpha = mix(alpha, 1.0, uWhite);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function render(renderer, t) {
    const kw = ease.inOutSine(prog(t, K.waterIn));
    if (kw <= 0) return;
    const spin = spinAt(t);
    uniforms.uTime.value = t;
    uniforms.uSpin.value = spin;
    uniforms.uAlpha.value = kw * WATER_ALPHA;
    uniforms.uWhite.value = ease.inOutSine(prog(t, K.whiteOut));
    uniforms.uBubbleAlpha.value = kw * (1 - ease.inOutSine(prog(t, K.whiteOut)));
    B.forEach((b, i) => {
      const life = ((t + b.offset) % b.period) / b.period;          // 0 → 1
      const ang = b.a0 - spin * 0.85 - life * 0.9;
      const rad = b.r0 * HOLE_PX * (1 - 0.35 * life);
      const size = b.size * (0.35 + 0.65 * life) * (life < 0.92 ? 1 : 0);
      uniforms.uBubbles.value[i].set(CX + Math.cos(ang) * rad, H - CY + Math.sin(ang) * rad, clamp(size, 0, 40));
    });
    renderer.autoClear = false;
    renderer.render(scene, cam);
  }
  return { render };
}
