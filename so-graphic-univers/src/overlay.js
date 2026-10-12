// Couche 2D plate (SVG) au-dessus du rendu 3D : grande roue, cadran, œil-pictogramme, iris,
// pupille exacte du logo, panneau du hublot, micro-légendes. Rouge exact #fc0017, aucun effet.
import {
  W, H, CX, CY, RED, WHITE, CREAM, LABEL, K, WHEEL_CENTER, WHEEL_TIP_R, WHEEL_HOLE_R, WHEEL_BIG_S, WHEEL_HUB_R,
  PUPIL_CENTER, PUPIL_R, DIAL_R, EYE_HALF_W, EYE_HALF_H, IRIS_R, PUPIL_BIG_R, EYE_ZOOM, LABELS,
} from "./config.js";
import { WHEEL_D, PUPIL_D } from "./logo-paths.js";
import { TAU, prog, lerp, clamp, ease } from "./util.js";
import { spinAt } from "./world.js";

const NS = "http://www.w3.org/2000/svg";
const EYE_POINTS = 192;
const HUB_S = WHEEL_HUB_R / WHEEL_TIP_R;
const IRIS_S = IRIS_R / WHEEL_TIP_R;
const S6_WHEEL_FROM = 60;          // échelle de la roue à son entrée en S6 (trou bien au-delà du cadre)
const S6_WHEEL_TO = 72;            // échelle en fin de push-in final
const DEG = 180 / Math.PI;
const HANDS = { hour: { len: 200, w: 10, a: -58 }, minute: { len: 288, w: 6.5, a: 62 } };

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const logLerp = (a, b, k) => Math.exp(lerp(Math.log(a), Math.log(b), k));

/** Point du contour : cercle (p = 0) → amande (p = 1). φ = 0 en haut, sens horaire. */
function eyePoint(phi, p) {
  const R = DIAL_R;
  const cx = R * Math.sin(phi), cy = -R * Math.cos(phi);
  const rl = (EYE_HALF_W * EYE_HALF_W + EYE_HALF_H * EYE_HALF_H) / (2 * EYE_HALF_H);
  const y0 = EYE_HALF_H - rl;
  const ax = EYE_HALF_W * Math.sin(phi);
  const s = -Math.cos(phi);
  const ay = Math.sign(s) * Math.max(0, y0 + Math.sqrt(Math.max(rl * rl - ax * ax, 0)));
  return [lerp(cx, ax, p), lerp(cy, ay, p)];
}

export function createOverlay(svg) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const panel = el("path", { fill: WHITE, "fill-rule": "evenodd" }, svg);
  const eye = el("path", { fill: WHITE, "fill-opacity": 0, stroke: CREAM, "stroke-width": 3, "stroke-linejoin": "round", pathLength: 1 }, svg);
  const ticksG = el("g", {}, svg);
  const ticks = Array.from({ length: 12 }, (_, i) => el("line", {
    stroke: CREAM, "stroke-width": i % 3 === 0 ? 6 : 3, "stroke-linecap": "round",
  }, ticksG));
  const hourHand = el("line", { stroke: CREAM, "stroke-width": HANDS.hour.w, "stroke-linecap": "round" }, svg);
  const minuteHand = el("line", { stroke: CREAM, "stroke-width": HANDS.minute.w, "stroke-linecap": "round" }, svg);
  const wheelG = el("g", {}, svg);
  el("path", { d: WHEEL_D, fill: RED }, wheelG);
  const iris = el("circle", { fill: RED, cx: CX, cy: CY, r: 0 }, svg);
  const pupilG = el("g", {}, svg);
  el("path", { d: PUPIL_D, fill: RED }, pupilG);
  const labelsG = el("g", { "font-family": "Outfit, system-ui, sans-serif", "font-weight": 300 }, svg);
  const labels = LABELS.map((txt) => {
    const g = el("g", {}, labelsG);
    el("circle", { r: 7, fill: "none", stroke: LABEL, "stroke-width": 1.5 }, g);
    el("line", { x1: 8, y1: -6, x2: 46, y2: -36, stroke: LABEL, "stroke-width": 1.25 }, g);
    el("line", { x1: 46, y1: -36, x2: 64, y2: -36, stroke: LABEL, "stroke-width": 1.25 }, g);
    const tx = el("text", { x: 74, y: -27, fill: LABEL, "font-size": 30, "letter-spacing": "0.04em" }, g);
    tx.textContent = txt;
    return g;
  });

  const show = (node, on) => node.setAttribute("visibility", on ? "visible" : "hidden");

  function wheelTransform(s, deg) {
    return `translate(${CX} ${CY}) rotate(${deg.toFixed(3)}) scale(${s.toFixed(5)}) translate(${-WHEEL_CENTER[0]} ${-WHEEL_CENTER[1]})`;
  }

  /** État de la grande roue (échelle px/unité, angle en °) ou null si absente. */
  function wheelState(t) {
    if (t < K.irisGrow[1]) {
      const k = ease.inOutCubic(prog(t, K.wheelShrink));
      let s = logLerp(WHEEL_BIG_S, HUB_S, k);
      let deg = 26 * t;
      const ki = prog(t, K.irisGrow);
      if (ki > 0) {
        s = lerp(HUB_S, IRIS_S, ease.inOutCubic(ki));
        deg += 300 * ease.inCubic(ki);
      }
      return { s, deg };
    }
    if (t >= K.wheelIn[0]) {
      const kIn = ease.outCubic(prog(t, K.wheelIn));
      const kOut = ease.inCubic(prog(t, K.pushOut));
      const s = kOut > 0 ? logLerp(WHEEL_BIG_S, S6_WHEEL_TO, kOut) : logLerp(S6_WHEEL_FROM, WHEEL_BIG_S, kIn);
      return { s, deg: -spinAt(t) * DEG };
    }
    return null;
  }

  function update(t, ctx = {}) {
    // --- grande roue + panneau du hublot -----------------------------------
    const ws = wheelState(t);
    show(wheelG, !!ws);
    if (ws) wheelG.setAttribute("transform", wheelTransform(ws.s, ws.deg));
    const s6 = !!ws && t >= K.wheelIn[0];
    show(panel, s6);
    if (s6) {
      const r = WHEEL_HOLE_R * ws.s - 1.0;
      panel.setAttribute("d", `M0,0H${W}V${H}H0Z M${CX + r},${CY} A${r},${r} 0 1 0 ${CX - r},${CY} A${r},${r} 0 1 0 ${CX + r},${CY}Z`);
    }

    // --- cadran → œil -------------------------------------------------------
    const eyeOn = t >= K.dialDraw[0] && t < K.dropSwap[0];
    show(eye, eyeOn);
    const pm = ease.inOutCubic(prog(t, K.morph));
    const rot = (1 - pm) * -0.9 * ease.inOutSine(clamp(prog(t, K.morph) * 3)) ; // rotation pendant le morph
    const push = lerp(1, 1.06, ease.inOutSine(prog(t, K.eyePush)));
    const zoom = lerp(1, EYE_ZOOM / 1.06, ease.inCubic(prog(t, K.eyeZoom)));
    const eyeScale = push * zoom;
    if (eyeOn) {
      let d = "";
      for (let i = 0; i <= EYE_POINTS; i++) {
        const phi = (i / EYE_POINTS) * TAU;
        const [x, y] = eyePoint(phi, pm);
        const c = Math.cos(rot), s = Math.sin(rot);
        const X = CX + (x * c - y * s) * eyeScale, Y = CY + (x * s + y * c) * eyeScale;
        d += (i ? "L" : "M") + X.toFixed(2) + "," + Y.toFixed(2);
      }
      eye.setAttribute("d", d + "Z");
      const draw = ease.inOutCubic(prog(t, K.dialDraw));
      if (draw < 1) { eye.setAttribute("stroke-dasharray", "1 1"); eye.setAttribute("stroke-dashoffset", (1 - draw).toFixed(4)); }
      else { eye.removeAttribute("stroke-dasharray"); eye.removeAttribute("stroke-dashoffset"); }
      eye.setAttribute("fill-opacity", ease.inOutSine(prog(t, K.sclera)).toFixed(3));
      eye.setAttribute("stroke-opacity", (1 - prog(t, K.eyeZoom)).toFixed(3));
    }

    // --- index du cadran ----------------------------------------------------
    const ticksOn = t >= K.ticksDraw[0] && t < K.ticksOut[1];
    show(ticksG, ticksOn);
    if (ticksOn) {
      const kOut = ease.inOutCubic(prog(t, K.ticksOut));
      ticks.forEach((ln, i) => {
        const kin = ease.outCubic(clamp(prog(t, K.ticksDraw) * 1.8 - i * 0.07));
        const major = i % 3 === 0;
        const r2 = DIAL_R - 16;
        const r1 = lerp(r2, DIAL_R - (major ? 50 : 32), kin * (1 - kOut));
        const a = (i / 12) * TAU + rot;
        const sx = Math.sin(a), sy = -Math.cos(a);
        ln.setAttribute("x1", (CX + sx * r1 * eyeScale).toFixed(2)); ln.setAttribute("y1", (CY + sy * r1 * eyeScale).toFixed(2));
        ln.setAttribute("x2", (CX + sx * r2 * eyeScale).toFixed(2)); ln.setAttribute("y2", (CY + sy * r2 * eyeScale).toFixed(2));
        ln.setAttribute("opacity", (kin * (1 - kOut)).toFixed(3));
      });
    }

    // --- aiguilles ------------------------------------------------------------
    const handsOn = t >= K.handsDraw[0] && t < K.handsFold[1];
    show(hourHand, handsOn); show(minuteHand, handsOn);
    if (handsOn) {
      const kin = ease.outCubic(prog(t, K.handsDraw));
      const kf = ease.inOutCubic(prog(t, K.handsFold));
      [[hourHand, HANDS.hour, -90], [minuteHand, HANDS.minute, 90]].forEach(([ln, h, flat]) => {
        const a = (lerp(h.a + 4 * t, flat, kf) * Math.PI) / 180 + rot;
        const len = h.len * kin * (1 - kf);
        ln.setAttribute("x1", CX); ln.setAttribute("y1", CY);
        ln.setAttribute("x2", (CX + Math.sin(a) * len).toFixed(2)); ln.setAttribute("y2", (CY - Math.cos(a) * len).toFixed(2));
      });
    }

    // --- iris (la roue se résorbe en disque plein) ------------------------------
    const ki = prog(t, K.irisGrow);
    const irisOn = ki > 0 && t < K.pupilFade[1];
    show(iris, irisOn);
    if (irisOn) {
      const s = ws ? ws.s : IRIS_S;
      const r = ki < 1 ? lerp(0, WHEEL_TIP_R * s + 0.6, ease.inOutCubic(ki)) : IRIS_R * push;
      iris.setAttribute("r", r.toFixed(2));
      iris.setAttribute("opacity", (1 - prog(t, K.pupilFade)).toFixed(3));
    }

    // --- pupille exacte du logo ------------------------------------------------
    const pupilOn = t >= K.pupilFade[0] && t < K.dropSwap[0];
    show(pupilG, pupilOn);
    if (pupilOn) {
      const r = lerp(IRIS_R * push, PUPIL_BIG_R, ease.inOutCubic(prog(t, K.eyeZoom)));
      const s = r / PUPIL_R;
      pupilG.setAttribute("transform", `translate(${CX} ${CY}) scale(${s.toFixed(5)}) translate(${-PUPIL_CENTER[0]} ${-PUPIL_CENTER[1]})`);
    }

    // --- micro-légendes ------------------------------------------------------------
    const labOn = t >= K.labelsIn[0] && t < K.labelsOut[1] && ctx.labelPos;
    show(labelsG, !!labOn);
    if (labOn) {
      const kOut = 1 - ease.inOutSine(prog(t, K.labelsOut));
      labels.forEach((g, i) => {
        const p = ctx.labelPos[i];
        const kin = ease.outCubic(prog(t, K.labelsIn[i], K.labelsIn[i] + 0.3));
        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${(p.y + (1 - kin) * 8).toFixed(1)})`);
        g.setAttribute("opacity", (kin * kOut).toFixed(3));
      });
    }
  }

  return { update };
}
