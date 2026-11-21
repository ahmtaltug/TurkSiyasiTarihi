#!/usr/bin/env python3
"""Tanıtım videosu (1920×1080, 30 fps) ve README GIF'i.

Girdi: scripts/video/capture.js ile alınan ekran görüntüleri (build/video/shots) ve scripts/video/music.py müziği.
Kareler kare kare hesaplanır (gerçek zamanlı kayıt yoktur): kamera hareketleri, geçişler, alt yazılar ve imleç
burada çizilir; ekran görüntüleri 2× piksel yoğunluğundadır, böylece yakınlaşmada keskin kalır.

Kullanım:
  python3 scripts/video/render.py video   -> docs/video/tanitim-16x9.mp4
  python3 scripts/video/render.py gif     -> docs/img/oynatma.gif
  python3 scripts/video/render.py still T -> build/video/still.png (T saniyesindeki kare; deneme için)
"""
import json, math, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = os.path.join(ROOT, 'build', 'video', 'shots')
META = json.load(open(os.path.join(SH, 'meta.json')))
OW, OH, FPS = 1920, 1080, 30
SW, SHH = 3840, 2160                          # sahne (stage) çözünürlüğü
CX, CY, CW = 240, 165, 3360                    # pencere içeriğinin sahnedeki yeri; CSS piksel × 2,1
K = CW / META['W']
CH = int(CW * 9 / 16)
BRAND = (141, 28, 28)
FONT = '/usr/share/fonts/opentype/inter/'


@lru_cache(maxsize=None)
def font(name, size):
    return ImageFont.truetype(FONT + name, size)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t) if t < 1 else 1.0


def ease_io(t):
    t = max(0.0, min(1.0, t))
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_box(a, b, t):
    return tuple(lerp(x, y, t) for x, y in zip(a, b))


def css(x, y):
    """Ekran görüntüsündeki CSS pikseli -> sahne koordinatı."""
    return CX + x * K, CY + y * K


def box_css(x, y, w):
    sx, sy = css(x, y)
    return (sx, sy, sx + w * K, sy + w * K * 9 / 16)


FULL = (0, 0, SW, SHH)
CONTENT = (CX, CY, CX + CW, CY + CH)


def to_out(box, sx, sy):
    return (sx - box[0]) / (box[2] - box[0]) * OW, (sy - box[1]) / (box[3] - box[1]) * OH


# ------------------------------------------------------------------ sahne zemini ve pencere
@lru_cache(maxsize=2)
def background():
    y = np.linspace(0, 1, SHH)[:, None]
    x = np.linspace(0, 1, SW)[None, :]
    top, bot = np.array([16, 20, 28]), np.array([26, 30, 42])
    img = top + (bot - top) * y[..., None]
    glow = np.exp(-(((x - 0.12) / 0.45) ** 2 + ((y - 1.05) / 0.55) ** 2))[..., None]
    img = img * (1 - 0.35 * glow) + np.array(BRAND) * 0.35 * glow
    glow2 = np.exp(-(((x - 0.95) / 0.35) ** 2 + ((y + 0.1) / 0.4) ** 2))[..., None]
    img = img * (1 - 0.12 * glow2) + np.array([60, 80, 120]) * 0.12 * glow2
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


@lru_cache(maxsize=2)
def window_base(dark):
    """Zemin + gölge + tarayıcı çubuğu (içerik sonra yapıştırılır)."""
    img = background().copy()
    bar = 60
    wx0, wy0, wx1, wy1 = CX, CY - bar, CX + CW, CY + CH
    sh = Image.new('L', (SW, SHH), 0)
    ImageDraw.Draw(sh).rounded_rectangle((wx0 + 10, wy0 + 30, wx1 - 10, wy1 + 36), 28, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    img = Image.composite(Image.new('RGB', (SW, SHH), (0, 0, 0)), img, sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((wx0, wy0, wx1, wy1), 26, fill=(43, 47, 54) if dark else (232, 230, 226))
    d.rectangle((wx0, CY - 2, wx1, CY), fill=(30, 33, 38) if dark else (214, 211, 205))
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        cx = wx0 + 40 + i * 34
        d.ellipse((cx - 11, wy0 + bar / 2 - 11, cx + 11, wy0 + bar / 2 + 11), fill=c)
    url = 'ahmtaltug.github.io/TurkiyeSecimAtlasi'
    f = font('Inter-Medium.otf', 28)
    tw = d.textlength(url, font=f)
    px0, px1 = (SW - tw) / 2 - 60, (SW + tw) / 2 + 40
    d.rounded_rectangle((px0, wy0 + 11, px1, wy0 + bar - 11), 19, fill=(30, 33, 38) if dark else (255, 255, 255))
    lx, ly = px0 + 26, wy0 + bar / 2                      # kilit simgesi
    col = (160, 166, 176) if dark else (110, 116, 126)
    d.rounded_rectangle((lx - 8, ly - 3, lx + 8, ly + 10), 3, fill=col)
    d.arc((lx - 6, ly - 13, lx + 6, ly + 3), 180, 360, fill=col, width=3)
    d.text((px0 + 46, wy0 + bar / 2), url, font=f, fill=(215, 219, 226) if dark else (60, 64, 72), anchor='lm')
    return img


@lru_cache(maxsize=None)
def corner_mask():
    m = Image.new('L', (CW, CH), 255)
    d = ImageDraw.Draw(m)
    r = 26
    d.rectangle((0, CH - r, r, CH), fill=0); d.rectangle((CW - r, CH - r, CW, CH), fill=0)
    d.pieslice((0, CH - 2 * r, 2 * r, CH), 90, 180, fill=255); d.pieslice((CW - 2 * r, CH - 2 * r, CW, CH), 0, 90, fill=255)
    return m


@lru_cache(maxsize=6)
def shot(name):
    return Image.open(os.path.join(SH, name + '.png')).convert('RGB')


def compose(content, dark=False):
    img = window_base(dark).copy()
    img.paste(content.resize((CW, CH), Image.LANCZOS), (CX, CY), corner_mask())
    return img


@lru_cache(maxsize=14)
def stage(name):
    return compose(shot(name), dark=name.startswith('en_dark'))


def zoom_content(z):
    """İlçe yakınlaşması: 0,25'lik adımlarla alınmış görüntülerden sürekli yakınlaşma (yalnız harita alanı)."""
    steps = META['zoom']['steps']
    z0 = steps[0]['z']
    i = max(0, min(len(steps) - 1, int(math.floor((z - z0) / 0.25 + 1e-9))))
    s = 2 ** (z - steps[i]['z'])
    m = META['shots']['zm_%d' % i]
    base = shot('zm_%d' % i)
    if s <= 1.0001:
        return base
    D = META['DSF']
    mx, my, mw, mh = (m['map'][k] * D for k in ('x', 'y', 'w', 'h'))
    cx, cy = mx + mw / 2, my + mh / 2
    cw, chh = mw / s, mh / s
    part = base.resize((int(mw), int(mh)), Image.LANCZOS, box=(cx - cw / 2, cy - chh / 2, cx + cw / 2, cy + chh / 2))
    out = base.copy()
    out.paste(part, (int(mx), int(my)))
    for r in m.get('fixed', []):                              # sabit denetimler yerinde
        b = tuple(int(v) for v in (r['x'] * D - 4, r['y'] * D - 4, (r['x'] + r['w']) * D + 4, (r['y'] + r['h']) * D + 4))
        out.paste(base.crop(b), b[:2])
    return out


# ------------------------------------------------------------------ katmanlar
def camera(layers, box):
    """layers: [(sahne_görüntüsü, ağırlık)] -> 1920×1080"""
    out = None
    for img, a in layers:
        if a <= 0.001:
            continue
        r = img.resize((OW, OH), Image.LANCZOS, box=box, reducing_gap=2.0)
        out = r if out is None else Image.blend(out, r, a)
    return out


def seq(names, t, dur_each, xf=0.22, start=0.0):
    """Sıralı görüntüler: t anında [(ad, ağırlık)]"""
    k = (t - start) / dur_each
    i = max(0, min(len(names) - 1, int(math.floor(k))))
    layers = [(names[i], 1.0)]
    frac = k - math.floor(k)
    if i + 1 < len(names) and k >= 0 and frac > 1 - xf / dur_each:
        a = ease((frac - (1 - xf / dur_each)) / (xf / dur_each))
        layers.append((names[i + 1], a))
    return layers, i


def caption(img, title, sub, t, dur, t_in=0.45):
    a_in = ease((t - t_in) / 0.45)
    a_out = 1 - ease((t - (dur - 0.55)) / 0.4)
    a = min(a_in, a_out)
    if a <= 0.01:
        return img
    dy = (1 - a_in) * 26
    ft, fs = font('InterDisplay-SemiBold.otf', 46), font('Inter-Regular.otf', 27)
    d0 = ImageDraw.Draw(img)
    w = max(d0.textlength(title, font=ft), d0.textlength(sub, font=fs)) + 76
    h = 128
    x0, y0 = 72, OH - 72 - h + dy
    layer = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    sh = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x0 + 4, y0 + 10, x0 + w + 4, y0 + h + 10), 18, fill=(0, 0, 0, int(110 * a)))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), 18, fill=(17, 20, 28, int(232 * a)))
    d.rounded_rectangle((x0, y0, x0 + 9, y0 + h), 4, fill=BRAND + (int(255 * a),))
    d.text((x0 + 38, y0 + 26), title, font=ft, fill=(255, 255, 255, int(255 * a)))
    d.text((x0 + 38, y0 + 84), sub, font=fs, fill=(206, 211, 220, int(255 * a)))
    out = Image.alpha_composite(img.convert('RGBA'), sh)
    return Image.alpha_composite(out, layer).convert('RGB')


def year_badge(img, year, label, a=1.0, x=88, y=318):
    if a <= 0.01:
        return img
    fy, fl = font('InterDisplay-Bold.otf', 92), font('Inter-Medium.otf', 24)
    d0 = ImageDraw.Draw(img)
    w = max(d0.textlength(year, font=fy), d0.textlength(label, font=fl)) + 56
    h = 150
    layer = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    sh = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, y + 8, x + w, y + h + 8), 16, fill=(0, 0, 0, int(70 * a)))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x, y, x + w, y + h), 16, fill=(255, 255, 255, int(236 * a)))
    d.text((x + 28, y + 14), year, font=fy, fill=(31, 35, 40, int(255 * a)))
    d.text((x + 30, y + 112), label, font=fl, fill=(95, 102, 112, int(255 * a)))
    out = Image.alpha_composite(img.convert('RGBA'), sh)
    return Image.alpha_composite(out, layer).convert('RGB')


def cursor(img, x, y, click=None, a=1.0, scale=1.0):
    """Ok imleci; click: 0..1 tıklama dalgası ilerlemesi."""
    if a <= 0.01:
        return img
    layer = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if click is not None and 0 <= click <= 1:
        r = 14 + 46 * ease(click)
        al = int(160 * (1 - click) * a)
        d.ellipse((x - r, y - r, x + r, y + r), outline=BRAND + (al,), width=5)
        d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=BRAND + (int(90 * (1 - click) * a),))
    s = 1.25 * scale
    pts = [(0, 0), (0, 25), (6.2, 19.4), (10.4, 29.2), (14.6, 27.4), (10.4, 17.8), (18.4, 17.8)]
    P = [(x + px * s, y + py * s) for px, py in pts]
    sh = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(px + 2, py + 3) for px, py in P], fill=(0, 0, 0, int(90 * a)))
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    d.polygon(P, fill=(255, 255, 255, int(255 * a)))
    d.line(P + [P[0]], fill=(20, 20, 20, int(255 * a)), width=2, joint='curve')
    out = Image.alpha_composite(img.convert('RGBA'), sh)
    return Image.alpha_composite(out, layer).convert('RGB')


def path_pt(p0, p1, t):
    """İki nokta arasında hafif kavisli imleç yolu."""
    e = ease_io(t)
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.12 * abs(p1[0] - p0[0])
    x = (1 - e) ** 2 * p0[0] + 2 * (1 - e) * e * mx + e ** 2 * p1[0]
    y = (1 - e) ** 2 * p0[1] + 2 * (1 - e) * e * my + e ** 2 * p1[1]
    return x, y


# ------------------------------------------------------------------ açılış ve kapanış (harita çizimi)
@lru_cache(maxsize=1)
def provinces():
    gj = json.load(open(os.path.join(ROOT, 'build', 'ext', 'turkiye-secim-haritasi', 'geo', 'normalized', 'turkiye_il_sinirlari.geojson')))
    el = json.load(open(os.path.join(ROOT, 'data', 'elections', '2023.json')))
    parties = json.load(open(os.path.join(ROOT, 'data', 'parties.json')))
    out = []
    for f in gj['features']:
        pl = str(f['properties']['plaka'])
        u = el['units'].get(pl) or {}
        col = parties.get(u.get('winner'), {}).get('c', '#888888')
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        lons = [p[0] for poly in polys for p in poly[0]]
        out.append({'pl': pl, 'col': tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)), 'polys': polys, 'cx': sum(lons) / len(lons)})
    return out


def proj(lon, lat, cx, cy, w):
    """Eşdikdörtgen izdüşüm (39° enlemde boylam kısaltmalı); w: Türkiye'nin genişliği."""
    c = math.cos(math.radians(39))
    s = w / ((44.9 - 25.6) * c)
    return cx + (lon - 35.25) * c * s, cy - (lat - 39.0) * s


@lru_cache(maxsize=4)
def province_sprites(cx, cy, w, ss=2):
    """Her il için ayrı RGBA parça (açılış animasyonunda tek tek belirir)."""
    sprites = []
    for p in provinces():
        rings = [[proj(x, y, cx * ss, cy * ss, w * ss) for x, y in poly[0]] for poly in p['polys']]
        xs = [x for r in rings for x, _ in r]; ys = [y for r in rings for _, y in r]
        bx0, by0, bx1, by1 = int(min(xs)) - 4, int(min(ys)) - 4, int(max(xs)) + 5, int(max(ys)) + 5
        im = Image.new('RGBA', (bx1 - bx0, by1 - by0), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for r in rings:
            pts = [(x - bx0, y - by0) for x, y in r]
            d.polygon(pts, fill=p['col'] + (255,))
            d.line(pts + [pts[0]], fill=(16, 20, 28, 255), width=2 * ss)
        sprites.append((p, im, (bx0, by0)))
    return sprites


def map_layer(t_reveal, cx, cy, w, alpha=1.0, ss=2):
    """t_reveal: 0..1 batıdan doğuya belirme; döner: 2× çözünürlükte RGBA."""
    L = Image.new('RGBA', (OW * ss, OH * ss), (0, 0, 0, 0))
    for p, im, (x0, y0) in province_sprites(cx, cy, w, ss):
        order = (p['cx'] - 25.6) / (44.9 - 25.6)
        a = ease((t_reveal * 1.35 - order * 0.85) / 0.5) * alpha
        if a <= 0.01:
            continue
        if a < 0.999:
            im = im.copy(); im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
        L.alpha_composite(im, (x0, y0))
    return L


def intro(t, dur):
    bg = background().resize((OW * 2, OH * 2))
    img = bg.convert('RGBA')
    img.alpha_composite(map_layer(ease((t - 0.2) / 2.6), 960, 420, 1180))
    img = img.resize((OW, OH), Image.LANCZOS).convert('RGBA')
    d = ImageDraw.Draw(img)
    a1, a2, a3 = ease((t - 2.0) / 0.7), ease((t - 2.5) / 0.7), ease((t - 3.0) / 0.7)
    d.text((960, 800 + (1 - a1) * 20), 'Türkiye Seçim Atlası', font=font('InterDisplay-Bold.otf', 96), fill=(255, 255, 255, int(255 * a1)), anchor='mm')
    d.text((960, 885 + (1 - a2) * 16), "1840'tan bugüne seçimler, döneminin sınırlarıyla", font=font('Inter-Regular.otf', 38), fill=(206, 211, 220, int(255 * a2)), anchor='mm')
    tg = 'OSMANLI VE CUMHURİYET  ·  MECLİSLER  ·  HÜKÛMETLER  ·  PARTİLER'
    d.text((960, 950), tg, font=font('Inter-SemiBold.otf', 22), fill=(222, 120, 110, int(255 * a3)), anchor='mm')
    return img.convert('RGB')


def endcard(t, dur):
    bg = background().resize((OW * 2, OH * 2)).convert('RGBA')
    bg.alpha_composite(map_layer(1.0, 960, 470, 1500, alpha=0.16))
    img = bg.resize((OW, OH), Image.LANCZOS).convert('RGBA')
    d = ImageDraw.Draw(img)
    a1, a2, a3, a4 = (ease((t - s) / 0.6) for s in (0.3, 0.7, 1.1, 1.5))
    d.text((960, 380 + (1 - a1) * 18), 'Türkiye Seçim Atlası', font=font('InterDisplay-Bold.otf', 104), fill=(255, 255, 255, int(255 * a1)), anchor='mm')
    d.text((960, 470), '1840–2026  ·  88 seçim  ·  73 hükûmet  ·  58 parti', font=font('Inter-Medium.otf', 32), fill=(206, 211, 220, int(255 * a2)), anchor='mm')
    url = 'ahmtaltug.github.io/TurkiyeSecimAtlasi'
    fu = font('Inter-SemiBold.otf', 40)
    tw = d.textlength(url, font=fu)
    d.rounded_rectangle((960 - tw / 2 - 40, 560, 960 + tw / 2 + 40, 640), 40, fill=BRAND + (int(255 * a3),))
    d.text((960, 600), url, font=fu, fill=(255, 255, 255, int(255 * a3)), anchor='mm')
    d.text((960, 712), 'Ücretsiz  ·  açık kaynak  ·  kaynakları belirtilmiş veri  ·  Türkçe / English', font=font('Inter-Regular.otf', 30), fill=(206, 211, 220, int(255 * a4)), anchor='mm')
    cr = 'Veri: YSK, TÜİK, Türkçe Vikipedi (CC BY-SA 4.0), Türkiye Seçim Haritası veri seti, Natural Earth  ·  Müzik ve sesler bu proje için sentezlendi'
    d.text((960, 1012), cr, font=font('Inter-Regular.otf', 19), fill=(150, 156, 168, int(255 * a4)), anchor='mm')
    fade = 1 - ease((t - (dur - 1.2)) / 1.2)
    out = img.convert('RGB')
    if fade < 1:
        out = Image.blend(Image.new('RGB', (OW, OH), (0, 0, 0)), out, fade)
    return out


# ------------------------------------------------------------------ sahneler
S = META['shots']


def sc_timelapse(t, dur):
    names = ['tl_' + e['id'] for e in META['timeline']]
    each = (dur - 1.6) / len(names)
    layers, i = seq(names, t, each, start=0.6)
    box = lerp_box(FULL, CONTENT, ease_io(t / 3.2))
    img = camera([(stage(n), a) for n, a in layers], box)
    e = META['timeline'][i]
    yr = e['year'] + (' Haziran' if e['id'].endswith('Haziran') else ' Kasım' if e['id'].endswith('Kasim') else '')
    img = year_badge(img, yr, 'Milletvekili genel seçimi', ease((t - 0.8) / 0.4))
    return caption(img, 'Döneminin sınırlarıyla 88 seçim', '1950–2023 milletvekili genel seçimleri: il il birinci parti', t, dur)


def sc_ottoman(t, dur):
    names = ['ot_' + e['id'] for e in META['early']]
    layers, i = seq(names, t, dur / len(names), xf=0.28)
    box = lerp_box(CONTENT, box_css(10, 8, 1580), t / dur)
    img = camera([(stage(n), a) for n, a in layers], box)
    e = META['early'][i]
    lab = 'Meclis-i Mebusan' if int(e['year']) < 1920 else 'TBMM seçimi'
    img = year_badge(img, e['year'], lab)
    return caption(img, "Osmanlı'dan Cumhuriyet'e", '1877–1946 meclisleri: vilayet, sancak ve dönemin illeri; mebus sayıları', t, dur)


def sc_istanbul(t, dur):
    c = S['ist_1']['cursor']
    if t < 1.9:
        layers = [('ist_0', 1.0)]
    elif t < 3.0:
        layers = [('ist_0', 1 - ease((t - 1.9) / 0.2)), ('ist_1', ease((t - 1.9) / 0.2))]
    else:
        layers = [('ist_1', 1 - ease((t - 3.1) / 0.3)), ('ist_2', ease((t - 3.1) / 0.3))]
    b1, b2 = box_css(800, 238, 800), box_css(800, 450, 800)
    box = CONTENT if t < 3.5 else lerp_box(CONTENT, b1, ease_io((t - 3.5) / 1.4)) if t < 5.2 else lerp_box(b1, b2, ease_io((t - 5.4) / 1.6))
    img = camera([(stage(n), a) for n, a in layers], box)
    p0, p1 = (1500, 700), to_out(box, *css(c['x'], c['y']))
    if t < 3.6:
        x, y = path_pt(p0, p1, (t - 0.5) / 1.3) if t < 1.8 else p1
        img = cursor(img, x, y, click=(t - 2.9) / 0.5 if t >= 2.9 else None, a=1 - ease((t - 3.3) / 0.3))
    return caption(img, 'İl kartı ve seçim geçmişi', 'Oylar, sandalyeler, nüfus göstergeleri ve aynı türdeki bütün seçimler', t, dur)


def sc_ilce(t, dur):
    z0 = META['zoom']['steps'][0]['z']; z1 = META['zoom']['steps'][-1]['z']
    z = lerp(z0, z1 + 0.2, ease_io((t - 1.2) / (dur - 1.9)))
    img = camera([(compose(zoom_content(z)), 1.0)], CONTENT)
    return caption(img, 'İlçe düzeyi', "1950'den bugüne, seçim tarihindeki ilçe sınırlarıyla (2024 yerel seçimleri)", t, dur)


def sc_trabzon(t, dur):
    c = S['tr_0']['cursor']
    layers = [('tr_0', 1.0)] if t < 1.75 else [('tr_0', 1 - ease((t - 1.75) / 0.3)), ('tr_1', ease((t - 1.75) / 0.3))]
    b1 = box_css(470, 238, 1130)
    box = lerp_box(CONTENT, b1, ease_io((t - 2.0) / 1.6))
    img = camera([(stage(n), a) for n, a in layers], box)
    p0, p1 = (300, 820), to_out(box, *css(c['x'], c['y']))
    if t < 2.4:
        x, y = path_pt(p0, p1, (t - 0.2) / 1.1) if t < 1.3 else p1
        img = cursor(img, x, y, click=(t - 1.45) / 0.5 if t >= 1.45 else None, a=1 - ease((t - 2.1) / 0.3))
    return caption(img, 'Döneminin ilçesi', "1950'de bugünkü Araklı ve Köprübaşı, Sürmene'nin parçasıydı", t, dur)


def sc_compare(t, dur):
    layers = [('cmp_0', 1.0)] if t < 3.7 else [('cmp_0', 1 - ease((t - 3.7) / 0.45)), ('cmp_1', ease((t - 3.7) / 0.45))]
    b1 = box_css(860, 238, 740)
    box = lerp_box(lerp_box(FULL, CONTENT, 0.55), CONTENT, ease_io(t / 2.0)) if t < 4.0 else lerp_box(CONTENT, b1, ease_io((t - 4.0) / 1.7))
    img = camera([(stage(n), a) for n, a in layers], box)
    return caption(img, 'Karşılaştırma', 'İki seçim yan yana; birinci partisi değişen iller ve il il farklar', t, dur)


def sc_chart(t, dur):
    ch = META['chart']
    xs = [c['cursor']['x'] for c in ch]
    u = ease_io((t - 0.5) / (dur - 1.4))
    cxp = lerp(xs[0], xs[-1], u)
    i = max(k for k in range(len(xs)) if xs[k] <= cxp + 1e-6)
    names = ['ch_' + c['d'] for c in ch]
    layers = [(names[i], 1.0)]
    if i + 1 < len(xs):
        a = (cxp - xs[i]) / max(1e-6, xs[i + 1] - xs[i])
        if a > 0.8:
            layers.append((names[i + 1], ease((a - 0.8) / 0.2)))
    box = lerp_box(CONTENT, box_css(0, 0, 1560), ease_io(t / dur))
    img = camera([(stage(n), a) for n, a in layers], box)
    x, y = to_out(box, *css(cxp, ch[0]['cursor']['y']))
    img = cursor(img, x, y, a=ease((t - 0.2) / 0.3) * (1 - ease((t - (dur - 0.6)) / 0.3)))
    return caption(img, 'Siyasi tarih', "1876'dan bugüne meclisler, hükûmetler ve devlet başkanları", t, dur)


def sc_parties(t, dur):
    c = S['pt_0']['cursor']
    layers = [('pt_0', 1.0)] if t < 1.6 else [('pt_0', 1 - ease((t - 1.6) / 0.3)), ('pt_1', ease((t - 1.6) / 0.3))]
    b1 = box_css(360, 120, 1240)
    box = lerp_box(CONTENT, b1, ease_io((t - 1.9) / 1.6))
    img = camera([(stage(n), a) for n, a in layers], box)
    p0, p1 = (900, 300), to_out(box, *css(c['x'], c['y']))
    if t < 2.3:
        x, y = path_pt(p0, p1, (t - 0.15) / 1.05) if t < 1.2 else p1
        img = cursor(img, x, y, click=(t - 1.3) / 0.5 if t >= 1.3 else None, a=1 - ease((t - 2.0) / 0.3))
    return caption(img, 'Partiler ve soy ağacı', 'Kuruluş, kapanış, ad değişiklikleri, öncül ve ardıllar', t, dur)


def sc_anim(t, dur):
    names = ['an_' + d for d in META['anim']]
    layers, i = seq(names, t, dur / len(names), xf=0.25)
    box = lerp_box(CONTENT, box_css(0, 60, 1420), ease_io(t / dur))
    img = camera([(stage(n), a) for n, a in layers], box)
    return caption(img, 'Olaylar ve animasyon', 'Seçilen tarihteki meclis, hükûmet ve faal partiler', t, dur)


def sc_guncel(t, dur):
    layers = [('gc_0', 1.0)] if t < 2.0 else [('gc_0', 1 - ease((t - 2.0) / 0.4)), ('gc_1', ease((t - 2.0) / 0.4))]
    box = CONTENT if t < 2.2 else lerp_box(CONTENT, box_css(880, 238, 720), ease_io((t - 2.2) / 1.6))
    img = camera([(stage(n), a) for n, a in layers], box)
    return caption(img, 'Güncel durum', 'Bugünkü TBMM ve 81 il belediye başkanı; her gün güncellenir', t, dur)


def sc_endark(t, dur):
    layers = [('en_dark_1912', 1.0)] if t < 2.3 else [('en_dark_1912', 1 - ease((t - 2.3) / 0.4)), ('en_dark_2023', ease((t - 2.3) / 0.4))]
    box = lerp_box(FULL, lerp_box(FULL, CONTENT, 0.7), ease_io(t / dur))
    img = camera([(stage(n), a) for n, a in layers], box)
    return caption(img, 'Türkçe · English · koyu tema', 'Çevrimdışı çalışır; telefona uygulama olarak eklenebilir', t, dur)


SCENES = [(intro, 5.0), (sc_timelapse, 12.5), (sc_ottoman, 7.5), (sc_istanbul, 7.5), (sc_ilce, 7.5), (sc_trabzon, 5.0),
          (sc_compare, 7.5), (sc_chart, 7.5), (sc_parties, 5.0), (sc_anim, 7.5), (sc_guncel, 5.0), (sc_endark, 5.0), (endcard, 7.5)]
STARTS = np.cumsum([0] + [d for _, d in SCENES])
TOTAL = float(STARTS[-1])
XF = 0.5


def frame(T):
    for k, (fn, dur) in enumerate(SCENES):
        s = STARTS[k]
        if s <= T < s + dur:
            t = T - s
            img = fn(t, dur)
            if k + 1 < len(SCENES) and t > dur - XF / 2:          # sonraki sahneye geçiş
                nfn, ndur = SCENES[k + 1]
                tn = t - dur
                a = ease((t - (dur - XF / 2)) / XF)
                img = Image.blend(img, nfn(tn + 0.0, ndur), a)
            elif k > 0 and t < XF / 2:
                pfn, pdur = SCENES[k - 1]
                a = ease((t + XF / 2) / XF)
                img = Image.blend(pfn(pdur + t, pdur), img, a)
            return img
    return endcard(SCENES[-1][1], SCENES[-1][1])


def frame_bytes(i):
    return frame(i / FPS).tobytes()


def render_video(out):
    music = os.path.join(ROOT, 'build', 'video', 'music.wav')
    if not os.path.exists(music):
        subprocess.check_call([sys.executable, os.path.join(os.path.dirname(__file__), 'music.py'), music, str(TOTAL)])
    n = int(round(TOTAL * FPS))
    # 1) kareler yüksek kaliteli ana kopyaya (build/video/master.mp4)
    master = os.path.join(ROOT, 'build', 'video', 'master.mp4')
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (OW, OH), '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', master]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for k, b in enumerate(pool.imap(frame_bytes, range(n), chunksize=4)):
            ff.stdin.write(b)
            if k % 150 == 0:
                print('kare %d / %d' % (k, n), flush=True)
    ff.stdin.close(); ff.wait()
    # 2) yayın kopyası: iki geçişli H.264 (≈2 Mbit/sn; metin keskin, dosya ≈ 25 MB) + müzik (−16 LUFS)
    kbps = os.environ.get('VKBPS', '2000')
    log = os.path.join(ROOT, 'build', 'video', 'x264pass')
    common = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', kbps + 'k', '-maxrate', str(int(kbps) * 2) + 'k',
              '-bufsize', str(int(kbps) * 4) + 'k', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '60', '-passlogfile', log]
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', master] + common + ['-pass', '1', '-an', '-f', 'mp4', os.devnull])
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', master, '-i', music, '-map', '0:v', '-map', '1:a'] + common +
                          ['-pass', '2', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
                           '-shortest', '-movflags', '+faststart', '-metadata', 'title=Türkiye Seçim Atlası — tanıtım', out])
    print('video:', out)


# ------------------------------------------------------------------ GIF: 1950'den 2023'e zaman atlamalı oynatma
def gif_frame(i):
    G = 10
    names = ['ot_' + e['id'] for e in META['early'] if int(e['year']) >= 1908] + ['tl_' + e['id'] for e in META['timeline']]
    labels = [(e['year'], 'Meclis-i Mebusan' if int(e['year']) < 1920 else 'TBMM seçimi') for e in META['early'] if int(e['year']) >= 1908] + \
             [(e['year'] + (' Haziran' if e['id'].endswith('Haziran') else ' Kasım' if e['id'].endswith('Kasim') else ''), 'Milletvekili genel seçimi') for e in META['timeline']]
    t = i / G
    each = 0.55
    layers, k = seq(names, t, each, xf=0.2)
    out = None
    for n, a in layers:
        r = shot(n).resize((960, 540), Image.LANCZOS, reducing_gap=2.0)
        out = r if out is None else Image.blend(out, r, a)
    y, lab = labels[k]
    big = out.resize((OW, OH))
    big = year_badge(big, y, lab, x=70, y=300)
    return big.resize((960, 540), Image.LANCZOS)


def render_gif(out):
    G = 10
    names_n = len([e for e in META['early'] if int(e['year']) >= 1908]) + len(META['timeline'])
    n = int((names_n * 0.55 + 1.4) * G)
    tmp = os.path.join(ROOT, 'build', 'video', 'gif')
    os.makedirs(tmp, exist_ok=True)
    with Pool(4) as pool:
        for k, im in enumerate(pool.imap(gif_frame, range(n), chunksize=2)):
            im.save(os.path.join(tmp, '%04d.png' % k))
    pal = os.path.join(tmp, 'pal.png')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-framerate', str(G), '-i', os.path.join(tmp, '%04d.png'),
                           '-vf', 'palettegen=max_colors=160:stats_mode=full', pal])
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-framerate', str(G), '-i', os.path.join(tmp, '%04d.png'), '-i', pal,
                           '-lavfi', 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', out])
    print('gif:', out, os.path.getsize(out) // 1024, 'KB')


def render_og():
    """Sosyal medya önizlemesi (1280×640): icons/og.jpg ve docs/img/og.jpg"""
    bg = background().resize((OW * 2, OH * 2)).convert('RGBA')
    bg.alpha_composite(map_layer(1.0, 960, 390, 1040))          # 1920×1080 düzleminde: harita üstte, ortada
    img = bg.resize((OW, OH), Image.LANCZOS).crop((0, 60, 1920, 1020)).resize((1280, 640), Image.LANCZOS).convert('RGBA')
    d = ImageDraw.Draw(img)
    d.text((640, 505), 'Türkiye Seçim Atlası', font=font('InterDisplay-Bold.otf', 72), fill=(255, 255, 255), anchor='mm')
    d.text((640, 570), '1840–2026 · Osmanlı ve Cumhuriyet seçimleri, döneminin sınırlarıyla', font=font('Inter-Medium.otf', 26), fill=(212, 216, 224), anchor='mm')
    out = img.convert('RGB')
    for path in (os.path.join(ROOT, 'icons', 'og.jpg'), os.path.join(ROOT, 'docs', 'img', 'og.jpg')):
        out.save(path, quality=88, optimize=True, progressive=True)
    print('og:', out.size)


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'video'
    if what == 'video':
        render_video(os.path.join(ROOT, 'docs', 'video', 'tanitim-16x9.mp4'))
    elif what == 'gif':
        render_gif(os.path.join(ROOT, 'docs', 'img', 'oynatma.gif'))
    elif what == 'og':
        render_og()
    elif what == 'still':
        for T in sys.argv[2:]:
            frame(float(T)).save(os.path.join(ROOT, 'build', 'video', 'still_%s.png' % T))
        print('toplam süre', TOTAL)
