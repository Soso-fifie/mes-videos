#!/usr/bin/env bash
# Rendu master sans perte intermédiaire, puis encodage des trois livrables :
#   1. HyperFrames rend le film en séquence PNG (900 images, sans compression) ;
#   2. FFmpeg encode en H.264 (High, 4:2:0, BT.709) :
#      - le film complet ;
#      - la séquence logo (images 810–899) ;
#      - la conclusion (images 615–809), identiques image pour image au film.
# Ce chemin évite l'étape JPEG du rendu MP4 standard : bords rouges plus nets.
#
# Usage : tools/encode-master.sh            (CRF=12 par défaut ; CRF=16 tools/encode-master.sh pour plus léger)
set -euo pipefail
cd "$(dirname "$0")/.."
CRF="${CRF:-12}"
FPS=30
OUT=renders
mkdir -p "$OUT"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/sograph-png-XXXX")"
trap 'rm -rf "$TMP"' EXIT

# Débuts / durées des blocs (doivent correspondre à index.html et src/config.js)
T_START=20.5; T_DUR=6.5
L_START=27.0; L_DUR=3.0

npx hyperframes render --format png-sequence --output "$TMP/frames" --quiet
FIRST="$(ls "$TMP/frames" | grep -E '\.png$' | sort | head -1)"
PREFIX="$(echo "$FIRST" | sed -E 's/[0-9]+\.png$//')"
DIGITS="$(echo "$FIRST" | sed -E 's/^.*[^0-9]([0-9]+)\.png$/\1/;s/^([0-9]+)\.png$/\1/' | tr -d '\n' | wc -c)"
START_NUM="$(echo "$FIRST" | sed -E 's/^.*[^0-9]([0-9]+)\.png$/\1/;s/^([0-9]+)\.png$/\1/' | sed 's/^0*//')"
START_NUM="${START_NUM:-0}"
COUNT="$(ls "$TMP/frames" | grep -cE '\.png$')"
echo "séquence : $COUNT images (${PREFIX}%0${DIGITS}d.png, à partir de $START_NUM)"

# Piste son : mixage des deux fichiers (muets tant qu'ils ne sont pas remplacés)
ffmpeg -y -v error -i audio/musique.wav -i audio/sound-design.wav \
  -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0,atrim=0:30" -ar 48000 "$TMP/mix.wav"

VENC=(-vf "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p"
      -c:v libx264 -profile:v high -preset slow -crf "$CRF" -tune animation -g 60
      -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart)

encode() { # $1 sortie, $2 première image (0-899), $3 nombre d'images, $4 début audio (s)
  local dur
  dur="$(python3 -c "print($3/$FPS)")"
  ffmpeg -y -v error -framerate $FPS -start_number $((START_NUM + $2)) -i "$TMP/frames/${PREFIX}%0${DIGITS}d.png" \
    -ss "$4" -t "$dur" -i "$TMP/mix.wav" -map 0:v -map 1:a -frames:v "$3" \
    "${VENC[@]}" -c:a aac -b:a 256k -t "$dur" "$1"
  ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1" | xargs echo "$1 :" images
}

encode "$OUT/so-graphic-motion-design.mp4" 0 900 0
encode "$OUT/so-graphic-conclusion.mp4" "$(python3 -c "print(round($T_START*$FPS))")" "$(python3 -c "print(round($T_DUR*$FPS))")" "$T_START"
encode "$OUT/so-graphic-logo-final.mp4" "$(python3 -c "print(round($L_START*$FPS))")" "$(python3 -c "print(round($L_DUR*$FPS))")" "$L_START"
