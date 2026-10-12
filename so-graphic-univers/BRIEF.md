---
workflow: general-video
flow: automation
storyboard: no
message: "Je ne change pas de métier. Je change d'univers."
destination: social-feed
aspect: 1080x1350
language: fr
length: 30s
angle: brand-film
---

## Intent

Premier film de marque So Graphic, « D'un univers à l'autre », 30,00 s exactement (900 images, 30 i/s, 4:5).
Entièrement en motion design codé (HyperFrames : Three.js + SVG + typographie), sans aucun plan
généré par IA ni tournage, et sans aucune imitation de visage ou de peau : les moments humains du
brief d'origine sont transposés en objets, matières et formes (mécanisme horloger, œil-pictogramme,
goutte, molécules, tissu, fibres, tambour). C'est un aller-retour de calibrage (rythme, transitions,
direction artistique) avant une éventuelle version hybride.

Structure : 6 séquences graphiques (0–20,5 s) → conclusion typographique (20,5–27 s) → animation du
logo validée (27–30 s), reprise à l'identique du prototype `reference/so-graphic-logo-anim.html`.

## Assets

- reference/logo-So-Graphic.svg — fichier officiel du logo (11 tracés, identiques au prototype).
- reference/so-graphic-logo-anim.html — prototype validé de l'animation du logo, sauvegardé tel quel.
- audio/musique.wav, audio/sound-design.wav — pistes muettes de 30 s, à remplacer par les fichiers de la cliente.

## Customizations

- Séquence 2 : la grande roue se contracte en disque plein (iris de l'œil-pictogramme), puis fondu de 0,3 s vers la pupille exacte du logo (jamais roue + pupille ensemble).
- Séquence 3 : micro-légendes neutres de type mesure/microscope (« Ø 2,4 µm », « × 1 200 », « 640 nm »…).
- Livrables séparés : film complet, logo seul (3 s), conclusion seule (6,5 s), cue-sheet, README.

## Notes

- Rouge unique #fc0017 ; textes #3a3a3a (jamais de noir pur) ; fond blanc pour la conclusion et le logo.
- Tracés du logo jamais redessinés ; roue et pupille toujours parfaitement plates.
- Logo complet (2 roues + S + Graphic) uniquement en séquence L ; conclusion et logo jamais ensemble.
- Roue flat des séquences 1 et 6 : même position (centrée) et ~90 % de la largeur.
- Police Outfit (400 courant, 600 mises en valeur), embarquée localement.
- Choix par défaut validés (« go ») : fonds sombres chauds en 1–2, rouge très sombre dans la goutte (3), clairs en 4–6 ; H.264 yuv420p haut débit.
