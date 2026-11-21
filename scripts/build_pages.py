#!/usr/bin/env python3
"""Arama motorları için her seçime ayrı, JavaScript gerektirmeyen bir sayfa üretir.

Uygulama tek sayfalıktır ve seçimler adresin # kısmıyla açılır (#e=1977); arama motorları bunları ayrı sayfa olarak
dizine almaz. Bu betik yayın sırasında (GitHub Actions, .github/workflows/pages.yml) çalışır ve şunları yazar:
  <çıktı>/secim/index.html          bütün seçimlerin listesi
  <çıktı>/secim/<kimlik>/index.html  seçim sayfası: açıklama, ülke geneli sonuç, il il tablo, kaynaklar, haritada aç
  <çıktı>/sitemap.xml (proje sitesi alt dizinde olduğu için robots.txt okunmaz; site haritası Search Console'a bildirilir)
Sayfalar depoya işlenmez; veri değişince (ör. her gün güncel durum) yayınla birlikte yeniden üretilir.
Kullanım: python3 scripts/build_pages.py _site
"""
import html, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '_site')
SITE = 'https://ahmtaltug.github.io/TurkiyeSecimAtlasi/'
D = lambda *p: os.path.join(ROOT, 'data', *p)
index = json.load(open(D('index.json'), encoding='utf-8'))
parties = json.load(open(D('parties.json'), encoding='utf-8'))
TYPE = {'genel': 'Genel seçim', 'yerel': 'Yerel seçim', 'cumhurbaskanligi': 'Cumhurbaşkanlığı seçimi', 'referandum': 'Halkoylaması',
        'senato': 'Cumhuriyet Senatosu seçimi', 'guncel': 'Güncel durum', 'ara': 'Ara seçim'}
e = html.escape


def pct(v):
    return '–' if v is None else '%' + ('%.1f' % v).replace('.', ',')


def num(v):
    return '–' if v is None else format(int(v), ',').replace(',', '.')


def label(k, d):
    full = (d.get('partyNames') or {}).get(k)
    return full or k


def color(k):
    return (parties.get(k) or {}).get('c', '#9aa0a8')


CSS = """body{font:16px/1.55 system-ui,-apple-system,'Segoe UI',Inter,sans-serif;color:#1f2328;background:#f6f5f2;margin:0}
main{max-width:920px;margin:0 auto;padding:24px 18px 60px}a{color:#8d1c1c}h1{font-size:30px;line-height:1.2;margin:8px 0}
.top{font-size:14px}.muted{color:#5f6670}.cta{display:inline-block;background:#8d1c1c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin:10px 0}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px;margin:8px 0 20px}th,td{border-bottom:1px solid #e3e0da;padding:5px 8px;text-align:left}
th{background:#efede8}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:baseline}
.note{background:#fff;border-left:3px solid #c9c4b9;padding:8px 12px;font-size:14px}ul.idx{columns:2;padding-left:18px}details{margin:4px 0}
footer{margin-top:40px;font-size:13px;color:#5f6670}"""


def page(title, desc, canonical, body, extra_head=''):
    return f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{e(canonical)}">
<meta property="og:type" content="article"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(canonical)}"><meta property="og:image" content="{SITE}icons/og.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml"><style>{CSS}</style>{extra_head}</head>
<body><main>{body}
<footer>Türkiye Seçim Atlası · veri CC BY-SA 4.0 (kaynaklar sayfada) · kod MIT · <a href="https://github.com/ahmtaltug/TurkiyeSecimAtlasi">kaynak kod</a></footer>
</main></body></html>
"""


def national_rows(d):
    n = d.get('national') or {}
    if n.get('pct'):
        rows = [(k, v, (n.get('seats') or {}).get(k)) for k, v in n['pct'].items() if k != 'Diğer']
        rows.sort(key=lambda r: -r[1])
        has_seats = any(r[2] for r in rows)
        h = '<table><thead><tr><th>Parti / seçenek</th><th class="n">Oy oranı</th>' + ('<th class="n">Sandalye</th>' if has_seats else '') + '</tr></thead><tbody>'
        for k, v, s in rows[:15]:
            h += f'<tr><td><span class="sw" style="background:{color(k)}"></span>{e(label(k, d))}</td><td class="n">{pct(v)}</td>' + (f'<td class="n">{num(s) if s else "–"}</td>' if has_seats else '') + '</tr>'
        return h + '</tbody></table>'
    if n.get('seats'):
        rows = sorted(((k, v) for k, v in n['seats'].items() if v), key=lambda r: -r[1])
        lab = 'Sandalye' if d.get('type') == 'guncel' else 'Listedeki vekil' if d.get('metric') == 'members' else 'Sayı'
        h = f'<table><thead><tr><th>{e(d.get("groupLabel") or "Grup")}</th><th class="n">{lab}</th></tr></thead><tbody>'
        for k, v in rows:
            h += f'<tr><td><span class="sw" style="background:{color(k)}"></span>{e(label(k, d))}</td><td class="n">{num(v)}</td></tr>'
        return h + '</tbody></table>'
    return ''


def unit_rows(d):
    units = [u for u in d['units'].values() if not u.get('nodata')]
    if not units:
        return ''
    units.sort(key=lambda u: u['name'])
    votes = any(u.get('pct') for u in units)
    members = any(u.get('members') for u in units)
    turnout = any(u.get('turnout') is not None for u in units)
    unit = 'Vilayet / sancak' if d.get('era') == 'osmanli' else 'İl'
    h = f'<table><thead><tr><th>{unit}</th><th>Birinci</th>' + ('<th class="n">Oranı</th>' if votes else '') + \
        ('<th class="n">Vekil</th>' if members else '') + ('<th class="n">Katılım</th>' if turnout else '') + '</tr></thead><tbody>'
    for u in units:
        w = u.get('winner')
        h += f'<tr><td>{e(u["name"])}</td><td>' + (f'<span class="sw" style="background:{color(w)}"></span>{e(label(w, d))}' if w else '–') + '</td>'
        if votes:
            h += f'<td class="n">{pct((u.get("pct") or {}).get(w)) if w else "–"}</td>'
        if members:
            h += f'<td class="n">{num(u.get("total"))}</td>'
        if turnout:
            h += f'<td class="n">{pct(u.get("turnout"))}</td>'
        h += '</tr>'
    h += '</tbody></table>'
    if members:
        h += '<h2>Vekiller</h2>' + ''.join(
            f'<details><summary>{e(u["name"])} ({len(u["members"])})</summary><p>' + ', '.join(e(m['n']) + (f' <span class="muted">({e(m["g"])})</span>' if m.get('g') else '') for m in u['members']) + '</p></details>'
            for u in units if u.get('members'))
    return h


def summary(d):
    n = d.get('national') or {}
    if n.get('pct'):
        top = sorted(((k, v) for k, v in n['pct'].items() if k != 'Diğer'), key=lambda r: -r[1])[:4]
        return 'Ülke geneli: ' + ', '.join(f'{label(k, d)} {pct(v)}' for k, v in top) + '.'
    return ''


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


urls = [(SITE, None), (SITE + 'secim/', None)]
items = []
for meta in index:
    d = json.load(open(D('elections', meta['id'] + '.json'), encoding='utf-8'))
    eid = meta['id']
    url = f'{SITE}secim/{eid}/'
    title = f"{d['title']} sonuçları{' (il il)' if d.get('units') else ''} | Türkiye Seçim Atlası"
    sm = summary(d)
    desc = sm or d.get('description') or f"{d['title']}: döneminin sınırlarıyla harita, sonuçlar ve kaynaklar."
    if len(desc) > 158:                       # arama sonuçlarında görünen uzunluk
        desc = desc[:155].rsplit(' ', 1)[0].rstrip(',;:') + '…'
    date = d.get('dateLabel') or meta.get('dateLabel') or d['date']
    body = f'<p class="top"><a href="../../">Türkiye Seçim Atlası</a> › <a href="../">Bütün seçimler</a></p>'
    body += f'<h1>{e(d["title"])}</h1><p class="muted">{e(date)} · {e(TYPE.get(d["type"], d["type"]))}' + (f' · {e(d["subtitle"])}' if d.get('subtitle') else '') + '</p>'
    body += f'<a class="cta" href="../../#e={e(eid)}">Etkileşimli haritada aç →</a>'
    if d.get('description'):
        body += f'<p>{e(d["description"])}</p>'
    if d.get('reliability'):
        body += f'<p class="note"><b>Veri güvenilirliği — {e(d["reliability"]["label"])}:</b> {e(d["reliability"]["why"])}</p>'
    nat = national_rows(d)
    if nat:
        body += '<h2>Ülke geneli</h2>' + nat
    ur = unit_rows(d)
    if ur:
        body += '<h2>İl il sonuçlar</h2>' + ur
    if d.get('notes'):
        body += '<h2>Notlar</h2>' + ''.join(f'<p class="note">{e(x)}</p>' for x in d['notes'] if x)
    if d.get('sources'):
        body += '<h2>Kaynaklar</h2><ul>' + ''.join(f'<li><a href="{e(s["url"])}" rel="nofollow">{e(s["name"])}</a></li>' for s in d['sources']) + '</ul>'
    ld = {'@context': 'https://schema.org', '@type': 'Dataset', 'name': d['title'], 'description': desc, 'url': url,
          'temporalCoverage': d['date'], 'spatialCoverage': 'Türkiye', 'inLanguage': 'tr', 'isAccessibleForFree': True,
          'license': 'https://creativecommons.org/licenses/by-sa/4.0/',
          'isPartOf': {'@type': 'WebSite', 'name': 'Türkiye Seçim Atlası', 'url': SITE}}
    head = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    write(os.path.join(OUT, 'secim', eid, 'index.html'), page(title, desc, url, body, head))
    urls.append((url, d['date'] if eid == 'guncel' else None))
    items.append((meta, d))

# liste sayfası
groups = {}
for meta, d in items:
    groups.setdefault(TYPE.get(d['type'], d['type']), []).append((meta, d))
body = '<p class="top"><a href="../">Türkiye Seçim Atlası</a></p><h1>Bütün seçimler: 1840–2026</h1>'
body += '<p>Osmanlı ve Türkiye Cumhuriyeti seçimleri, halkoylamaları ve cumhurbaşkanlığı seçimleri. Her sayfada ülke geneli ve il il sonuçlar, kaynaklar ve etkileşimli haritaya bağlantı vardır.</p>'
body += '<a class="cta" href="../">Etkileşimli atlası aç →</a>'
for g, arr in groups.items():
    body += f'<h2>{e(g)}</h2><ul class="idx">' + ''.join(f'<li><a href="{e(m["id"])}/">{e(d["title"])}</a></li>' for m, d in arr) + '</ul>'
write(os.path.join(OUT, 'secim', 'index.html'), page('Bütün seçimler 1840–2026 | Türkiye Seçim Atlası',
      'Osmanlı ve Türkiye seçimlerinin listesi: genel, yerel, Senato, halkoylaması ve cumhurbaşkanlığı seçimleri; il il sonuçlar ve döneminin sınırlarıyla haritalar.',
      SITE + 'secim/', body).replace('../../favicon.svg', '../favicon.svg'))

# site haritası
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, lm in urls:
    sm.append(f'<url><loc>{e(u)}</loc>' + (f'<lastmod>{lm}</lastmod>' if lm else '') + '</url>')
sm.append('</urlset>')
write(os.path.join(OUT, 'sitemap.xml'), '\n'.join(sm) + '\n')
print('sayfa:', len(items), '+ liste, site haritası', len(urls), 'adres →', OUT)
