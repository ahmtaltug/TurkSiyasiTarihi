#!/usr/bin/env python3
"""Güncel durum: TBMM'deki bugünkü sandalye dağılımı ve 81 il (büyükşehir) belediye başkanının partisi.

Kaynak Türkçe Vikipedi'dir (CC BY-SA 4.0):
- TBMM: "Şablon:TBMM sandalye dağılımı" tablosunun "Mevcut" sütunu.
- Belediyeler: büyükşehirlerde "<İl> Büyükşehir Belediyesi", diğer illerde il merkezi maddesinin bilgi kutusundaki
  belediye başkanı ve partisi.

Çıktı: data/elections/guncel.json ve data/index.json içindeki "guncel" kaydı.
GitHub Actions'ta günde bir çalışır (.github/workflows/guncel.yml); değişiklik varsa site yeniden yayımlanır.
Bir sayfa okunamazsa o il önceki değeriyle kalır; TBMM tablosu okunamazsa dosya değiştirilmez.
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from infobox import find_template, params, plain  # noqa: E402
from wikitable import parse_tables  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIKI = 'https://tr.wikipedia.org/wiki/'
UA = 'SecimHaritasiBuilder/0.1 (statik site; gunluk guncelleme)'
BUYUKSEHIR = {'Adana', 'Ankara', 'Antalya', 'Aydın', 'Balıkesir', 'Bursa', 'Denizli', 'Diyarbakır', 'Erzurum', 'Eskişehir',
              'Gaziantep', 'Hatay', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Kayseri', 'Kocaeli', 'Konya', 'Malatya', 'Manisa',
              'Mardin', 'Mersin', 'Muğla', 'Ordu', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon', 'Van'}
# il merkezinin madde adı il adından farklıysa
CITY_TITLE = {'Kocaeli': 'İzmit', 'Hatay': 'Antakya', 'Sakarya': 'Adapazarı', 'Hakkari': 'Hakkâri'}


def fetch(title):
    url = WIKI + urllib.parse.quote(title.replace(' ', '_')) + '?action=raw'
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8')
        except Exception as e:  # 404 ya da ağ hatası
            if getattr(e, 'code', None) == 404:
                return None
            time.sleep(3 * (i + 1))
    return None


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


H = load('data/history.json')
PARTIES = load('data/parties.json')
NAME_KEYS = dict(H['nameKeys'])
NAME_KEYS.update({'Yeni Parti (2026)': 'Yeni Parti', 'Yeni Parti': 'Yeni Parti', 'Halkların Eşitlik ve Demokrasi Partisi': 'DEM Parti',
                  'Büyük Birlik Partisi': 'BBP', 'Yeniden Refah Partisi': 'YENİDEN REFAH', 'Demokratik Sol Parti': 'DSP',
                  'Hür Dava Partisi': 'HÜDAPAR', 'İYİ Parti': 'İYİ Parti', 'Adalet ve Kalkınma Partisi': 'AK Parti',
                  'Cumhuriyet Halk Partisi': 'CHP', 'Milliyetçi Hareket Partisi': 'MHP', 'Saadet Partisi': 'SP',
                  'Demokrat Parti (2007)': 'DP', 'Türkiye İşçi Partisi (2017)': 'TİP', 'Zafer Partisi': 'ZP',
                  'Demokrasi ve Atılım Partisi': 'DEVA', 'Gelecek Partisi': 'Gelecek Partisi'})
FULL = {}  # anahtar -> tam ad


ALIAS = {'AKP': 'AK Parti', 'AK PARTİ': 'AK Parti', 'Ak Parti': 'AK Parti', 'DEM': 'DEM Parti', 'İYİ': 'İYİ Parti', 'YRP': 'YENİDEN REFAH', 'Yeniden Refah': 'YENİDEN REFAH',
         'HÜDA PAR': 'HÜDAPAR', 'Emek Partisi': 'EMEP', 'Yeni Parti': 'Yeni Parti', 'YENİ Parti': 'Yeni Parti'}


def party_of(link_target, loose=False):
    t = link_target.strip()
    k = (NAME_KEYS.get(t) or NAME_KEYS.get(re.sub(r'\s*\(.*?\)$', '', t)) or ALIAS.get(t) or ALIAS.get(re.sub(r'\s*\(.*?\)$', '', t))
         or (t if t in PARTIES and t not in ('Diğer', 'Bilinmiyor') else None))
    if not k and loose and re.search(r'(Parti|Partisi|Yol|Hareketi)\b', t):
        k = re.sub(r'\s*\(.*?\)$', '', t)   # renk listesinde olmayan parti: kendi adıyla
    if k:
        FULL.setdefault(k, re.sub(r'\s*\(\d{4}\)$', '', t))
    return k


def links(v):
    return [m.group(1).strip() for m in re.finditer(r'\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]', v or '')]


# ------------------------------------------------------------------ TBMM
tpl = fetch('Şablon:TBMM sandalye dağılımı')
if not tpl:
    sys.exit('TBMM tablosu okunamadı; dosya değiştirilmedi.')
seats, seats_2023 = {}, {}
for tb in parse_tables(tpl):
    hdr = ' '.join(c['text'] for c in (tb[0] if tb else []))
    for row in tb:
        texts = [c['text'] for c in row]
        raw = ' '.join(c.get('raw', '') for c in row)
        nums = [t for t in texts if re.fullmatch(r'\d+', t.strip())]
        if len(nums) < 2:
            continue
        k = None
        for l in links(raw):
            k = party_of(l, loose=True)
            if k:
                break
        if not k:
            lab = ' '.join(texts).lower()
            k = 'Bağımsız' if 'bağımsız' in lab else 'Boş' if 'boş' in lab or 'açık' in lab else None
        if not k:
            continue
        seats_2023[k] = seats_2023.get(k, 0) + int(nums[0])
        seats[k] = seats.get(k, 0) + int(nums[1])
if sum(seats.values()) < 500:
    sys.exit('TBMM tablosu beklenen biçimde değil (%d sandalye); dosya değiştirilmedi.' % sum(seats.values()))

# ------------------------------------------------------------------ belediyeler
out_path = os.path.join(ROOT, 'data', 'elections', 'guncel.json')
prev = load('data/elections/guncel.json')['units'] if os.path.exists(out_path) else {}
units, failed = {}, []
for plaka, pr in sorted(load('data/demographics.json')['provinces'].items(), key=lambda x: int(x[0])):
    name = pr['name']
    if name in BUYUKSEHIR:
        titles, fields = [name + ' Büyükşehir Belediyesi'], ('lider_adı', 'lider_partisi', 'önder_adı', 'önder_parti', 'belediye başkanı')
    else:
        c = CITY_TITLE.get(name, name)
        titles, fields = [c, c + ' (şehir)'], ('önder_adı', 'önder_parti', 'önder_partisi', 'belediye başkanı', 'lider_adı')
    got = None
    for t in titles:
        txt = fetch(t)
        time.sleep(1.2)
        tb = txt and find_template(txt, ['Yerleşim bilgi kutusu', 'Türkiye il merkezi bilgi kutusu', 'Kuruluş bilgi kutusu',
                                         'Belediye bilgi kutusu', 'Şehir bilgi kutusu', 'Bilgi kutusu yerleşim', 'Yerleşim bilgi kutusu2'])
        if not tb:
            continue
        p = params(tb)
        val = ' '.join(p.get(f, '') for f in fields if p.get(f))
        lead = p.get(fields[0], '')
        for n in ('', '1', '2', '3'):   # önder_türüN = "Belediye başkanı" olan satır
            if 'başkan' in plain(p.get('önder_türü' + n, '')).lower() and p.get('önder_adı' + n):
                lead = p['önder_adı' + n]
                val = lead + ' ' + p.get('önder_parti' + n, '') + ' ' + p.get('önder_partisi' + n, '')
                break
        if not val.strip():
            continue
        k = None
        low = plain(val).lower()
        if re.search(r'kayyı?u?m|\bvali\b|kaymakam', low):   # kayyım ataması parti bağlantısından önce gelir
            k = 'Kayyım'
        for l in ([] if k else links(val)):
            k = party_of(l, loose=True)
            if k:
                break
        if not k and 'bağımsız' in low:
            k = 'Bağımsız'
        mayor = plain(re.sub(r'\{\{[^{}]*\}\}', '', re.split(r'\(|<br', lead or val)[0])).strip(' ()')
        got = {'name': name, 'winner': k, 'mayor': mayor[:120], 'acting': 'vekâlet' in low, 'source': WIKI + t.replace(' ', '_')}
        break
    if got and got['winner']:
        units[plaka] = got
    elif plaka in prev:
        units[plaka] = prev[plaka]; failed.append(name)
    else:
        units[plaka] = {'name': name, 'nodata': True, 'note': 'Güncel belediye başkanı bilgisi okunamadı.'}; failed.append(name)

for u in units.values():
    if u.get('winner') == 'Kayyım':
        u['note'] = 'Belediyeye kayyım atanmış (görevden alınan başkanın yerine vali ya da kaymakam).'
    if u.get('acting'):
        u['note'] = 'Başkan vekâleten görevde.'
mayors = {}
for u in units.values():
    if u.get('winner'):
        mayors[u['winner']] = mayors.get(u['winner'], 0) + 1
today = datetime.date.today().isoformat()
names = {k: FULL.get(k, k) for k in set(seats) | set(mayors)}
names.update({'Kayyım': 'Kayyım (atanmış yönetici)', 'Bağımsız': 'Bağımsız', 'Boş': 'Boş sandalye'})
data = {
    'id': 'guncel', 'type': 'guncel', 'era': 'cumhuriyet', 'title': 'Güncel durum: meclis ve il belediyeleri',
    'date': today, 'dateLabel': 'Güncelleme: ' + today, 'geo': 'tr-modern', 'level': 'il', 'metric': 'members',
    'description': 'Seçim sonucu değil, bugünkü durum: TBMM\'deki partilerin güncel sandalye sayıları ve 81 ilin (büyükşehir ya da il '
                   'merkezi) belediye başkanının bugünkü partisi. Seçimden sonra parti değiştirmeler, yeni kurulan partiler, '
                   'istifalar ve kayyım atamaları burada yansır. Veri her gün Vikipedi\'den otomatik güncellenir.',
    'units': units, 'parties': sorted(mayors, key=lambda k: -mayors[k]), 'partyNames': names,
    'national': {'seats': dict(sorted(seats.items(), key=lambda x: -x[1])), 'seats2023': seats_2023, 'mayors': dict(sorted(mayors.items(), key=lambda x: -x[1])),
                 'total_seats': sum(seats.values())},
    'groupLabel': 'İl belediye başkanlıkları',
    'notes': ['Belediye başkanının partisi ilgili Vikipedi maddesinin bilgi kutusundan okunur; madde güncellenmemişse bilgi gecikebilir.',
              'TBMM sayıları "Şablon:TBMM sandalye dağılımı" tablosunun "Mevcut" sütunudur.'] +
             (['Okunamayan iller (önceki değer korundu): ' + ', '.join(failed)] if failed else []),
    'sources': [{'name': 'Vikipedi: Şablon:TBMM sandalye dağılımı (CC BY-SA 4.0)', 'url': WIKI + 'Şablon:TBMM_sandalye_dağılımı'},
                {'name': 'Vikipedi: il ve büyükşehir belediyesi maddeleri (CC BY-SA 4.0)', 'url': WIKI + '2024_Türkiye_yerel_seçimleri'}],
    'reliability': {'level': 'derleme', 'label': 'Ansiklopedik derleme', 'why': 'Vikipedi maddelerinden günlük otomatik derlenir; resmî kaynakla karşılaştırılmaz.'},
    'defaultMode': 'winner',
}
for k in list(data['units']):
    data['units'][k].pop('acting', None)
old = json.dumps(load('data/elections/guncel.json'), sort_keys=True) if os.path.exists(out_path) else ''
cmp_new = dict(data); cmp_old = json.loads(old) if old else {}
for x in (cmp_new, cmp_old):
    for f in ('date', 'dateLabel'):
        x.pop(f, None)
if json.dumps(cmp_new, sort_keys=True, ensure_ascii=False) == json.dumps(cmp_old, sort_keys=True, ensure_ascii=False):
    print('Değişiklik yok.')
    sys.exit(0)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
idx = load('data/index.json')
entry = {k: data[k] for k in ('id', 'type', 'era', 'title', 'date', 'dateLabel', 'geo')}
entry.update({'metric': 'members', 'units': len(units), 'rel': 'derleme'})
idx = [e for e in idx if e['id'] != 'guncel'] + [entry]
with open(os.path.join(ROOT, 'data', 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(idx, f, ensure_ascii=False, separators=(',', ':'))
print('TBMM', sum(seats.values()), seats, '| belediye', mayors, '| okunamayan', failed)
