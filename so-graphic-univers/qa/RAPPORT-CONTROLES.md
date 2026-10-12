# Contrôles avant livraison — So Graphic « D'un univers à l'autre »

## 1. Format

- ✅ 900 images (attendu : 900)
- ✅ durée vidéo 30.00 s à 30/1 i/s (conteneur : 30.000 s)
- ✅ 1080 × 1350, h264 High, yuv420p
- ℹ️ espace colorimétrique : bt709 / bt709 / bt709 / tv, débit 6078 kb/s

## 2. Rouge #fc0017 après compression

- ✅ roue S1 (0,0 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 0)
- ✅ pupille S2 (5,8 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 174)
- ✅ tache S4 (13,87 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 416)
- ✅ roue S6 (18,5 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 555)
- ✅ « S » du logo (29,8 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 894)
- ✅ grande roue du logo (29,8 s) : rgb(251, 0, 22) — écart max 1.0 / 255 (image 894)
- ℹ️ bords (fin du logo) : 7215 px s'écartent de plus de 24/255 de l'image source sans perte (écart moyen 0.54) — effet du sous-échantillonnage 4:2:0 limité à ~1 px autour des formes rouges

## 3. Superposition fin du logo (2,8 s de la séquence L) / SVG officiel

- ✅ grande roue + pupille : écart maximal entre les contours 2 px (tolérance 2 px) — 412 px de bord différent sur 47859 px de forme
- ✅ petite roue : écart maximal entre les contours 2 px (tolérance 2 px) — 820 px de bord différent sur 17274 px de forme
- ✅ « S » : écart maximal entre les contours 1 px (tolérance 1 px) — 77 px de bord différent sur 41852 px de forme
- ✅ « Graphic » : écart maximal entre les contours 1 px (tolérance 1 px) — 266 px de bord différent sur 33534 px de forme
- ℹ️ les écarts restants sont des pixels de bord : anticrénelage du calque animé et rotation finale −45° / +90° du prototype (le tracé dessiné n'est pas parfaitement symétrique d'une dent à l'autre)
- ℹ️ `qa/superposition-logo-svg.png` : rouge = commun, bleu = film seul, orange = SVG seul

## 4. Clin d'œil : image « œil fermé »

- ✅ instantané sans perte : 0 px rouges au-dessus de l'axe, 0 px de pupille, 17225 px de demi-lune basse
- ✅ vidéo décodée : 0 px rouges au-dessus de l'axe, 0 px de pupille, 17063 px de demi-lune basse

## 5. Conclusion et logo jamais à l'écran ensemble

- ✅ image 804 (26.80 s) : 0 px non blancs
- ✅ image 807 (26.90 s) : 0 px non blancs
- ✅ image 809 (26.97 s) : 0 px non blancs
- ✅ image 810 (27.00 s) : 0 px non blancs

## 6. Captures de contrôle

- `captures/capture-0m01,00s.png` — 0:01,00 (image 30)
- `captures/capture-0m04,00s.png` — 0:04,00 (image 120)
- `captures/capture-0m07,00s.png` — 0:07,00 (image 210)
- `captures/capture-0m11,00s.png` — 0:11,00 (image 330)
- `captures/capture-0m15,00s.png` — 0:15,00 (image 450)
- `captures/capture-0m19,00s.png` — 0:19,00 (image 570)
- `captures/capture-0m22,00s.png` — 0:22,00 (image 660)
- `captures/capture-0m24,00s.png` — 0:24,00 (image 720)
- `captures/capture-0m26,00s.png` — 0:26,00 (image 780)
- `captures/capture-0m28,00s.png` — 0:28,00 (image 840)
- `captures/capture-0m29,90s.png` — 0:29,90 (image 897)
- ℹ️ `qa/planche-400px.png` : les 11 captures réduites à 400 px de large (lisibilité mobile)

**Bilan : tous les contrôles automatiques passent.**
