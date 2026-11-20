#!/usr/bin/env python3
"""İlçe düzeyi sonuçlar ve döneminin ilçe sınırları.

Kaynak: hamiKumbasae/turkiye-secim-haritasi (sabit sürüm; scripts/fetch_sources.sh).
  - data/normalized/elections/*/<seçim>.json içindeki "ilceler" satırları (1950 ve 1955 yerel, 1961 sonrası bütün seçimler)
  - geo/normalized/turkiye_ilce_sinirlari.geojson (bugünkü 973 ilçe)
  - geo/historical/turkiye_ilce_sinirlari_hist_splits.geojson (bölünmeden önceki ilçe şekilleri)
  - geo/historical/idari/merge_plan.json (sonradan kurulan ilçelerin, ayrıldıkları ilçeyle birleştirilmesi)
  - geo/historical/idari/election_admin_snapshots.json (her seçimde ilçenin bağlı olduğu il)
  - geo/historical/idari/district_lineage.json (ilçelerin kuruluş tarihi ve kuruluş kanunundaki ana ilçeleri)

Seçim tarihinde henüz kurulmamış ve ana ilçesi kaynakta belirsiz olan ilçelerin alanı scripts/ilce_gaps.py ile
o seçimdeki bir birime katılır (önceden haritada boş kalıyordu; ör. 1950'de Araklı).

Çıktı:
  - build/geo-src/ilce.geojson -> scripts/build_geo.sh ile data/geo/ilce.json (tek TopoJSON; seçimler alt kümesini kullanır)
  - data/ilce/<seçim>.json (ilçe sonuçları; kimlikler geometriyle eşleşir)
  - data/ilce/index.json (ilçe verisi olan seçimler)
"""
import glob, hashlib, json, os, sys
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from party_names import KEY_FIXES  # noqa: E402
from ilce_gaps import fill_gaps  # noqa: E402

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

lineage = {d['geomId']: d for d in load('geo/historical/idari/district_lineage.json')['districts']}
modern_g = {k: shape(f['geometry']).buffer(0) for k, f in modern.items()}
used, geoms, index = set(), {}, []
filled_total = {}


def district_name(gid):
    ad = ((lineage.get(gid) or {}).get('adlar') or [{}])[-1].get('ad')
    return ad or (lineage.get(gid) or {}).get('ad', gid).title()


def norm(t):
    return (t or '').replace('İ', 'i').replace('I', 'ı').lower().replace('â', 'a').replace('î', 'i').replace('û', 'u').strip()


ERA_IL = {'tr-modern': 'geo/normalized/turkiye_il_sinirlari.geojson'}
_prov_cache = {}


def province_map(era):
    """Bugünkü ilçe -> seçim döneminin il sınırına göre plaka (ilçenin iç noktası hangi ilin içinde)."""
    if era in _prov_cache:
        return _prov_cache[era]
    path = ERA_IL.get(era) or 'geo/historical/turkiye_il_sinirlari_%s.geojson' % era.replace('tr-', '')
    fs = load(path)['features']
    gs = [shape(f['geometry']).buffer(0) for f in fs]
    tree = STRtree(gs)
    out = {}
    for m, g in modern_g.items():
        pt = g.representative_point()
        for k in tree.query(pt):
            if gs[k].contains(pt):
                out[m] = int(fs[k]['properties']['plaka'])
                break
    _prov_cache[era] = out
    return out


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
    prov = province_map(il_data['geo'])
    for r in rows:
        gid = r.get('geomId')
        if not gid or geom_for(gid) is None:
            same = [m for m in modern if prov.get(m) == r.get('plaka') and norm(district_name(m)) == norm(r.get('ad'))]
            if len(same) == 1 and same[0] not in units:
                gid = same[0]
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
    # kaynak veri setinin birleştirme planındaki (ana ilçesi bilinen) sonradan kurulmuş ilçeler
    for gid, u in units.items():
        if gid in synth:
            u['added'] = [{'ad': district_name(m), 'kurulus': ((lineage.get(m) or {}).get('kurulus') or {}).get('tarih'),
                           'yontem': 'kaynak'} for m in synth[gid]['katilanlar'] if m in modern_g]
    ug = {gid: geom_for(gid).buffer(0) for gid in units}
    # yerel seçimlerde il merkezi satırı kaynakta yoksa: il düzeyi kayıt zaten il merkezi belediyesinin sonucudur
    if ours[eid]['type'] == 'yerel':
        tree = STRtree(list(ug.values()))
        allg = list(ug.values())
        for pl_s, il_u in il_data['units'].items():
            if il_u.get('nodata') or not il_u.get('winner'):
                continue
            mk = [m for m in modern_g if prov.get(m) == int(pl_s) and (lineage.get(m) or {}).get('plaka') == int(pl_s) and (
                  ((lineage.get(m) or {}).get('kurulus') or {}).get('merkezIlce') or (lineage.get(m) or {}).get('merkezIlceDonusumu'))]
            free = []
            for m in mk:
                g = modern_g[m]
                hit = [allg[k] for k in tree.query(g)]
                if not hit or unary_union(hit).intersection(g).area < 0.5 * g.area:
                    free.append(m)
            if not free:
                continue
            gid = 'MRK-%s-%s' % (pl_s.zfill(2), hashlib.md5(' '.join(sorted(free)).encode()).hexdigest()[:6])
            geoms[gid] = ug[gid] = unary_union([modern_g[m] for m in free])
            units[gid] = {'name': 'Merkez', 'il': il_u.get('name') or '', 'pl': int(pl_s), 'winner': il_u['winner'],
                          'pct': dict(il_u.get('pct') or {}),
                          'note': 'İl merkezi belediyesinin ilçe satırı kaynakta yok; sonuç bu seçimin il düzeyi kaydından '
                                  '(il merkezi belediye başkanlığı) alındı.'}
            if not units[gid]['pct']:
                units[gid]['note'] += ' Oy oranı yok; yalnız kazanan.'
    # henüz kurulmamış, ana ilçesi belirsiz ilçelerin alanı: o seçimdeki bir birime katılır
    added, _left = fill_gaps(ug, {g: u['pl'] for g, u in units.items()}, modern_g, lineage,
                             province_map(il_data['geo']), eid, ours[eid]['date'])
    for gid, lst in added.items():
        ids = sorted(m for m, _ in lst)
        new_id = '%s~%s' % (gid, hashlib.md5(' '.join(ids).encode()).hexdigest()[:6])
        geoms[new_id] = ug[gid]
        u = units.pop(gid)
        u['added'] = sorted(u.get('added', []) + [{'ad': district_name(m), 'kurulus': ((lineage.get(m) or {}).get('kurulus') or {}).get('tarih'),
                                                   'yontem': how} for m, how in lst], key=lambda a: a['ad'])
        units[new_id] = u
        filled_total[eid] = filled_total.get(eid, 0) + len(lst)
    # kalan boşluklar (seçimde var olan ama sonucu kaynakta olmayan ilçeler): haritada adıyla "veri yok" olarak
    allg = [geoms.get(g) or geom_for(g) for g in units]
    tree = STRtree(allg)
    for m, g in modern_g.items():
        hit = [allg[k] for k in tree.query(g)]
        if hit and unary_union(hit).intersection(g).area >= 0.5 * g.area:
            continue
        pl = prov.get(m)
        geoms[m] = g
        units[m] = {'name': district_name(m), 'il': (il_data['units'].get(str(pl)) or {}).get('name') or '', 'pl': pl,
                    'nodata': True, 'note': 'Bu ilçenin bu seçimdeki sonucu kaynakta yok.'}
    used.update(units)
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
print('geometri', len(feats), 'seçim', len(index), '| doldurulan boşluk', sum(filled_total.values()))
