#!/usr/bin/env python3
"""Meclis ve hükûmet tarihi, parti soy ağacı ve il demografisi verisini üretir.

Girdi: sources/wikipedia/ altındaki Vikipedi ham metinleri (19–20 Kasım 2026'da indirildi)
  hukumetler.txt              Türkiye hükûmetleri listesi
  cumhurbaskanlari.txt        Türkiye cumhurbaşkanları listesi
  partiler/pNN.txt, index.txt parti maddeleri (bilgi kutuları)
  demografi/*.txt             il nüfusları (1927–2025), il alanları, kişi başı GSYH, yaşam beklentisi
Çıktı: data/history.json, data/demographics.json
"""
import json, os, re, sys, glob
from shapely.geometry import shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wikitable import parse_tables, plain as wplain
from infobox import find_template, params, links, dates, plain, AYLAR
from party_names import full_name

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, 'sources', 'wikipedia')
WIKI = 'https://tr.wikipedia.org/wiki/'
ENWIKI = 'https://en.wikipedia.org/wiki/'


def tr_date(s):
    m = re.search(r'(\d{1,2})\s+(' + '|'.join(AYLAR) + r')\s+(\d{4})', s or '')
    return '%s-%02d-%02d' % (m.group(3), AYLAR[m.group(2)], int(m.group(1))) if m else None


# ------------------------------------------------------------------ hükûmetler
gov_rows = parse_tables(open(os.path.join(W, 'hukumetler.txt')).read())[0][1:]
govs = []
for r in gov_rows:
    name = r[0]['text']
    head = r[2]['text']
    title, _, person = head.partition(' / ')
    if not person: person, title = head, ''
    span = r[4]['text']
    a, _, b = span.partition(' - ')
    start, end = tr_date(a), (None if 'Görevde' in b else tr_date(b))
    conf_raw = r[6]['text']
    m = re.search(r'(\d+)\s*/\s*(\d+)', conf_raw)
    conf = {'text': conf_raw}
    if m: conf.update({'for': int(m.group(1)), 'total': int(m.group(2))})
    if 'Güvensizlik' in conf_raw: conf['failed'] = True
    party_cell = r[8]['text'] if len(r) > 8 else ''
    pname, _, pnote = party_cell.partition(' / ')
    if govs and govs[-1]['name'] == name and govs[-1]['start'] == start:
        g = govs[-1]
    else:
        g = {'name': name, 'title': title.strip(), 'head': re.sub(r'^Mustafa Kemal A$', 'Mustafa Kemal', person.strip()),  # kaynakta kısaltılmış bağlantı etiketi
              'election': r[3]['text'],
             'start': start, 'end': end, 'confidence': conf, 'parties': []}
        govs.append(g)
    pn = pname.strip()
    if pn and not any(p['name'] == pn for p in g['parties']):
        g['parties'].append({'name': pn, **({'note': pnote.strip(' ()')} if pnote else {})})
for g in govs:
    names = [p['name'] for p in g['parties']]
    g['kind'] = ('askerî' if 'Askerî Hükûmet' in names else 'geçici' if 'Geçici Hükûmet' in names else
                 'koalisyon' if len([n for n in names if n != 'Bağımsızlar']) > 1 else 'tek parti')
    if g['start'] and g['start'] < '1923-10-29':   # Birinci Meclis'te parti yoktu: meclis hükûmeti sistemi
        g['kind'] = 'meclis hükûmeti'

# ------------------------------------------------------------------ cumhurbaşkanları
cbt = parse_tables(open(os.path.join(W, 'cumhurbaskanlari.txt')).read())
party_of = {}
for r in cbt[0][1:]:
    nm = r[2]['text'].split(' / ')[0].strip()
    party_of[nm] = r[7]['text'] if len(r) > 7 else ''
pres = []
for r in sorted(cbt[1][1:], key=lambda r: tr_date(r[3]['text']) or ''):
    nm = r[1]['text']
    s_, e_ = tr_date(r[3]['text']), (None if 'Görevde' in r[4]['text'] else tr_date(r[4]['text']))
    if pres and pres[-1]['name'] == nm and pres[-1]['end'] == s_:
        pres[-1]['end'] = e_; continue
    pres.append({'name': nm, 'start': s_, 'end': e_, 'party': party_of.get(nm, ''), 'note': r[5]['text']})
# askerî yönetim aralıkları (hükûmetler tablosundaki tarihlerle)
pres_full = []
for p in pres:
    if pres_full and pres_full[-1]['end'] and p['start'] and pres_full[-1]['end'] < p['start']:
        gap = (pres_full[-1]['end'], p['start'])
        mil = [g for g in govs if g['kind'] == 'askerî' and g['start'] and g['start'] < gap[1] and (g['end'] or '9') > gap[0]]
        pres_full.append({'name': ('Askerî yönetim — ' + mil[0]['head']) if mil else 'Vekâleten',
                          'start': gap[0], 'end': gap[1], 'party': '', 'gap': True,
                          'note': 'Kaynak tabloda seçilmiş cumhurbaşkanı yok; ' + ('askerî yönetim dönemi.' if mil else 'görev vekâleten yürütüldü.')})
    pres_full.append(p)
# 1980: 6 Nisan – 12 Eylül vekâlet, 12 Eylül 1980 – 9 Kasım 1982 askerî yönetim (devlet başkanı: MGK Başkanı Kenan Evren).
# 12 Eylül 1980: 43. hükûmetin bitişi (hükûmetler listesi); Evren'in önceki görevi: MGK Başkanı (cumhurbaşkanları listesi).
fixed = []
for p in pres_full:
    if p.get('gap') and p['start'] == '1980-04-06':
        fixed.append({'name': 'Vekâleten', 'start': '1980-04-06', 'end': '1980-09-12', 'party': '', 'gap': True, 'note': 'Kaynak tabloda seçilmiş cumhurbaşkanı yok; görev vekâleten yürütüldü.'})
        fixed.append({'name': 'Askerî yönetim — Kenan Evren (Millî Güvenlik Konseyi Başkanı)', 'start': '1980-09-12', 'end': '1982-11-09', 'party': '', 'gap': True, 'note': '12 Eylül 1980 askerî darbesinden sonra devlet başkanlığı.'})
    elif p.get('gap') and p['start'] == '1960-05-27':
        p['name'] = 'Askerî yönetim — Cemal Gürsel (Millî Birlik Komitesi Başkanı)'; p['note'] = '27 Mayıs 1960 askerî darbesinden sonra devlet başkanlığı.'; fixed.append(p)
    else:
        if p['party'] == 'Bağımsız Adalet ve Kalkınma Partisi': p['party'] = 'Bağımsız / Adalet ve Kalkınma Partisi'
        fixed.append(p)
pres_full = fixed

# ------------------------------------------------------------------ meclis sandalye dağılımı (seçim sonrası)
idx = json.load(open(os.path.join(ROOT, 'data', 'index.json')))
# Osmanlı sadrazamları (1876–1922): listedeki ikinci (ayrıntılı) tablo esas; eksikler ilk tablodan
from infobox import dates as _dates
_L = open(os.path.join(W, 'sadrazamlar.txt')).read().split('\n')
_rows = []
for i, l in enumerate(_L[:-2]):
    m = re.match(r'\|\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', l)
    d1, d2 = _dates(_L[i + 1]), _dates(_L[i + 2])
    if m and d1 and d2 and d1[0] >= '1876':
        _rows.append({'name': (m.group(2) or m.group(1)).strip(), 'start': d1[0], 'end': d2[0]})
viziers = {}
for r in _rows:     # ayrıntılı tablo 31 Mart Vakası'nı Rumi tarihle yazmış (31 Mart 1325 = 13 Nisan 1909)
    for k in ('start', 'end'):
        if r[k] == '1909-03-31': r[k] = '1909-04-13'
    viziers[r['start']] = r          # aynı başlangıç: sonraki (ayrıntılı) tablo kazanır
viziers = sorted(viziers.values(), key=lambda r: r['start'])
parl = []
# 1877–1920: Meclis-i Mebusan ve I. TBMM (sitenin seçim verisinden; gruplama kaynağın sınıflandırmasıdır)
for eid, basis in (('1877-1', 'dinî mensubiyet'), ('1877-2', 'dinî mensubiyet'), ('1908', 'etnik mensubiyet (Vikipedi listesi)'),
                   ('1912', 'siyasi mensubiyet (Vikipedi listesi)'), ('1914', 'siyasi mensubiyet (Vikipedi listesi)'), ('1919', None), ('1920', None)):
    d = json.load(open(os.path.join(ROOT, 'data', 'elections', eid + '.json')))
    n = d['national']; tot = n.get('members_initial') or 0
    seats = dict(n.get('seats') or {}) or {('Grupsuz (henüz grup yok)' if eid == '1920' else 'Grup dağılımı derlenmedi'): tot}
    parl.append({'id': eid, 'date': d['date'], 'total': sum(seats.values()), 'seats': seats, 'basis': basis or 'grup verisi derlenmedi',
                 'listed': True, 'source': 'data/elections/%s.json' % eid})
# 1923–1946: seçim maddelerinin bilgi kutuları ve 1946 sonuç tablosu
EARLY = [
    ('1923', '1923-06-28', 286, {'Müdâfaa-i Hukuk (Birinci Grup)': 285, 'Bağımsız': 1}, '1923 Türkiye genel seçimleri'),
    ('1927', '1927-09-01', 335, {'Cumhuriyet Halk Fırkası': 335}, '1927 Türkiye genel seçimleri'),
    ('1931', '1931-04-25', 317, {'Cumhuriyet Halk Fırkası': 287, 'Bağımsız': 20, 'Boş': 10}, '1931 Türkiye genel seçimleri'),
    ('1935', '1935-02-08', 444, {'Cumhuriyet Halk Partisi': 401, 'Belirtilmemiş': 43}, '1935 Türkiye genel seçimleri'),
    ('1939', '1939-03-26', 470, {'Cumhuriyet Halk Partisi': 466, 'Belirtilmemiş': 4}, '1939 Türkiye genel seçimleri'),
    ('1943', '1943-02-28', 492, {'Cumhuriyet Halk Partisi': 488, 'Belirtilmemiş': 4}, '1943 Türkiye genel seçimleri'),
    ('1946', '1946-07-21', 465, {'Cumhuriyet Halk Partisi': 397, 'Demokrat Parti': 64, 'Bağımsız': 4}, '1946 Türkiye genel seçimleri'),
]
for eid, date, total, seats, page in EARLY:
    parl.append({'id': eid, 'date': date, 'total': total, 'seats': seats, 'source': WIKI + page.replace(' ', '_')})
for e in idx:
    if e['type'] != 'genel' or e['date'] < '1950':
        continue
    d = json.load(open(os.path.join(ROOT, 'data', 'elections', e['id'] + '.json')))
    seats = {k: v for k, v in (d['national'].get('seats') or {}).items() if v}
    if not seats:
        continue
    names = d.get('partyNames') or {}
    parl.append({'id': e['id'], 'date': e['date'], 'total': d['national'].get('total_seats') or sum(seats.values()),
                 'seats': {names.get(k, k) if k not in ('Bağımsız',) else 'Bağımsız': v for k, v in seats.items()},
                 'keys': {names.get(k, k): k for k in seats}, 'source': 'data/elections/%s.json' % e['id']})

# Dönem içi değişiklikler (seçimle değil, parti kuruluşu/kapanışıyla): yaklaşık dağılımlar
TCF_SRC = WIKI + 'Terakkiperver_Cumhuriyet_Fırkası'
SCF_SRC = WIKI + 'Serbest_Cumhuriyet_Fırkası'
II_SRC = 'https://en.wikipedia.org/wiki/Second_Group_(Turkey)'
INTERIM = [
    {'id': '1920', 'date': '1921-05-10', 'seats': {'Birinci Grup ve grupsuzlar': 434}, 'source': II_SRC, 'basis': 'Birinci Grubun üye sayısı kaynaklarda yok',
     'change': 'Mustafa Kemal Paşa\'nın önderliğinde Müdâfaa-i Hukuk (Birinci) Grubu kuruldu. Grubun üye sayısı kaynaklarda verilmediği için grupsuzlarla birlikte gösterilir.'},
    {'id': '1920', 'date': '1922-07-22', 'seats': {'Birinci Grup ve grupsuzlar': 371, 'İkinci Grup': 63}, 'source': II_SRC, 'basis': 'İkinci Grup 63 milletvekili (İngilizce Vikipedi)',
     'change': 'Muhalif İkinci Grup kuruldu (63 milletvekili). Kalanlar Birinci Grup ve grupsuzlardır; Birinci Grubun tek başına sayısı bilinmiyor.'},
    {'id': '1923', 'date': '1923-09-09', 'seats': {'Cumhuriyet Halk Fırkası': 285, 'Bağımsız': 1}, 'source': WIKI + 'Cumhuriyet_Halk_Partisi',
     'change': 'Müdâfaa-i Hukuk grubu Halk Fırkası\'na dönüştü (9 Eylül 1923); 1924\'te adı Cumhuriyet Halk Fırkası oldu.'},
    {'id': '1923', 'date': '1924-11-17', 'seats': {'Cumhuriyet Halk Fırkası': 256, 'Terakkiperver Cumhuriyet Fırkası': 29, 'Bağımsız': 1}, 'source': TCF_SRC,
     'change': 'Terakkiperver Cumhuriyet Fırkası kuruldu; Tunçay\'a göre 29 (Tunaya\'ya göre 28) milletvekili katıldı. Sayılar yaklaşıktır.'},
    {'id': '1923', 'date': '1925-06-05', 'seats': {'Cumhuriyet Halk Fırkası': 256, 'Bağımsız': 30}, 'source': TCF_SRC,
     'change': 'Terakkiperver Cumhuriyet Fırkası kapatıldı; üyeleri dönem sonuna dek partisiz kaldı. Sayılar yaklaşıktır.'},
    {'id': '1927', 'date': '1930-08-12', 'seats': {'Cumhuriyet Halk Fırkası': 320, 'Serbest Cumhuriyet Fırkası': 15}, 'source': SCF_SRC,
     'change': 'Serbest Cumhuriyet Fırkası kuruldu; 15 milletvekiline ulaştı.'},
    {'id': '1927', 'date': '1930-11-17', 'seats': {'Cumhuriyet Halk Fırkası': 320, 'Bağımsız': 15}, 'source': SCF_SRC,
     'change': 'Serbest Cumhuriyet Fırkası kendini feshetti; eski üyeleri partisiz gösterildi. Sayılar yaklaşıktır.'},
]
for x in INTERIM:
    x.update({'total': sum(x['seats'].values()), 'interim': True})
    parl.append(x)
parl.sort(key=lambda l: l['date'])

# ------------------------------------------------------------------ parti soy ağacı
NAMES = ['Siyasi parti bilgi kutusu', 'Kuruluş bilgi kutusu', 'Siyasi ittifak bilgi kutusu']
PARTYLIKE = re.compile(r'(Parti|Fırka|Cemiyet|İttifak|Grup|Hareket|Masa|Kongre)')
parties = []
for line in open(os.path.join(W, 'partiler', 'index.txt')):
    f, title, _ = line.strip().split('|')
    txt = open(os.path.join(W, 'partiler', f + '.txt')).read()
    tpl = find_template(txt, NAMES)
    if not tpl:
        continue
    p = params(tpl)
    g = lambda k: p.get(k, '')
    kd, cd = dates(g('kuruluş')), dates(g('kapanış'))
    rec = {'name': re.sub(r'\s*\(.*?\)$', '', plain(g('isim')) or title), 'title': title, 'short': plain(g('kısaltma')),
           'founded': kd[0] if kd else None, 'foundedNote': plain(g('kuruluş')) if len(kd) > 1 else None,
           'dissolved': cd[0] if cd else None, 'dissolvedNote': plain(g('kapanış')) if len(cd) > 1 else None,
           'alliance': title.endswith('İttifakı'),
           'wiki': WIKI + title.replace(' ', '_')}
    for k, fld in (('predecessors', 'öncülü'), ('successors', 'ardılı'), ('splits', 'bölünme'), ('mergers', 'birleşme'), ('alliances', 'ulusal')):
        v = [x for x in links(g(fld)) if PARTYLIKE.search(x) and x != title]
        if v: rec[k] = v
    for n in range(1, 10):   # bilgi kutusundaki güncel TBMM sandalyesi ({{Composition bar|90|600}})
        if 'Türkiye Büyük Millet Meclisi' in g('sandalye%d_başlık' % n) or plain(g('sandalye%d_başlık' % n)) == 'TBMM':
            m = re.search(r'Composition bar\|\s*([\d.]+)\s*\|\s*([\d.]+)', g('sandalye%d' % n))
            if m: rec['tbmm'] = [int(m.group(1).replace('.', '')), int(m.group(2).replace('.', ''))]
            break
    parties.append(rec)

# Bilgi kutusunda birden çok kuruluş/kapanış tarihi olan partiler: faaliyet dönemleri elle yazılır (maddelerin metnine göre)
PERIODS = {
    'Cumhuriyet Halk Partisi': [['1923-09-09', '1981-10-16'], ['1992-09-09', None]],
    'Milliyetçi Hareket Partisi': [['1969-02-09', '1981-10-16'], ['1993-01-24', None]],
    'Hürriyet ve İtilaf Fırkası': [['1911-11-21', '1913-06'], ['1918-11-17', '1919-06-25']],
    # madde metni: "TİP, 21 Temmuz 1971 tarihinde kapatıldı ... 1975 yılında Genel Başkan Behice Boran önderliğinde yeniden örgütlendi"
    'Türkiye İşçi Partisi (1961)': [['1961-02-13', '1971-07-21'], ['1975', '1981-10-16']],
}
PERIOD_NOTES = {
    'Cumhuriyet Halk Partisi': '12 Eylül sonrası 16 Ekim 1981\'de kapatıldı; 9 Eylül 1992\'de yeniden açıldı.',
    'Milliyetçi Hareket Partisi': 'CKMP\'nin 9 Şubat 1969\'da adını değiştirmesiyle oluştu; 1981\'de kapatıldı. Çizgisini sürdüren Muhafazakâr Parti 1985\'te MÇP, 24 Ocak 1993\'te yeniden MHP adını aldı.',
    'Hürriyet ve İtilaf Fırkası': 'Bâbıâli Baskını (Ocak 1913) sonrası baskı altına girdi; Mahmud Şevket Paşa suikastının (Haziran 1913) ardından yöneticileri sürgün edildi ve faaliyeti durdu. 1918\'de yeniden kuruldu, 1919\'da kapandı.',
    'Türkiye İşçi Partisi (1961)': '12 Mart 1971 muhtırasından sonra 21 Temmuz 1971\'de kapatıldı; 1975\'te Behice Boran önderliğinde yeniden örgütlendi (gün kaynakta yok) ve 12 Eylül sonrası 16 Ekim 1981\'de bütün partilerle birlikte kapatıldı.',
}
seen, uniq = set(), []
for rec in parties:
    key = (rec['name'], rec['founded'])
    if key in seen:   # yönlendirme ile aynı maddeye düşen kayıt (ör. Yeşil Sol Parti → DEM Parti)
        continue
    seen.add(key)
    rec.pop('foundedNote', None); rec.pop('dissolvedNote', None)
    if rec['title'] == 'Yeni Parti (2026)':   # bilgi kutusundaki stilize ad ve kısaltma
        rec['name'], rec['short'] = 'Yeni Parti', 'YENİ Parti'
    rec['periods'] = PERIODS.get(rec['title'], [[rec['founded'], rec['dissolved']]])
    if rec['title'] in PERIOD_NOTES: rec['note'] = PERIOD_NOTES[rec['title']]
    if rec['title'] in PERIODS: rec['dissolved'] = rec['periods'][-1][1]
    uniq.append(rec)
parties = uniq

# ad değişiklikleri (parti maddelerinin metninden; yalnız tarihi kaynakta geçenler)
RENAMES = [
    {'date': '1924', 'from': 'Halk Fırkası', 'to': 'Cumhuriyet Halk Fırkası', 'party': 'Cumhuriyet Halk Partisi', 'note': 'Kuruluştan kısa süre sonra'},
    {'date': '1935', 'from': 'Cumhuriyet Halk Fırkası', 'to': 'Cumhuriyet Halk Partisi', 'party': 'Cumhuriyet Halk Partisi', 'note': '4. Kurultay'},
    {'date': '1969-02-09', 'from': 'Cumhuriyetçi Köylü Millet Partisi', 'to': 'Milliyetçi Hareket Partisi', 'party': 'Milliyetçi Hareket Partisi', 'kaynak': 'CKMP bilgi kutusundaki kapanış tarihi; madde: "1969\'da Milliyetçi Hareket Partisi adını almıştır"'},
    {'date': '1971-01-29', 'from': 'Güven Partisi', 'to': 'Millî Güven Partisi', 'party': 'Cumhuriyetçi Güven Partisi'},
    {'date': '1973-03-03', 'from': 'Millî Güven Partisi + Cumhuriyetçi Parti', 'to': 'Cumhuriyetçi Güven Partisi', 'party': 'Cumhuriyetçi Güven Partisi', 'note': 'Birleşme'},
    {'date': '1985-11-30', 'from': 'Muhafazakâr Parti', 'to': 'Milliyetçi Çalışma Partisi', 'party': 'Milliyetçi Çalışma Partisi'},
    {'date': '1993-01-24', 'from': 'Milliyetçi Çalışma Partisi', 'to': 'Milliyetçi Hareket Partisi', 'party': 'Milliyetçi Hareket Partisi'},
    {'date': '2001-11-11', 'from': 'Sosyalist İktidar Partisi', 'to': 'Türkiye Komünist Partisi', 'party': 'Türkiye Komünist Partisi (2001)', 'kaynak': 'Bilgi kutusu: 16 Ağustos 1993\'te Sosyalist İktidar Partisi olarak kuruldu'},
    {'date': '2007-05-27', 'from': 'Doğru Yol Partisi', 'to': 'Demokrat Parti', 'party': 'Demokrat Parti (2007)', 'note': 'DYP\'nin kapanışı ile DP\'nin kuruluşu aynı gün'},
    {'date': '2023-10-15', 'from': 'Yeşiller ve Sol Gelecek Partisi', 'to': 'Halkların Eşitlik ve Demokrasi Partisi', 'party': 'Halkların Eşitlik ve Demokrasi Partisi',
     'note': '2016\'dan itibaren kısa adı Yeşil Sol Parti; yeni adın HEDEP kısaltması Yargıtay\'ın itirazı üzerine DEM Parti oldu',
     'kaynak': 'Bilgi kutusu: 30 Kasım 2012\'de Yeşiller ve Sol Gelecek Partisi olarak kuruldu; madde metni (2016 kongresi, HEDEP kısaltması)'},
]


def name_at(pr, date):
    """Partinin verilen tarihteki adı: ad değişikliklerinden önce kuruluş adı (ör. 1923'te Halk Fırkası)."""
    rs = sorted((r for r in RENAMES if r['party'] == pr['title']), key=lambda r: r['date'])
    if not rs or not date: return pr['name']
    past = [r for r in rs if r['date'] <= date]
    if not past: return rs[0]['from'].split(' + ')[0]
    return pr['name'] if past[-1] is rs[-1] else past[-1]['to']


# ------------------------------------------------------------------ olaylar (zaman çizelgesi ve animasyon)
# Ad değişikliği olan günlerde aynı partinin "kuruldu" ve eski adının "kapandı" olayları yinelenmez (ör. DYP → DP, 2007)
renamed_to = {(r['party'], r['date']) for r in RENAMES}
renamed_from = {(f, r['date']) for r in RENAMES for f in r['from'].split(' + ')}
events = []
for pr in parties:
    if pr['alliance']:
        if pr['founded']: events.append({'date': pr['founded'], 'type': 'ittifak', 'text': '%s kuruldu' % pr['name']})
        continue
    for i, (f0, f1) in enumerate(pr['periods']):
        if f0 and f0 >= '1908' and (pr['title'], f0) not in renamed_to:
            events.append({'date': f0, 'type': 'kuruluş', 'text': '%s %s' % (name_at(pr, f0), 'yeniden kuruldu' if i else 'kuruldu'), 'party': pr['title']})
        if f1 and f1 != '1981-10-16' and (pr['name'], f1) not in renamed_from:   # 16 Ekim 1981 ortak kapanışı aşağıda tek olay olarak
            events.append({'date': f1, 'type': 'kapanış', 'text': '%s kapandı / kapatıldı' % name_at(pr, f1), 'party': pr['title']})
for rn in RENAMES:
    events.append({'date': rn['date'], 'type': 'ad değişikliği', 'text': '%s → %s' % (rn['from'], rn['to']), 'party': rn['party']})
for g in govs:
    if not g['start']: continue
    who = g['head']
    t = '%s kuruldu (%s%s)' % (g['name'], who, ', ' + ' + '.join(p['name'] for p in g['parties'] if p['name'] not in ('Bağımsızlar',)) if g['kind'] == 'koalisyon' else '')
    events.append({'date': g['start'], 'type': 'hükûmet', 'text': t})
    if g['confidence'].get('failed'):
        events.append({'date': g['start'], 'type': 'güvenoyu', 'text': '%s güvenoyu alamadı (%s)' % (g['name'], g['confidence']['text'])})
    if g['kind'] == 'askerî':
        pass
for p in pres:
    events.append({'date': p['start'], 'type': 'cumhurbaşkanı', 'text': '%s cumhurbaşkanı oldu' % p['name']})
events.append({'date': '1960-05-27', 'type': 'darbe', 'text': '27 Mayıs 1960 askerî darbesi (Bayar\'ın görevi sona erdi; Millî Birlik Komitesi yönetimi)'})
events.append({'date': '1980-09-12', 'type': 'darbe', 'text': '12 Eylül 1980 askerî darbesi (43. hükûmet ve Cumhuriyet Senatosu sona erdi; Millî Güvenlik Konseyi yönetimi)'})
closed81 = [pr['short'].split()[0] if pr.get('short') else pr['name'] for pr in parties if any(x[1] == '1981-10-16' for x in pr['periods'])]
events.append({'date': '1981-10-16', 'type': 'kapanış', 'text': 'Millî Güvenlik Konseyi bütün siyasi partileri kapattı (%s)' % ', '.join(closed81)})
events.append({'date': '1971-03-12', 'type': 'darbe', 'text': '12 Mart 1971 muhtırası (Demirel hükûmeti istifa etti)'})
events.append({'date': '1997-02-28', 'type': 'darbe', 'text': '28 Şubat 1997 Millî Güvenlik Kurulu kararları (Haziran 1997\'de 54. hükûmet istifa etti)'})
events.append({'date': '2016-07-15', 'type': 'darbe', 'text': '15 Temmuz 2016 darbe girişimi (başarısız oldu)'})
events.append({'date': '2018-07-09', 'type': 'sistem', 'text': 'Cumhurbaşkanlığı hükûmet sistemi yürürlüğe girdi; başbakanlık kaldırıldı'})
# Vekâleten görev yapanlar (Anayasa gereği Meclis/Senato başkanı)
ACTING = {'1938-11-10': 'Abdülhalik Renda (TBMM Başkanı)', '1973-03-28': 'Tekin Arıburun (Cumhuriyet Senatosu Başkanı)',
          '1980-04-06': 'İhsan Sabri Çağlayangil (Cumhuriyet Senatosu Başkanı)', '1993-04-17': 'Hüsamettin Cindoruk (TBMM Başkanı)'}
for p in pres_full:
    if p['name'] == 'Vekâleten' and p['start'] in ACTING:
        p['name'] = 'Vekâleten — ' + ACTING[p['start']]
# Osmanlı ve erken Cumhuriyet dönemi kurumsal olayları
SULTANS = [{'name': 'I. Abdülmecid', 'start': '1839-07-02', 'end': '1861-06-25'}, {'name': 'Abdülaziz', 'start': '1861-06-25', 'end': '1876-05-30'},
           {'name': 'V. Murad', 'start': '1876-05-30', 'end': '1876-08-31'}, {'name': 'II. Abdülhamid', 'start': '1876-08-31', 'end': '1909-04-27'},
           {'name': 'V. Mehmed Reşad', 'start': '1909-04-27', 'end': '1918-07-03'}, {'name': 'VI. Mehmed Vahdeddin', 'start': '1918-07-04', 'end': '1922-11-01'}]
for su in SULTANS:
    if su['start'] >= '1876':
        events.append({'date': su['start'], 'type': 'padişah', 'text': '%s tahta çıktı' % su['name']})
for d, t, x in [
    ('1876-12-23', 'sistem', 'Kanun-i Esasi ilan edildi (I. Meşrutiyet)'),
    ('1877-03-19', 'sistem', 'Meclis-i Umumi (Meclis-i Mebusan ve Âyan) ilk kez toplandı'),
    ('1878-02-14', 'sistem', 'II. Abdülhamid Meclis-i Mebusan\'ı süresiz tatil etti'),
    ('1908-07-23', 'sistem', 'II. Meşrutiyet ilan edildi'),
    ('1908-12-17', 'sistem', 'Meclis-i Mebusan yeniden açıldı'),
    ('1909-04-13', 'olay', '31 Mart Vakası'),
    ('1913-01-23', 'darbe', 'Bâbıâli Baskını'),
    ('1918-10-30', 'olay', 'Mondros Mütarekesi imzalandı'),
    ('1918-12-21', 'sistem', 'VI. Mehmed Meclis-i Mebusan\'ı feshetti'),
    ('1920-01-12', 'sistem', 'Son Meclis-i Mebusan İstanbul\'da açıldı'),
    ('1920-01-28', 'olay', 'Misak-ı Millî Meclis-i Mebusan\'da kabul edildi'),
    ('1920-03-16', 'olay', 'İstanbul İtilaf Devletlerince resmen işgal edildi'),
    ('1920-04-23', 'sistem', 'Büyük Millet Meclisi Ankara\'da açıldı'),
    ('1921-01-20', 'sistem', 'Teşkilât-ı Esasiye Kanunu kabul edildi'),
    ('1921-05-10', 'olay', 'TBMM\'de Müdâfaa-i Hukuk (Birinci) Grubu kuruldu'),
    ('1922-07-22', 'olay', 'Muhalif İkinci Grup kuruldu (63 milletvekili)'),
    ('1922-11-01', 'sistem', 'Saltanat kaldırıldı'),
    ('1923-10-29', 'sistem', 'Cumhuriyet ilan edildi'),
    ('1924-03-03', 'sistem', 'Halifelik kaldırıldı'),
    ('1924-04-20', 'sistem', '1924 Anayasası (Teşkilât-ı Esasiye) kabul edildi'),
    ('1934-12-05', 'sistem', 'Kadınlara milletvekili seçme ve seçilme hakkı tanındı'),
    ('1961-07-09', 'sistem', '1961 Anayasası halkoylamasıyla kabul edildi'),
    ('1982-11-07', 'sistem', '1982 Anayasası halkoylamasıyla kabul edildi'),
    ('1987-09-06', 'sistem', '1980 öncesi siyasetçilere getirilen siyasi yasaklar halkoylamasıyla kaldırıldı'),
    ('2010-09-12', 'sistem', 'Yargı yapısını değiştiren ve bireysel başvuru hakkı getiren anayasa değişikliği halkoylamasıyla kabul edildi'),
    ('2007-10-21', 'sistem', 'Cumhurbaşkanının halk tarafından seçilmesi halkoylamasıyla kabul edildi'),
    ('2017-04-16', 'sistem', 'Cumhurbaşkanlığı hükûmet sistemi halkoylamasıyla kabul edildi'),
    ('2026-05-21', 'olay', 'Ankara Bölge Adliye Mahkemesi\'nin CHP 38. Olağan Kurultayı hakkındaki "mutlak butlan" kararıyla Özgür Özel\'in CHP genel başkanlığı sona erdi')]:
    events.append({'date': d, 'type': t, 'text': x})
events.sort(key=lambda e: e['date'])

# parti tam adı -> renk anahtarı (data/parties.json) eşlemesi
from party_names import NAMES as PN
name_keys = {}
for k, v in PN.items():
    for n in ([v] if isinstance(v, str) else [x[2] for x in v]):
        name_keys.setdefault(n, k)
name_keys.update({'Cumhuriyet Halk Fırkası': 'CHP', 'Cumhuriyet Halk Partisi': 'CHP', 'Demokrat Parti': 'DP',
                  'Demokrat Parti (2007)': 'DP', 'Millî Selamet Partisi': 'MSP', 'Milli Güven Partisi': 'CGP',
                  'Millî Güven Partisi': 'CGP', 'Güven Partisi': 'GP', 'Bağımsızlar': 'Bağımsız', 'Bağımsız': 'Bağımsız',
                  'Müdâfaa-i Hukuk (Birinci Grup)': 'Müdâfaa-i Hukuk (Birinci Grup)',
                  'Anadolu ve Rumeli Müdâfaa-i Hukuk Cemiyeti': 'Müdâfaa-i Hukuk (Birinci Grup)',
                  'Milliyetçi Hareket Partisi': 'MHP', 'Millet Partisi': 'MP62', 'Yeni Türkiye Partisi': 'YTP61',
                  'Sosyaldemokrat Halkçı Parti': 'SHP', 'Terakkiperver Cumhuriyet Fırkası': 'Terakkiperver Cumhuriyet Fırkası', 'Birinci Grup ve grupsuzlar': 'Müdâfaa-i Hukuk (Birinci Grup)', 'İkinci Grup': 'İkinci Grup', 'Demokratik Parti': 'DEMP73', 'Bağımsız / Adalet ve Kalkınma Partisi': 'AK Parti', 'Yeni Parti': 'Yeni Parti',
                  'İttihat ve Terakki Fırkası': 'İttihat ve Terakki', 'Hürriyet ve İtilaf Fırkası': 'Hürriyet ve İtilaf', 'Osmanlı Ahrar Fırkası': 'Ahrar',
                  'Millî Selâmet Partisi': 'MSP', 'Birlik Partisi': 'TBP73', 'Hürriyet Partisi': 'HP57', 'Serbest Cumhuriyet Fırkası': 'Serbest Cumhuriyet Fırkası'})

hist = {
    'generated': '2026-11-20',
    'sources': [
        {'name': 'Vikipedi: Türkiye hükûmetleri listesi (CC BY-SA 4.0)', 'url': WIKI + 'Türkiye_hükûmetleri_listesi'},
        {'name': 'Vikipedi: Türkiye cumhurbaşkanları listesi (CC BY-SA 4.0)', 'url': WIKI + 'Türkiye_cumhurbaşkanları_listesi'},
        {'name': 'Vikipedi: parti maddelerinin bilgi kutuları (CC BY-SA 4.0)', 'url': WIKI + 'Kategori:Türkiye\'deki_siyasi_partiler'},
        {'name': '1950–2023 sandalyeler: bu sitenin seçim verisi (YSK kaynaklı veri seti)', 'url': 'https://github.com/hamiKumbasae/turkiye-secim-haritasi'},
    ],
    'nameKeys': name_keys,
    'governments': govs, 'presidents': pres_full,
    'viziers': viziers,
    'sultans': SULTANS,
    'tbmmHead': {'name': 'Mustafa Kemal', 'title': 'TBMM Başkanı', 'start': '1920-04-24', 'end': '1923-10-29',
                 'note': 'Saltanatın kaldırılmasına (1 Kasım 1922) dek İstanbul\'da padişah, Ankara\'da TBMM Başkanı vardı; Cumhuriyet\'in ilanına dek devlet başkanlığı yetkisini TBMM Başkanı kullandı.'}, 'parliament': parl, 'parties': parties, 'renames': RENAMES, 'events': events,
}
json.dump(hist, open(os.path.join(ROOT, 'data', 'history.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('hükûmet', len(govs), 'cumhurbaşkanı', len(pres_full), 'meclis', len(parl), 'parti', len(parties), 'olay', len(events))

# ------------------------------------------------------------------ demografi
def num(t):
    t = (t or '').replace('.', '').replace(',', '').replace(' ', '').strip()
    return int(t) if re.fullmatch(r'\d+', t) else None
def fnum(t, comma_decimal=False):
    t = (t or '').strip().replace('−', '-')
    t = t.replace('.', '').replace(',', '.') if comma_decimal else t.replace(',', '')
    try: return float(t)
    except ValueError: return None

def norm(n):
    n = n.replace('İ', 'i').replace('I', 'ı').lower()
    return {'istanbul': 'istanbul', 'ıstanbul': 'istanbul', 'afyon': 'afyonkarahisar', 'k.maraş': 'kahramanmaraş', 'icel': 'mersin'}.get(n, n)

# plaka <- güncel il adı (bu sitenin 2023 verisinden)
cur = json.load(open(os.path.join(ROOT, 'data', 'elections', '2023.json')))
plaka_of = {norm(re.sub(r'\s*\(.*', '', u['name'])): k for k, u in cur['units'].items()}
def plaka(n):
    n = norm(wplain(n)).strip()
    n = {'i̇stanbul': 'istanbul'}.get(n, n)
    return plaka_of.get(n) or plaka_of.get(n.replace('â', 'a').replace('î', 'i'))

prov = {}
tbl = parse_tables(open(os.path.join(W, 'demografi', 'il_nufus.txt')).read())[0]
years = [c['text'] for c in tbl[1]][2:14]
for r in tbl[2:]:
    pk = plaka(r[1]['text'])
    if not pk: continue
    prov.setdefault(pk, {'name': cur['units'][pk]['name']})['pop'] = {y: num(r[2 + i]['text']) for i, y in enumerate(years) if num(r[2 + i]['text'])}
tbl = parse_tables(open(os.path.join(W, 'demografi', 'iller.txt')).read())[0]
for r in tbl[1:]:
    pk = plaka(r[0]['text'])
    if pk in prov:
        a = num(r[4]['text'])
        if a: prov[pk]['area'] = a
tbls = parse_tables(open(os.path.join(W, 'demografi', 'en_gsyh.txt')).read())
for r in tbls[1][2:]:
    pk = plaka(r[1]['text'])
    v = fnum(r[3]['text'])
    if pk in prov and v: prov[pk]['gdppc_usd_2024'] = v
le = parse_tables(open(os.path.join(W, 'demografi', 'en_yasam_beklentisi.txt')).read())[0]
for r in le[2:]:
    pk = plaka(r[0]['text'])
    v = fnum(r[11]['text']) if len(r) > 11 else None
    if pk in prov and v: prov[pk]['life_2021_2023'] = v
missing = [k for k in cur['units'] if k not in prov]

# eski sınır dönemleri: günümüz ili -> o dönemdeki il (il merkezinin temsilî noktasıyla)
modern = {f['properties']['id']: shape(f['geometry']).representative_point()
          for f in json.load(open(os.path.join(ROOT, 'build', 'geo-src', 'tr-modern.geojson')))['features']}
era_map = {}
for path in sorted(glob.glob(os.path.join(ROOT, 'build', 'geo-src', 'tr-era*.geojson'))):
    era = os.path.basename(path)[:-8]
    fs = [(f['properties']['id'], shape(f['geometry']).buffer(0)) for f in json.load(open(path))['features']]
    m = {}
    for pk, pt in modern.items():
        hit = next((i for i, s in fs if s.contains(pt)), None)
        if hit is None: hit = min(fs, key=lambda t: t[1].distance(pt))[0]
        m[pk] = hit
    era_map[era] = m

demo = {'provinces': prov, 'eraMap': era_map, 'censusYears': years,
        'indicators': {
            'pop': 'Nüfus (seçimden önceki en yakın sayım)',
            'density': 'Nüfus yoğunluğu (kişi/km², güncel il alanlarıyla)',
            'growth': 'Önceki sayıma göre yıllık nüfus artışı (%) — göçün dolaylı göstergesi',
            'gdppc': 'Kişi başına GSYH (ABD doları, 2024)',
            'life': 'Doğuşta yaşam beklentisi (yıl, 2021–2023)'},
        'notes': ['Nüfuslar günümüz il sınırlarına göredir; il sınırları değişmiş eski seçimlerde günümüz illeri o dönemin illerine toplanır.',
                  'Kişi başı GSYH ve yaşam beklentisi tek bir döneme aittir; yalnız 81 ilin bulunduğu 2002 ve sonrası seçimlerle karşılaştırılır.',
                  'İl bazında kentleşme ve göç verisi bu kaynaklarda yoktur; nüfus artış hızı göçün dolaylı bir göstergesi olarak verilir.',
                  'Korelasyon nedensellik göstermez.'],
        'sources': [
            {'name': 'Vikipedi: Nüfusuna göre Türkiye\'nin illeri (sayımlar 1927–2025; TÜİK)', 'url': WIKI + 'Nüfusuna_göre_Türkiye\'nin_illeri'},
            {'name': 'Vikipedi: Türkiye\'nin illeri (yüzölçümü)', 'url': WIKI + 'Türkiye\'nin_illeri'},
            {'name': 'Wikipedia: List of Turkish provinces by GDP (2024; TÜİK)', 'url': ENWIKI + 'List_of_Turkish_provinces_by_GDP'},
            {'name': 'Wikipedia: List of Turkish provinces by life expectancy (2021–2023; TÜİK)', 'url': ENWIKI + 'List_of_Turkish_provinces_by_life_expectancy'}]}
json.dump(demo, open(os.path.join(ROOT, 'data', 'demographics.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('demografi il', len(prov), 'eksik', missing, 'GSYH', sum('gdppc_usd_2024' in v for v in prov.values()),
      'yaşam', sum('life_2021_2023' in v for v in prov.values()), 'alan', sum('area' in v for v in prov.values()), 'sayım yılları', years)
