# So Graphic — « Je change d'univers »

Vidéo motion design 15 s, 1080×1920 (9:16), 30 i/s, avec musique et bruitages.

- **Vidéo finale** : `renders/so-graphic-univers.mp4` (master haute qualité, 35 Mo)
- **Version partage** : `renders/so-graphic-univers-web.mp4` (15 Mo, idéale pour WhatsApp / e-mail / réseaux)
- **Composition** (HTML + GSAP, HyperFrames) : `index.html`
- **Bande-son** : `assets/audio/soundtrack.wav`, générée par `scripts/make_soundtrack.py`

## Déroulé

| Temps | Scène |
| --- | --- |
| 0 – 3,7 s | « Vous ne savez pas encore sur quel *brief* vous pourriez avoir besoin de moi. » — mots en rythme, « brief » entouré |
| 3,7 – 5 s | *Tape stop* : la musique s'arrête, les mots tombent — « Moi non plus. » dans le silence, le point rouge rebondit |
| 5 – 7,5 s | « Je ne change pas de métier. » — « ne » et « pas » sont barrés puis avalés → « Je change *d'univers*. » (drop) |
| 7,5 – 11 s | La même phrase dans 4 univers : IA Design · Communication visuelle · Direction artistique · Suivi de projet |
| 11 – 15 s | Le point rouge envahit l'écran puis devient le cœur du logo ; engrenages, S et « graphic » s'assemblent — « Des visuels qui vous *révèlent* » |

## Refaire le rendu

```bash
python3 scripts/make_soundtrack.py          # régénère la bande-son (numpy + ffmpeg)
npx hyperframes@0.8.149 check .             # contrôle qualité
npx hyperframes@0.8.149 preview             # aperçu / édition dans le Studio
npx hyperframes@0.8.149 render . -q high -o renders/so-graphic-univers.mp4
```

Polices : Inter Tight, Instrument Serif, Unbounded, Archivo Black, JetBrains Mono (Google Fonts, licence OFL), embarquées dans `assets/fonts`.
Bruitages : Pixabay Content License (voir `assets/sfx/CREDITS.md`).
