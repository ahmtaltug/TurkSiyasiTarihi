#!/usr/bin/env bash
# Derleme için dış kaynakları build/ altına indirir.
#   - hamiKumbasae/turkiye-secim-haritasi (sabit sürüm, yalnız gerekli klasörler)
#   - Natural Earth 10m admin-1 (Türkiye dışı vilayetler) ve 50m ülkeler (arka plan)
# Vikipedi metinleri depoda (sources/wikipedia) hazır gelir; yeniden indirmek için --wiki verin.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC_COMMIT=19ccddcdaec809e072deb56ef4ba2cf180e430a1
mkdir -p build/ext build/ne
if [ ! -d build/ext/turkiye-secim-haritasi ]; then
  git clone --filter=blob:none --no-checkout https://github.com/hamiKumbasae/turkiye-secim-haritasi.git build/ext/turkiye-secim-haritasi
  git -C build/ext/turkiye-secim-haritasi sparse-checkout set --no-cone /data/normalized/ /geo/normalized/turkiye_il_sinirlari.geojson /geo/normalized/turkiye_ilce_sinirlari.geojson /geo/historical/
  git -C build/ext/turkiye-secim-haritasi checkout "$SRC_COMMIT"
fi
NE=https://naturalearth.s3.amazonaws.com
[ -f build/ne/a1.zip ] || curl -sSfL -o build/ne/a1.zip "$NE/10m_cultural/ne_10m_admin_1_states_provinces.zip"
[ -f build/ne/a0.zip ] || curl -sSfL -o build/ne/a0.zip "$NE/50m_cultural/ne_50m_admin_0_countries.zip"
(cd build/ne && unzip -oq a1.zip -d a1 && unzip -oq a0.zip -d a0)
MS=${MAPSHAPER:-mapshaper}
$MS build/ne/a1/ne_10m_admin_1_states_provinces.shp \
  -filter '["GRC","BGR","ALB","MKD","SRB","MNE","BIH","KOS","ROU","SYR","LBN","ISR","PSX","JOR","IRQ","SAU","YEM","LBY","CYP","GEO"].indexOf(adm0_a3)>-1' \
  -filter-fields adm0_a3,name -o format=geojson precision=0.0001 build/ne/a1sel.geojson
$MS build/ne/a0/ne_50m_admin_0_countries.shp -clip bbox=5,5,65,52 -filter-fields NAME_TR,ADM0_A3 \
  -rename-fields name=NAME_TR,id=ADM0_A3 -simplify 50% weighted keep-shapes -o format=topojson quantization=1e5 data/geo/world.json
if [ "${1:-}" = "--wiki" ]; then
  i=0
  for t in "Meclis-i Mebûsan "{1..6}". dönem mebusları listesi" "TBMM "{1..8}". dönem milletvekilleri listesi" "1946 Türkiye genel seçimleri"; do
    i=$((i+1)); case $i in [1-6]) f="mm$i";; 15) f="tr1946";; *) f="tbmm$((i-6))";; esac
    enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1].replace(" ","_")))' "$t")
    curl -sSfL -A "SecimAtlasiBuild/1.0" -o "sources/wikipedia/$f.txt" "https://tr.wikipedia.org/wiki/$enc?action=raw"; sleep 2
  done
fi
if [ "${1:-}" = "--verify" ]; then  # scripts/verify_wiki.py için seçim maddeleri
  mkdir -p build/wiki-verify
  get() { enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1].replace(" ","_")))' "$2"); curl -sSfL -A "SecimAtlasiBuild/1.0" -o "build/wiki-verify/$1.txt" "https://tr.wikipedia.org/wiki/$enc?action=raw" || true; sleep 2; }
  for y in 1950 1954 1957 1961 1965 1969 1973 1977 1983 1987 1991 1995 1999 2002 2007 2011 2018 2023; do get g$y "$y Türkiye genel seçimleri"; done
  get g2015h "Haziran 2015 Türkiye genel seçimleri"; get g2015k "Kasım 2015 Türkiye genel seçimleri"
  for y in 1950 1955 1963 1968 1973 1977 1984 1989 1994 1999 2004 2009 2014 2019 2024; do get y$y "$y Türkiye yerel seçimleri"; done
  for y in 2014 2018 2023; do get c$y "$y Türkiye cumhurbaşkanlığı seçimi"; done
  python3 scripts/verify_wiki.py build/wiki-verify
fi
echo "Kaynaklar hazır."
