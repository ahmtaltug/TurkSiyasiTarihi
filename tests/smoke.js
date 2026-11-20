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
  // meclis grafiği: 2023'te 600 sandalye
  await p.evaluate(() => { location.hash = 'e=2023&u=34'; }); await p.waitForTimeout(800);
  const seats = await p.$$eval('svg.hemi circle', (c) => c.length);
  if (seats !== 600) bad.push(`2023 meclis grafiği ${seats} sandalye`);
  // il seçim geçmişi
  await p.click('#histBox summary'); await p.waitForTimeout(1500);
  const histRows = await p.$$eval('#histBox tbody tr', (r) => r.length);
  if (histRows < 15) bad.push(`İstanbul genel seçim geçmişi ${histRows} satır`);
  // tahmini sınır işareti 1923'te lejantta görünmeli
  await p.evaluate(() => { location.hash = 'e=1923'; }); await p.waitForTimeout(800);
  if (!(await p.$('#legend .sw.hatch'))) bad.push('1923 tahmini sınır lejantı yok');
  // parti geçmişi: 2023'te CHP çubuğuna tıkla
  await p.evaluate(() => { location.hash = 'e=2023'; }); await p.waitForTimeout(800);
  await p.click('#electionInfo .bar.clickable[data-k="CHP"]'); await p.waitForTimeout(1500);
  const segs = await p.$$eval('#partyHist polyline', (x) => x.length);
  if (segs < 2) bad.push(`CHP geçmişinde 1981–1995 boşluğu yok (${segs} parça)`);
  // il arama
  await p.fill('#unitSearch', 'Trabzon'); await p.press('#unitSearch', 'Enter'); await p.waitForTimeout(800);
  if (!(await p.evaluate(() => location.hash.includes('u=61')))) bad.push('il arama Trabzon\'u seçmedi');
  // panel gizle / göster
  await p.click('#panelBtn'); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => document.querySelector('.layout').classList.contains('collapsed')))) bad.push('panel gizlenmedi');
  await p.click('#panelBtn');
  // tema: Sistem -> Açık -> Koyu
  await p.click('#themeBtn'); await p.click('#themeBtn'); await p.waitForTimeout(300);
  if ((await p.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') bad.push('koyu tema uygulanmadı');
  await p.click('#themeBtn');
  console.log(`${ids.length} seçim; sorunlu: ${bad.length ? bad.join(', ') : 'yok'}; hata: ${errs.length ? errs.join(' | ') : 'yok'}`);
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
