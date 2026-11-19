#!/usr/bin/env python3
"""Yayın verisinin tutarlılık denetimi: index, seçim dosyaları ve sınır dosyaları birbirini tutuyor mu?"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, 'data', *p)
errors, warns = [], []
index = json.load(open(D('index.json')))
parties = json.load(open(D('parties.json')))
geo_ids = {}
ids = set()
for e in index:
    if e['id'] in ids: errors.append('yinelenen id ' + e['id'])
    ids.add(e['id'])
    path = D('elections', e['id'] + '.json')
    if not os.path.exists(path): errors.append('dosya yok: ' + path); continue
    d = json.load(open(path))
    for k in ('id', 'title', 'date', 'type', 'units', 'sources'):
        if k not in d: errors.append(f"{e['id']}: '{k}' alanı yok")
    if not d.get('sources'): errors.append(f"{e['id']}: kaynak belirtilmemiş")
    if d.get('geo'):
        g = d['geo']
        if g not in geo_ids:
            t = json.load(open(D('geo', g + '.json')))
            obj = t['objects'][next(iter(t['objects']))]
            geo_ids[g] = {x.get('id') for x in obj['geometries']}
        missing = set(d['units']) - geo_ids[g]
        if missing: errors.append(f"{e['id']}: sınırı olmayan birimler {sorted(missing)[:8]}")
    for uid, u in d['units'].items():
        if u.get('pct'):
            s = sum(v for v in u['pct'].values() if v)
            if s > 100.6: warns.append(f"{e['id']}/{uid}: oranlar toplamı %{s:.1f}")
        w = u.get('winner')
        if w and w not in parties and f"{e['id']}: '{w}' için renk yok" not in warns: warns.append(f"{e['id']}: '{w}' için renk yok")
print(f"{len(index)} seçim, {len(geo_ids)} sınır dosyası denetlendi; {len(errors)} hata, {len(warns)} uyarı")
for w in warns[:30]: print('UYARI', w)
for x in errors: print('HATA', x)
sys.exit(1 if errors else 0)
