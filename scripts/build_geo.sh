#!/usr/bin/env bash
# build/geo-src/*.geojson -> data/geo/*.json (TopoJSON, sadeleştirilmiş)
# Gerekli: mapshaper (npm i -g mapshaper)
set -euo pipefail
cd "$(dirname "$0")/.."
MS=${MAPSHAPER:-mapshaper}
mkdir -p data/geo
for f in build/geo-src/*.geojson; do
  b=$(basename "$f" .geojson)
  case $b in
    tr-*)                         args="-simplify 10% keep-shapes" ;;
    h-1877*|h-1908|h-1912|h-1914) args="-dissolve id copy-fields=name -simplify 4% keep-shapes" ;;
    h-*)                          args="-dissolve id copy-fields=name -simplify 10% keep-shapes" ;;
  esac
  $MS "$f" $args -clean -o format=topojson quantization=1e5 id-field=id "data/geo/$b.json" 2>&1 | grep -vE "^\[o\]|Retained|Repaired 0 inter" || true
done
