// Tarayıcı duman testi: bütün seçimleri ve harita görünümlerini açar, konsol hatası arar.
// Kullanım: python3 -m http.server 8765 &  node tests/smoke.js   (Playwright gerekir)
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE);
  await p.waitForSelector('#electionInfo h2');
  const ids = await p.evaluate(() => fetch('data/index.json').then((r) => r.json()).then((x) => x.map((e) => e.id)));
  const bad = [];
  for (const id of ids) {
    await p.evaluate((i) => { location.hash = 'e=' + i; }, id);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      t: document.querySelector('#electionInfo h2')?.textContent,
      paths: document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive').length,
      overlay: !document.querySelector('#mapOverlay').hidden,
    }));
    if (!r.t || (!r.paths && !r.overlay)) bad.push(id);
    for (const m of await p.$$eval('#modeBox [data-mode]', (bs) => bs.map((x) => x.dataset.mode))) await p.click(`#modeBox [data-mode="${m}"]`);
  }
  await p.click('#playBtn'); await p.waitForTimeout(2500); await p.click('#playBtn');
  console.log(`${ids.length} seçim; sorunlu: ${bad.length ? bad.join(', ') : 'yok'}; hata: ${errs.length ? errs.join(' | ') : 'yok'}`);
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
