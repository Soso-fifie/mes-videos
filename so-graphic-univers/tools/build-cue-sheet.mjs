#!/usr/bin/env node
// Génère cue-sheet.md à partir des constantes de src/config.js (séquences 1–6),
// des constantes de compositions/conclusion.html et de la chorégraphie du prototype du logo.
// Usage : node tools/build-cue-sheet.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { K, SEQ, FPS } from "../src/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Constantes de la conclusion, lues dans le fichier (temps locaux → absolus)
const conc = readFileSync(join(ROOT, "compositions/conclusion.html"), "utf8");
const C = Object.fromEntries([...conc.matchAll(/const (\w+)\s*=\s*([0-9.]+);/g)].map((m) => [m[1], parseFloat(m[2])]));
const T0 = SEQ.T[0];
const L0 = SEQ.L[0];

const f = (t) => Math.round(t * FPS);
const tc = (t) => {
  const s = Math.floor(t + 1e-9), fr = Math.round((t - s) * FPS);
  return `0:${String(s).padStart(2, "0")}:${String(fr).padStart(2, "0")}`;
};
const row = (a, b, what, sound) =>
  `| ${tc(a)}${b != null ? ` → ${tc(b)}` : ""} | ${f(a)}${b != null ? `–${f(b)}` : ""} | ${what} | ${sound} |`;

const lines = [
  "# Cue-sheet — So Graphic « D'un univers à l'autre »",
  "",
  "Film : 30,00 s · 30 i/s · 900 images (n° 0 à 899). Timecode `m:ss:ii` (ii = image dans la seconde, 00–29).",
  "Pistes à remplacer : `audio/musique.wav` et `audio/sound-design.wav` (muettes, 30 s, 48 kHz stéréo).",
  "",
  "> Généré par `node tools/build-cue-sheet.mjs` depuis les constantes du projet : relancer après tout changement de timing.",
  "",
  "| Timecode | Images | Événement visuel | Suggestion son |",
  "|---|---|---|---|",
  `| **Séquence 1 — mécanisme horloger** | | | |`,
  row(0, null, "Ouverture : grande roue rouge (~90 % de la largeur), engrenages dorés déjà en rotation", "Tic-tac / cliquetis mécanique continu, entrée musique"),
  row(...K.camPull, "Recul caméra", "Montée légère"),
  row(...K.ringForm, "Les engrenages se réorganisent en anneau", "Cliquetis qui s'accélèrent"),
  row(...K.silhouette, "Passage en silhouette", ""),
  row(...K.dialDraw, "Le cercle du cadran se trace", "Trait / glissando court"),
  row(...K.ticksDraw, "Index du cadran", "12 micro-ticks"),
  row(...K.handsDraw, "Aiguilles", "Tick net"),
  `| **Séquence 2 — du cadran à l'œil** | | | |`,
  row(...K.gearsOut, "L'anneau d'engrenages se referme et disparaît", "Fermeture mécanique"),
  row(...K.morph, "Morph cadran → œil (amande) avec rotation", "Whoosh doux"),
  row(...K.handsFold, "Les aiguilles se replient", ""),
  row(...K.irisGrow, "La roue tourne et se résorbe en disque plein (iris)", "Spin ascendant"),
  row(...K.sclera, "Le blanc de l'œil apparaît", ""),
  row(...K.pupilFade, "**Transformation de la pupille** : disque → pupille exacte du logo", "Accent bref (« clic » optique)"),
  `| **Séquence 3 — pupille → goutte → univers moléculaire** | | | |`,
  row(...K.eyeZoom, "La pupille grossit, le blanc de l'œil envahit le cadre", "Aspiration"),
  row(K.dropSwap[0], null, "Relais pupille plate → goutte 3D (image identique)", ""),
  row(...K.dropVolume, "La découpe blanche devient un reflet : la goutte prend du volume", "Son liquide, verre"),
  row(...K.dive, "Plongée dans la goutte", "Whoosh immersif"),
  row(K.dive[1], null, "**Traversée de la surface**", "Bulle / « plop » étouffé"),
  row(...K.innerClear, "**Univers moléculaire** : le brouillard rouge se dissipe", "Nappe aquatique, son sous-marin"),
  ...K.labelsIn.map((t, i) => row(t, null, `Micro-légende ${i + 1}`, "Bip / tick discret")),
  row(...K.labelsOut, "Les légendes s'effacent", ""),
  `| **Séquence 4 — sortie, chute, tache** | | | |`,
  row(...K.converge, "**Formation de la goutte** : les particules se regroupent", "Aspiration / rassemblement"),
  row(...K.levitate, "Lévitation", "Suspension"),
  row(...K.fall, "**Chute** sur une trajectoire courbe", "Glissando descendant"),
  row(K.impact[0], null, "**Impact sur le tissu**", "Goutte qui touche un tissu (doux, mat)"),
  row(...K.impact, "Absorption, la tache ronde s'étend", "Absorption feutrée"),
  `| **Séquence 5 — tache → fibres** | | | |`,
  row(...K.pushIn, "Plongée rapide dans la tache", "Whoosh"),
  row(...K.fiberReveal, "Les fibres 3D apparaissent", "Texture textile"),
  row(...K.glide, "**Mouvement des fibres** : travelling sur le tissage", "Frottements de fils, cordes pincées"),
  row(...K.flow, "Le rouge circule dans les fils", ""),
  `| **Séquence 6 — tambour → blanc** | | | |`,
  row(...K.rise, "Remontée verticale, le tissage s'enroule en spirale", "Rotation qui démarre"),
  row(...K.wheelIn, "La grande roue devient le hublot du **tambour**", "Fermeture de hublot"),
  row(K.rise[0], K.pushOut[1], "**Rotation du tambour** (accélère jusqu'à " + (K.rise[0] + 1.2).toFixed(2) + " s puis vitesse constante)", "Ronronnement de tambour"),
  row(...K.waterIn, "**Eau** et bulles", "Eau, bulles"),
  row(...K.dilute, "La tache se dilue (désaturation)", "Filtre qui s'ouvre"),
  row(...K.whiteOut, "L'intérieur devient blanc pur", ""),
  row(...K.pushOut, "Push-in à travers le hublot → blanc", "Souffle, coupe vers la conclusion"),
  `| **Conclusion typographique** | | | |`,
  ...[0, 1, 2, 3].map((i) => row(T0 + C.P1_GROUP_START + i * C.P1_GROUP_STEP, null, `Phrase 1, groupe de mots ${i + 1}`, i === 0 ? "Musique en retrait" : "")),
  row(T0 + C.P1_OUT, T0 + C.P1_GONE, "La phrase 1 disparaît", "Coupe musicale"),
  row(T0 + C.P1_GONE, T0 + C.P2_IN, "**SILENCE** — blanc pur", "**Silence total**"),
  row(T0 + C.P2_IN, null, "**« Moi non plus. »** (apparition sèche)", "**Reprise musicale** (attaque nette)"),
  row(T0 + C.L1_IN, null, "« Je ne change pas de métier. »", ""),
  row(T0 + C.L2_IN, null, "« Je change d'**univers**. »", "Accent sur « univers »"),
  row(T0 + C.P3_OUT, T0 + C.P3_GONE, "Tout disparaît (blanc)", ""),
  `| **Logo** (chorégraphie du prototype validé) | | | |`,
  row(L0 + 0.0, L0 + 0.7, "La grande roue arrive en tournant", "Swoosh rotatif"),
  row(L0 + 0.4, L0 + 0.7, "La pupille apparaît", "Pop"),
  row(L0 + 0.85, L0 + 1.2, "**Clin d'œil** (fermé ≈ " + tc(L0 + 0.983) + " → " + tc(L0 + 1.06) + ")", "Clin d'œil (« tic » doux)"),
  row(L0 + 1.15, L0 + 1.5, "La petite roue surgit", "Pop aigu"),
  row(L0 + 1.45, L0 + 2.25, "Les deux roues tournent ensemble, arrêt pile", "Engrenage, clic final à " + tc(L0 + 2.25)),
  row(L0 + 1.6, L0 + 2.05, "« S »", ""),
  row(L0 + 1.75, L0 + 2.2, "« Graphic »", ""),
  row(L0 + 2.3, L0 + 2.7, "Signature « Des visuels qui vous révèlent »", "Résolution musicale"),
  row(L0 + 2.7, 30 - 1 / FPS, "Logo complet tenu", "Fin de la musique à 0:30:00"),
  "",
];
writeFileSync(join(ROOT, "cue-sheet.md"), lines.join("\n"));
console.log("cue-sheet.md écrit (" + (lines.length - 10) + " lignes de repères)");
