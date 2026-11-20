#!/usr/bin/env python3
"""data/index.json (seçim listesi) ve data/parties.json (renk/kısa ad) üretir."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from party_names import full_name
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]  # hamiKumbasae/turkiye-secim-haritasi
B = lambda p: json.load(open(os.path.join(ROOT, 'build', p)))
cat = B('catalog-modern.json') + B('catalog-historical.json')
for c in cat:
    c.setdefault('era', 'cumhuriyet')
    d = json.load(open(os.path.join(ROOT, 'data', 'elections', c['id'] + '.json')))
    c['units'] = sum(1 for u in d['units'].values() if not u.get('nodata'))
# ---- güvenilirlik düzeyi (kaynağın türüne göre; veri doğrulaması değil)
try:
    import yaml
    SRCY = yaml.safe_load(open(os.path.join(SRC, 'sources.yml')))['elections']
except Exception:
    SRCY = {}
LEVELS = {
    'resmi': 'Resmî kaynak',
    'derleme': 'Ansiklopedik derleme',
    'yaklasik': 'Kısmi / yaklaşık',
    'yok': 'Sonuç verisi yok',
}
def reliability(c, d):
    i = c['id']
    if c.get('geo') is None or c.get('metric') == 'local-early':
        return 'yok', 'Bu kayıt için il düzeyinde derlenmiş sonuç verisi yok; yalnız açıklama ve dönemin sınırları gösterilir.'
    if c.get('era') == 'osmanli' or i in ('1920', '1923', '1927', '1931', '1935', '1939', '1943'):
        return 'derleme', 'Vekil sayıları ve mensubiyetler Vikipedi dönem listelerinden sayıldı; birincil kaynakla (meclis albümleri, zabıtlar) karşılaştırılmadı.'
    if i == '1946':
        return 'yaklasik', 'İl oyları Vikipedi\'nin seçim mazbatalarından derlediği tablodan; bir kısmı yaklaşık ("+/-"), bazı partilerin oyu bilinmiyor. Resmî il sonuçları yayımlanmadı.'
    if i == '1930yerel':
        return 'yaklasik', 'Yalnız SCF\'nin kazandığı belediyelerin listesi biliniyor (Vikipedi); oy sayısı yok.'
    if i.endswith('-igm'):
        return 'resmi', 'İl genel meclisi oyları DİE/TÜİK yayınları ve YSK verisinden (kaynak veri seti üzerinden).'
    if c['type'] == 'senato':
        return 'derleme', 'Senato sonuçları Vikipedi il maddelerinden ve TÜİK ilçe tablolarından derlendi (kaynak veri seti).'
    if c['type'] == 'ara':
        return 'resmi', 'YSK açık verisi (kaynak veri seti üzerinden).'
    st = (SRCY.get(i) or {}).get('primary') or {}
    if st.get('status') == 'official':
        return 'resmi', 'Birincil kaynak: %s (kaynak veri seti üzerinden).' % st.get('authority', 'YSK')
    if st:
        return 'derleme', 'Birincil kaynak: %s; resmî yayınla tam karşılaştırılmadı.' % st.get('authority')
    return 'derleme', 'Kaynak türü belirlenemedi.'
for c in cat:
    path = os.path.join(ROOT, 'data', 'elections', c['id'] + '.json')
    d = json.load(open(path))
    lv, why = reliability(c, d)
    if d.get('era') == 'cumhuriyet' and d['date'] >= '1950':
        y = int(d['date'][:4]); keys = set()
        for u in d['units'].values():
            for f in ('votes', 'pct', 'seats'): keys |= set(u.get(f) or {})
        names = {k: full_name(k, y) for k in sorted(keys) if full_name(k, y) and full_name(k, y) != k}
        if names: d['partyNames'] = names
    d['reliability'] = {'level': lv, 'label': LEVELS[lv], 'why': why}
    c['rel'] = lv
    json.dump(d, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))

cat.sort(key=lambda c: (c['date'], {'genel': 0, 'cumhurbaskanligi': 1, 'referandum': 2, 'senato': 3, 'yerel': 4, 'ara': 5}.get(c['type'], 9), c['id']))
json.dump(cat, open(os.path.join(ROOT, 'data', 'index.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

src = json.load(open(os.path.join(SRC, 'data', 'normalized', 'partiler.json')))
parties = {k: {'c': v.get('light'), 'd': v.get('dark') or v.get('light'), 's': v.get('short', k)} for k, v in src.items()}
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
def lighten(h, t=0.25):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % tuple(round(v + (255 - v) * t) for v in (r, g, b))
for k, (c, s) in EXTRA.items():
    parties.setdefault(k, {'c': c, 'd': lighten(c), 's': s})
    if not parties[k].get('c'): parties[k]['c'] = c
    if not parties[k].get('d'): parties[k]['d'] = lighten(parties[k]['c'])
json.dump(parties, open(os.path.join(ROOT, 'data', 'parties.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('seçim', len(cat), 'parti', len(parties))
