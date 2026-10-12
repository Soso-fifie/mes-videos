#!/usr/bin/env python3
"""Crée tools/qa/logo-static/index.html : le SVG officiel, immobile, cadré comme la séquence L
(viewBox 22 4 256 320 → 1080×1350, fond blanc). Sert de référence pour la superposition (section 8)."""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
svg = (ROOT / "reference/logo-So-Graphic.svg").read_text(encoding="utf-8")
paths = "\n".join(f'      <path fill="#fc0017" d="{d}"/>' for d in re.findall(r' d="([^"]+)"', svg))
out = ROOT / "tools/qa/logo-static"
out.mkdir(parents=True, exist_ok=True)
(out / "index.html").write_text(f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=1080, height=1350">
<style>html,body{{margin:0;width:1080px;height:1350px;background:#fff;overflow:hidden}}
#root{{position:relative;width:100%;height:100%;background:#fff}} svg{{position:absolute;inset:0;width:100%;height:100%}}</style>
</head><body>
<div id="root" data-composition-id="logo-static" data-start="0" data-duration="1" data-width="1080" data-height="1350">
  <div id="ref" class="clip" data-start="0" data-duration="1">
    <svg viewBox="22 4 256 320" xmlns="http://www.w3.org/2000/svg">
{paths}
    </svg>
  </div>
</div>
</body></html>
""", encoding="utf-8")
print("écrit", out / "index.html")
