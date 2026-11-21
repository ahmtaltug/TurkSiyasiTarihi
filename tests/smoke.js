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
  // parti tarihçesi (soy ağacı): CHP'nin iki faaliyet dönemi
  await p.evaluate(() => { location.hash = 'e=2023'; }); await p.waitForTimeout(800);
  await p.click('#electionInfo .bar.clickable[data-k="CHP"]');
  await p.waitForSelector('#partyLin .lin-h', { timeout: 5000 }).catch(() => bad.push('parti tarihçesi açılmadı'));
  const lin = await p.$eval('#partyLin', (x) => x.textContent).catch(() => '');
  if (!/1992/.test(lin)) bad.push('CHP tarihçesinde 1992 yeniden kuruluş yok');
  // karşılaştırma modu
  await p.click('#cmpBtn'); await p.waitForTimeout(2000);
  const cmp = await p.evaluate(() => ({ paths: document.querySelectorAll('#map2 path.leaflet-interactive').length, hash: location.hash, rows: document.querySelectorAll('#cmpBox table.cmp tbody tr').length }));
  if (cmp.paths < 70 || !cmp.hash.includes('c=') || cmp.rows < 3) bad.push('karşılaştırma modu: ' + JSON.stringify(cmp));
  await p.click('#cmpBtn');
  // demografi
  await p.evaluate(() => { document.querySelector('#demoDet').open = true; }); await p.waitForTimeout(1500);
  const dots = await p.$$eval('#demoBox circle.dp', (c) => c.length);
  if (dots < 75) bad.push(`demografi grafiği ${dots} il`);
  // siyasi tarih penceresi
  await p.click('#mainTabs [data-view="history"]'); await p.waitForSelector('#hchart', { timeout: 5000 }).catch(() => bad.push('siyasi tarih grafiği yok'));
  const blocks = await p.$$eval('#hchart rect.blk', (r) => r.length);
  if (blocks < 80) bad.push(`meclis grafiğinde ${blocks} blok`);
  for (const t of ['govs', 'parties', 'anim']) { await p.click(`#histTabs [data-tab="${t}"]`); await p.waitForTimeout(300); }
  const govRows = await p.evaluate(() => { document.querySelector('#histTabs [data-tab="govs"]').click(); return document.querySelectorAll('table.govs tbody tr').length; });
  if (govRows < 70) bad.push(`hükûmet tablosu ${govRows} satır`);
  await p.keyboard.press('Escape');
  // ilçe düzeyi: 1961'de 600'den çok ilçe
  await p.evaluate(() => { location.hash = 'e=1961&m=winner&l=ilce'; }); await p.waitForTimeout(3000);
  const ilce = await p.$$eval('path.leaflet-interactive', (x) => x.length);
  if (ilce < 600) bad.push(`1961 ilçe haritası ${ilce} birim`);
  // 1950 yerel ilçe haritası: sonradan kurulan ilçeler döneminin ilçesine dahil (Araklı 1953'te Sürmene'den ayrıldı)
  await p.evaluate(() => { location.hash = 'e=1950yerel&m=winner&l=ilce'; }); await p.waitForTimeout(3000);
  const s50 = await p.evaluate(() => { const u = Object.values(window.Atlas.state.data.units).find((x) => x.name === 'Sürmene'); return u && (u.added || []).map((a) => a.ad); });
  if (!s50 || !s50.includes('Araklı')) bad.push('1950 Sürmene Araklı içermiyor: ' + JSON.stringify(s50));
  // taralı (tahmini sınırlı) birimleri olan haritada tıklama birimi seçmeli (üzerine gelince tarama katmanı taşınınca tıklama kayboluyordu)
  await p.evaluate(() => { location.hash = 'e=1923'; }); await p.waitForTimeout(1500);
  { const r = await p.$eval('#map', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width * 0.45, y: b.y + b.height * 0.5 }; });
    await p.mouse.click(r.x, r.y); await p.waitForTimeout(600);
    if (!(await p.evaluate(() => location.hash.includes('u=')))) bad.push('1923 haritasında tıklama birim seçmedi');
    await p.keyboard.press('Escape'); }
  // ilçe düzeyinde karşılaştırma: sağ harita da ilçe düzeyinde
  await p.evaluate(() => { location.hash = 'e=2023&m=winner&l=ilce'; }); await p.waitForTimeout(2500);
  await p.click('#cmpBtn'); await p.waitForTimeout(3000);
  const ci = await p.evaluate(() => document.querySelectorAll('#map2 path.leaflet-interactive').length);
  if (ci < 900) bad.push(`ilçe karşılaştırmasında sağ harita ${ci} birim`);
  await p.click('#cmpBtn'); await p.waitForTimeout(500);
  // geçerli oy / seçmen oranı yalnız ikisi de bilinen illerden (1957'de geçerli oy tek ilde: oran gösterilmemeli)
  await p.evaluate(() => { location.hash = 'e=1957'; }); await p.waitForTimeout(1200);
  const kv57 = await p.$$eval('#electionInfo dl.kv dd', (x) => x.map((d) => d.textContent));
  if (kv57.some((t) => /%/.test(t))) bad.push('1957 geçerli oy / seçmen oranı: ' + kv57.join(' | '));
  // açıklama ve meclis döneminin hükûmetleri
  await p.evaluate(() => { location.hash = 'e=1961'; }); await p.waitForTimeout(1500);
  const d61 = await p.evaluate(() => ({ desc: !!document.querySelector('#electionInfo p.desc'), ctx: document.querySelectorAll('#ctxLine p.ctx').length }));
  if (!d61.desc || d61.ctx < 2) bad.push('1961 açıklama / hükûmetler: ' + JSON.stringify(d61));
  // siyasi tarih: partiler o tarihteki adıyla (1930'da Cumhuriyet Halk Fırkası)
  await p.evaluate(() => { location.hash = 'v=tarih&t=anim&d=1930-09-01'; }); await p.waitForSelector('#aAlive', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(800);
  const alive30 = await p.$eval('#aAlive', (x) => x.textContent).catch(() => '');
  if (!/Cumhuriyet Halk Fırkası/.test(alive30)) bad.push('1930 faal partiler: ' + alive30.slice(0, 120));
  await p.keyboard.press('Escape');
  // gömülü görünüm: üst çubuk ve panel gizli, harita ve başlık şeridi görünür
  await p.goto('http://localhost:8765/?embed=1#e=2023'); await p.waitForTimeout(2500);
  const emb = await p.evaluate(() => ({ top: getComputedStyle(document.querySelector('.topbar')).display, panel: getComputedStyle(document.querySelector('.panel')).display,
    bar: document.querySelector('#embedBar').textContent, paths: document.querySelectorAll('#map path.leaflet-interactive').length }));
  if (emb.top !== 'none' || emb.panel !== 'none' || !/2023/.test(emb.bar) || emb.paths < 70) bad.push('gömülü görünüm: ' + JSON.stringify(emb));
  // İngilizce arayüz
  await p.goto('http://localhost:8765/?lang=en#e=2023'); await p.waitForTimeout(2500);
  const h1 = await p.$eval('.brand h1', (x) => x.textContent);
  if (h1 !== 'Turkey Election Atlas') bad.push('İngilizce başlık: ' + h1);
  await p.evaluate(() => localStorage.setItem('lang', 'tr'));
  console.log(`${ids.length} seçim; sorunlu: ${bad.length ? bad.join(', ') : 'yok'}; hata: ${errs.length ? errs.join(' | ') : 'yok'}`);
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
