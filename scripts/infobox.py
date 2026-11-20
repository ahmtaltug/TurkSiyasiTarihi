"""Vikipedi bilgi kutusu (infobox) ayrıştırıcı: şablon parametrelerini iç içe {{ }} ve [[ ]] yapılarına dikkat ederek okur."""
import re

AYLAR = {'Ocak': 1, 'Şubat': 2, 'Mart': 3, 'Nisan': 4, 'Mayıs': 5, 'Haziran': 6, 'Temmuz': 7, 'Ağustos': 8,
         'Eylül': 9, 'Ekim': 10, 'Kasım': 11, 'Aralık': 12}


def find_template(text, names):
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', text, flags=re.S)
    m = re.search(r'\{\{\s*(' + '|'.join(re.escape(n) for n in names) + r')[ \t]*[\n|]', text, flags=re.I)
    if not m:
        return None
    i, depth = m.start(), 0
    while i < len(text):
        if text.startswith('{{', i):
            depth += 1; i += 2; continue
        if text.startswith('}}', i):
            depth -= 1; i += 2
            if depth == 0:
                return text[m.start() + 2:i - 2]
            continue
        i += 1
    # dengesiz parantez: satır başındaki ilk '}}' şablonun sonu sayılır
    j = text.find('\n}}', m.start())
    return text[m.start() + 2:j] if j > 0 else None


def params(tpl):
    out, cur, depth, i = [], '', 0, 0
    while i < len(tpl):
        two = tpl[i:i + 2]
        if two in ('{{', '[['):
            depth += 1; cur += two; i += 2; continue
        if two in ('}}', ']]'):
            depth -= 1; cur += two; i += 2; continue
        if tpl[i] == '|' and depth == 0:
            out.append(cur); cur = ''; i += 1; continue
        cur += tpl[i]; i += 1
    out.append(cur)
    d = {}
    for p in out[1:]:
        if '=' in p:
            k, v = p.split('=', 1)
            d[k.strip()] = v.strip()
    return d


def links(v):
    """Değerdeki [[madde|etiket]] bağlantılarının madde adları (dosya/kategori hariç)."""
    return [m.group(1).strip() for m in re.finditer(r'\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]', v or '')
            if not re.match(r'(Dosya|File|Kategori|Resim):', m.group(1))]


def dates(v):
    """Değerdeki tarihleri ISO (YYYY-AA-GG / YYYY-AA / YYYY) olarak, geçtikleri sırayla döndürür."""
    out = []
    for m in re.finditer(r'\{\{\s*(?:Açılış tarihi ve yaşı|Başlangıç tarihi ve yaşı|Başlangıç tarihi|Bitiş tarihi|Tarih|Start date|End date)[^|}]*\|\s*(\d{4})\s*(?:\|\s*(\d{1,2}))?\s*(?:\|\s*(\d{1,2}))?', v or '', flags=re.I):
        y, mo, da = m.group(1), m.group(2), m.group(3)
        out.append((m.start(), y + ('-%02d' % int(mo) if mo else '') + ('-%02d' % int(da) if da else '')))
    for m in re.finditer(r'(\d{1,2})\s+(' + '|'.join(AYLAR) + r')\s+(\d{4})', v or ''):
        out.append((m.start(), '%s-%02d-%02d' % (m.group(3), AYLAR[m.group(2)], int(m.group(1)))))
    if not out:
        for m in re.finditer(r'\b(1[89]\d{2}|20[0-2]\d)\b', v or ''):
            out.append((m.start(), m.group(1)))
    return [d for _, d in sorted(out)]


def plain(v):
    v = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', v or '', flags=re.S)
    v = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', v)
    v = re.sub(r'\{\{[^{}]*\}\}', '', v)
    v = re.sub(r'<[^>]+>', ' ', v)
    return re.sub(r'\s+', ' ', v).strip()
