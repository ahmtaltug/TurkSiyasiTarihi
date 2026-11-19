#!/usr/bin/env python3
"""data/index.json (seçim listesi) ve data/parties.json (renk/kısa ad) üretir."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]  # hamiKumbasae/turkiye-secim-haritasi
B = lambda p: json.load(open(os.path.join(ROOT, 'build', p)))
cat = B('catalog-modern.json') + B('catalog-historical.json')
for c in cat:
    c.setdefault('era', 'cumhuriyet')
    d = json.load(open(os.path.join(ROOT, 'data', 'elections', c['id'] + '.json')))
    c['units'] = sum(1 for u in d['units'].values() if not u.get('nodata'))
cat.sort(key=lambda c: (c['date'], {'genel': 0, 'cumhurbaskanligi': 1, 'referandum': 2, 'senato': 3, 'yerel': 4, 'ara': 5}.get(c['type'], 9), c['id']))
json.dump(cat, open(os.path.join(ROOT, 'data', 'index.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

src = json.load(open(os.path.join(SRC, 'data', 'normalized', 'partiler.json')))
parties = {k: {'c': v.get('light'), 's': v.get('short', k)} for k, v in src.items()}
EXTRA = {  # 1950 öncesi ve özel gruplar
    'İttihat ve Terakki': ('#b71c1c', 'İT'), 'Hürriyet ve İtilaf': ('#1565c0', 'HİF'), 'Ahrar': ('#2e7d32', 'Ahrar'),
    'Taşnak': ('#f9a825', 'Taşnak'), 'Sosyalist': ('#ad1457', 'Sos.'), 'Bilinmiyor': ('#bdbdbd', '?'),
    'Müdâfaa-i Hukuk (Birinci Grup)': ('#8d1c1c', 'ARMHC'), 'İkinci Grup': ('#6d4c41', 'II. Grup'),
    'Cumhuriyet Halk Fırkası': ('#D80011', 'CHF'), 'Cumhuriyet Halk Partisi': ('#D80011', 'CHP'),
    'Serbest Cumhuriyet Fırkası': ('#1E90FF', 'SCF'), 'Demokrat Parti': ('#348AC9', 'DP'),
    'Millî Kalkınma Partisi': ('#2e7d32', 'MKP'), 'Millet Partisi': ('#FFA500', 'MP'),
    'Bağımsız': ('#78716c', 'Bğmsz'), 'Diğer': ('#a8a29e', 'Diğer'),
    'Müslüman': ('#00897b', 'Müslüman'), 'Gayrimüslim': ('#7e57c2', 'Gayrimüslim'),
    'Evet': ('#1b7f3b', 'Evet'), 'Hayır': ('#c62828', 'Hayır'),
}
# Etnik/dinî gruplar (1877-1914 listeleri): nötr, birbirinden ayırt edilebilir palet
for i, g in enumerate(['Türk', 'Arap', 'Arnavut', 'Rum', 'Ermeni', 'Bulgar', 'Yahudi', 'Sırp', 'Ulah', 'Gürcü', 'Kürt', 'Asuri', 'Süryani', 'Slav']):
    EXTRA[g] = (['#0072B2', '#009E73', '#E69F00', '#56B4E9', '#CC79A7', '#D55E00', '#F0E442', '#7f6000', '#8c564b', '#17becf', '#bcbd22', '#9467bd', '#9467bd', '#7f7f7f'][i], g)
EXTRA['Türk (?)'] = ('#7fb3d9', 'Türk (?)'); EXTRA['Arap (?)'] = ('#7fcfb7', 'Arap (?)')
for k, (c, s) in EXTRA.items():
    parties.setdefault(k, {'c': c, 's': s})
    if not parties[k].get('c'): parties[k]['c'] = c
json.dump(parties, open(os.path.join(ROOT, 'data', 'parties.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('seçim', len(cat), 'parti', len(parties))
