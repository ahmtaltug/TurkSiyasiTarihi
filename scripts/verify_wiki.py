#!/usr/bin/env python3
"""Parti adlarını, cumhurbaşkanı adaylarını ve halkoylaması tarihlerini Vikipedi seçim maddeleriyle karşılaştırır.

Kullanım: python3 scripts/verify_wiki.py <vikipedi-ham-metin-klasörü>
Klasörde g<yıl>.txt (genel), y<yıl>.txt (yerel), c<yıl>.txt (cumhurbaşkanlığı) dosyaları beklenir
(scripts/fetch_sources.sh --verify ile indirilir). Bulgular docs/dogrulama-raporu.md dosyasına yazılır.
"""
import json, os, re, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from party_names import full_name, ALIASES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = sys.argv[1]

def plain(t):
    t = re.sub(r'<ref[^>]*/>', '', t); t = re.sub(r'<ref[^>]*>.*?</ref>', '', t, flags=re.S)
    t = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1 ', t)
    return t

def page_for(d):
    y = d['date'][:4]
    if d['type'] == 'genel':
        f = {'2015Haziran': 'g2015h', '2015Kasim': 'g2015k'}.get(d['id'], 'g' + y)
    elif d['type'] == 'yerel':
        f = 'y' + y
    elif d['type'] == 'cumhurbaskanligi':
        f = 'c' + y
    else:
        return None
    p = os.path.join(W, f + '.txt')
    if not os.path.exists(p) or os.path.getsize(p) < 4000:
        return None
    return plain(open(p).read())

rows, missing, checked = [], [], 0
for path in sorted(glob.glob(os.path.join(ROOT, 'data', 'elections', '*.json'))):
    d = json.load(open(path))
    if d.get('era') != 'cumhuriyet' or d.get('metric') != 'votes' or d['date'] < '1950':
        continue
    text = page_for(d)
    if text is None:
        continue
    y = int(d['date'][:4])
    keys = set(d.get('parties') or []) | {u['winner'] for u in d['units'].values() if u.get('winner')}
    keys |= {k for k, v in (d.get('national', {}).get('pct') or {}).items() if v and v >= 1}
    keys -= {'Diğer', 'Evet', 'Hayır'}
    for k in sorted(keys):
        checked += 1
        if d['type'] == 'cumhurbaskanligi':
            names = [k]
        else:
            n = full_name(k, y)
            if n is None:
                missing.append((d['id'], k, 'tam adı tanımlı değil')); continue
            names = ALIASES.get(n, [n])
        ok = any(nm in text for nm in names)
        if not ok:
            missing.append((d['id'], k, ' / '.join(names)))

os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
with open(os.path.join(ROOT, 'docs', 'dogrulama-raporu.md'), 'w') as f:
    f.write('# Otomatik doğrulama raporu\n\n')
    f.write('`scripts/verify_wiki.py` çıktısıdır. 1950 sonrası her genel, yerel ve cumhurbaşkanlığı seçiminde haritada '
            'görünen partilerin tam adı (ya da aday adı), o seçimin Türkçe Vikipedi maddesinde aranır.\n\n')
    f.write(f'- Denetlenen parti/aday–seçim çifti: **{checked}**\n- Maddede bulunamayan: **{len(missing)}**\n\n')
    if missing:
        f.write('| Seçim | Anahtar | Aranan ad |\n|---|---|---|\n')
        for e, k, n in missing:
            f.write(f'| {e} | {k} | {n} |\n')
print(f'{checked} çift denetlendi; bulunamayan {len(missing)}')
for m in missing: print('  ', m)
