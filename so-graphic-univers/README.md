# So Graphic — « D'un univers à l'autre »

Film de marque de 30,00 s (900 images, 30 i/s, 1080 × 1350, 4:5), entièrement en motion design
codé avec [HyperFrames](https://hyperframes.heygen.com) : Three.js pour les volumes, SVG pour les
éléments plats, GSAP pour la typographie, WAAPI pour le logo (prototype validé, à l'identique).

## Livrables

| Fichier | Contenu |
|---|---|
| `renders/so-graphic-motion-design.mp4` | le film complet (30 s) |
| `renders/so-graphic-logo-final.mp4` | la séquence logo seule (3 s) |
| `renders/so-graphic-conclusion.mp4` | la conclusion typographique seule (6,5 s) |
| `cue-sheet.md` | points de synchronisation son, à l'image près |
| `captures/` | 11 captures de contrôle (0:01 → 0:29,9) |
| `qa/RAPPORT-CONTROLES.md` | résultats des contrôles de la section 8 |

## Structure

```
index.html                  composition racine (30 s) : monde 3D 0–20,5 s, conclusion, logo, audio
src/config.js               ★ TOUTES les constantes : durées, temps-clés, couleurs, positions
src/main.js                 orchestration (un seul moteur WebGL, piloté par le temps HyperFrames)
src/gears.js                séq. 1–2 : engrenages, anneau du cadran
src/drop.js                 séq. 3a : la pupille devient une goutte 3D, plongée
src/world.js                séq. 3b–6 : particules, goutte, tissu, fibres, spirale
src/water.js                séq. 6 : eau et bulles du tambour
src/overlay.js              couche plate SVG : grande roue, cadran, œil, pupille, légendes
src/logo-paths.js           tracés officiels (générés depuis reference/logo-So-Graphic.svg)
compositions/conclusion.html  conclusion (constantes de timing en tête du script)
compositions/logo.html      logo (GÉNÉRÉ depuis le prototype — ne pas éditer à la main)
reference/                  SVG officiel + prototype validé, tels quels
audio/                      pistes muettes à remplacer (musique.wav, sound-design.wav)
tools/                      générateurs et contrôles
```

## Ajuster le timing

- **Séquences 1 à 6** : tout est dans `src/config.js`.
  - `SEQ` donne le début et la fin de chaque séquence.
  - `K` donne les temps-clés de chaque mouvement, sous la forme `[début, fin]` en secondes absolues.
  - Exemple : `K.fall: [12.05, 13.30]` fixe la chute de la goutte.
  - Les couleurs (`RED`, `INK`, …) et les positions (`WHEEL_BIG_DIAM`, `DIAL_R`, `EYE_HALF_W`, …) sont regroupées au même endroit.
- **Conclusion** : les constantes `P1_…`, `P2_…`, `L1_IN`, `L2_IN`, `P3_…` se trouvent en tête du script de `compositions/conclusion.html`. Leurs temps sont locaux : 0 correspond à 0:20,5.
- **Logo** :
  - ne pas modifier `compositions/logo.html` à la main ;
  - pour changer la chorégraphie, modifier `reference/so-graphic-logo-anim.html` ;
  - relancer ensuite `python3 tools/build-logo-composition.py`.
- **Placement des blocs** : le début et la durée de chaque bloc se règlent dans `index.html`, avec `data-start` et `data-duration`. Si une séquence bouge, garder `SEQ` en cohérence.
- **Cue-sheet** : après tout changement, régénérer `cue-sheet.md` avec `node tools/build-cue-sheet.mjs`.

## Remplacer le son

Déposer vos fichiers sous les mêmes noms, `audio/musique.wav` et `audio/sound-design.wav`, puis relancer le rendu.
Le volume se règle avec `data-volume` sur les balises `<audio>` de `index.html` (1 = 0 dB).

## Prévisualiser et rendre

Prérequis : Node 22 et FFmpeg. Rien n'est chargé depuis Internet : Three.js, GSAP et la police Outfit sont dans `vendor/` et `assets/`.

```bash
cd so-graphic-univers
npx hyperframes preview                 # studio de prévisualisation (navigateur)
npx hyperframes check                   # vérifications (lint, rendu, contraste)

# rendu des 3 livrables : séquence PNG sans perte → H.264 High 4:2:0 BT.709 (CRF 12)
tools/encode-master.sh                  # → renders/so-graphic-motion-design.mp4, -logo-final.mp4, -conclusion.mp4

# variante rapide, film seul, avec le pipeline standard de HyperFrames
npx hyperframes render --quality high --crf 12 -o renders/so-graphic-motion-design.mp4

# contrôles de la section 8 (instantanés sans perte d'abord)
npx hyperframes snapshot --at 28.0333,29.8 --no-end   # copier dans qa/lossless/frame-at-<t>s.png
python3 tools/qa/make-logo-static.py && (cd tools/qa/logo-static && npx hyperframes snapshot --at 0.5 --no-end)
python3 tools/qa/check.py renders/so-graphic-motion-design.mp4
```

Le logo et la conclusion sont découpés dans le même rendu que le film, aux images 810–899 et 615–809. Ils sont donc identiques, image pour image, à leur passage dans le film.
Le rendu 3D se fait en WebGL logiciel quand la machine n'a pas de GPU : compter quelques minutes pour le film.
Chaque image est calculée uniquement à partir de son temps (aucune horloge, hasard à graine fixe), donc deux rendus donnent le même résultat.
