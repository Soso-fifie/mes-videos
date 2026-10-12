// =============================================================================
// SO GRAPHIC — « D'un univers à l'autre »
// Constantes du film : durées, couleurs, positions. Tout se règle ici.
// Les temps sont en secondes, ABSOLUS (0,0 = début du film), sauf mention contraire.
// =============================================================================

// ---- Cadre -------------------------------------------------------------------
export const W = 1080;
export const H = 1350;
export const FPS = 30;
export const DURATION = 30.0;            // 900 images
export const CX = W / 2;                 // centre du cadre (px)
export const CY = H / 2;

// ---- Couleurs (identité) ------------------------------------------------------
export const RED = "#fc0017";            // rouge So Graphic — unique rouge du film
export const INK = "#3a3a3a";            // gris foncé des textes
export const WHITE = "#ffffff";

// ---- Couleurs (univers) -------------------------------------------------------
export const NIGHT_CENTER = "#2c251e";   // fond séq. 1–2 : anthracite chaud (centre)
export const NIGHT_EDGE = "#15110e";     // fond séq. 1–2 : bords
export const GOLD = "#c79a52";           // métal des engrenages
export const GOLD_LIGHT = "#ffd9a0";     // lumière dorée chaude
export const CREAM = "#efe4d0";          // traits du cadran / contour de l'œil
export const WINE = "#24030b";           // intérieur de la goutte (séq. 3)
export const STUDIO = "#f3f0ec";         // fond clair séq. 4–5 (studio blanc chaud)
export const IVORY = "#f7f4ee";          // fils de tissu
export const WATER = "#b7d7ee";          // eau (bleu-blanc)
export const LABEL = "rgba(255, 236, 238, 0.86)"; // micro-légendes de la séq. 3

// ---- Séquences (début, fin) ---------------------------------------------------
export const SEQ = {
  S1: [0.0, 2.8],     // mécanisme horloger
  S2: [2.8, 6.0],     // cadran → œil
  S3: [6.0, 9.6],     // pupille → goutte → univers moléculaire
  S4: [9.6, 14.0],    // sortie → chute → tache
  S5: [14.0, 16.5],   // tache → fibres
  S6: [16.5, 20.5],   // fibres → tambour → blanc
  T: [20.5, 27.0],    // conclusion typographique (compositions/conclusion.html)
  L: [27.0, 30.0],    // logo (compositions/logo.html)
};

// ---- Temps-clés ---------------------------------------------------------------
export const K = {
  // S1 — engrenages
  camPull: [0.10, 2.45],         // recul caméra
  wheelShrink: [0.35, 2.45],     // la roue rouge passe de ~90 % de largeur au moyeu du cadran
  ringForm: [0.95, 2.40],        // les engrenages se rangent en anneau
  silhouette: [1.70, 2.55],      // … et passent en silhouette
  dialDraw: [1.80, 2.45],        // cercle du cadran tracé
  ticksDraw: [1.95, 2.55],       // index
  handsDraw: [2.15, 2.70],       // aiguilles
  // S2 — cadran → œil
  gearsOut: [2.80, 3.45],        // l'anneau d'engrenages se referme et disparaît
  morph: [2.95, 4.25],           // cercle → amande (+ rotation)
  ticksOut: [2.95, 3.55],
  handsFold: [3.05, 3.85],
  sclera: [3.70, 4.40],          // le blanc de l'œil apparaît
  irisGrow: [3.45, 4.60],        // la roue tourne et se résorbe en disque plein (iris)
  pupilFade: [5.00, 5.30],       // disque → pupille exacte du logo (0,3 s)
  eyePush: [4.60, 6.00],         // très léger push-in sur l'œil
  // S3 — pupille → goutte → molécules
  eyeZoom: [6.00, 6.80],         // la pupille grossit, le blanc de l'œil envahit le cadre
  dropSwap: [6.80, 6.80],        // relais net pupille plate → goutte 3D (images identiques à cet instant)
  dropVolume: [6.85, 7.45],      // la découpe blanche devient un reflet spéculaire
  dive: [7.15, 8.05],            // la caméra entre dans la goutte
  innerClear: [8.05, 8.75],      // le brouillard rouge se dissipe sur le champ de particules
  labelsIn: [8.35, 8.60, 8.85, 9.10],
  labelsOut: [9.40, 9.75],
  // S4 — sortie → chute → tache
  converge: [9.60, 10.95],       // les particules se regroupent en une goutte
  levitate: [10.95, 12.05],
  fall: [12.05, 13.30],          // trajectoire courbe
  impact: [13.30, 13.85],        // absorption, la tache s'étend
  // S5 — tache → fibres
  pushIn: [13.90, 14.75],        // plongée dans la tache
  fiberReveal: [14.40, 14.85],   // le tissu laisse place aux fibres 3D
  glide: [14.75, 16.50],         // travelling rasant sur le tissage
  flow: [14.50, 17.80],          // le rouge circule dans les fils
  // S6 — fibres → tambour → blanc
  rise: [16.50, 17.45],          // la caméra remonte à la verticale
  twist: [16.55, 19.80],         // le tissage s'enroule en spirale
  wheelIn: [17.10, 17.95],       // la grande roue devient le hublot du tambour
  waterIn: [17.45, 18.40],
  dilute: [18.10, 19.65],        // la tache se dilue jusqu'au blanc
  whiteOut: [19.20, 19.95],      // l'intérieur du tambour devient blanc pur
  pushOut: [19.65, 20.45],       // push-in à travers le hublot → blanc
};

// ---- Grande roue flat (séq. 1, 2, 6) ------------------------------------------
// Tracé exact du logo (viewBox 0 0 300 300). Centre de la roue : 168.26, 135.61.
export const WHEEL_CENTER = [168.26, 135.61];
export const WHEEL_TIP_R = 39.66;        // rayon extérieur (pointe des dents), unités logo
export const WHEEL_HOLE_R = 24.065;      // rayon du trou central, unités logo
export const WHEEL_BIG_DIAM = 0.90 * W;  // ~90 % de la largeur (séq. 1 et 6)
export const WHEEL_BIG_S = WHEEL_BIG_DIAM / (2 * WHEEL_TIP_R);   // échelle px/unité
export const WHEEL_HUB_R = 110;          // rayon (px) de la roue devenue moyeu du cadran
// Pupille exacte du logo : cercle de rayon 15,12 centré en 168.43, 135.38.
export const PUPIL_CENTER = [168.43, 135.38];
export const PUPIL_R = 15.12;
export const NOTCH = { dx: (175.18 - 168.43) / 15.12, dy: (125.15 - 135.38) / 15.12, r: 8.35 / 15.12 };

// ---- Cadran / œil (px) --------------------------------------------------------
export const DIAL_R = 330;               // rayon du cadran
export const EYE_HALF_W = 430;           // demi-largeur de l'amande
export const EYE_HALF_H = 235;           // demi-hauteur de l'amande
export const IRIS_R = 150;               // rayon du disque / de la pupille dans l'œil
export const PUPIL_BIG_R = 430;          // rayon de la pupille quand elle « remplit » le cadre (fin S3a)
export const EYE_ZOOM = 6.5;             // grossissement du blanc de l'œil en début de S3

// ---- Monde 3D -----------------------------------------------------------------
export const FOV = 35;                   // champ vertical (°)
export const GEAR_MODULE = 0.064;        // rayon primitif = module × dents / 2
export const RING_COUNT = 16;            // engrenages formant l'anneau du cadran
export const CAM_S1 = [5.0, 15.5];       // distance caméra début / fin de S1
export const DROP_R = 0.32;              // rayon de la goutte (séq. 4)
export const STAIN_R = 0.55;             // rayon final de la tache
export const THREAD_SPACING = 0.035;     // pas du tissage
export const FIBER_COUNT = 44;           // fils 3D par direction (zone centrale, nombre pair / 2 pair)
export const TOP_HEIGHT = 6.0;           // hauteur caméra verticale (séq. 6)
export const SEED = 20260;               // graine du pseudo-hasard (déterminisme)

// ---- Micro-légendes (séq. 3) --------------------------------------------------
export const LABELS = ["Ø 2,4 µm", "× 1 200", "640 nm", "pH 7,2"];
