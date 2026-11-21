// Tanıtım videosu ve GIF için ekran görüntüleri (scripts/video/render.py bunları kurgular).
// Kullanım: python3 -m http.server 8765 &   node scripts/video/capture.js   (Playwright gerekir)
// Çıktı: build/video/shots/*.png (1600×900 görünüm, 2× piksel yoğunluğu = 3200×1800) ve build/video/shots/meta.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const OUT = path.join(__dirname, '..', '..', 'build', 'video', 'shots');
const W = 1600, H = 900, DSF = 2;
const meta = { W, H, DSF, shots: {} };
fs.mkdirSync(OUT, { recursive: true });

// kayıt sırasında kaydırma çubukları ve yükleniyor göstergesi görünmesin
const CLEAN = `::-webkit-scrollbar{display:none!important} *{scrollbar-width:none!important}
  #loading{display:none!important} .leaflet-control-attribution{opacity:.85}`;

(async () => {
  const b = await chromium.launch();
  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, locale: 'tr-TR', ...opts });
    await ctx.addInitScript((css) => {
      try { localStorage.setItem('lang', 'tr'); } catch (e) { /* about:blank */ }
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
    }, CLEAN);
    return ctx;
  };
  let ctx = await mk();
  let p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const settle = (ms = 900) => p.waitForTimeout(ms);
  const go = async (hash, ms = 1300) => { await p.evaluate((h) => { location.hash = h; }, hash); await settle(ms); };
  const rect = (sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const shot = async (name, extra = {}) => {
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    meta.shots[name] = { map: await rect('#map').catch(() => null), ...extra };
    process.stdout.write(name + ' ');
  };
  // sayfayı baştan yükle (yalnız # değişince harita önceki yakınlaşmada kalır)
  const load = async (hash, ms = 2500) => {
    await p.goto('about:blank'); await p.goto(BASE + '#' + hash);
    await p.waitForFunction(() => document.querySelectorAll('#map path.leaflet-interactive').length > 0, null, { timeout: 60000 });
    await settle(ms);
  };
  const latlngPx = (ll) => p.evaluate((x) => { const pt = window.Atlas.map.latLngToContainerPoint(x); const r = document.getElementById('map').getBoundingClientRect(); return { x: r.x + pt.x, y: r.y + pt.y }; }, ll);

  await load('e=2023&m=winner');
  const idx = await p.evaluate(() => window.Atlas.state.index);

  // 1) açılış: 2023 genel seçimi
  await shot('s1_2023');

  // 2) zaman atlamalı: 1950–2023 genel seçimleri (Cumhuriyet sınırları, aynı çerçeve)
  const gen = idx.filter((e) => e.type === 'genel' && e.date >= '1950');
  meta.timeline = [];
  for (const e of gen) { await go('e=' + e.id + '&m=winner', 1100); await shot('tl_' + e.id); meta.timeline.push({ id: e.id, year: e.date.slice(0, 4), title: e.title }); }

  // 3) Osmanlı ve erken Cumhuriyet
  meta.early = [];
  for (const id of ['1877-1', '1908', '1912', '1914', '1919', '1920', '1923', '1927', '1935', '1946']) {
    await go('e=' + id, 1600); await shot('ot_' + id);
    meta.early.push({ id, year: idx.find((e) => e.id === id).date.slice(0, 4), title: idx.find((e) => e.id === id).title });
  }

  // 4) il kartı: İstanbul (üzerine gelme, tıklama, seçim geçmişi)
  await go('e=2023&m=winner', 1500);
  const ist = await latlngPx([41.08, 28.75]);
  await shot('ist_0', { cursor: ist });
  await p.mouse.move(ist.x, ist.y, { steps: 4 }); await settle(700);
  await shot('ist_1', { cursor: ist });
  await p.mouse.click(ist.x, ist.y); await settle(1200);
  await p.mouse.move(W - 40, H - 40);
  await p.evaluate(() => { const hb = document.querySelector('#histBox'); if (hb) hb.open = true; }); await settle(1500);
  await p.evaluate(() => document.querySelector('#unitInfo').scrollIntoView({ block: 'start' })); await settle(500);
  await shot('ist_2', { cursor: ist, panel: await rect('#panel') });

  // 5) ilçe düzeyi: 2024 yerel; Türkiye'den Marmara'ya gerçek yakınlaşma (0,25'lik adımlar)
  await load('e=2024yerel&m=winner&l=ilce', 3500);
  const z0 = await p.evaluate(() => window.Atlas.map.getZoom());
  const center = [40.75, 29.2];
  meta.zoom = { z0, steps: [] };
  await p.evaluate((c) => window.Atlas.map.setView(c, window.Atlas.map.getZoom(), { animate: false }), center); await settle(900);
  for (let z = z0, i = 0; z <= 8.5 + 1e-9; z += 0.25, i++) {
    await p.evaluate(([c, zz]) => window.Atlas.map.setView(c, zz, { animate: false }), [center, z]); await settle(900);
    // harita üzerindeki sabit denetimler (kurguda yalnız harita ölçeklenir, bunlar yerinde kalır)
    const fixed = [];
    for (const sel of ['#legend', '.leaflet-control-zoom', '.map-tools', '.leaflet-control-attribution']) { const r = await rect(sel).catch(() => null); if (r) fixed.push(r); }
    await shot('zm_' + i, { zoom: z, fixed }); meta.zoom.steps.push({ i, z });
  }
  // Trabzon 1950: sonradan kurulan ilçeler döneminin ilçesinde (Araklı → Sürmene)
  await load('e=1950yerel&m=winner&l=ilce', 3000);
  await p.evaluate(() => window.Atlas.map.setView([40.85, 39.85], 8.25, { animate: false })); await settle(1200);
  const sur = await latlngPx([40.86, 40.05]);
  await shot('tr_0', { cursor: sur });
  await p.mouse.click(sur.x, sur.y); await settle(1300); await p.mouse.move(W - 40, H - 40);
  await p.evaluate(() => { const c = document.querySelector('#unitInfo'); if (c) c.scrollIntoView({ block: 'start' }); }); await settle(600);
  await shot('tr_1', { cursor: sur, panel: await rect('#panel') });

  // 6) karşılaştırma: 2018 ve 2023
  await load('e=2023&m=winner&c=2018', 3500);
  await shot('cmp_0');
  await p.evaluate(() => document.querySelector('#cmpBox').scrollIntoView({ block: 'start' })); await settle(600);
  await shot('cmp_1');

  // 7) siyasi tarih: meclis ve hükûmetler
  const dates = ['1877-04-01', '1912-06-01', '1923-12-01', '1946-09-01', '1961-12-01', '1977-09-01', '1991-12-01', '2003-06-01', '2026-11-01'];
  meta.chart = [];
  for (const d of dates) {
    await go('v=tarih&t=chart&d=' + d, 1300);
    const cx = await p.evaluate(() => { const l = document.getElementById('hcCur'), svg = document.getElementById('hchart'); const r = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal; return { x: r.x + Number(l.getAttribute('x1')) * r.width / vb.width, y: r.y + 0.62 * r.height }; });
    await shot('ch_' + d, { cursor: cx }); meta.chart.push({ d, cursor: cx });
  }

  // 8) partiler ve soy ağacı
  await go('v=tarih&t=parties', 1500);
  const row = await p.$eval('.prow[data-t="Milliyetçi Hareket Partisi"] text', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await shot('pt_0', { cursor: row });
  await p.click('.prow[data-t="Milliyetçi Hareket Partisi"]'); await settle(900); await p.mouse.move(W - 40, H - 40);
  await shot('pt_1', { cursor: row });

  // 9) olaylar ve animasyon
  meta.anim = [];
  for (const d of ['1908-12-20', '1924-01-01', '1950-06-01', '1965-11-01', '1977-08-01', '1983-12-15', '1995-12-30', '2002-12-01', '2018-07-10', '2026-11-01']) {
    await go('v=tarih&t=anim&d=' + d, 1100); await shot('an_' + d); meta.anim.push(d);
  }

  // 10) güncel durum
  await load('e=guncel');
  await shot('gc_0');
  await p.evaluate(() => { const h = [...document.querySelectorAll('#electionInfo h3')].find((x) => /TBMM/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); }); await settle(600);
  await shot('gc_1');
  await ctx.close();

  // 11) İngilizce arayüz ve koyu tema
  ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, locale: 'en-US' });
  await ctx.addInitScript((css) => { try { localStorage.setItem('theme', 'dark'); } catch (e) { /* about:blank */ } document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, CLEAN);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '?lang=en#e=1912&m=count'); await p.waitForFunction(() => document.querySelectorAll('#map path.leaflet-interactive').length > 0); await settle(3000);
  await shot('en_dark_1912');
  await p.goto('about:blank'); await p.goto(BASE + '?lang=en#e=2023&m=party&p=CHP'); await p.waitForFunction(() => document.querySelectorAll('#map path.leaflet-interactive').length > 0); await settle(3000);
  await shot('en_dark_2023');
  await ctx.close();

  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log('\nhatalar:', errs.length ? errs : 'yok');
  await b.close();
})();
