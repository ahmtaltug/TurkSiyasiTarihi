"""Minimal MediaWiki wikitable parser: expands rowspan/colspan into a grid.

Each cell is returned as {'raw': wikitext, 'text': plain text, 'style': style attr}.
Only used at build time to read deputy lists from Turkish Wikipedia (CC BY-SA 4.0).
"""
import re

def _split_attrs(cell):
    # "attrs | content" (but not inside [[...]] or {{...}})
    depth = 0
    i = 0
    while i < len(cell):
        two = cell[i:i+2]
        if two in ('[[', '{{'):
            depth += 1; i += 2; continue
        if two in (']]', '}}'):
            depth -= 1; i += 2; continue
        if cell[i] == '|' and depth == 0 and cell[i:i+2] != '||':
            return cell[:i], cell[i+1:]
        i += 1
    return '', cell

def _split_cells(line, sep):
    # split on sep ('||' or '!!') at depth 0
    out, depth, cur, i = [], 0, '', 0
    while i < len(line):
        two = line[i:i+2]
        if two in ('[[', '{{'):
            depth += 1; cur += two; i += 2; continue
        if two in (']]', '}}'):
            depth -= 1; cur += two; i += 2; continue
        if depth == 0 and two == sep:
            out.append(cur); cur = ''; i += 2; continue
        cur += line[i]; i += 1
    out.append(cur)
    return out

def plain(s):
    s = re.sub(r'<ref[^>]*/>', '', s)
    s = re.sub(r'<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\{\{efn[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}', '', s, flags=re.I)
    s = re.sub(r'\{\{[Kk]üçük\|([^{}]*)\}\}', r'\1', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:Dosya|File|Resim|Image):[^\]]*\]\]', '', s)
    s = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'''?", '', s)
    s = re.sub(r'<br\s*/?>', ' / ', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def parse_tables(wikitext):
    tables = []
    for m in re.finditer(r'^\{\|.*?^\|\}', wikitext, flags=re.S | re.M):
        tables.append(parse_table(m.group(0)))
    return tables

def parse_table(src):
    lines = src.split('\n')[1:-1]
    rows, cur = [], None
    raw_rows = []
    for line in lines:
        if line.startswith('|-'):
            if cur is not None: raw_rows.append(cur)
            cur = []
            continue
        if line.startswith('|+'):
            continue
        if cur is None: cur = []
        if line.startswith('!'):
            for c in _split_cells(line[1:], '!!'):
                cur.append(('h', c))
        elif line.startswith('|'):
            for c in _split_cells(line[1:], '||'):
                cur.append(('d', c))
        elif cur:
            k, c = cur[-1]
            cur[-1] = (k, c + '\n' + line)
    if cur: raw_rows.append(cur)
    grid, pending = [], {}  # pending[col] = [remaining, cell]
    for rr in raw_rows:
        row, col = [], 0
        cells = list(rr)
        def fill_pending():
            nonlocal col
            while col in pending:
                rem, cell = pending[col]
                row.append(cell)
                if rem <= 1: del pending[col]
                else: pending[col] = [rem - 1, cell]
                col += 1
        for kind, c in cells:
            fill_pending()
            attrs, content = _split_attrs(c)
            rs = re.search(r'rowspan\s*=\s*"?(\d+)', attrs)
            cs = re.search(r'colspan\s*=\s*"?(\d+)', attrs)
            st = re.search(r'style\s*=\s*"([^"]*)"', attrs)
            rs = int(rs.group(1)) if rs else 1
            cs = int(cs.group(1)) if cs else 1
            cell = {'kind': kind, 'raw': content.strip(), 'text': plain(content), 'style': st.group(1) if st else ''}
            for _ in range(cs):
                row.append(cell)
                if rs > 1: pending[col] = [rs - 1, cell]
                col += 1
        fill_pending()
        if row: grid.append(row)
    return grid
