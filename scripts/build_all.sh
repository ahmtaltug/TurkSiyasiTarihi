#!/usr/bin/env bash
# Tüm veriyi yeniden üretir: kaynaklar -> data/elections, data/geo, data/index.json
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/fetch_sources.sh "$@"
python3 scripts/build_modern.py build/ext/turkiye-secim-haritasi
python3 scripts/build_historical.py --wiki sources/wikipedia --src build/ext/turkiye-secim-haritasi --ne build/ne/a1sel.geojson
scripts/build_geo.sh
python3 scripts/build_index.py build/ext/turkiye-secim-haritasi
python3 scripts/validate.py
