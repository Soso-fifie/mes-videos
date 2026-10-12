#!/usr/bin/env python3
"""Génère compositions/logo.html à partir du prototype validé reference/so-graphic-logo-anim.html.

Le SVG et la fonction build() (keyframes, délais, durées, courbes) sont recopiés octet pour octet.
Seuls changent : l'habillage HyperFrames (template, racine 1080×1350, fond blanc), l'absence des
boutons de prévisualisation et un décalage de temps global (début du clip hôte) ajouté aux délais,
car l'adaptateur WAAPI de HyperFrames pilote les animations en temps global du document.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ref = (ROOT / "reference/so-graphic-logo-anim.html").read_text(encoding="utf-8")

svg = re.search(r"(    <svg viewBox=\"22 4 256 320\".*?</svg>)", ref, re.S).group(1)
consts = re.search(r"(const \$ = id => .*?let anims = \[\];)", ref, re.S).group(1)
build = re.search(r"(function build\(\) \{.*?\n\})", ref, re.S).group(1)
css_rules = re.search(r"(  \.st0 \{ fill:var\(--red\); \}.*?#S        \{ transform-origin:91px 135px; \})", ref, re.S).group(1)


html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<!-- GÉNÉRÉ par tools/build-logo-composition.py depuis reference/so-graphic-logo-anim.html — ne pas éditer à la main. -->
<title>So Graphic — séquence L (logo)</title>
</head>
<body>
<template>
<style>
  @font-face {{ font-family:"Outfit"; font-weight:400; font-style:normal; src:url("../assets/fonts/outfit-latin-400-normal.woff2") format("woff2"); }}
  #so-logo-root {{ --red:#fc0017; position:absolute; inset:0; width:100%; height:100%; background:#ffffff; overflow:hidden; font-family:Outfit, system-ui, sans-serif; }}
  #so-logo-root svg {{ position:absolute; inset:0; width:100%; height:100%; }}
  /* Règles CSS du prototype, inchangées */
{css_rules}
</style>
<div id="so-logo-root" data-composition-id="so-logo" data-start="0" data-duration="3" data-width="1080" data-height="1350">
{svg}
</div>
<script>
(() => {{
// Début du clip hôte en ms (27 000 dans le film complet, 0 en rendu autonome).
const HOST = document.getElementById('so-logo-root').closest('[data-start]');
const LOGO_START_MS = Math.round(parseFloat((HOST && HOST.getAttribute('data-start')) || '0') * 1000);

// ---- Prototype validé, recopié tel quel ----
{consts}

function A(el, frames, delay, duration, easing, fill='both') {{
  anims.push(el.animate(frames, {{ delay: delay + LOGO_START_MS, duration, easing, fill }}));
}}

{build}
// ---- fin du code du prototype ----

build();
anims.forEach(a => a.pause());
}})();
</script>
</template>
</body>
</html>
"""
(ROOT / "compositions/logo.html").write_text(html, encoding="utf-8")
print("compositions/logo.html écrit", len(html), "octets")
