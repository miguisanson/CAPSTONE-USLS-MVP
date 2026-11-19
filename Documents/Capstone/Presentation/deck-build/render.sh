#!/bin/bash
# render.sh <pptx> <outdir> [dpi] : Keynote (never killed) -> PDF -> slide JPEGs + contact sheets. Preview only.
SP="/private/tmp/claude-501/-Users-miguelsanson-Projects-CAPSTONE-USLS-MVP/d25825b8-2faf-42e0-a489-cc86a2be591c/scratchpad"
PPTX="$1"; OUT="$2"; DPI=${3:-96}; NAME=$(basename "$PPTX" .pptx)
mkdir -p "$OUT"; find "$OUT" -name "s-*.jpg" -delete; find "$OUT" -name "grid-*.jpg" -delete; rm -f "$OUT/deck.pdf"
osascript -e 'with timeout of 30 seconds
tell application "Keynote" to close every document saving no
end timeout' >/dev/null 2>&1
open -a Keynote "$PPTX"
ok=0
for i in $(seq 1 50); do
  sleep 2
  r=$(osascript -e 'with timeout of 8 seconds
tell application "Keynote" to return name of every document
end timeout' 2>&1)
  case "$r" in *"$NAME"*) ok=1; break;; esac
done
[ $ok = 1 ] || { echo "KEYNOTE DID NOT OPEN THE FILE"; exit 1; }
sleep 2
osascript -e 'with timeout of 170 seconds
tell application "Keynote"
  set theDoc to document "'"$NAME"'"
  export theDoc to (POSIX file "'"$OUT"'/deck.pdf") as PDF with properties {skipped slides:true, PDF image quality:Good}
  close every document saving no
end tell
end timeout' 2>&1 | tail -2
[ -f "$OUT/deck.pdf" ] || { echo "NO PDF"; exit 1; }
cd "$OUT" && pdftoppm -jpeg -r $DPI deck.pdf s && "$SP/venv/bin/python" -I "$SP/scripts/grid.py" "$OUT"
