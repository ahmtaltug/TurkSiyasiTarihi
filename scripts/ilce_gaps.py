"""İlçe haritalarındaki boşlukların doldurulması (scripts/build_ilce.py kullanır).

Kaynak veri seti, seçim tarihinde henüz kurulmamış ilçelerin alanını yalnız ana ilçesi biliniyorsa
(merge_plan.json) o ilçeye katar. Ana ilçesi kaynakta belirsiz olanlar ("unresolved", "unresolved_multi_parent")
haritada boş kalıyordu (ör. 1950'de Araklı: 1953'te Sürmene'den ayrıldı ama kaynakta soyu yok).

Bu modül, bir seçimin birimleri çizildikten sonra hiçbir birimin örtmediği bugünkü ilçeleri bulur ve
seçimdeki bir birime katar:
  1. Kuruluş kanunu ana ilçeleri sayıyorsa (district_lineage.json -> kanunSoyu.eskiIlceler): en çok köy/mahalle
     devreden ana ilçenin o seçimde içinde bulunduğu birim ("kanun").
  2. Değilse: seçim tarihinde aynı ile bağlı komşu birimlerden en uzun ortak sınırı olan ("komşuluk").
Boşluklar komşuluğu değiştirdiği için birer birer, en kesin olandan başlanarak atanır.
Yalnız seçim tarihinden sonra kurulan ilçeler doldurulur; seçimde var olup kaynakta satırı olmayan ilçeler
(ör. 1950 yerelde birkaç il merkezi) "veri yok" olarak boş kalır.
Katılan ilçeler birimin "added" listesine, yöntem "fill" alanına yazılır; çizim bunları taralı gösterir.
"""
from shapely.ops import unary_union
from shapely.strtree import STRtree

COVER_MIN = 0.5          # bir bugünkü ilçenin en az bu kadarı birimlerce örtülüyorsa boşluk sayılmaz
MIN_SHARED = 1e-4        # derece cinsinden ortak sınır (≈10 m): bunun altı komşu sayılmaz


def _shared(a, b):
    """İki alanın ortak sınır uzunluğu (küçük kaymalara karşı tamponla)."""
    try:
        return a.buffer(1e-4).intersection(b.boundary).length
    except Exception:
        return 0.0


# Soy tablosunda kuruluş tarihi olmayan ama kaynak depoda kuruluş kanunu bulunan ilçeler
KURULUS_EK = {
    # data/kaynaklar/resmi_gazete/ilce_kurulus/7033.json özet tablo: "Siirt – Batman (Iluh)"; 7033 sayılı Kanunla
    # kurulan kazalar 1 Eylül 1957'de yürürlüğe girdi (ör. Suluova). 1990'dan beri Batman ilinin merkez ilçesi.
    'TR-D-72-001': '1957-09-01',
}


def founded_after(m, lineage, date):
    """Bugünkü ilçe m seçim tarihinden sonra mı kuruldu? Merkez ilçe dönüşümleri (ör. Seyhan, Yüreğir) ve kuruluş tarihi
    bilinmeyenler hariç: bunların seçim tarihinde zaten var olan bir alanı vardı; satırı kaynakta yoksa boş kalmalı."""
    if m in KURULUS_EK:
        return KURULUS_EK[m] > date
    rec = lineage.get(m) or {}
    k = rec.get('kurulus') or {}
    return bool(k.get('tarih')) and k['tarih'] > date and not k.get('merkezIlce') and not rec.get('merkezIlceDonusumu')


def fill_gaps(unit_geoms, unit_pl, modern, lineage, province_of, label, date):
    """unit_geoms: birim kimliği -> geometri; unit_pl: birim -> plaka (seçim tarihindeki il)
    modern: bugünkü ilçe kimliği -> geometri; lineage: bugünkü ilçe -> district_lineage kaydı
    province_of: bugünkü ilçe -> seçim tarihindeki il plakası (dönemin il sınırından)
    Döner: (birim -> [(ilçe, yöntem)], doldurulamayanlar)"""
    ids = list(unit_geoms)
    tree = STRtree([unit_geoms[i] for i in ids])
    # 1) boşlukları bul
    gaps = []
    for m, g in modern.items():
        a = g.area
        if not a:
            continue
        hit = [ids[k] for k in tree.query(g)]
        cov = unary_union([unit_geoms[i] for i in hit]).intersection(g).area / a if hit else 0.0
        if cov < COVER_MIN and founded_after(m, lineage, date):
            gaps.append(m)
    if not gaps:
        return {}, []
    geoms = dict(unit_geoms)
    owner = {}                     # bugünkü ilçe -> birim (boşluk dolduruldukça)
    for m in modern:
        if m not in gaps:
            owner[m] = None        # örtülü; birimi gerektiğinde geometriyle bulunur

    def unit_of(m):
        """Bugünkü ilçe m'nin (ana ilçe) bu seçimde içinde bulunduğu birim."""
        if m in owner and owner[m]:
            return owner[m]
        if m not in modern or m in gaps:
            return None
        g = modern[m]
        best, ba = None, 0.0
        for k in tree.query(g):
            i = ids[k]
            ar = unit_geoms[i].intersection(g).area
            if ar > ba:
                best, ba = i, ar
        return best if ba > 0.5 * g.area else None

    def option(m):
        """Boşluk m için (öncelik, sıra anahtarı, birim, yöntem) ya da None (henüz atanamaz)."""
        g = modern[m]
        ks = ((lineage.get(m) or {}).get('kanunSoyu') or {}).get('eskiIlceler') or []
        votes, pending = {}, False
        for p in ks:
            pid = p.get('geomId')
            if not pid:
                continue
            if pid in left_set:
                pending = True
                continue
            u = unit_of(pid)
            if u:
                votes[u] = votes.get(u, 0) + (p.get('birimSayisi') or 1)
        if votes:   # 1) kanun: en çok birim devreden ana ilçe
            u = max(votes, key=lambda x: (votes[x], _shared(g, geoms[x])))
            return (0, -votes[u], u, 'kanun')
        if pending:
            return None     # ana ilçe kendisi henüz boşluk: önce o çözülsün
        # 2) komşuluk: seçim tarihinde aynı ildeki birimlerle ortak sınır. Önce yalnız kesin alanlar (birimin kendisi ve
        #    kanunla katılanlar) sayılır; başka bir tahminle büyümüş alanlar zincirleme hatayı önlemek için en sona kalır.
        pl = province_of.get(m)
        box = g.envelope.buffer(0.01)
        for rank, pool in ((1, base), (2, geoms)):
            near = []
            for i, h in pool.items():
                if not h.envelope.intersects(box):
                    continue
                s = _shared(g, h)
                if s > MIN_SHARED:
                    near.append((unit_pl.get(i) == pl, s, i))
            if near:
                same, s, u = max(near)
                return (rank, -s, u, 'komşuluk' if same else 'komşuluk (il dışı)')
        return None

    added = {}
    left_set = set(gaps)
    base = dict(geoms)       # kesin alanlar: tahmini (komşuluk) eklemeler buraya girmez
    cache = {m: option(m) for m in gaps}
    while left_set:
        ready = [(o[0], o[1], m) for m, o in cache.items() if m in left_set and o]
        if not ready:
            break
        _, _, m = min(ready)
        _, _, u, how = cache[m]
        geoms[u] = unary_union([geoms[u], modern[m]])
        if how == 'kanun':
            base[u] = unary_union([base[u], modern[m]])
        owner[m] = u
        added.setdefault(u, []).append((m, how))
        left_set.discard(m)
        cache.pop(m, None)
        # yalnız m'ye komşu ya da ana ilçesi m olan boşluklar etkilenir
        box = modern[m].envelope.buffer(0.02)
        for x in left_set:
            ks = ((lineage.get(x) or {}).get('kanunSoyu') or {}).get('eskiIlceler') or []
            if modern[x].envelope.intersects(box) or any(p.get('geomId') == m for p in ks) or cache.get(x) is None:
                cache[x] = option(x)
    left = sorted(left_set)
    for u in added:
        unit_geoms[u] = geoms[u]
    if left:
        print('  %s: doldurulamayan %d ilçe: %s' % (label, len(left), ', '.join(left)))
    return added, left
