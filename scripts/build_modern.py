#!/usr/bin/env python3
"""1950-2026 il düzeyi seçim verisini uygulamanın biçimine çevirir.

Kaynak: hamiKumbasae/turkiye-secim-haritasi (veri CC BY-SA 4.0, kod MIT).
Kullanım: python3 scripts/build_modern.py <kaynak-depo-klasörü>
Çıktı: data/elections/<id>.json ve (geometri için) build/geo-src/<era>.geojson
"""
import json, os, sys, glob, re

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'elections')
GEO_OUT = os.path.join(ROOT, 'build', 'geo-src')
os.makedirs(OUT, exist_ok=True); os.makedirs(GEO_OUT, exist_ok=True)

NORM = os.path.join(SRC, 'data', 'normalized')
EK = os.path.join(NORM, 'ek')
SOURCE_NOTE = {
    'name': 'Türkiye Seçim Haritası açık veri seti (hamiKumbasae/turkiye-secim-haritasi), CC BY-SA 4.0; asıl kaynaklar YSK, TÜİK/DİE, Vikipedi',
    'url': 'https://github.com/hamiKumbasae/turkiye-secim-haritasi',
}

# Kaynak projenin sınır dönemleri: yıl < eşik ise o era kullanılır; 2002+ güncel 81 il.
GEO_ERAS = [(1954, 'era1950'), (1955, 'era1954'), (1957, 'era1955'), (1958, 'era1957_1987'),
            (1966, 'era1957_1965'), (1991, 'era1957_1987'), (1994, 'era1991'), (1995, 'era1994'),
            (1999, 'era1995'), (2002, 'era1999')]

def era_for(year):
    for th, e in GEO_ERAS:
        if year < th: return 'tr-' + e
    return 'tr-modern'

AYLAR = {'Ocak':1,'Şubat':2,'Mart':3,'Nisan':4,'Mayıs':5,'Haziran':6,'Temmuz':7,'Ağustos':8,'Eylül':9,'Ekim':10,'Kasım':11,'Aralık':12}
def iso_date(ad):
    m = re.search(r'(\d{1,2})\s+(\w+)\s+(\d{4})', ad)
    if not m: return None
    return '%s-%02d-%02d' % (m.group(3), AYLAR[m.group(2)], int(m.group(1)))

partiler = json.load(open(os.path.join(NORM, 'partiler.json')))
used_parties = {}

def note_party(p):
    used_parties[p] = partiler.get(p, {}).get('light')

def unit_from_il(il):
    u = {'name': il['ad']}
    votes, pct, seats = {}, {}, {}
    for p, v in (il.get('oy') or {}).items():
        if v is None: continue
        if v.get('oy') is not None: votes[p] = v['oy']
        if v.get('oran') is not None: pct[p] = v['oran']
        if v.get('sandalye') is not None: seats[p] = v['sandalye']
        note_party(p)
    if il.get('digerOy'): votes.setdefault('Diğer', il['digerOy']); pct.setdefault('Diğer', il.get('digerOran'))
    for p, n in (il.get('vekil') or {}).items():
        if n: seats[p] = seats.get(p, 0) + n if p not in seats else seats[p]
    if il.get('vekil'): seats = {p: n for p, n in il['vekil'].items() if n} or seats
    if votes: u['votes'] = votes
    if pct: u['pct'] = pct
    if seats: u['seats'] = seats
    for k_src, k_dst in (('kazanan', 'winner'), ('katilim', 'turnout'), ('gecerliOy', 'valid'), ('secmen', 'voters')):
        if il.get(k_src) is not None: u[k_dst] = il[k_src]
    if il.get('kazanan'): note_party(il['kazanan'])
    if il.get('veriNotu'): u['note'] = il['veriNotu']
    elif il.get('not'): u['note'] = il['not']
    cand = {p: v.get('aday') for p, v in (il.get('oy') or {}).items() if isinstance(v, dict) and v.get('aday')}
    if cand: u['candidates'] = cand
    return u

def national(units, extra=None):
    tv, ts = {}, {}
    valid = voters = 0
    for u in units.values():
        for p, n in u.get('votes', {}).items(): tv[p] = tv.get(p, 0) + n
        for p, n in u.get('seats', {}).items(): ts[p] = ts.get(p, 0) + n
        valid += u.get('valid') or 0; voters += u.get('voters') or 0
    if extra:
        for p, v in (extra.get('oy') or {}).items():
            if isinstance(v, dict) and v.get('oy') is not None: tv[p] = tv.get(p, 0) + v['oy']
        valid += extra.get('gecerliOy') or 0; voters += extra.get('secmen') or 0
    out = {}
    if tv:
        tot = sum(tv.values())
        out['votes'] = dict(sorted(tv.items(), key=lambda kv: -kv[1]))
        out['pct'] = {p: round(100 * n / tot, 2) for p, n in out['votes'].items()} if tot else {}
    if ts: out['seats'] = dict(sorted(ts.items(), key=lambda kv: -kv[1]))
    if valid: out['valid'] = valid
    if voters: out['voters'] = voters
    return out


FIXES = {  # (seçim, plaka, parti): (kaynaktaki, düzeltilmiş, gerekçe)
    ('1968yerel-igm', 65, 'CGP'): (928067, 28067, 'Kaynakta CGP oyu 928.067 görünüyor; 28.067 alındığında parti oyları toplamı geçerli oya (84.109) birebir eşit olduğundan basım/OCR hatası olarak düzeltildi.'),
}
def safe_pct(votes, valid, unit, key=None, plaka=None):
    """Oranları hesaplar; parti toplamı geçerli oyu aşıyorsa toplamı payda alır ve not düşer."""
    for (k, pl, party), (old, new, why) in FIXES.items():
        if k == key and pl == plaka and votes.get(party) == old:
            votes[party] = new; unit['note'] = why
    s = sum(votes.values())
    tot = valid or s
    if valid and s > valid * 1.02:
        unit['note'] = ('Kaynakta parti oyları toplamı (%s) geçerli oydan (%s) fazla; oranlar parti oyları toplamına göre hesaplandı, kaynak veri hatası olabilir.'
                        % (format(s, ',').replace(',', '.'), format(valid, ',').replace(',', '.')))
        tot = s
    return {p: round(100 * n / tot, 2) for p, n in votes.items()} if tot else {}

TYPE_LABEL = {'genel': 'Milletvekili Genel Seçimi', 'yerel': 'Mahalli İdareler Seçimi',
              'referandum': 'Halkoylaması', 'cumhurbaskanligi': 'Cumhurbaşkanlığı Seçimi',
              'senato': 'Cumhuriyet Senatosu Üye Seçimi', 'ara': 'Ara Seçim'}

catalog = []
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from party_names import KEY_FIXES

def fix_keys(rec):
    """Dönemine uymayan parti anahtarlarını düzeltir (bkz. party_names.KEY_FIXES)."""
    year = int(rec['date'][:4])
    applied = []
    for old, a, b, new, plaka, why in KEY_FIXES:
        if not (a <= year <= b):
            continue
        hit = False
        def ren(dct):
            nonlocal hit
            if dct and old in dct:
                hit = True
                v = dct.pop(old)
                dct[new] = dct.get(new, 0) + v if isinstance(v, (int, float)) and new in dct else v
        for u in rec['units'].values():
            for f in ('votes', 'pct', 'seats', 'candidates'):
                ren(u.get(f))
            if u.get('winner') == old: u['winner'] = new; hit = True
        for f in ('votes', 'pct', 'seats'):
            ren(rec.get('national', {}).get(f))
        if old in rec.get('parties', []):
            rec['parties'] = [new if p == old else p for p in rec['parties']]; hit = True
        if hit:
            applied.append('"%s" anahtarı "%s" olarak düzeltildi: %s' % (old, new, why))
            note_party(new)
    if applied:
        rec.setdefault('notes', []).extend(applied)
    # ülke toplamı sıralamasını koru
    for f in ('votes', 'pct', 'seats'):
        n = rec.get('national', {}).get(f)
        if n: rec['national'][f] = dict(sorted(n.items(), key=lambda kv: -(kv[1] or 0)))

# Seçim tarihindeki resmî il adı (bu tarihten önceki seçimlerde eski ad gösterilir).
# Kaynaklar: Vikipedi il maddeleri (Adana, Artvin, Mersin, Kahramanmaraş, Şanlıurfa, Afyonkarahisar).
HIST_NAMES = {
    '1': ('1956-02-02', 'Seyhan'),      # 1933'te Seyhan, Şubat 1956'da yeniden Adana
    '8': ('1956-02-17', 'Çoruh'),       # 17 Şubat 1956, 6668 sayılı kanun
    '33': ('2002-06-28', 'İçel'),       # 28 Haziran 2002
    '46': ('1973-01-01', 'Maraş'),      # 1973 (gün kaynakta yok)
    '63': ('1984-06-22', 'Urfa'),       # 22 Haziran 1984, 3020 sayılı kanun
    '3': ('2004-01-01', 'Afyon'),       # 2004 (gün kaynakta yok)
}
def hist_names(rec):
    if rec.get('geo', '').startswith('tr-') is False: return
    for k, u in rec['units'].items():
        h = HIST_NAMES.get(k)
        if h and rec['date'] < h[0] and u['name'] != h[1] and not u['name'].startswith(h[1] + ' ('):
            u['name'] = '%s (%s)' % (h[1], u['name'])

# Ülke geneli oranların resmî/ansiklopedik değerlerle farkını açıklayan notlar (scripts/verify_wiki.py ve Vikipedi bilgi kutuları)
NATIONAL_NOTES = {
    '1950': 'Liste usulü çoğunluk sisteminde ülke geneli oran hesaplama yöntemine göre değişir. Buradaki oranlar il toplamlarından hesaplandı; Vikipedi DP %55,2, CHP %39,6 verir.',
    '1954': 'Liste usulü çoğunluk sisteminde ülke geneli oran hesaplama yöntemine göre değişir. Buradaki oranlar il toplamlarından hesaplandı; Vikipedi DP %58,4, CHP %35,1 verir.',
    '1957': 'Liste usulü çoğunluk sisteminde ülke geneli oran hesaplama yöntemine göre değişir. Buradaki oranlar il toplamlarından hesaplandı; Vikipedi DP %48,6, CHP %41,4 verir.',
    '2018': 'Yalnız ittifaka (partisi işaretlenmeden) verilen oylar ayrı gösterilir; YSK bu oyları ittifak partilerine paylaştırır. Bu yüzden ittifak partilerinin oranı resmî sonuçtan biraz düşüktür (ör. AK Parti: burada %41,8, resmî %42,6).',
    '2023': 'Yalnız ittifaka (partisi işaretlenmeden) verilen oylar ayrı gösterilir; YSK bu oyları ittifak partilerine paylaştırır. Bu yüzden ittifak partilerinin oranı resmî sonuçtan biraz düşüktür (ör. AK Parti: burada %35,2, resmî %35,6).',
    '2014cb': 'Kaynak veride yurt dışı ve gümrük oyları yok; ülke geneli yalnız illerin toplamıdır. Resmî sonuç (Vikipedi): Erdoğan %51,79, İhsanoğlu %38,44, Demirtaş %9,76.',
}

def write(rec):
    fix_keys(rec)
    hist_names(rec)
    if rec['id'] in NATIONAL_NOTES:
        rec.setdefault('notes', []).insert(0, NATIONAL_NOTES[rec['id']])
    with open(os.path.join(OUT, rec['id'] + '.json'), 'w') as f:
        json.dump(rec, f, ensure_ascii=False, separators=(',', ':'))
    catalog.append({k: rec[k] for k in ('id', 'title', 'date', 'type', 'geo', 'metric', 'subtitle', 'dateLabel') if k in rec})

for path in sorted(glob.glob(os.path.join(NORM, 'elections', '*', '*.json'))):
    d = json.load(open(path))
    key = os.path.basename(path)[:-5]
    tur = d['tur']
    date = iso_date(d['ad'])
    year = int(date[:4])
    units = {str(il['plaka']): unit_from_il(il) for il in d['iller']}
    rec = {'id': key, 'type': tur, 'date': date, 'geo': era_for(year), 'era': 'cumhuriyet',
           'title': '%d %s' % (year, TYPE_LABEL[tur]), 'dateLabel': re.sub(r'\s*\(.*\)', '', d['ad']),
           'parties': d.get('majorPartiler') or [], 'units': units, 'sources': [SOURCE_NOTE]}
    if key == '2015Haziran': rec['title'] += ' (Haziran)'
    if key == '2015Kasim': rec['title'] += ' (Kasım)'
    if '1. Tur' in d['ad']: rec['subtitle'] = '1. tur'; rec['title'] += ' (1. tur)'
    if '2. Tur' in d['ad']: rec['subtitle'] = '2. tur'; rec['title'] += ' (2. tur)'
    rec['metric'] = 'votes'
    if tur == 'yerel':
        rec['subtitle'] = 'İl merkezi / büyükşehir belediye başkanlığı'
        rec['title'] += ' (Belediye Başkanlığı)'
        if d.get('resultBasis') in ('council_seats', 'mixed'):
            rec['metric'] = 'mixed'
            rec['notes'] = ['1950 ve 1955 yerel seçimlerinde belediye başkanları meclis tarafından seçiliyordu; '
                            'bazı illerde gösterilen değer oy değil, belediye meclisindeki sandalye dağılımıdır.']
    REF_KONU = {1961: '1961 Anayasası', 1982: '1982 Anayasası', 1987: 'Siyasi yasakların kaldırılması (Anayasa 4. geçici madde)',
                1988: 'Yerel seçimlerin bir yıl öne alınması', 2007: 'Cumhurbaşkanının halk tarafından seçilmesi dahil anayasa değişikliği',
                2010: 'Anayasa değişikliği paketi', 2017: 'Cumhurbaşkanlığı hükümet sistemine geçiş (anayasa değişikliği)'}
    if tur == 'referandum': rec['subtitle'] = REF_KONU.get(year)
    nat = national(units, d.get('yurtdisi'))
    if d.get('toplamSonuc'):
        ts = d['toplamSonuc']
        pass  # kaynakta toplamSonuc ayrı tutuluyor; ülke oranı il+yurt dışı toplamından hesaplanır
    if d.get('yurtdisi'): rec.setdefault('notes', []).append('Ülke toplamına yurt dışı ve gümrük oyları dahildir; haritada yalnız iller gösterilir.')
    if d.get('toplamSandalye'): nat['total_seats'] = d['toplamSandalye']
    rec['national'] = nat
    write(rec)

# İl genel meclisi (1963+; büyükşehirlerde 2014'ten sonra yok)
for path in sorted(glob.glob(os.path.join(EK, 'il_genel_meclisi', '*.json'))):
    d = json.load(open(path)); key = os.path.basename(path)[:-5]
    main = json.load(open(os.path.join(NORM, 'elections', 'yerel', key + '.json')))
    date = iso_date(main['ad']); year = int(date[:4])
    units = {}
    for il in d['iller']:
        if il.get('tip', 'il') != 'il': continue
        votes = {p: n for p, n in (il.get('oy') or {}).items() if n is not None}
        u = {'name': il['il'], 'votes': votes}
        u['pct'] = safe_pct(votes, il.get('gecerliOy'), u, key + '-igm', il['plaka'])
        for p in votes: note_party(p)
        if il.get('kazanan'): u['winner'] = il['kazanan']
        if votes and 'note' in u: u['winner'] = max(votes, key=votes.get)
        if il.get('gecerliOy'): u['valid'] = il['gecerliOy']
        if il.get('secmen'): u['voters'] = il['secmen']
        if il.get('oyKullanan') and il.get('secmen'): u['turnout'] = round(100 * il['oyKullanan'] / il['secmen'], 2)
        units[str(il['plaka'])] = u
    nat = national(units)
    rec = {'id': key + '-igm', 'type': 'yerel', 'date': date, 'geo': era_for(year), 'era': 'cumhuriyet', 'metric': 'votes',
           'title': '%d Mahalli İdareler Seçimi (İl Genel Meclisi)' % year, 'dateLabel': main['ad'], 'subtitle': 'İl genel meclisi oyları',
           'parties': list(nat.get('votes', {}).keys())[:8], 'units': units, 'national': nat, 'sources': [SOURCE_NOTE],
           'notes': ['Ülke toplamı yalnız haritadaki illerin toplamıdır.'] + (['2014 sonrasında büyükşehir illerinde il genel meclisi yoktur; bu iller boş görünür.'] if year >= 2014 else [])}
    write(rec)

# Cumhuriyet Senatosu (tarihler: en.wikipedia "<yıl> Turkish Senate election" sayfaları)
SENATO_TARIH = {1961: '1961-10-15', 1964: '1964-06-07', 1966: '1966-06-05', 1968: '1968-06-02',
                1973: '1973-10-14', 1975: '1975-10-12', 1977: '1977-06-05', 1979: '1979-10-14'}
for path in sorted(glob.glob(os.path.join(EK, 'senato', '*.json'))):
    d = json.load(open(path)); key = os.path.basename(path)[:-5]
    year = int(key[:4])
    seats_by = {}
    for s in d.get('secilenler', []):
        if s.get('plaka') is None: continue
        seats_by.setdefault(str(s['plaka']), {}).setdefault(s['parti'], 0)
        seats_by[str(s['plaka'])][s['parti']] += 1
    units = {}
    for il in d['iller']:
        votes = {}
        for a in il.get('adaylar', []):
            if a.get('oy') is None: continue
            k = a['parti'] or 'Bağımsız'
            votes[k] = votes.get(k, 0) + a['oy']
        for p in votes: note_party(p)
        u = {'name': il['il'], 'votes': votes}
        u['pct'] = safe_pct(votes, il.get('gecerliOy'), u, key, il['plaka'])
        if votes: u['winner'] = max(votes, key=votes.get)
        if il.get('gecerliOy'): u['valid'] = il['gecerliOy']
        if str(il['plaka']) in seats_by: u['seats'] = seats_by[str(il['plaka'])]
        units[str(il['plaka'])] = u
    nat = national(units)
    rec = {'id': key, 'type': 'senato', 'date': SENATO_TARIH[year], 'geo': era_for(year), 'era': 'cumhuriyet', 'metric': 'votes',
           'title': '%d Cumhuriyet Senatosu Üye Seçimi' % year, 'dateLabel': '%d %s %d' % (int(SENATO_TARIH[year][8:]), [k for k, v in AYLAR.items() if v == int(SENATO_TARIH[year][5:7])][0], year), 'parties': list(nat.get('votes', {}).keys())[:6],
           'units': units, 'national': nat, 'sources': [SOURCE_NOTE],
           'notes': ['Cumhuriyet Senatosu 1961 Anayasası ile kuruldu; üyelerinin üçte biri iki yılda bir yenilenirdi. Senato 1980 askerî darbesinden sonra kapatıldı.',
                     'Kısmi yenileme seçimlerinde yalnız seçim yapılan iller renklendirilir. Sandalye sayıları seçilen senatörlerin listesinden hesaplanmıştır.']}
    write(rec)

# 2026 mahalli idareler ara seçimi (en son seçim)
p = os.path.join(EK, 'yenileme_ara', '2026mahalli_ara_belediye_baskanligi.json')
if os.path.exists(p):
    d = json.load(open(p))
    units = {}
    for il in d['iller']:
        votes = il.get('oy') or {}
        for q in votes: note_party(q)
        tot = il.get('gecerliOy') or sum(votes.values())
        units[str(il['plaka'])] = {'name': il['il'], 'votes': votes, 'winner': il.get('kazanan'), 'valid': il.get('gecerliOy'),
            'voters': il.get('secmen'), 'turnout': round(100 * il['oyKullanan'] / il['secmen'], 2) if il.get('secmen') else None,
            'pct': {q: round(100 * n / tot, 2) for q, n in votes.items()} if tot else {}}
    birimler = d.get('birimler') or []
    names = sorted({'%s (%s)' % (b.get('ad') or b.get('birim') or '?', b.get('il') or '') for b in birimler})
    nat = national(units)
    rec = {'id': '2026ara', 'type': 'ara', 'date': '2026-06-07', 'geo': 'tr-modern', 'era': 'cumhuriyet', 'metric': 'votes',
           'title': '2026 Mahalli İdareler Ara Seçimi', 'dateLabel': '7 Haziran 2026', 'subtitle': 'Belediye başkanlığı (yalnız seçim yapılan birimler)',
           'parties': list(nat.get('votes', {}).keys())[:5], 'units': units, 'national': nat, 'sources': [SOURCE_NOTE],
           'notes': ['Yalnız birkaç belde/ilçede yapılan ara seçimdir; il rengi o ildeki seçim yapılan birimlerin toplamıdır.'] +
                    (['Seçim yapılan birimler: ' + ', '.join(names)] if names else [])}
    write(rec)

# Sınır dönemleri
geo_src = {'tr-modern': os.path.join(SRC, 'geo', 'normalized', 'turkiye_il_sinirlari.geojson')}
for _, e in GEO_ERAS:
    geo_src['tr-' + e] = os.path.join(SRC, 'geo', 'historical', 'turkiye_il_sinirlari_%s.geojson' % e)
names = {}
for rec in catalog:
    d = json.load(open(os.path.join(OUT, rec['id'] + '.json')))
    for k, u in d['units'].items(): names.setdefault(k, u['name'])
for era, path in geo_src.items():
    g = json.load(open(path))
    for f in g['features']:
        pk = str(f['properties']['plaka'])
        f['properties'] = {'id': pk, 'name': names.get(pk, pk)}
    json.dump(g, open(os.path.join(GEO_OUT, era + '.geojson'), 'w'), ensure_ascii=False)

json.dump(catalog, open(os.path.join(ROOT, 'build', 'catalog-modern.json'), 'w'), ensure_ascii=False, indent=0)
json.dump(used_parties, open(os.path.join(ROOT, 'build', 'party-colors-src.json'), 'w'), ensure_ascii=False, indent=0)
print('seçim:', len(catalog), 'era:', len(geo_src))
