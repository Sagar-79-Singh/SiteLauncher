#!/usr/bin/env bash
# Regenerate the SiteLauncher icons (16/48/128 px) from the design in icons/icon.svg.
# Some ImageMagick builds lack the rsvg-convert delegate, so the PNGs are rasterized
# directly from the same geometry as icon.svg (a 128x128 viewBox). Run: bash tools/generate-icons.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p icons

# Background: rounded rect x=6 y=6 w=116 h=116 rx=28, #1f9d55 -> #0c5c38 gradient.
# Arrow polygon points: 36,84 44,92 68,69 76,52 59,60, white -> #eafff2 gradient.

make_icon () {
  local size=$1 rx=$2 s=$3 polygon

  polygon=$(awk -v s="$s" 'BEGIN{
    printf "%.3f,%.3f %.3f,%.3f %.3f,%.3f %.3f,%.3f %.3f,%.3f",
      36*s, 84*s, 44*s, 92*s, 68*s, 69*s, 76*s, 52*s, 59*s, 60*s;
  }')

  convert -size "${size}x${size}" xc:none \
    -fill "gradient:#1f9d55-#0c5c38" \
    -draw "roundrectangle 6,6 122,122 $rx,$rx" \
    /tmp/_sl_bg_$size.png

  convert /tmp/_sl_bg_$size.png \
    -fill "gradient:#ffffff-#eafff2" \
    -draw "polygon $polygon" \
    "icons/icon${size}.png"

  rm -f /tmp/_sl_bg_$size.png
  echo "wrote icons/icon${size}.png"
}

make_icon 16  3.5  0.125
make_icon 48  10.5 0.375
make_icon 128 28   1.0

echo "done"
