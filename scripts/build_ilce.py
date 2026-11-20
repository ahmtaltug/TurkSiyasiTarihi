#!/usr/bin/env python3
"""İlçe düzeyi sonuçlar ve döneminin ilçe sınırları.

Kaynak: hamiKumbasae/turkiye-secim-haritasi (sabit sürüm; scripts/fetch_sources.sh).
  - data/normalized/elections/*/<seçim>.json içindeki "ilceler" satırları (1950 ve 1955 yerel, 1961 sonrası bütün seçimler)
  - geo/normalized/turkiye_ilce_sinirlari.geojson (bugünkü 973 ilçe)
  - geo/historical/turkiye_ilce_sinirlari_hist_splits.geojson (bölünmeden önceki ilçe şekilleri)
  - geo/historical/idari/merge_plan.json (sonradan kurulan ilçelerin, ayrıldıkları ilçeyle birleştirilmesi)
  - geo/historical/idari/election_admin_snapshots.json (her seçimde ilçenin bağlı olduğu il)

Çıktı:
  - build/geo-src/ilce.geojson -> scripts/build_geo.sh ile data/geo/ilce.json (tek TopoJSON; seçimler alt kümesini kullanır)
  - data/ilce/<seçim>.json (ilçe sonuçları; kimlikler geometriyle eşleşir)
  - data/ilce/index.json (ilçe verisi olan seçimler)
"""
import glob, json, os, sys
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from party_names import KEY_FIXES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'ext', 'turkiye-secim-haritasi')
OUT = os.path.join(ROOT, 'data', 'ilce')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'build', 'geo-src'), exist_ok=True)


def load(p):
    with open(os.path.join(SRC, p), encoding='utf-8') as f:
        return json.load(f)


ours = {e['id']: e for e in json.load(open(os.path.join(ROOT, 'data', 'index.json'), encoding='utf-8'))}
modern = {f['properties']['id']: f for f in load('geo/normalized/turkiye_ilce_sinirlari.geojson')['features']}
hist = {f['properties']['id']: f for f in load('geo/historical/turkiye_ilce_sinirlari_hist_splits.geojson')['features']}
synth = load('geo/historical/idari/merge_plan.json')['sentetikler']
snap = load('geo/historical/idari/election_admin_snapshots.json')['elections']

used, geoms, index = set(), {}, []


def geom_for(gid):
    if gid in geoms:
        return geoms[gid]
    g = None
    if gid in modern:
        g = shape(modern[gid]['geometry'])
    elif gid in hist:
        g = shape(hist[gid]['geometry'])
    elif gid in synth:
        parts = [synth[gid]['taban']] + synth[gid]['katilanlar']
        g = unary_union([shape(modern[p]['geometry']).buffer(0) for p in parts if p in modern])
    geoms[gid] = g
    return g


for path in sorted(glob.glob(os.path.join(SRC, 'data/normalized/elections/*/*.json'))):
    eid = os.path.splitext(os.path.basename(path))[0]
    if eid not in ours:
        continue
    src = json.load(open(path, encoding='utf-8'))
    rows = src.get('ilceler') or []
    if not rows:
        continue
    year = int(ours[eid]['date'][:4])
    il_data = json.load(open(os.path.join(ROOT, 'data', 'elections', eid + '.json'), encoding='utf-8'))
    # dönemin il bağlılığı: snapshot (ilçe adı ve geometri kimliği -> plaka)
    era = {}
    for pl, lst in ((snap.get(eid) or {}).get('ilceler') or {}).items():
        if not str(pl).isdigit():
            continue
        for x in lst:
            era[x['geomId']] = int(pl)
            era[(x['ad'], x['geomId'])] = int(pl)
    units, skipped = {}, []
    for r in rows:
        gid = r.get('geomId')
        if not gid or geom_for(gid) is None:
            il_s = (il_data['units'].get(str(r.get('plaka'))) or {}).get('name')
            skipped.append('%s (%s)' % (r.get('ad'), il_s) if il_s else r.get('ad')); continue
        base = synth[gid]['taban'] if gid in synth else gid
        pl = era.get(gid) or era.get(base) or r.get('plaka')
        il_u = il_data['units'].get(str(pl)) or {}
        pct = {k: v.get('oran') for k, v in (r.get('oy') or {}).items() if isinstance(v, dict) and v.get('oran') is not None}
        winner = r.get('kazanan')
        for old, a, b, new, fplaka, _ in KEY_FIXES:      # il düzeyiyle aynı parti anahtarı düzeltmeleri
            if a <= year <= b and (fplaka is None or fplaka == pl):
                if old in pct: pct[new] = pct.pop(old)
                if winner == old: winner = new
        u = {'name': r.get('ad'), 'il': il_u.get('name') or '', 'pl': pl, 'winner': winner,
             'pct': dict(sorted(((k, round(v, 2)) for k, v in pct.items()), key=lambda kv: -kv[1]))}
        if r.get('gecerliOy'): u['valid'] = r['gecerliOy']
        if r.get('secmen'): u['voters'] = r['secmen']
        if r.get('katilim') is not None: u['turnout'] = r['katilim']
        if r.get('sadeceKazanan'): u['note'] = 'Kaynakta yalnız kazanan parti var; oy oranları bilinmiyor.'; u['pct'] = {}
        if gid in units:   # aynı geometriye düşen iki satır: oyları birleştirmek yerine ilkini koru, not düş
            units[gid].setdefault('note', 'Bu alana birden çok kayıt düşüyor; ilki gösterilir.')
            continue
        units[gid] = u
        used.add(gid)
    out = {'id': eid, 'units': units, 'count': len(units)}
    if skipped:
        out['skipped'] = skipped
    with open(os.path.join(OUT, eid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    index.append({'id': eid, 'count': len(units)})
    print(eid, len(units), 'ilçe', ('(geometrisiz: %s)' % ', '.join(map(str, skipped))) if skipped else '')

feats = [{'type': 'Feature', 'properties': {'id': gid}, 'geometry': mapping(geoms[gid])} for gid in sorted(used)]
with open(os.path.join(ROOT, 'build', 'geo-src', 'ilce.geojson'), 'w', encoding='utf-8') as f:
    json.dump({'type': 'FeatureCollection', 'features': feats}, f)
with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
print('geometri', len(feats), 'seçim', len(index))
