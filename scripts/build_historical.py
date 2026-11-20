#!/usr/bin/env python3
"""1877-1946 seçimlerini (Osmanlı Meclis-i Mebusan + TBMM 1-8. dönem) üretir.

Girdi:
  --wiki   : Türkçe Vikipedi'nin "Meclis-i Mebûsan N. dönem mebusları listesi" ve
             "TBMM N. dönem milletvekilleri listesi" sayfalarının ham wikitext'i (mm1..mm6, tbmm1..tbmm8)
  --src    : hamiKumbasae/turkiye-secim-haritasi deposu (ilçe sınırları + 1950 il sınırları)
  --ne     : Natural Earth 10m admin-1 seçkisi (GeoJSON)

Çıktı: data/elections/<id>.json, build/geo-src/<geo>.geojson

Sınırlar YAKLAŞIKTIR: Türkiye içi birimler günümüz ilçelerinin o dönemki bağlılığına göre,
Türkiye dışı vilayetler günümüz idari birimlerinin (Natural Earth admin-1) birleştirilmesiyle çizilir.
"""
import argparse, json, os, re, sys, unicodedata
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wikitable import parse_tables, plain

ap = argparse.ArgumentParser()
ap.add_argument('--wiki', required=True)
ap.add_argument('--src', required=True)
ap.add_argument('--ne', required=True)
args = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'elections')
GEO_OUT = os.path.join(ROOT, 'build', 'geo-src')
os.makedirs(OUT, exist_ok=True); os.makedirs(GEO_OUT, exist_ok=True)

def slug(s):
    s = unicodedata.normalize('NFKD', s.replace('ı', 'i').replace('İ', 'I'))
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

# ---------------------------------------------------------------- Türkiye ilçeleri
ilce_geo = json.load(open(os.path.join(args.src, 'geo/normalized/turkiye_ilce_sinirlari.geojson')))
names23 = {x['geomId']: x['ad'] for x in json.load(open(os.path.join(args.src, 'data/normalized/elections/genel/2023.json')))['ilceler']}
era50 = json.load(open(os.path.join(args.src, 'geo/historical/turkiye_il_sinirlari_era1950.geojson')))
era50_shapes = [(f['properties']['plaka'], shape(f['geometry']).buffer(0)) for f in era50['features']]

DISTRICTS = []
for f in ilce_geo['features']:
    g = shape(f['geometry']).buffer(0)
    pt = g.representative_point()
    p50 = None
    for pl, s in era50_shapes:
        if s.contains(pt): p50 = pl; break
    if p50 is None:  # kıyı/ada: en yakın
        p50 = min(era50_shapes, key=lambda t: t[1].distance(pt))[0]
    DISTRICTS.append({'id': f['properties']['id'], 'plaka': f['properties']['plaka'],
                      'name': names23[f['properties']['id']], 'p50': p50, 'geom': g})

# 1950'deki 63 il -> birim anahtarı (günümüz adıyla)
P50KEY = {1: 'Adana', 3: 'Afyonkarahisar', 4: 'Ağrı', 5: 'Amasya', 6: 'Ankara', 7: 'Antalya', 8: 'Artvin',
          9: 'Aydın', 10: 'Balıkesir', 11: 'Bilecik', 12: 'Bingöl', 13: 'Bitlis', 14: 'Bolu', 15: 'Burdur',
          16: 'Bursa', 17: 'Çanakkale', 18: 'Çankırı', 19: 'Çorum', 20: 'Denizli', 21: 'Diyarbakır',
          22: 'Edirne', 23: 'Elazığ', 24: 'Erzincan', 25: 'Erzurum', 26: 'Eskişehir', 27: 'Gaziantep',
          28: 'Giresun', 29: 'Gümüşhane', 30: 'Hakkâri', 31: 'Hatay', 32: 'Isparta', 33: 'Mersin',
          34: 'İstanbul', 35: 'İzmir', 36: 'Kars', 37: 'Kastamonu', 38: 'Kayseri', 39: 'Kırklareli',
          40: 'Kırşehir', 41: 'Kocaeli', 42: 'Konya', 43: 'Kütahya', 44: 'Malatya', 45: 'Manisa',
          46: 'Kahramanmaraş', 47: 'Mardin', 48: 'Muğla', 49: 'Muş', 51: 'Niğde', 52: 'Ordu', 53: 'Rize',
          55: 'Samsun', 56: 'Siirt', 57: 'Sinop', 58: 'Sivas', 59: 'Tekirdağ', 60: 'Tokat', 61: 'Trabzon',
          62: 'Tunceli', 63: 'Şanlıurfa', 65: 'Van', 66: 'Yozgat', 67: 'Zonguldak'}

def grp(p, *names):
    return lambda d: d['plaka'] == p and d['name'] in names

G_GELIBOLU = [grp(17, 'Gelibolu', 'Eceabat'), grp(22, 'Keşan'), grp(59, 'Şarköy')]
G_CATALCA = [grp(34, 'Çatalca', 'Silivri', 'Büyükçekmece', 'Arnavutköy', 'Esenyurt', 'Beylikdüzü')]
G_SEBIN = [grp(28, 'Şebinkarahisar', 'Alucra', 'Çamoluk'), grp(58, 'Suşehri', 'Koyulhisar', 'Akıncılar')]
G_KOZAN = [grp(1, 'Kozan', 'Feke', 'Saimbeyli', 'Tufanbeyli', 'Aladağ', 'İmamoğlu'), grp(80, 'Kadirli', 'Sumbas')]
G_DORTYOL = [grp(31, 'Dörtyol', 'Erzin')]
G_PAYAS = [grp(31, 'Payaş')]
G_ICEL = [grp(33, 'Silifke', 'Mut', 'Gülnar', 'Anamur', 'Bozyazı', 'Aydıncık', 'Erdemli')]
G_ERGANI = [grp(21, 'Ergani', 'Çermik', 'Çüngüş', 'Dicle', 'Eğil', 'Hani'), grp(23, 'Maden', 'Alacakaya', 'Arıcak', 'Palu', 'Kovancılar')]
G_SIVEREK = [grp(63, 'Siverek', 'Hilvan')]
G_OLTU = [grp(25, 'Oltu', 'Olur', 'Şenkaya')]
G_HOPA = [grp(8, 'Hopa', 'Arhavi')]
G_ADALAR = [grp(17, 'Gökçeada', 'Bozcaada')]

def any_of(groups, d): return any(g(d) for g in groups)

def tr_unit(d, y):
    """Günümüz ilçesi d'nin y yılındaki seçim bölgesi (sancak/liva/il) anahtarı. None = Osmanlı/Türkiye dışı ya da seçim yok."""
    p = d['plaka']; P50 = P50KEY[d['p50']]
    otto = y <= 1914
    # --- Hatay
    if p == 31 and not any_of(G_DORTYOL, d):
        if y == 1877 and any_of(G_PAYAS, d): return 'Adana'
        if y >= 1939: return 'Hatay'
        return 'Halep' if otto else None
    if any_of(G_DORTYOL, d):
        if y <= 1932: return 'Cebelibereket'
        return 'Adana' if y <= 1938 else P50
    # --- Iğdır, Kars, Ardahan, Artvin (1878-1918 Rus idaresi)
    if p == 76: return P50 if y >= 1923 else None
    if any_of(G_HOPA, d): return 'Rize' if y <= 1920 else 'Artvin'
    if p in (36, 75, 8):
        if y == 1877: return {36: 'Kars', 75: 'Ardahan', 8: 'Artvin'}[p]
        if otto or y == 1919: return None
        if y == 1920: return {36: 'Kars', 75: 'Ardahan'}.get(p)
        if p == 75: return 'Ardahan' if y <= 1923 else 'Kars'
        if p == 36: return 'Kars'
        return 'Artvin'  # 1935-1946 Çoruh
    if any_of(G_OLTU, d):
        if y == 1877: return 'Erzurum'
        if otto: return None
        return 'Oltu' if y <= 1920 else 'Erzurum'
    # --- Trakya / Marmara
    if any_of(G_GELIBOLU, d): return 'Gelibolu' if y <= 1923 else P50
    if any_of(G_ADALAR, d): return None if 1914 <= y <= 1920 else 'Çanakkale'
    if any_of(G_CATALCA, d): return 'Çatalca' if y <= 1923 else 'İstanbul'
    if p == 77: return 'Kocaeli' if y <= 1923 else P50          # Yalova
    if p in (67, 74): return 'Bolu' if y <= 1920 else 'Zonguldak'  # Zonguldak, Bartın
    if p == 78: return 'Kastamonu' if y <= 1920 else P50          # Karabük
    if p == 26 and otto: return 'Kütahya'                          # Eskişehir
    # --- Karadeniz
    if any_of(G_SEBIN, d): return 'Şebinkarahisar' if y <= 1932 else P50
    if p == 52: return 'Samsun' if y <= 1920 else 'Ordu'
    if p == 28: return 'Trabzon' if y <= 1920 else 'Giresun'
    if p == 53: return 'Artvin' if 1933 <= y <= 1935 else 'Rize'  # 1933-36 Çoruh ili
    # --- İç Anadolu
    if p == 68: return 'Niğde' if (y <= 1920 or y >= 1933) else 'Aksaray'
    if p == 50 and y in (1919, 1920): return 'Kırşehir'
    if p == 69 and y <= 1920: return 'Erzurum'                    # Bayburt
    # --- Çukurova
    if any_of(G_KOZAN, d): return 'Kozan' if y <= 1923 else ('Cebelibereket' if (p == 80 and y <= 1932) else 'Adana')
    if p == 80: return 'Cebelibereket' if y <= 1932 else P50
    if p == 33:
        if y >= 1933: return 'Mersin'
        return 'İçel' if any_of(G_ICEL, d) else 'Mersin'
    # --- Doğu / Güneydoğu
    if any_of(G_ERGANI, d): return 'Ergani' if y <= 1923 else P50
    if any_of(G_SIVEREK, d): return 'Siverek' if y <= 1923 else P50
    if p in (27, 79) and y < 1914: return 'Halep'                 # Antep, Kilis
    if p in (27, 79): return 'Gaziantep'
    q = d['p50']
    if q == 12: return 'Genç' if y <= 1923 else ('Elazığ' if y <= 1935 else 'Bingöl')
    if q == 62: return 'Tunceli' if (y <= 1923 or y >= 1936) else 'Elazığ'   # Dersim
    if q == 49 and 1926 <= y <= 1928: return 'Bitlis'
    if q == 13 and 1933 <= y <= 1935: return 'Muş'
    if q == 30 and 1933 <= y <= 1935: return 'Van'
    return P50

# 1877 vilayetleri (Vikipedi listesindeki vilayet başlıklarına göre)
VIL1877 = {
    'Adana': ['Adana', 'Mersin', 'İçel', 'Kozan', 'Cebelibereket'],
    'Ankara': ['Ankara', 'Yozgat', 'Kayseri', 'Kırşehir', 'Çorum'],
    'Aydın': ['İzmir', 'Manisa', 'Aydın', 'Denizli', 'Muğla'],
    'Dersaadet': ['İstanbul', 'Kocaeli', 'Çatalca'],
    'Diyarbekir': ['Diyarbakır', 'Mardin', 'Siirt', 'Malatya', 'Siverek'],
    'Mamuretülaziz': ['Elazığ', 'Ergani', 'Tunceli'],
    'Edirne': ['Edirne', 'Tekirdağ', 'Gelibolu', 'Kırklareli'],
    'Erzurum': ['Erzurum', 'Erzincan', 'Ağrı', 'Kars', 'Ardahan'],
    'Halep': ['Halep', 'Kahramanmaraş', 'Şanlıurfa', 'Gaziantep'],
    'Hüdavendigâr': ['Bursa', 'Balıkesir', 'Afyonkarahisar', 'Kütahya', 'Bilecik', 'Eskişehir'],
    'Kastamonu': ['Kastamonu', 'Bolu', 'Sinop', 'Çankırı', 'Zonguldak'],
    'Konya': ['Konya', 'Niğde', 'Antalya', 'Isparta', 'Burdur', 'Aksaray'],
    'Sivas': ['Sivas', 'Amasya', 'Tokat', 'Şebinkarahisar'],
    'Trabzon': ['Trabzon', 'Samsun', 'Rize', 'Gümüşhane', 'Artvin', 'Giresun', 'Ordu'],
    'Van': ['Van', 'Muş', 'Bitlis', 'Hakkâri', 'Bingöl', 'Genç'],
    'Cezayir-i Bahr-i Sefid': ['Çanakkale'],
}
SANCAK_TO_VIL1877 = {s: v for v, ss in VIL1877.items() for s in ss}

# ---------------------------------------------------------------- Türkiye dışı (Natural Earth admin-1)
ne = json.load(open(args.ne))
NE = {}
for f in ne['features']:
    pr = f['properties']; NE.setdefault((pr['adm0_a3'], pr['name']), []).append(shape(f['geometry']).buffer(0))
def ne_get(a3, name, clip=None):
    gs = NE.get((a3, name))
    if not gs: raise KeyError((a3, name))
    g = unary_union(gs)
    return g.intersection(clip) if clip is not None else g
def ne_country(a3, exclude=()):
    return [ne_get(a, n) for (a, n) in NE if a == a3 and n not in exclude]

W_NESTOS = box(19, 34, 24.8, 43); E_NESTOS = box(24.8, 34, 30, 43)
DODEC = box(26.2, 34, 30, 38.5)
WB_N = box(34, 32.02, 36, 33); WB_S = box(34, 30, 36, 32.02)
MKD = [n for (a, n) in NE if a == 'MKD']
def mkd_part(part):
    out = []
    for n in MKD:
        g = ne_get('MKD', n); c = g.representative_point()
        if c.y >= 41.6: k = 'Kosova'
        elif c.x >= 21.9: k = 'Selanik'
        else: k = 'Manastır'
        if k == part: out.append(g)
    return out

def B(*names): return [ne_get('BGR', n) for n in names]
BG_NORTH = B('Vidin', 'Montana', 'Vratsa', 'Pleven', 'Lovech', 'Gabrovo', 'Veliko Tarnovo', 'Ruse', 'Razgrad',
             'Targovishte', 'Shumen', 'Silistra', 'Dobrich', 'Varna')
BG_SOUTH = B('Plovdiv', 'Pazardzhik', 'Haskovo', 'Stara Zagora', 'Sliven', 'Yambol', 'Burgas')
BG_RHODOPE = B('Kardzhali', 'Smolyan')
BG_SOFIA = B('Sofia', 'Grad Sofiya', 'Pernik', 'Kyustendil')
SYR = lambda *n: [ne_get('SYR', x) for x in n]
LBN = lambda *n: [ne_get('LBN', x) for x in n]
ISR = lambda *n: [ne_get('ISR', x) for x in n]
JOR = [ne_get('JOR', n) for (a, n) in NE if a == 'JOR']
IRQ = lambda *n: [ne_get('IRQ', x) for x in n]
YEM_N = [ne_get('YEM', x) for x in ("Sa`dah", 'Hajjah', 'Al Jawf', 'Al Hudaydah', 'Ta`izz', "Ma'rib", "Sana'a", 'Raymah',
                                     "Al Bayda'", 'Amran', 'Ibb', 'Al Mahwit', 'Dhamar', 'Amanat Al Asimah')]
LBY_E = [ne_get('LBY', x) for x in ('Al Butnan', 'Al Kufrah', 'Ajdabiya', 'Al Qubbah', 'Al Jabal al Akhdar', 'Al Marj', 'Benghazi')]
LBY_W = [g for (a, n) in NE if a == 'LBY' for g in [ne_get('LBY', n)] if n not in ('Al Butnan', 'Al Kufrah', 'Ajdabiya', 'Al Qubbah', 'Al Jabal al Akhdar', 'Al Marj', 'Benghazi')]
MNE = lambda *n: [ne_get('MNE', x) for x in n]
ALB = lambda *n: [ne_get('ALB', x) for x in n]
GRC = lambda n, clip=None: [ne_get('GRC', n, clip)]

def outside_units(y):
    u = {}
    musul = IRQ('Ninawa', 'Dihok', 'Arbil', "At-Ta'mim", 'As-Sulaymaniyah')
    bagdat = IRQ('Baghdad', 'Al-Anbar', "Karbala'", 'Babil', 'An-Najaf', 'Al-Qādisiyyah', 'Wasit', 'Diyala', 'Sala ad-Din')
    basra = IRQ('Al-Basrah', 'Maysan', 'Dhi-Qar', 'Al-Muthannia')
    hicaz = [ne_get('SAU', x) for x in ('Makkah', 'Al Madinah', 'Tabuk', 'Al Bahah')]
    yemen = YEM_N + [ne_get('SAU', x) for x in ('`Asir', 'Jizan')]
    halep = SYR('Aleppo', 'Idlib', 'Ar Raqqah')
    zor = SYR('Dayr Az Zawr', 'Hasaka (Al Haksa)')
    beyrut = LBN('Beirut', 'North Lebanon', 'South Lebanon', 'An Nabatiyah') + SYR('Lattakia', 'Tartus') + ISR('HaZafon', 'Haifa') + [ne_get('PSX', 'West Bank', WB_N)]
    suriye = SYR('Damascus', 'Rif Dimashq', 'Quneitra', 'Dar`a', "As Suwayda'", 'Homs (Hims)', 'Hamah', 'UNDOF') + LBN('Beqaa') + JOR
    kudus = ISR('HaMerkaz', 'Tel Aviv', 'Jerusalem', 'HaDarom') + [ne_get('PSX', 'West Bank', WB_S), ne_get('PSX', 'Gaza Strip')]
    if y == 1877:
        u['Bosna'] = ne_country('BIH')
        u['Tuna'] = BG_NORTH + [ne_get('ROU', 'Tulcea'), ne_get('ROU', 'Constanta')]
        u['Edirne'] = BG_SOUTH + BG_RHODOPE + GRC('Anatoliki Makedonia kai Thraki', E_NESTOS)
        u['Kosova'] = (BG_SOFIA + ne_country('KOS') + mkd_part('Kosova') + ALB('Kukës', 'Dibër') +
                       [ne_get('SRB', x) for x in ('Nišavski', 'Pirotski', 'Toplicki', 'Jablanicki', 'Pcinjski', 'Raški')] +
                       MNE('Pljevlja', 'Bijelo Polje', 'Berane', 'Rožaje'))
        u['Selanik'] = (GRC('Kentriki Makedonia') + GRC('Dytiki Makedonia') + GRC('Ayion Oros') +
                        GRC('Anatoliki Makedonia kai Thraki', W_NESTOS) + mkd_part('Selanik') + mkd_part('Manastır') +
                        ALB('Korçë', 'Elbasan') + B('Blagoevgrad'))
        u['Yanya'] = GRC('Ipeiros') + GRC('Thessalia') + ALB('Berat', 'Fier', 'Vlorë', 'Gjirokastër')
        u['İşkodra'] = ALB('Shkodër', 'Lezhë', 'Durrës', 'Tiranë') + MNE('Podgorica', 'Bar', 'Ulcinj', 'Plav', 'Andrijevica')
        u['Girit'] = GRC('Kriti')
        u['Cezayir-i Bahr-i Sefid'] = GRC('Voreio Aigaio') + GRC('Notio Aigaio', DODEC) + ne_country('CYP')
        u['Halep'] = halep + zor
        u['Suriye'] = suriye + beyrut + kudus
        u['Bağdat'] = bagdat + musul
        u['Basra'] = basra + [ne_get('SAU', 'Ash Sharqiyah')]
        u['Hicaz'] = hicaz
        u['Yemen'] = yemen
        u['Trablusgarp'] = LBY_W + LBY_E
        u['Trabzon'] = [ne_get('GEO', 'Ajaria')]   # Batum
        return u
    if y in (1908, 1912):
        u['Selanik'] = (GRC('Kentriki Makedonia') + GRC('Ayion Oros') + GRC('Anatoliki Makedonia kai Thraki', W_NESTOS) +
                        mkd_part('Selanik') + B('Blagoevgrad'))
        u['Manastır'] = GRC('Dytiki Makedonia') + mkd_part('Manastır') + ALB('Korçë', 'Elbasan', 'Dibër')
        u['Kosova'] = (ne_country('KOS') + mkd_part('Kosova') + ALB('Kukës') + [ne_get('SRB', 'Raški')] +
                       MNE('Pljevlja', 'Bijelo Polje', 'Berane', 'Rožaje', 'Plav', 'Andrijevica'))
        u['İşkodra'] = ALB('Shkodër', 'Lezhë', 'Durrës', 'Tiranë')
        u['Yanya'] = GRC('Ipeiros') + ALB('Berat', 'Fier', 'Vlorë', 'Gjirokastër')
        u['Batı Trakya'] = GRC('Anatoliki Makedonia kai Thraki', E_NESTOS) + BG_RHODOPE
        u['Cezayir-i Bahr-i Sefid'] = GRC('Voreio Aigaio') + GRC('Notio Aigaio', DODEC)
        u['Trablusgarp'] = LBY_W
        u['Bingazi'] = LBY_E
        u['Basra'] = basra + [ne_get('SAU', 'Ash Sharqiyah')]
    else:  # 1914
        u['Basra'] = basra
    u['Halep'] = halep
    u['Zor'] = zor
    u['Beyrut'] = beyrut
    u['Cebel-i Lübnan'] = LBN('Mount Lebanon')
    u['Suriye'] = suriye
    u['Kudüs'] = kudus
    u['Hicaz'] = hicaz
    u['Yemen'] = yemen
    u['Bağdat'] = bagdat
    u['Musul'] = musul
    return u


# ---------------------------------------------------------------- tahmine dayanan sınırlar
OUTSIDE_KEYS = None
def boundary_note(k, y):
    """Sınırı belgelenmiş bir kaynağa değil, bu projedeki tahmine dayanan birimler için açıklama."""
    if k in OUTSIDE_KEYS or k == 'Halep' and y <= 1914:
        return 'Türkiye dışındaki bölümü günümüz idari bölgelerinin birleştirilmesiyle çizildi; tarihî vilayet/sancak sınırıyla örtüşmez.'
    G = {
        'Gelibolu': 'Kapsadığı ilçeler (Gelibolu, Eceabat, Keşan, Şarköy) yaklaşık olarak seçildi.',
        'Çatalca': 'Kapsadığı ilçeler (Çatalca, Silivri, Büyükçekmece ve çevresi) yaklaşık olarak seçildi.',
        'Kozan': 'Kapsadığı ilçeler yaklaşık olarak seçildi (Kozan, Feke, Saimbeyli, Kadirli ve çevresi).',
        'Cebelibereket': 'Kapsadığı ilçeler yaklaşık olarak seçildi (Osmaniye, Dörtyol, Erzin ve çevresi).',
        'Ergani': 'Kapsadığı ilçeler yaklaşık olarak seçildi (Ergani, Çermik, Maden, Palu ve çevresi).',
        'Siverek': 'Siverek ve Hilvan ilçeleri alındı; tarihî sınır farklı olabilir.',
        'Şebinkarahisar': 'Kapsadığı ilçeler yaklaşık olarak seçildi (Şebinkarahisar, Alucra, Suşehri, Koyulhisar ve çevresi).',
        'Oltu': 'Oltu, Olur ve Şenkaya ilçeleri alındı; tarihî sınır farklı olabilir.',
        'Genç': 'Günümüz Bingöl ilinin tamamı alındı; tarihî Genç livasının sınırı farklıdır.',
        'İçel': 'Silifke ve çevresindeki ilçeler alındı (1933 öncesi İçel); sınır yaklaşıktır.' if y <= 1932 else None,
        'Mersin': 'Mersin merkezi, Tarsus ve çevresi alındı (1933 öncesi Mersin); sınır yaklaşıktır.' if y <= 1932 else None,
        'Elazığ': 'Bu dönemde Tunceli ve Bingöl topraklarının Elazığ\'a bağlı olduğu varsayıldı; bir kısmı başka illere bağlı olabilir.' if 1924 <= y <= 1935 else None,
        'Muş': 'Bitlis topraklarının tamamının Muş\'a bağlandığı varsayıldı.' if 1933 <= y <= 1935 else None,
        'Bitlis': 'Muş topraklarının tamamının Bitlis\'e bağlandığı varsayıldı.' if 1926 <= y <= 1928 else None,
        'Rize': 'Hopa ve Arhavi Lazistan\'a dahil edildi; sınır yaklaşıktır.' if y <= 1920 else None,
        'Bolu': 'Zonguldak ve Bartın\'ın Bolu\'ya bağlı olduğu varsayıldı.' if y <= 1920 else None,
    }
    return G.get(k)

# ---------------------------------------------------------------- seçim bölgesi adları -> birim
ALIAS = {
    'Afyonkarahisar': 'Afyonkarahisar', 'Karahisar-ı Sahib': 'Afyonkarahisar', 'Karahisar-i Sâhib': 'Afyonkarahisar',
    'Karahisarı Sahib': 'Afyonkarahisar', 'Karahisar-ı Sâhib': 'Afyonkarahisar',
    'Karahisar-ı Şarki': 'Şebinkarahisar', 'Karahisar-ı Şarkı': 'Şebinkarahisar', 'Şebinkarahisar': 'Şebinkarahisar',
    'Bayazıt': 'Ağrı', 'Ağrı': 'Ağrı', 'Bozok': 'Yozgat', 'Yozgat': 'Yozgat', 'Canik': 'Samsun', 'Samsun': 'Samsun',
    'Ertuğrul': 'Bilecik', 'Bilecik': 'Bilecik', 'Karesi': 'Balıkesir', 'Balıkesir': 'Balıkesir',
    'Saruhan': 'Manisa', 'Manisa': 'Manisa', 'Menteşe': 'Muğla', 'Muğla': 'Muğla', 'Teke': 'Antalya', 'Antalya': 'Antalya',
    'Hamid-i Abad': 'Isparta', 'Isparta': 'Isparta', 'Kangırı': 'Çankırı', 'Çankırı': 'Çankırı',
    'Kırkkilise': 'Kırklareli', 'Kırk Kilise': 'Kırklareli', 'Kırklareli': 'Kırklareli',
    'Tekfurdağı': 'Tekirdağ', 'Tekirdağ': 'Tekirdağ', 'İzmit': 'Kocaeli', 'Kocaeli': 'Kocaeli',
    'Mamuret-ül-Aziz': 'Elazığ', 'Mamuret-ül Aziz': 'Elazığ', 'Elaziz': 'Elazığ', 'Elazığ': 'Elazığ',
    'Antep': 'Gaziantep', 'Ayıntab': 'Gaziantep', 'Gaziantep': 'Gaziantep', 'Maraş': 'Kahramanmaraş',
    'Urfa': 'Şanlıurfa', 'Lazistan': 'Rize', 'Rize': 'Rize', 'Dersim': 'Tunceli', 'Tunceli': 'Tunceli',
    'Cebel-i Bereket': 'Cebelibereket', 'Cebelibereket': 'Cebelibereket', 'Kale-i Sultaniye': 'Çanakkale',
    'Biga': 'Çanakkale', 'Çanakkale': 'Çanakkale', 'Diyarbekir': 'Diyarbakır', 'Diyarbakır': 'Diyarbakır',
    'Seyhan': 'Adana', 'Çoruh': 'Artvin', 'İçel': 'İçel', 'Hakkâri': 'Hakkâri', 'Genç': 'Genç', 'Bingöl': 'Bingöl',
    'Dersaadet': 'Dersaadet', 'Hüdavendigâr': 'Hüdavendigâr', 'Mamuretülaziz': 'Mamuretülaziz',
}
for k in list(P50KEY.values()) + ['Gelibolu', 'Çatalca', 'Kozan', 'Mersin', 'Ergani', 'Siverek', 'Oltu', 'Ardahan',
                                  'Aksaray', 'Zonguldak', 'Giresun', 'Ordu', 'Batum', 'Halep', 'Hatay', 'Eskişehir', 'Sinop']:
    ALIAS.setdefault(k, k)
OUT_ALIAS = {  # Türkiye dışı sancak/vilayet -> vilayet birimi
    'Selanik': 'Selanik', 'Drama': 'Selanik', 'Serez': 'Selanik', 'Manastır': 'Manastır', 'Debre': 'Manastır',
    'Elbasan': 'Manastır', 'Görice': 'Manastır', 'Serfiçe': 'Manastır', 'Serfice': 'Manastır',
    'Kosova': 'Kosova', 'İpek': 'Kosova', 'Priştine': 'Kosova', 'Prizren': 'Kosova', 'Seniçe': 'Kosova', 'Senice': 'Kosova',
    'Taşlıca': 'Kosova', 'Üsküp': 'Kosova', 'İşkodra': 'İşkodra', 'Draç': 'İşkodra', 'Yanya': 'Yanya', 'Berat': 'Yanya',
    'Preveze': 'Yanya', 'Ergiri': 'Yanya', 'Çamlık': 'Yanya', 'Dedeağaç': 'Batı Trakya', 'Gümülcine': 'Batı Trakya',
    'Cezayir-i Bahr-i Sefid': 'Cezayir-i Bahr-i Sefid', 'Limni': 'Cezayir-i Bahr-i Sefid', 'Midilli': 'Cezayir-i Bahr-i Sefid',
    'Rodos': 'Cezayir-i Bahr-i Sefid', 'Sakız': 'Cezayir-i Bahr-i Sefid',
    'Bağdat': 'Bağdat', 'Divaniye': 'Bağdat', 'Ed-Divaniye': 'Bağdat', 'Kerbela': 'Bağdat', 'El-Kut': 'Bağdat',
    'Basra': 'Basra', 'Ammare': 'Basra', 'Müntefik': 'Basra', 'Musul': 'Musul', 'Kerkük': 'Musul', 'Süleymaniye': 'Musul',
    'Beyrut': 'Beyrut', 'Akka': 'Beyrut', 'Lazkiye': 'Beyrut', 'Nablus': 'Beyrut', 'Trablusşam': 'Beyrut',
    'Suriye': 'Suriye', 'Şam': 'Suriye', 'Hama': 'Suriye', 'Havran': 'Suriye', 'Kerek': 'Suriye', 'Humus': 'Suriye',
    'Cebel-i Lübnan': 'Cebel-i Lübnan', 'Kudüs': 'Kudüs', 'Zor': 'Zor',
    'Hicaz': 'Hicaz', 'Cidde': 'Hicaz', 'Mekke': 'Hicaz', 'Medine': 'Hicaz', 'Medine-i Münevvere': 'Hicaz',
    'Yemen': 'Yemen', 'Hudeyde': 'Yemen', 'El-Hudeyde': 'Yemen', "San'a": 'Yemen', 'Taaz': 'Yemen', 'Taiz': 'Yemen', 'Asir': 'Yemen',
    'Trablusgarp': 'Trablusgarp', "Cebel'ül Garbi": 'Trablusgarp', 'Fizan': 'Trablusgarp', 'Bingazi': 'Bingazi',
}

OUTSIDE_KEYS = set(OUT_ALIAS.values()) | {'Bosna', 'Tuna', 'Girit', 'Kosova', 'Edirne-dış', 'Batum'}

def base_name(s):
    s = re.sub(r'\(.*?\)', '', s).split(' / ')[0]
    return s.strip()

# ---------------------------------------------------------------- seçim tanımları
WIKI_URL = 'https://tr.wikipedia.org/wiki/'
ELECTIONS = [
    dict(id='1877-1', file='mm1', table=0, date='1877-03-19', era='osmanli', year=1877,
         title='1877 Meclis-i Mebusan Seçimi (I. dönem)', dateLabel='Aralık 1876 – Mart 1877 (Meclis 19 Mart 1877\'de açıldı)',
         cols=dict(unit=0, name=1, group=2), groupLabel='Dini mensubiyet', level='vilayet',
         page='Meclis-i Mebûsan 1. dönem mebusları listesi',
         desc='Kânûn-ı Esâsî\'ye göre yapılan ilk seçim. İstanbul dışındaki vilayetlerde mebuslar geçici bir talimatla il, liva ve kaza idare meclisi üyeleri arasından seçildi. Vikipedi\'ye göre Meclis 69 Müslüman ve 46 gayrimüslim olmak üzere 115 üyeden oluştu; Tunus, Mısır, Romanya, Sırbistan ve Karadağ mebus göndermedi.'),
    dict(id='1877-2', file='mm2', table=0, date='1877-12-13', era='osmanli', year=1877,
         title='1877 Meclis-i Mebusan Seçimi (II. dönem)', dateLabel='1877 (Meclis 13 Aralık 1877\'de toplandı)',
         cols=dict(unit=0, name=1, group=2), groupLabel='Dini mensubiyet', level='vilayet',
         page='Meclis-i Mebûsan 2. dönem mebusları listesi',
         desc='II. dönem Meclis-i Mebusan 13 Aralık 1877\'de toplandı ve 93 Harbi sürerken 14 Şubat 1878\'de II. Abdülhamid tarafından süresiz tatil edildi. Vikipedi\'ye göre mebus sayısı 56\'sı Müslüman, 40\'ı gayrimüslim olmak üzere 96\'dır.'),
    dict(id='1908', file='mm3', table=0, date='1908-11-15', era='osmanli', year=1908,
         title='1908 Meclis-i Mebusan Seçimi', dateLabel='Kasım – Aralık 1908',
         cols=dict(vil=0, unit=1, name=2, group=4), groupLabel='Etnik mensubiyet (Vikipedi listesine göre)', level='sancak',
         page='Meclis-i Mebûsan 3. dönem mebusları listesi',
         desc='II. Meşrutiyet\'in ilanından sonra yapılan, örgütlü partilerin katıldığı ilk seçim. İki dereceli yapıldı. İttihat ve Terakki ile Ahrar Fırkası yarıştı ve İttihat ve Terakki çoğunluğu sağladı. Mebusların parti mensubiyeti kaynak listede yer almadığı için haritada vekil sayısı gösterilir.'),
    dict(id='1912', file='mm4', table=3, date='1912-04-15', era='osmanli', year=1912,
         title='1912 Meclis-i Mebusan Seçimi ("Sopalı Seçim")', dateLabel='Nisan 1912',
         cols=dict(vil=0, unit=1, name=2, group=4, group2=5), groupLabel='Siyasi mensubiyet', group2Label='Etnik mensubiyet', level='sancak',
         page='Meclis-i Mebûsan 4. dönem mebusları listesi',
         desc='Meclisin 18 Ocak 1912\'de feshedilmesinden sonra yapılan erken seçim. Yoğun baskı altında yapıldığı için "Sopalı Seçim" olarak anılır. Kaynaklarda İttihat ve Terakki\'nin 275 sandalyenin 269\'unu kazandığı belirtilir. Vikipedi\'nin mebus listesindeki bireysel mensubiyetlerde ise çok sayıda mebus "Bağımsız" olarak geçer; harita bu listeyi gösterir.'),
    dict(id='1914', file='mm5', table=1, date='1914-01-15', era='osmanli', year=1914,
         title='1914 Meclis-i Mebusan Seçimi', dateLabel='1913–1914 kışı (Meclis Mayıs 1914\'te toplandı)',
         cols=dict(unit=0, name=1, group=3, group2=4), groupLabel='Siyasi mensubiyet', group2Label='Etnik mensubiyet', level='sancak',
         page='Meclis-i Mebûsan 5. dönem mebusları listesi',
         desc='Bâb-ı Âli Baskını\'ndan sonra tek parti düzeninde yapılan seçim. Seçime katılan tek parti İttihat ve Terakki\'ydi. Balkan Savaşları\'nda kaybedilen Rumeli toprakları ve Trablusgarp artık seçim bölgesi değildi.'),
    dict(id='1919', file='mm6', table=0, date='1919-12-01', era='osmanli', year=1919,
         title='1919 Meclis-i Mebusan Seçimi (Son Osmanlı Meclisi)', dateLabel='1919 sonu (Meclis 12 Ocak 1920\'de İstanbul\'da açıldı)',
         cols=dict(unit=0, name=1), level='sancak',
         page='Meclis-i Mebûsan 6. dönem mebusları listesi',
         desc='Mondros Mütarekesi ve işgaller döneminde yapılan son Osmanlı seçimi. Seçimlere ağırlıkla Müdafaa-i Hukuk grupları damgasını vurdu. Meclis 17 Şubat 1920\'de Misak-ı Millî\'yi kabul etti, İstanbul\'un işgalinden sonra 11 Nisan 1920\'de padişah tarafından dağıtıldı. İşgal altındaki bazı bölgelerde seçim yapılamadı.'),
    dict(id='1920', file='tbmm1', table=0, date='1920-04-23', era='cumhuriyet', year=1920,
         title='1920 Büyük Millet Meclisi Seçimi (TBMM I. dönem)', dateLabel='Mart – Nisan 1920 (Meclis 23 Nisan 1920\'de açıldı)',
         cols=dict(unit=0, name=1), level='il',
         page='TBMM 1. dönem milletvekilleri listesi',
         desc='Mustafa Kemal Paşa\'nın 19 Mart 1920 tebliğiyle her livadan beş temsilci seçilmesi istendi. Seçimleri ikinci seçmenler, idare ve belediye meclisleri ile Müdafaa-i Hukuk heyetleri yaptı. Vikipedi\'ye göre İstanbul Meclisi\'nden katılanlarla birlikte 66 seçim bölgesinden toplam 436 temsilci Meclis\'e katıldı.'),
    dict(id='1923', file='tbmm2', table=0, date='1923-06-28', era='cumhuriyet', year=1923, type='genel',
         title='1923 Milletvekili Genel Seçimi (TBMM II. dönem)', dateLabel='28 Haziran 1923 (iki dereceli)',
         cols=dict(unit=0, name=1, group=3), groupLabel='Seçildiği liste', level='il',
         page='TBMM 2. dönem milletvekilleri listesi',
         desc='İki dereceli seçim. Birkaç bağımsız dışında vekillerin hepsi Anadolu ve Rumeli Müdâfaa-i Hukuk Cemiyeti (Birinci Grup) listesinden seçildi. Vikipedi\'ye göre 72 seçim çevresinden 286 milletvekili seçildi; dönem boyunca ara seçimlerle 47 koltuk yeniden dolduruldu.'),
    dict(id='1927', file='tbmm3', table=0, date='1927-09-01', era='cumhuriyet', year=1927, type='genel',
         title='1927 Milletvekili Genel Seçimi (TBMM III. dönem)', dateLabel='20 Temmuz (ikinci seçmenler) ve 1 Eylül 1927 (milletvekilleri)',
         cols=dict(unit=0, name=1), fixedGroup='Cumhuriyet Halk Fırkası', groupLabel='Parti', level='il',
         page='TBMM 3. dönem milletvekilleri listesi',
         desc='Tek parti döneminin ilk genel seçimi. İki dereceli yapıldı ve Vikipedi\'ye göre bütün milletvekilleri Cumhuriyet Halk Fırkası\'ndan seçildi.'),
    dict(id='1931', file='tbmm4', table=0, date='1931-04-25', era='cumhuriyet', year=1931, type='genel',
         title='1931 Milletvekili Genel Seçimi (TBMM IV. dönem)', dateLabel='25 Nisan 1931',
         cols=dict(unit=0, name=1), level='il',
         page='TBMM 4. dönem milletvekilleri listesi',
         desc='İki dereceli tek parti seçimi. Bağımsız adaylara 30 sandalye ayrıldı. Vikipedi\'ye göre CHF\'nin ilan ettiği 287 aday seçildi; bağımsızlara ayrılan sandalyeler için yarışan 194 adaydan 20\'si milletvekili oldu ve 10 sandalye boş kaldı. Bağımsızların 10\'u dönem içinde CHF\'ye katıldı. Kaynak liste bağımsızları ayrı göstermediğinden il düzeyinde yalnız vekil sayısı verilir.'),
    dict(id='1935', file='tbmm5', table=0, date='1935-02-08', era='cumhuriyet', year=1935, type='genel',
         title='1935 Milletvekili Genel Seçimi (TBMM V. dönem)', dateLabel='8 Şubat 1935',
         cols=dict(unit=0, name=1), level='il',
         page='TBMM 5. dönem milletvekilleri listesi',
         desc='Kadınların milletvekili seçilme hakkını tanıyan 5 Aralık 1934 anayasa değişikliğinden sonraki ilk seçim. Tek parti döneminde iki dereceli yapıldı. Seçim maddesinin bilgi kutusunda 444 sandalyenin 401\'i CHP için verilir. Dönem listesi vekillerin mensubiyetini ayırmadığından il düzeyinde yalnız vekil sayısı gösterilir.'),
    dict(id='1939', file='tbmm6', table=0, date='1939-03-26', era='cumhuriyet', year=1939, type='genel',
         title='1939 Milletvekili Genel Seçimi (TBMM VI. dönem)', dateLabel='26 Mart 1939',
         cols=dict(unit=0, name=1), level='il',
         page='TBMM 6. dönem milletvekilleri listesi',
         desc='İki dereceli tek parti seçimi; seçime yalnız CHP listesi katıldı. Hatay Devleti Meclisi 29 Haziran 1939\'da Türkiye\'ye katılma kararı aldı ve Hatay ili 7 Temmuz 1939 tarihli kanunla kuruldu; listedeki Hatay vekilleri seçimden sonra seçildi. Seçim maddesinin bilgi kutusunda 470 sandalyenin 466\'sı CHP için verilir. Dönem listesi vekillerin mensubiyetini ayırmadığından il düzeyinde yalnız vekil sayısı gösterilir.'),
    dict(id='1943', file='tbmm7', table=0, date='1943-02-28', era='cumhuriyet', year=1943, type='genel',
         title='1943 Milletvekili Genel Seçimi (TBMM VII. dönem)', dateLabel='15–20 Şubat (ikinci seçmenler) ve 28 Şubat 1943',
         cols=dict(unit=0, name=1), level='il',
         page='TBMM 7. dönem milletvekilleri listesi',
         desc='Tek partili dönemin son genel seçimi. Seçim maddesinin bilgi kutusunda 492 sandalyenin 488\'i CHP için verilir. Dönem listesi vekillerin mensubiyetini ayırmadığından il düzeyinde yalnız vekil sayısı gösterilir.'),
    dict(id='1946', file='tbmm8', table=0, date='1946-07-21', era='cumhuriyet', year=1946, type='genel',
         title='1946 Milletvekili Genel Seçimi (TBMM VIII. dönem)', dateLabel='21 Temmuz 1946',
         cols=dict(unit=0, name=1, group=3, group2=5), groupLabel='Seçildiği parti', group2Label='Dönem içinde geçtiği parti', level='il',
         page='TBMM 8. dönem milletvekilleri listesi',
         desc='Çok partili ilk genel seçim. Tek dereceli yapıldı; açık oy, gizli tasnif uygulandı. Demokrat Parti ilk kez seçime girdi. Seçimin dürüstlüğü o dönemde de tartışıldı.'),
]

def is_later(raw):
    r = raw.lower()
    return ('yerine' in r) or ('ara seçim' in r) or ('ara secim' in r)

PARTY_NORM = {
    'İttihat ve Terakki Fırkası': 'İttihat ve Terakki', 'Hürriyet ve İtilaf Fırkası': 'Hürriyet ve İtilaf',
    'Anadolu ve Rumeli Müdâfaa-i Hukuk Cemiyeti (Birinci Grup)': 'Müdâfaa-i Hukuk (Birinci Grup)',
    'Ermeni Devrimci Federasyonu': 'Taşnak', '': 'Bilinmiyor', 'Türk ?': 'Türk (?)', 'Arap ?': 'Arap (?)',
}

def num(t):
    t = t.replace('+/-', '').replace('~', '').strip()
    if not re.fullmatch(r'[\d.]+', t or 'x'): return None
    return int(t.replace('.', ''))

def attach_1946(units):
    ts = parse_tables(open(os.path.join(args.wiki, 'tr1946.txt')).read())
    res, turn = ts[2], ts[3]
    alias = dict(ALIAS, Afyon='Afyonkarahisar', İçel='Mersin')
    parties = [('Cumhuriyet Halk Partisi', 2), ('Demokrat Parti', 4), ('Millî Kalkınma Partisi', 6), ('Bağımsız', 8)]
    seen = set()
    for r in res[1:]:
        k = alias.get(base_name(r[0]['text']))
        if k not in units: print('1946 eşleşmedi', r[0]['text'], file=sys.stderr); continue
        u = units[k]; seen.add(k)
        votes, approx, unknown = {}, [], []
        for pname, ci in parties:
            raw = r[ci]['text']
            if raw in ('K',): unknown.append(pname); continue
            v = num(raw)
            if v is not None:
                votes[pname] = v
                if '+/-' in raw: approx.append(pname)
        tot = num(r[10]['text'])
        mv = num(r[1]['text'])
        if mv: u['seatsOfficial'] = mv
        if votes: u['votes'] = votes
        if tot:
            u['valid'] = tot
            u['pct'] = {p: round(100 * v / tot, 2) for p, v in votes.items()}
        if approx: u['approxVotes'] = approx
        if u.get('pct') and sum(u['pct'].values()) > 100.5:
            u['note'] = 'Kaynaktaki bazı değerler yaklaşık ("+/-") olduğundan oranların toplamı %100\'ü aşıyor.'
        if unknown: u['unknownVotes'] = unknown
        if u.get('pct'):
            best = max(u['pct'], key=u['pct'].get)
            if u['pct'][best] > 50 or not unknown:
                u['winner'] = best; u['winnerBasis'] = 'votes'
            else:
                u['winnerBasis'] = 'seats'
    for r in turn[1:]:
        k = alias.get(base_name(r[0]['text']))
        if k in units:
            vs = num(r[1]['text'].replace('..', '.'))
            if vs: units[k]['voters'] = vs
            try: units[k]['turnout'] = float(r[3]['text'].replace(',', '.'))
            except ValueError: pass
    print('1946 il sonuçları eklendi:', len(seen), file=sys.stderr)

catalog = []
for E in ELECTIONS:
    y = E['year']
    grid = parse_tables(open(os.path.join(args.wiki, E['file'] + '.txt')).read())[E['table']]
    c = E['cols']
    units = {}
    unresolved = []
    for row in grid[1:]:
        if row[0]['kind'] == 'h' or len(row) <= c['name']: continue
        name = row[c['name']]['text']
        utext = row[c['unit']]['text']
        if not name or not utext: continue
        none_elected = name == 'Seçilen olmadı'
        b = base_name(utext)
        vb = base_name(row[c['vil']]['text']) if 'vil' in c else None
        key = None
        if E['level'] == 'vilayet':
            key = b if b in ('Dersaadet', 'Hüdavendigâr', 'Mamuretülaziz') else None
            if key is None:
                k2 = ALIAS.get(b)
                if k2 and k2 in SANCAK_TO_VIL1877: key = SANCAK_TO_VIL1877[k2]
                elif b in ('Mamuret-ül-Aziz',): key = 'Mamuretülaziz'
                elif b == 'Haleb': key = 'Halep'
                elif b in ('Bosna ve Hersek',): key = 'Bosna'
                elif b in ('Kosova ve Sofya', 'Kosova'): key = 'Kosova'
                elif b == 'Trablus-i Garbî': key = 'Trablusgarp'
                elif b == 'Tuna': key = 'Tuna'
                elif b == 'Girit': key = 'Girit'
                elif b == 'Dersaadet (İstanbul)': key = 'Dersaadet'
                else: key = OUT_ALIAS.get(b) or ALIAS.get(b)
                if b == 'Hüdavendigâr': key = 'Hüdavendigâr'
                if b == 'Dersaadet': key = 'Dersaadet'
        else:
            if y >= 1935 and b == 'İçel': key = 'Mersin'
            elif b in ALIAS and not (y <= 1914 and b in OUT_ALIAS and b not in ('Halep',)):
                key = ALIAS[b]
            elif b in OUT_ALIAS: key = OUT_ALIAS[b]
            elif vb and vb in OUT_ALIAS: key = OUT_ALIAS[vb]
            if key == 'Bingöl' and y <= 1923: key = 'Genç'
            if key == 'Genç' and y >= 1939: key = 'Bingöl'
            if key == 'Gaziantep' and y < 1914: key = 'Halep'
            if key == 'Halep' and vb == 'Halep' and b != 'Halep': key = ALIAS.get(b)
        if key is None:
            unresolved.append(utext); continue
        u = units.setdefault(key, {'name': None, 'labels': [], 'members': []})
        lab = utext.split(' / ')[0].strip()
        if lab not in u['labels']: u['labels'].append(lab)
        if none_elected:
            u['note'] = 'Kaynak listeye göre bu vilayetten mebus seçilmedi.'
            continue
        m = {'n': name}
        if 'group' in c and len(row) > c['group']:
            m['g'] = PARTY_NORM.get(row[c['group']]['text'], row[c['group']]['text'])
        elif E.get('fixedGroup'):
            m['g'] = E['fixedGroup']
        if 'group2' in c and len(row) > c['group2'] and row[c['group2']]['text']:
            m['g2'] = PARTY_NORM.get(row[c['group2']]['text'], row[c['group2']]['text'])
        if is_later(row[c['name']]['raw']): m['later'] = True
        u['members'].append(m)
    if unresolved:
        print('ÇÖZÜLEMEDİ', E['id'], sorted(set(unresolved)), file=sys.stderr)

    # kaynakta art arda yinelenen aynı kayıt (ör. 1920 Saruhan'da "Çerkes Reşit" iki kez) tek kişi sayılır
    for key, u in units.items():
        ms, out, dup = u['members'], [], []
        for m in ms:
            if out and out[-1]['n'] == m['n'] and out[-1].get('g') == m.get('g'):
                dup.append(m['n']); continue
            out.append(m)
        if dup:
            u['members'] = out
            u['note'] = (u.get('note', '') + ' ' if u.get('note') else '') + 'Kaynak listede "%s" adı art arda iki kez geçiyor; aynı kişinin yinelenmesi sayılıp bir kez sayıldı.' % '", "'.join(dup)

    # birim özetleri
    nat_groups, nat_total = {}, 0
    for key, u in units.items():
        labs = u.pop('labels')
        if E['level'] == 'sancak' and y <= 1914 and key in set(OUT_ALIAS.values()) and key != 'Halep':
            u['name'] = key + ('' if key in ('Kudüs', 'Zor', 'Cebel-i Lübnan', 'Bingazi', 'Batı Trakya') else ' vilayeti')
            if labs != [key]: u['sub'] = labs
        else:
            u['name'] = ' / '.join(labs)
        if not u['members']: u.pop('members')
        u['total'] = len(u.get('members', []))
        u['initial'] = sum(1 for m in u.get('members', []) if not m.get('later'))
        if any('g' in m for m in u.get('members', [])):
            gs = {}
            for m in u['members']:
                if m.get('later'): continue
                gs[m.get('g', 'Bilinmiyor')] = gs.get(m.get('g', 'Bilinmiyor'), 0) + 1
            u['seats'] = dict(sorted(gs.items(), key=lambda kv: -kv[1]))
            for g, n in gs.items(): nat_groups[g] = nat_groups.get(g, 0) + n
            if gs:
                top = max(gs.values()); w = [g for g, n in gs.items() if n == top]
                u['winner'] = w[0] if len(w) == 1 else None
        nat_total += u['initial']

    if E['id'] == '1946':
        attach_1946(units)

    # geometri
    geo_id = 'h-' + E['id']
    feats = {}
    if E['level'] == 'vilayet':
        for d in DISTRICTS:
            s = tr_unit(d, 1877)
            if s is None: continue
            v = SANCAK_TO_VIL1877.get(s)
            if v is None: print('1877 vilayet yok:', s, d['name'], file=sys.stderr); continue
            feats.setdefault(v, []).append(d['geom'])
        for k, gs in outside_units(1877).items(): feats.setdefault(k, []).extend(gs)
    else:
        gy = 1908 if y in (1908, 1912) else (1914 if y == 1914 else y)
        for d in DISTRICTS:
            s = tr_unit(d, gy)
            if s is not None: feats.setdefault(s, []).append(d['geom'])
        if y <= 1914:
            for k, gs in outside_units(y).items(): feats.setdefault(k, []).extend(gs)
        if y == 1920:
            feats['Batum'] = [ne_get('GEO', 'Ajaria')]
    missing_geo = sorted(set(units) - set(feats))
    if missing_geo: print('GEOMETRİSİZ', E['id'], missing_geo, file=sys.stderr)
    fc = {'type': 'FeatureCollection', 'features': []}
    for k, gs in feats.items():
        nm = units[k]['name'] if k in units else k
        for g in gs:  # birleştirme mapshaper -dissolve ile (ortak sınırlar korunur)
            fc['features'].append({'type': 'Feature', 'properties': {'id': slug(k), 'name': nm}, 'geometry': mapping(g)})
    json.dump(fc, open(os.path.join(GEO_OUT, geo_id + '.geojson'), 'w'), ensure_ascii=False)

    out_units = {}
    for k, u in units.items():
        if k not in feats: continue
        out_units[slug(k)] = u
    for k in feats:
        if k not in units: out_units.setdefault(slug(k), {'name': k, 'total': 0, 'nodata': True})
    for k in feats:
        bn = boundary_note(k, 1877 if E['level'] == 'vilayet' else y) if E['level'] != 'vilayet' else (
            'Vilayet sınırı günümüz il ve idari bölgelerinin birleştirilmesiyle çizildi; tarihî sınırla örtüşmez.')
        if bn and slug(k) in out_units: out_units[slug(k)]['boundary'] = bn

    has_groups = bool(nat_groups)
    rec = {
        'id': E['id'], 'type': E.get('type', 'genel'), 'era': E['era'], 'date': E['date'], 'dateLabel': E['dateLabel'],
        'title': E['title'], 'geo': geo_id, 'metric': 'members', 'level': E['level'],
        'groupLabel': E.get('groupLabel'), 'group2Label': E.get('group2Label'),
        'description': E['desc'],
        'parties': [g for g, _ in sorted(nat_groups.items(), key=lambda kv: -kv[1])][:8] if has_groups else [],
        'units': out_units,
        'national': {'members_listed': sum(u['total'] for u in units.values()), 'members_initial': nat_total,
                     **({'seats': dict(sorted(nat_groups.items(), key=lambda kv: -kv[1]))} if has_groups else {})},
        'approxBoundaries': True,
        'notes': [
            'Vekil sayıları Vikipedi\'deki dönem listesinden sayılmıştır. Liste dönem boyunca görev yapanları içerir; açıklamasında "yerine" ya da "ara seçim" geçen vekiller "sonradan katılan" olarak ayrılmış, sayılara katılmamıştır. Ara seçimle gelenlerin hepsi işaretli olmayabilir.',
            'Sınırlar yaklaşıktır: Türkiye içindeki birimler günümüz ilçelerinin o dönemki bağlılıklarına göre, Türkiye dışındaki vilayetler günümüz idari bölgelerinin birleştirilmesiyle çizilmiştir.',
        ],
        'sources': [{'name': 'Vikipedi: ' + E['page'] + ' (CC BY-SA 4.0)', 'url': WIKI_URL + E['page'].replace(' ', '_')}],
    }
    TOTAL_SEATS = {'1923': 286, '1927': 335, '1931': 317, '1935': 444, '1939': 470, '1943': 492, '1946': 465}  # seçim maddelerinin bilgi kutuları
    if E['id'] in TOTAL_SEATS: rec['national']['total_seats'] = TOTAL_SEATS[E['id']]
    if E['era'] == 'osmanli' or E['id'] in ('1920', '1923', '1927', '1931', '1935', '1939', '1943'): rec['defaultMode'] = 'count'
    if E['id'] == '1946':
        rec['sources'].append({'name': 'Vikipedi: 1946 Türkiye genel seçimleri, "İllere göre sonuçlar" ve "Kayıtlı seçmen sayısı" tabloları (CC BY-SA 4.0)',
                               'url': WIKI_URL + '1946_Türkiye_genel_seçimleri'})
        rec['notes'].insert(0, '1946 seçiminin resmî il sonuçları yayımlanmamıştır. Oylar, Vikipedi\'nin milletvekili seçim mazbatalarından derlediği tablodan alınmıştır; "+/-" işaretli değerler yaklaşıktır, bazı illerde bazı partilerin oyu bilinmemektedir. Ülke geneli için Vikipedi yaklaşık CHP %85,4, DP %13,1 verir; sandalye dağılımı resmî kaynaklarda CHP 397, DP 64 olarak geçer.')
        rec['national']['turnout_note'] = 'Kayıtlı seçmen 8.551.549; kullanılan oy 6.373.543; katılım %74,53 (Vikipedi, TBMM kaynağı)'
    if E.get('group2Label') == 'Etnik mensubiyet' or (E.get('groupLabel') or '').startswith('Etnik'):
        rec['notes'].insert(1, 'Etnik mensubiyet Vikipedi listesindeki sınıflandırmadır. Mebusların kimlikleri dönemin kaynaklarında bu şekilde kayıtlı değildir; sınıflandırma tartışmalıdır ve kesin bilgi olarak okunmamalıdır.')
    if E['level'] == 'sancak' and y <= 1914:
        rec['notes'].insert(1, 'Bugünkü Türkiye sınırları içinde birimler sancaktır; Türkiye dışındaki bölgelerde ise vilayettir (vilayete bağlı sancakların vekilleri toplanmıştır). Bu nedenle "vekil sayısı" görünümünde büyük vilayetler daha koyu görünür.')
    if E['level'] == 'vilayet':
        rec['notes'].insert(1, 'Bu seçimde birimler vilayettir; listede vilayetin altında sayılan sancaklar vilayete dahil edilmiştir.')
    json.dump(rec, open(os.path.join(OUT, E['id'] + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    catalog.append({k: rec[k] for k in ('id', 'title', 'date', 'type', 'geo', 'metric', 'era', 'dateLabel')})
    print(E['id'], 'birim', len(units), 'geometri', len(feats), 'vekil', rec['national']['members_listed'], 'ilk', nat_total,
          'gruplar', dict(list(nat_groups.items())[:6]))


# ---------------------------------------------------------------- liste dışı kayıtlar (yerel seçimler, 1840)
def tr_geo(geo_id, gy):
    feats = {}
    for d in DISTRICTS:
        s_ = tr_unit(d, gy)
        if s_ is not None: feats.setdefault(s_, []).append(d['geom'])
    fc = {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'id': slug(k), 'name': name_for(k, gy)}, 'geometry': mapping(g)}
        for k, gs in feats.items() for g in gs]}
    json.dump(fc, open(os.path.join(GEO_OUT, geo_id + '.geojson'), 'w'), ensure_ascii=False)
    return feats

NAME_FIX = {'Ağrı': 'Ağrı (Karaköse)', 'Mersin': 'İçel (Mersin)', 'Artvin': 'Çoruh (Artvin)', 'Adana': 'Seyhan (Adana)'}
def name_for(k, y):
    if k == 'Ağrı' and y < 1938: return 'Bayazıt / Ağrı'
    if k == 'Mersin' and y >= 1933: return 'İçel (Mersin)'
    if k == 'Artvin' and y >= 1933: return 'Çoruh (Artvin)'
    if k == 'Adana' and y >= 1933: return 'Seyhan (Adana)'
    if k == 'Tunceli' and y <= 1923: return 'Dersim'
    if k == 'Kahramanmaraş': return 'Maraş'
    if k == 'Şanlıurfa': return 'Urfa'
    if k == 'Afyonkarahisar': return 'Afyon Karahisar'
    return k

WIKI = lambda t: {'name': 'Vikipedi: ' + t + ' (CC BY-SA 4.0)', 'url': WIKI_URL + t.replace(' ', '_')}
LOCAL = [
    dict(id='1930yerel', year=1930, date='1930-09-15', dateLabel='Eylül – Ekim 1930', page='1930 Türkiye yerel seçimleri',
         title='1930 Belediye Seçimleri', subtitle='İl merkezi belediyesi; SCF\'nin kazandığı belediyeler',
         desc='Belediyeler Kanunu\'nun 4 Nisan 1930\'da yürürlüğe girmesinden sonra yapılan ilk yerel seçim. Cumhuriyet Halk Fırkası ile yeni kurulan Serbest Cumhuriyet Fırkası katıldı ve kadınlar ilk kez seçme ve seçilme hakkını kullandı. Belediye başkanları meclis üyeleri arasından iki kademeli seçildi. Açıklanan sonuçlara göre 502 seçim bölgesinin 478\'ini CHF, 24\'ünü SCF kazandı. SCF\'nin kazandıkları 2 il merkezi (Samsun ve Silifke), 16 ilçe ve 6 kasabadır. SCF sonuçların baskı ve usulsüzlükle elde edildiğini ileri sürdü.'),
    dict(id='1934yerel', year=1934, date='1934-09-15', dateLabel='Eylül – Ekim 1934', page='1934 Türkiye yerel seçimleri',
         title='1934 Belediye Seçimleri', desc='Serbest Cumhuriyet Fırkası kapatıldıktan sonra yapılan seçime Cumhuriyet Halk Fırkası tek başına katıldı. İl düzeyinde sonuç verisi bulunmadığından harita yalnız dönemin il sınırlarını gösterir.'),
    dict(id='1938yerel', year=1938, date='1938-10-01', dateLabel='1–19 Ekim 1938', page='1938 Türkiye yerel seçimleri',
         title='1938 Belediye Seçimleri', desc='Seçime Cumhuriyet Halk Partisi tek başına katıldı. Vikipedi\'ye göre belediye teşkilatı olan 544 yerden 7 vilayet ile 41 kaza ve nahiye belediyesi dışındaki sonuçlar yayımlandı. İl düzeyinde sonuç verisi bulunmadığından harita yalnız dönemin il sınırlarını gösterir.'),
    dict(id='1942yerel', year=1942, date='1942-10-01', dateLabel='Ekim 1942', page='1942 Türkiye yerel seçimleri',
         title='1942 Belediye ve İl Genel Meclisi Seçimleri', desc='Belediye ve il genel meclisi seçimlerine Cumhuriyet Halk Partisi tek başına katıldı. İl düzeyinde sonuç verisi bulunmadığından harita yalnız dönemin il sınırlarını gösterir.'),
    dict(id='1946yerel', year=1946, date='1946-05-26', dateLabel='26 Mayıs 1946', page='1946 Türkiye yerel seçimleri',
         title='1946 Belediye Seçimleri', desc='Tek günde yapılan ilk yerel seçim. Seçimler bir yıl öne çekildi. Demokrat Parti teşkilatlanmasını tamamlayamadığı gerekçesiyle seçime katılmadı. Millî Kalkınma Partisi oylama sırasında hile yapıldığını öne sürerek seçimden çekildi. "Açık oy, gizli tasnif" usulü uygulandı. İl düzeyinde sonuç verisi bulunmadığından harita yalnız dönemin il sınırlarını gösterir.'),
]
SCF1930 = {  # Vikipedi "1930 Türkiye yerel seçimleri": SCF'nin kazandığı yerler
    'Aydın': ['Bozdoğan (ilçe)', 'Nazilli (ilçe)', 'Çine (ilçe)', 'Yenipazar (kasaba)', 'Atça (kasaba)', 'Karapınar (kasaba)'],
    'Edirne': ['Keşan (ilçe)'], 'İçel': ['Silifke (il merkezi)'],
    'İzmir': ['Bergama (ilçe)', 'Kuşadası (ilçe)', 'Menemen (ilçe)', 'Seferihisar (ilçe)', 'Urla (ilçe)', 'Buca (kasaba)', 'Kınık (kasaba)', 'Armutlu (kasaba)'],
    'Manisa': ['Gördes (ilçe)'], 'Samsun': ['Samsun (il merkezi)', 'Ladik (ilçe)'], 'Amasya': ['Merzifon (ilçe)'],
    'Balıkesir': ['Edremit (ilçe)', 'Susurluk (ilçe)'], 'Kırklareli': ['Lüleburgaz (ilçe)', 'Vize (ilçe)'],
}
for L in LOCAL:
    y = L['year']; geo_id = 'h-' + L['id']
    feats = tr_geo(geo_id, y)
    units = {}
    for k in feats:
        u = {'name': name_for(k, y)}
        if L['id'] == '1930yerel':
            scf = SCF1930.get(k, [])
            u['winner'] = 'Serbest Cumhuriyet Fırkası' if any('il merkezi' in x for x in scf) else 'Cumhuriyet Halk Fırkası'
            if scf:
                u['seats'] = {'Serbest Cumhuriyet Fırkası': len(scf)}
                u['members'] = [{'n': x, 'g': 'Serbest Cumhuriyet Fırkası'} for x in scf]
            u['total'] = len(scf)
        else:
            u['nodata'] = True; u['total'] = 0
        bn = boundary_note(k, y)
        if bn: u['boundary'] = bn
        units[slug(k)] = u
    rec = {'id': L['id'], 'type': 'yerel', 'era': 'cumhuriyet', 'date': L['date'], 'dateLabel': L['dateLabel'],
           'title': L['title'], 'subtitle': L.get('subtitle'), 'geo': geo_id, 'metric': 'local-early', 'level': 'il',
           'description': L['desc'], 'units': units, 'approxBoundaries': True,
           'parties': ['Cumhuriyet Halk Fırkası', 'Serbest Cumhuriyet Fırkası'] if L['id'] == '1930yerel' else [],
           'national': {'seats': {'Cumhuriyet Halk Fırkası': 478, 'Serbest Cumhuriyet Fırkası': 24}} if L['id'] == '1930yerel' else {},
           'notes': ['Sınırlar yaklaşıktır: günümüz ilçelerinin o dönemki il bağlılığına göre birleştirilmiştir.'] +
                    (['Haritadaki renk il merkezi belediyesini kazanan partiyi gösterir; "SCF belediye sayısı" ilde SCF\'nin kazandığı belediyelerin sayısıdır. Ülke toplamı kazanılan seçim bölgesi (belediye) sayısıdır.'] if L['id'] == '1930yerel' else []),
           'sources': [WIKI(L['page'])]}
    if L['id'] == '1930yerel': rec['metric'] = 'members'; rec['groupLabel'] = 'SCF\'nin kazandığı belediyeler'
    json.dump(rec, open(os.path.join(OUT, L['id'] + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    catalog.append({k: rec[k] for k in ('id', 'title', 'date', 'type', 'geo', 'metric', 'era', 'dateLabel')})
    print(L['id'], 'birim', len(units))

rec = {'id': '1840', 'type': 'yerel', 'era': 'osmanli', 'date': '1840-01-25', 'dateLabel': '1840 (25 Ocak 1840 tarihli nizamname)',
       'title': '1840 Muhassıllık Meclisleri', 'geo': None, 'metric': 'none', 'units': {},
       'description': 'Tanzimat\'ın ilanından sonra vergilerin tarhı ve tahsili için sancaklara muhassıllar atandı; görevlerinin esasları 25 Ocak 1840 tarihli nizamnameyle belirlendi. Muhassılların yanında kurulan muhassıllık meclislerine yerel ileri gelenler arasından üye belirlendiği için bu meclisler, Osmanlı\'da yerel temsil ve seçim uygulamasının erken bir örneği olarak anılır. Vikipedi\'ye göre muhassıllık 1842\'de kaldırılarak iltizam usulüne dönüldü; meclisler 1849\'dan sonra memleket ya da eyalet meclisi adını aldı.',
       'notes': ['Bu meclislerin üyelik seçimlerine ait eyalet ya da sancak düzeyinde derlenmiş bir sonuç verisi bulunmadığından harita gösterilmez.',
                 'Meclislerin bileşimi ve üyelerin belirlenme usulü kullanılan kaynakta ayrıntılı verilmez; ayrıntılar Tanzimat dönemi yerel yönetim literatüründe bulunur.'],
       'sources': [WIKI('Muhassıl')]}
json.dump(rec, open(os.path.join(OUT, '1840.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
catalog.append({k: rec[k] for k in ('id', 'title', 'date', 'type', 'geo', 'metric', 'era', 'dateLabel')})

json.dump(catalog, open(os.path.join(ROOT, 'build', 'catalog-historical.json'), 'w'), ensure_ascii=False, indent=0)
