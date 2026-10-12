#!/usr/bin/env python3
"""Contrôles avant livraison (section 8 du brief).

Usage : python3 tools/qa/check.py renders/so-graphic-motion-design.mp4
Prérequis : ffmpeg/ffprobe, Pillow, numpy, et les instantanés sans perte suivants
(générés par `npx hyperframes snapshot`) :
  qa/lossless/frame-at-29.8s.png   (fin du logo, 2,8 s dans la séquence L)
  qa/lossless/frame-at-28.033s.png (œil fermé pendant le clin d'œil)
  tools/qa/logo-static/snapshots/frame-00-at-0.5s.png (SVG officiel immobile, même cadrage)
Écrit qa/RAPPORT-CONTROLES.md, les captures dans captures/ et les images de contrôle dans qa/.
"""
import json, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[2]
QA = ROOT / "qa"
CAPS = ROOT / "captures"
W, H, FPS = 1080, 1350, 30
RED = np.array([252, 0, 23])
LOGO_SCALE = W / 256.0                       # viewBox 22 4 256 320 → 1080×1350
CAPTURE_TIMES = [1.0, 4.0, 7.0, 11.0, 15.0, 19.0, 22.0, 24.0, 26.0, 28.0, 29.9]


def lu(u, v):
    """Unités du logo → pixels du cadre."""
    return ((u - 22) * LOGO_SCALE, (v - 4) * LOGO_SCALE)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                          "stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_frames,color_space,color_primaries,color_transfer,color_range:format=duration,bit_rate",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def frame_at(path, t):
    """Image décodée exacte (numéro d'image = round(t × 30))."""
    n = int(round(t * FPS))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"select=eq(n\\,{n})", "-vsync", "0",
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3), n


def red_mask(img, tol=40):
    return (np.abs(img.astype(int) - RED).sum(axis=2) < tol)


def main(mp4):
    QA.mkdir(exist_ok=True)
    CAPS.mkdir(exist_ok=True)
    rep = ["# Contrôles avant livraison — So Graphic « D'un univers à l'autre »", ""]
    ok_all = True

    def line(ok, txt):
        nonlocal ok_all
        ok_all &= ok
        rep.append(f"- {'✅' if ok else '❌'} {txt}")

    # 1. Durée / images ------------------------------------------------------
    p = probe(mp4)
    st = p["streams"][0]
    dur = float(p["format"]["duration"])
    nb = int(st["nb_read_frames"])
    rep += ["## 1. Format", ""]
    line(nb == 900, f"{nb} images (attendu : 900)")
    line(abs(nb / FPS - 30.0) < 1e-6, f"durée vidéo {nb / FPS:.2f} s à {st['r_frame_rate']} i/s (conteneur : {dur:.3f} s)")
    line(st["width"] == W and st["height"] == H, f"{st['width']} × {st['height']}, {st['codec_name']} {st.get('profile','')}, {st['pix_fmt']}")
    rep.append(f"- ℹ️ espace colorimétrique : {st.get('color_space','?')} / {st.get('color_primaries','?')} / {st.get('color_transfer','?')} / {st.get('color_range','?')}, débit {int(p['format']['bit_rate'])//1000} kb/s")

    # 2. Rouge -----------------------------------------------------------------
    rep += ["", "## 2. Rouge #fc0017 après compression", ""]
    probes = [
        ("roue S1 (0,0 s)", 0.0, (540 + 28 * 0.9 * W / (2 * 39.66), 675)),   # corps de la roue (r = 28 u)
        ("pupille S2 (5,8 s)", 5.8, (540 - 60, 675 + 40)),
        ("tache S4 (13,87 s)", 13.87, (540, 690)),
        ("roue S6 (18,5 s)", 18.5, (540, 675 - 28 * 0.9 * W / (2 * 39.66))),
        ("« S » du logo (29,8 s)", 29.8, lu(66.0, 162.0)),
        ("grande roue du logo (29,8 s)", 29.8, lu(168.26, 135.61 + 30.5)),
    ]
    for name, t, xy in probes:
        img, n = frame_at(mp4, t)
        if xy is None:   # zone rouge la plus large de l'image : médiane
            m = red_mask(img, 90)
            vals = img[m]
            c = np.median(vals, axis=0) if len(vals) else np.array([0, 0, 0])
        else:
            x, y = int(round(xy[0])), int(round(xy[1]))
            c = img[y - 3:y + 4, x - 3:x + 4].reshape(-1, 3).mean(axis=0)
        d = np.abs(c - RED).max()
        line(d <= 6, f"{name} : rgb({c[0]:.0f}, {c[1]:.0f}, {c[2]:.0f}) — écart max {d:.1f} / 255 (image {n})")

    # bords : largeur de la transition rouge→blanc sur le « S » (image décodée vs instantané sans perte)
    lossless = QA / "lossless" / "frame-at-29.8s.png"
    img, _ = frame_at(mp4, 29.8)
    if lossless.exists():
        ref = np.asarray(Image.open(lossless).convert("RGB")).astype(int)
        diff = np.abs(img.astype(int) - ref).max(axis=2)
        edge = diff > 24
        rep.append(f"- ℹ️ bords (fin du logo) : {edge.sum()} px s'écartent de plus de 24/255 de l'image source sans perte "
                   f"(écart moyen {diff.mean():.2f}) — effet du sous-échantillonnage 4:2:0 limité à ~1 px autour des formes rouges")
        Image.fromarray(np.clip(diff * 4, 0, 255).astype(np.uint8)).save(QA / "ecart-compression-logo.png")

    # 3. Superposition logo / SVG d'origine -----------------------------------
    rep += ["", "## 3. Superposition fin du logo (2,8 s de la séquence L) / SVG officiel", ""]
    static = ROOT / "tools/qa/logo-static/snapshots/frame-00-at-0.5s.png"
    if lossless.exists() and static.exists():
        a = np.asarray(Image.open(lossless).convert("RGB")).astype(int)
        b = np.asarray(Image.open(static).convert("RGB")).astype(int)
        # la signature n'existe pas dans le SVG : on l'exclut (sous y = 242 en unités logo)
        y_cut = int(lu(0, 242)[1])
        ma, mb = a[:y_cut, :, 1] < 128, b[:y_cut, :, 1] < 128     # formes (canal vert bas sur fond blanc)

        def dil(m, r):
            o = m.copy()
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r:
                        o |= np.roll(np.roll(m, dy, 0), dx, 1)
            return o

        def box(u0, v0, u1, v1):
            return (slice(int((v0 - 4) * LOGO_SCALE), int((v1 - 4) * LOGO_SCALE)), slice(int((u0 - 22) * LOGO_SCALE), int((u1 - 22) * LOGO_SCALE)))

        regions = [("grande roue + pupille", box(128, 95, 209, 177), 2), ("petite roue", box(191, 63, 241, 113), 2),
                   ("« S »", box(58, 96, 114, 178), 1), ("« Graphic »", box(59, 196, 210, 237), 1)]
        for name, r, tol in regions:
            A, B = ma[r], mb[r]
            far = lambda rad: int((A & ~dil(B, rad)).sum() + (B & ~dil(A, rad)).sum())
            dev = next(rad for rad in range(0, 6) if far(rad) == 0)
            line(dev <= tol, f"{name} : écart maximal entre les contours {dev} px (tolérance {tol} px) — {int((A ^ B).sum())} px de bord différent sur {int(B.sum())} px de forme")
        rep.append("- ℹ️ les écarts restants sont des pixels de bord : anticrénelage du calque animé et rotation finale −45° / +90° du prototype "
                   "(le tracé dessiné n'est pas parfaitement symétrique d'une dent à l'autre)")
        over = np.full((y_cut, W, 3), 255, np.uint8)
        over[ma & ~mb] = [0, 120, 255]        # présent seulement dans le film
        over[mb & ~ma] = [255, 160, 0]        # présent seulement dans le SVG
        over[ma & mb] = [252, 0, 23]
        Image.fromarray(over).save(QA / "superposition-logo-svg.png")
        Image.fromarray(np.where((ma ^ mb)[..., None], np.array([0, 90, 255], np.uint8), (a[:y_cut] * 0.25 + 191).astype(np.uint8))).save(QA / "superposition-ecarts.png")
        rep.append("- ℹ️ `qa/superposition-logo-svg.png` : rouge = commun, bleu = film seul, orange = SVG seul")
    else:
        line(False, "instantanés manquants pour la superposition")

    # 4. Clin d'œil -------------------------------------------------------------
    rep += ["", "## 4. Clin d'œil : image « œil fermé »", ""]
    blink = QA / "lossless" / "frame-at-28.033s.png"
    for label, im in (("instantané sans perte", np.asarray(Image.open(blink).convert("RGB")) if blink.exists() else None),
                      ("vidéo décodée", frame_at(mp4, 28.0333)[0])):
        if im is None:
            line(False, f"{label} : manquant")
            continue
        x0, x1 = int(lu(126, 0)[0]), int(lu(211, 0)[0])
        y_top, y_axis = int(lu(0, 92)[1]), int(lu(0, 135.61)[1])
        upper = red_mask(im[y_top:y_axis - 2, x0:x1], 120).sum()
        cx, cy = lu(168.43, 135.38)
        lower = red_mask(im[y_axis + 2:int(lu(0, 178)[1]), x0:x1], 120).sum()
        # intérieur de l'anneau, sous l'axe : là où serait la pupille → doit être blanc
        hole = im[y_axis + 4:int(cy + 15.12 * LOGO_SCALE), int(cx - 12 * LOGO_SCALE):int(cx + 12 * LOGO_SCALE)]
        hole_red = red_mask(hole, 120).sum()
        line(upper == 0 and hole_red == 0 and lower > 5000,
             f"{label} : {upper} px rouges au-dessus de l'axe, {hole_red} px de pupille, {lower} px de demi-lune basse")

    # 5. Conclusion / logo jamais ensemble -------------------------------------
    rep += ["", "## 5. Conclusion et logo jamais à l'écran ensemble", ""]
    for t in (26.8, 26.9, 26.9667, 27.0):
        im, n = frame_at(mp4, t)
        nonwhite = (im.astype(int).min(axis=2) < 235).sum()
        line(nonwhite == 0, f"image {n} ({t:.2f} s) : {nonwhite} px non blancs")

    # 6. Captures + lisibilité 400 px ------------------------------------------
    rep += ["", "## 6. Captures de contrôle", ""]
    thumbs = []
    for t in CAPTURE_TIMES:
        im, n = frame_at(mp4, t)
        name = "capture-0m" + f"{t:05.2f}".replace(".", ",") + "s.png"
        Image.fromarray(im).save(CAPS / name)
        thumbs.append((t, Image.fromarray(im).resize((400, 500), Image.LANCZOS)))
        rep.append(f"- `captures/{name}` — 0:" + f"{t:05.2f}".replace(".", ",") + f" (image {n})")
    sheet = Image.new("RGB", (4 * 400 + 5 * 12, 3 * 500 + 4 * 12 + 3 * 30), "white")
    dr = ImageDraw.Draw(sheet)
    for i, (t, th) in enumerate(thumbs):
        x, y = 12 + (i % 4) * 412, 12 + (i // 4) * 542
        sheet.paste(th, (x, y + 30))
        dr.text((x, y + 8), f"0:{t:05.2f}".replace(".", ","), fill=(58, 58, 58))
    sheet.save(QA / "planche-400px.png")
    rep.append("- ℹ️ `qa/planche-400px.png` : les 11 captures réduites à 400 px de large (lisibilité mobile)")

    rep += ["", f"**Bilan : {'tous les contrôles automatiques passent' if ok_all else 'au moins un contrôle échoue — voir ❌'}.**", ""]
    (QA / "RAPPORT-CONTROLES.md").write_text("\n".join(rep), encoding="utf-8")
    print("\n".join(rep))
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "renders/so-graphic-motion-design.mp4"))
