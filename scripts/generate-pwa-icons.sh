#!/bin/bash
# Generate PWA icons from the source favicon
# Usage: bash scripts/generate-pwa-icons.sh

SOURCE="public/favicon.png"
OUT_DIR="public"

if [ ! -f "$SOURCE" ]; then
  echo "Source file $SOURCE not found"
  exit 1
fi

echo "Generating PWA icons from $SOURCE..."

# 192x192
sips -z 192 192 "$SOURCE" --out "$OUT_DIR/pwa-192x192.png" 2>/dev/null
echo "  Created pwa-192x192.png"

# 512x512
sips -z 512 512 "$SOURCE" --out "$OUT_DIR/pwa-512x512.png" 2>/dev/null
echo "  Created pwa-512x512.png"

# Apple touch icon (180x180)
sips -z 180 180 "$SOURCE" --out "$OUT_DIR/apple-touch-icon.png" 2>/dev/null
echo "  Created apple-touch-icon.png"

echo "Done! PWA icons generated in $OUT_DIR/"
