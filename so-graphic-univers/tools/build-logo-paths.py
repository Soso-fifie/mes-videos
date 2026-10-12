#!/usr/bin/env python3
"""Extrait les tracés officiels de reference/logo-So-Graphic.svg vers src/logo-paths.js (aucune retouche)."""
import json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
svg = (ROOT / "reference/logo-So-Graphic.svg").read_text(encoding="utf-8")
d = re.findall(r' d="([^"]+)"', svg)
names = ["PUPIL_D", "WHEEL_D", "SMALL_WHEEL_D", "S_D"] + [f"GRAPHIC_D{i}" for i in range(1, 8)]
out = ["// GÉNÉRÉ par tools/build-logo-paths.py depuis reference/logo-So-Graphic.svg — tracés officiels, ne pas éditer."]
for n, v in zip(names, d):
    out.append(f"export const {n} = {json.dumps(v)};")
(ROOT / "src/logo-paths.js").write_text("\n".join(out) + "\n", encoding="utf-8")
print(len(d), "tracés écrits")
