// README ekran görüntüleri (docs/img/*.jpg). Kullanım: python3 -m http.server 8765 &   node scripts/video/screenshots.js
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const OUT = path.join(__dirname, '..', '..', 'docs', 'img');
const CLEAN = '::-webkit-scrollbar{display:none!important} *{scrollbar-width:none!important} #loading{display:none!important}';

(async () => {
  const b = await chromium.launch();
  const page = async (opts, theme) => {
    const ctx = await b.newContext({ locale: 'tr-TR', ...opts });
    await ctx.addInitScript(([css, th]) => {
      try { localStorage.setItem('lang', 'tr'); if (th) localStorage.setItem('theme', th); } catch (e) { /* about:blank */ }
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
    }, [CLEAN, theme]);
    return ctx.newPage();
  };
  const desk = { viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 };
  const snap = async (p, hash, file, ms = 2500, before) => {
    await p.goto('about:blank'); await p.goto(BASE + '#' + hash); await p.waitForTimeout(ms);
    if (before) { await before(p); await p.waitForTimeout(900); }
    await p.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 86 });
    process.stdout.write(file + ' ');
  };
  let p = await page(desk);
  await snap(p, 'v=tarih&t=chart&d=1977-09-01', 'siyasi-tarih.jpg');
  await snap(p, 'e=2023&m=winner&c=2018', 'karsilastirma.jpg', 3500);
  await snap(p, 'v=tarih&t=anim&d=1977-08-01', 'animasyon.jpg');
  await snap(p, 'e=2024yerel&m=winner&l=ilce', 'harita.jpg', 3500);
  await snap(p, 'e=guncel', 'guncel.jpg', 3000, async (q) => {
    await q.evaluate(() => { const h = [...document.querySelectorAll('#electionInfo h3')].find((x) => /TBMM/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); });
  });
  p = await page(desk, 'dark');
  await snap(p, 'e=1912&m=count', 'osmanli-1912.jpg', 3000);
  p = await page({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await snap(p, 'e=2023&m=winner', 'mobil.jpg', 3000);
  console.log();
  await b.close();
})();
