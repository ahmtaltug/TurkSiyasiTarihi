/* Türkiye Seçim Atlası — siyasi tarih görünümü: meclis sandalye dağılımı, hükûmetler, cumhurbaşkanları, partiler ve olaylar.
   Veri: data/history.json (scripts/build_history.py). Ortak yardımcılar app.js'teki window.Atlas'tan gelir. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const A = () => window.Atlas;
  const dlg = $('#historyDlg'), body = $('#histBody');
  if (!dlg) return;
  const TODAY = new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const yf = (s) => { const [y, m, d] = String(s || TODAY).split('-').map(Number); return y + ((m || 1) - 1) / 12 + ((d || 1) - 1) / 365; };
  const fromYf = (t) => { const y = Math.floor(t), mf = (t - y) * 12, m = Math.min(12, Math.floor(mf) + 1), d = Math.min(28, Math.floor((mf - m + 1) * 30) + 1); return `${y}-${pad(m)}-${pad(d)}`; };
  const esc = (s) => A().esc(s);
  const days = (a, b) => Math.round((new Date(b || TODAY) - new Date(a)) / 864e5);
  // Meclisin bulunmadığı askerî yönetim dönemleri
  const GAPS = [['1877-06-28', '1877-12-13', 'Birinci dönem kapandı; ikinci dönem seçimleri'], ['1878-02-14', '1908-12-17', 'Meclis kapalı: II. Abdülhamid Meclis-i Mebusan\'ı süresiz tatil etti'], ['1912-01-18', '1912-04-18', 'Meclis feshedildi; erken seçim ("Sopalı Seçim")'], ['1912-08-05', '1914-05-14', 'Meclis feshedildi; yeni meclis açılana dek'],
    ['1918-12-21', '1920-01-12', 'Meclis feshedildi (VI. Mehmed); yeni meclis açılana dek'], ['1920-03-18', '1920-04-23', 'İstanbul\'un işgali: Meclis-i Mebusan son kez toplandı'], ['1960-05-27', '1961-10-15', 'Millî Birlik Komitesi'], ['1980-09-12', '1983-11-06', 'Millî Güvenlik Konseyi']];
  const SULTAN = '#8a6d3b', VIZIER = '#b59a6a';
  const MARK = { '1876-12-23': 'I. Meşrutiyet', '1908-07-23': 'II. Meşrutiyet', '1913-01-23': 'Bâbıâli Baskını', '1920-04-23': 'TBMM', '1923-10-29': 'Cumhuriyet', '1946-01-07': 'Çok partili dönem', '1960-05-27': '27 Mayıs', '1971-03-12': '12 Mart', '1980-09-12': '12 Eylül', '1997-02-28': '28 Şubat', '2016-07-15': '15 Temmuz', '2018-07-09': 'Cumhurbaşkanlığı hükûmet sistemi' };
  let CUR = null, H = null, tab = 'chart', pin = null, partySel = null;
  const anim = { on: false, t: 1876, timer: null, speed: 1, types: null };

  // ------------------------------------------------------------------ renkler
  const dark = () => A().isDark();
  function nameColor(name, leg) {
    if (name === 'Boş' || name === 'Belirtilmemiş' || /^Grup /.test(name)) return dark() ? '#4a4f57' : '#cdc8bf';
    if (name === 'Askerî Hükûmet' || /^Askerî yönetim/.test(name)) return dark() ? '#6b7280' : '#4b5563';
    if (name === 'Geçici Hükûmet' || /^Vekâleten/.test(name) || name === 'Bağımsız' || name === 'Bağımsızlar') return dark() ? '#8b929c' : '#9aa0a8';
    const k = (leg && leg.keys && leg.keys[name]) || A().partyKey(name);
    return A().pColor(k || name);
  }
  const seriesId = (name, leg) => (leg && leg.keys && leg.keys[name]) || A().partyKey(name) || name;
  function shortName(name, leg) {
    const k = seriesId(name, leg);
    if (A().state.parties[k]) return A().pLabel(k);
    const p = A().findParty(name);
    return (p && p.short && p.short.split(/\s/)[0]) || name;
  }
  const surname = (n) => String(n).replace(/^Askerî yönetim — /, '').replace(/\s*\(.*\)$/, '').trim().split(' ').slice(-1)[0];

  // ------------------------------------------------------------------ açma / sekmeler
  async function open(which, date, partyTitle) {
    show(true);
    body.innerHTML = '<p class="hint">Yükleniyor…</p>';
    A().loadElection('guncel').then((x) => { CUR = x; }).catch(() => {});
    try { H = await A().loadHistory(); } catch (e) { body.innerHTML = `<p class="note warn">Veri yüklenemedi: ${esc(e.message)}</p>`; return; }
    if (date) { pin = date; anim.t = Math.max(1876, yf(date)); }
    if (partyTitle) partySel = partyTitle;
    setTab(which || tab);
  }
  function setTab(t) {
    if (t !== 'anim') stopAnim();
    tab = t;
    document.querySelectorAll('#histTabs [data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    ({ chart: renderChart, govs: renderGovs, parties: renderParties, anim: renderAnim })[t]();
    setHash();
  }
  document.querySelectorAll('#histTabs [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  function show(on) {
    if (on) A().stopPlay();
    dlg.hidden = !on;
    document.querySelector('.controls').hidden = on; document.querySelector('main.layout').hidden = on;
    document.querySelectorAll('#mainTabs [data-view]').forEach((b) => { const a = (b.dataset.view === 'history') === on; b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); });
    if (!on) { stopAnim(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); }
    window.scrollTo(0, 0);
  }
  const close = () => { show(false); A().writeHash(); setTimeout(() => A().refit(), 40); };
  dlg.close = close;
  document.querySelectorAll('#mainTabs [data-view]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.view === 'map') close(); else open(tab, A().state.data && A().state.data.date);
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden && !e.target.closest('input, select')) close(); });

  // ------------------------------------------------------------------ yardımcı sorgular
  const inRange = (x, d) => x.start && x.start <= d && (!x.end || d < x.end);
  function legAt(d) {
    if (GAPS.some(([a, b]) => a <= d && d < b)) return null;
    let cur = null;
    for (const l of H.parliament) if (l.date <= d) cur = l;
    return cur;
  }
  const govAt = (d) => H.governments.find((g) => inRange(g, d));
  const presAt = (d) => H.presidents.find((p) => inRange(p, d));
  const govParties = (g) => g.parties.map((p) => p.name).filter((n) => n !== 'Bağımsızlar');
  const alivePartiesAt = (d) => H.parties.filter((p) => !p.alliance && p.periods.some(([a, b]) => a && a <= d && (!b || d < b)));

  function infoHtml(d) {
    const leg = legAt(d), g = govAt(d), p = presAt(d);
    let h = `<div class="hc-date">${esc(A().fmtDate(d))}</div>`;
    const su = (H.sultans || []).find((x) => inRange(x, d));
    if (su) h += `<div class="hc-row"><span class="muted">Padişah</span> <span class="sw" style="background:${SULTAN}"></span><b>${esc(su.name)}</b><span class="muted"> · ${esc(A().fmtDate(su.start))} – ${esc(A().fmtDate(su.end))}</span></div>`;
    const vz = (H.viziers || []).find((x) => inRange(x, d));
    if (vz) h += `<div class="hc-row"><span class="muted">Sadrazam</span> <span class="sw" style="background:${VIZIER}"></span><b>${esc(vz.name)}</b><span class="muted"> · ${esc(A().fmtDate(vz.start))} – ${esc(A().fmtDate(vz.end))} (${A().nf.format(days(vz.start, vz.end))} gün)</span></div>`;
    if (d >= '1920-04-23' && d < '1922-11-17' && vz) h += '<p class="note small">1920–1922 arasında İstanbul\'da Osmanlı hükûmeti, Ankara\'da TBMM hükûmeti birlikte vardı.</p>';
    const TH = H.tbmmHead;
    if (TH && inRange(TH, d)) h += `<div class="hc-row"><span class="muted">${esc(TH.title)}</span> <span class="sw" style="background:${nameColor('Anadolu ve Rumeli Müdâfaa-i Hukuk Cemiyeti')}"></span><b>${esc(TH.name)}</b><span class="muted"> · ${esc(A().fmtDate(TH.start))} – ${esc(A().fmtDate(TH.end))}</span></div>`;
    if (d >= '1920-04-23' && d < '1923-08-11') h += `<p class="note small">Birinci Meclis'te parti yoktu. ${d < '1921-05-10' ? 'Milletvekilleri henüz gruplaşmamıştı; ' : ''}Müdâfaa-i Hukuk (Birinci) Grubu 10 Mayıs 1921'de, muhalif İkinci Grup Temmuz 1922'de resmen kuruldu. Grupların üye sayıları kaynaklarda farklı verildiği için burada derlenmedi; grafik dönem listesindeki vekil sayısını gösterir.</p>`;
    if (d >= '1920-01-12' && d < '1920-04-23') h += '<p class="note small">Son Meclis-i Mebusan\'da Müdâfaa-i Hukuk çizgisindeki mebuslar Felâh-ı Vatan grubunu kurdu; grup dağılımı derlenmedi.</p>';
    if (p) h += `<div class="hc-row"><span class="muted">Cumhurbaşkanı</span> <span class="sw" style="background:${nameColor(p.party || 'Bağımsız')}"></span><b>${esc(p.name)}</b>${p.party ? ` <span class="muted">(${esc(p.party)})</span>` : ''}<span class="muted"> · ${esc(A().fmtDate(p.start))} – ${p.end ? esc(A().fmtDate(p.end)) : 'görevde'}</span></div>`;
    if (g) {
      const ps = govParties(g);
      h += `<div class="hc-row"><span class="muted">Hükûmet</span> <b>${esc(g.name)}</b> · ${esc(g.title)} ${esc(g.head)} <span class="muted">(${esc(A().fmtDate(g.start))} – ${g.end ? esc(A().fmtDate(g.end)) : 'görevde'}, ${A().nf.format(days(g.start, g.end))} gün)</span></div>`;
      h += `<div class="hc-row">${ps.map((n) => `<span class="pchip"><span class="sw" style="background:${nameColor(n)}"></span>${esc(n)}</span>`).join(' ')} <span class="tag ${g.kind === 'koalisyon' ? 'k' : ''}">${esc(g.kind)}</span></div>`;
      h += `<div class="hc-row small ${g.confidence.failed ? 'down' : 'muted'}">Güvenoyu: ${esc(g.confidence.text || '—')}${g.confidence.failed ? ' — hükûmet güvenoyu alamadı' : ''}</div>`;
    }
    const gap = GAPS.find(([a, b]) => a <= d && d < b);
    if (gap) h += `<p class="note">Meclis kapalı: ${esc(gap[2])} yönetimi (${esc(A().fmtDate(gap[0]))} – ${esc(A().fmtDate(gap[1]))}).</p>`;
    if (CUR && leg && leg === H.parliament[H.parliament.length - 1]) {
      const ent = Object.entries(CUR.national.seats).sort((a, b) => b[1] - a[1]);
      h += `<div class="hc-row"><span class="muted">Bugünkü TBMM</span> <span class="muted">(${esc(A().fmtDate(CUR.date))}; parti değiştirmeler ve yeni partiler dahil)</span> <button type="button" class="linkbtn" data-go="guncel">haritada aç</button></div>` +
        '<div class="hc-seats">' + ent.map(([k, v]) => `<span class="pchip"><span class="sw" style="background:${A().pColor(k)}"></span>${esc(A().pLabel(k))} <b>${v}</b></span>`).join(' ') + '</div>';
    }
    if (leg) {
      const meta = A().state.index.find((e) => e.id === leg.id);
      const ent = Object.entries(leg.seats).sort((a, b) => b[1] - a[1]);
      h += `<div class="hc-row"><span class="muted">Meclis</span> <b>${esc(meta ? meta.title : leg.id)}</b> sonrası, ${A().nf.format(leg.total)} ${leg.listed ? 'vekil (listede)' : 'sandalye'}${leg.basis ? ` <span class="muted">· gruplama: ${esc(leg.basis)}</span>` : ''}` +
        (meta ? ` <button type="button" class="linkbtn" data-go="${esc(leg.id)}">haritada aç</button>` : '') + '</div>';
      h += '<div class="hc-seats">' + ent.map(([n, v]) => `<span class="pchip" title="${esc(n)}"><span class="sw" style="background:${nameColor(n, leg)}"></span>${esc(shortName(n, leg))} <b>${v}</b> <span class="muted">%${(100 * v / leg.total).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</span></span>`).join(' ') + '</div>';
    }
    return h;
  }
  function bindGo(root) {
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { dlg.close(); A().go(b.dataset.go); }));
  }

  // ------------------------------------------------------------------ 1) meclis ve hükûmetler grafiği
  function renderChart() {
    const legs = H.parliament.slice().sort((a, b) => a.date.localeCompare(b.date));
    // seri sırası: toplam sandalye-yılı büyük olan alta
    const weight = {}, label = {}, sample = {};
    legs.forEach((l, i) => {
      const end = yf(legs[i + 1] ? legs[i + 1].date : TODAY) - yf(l.date);
      for (const [n, v] of Object.entries(l.seats)) {
        const s = seriesId(n, l);
        weight[s] = (weight[s] || 0) + v / l.total * end; label[s] = n; sample[s] = l;
      }
    });
    const tail = ['Bağımsız', 'Diğer', 'Boş', 'Belirtilmemiş'];
    const order = Object.keys(weight).sort((a, b) => (tail.includes(a) - tail.includes(b)) || weight[b] - weight[a]);
    const box = body;
    const Wc = Math.max(980, box.clientWidth - 8);
    const L0 = 128, R0 = 14, X0 = 1876, X1 = yf(TODAY) + 0.4;
    const X = (t) => L0 + (t - X0) / (X1 - X0) * (Wc - L0 - R0);
    const rows = { ev: [0, 38], pres: [40, 22], pm: [64, 16], gov: [82, 26], seat: [114, 300] };
    const Hc = rows.seat[0] + rows.seat[1] + 26;
    let s = `<svg class="hchart" id="hchart" viewBox="0 0 ${Wc} ${Hc}" width="${Wc}" height="${Hc}" role="img" aria-label="1920'den bugüne meclis sandalye dağılımı, hükûmetler ve cumhurbaşkanları">`;
    s += `<defs><pattern id="gapHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="2" height="6" class="gh"/></pattern></defs>`;
    // satır etiketleri
    const rl = (y, t) => `<text class="rl" x="${L0 - 8}" y="${y}" text-anchor="end">${t}</text>`;
    s += rl(rows.pres[0] + 15, 'Devlet başkanı') + rl(rows.pm[0] + 12, 'Sadrazam / Başbakan') + rl(rows.gov[0] + 17, 'Hükûmet partileri') + rl(rows.seat[0] + 14, 'Meclis') + rl(rows.seat[0] + 28, '(seçim sonrası)');
    // yatay kılavuz çizgileri
    const sy = (f) => rows.seat[0] + rows.seat[1] * (1 - f);
    for (const f of [0.25, 0.5, 0.75]) s += `<line class="grid" x1="${L0}" x2="${Wc - R0}" y1="${sy(f)}" y2="${sy(f)}"/><text class="ax" x="${L0 - 4}" y="${sy(f) + 3}" text-anchor="end">%${f * 100}</text>`;
    // I. TBMM ve askerî dönemler
    for (const [a, b, who] of GAPS) s += `<rect x="${X(yf(a))}" y="${rows.seat[0]}" width="${X(yf(b)) - X(yf(a))}" height="${rows.seat[1]}" fill="url(#gapHatch)"><title>Meclis kapalı: ${esc(who)}</title></rect>` +
      (X(yf(b)) - X(yf(a)) > 60 ? `<text class="gapt" x="${(X(yf(a)) + X(yf(b))) / 2}" y="${rows.seat[0] + rows.seat[1] / 2}" text-anchor="middle">${a < '1900' ? 'İstibdat: ' : ''}Meclis kapalı (${a.slice(0, 4)}–${b.slice(0, 4)})</text>` : '');
    // sandalye blokları
    const labels = [];
    legs.forEach((l, i) => {
      let x0 = yf(l.date), x1 = yf(legs[i + 1] ? legs[i + 1].date : TODAY) + (legs[i + 1] ? 0 : 0.4);
      const gap = GAPS.find(([a]) => yf(a) > x0 && yf(a) < x1);
      if (gap) x1 = yf(gap[0]);
      const inGap = GAPS.find(([a, b]) => yf(a) <= x0 && x0 < yf(b));
      if (inGap) x0 = yf(inGap[1]);
      let acc = 0;
      const byS = {};
      for (const [n, v] of Object.entries(l.seats)) { const k = seriesId(n, l); byS[k] = byS[k] || { v: 0, n }; byS[k].v += v; }
      for (const k of order) {
        if (!byS[k]) continue;
        const f = byS[k].v / l.total, y = sy(acc + f), hh = rows.seat[1] * f;
        s += `<rect class="blk" x="${X(x0).toFixed(1)}" y="${y.toFixed(1)}" width="${(X(x1) - X(x0)).toFixed(1)}" height="${hh.toFixed(1)}" fill="${nameColor(byS[k].n, l)}"/>`;
        if (hh > 13 && X(x1) - X(x0) > 30) labels.push({ x: (X(x0) + X(x1)) / 2, y: y + hh / 2 + 4, t: shortName(byS[k].n, l), w: X(x1) - X(x0) });
        acc += f;
      }
      s += `<line class="sep" x1="${X(x0)}" x2="${X(x0)}" y1="${rows.seat[0]}" y2="${rows.seat[0] + rows.seat[1]}"/>`;
    });
    for (const lb of labels) if (lb.t.length * 6.2 < lb.w + 6) s += `<text class="bl" x="${lb.x}" y="${lb.y}" text-anchor="middle">${esc(lb.t)}</text>`;
    // cumhurbaşkanları
    for (const p of H.presidents) {
      const x0 = X(yf(p.start)), x1 = X(yf(p.end)), w = x1 - x0;
      s += `<rect class="band" x="${x0}" y="${rows.pres[0]}" width="${Math.max(1, w)}" height="${rows.pres[1]}" fill="${nameColor(p.party || p.name)}"><title>${esc(p.name)} (${esc(A().fmtDate(p.start))} – ${p.end ? esc(A().fmtDate(p.end)) : 'görevde'})${p.party ? ' · ' + esc(p.party) : ''}${p.note ? ' · ' + esc(p.note) : ''}</title></rect>`;
      const nm = /^Askerî/.test(p.name) ? surname(p.name.replace(/ \(.*/, '')) : /^Vekâleten/.test(p.name) ? '' : surname(p.name);
      if (nm && w > nm.length * 6.4 + 6) s += `<text class="bt" x="${x0 + w / 2}" y="${rows.pres[0] + 15}" text-anchor="middle">${esc(nm)}</text>`;
    }
    for (const p of H.sultans || []) {
      const x0 = X(Math.max(X0, yf(p.start))), w = X(yf(p.end)) - x0;
      if (w <= 0) continue;
      s += `<rect class="band" x="${x0}" y="${rows.pres[0]}" width="${w}" height="${rows.pres[1]}" fill="${SULTAN}"><title>Padişah ${esc(p.name)} (${esc(A().fmtDate(p.start))} – ${esc(A().fmtDate(p.end))})</title></rect>`;
      if (w > p.name.length * 6 + 6) s += `<text class="bt" x="${x0 + w / 2}" y="${rows.pres[0] + 15}" text-anchor="middle">${esc(p.name)}</text>`;
    }
    const TH = H.tbmmHead;
    if (TH) {   // TBMM Başkanı: saltanat sürerken bandın alt yarısı, sonra tamamı
      const tc = nameColor('Anadolu ve Rumeli Müdâfaa-i Hukuk Cemiyeti'), xa = X(yf(TH.start)), xb = X(yf('1922-11-01')), xc = X(yf(TH.end)), hh = rows.pres[1] / 2;
      const tt = `<title>${esc(TH.title)} ${esc(TH.name)} (${esc(A().fmtDate(TH.start))} – ${esc(A().fmtDate(TH.end))}). ${esc(TH.note)}</title>`;
      s += `<rect class="band" x="${xa}" y="${rows.pres[0] + hh}" width="${xb - xa}" height="${hh}" fill="${tc}">${tt}</rect><rect class="band" x="${xb}" y="${rows.pres[0]}" width="${xc - xb}" height="${rows.pres[1]}" fill="${tc}">${tt}</rect>`;
    }
    // hükûmet başkanları (aynı kişinin art arda hükûmetleri tek blok)
    const ten = [];
    for (const g of H.governments) {
      const last = ten[ten.length - 1];
      if (last && last.head === g.head && last.end === g.start) { last.end = g.end; last.n++; } else ten.push({ head: g.head, start: g.start, end: g.end, n: 1 });
    }
    // Osmanlı sadrazamları (Bâb-ı Âli hükûmetleri)
    (H.viziers || []).forEach((v, i) => {
      const x0 = X(yf(v.start)), w = Math.max(1, X(yf(v.end)) - x0);
      s += `<rect class="pmb ${i % 2 ? 'alt' : ''}" x="${x0}" y="${rows.pm[0]}" width="${w}" height="${rows.pm[1]}"><title>Sadrazam ${esc(v.name)}: ${esc(A().fmtDate(v.start))} – ${esc(A().fmtDate(v.end))}</title></rect>`;
      s += `<rect class="band" x="${x0}" y="${rows.gov[0]}" width="${w}" height="${rows.gov[1]}" fill="${VIZIER}"><title>Osmanlı hükûmeti — Sadrazam ${esc(v.name)}</title></rect><line class="gsep" x1="${x0}" x2="${x0}" y1="${rows.gov[0]}" y2="${rows.gov[0] + rows.gov[1]}"/>`;
      let nm = v.name.replace(/ Paşa$/, '').split(' ').slice(-2).join(' ');
      if (w < nm.length * 5.8 + 4) nm = nm.split(' ').slice(-1)[0];
      if (w > nm.length * 5.8 + 4) s += `<text class="pmt" x="${x0 + w / 2}" y="${rows.pm[0] + 12}" text-anchor="middle">${esc(nm)}</text>`;
    });
    ten.forEach((t, i) => {
      const x0 = X(yf(t.start)), w = X(yf(t.end)) - x0;
      s += `<rect class="pmb ${i % 2 ? 'alt' : ''}" x="${x0}" y="${rows.pm[0]}" width="${Math.max(1, w)}" height="${rows.pm[1]}"><title>${esc(t.head)}: ${esc(A().fmtDate(t.start))} – ${t.end ? esc(A().fmtDate(t.end)) : 'görevde'} (${t.n} hükûmet)</title></rect>`;
      const nm = surname(t.head);
      if (w > nm.length * 5.8 + 4) s += `<text class="pmt" x="${x0 + w / 2}" y="${rows.pm[0] + 12}" text-anchor="middle">${esc(nm)}</text>`;
    });
    // hükûmet partileri (koalisyonlarda üst üste şeritler) ve güvenoyu
    for (const g of H.governments) {
      const x0 = X(yf(g.start)), w = Math.max(1, X(yf(g.end)) - x0);
      const ps = govParties(g).length ? govParties(g) : g.parties.map((p) => p.name);
      const hh = rows.gov[1] / ps.length;
      ps.forEach((n, j) => { s += `<rect class="band" x="${x0}" y="${rows.gov[0] + j * hh}" width="${w}" height="${hh}" fill="${nameColor(n)}"><title>${esc(g.name)} — ${esc(g.head)} · ${esc(ps.join(' + '))} · Güvenoyu: ${esc(g.confidence.text || '—')}</title></rect>`; });
      s += `<line class="gsep" x1="${x0}" x2="${x0}" y1="${rows.gov[0]}" y2="${rows.gov[0] + rows.gov[1]}"/>`;
      if (g.confidence.failed) s += `<text class="fail" x="${x0 + w / 2}" y="${rows.gov[0] + rows.gov[1] - 6}" text-anchor="middle">✕<title>${esc(g.name)} güvenoyu alamadı (${esc(g.confidence.text)})</title></text>`;
    }
    // olay çizgileri
    const lvEnd = [-1e9, -1e9, -1e9];
    for (const [d, t] of Object.entries(MARK)) {
      const x = X(yf(d)), w = t.length * 5.6 + 8, right = x > Wc - 200;
      const a0 = right ? x - w : x;
      let lvl = lvEnd.findIndex((e) => e < a0); if (lvl < 0) lvl = lvEnd.indexOf(Math.min(...lvEnd));
      lvEnd[lvl] = a0 + w;
      s += `<line class="evl" x1="${x}" x2="${x}" y1="${rows.ev[0] + 2 + lvl * 12}" y2="${rows.seat[0] + rows.seat[1]}"/><text class="evt" x="${x + (right ? -3 : 3)}" y="${rows.ev[0] + 10 + lvl * 12}" text-anchor="${right ? 'end' : 'start'}">${esc(t)}</text>`;
    }
    // eksen
    const ay = rows.seat[0] + rows.seat[1];
    for (let y = 1880; y <= X1; y += 5) {
      const x = X(y);
      s += `<line class="tick" x1="${x}" x2="${x}" y1="${ay}" y2="${ay + (y % 10 ? 3 : 6)}"/>` + (y % 10 ? '' : `<text class="ax" x="${x}" y="${ay + 17}" text-anchor="middle">${y}</text>`);
    }
    s += `<line class="cur" id="hcCur" x1="0" x2="0" y1="${rows.pres[0]}" y2="${ay}" visibility="hidden"/>`;
    s += `<rect id="hcHit" x="${L0}" y="0" width="${Wc - L0 - R0}" height="${ay}" fill="transparent"/></svg>`;

    const legend = order.filter((k) => !['Boş', 'Belirtilmemiş'].includes(k)).map((k) => `<span class="pchip" title="${esc(label[k])}"><span class="sw" style="background:${nameColor(label[k], sample[k])}"></span>${esc(shortName(label[k], sample[k]))}</span>`).join(' ');
    body.innerHTML = `<p class="hint">Fareyi grafiğin üzerinde gezdirin ya da tıklayın: o tarihteki meclis, hükûmet ve cumhurbaşkanı aşağıda yazar.</p>` +
      `<div class="hc-scroll">${s}</div><div class="hc-info" id="hcInfo"></div><div class="hc-legend">${legend}</div>` +
      `<p class="note small">Sandalye dağılımı her genel seçimin hemen sonrasındaki durumdur; dönem içindeki parti değiştirmeler, istifalar ve ara seçimler gösterilmez. Cumhuriyet Senatosu dahil değildir. ` +
      `1935–1943'te "Belirtilmemiş", seçim maddelerinin bilgi kutusunda CHP dışında sayılan ama partisi verilmeyen sandalyelerdir. Hükûmet bandında koalisyon ortakları üst üste şeritler hâlinde, sırasıyla gösterilir; ✕ güvenoyu alamayan hükûmeti işaretler. ` +
      `1877–1920 meclisleri dönem listelerinden sayılan vekillerdir; gruplama kaynağın sınıflandırmasıdır (1877 dinî, 1908 etnik, 1912–1914 siyasi mensubiyet; 1919 ve I. TBMM için grup verisi yok) ve literatürdeki toplu rakamlarla uyuşmayabilir. Kaynak: Vikipedi "Türkiye hükûmetleri listesi", "Türkiye cumhurbaşkanları listesi" ve seçim maddeleri; 1950 sonrası sandalyeler bu sitenin seçim verisinden.</p>`;
    const svg = $('#hchart'), hit = $('#hcHit'), cur = $('#hcCur'), info = $('#hcInfo');
    const show = (d) => {
      const x = X(yf(d));
      cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible');
      info.innerHTML = infoHtml(d); bindGo(info);
    };
    const tAt = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (Wc / r.width);
      return X0 + (px - L0) / (Wc - L0 - R0) * (X1 - X0);
    };
    hit.addEventListener('mousemove', (ev) => { const t = tAt(ev); if (t >= X0 && t <= X1) show(fromYf(Math.min(t, yf(TODAY)))); });
    hit.addEventListener('mouseleave', () => { if (pin) show(pin); });
    hit.addEventListener('click', (ev) => { pin = fromYf(Math.max(X0, Math.min(tAt(ev), yf(TODAY)))); show(pin); setHash(); });
    const start = pin || TODAY;
    show(start);
    // seçili tarihi görünür alana kaydır
    const sc = body.querySelector('.hc-scroll');
    sc.scrollLeft = Math.max(0, X(yf(start)) - sc.clientWidth / 2);
  }

  // ------------------------------------------------------------------ 2) hükûmetler tablosu
  function renderGovs() {
    const G = H.governments.filter((g) => g.start);
    const pm = G.filter((g) => g.title !== 'Cumhurbaşkanı');
    const dur = (g) => days(g.start, g.end);
    const coal = G.filter((g) => g.kind === 'koalisyon');
    const longest = pm.reduce((a, b) => (dur(b) > dur(a) ? b : a)), shortest = pm.reduce((a, b) => (dur(b) < dur(a) ? b : a));
    const failed = G.filter((g) => g.confidence.failed);
    const avg = pm.reduce((a, g) => a + dur(g), 0) / pm.length;
    let h = `<div class="stats"><div><b>${G.length}</b><span>hükûmet (1920–)</span></div><div><b>${coal.length}</b><span>koalisyon ya da çok partili</span></div>` +
      `<div><b>${A().nf.format(Math.round(avg))}</b><span>gün ortalama süre (başbakanlı hükûmetler)</span></div><div><b>${failed.length}</b><span>güvenoyu alamayan</span></div></div>`;
    h += `<p class="small">En uzun: ${esc(longest.name)} (${esc(longest.head)}, ${A().nf.format(dur(longest))} gün). En kısa: ${esc(shortest.name)} (${esc(shortest.head)}, ${A().nf.format(dur(shortest))} gün). ` +
      `Güvenoyu alamayanlar: ${failed.map((g) => `${esc(g.name)} (${esc(g.head)}, ${esc(g.confidence.text)})`).join('; ')}.</p>`;
    h += `<div class="filters"><label><input type="checkbox" id="gCoal"> Yalnız koalisyonlar</label> <input type="search" id="gSearch" placeholder="Başbakan ya da parti ara…" aria-label="Hükûmetlerde ara"></div>`;
    h += '<div class="tbl-scroll"><table class="utable govs"><thead><tr><th>Hükûmet</th><th>Başkan</th><th>Başlangıç</th><th>Bitiş</th><th class="num">Gün</th><th>Partiler</th><th>Güvenoyu</th></tr></thead><tbody>';
    for (const g of G) {
      const ps = g.parties.map((p) => `<span class="pchip" title="${esc(p.note || '')}"><span class="sw" style="background:${nameColor(p.name)}"></span>${esc(shortName(p.name))}${p.note ? '*' : ''}</span>`).join(' ');
      h += `<tr class="${g.kind === 'koalisyon' ? 'coal' : ''}" data-q="${esc((g.name + ' ' + g.head + ' ' + g.parties.map((p) => p.name).join(' ')).toLocaleLowerCase('tr'))}">` +
        `<td>${esc(g.name.replace(' Türkiye Hükûmeti', '. hükûmet').replace('..', '.'))}<div class="muted small">${esc(g.kind)}${g.election && g.election !== '—' ? ' · ' + esc(g.election) + ' meclisi' : ''}</div></td>` +
        `<td>${esc(g.head)}<div class="muted small">${esc(g.title)}</div></td><td>${esc(A().fmtDate(g.start))}</td><td>${g.end ? esc(A().fmtDate(g.end)) : 'görevde'}</td>` +
        `<td class="num">${A().nf.format(dur(g))}</td><td>${ps}</td><td class="${g.confidence.failed ? 'down' : ''}">${esc(g.confidence.text || '—')}</td></tr>`;
    }
    h += '</tbody></table></div>';
    const V = H.viziers || [];
    h += `<h3>Osmanlı sadrazamları (1876–1922)</h3><div class="tbl-scroll"><table class="utable govs"><thead><tr><th>Sadrazam</th><th>Başlangıç</th><th>Bitiş</th><th class="num">Gün</th><th>Padişah</th></tr></thead><tbody>` +
      V.map((v) => { const su = (H.sultans || []).find((x) => inRange(x, v.start)); return `<tr><td>${esc(v.name)}</td><td>${esc(A().fmtDate(v.start))}</td><td>${esc(A().fmtDate(v.end))}</td><td class="num">${A().nf.format(days(v.start, v.end))}</td><td>${esc(su ? su.name : '')}</td></tr>`; }).join('') +
      '</tbody></table></div><p class="note small">Kaynak: Vikipedi "Osmanlı sadrazamları listesi". Sadrazamlıkta güvenoyu yoktu; sadrazamı padişah atardı.</p>';
    h += '<p class="note small">Güvenoyu sütunu "kabul/katılan" biçimindedir. * işaretli partiler hükûmette dönemin yalnız bir bölümünde yer aldı (üzerine gelince tarih yazar). 2018\'den sonra cumhurbaşkanlığı hükûmet sisteminde güvenoyu yoktur. Kaynak: Vikipedi "Türkiye hükûmetleri listesi".</p>';
    body.innerHTML = h;
    const apply = () => {
      const q = $('#gSearch').value.trim().toLocaleLowerCase('tr'), c = $('#gCoal').checked;
      body.querySelectorAll('table.govs tbody tr').forEach((tr) => { tr.hidden = (c && !tr.classList.contains('coal')) || (q && !tr.dataset.q.includes(q)); });
    };
    $('#gCoal').addEventListener('change', apply); $('#gSearch').addEventListener('input', apply);
  }

  // ------------------------------------------------------------------ 3) partiler (zaman çizelgesi + soy ağacı)
  function renderParties() {
    const P = H.parties.filter((p) => p.founded).slice().sort((a, b) => a.founded.localeCompare(b.founded));
    const W = Math.max(760, Math.min(1100, body.clientWidth - 380)), L0 = 230, X0 = 1889, X1 = yf(TODAY) + 0.5, RH = 17;
    const X = (t) => L0 + (t - X0) / (X1 - X0) * (W - L0 - 10);
    const Hh = P.length * RH + 28;
    let s = `<svg class="gantt" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="Partilerin kuruluş ve kapanış zaman çizelgesi">`;
    for (let y = 1890; y <= X1; y += 10) s += `<line class="grid" x1="${X(y)}" x2="${X(y)}" y1="0" y2="${Hh - 20}"/><text class="ax" x="${X(y)}" y="${Hh - 6}" text-anchor="middle">${y}</text>`;
    for (const [d, t] of Object.entries(MARK)) s += `<line class="evl" x1="${X(yf(d))}" x2="${X(yf(d))}" y1="0" y2="${Hh - 20}"><title>${esc(t)}</title></line>`;
    P.forEach((p, i) => {
      const y = i * RH + 2, col = nameColor(p.name) || '#888';
      s += `<g class="prow${partySel === p.title ? ' sel' : ''}" data-t="${esc(p.title)}" tabindex="0" role="button" aria-label="${esc(p.name)}">`;
      s += `<rect class="hit" x="0" y="${y - 1}" width="${W}" height="${RH}"/>`;
      s += `<text class="pn${p.alliance ? ' al' : ''}" x="${L0 - 6}" y="${y + 11}" text-anchor="end">${esc(p.name.length > 34 ? p.name.slice(0, 33) + '…' : p.name)}</text>`;
      for (const [a, b] of p.periods) {
        if (!a) continue;
        s += `<rect class="pb${p.alliance ? ' al' : ''}" x="${X(yf(a))}" y="${y + 2}" width="${Math.max(2, X(yf(b)) - X(yf(a)))}" height="${RH - 5}" rx="2" fill="${col}"><title>${esc(p.name)}: ${esc(A().fmtDate(a))} – ${b ? esc(A().fmtDate(b)) : 'günümüz'}</title></rect>`;
      }
      for (const r of H.renames.filter((r) => r.party === p.title)) s += `<path class="rn" d="M${X(yf(r.date))} ${y + 1}l4 6.5l-4 6.5l-4 -6.5z"><title>${esc(A().fmtDate(r.date))}: ${esc(r.from)} → ${esc(r.to)}</title></path>`;
      s += '</g>';
    });
    s += '</svg>';
    body.innerHTML = `<div class="filters"><input type="search" id="pSearch" placeholder="Parti ara…" aria-label="Partilerde ara"> <span class="muted small">Çubuk: faaliyet dönemi · ◆ ad değişikliği · italik: ittifak. Satıra tıklayınca soy ağacı açılır.</span></div>` +
      `<div class="pl-grid"><div class="hc-scroll">${s}</div><div class="pl-info" id="plInfo"><p class="hint">Bir partiye tıklayın.</p></div></div>` +
      `<p class="note small">${H.parties.length} parti ve ittifak: Türkiye'de meclise girmiş, hükûmette yer almış ya da bu sitedeki seçimlerde öne çıkmış partiler. Tarihler ve öncül/ardıl ilişkileri Vikipedi bilgi kutularından derlenmiştir; birden çok kez kapatılıp açılan partilerin dönemleri madde metnine göre elle girildi.</p>`;
    const showP = (t) => {
      partySel = t; setHash();
      const p = A().partyByTitle(t), box = $('#plInfo');
      box.innerHTML = A().lineageHtml(p); A().bindLineage(box);
      body.querySelectorAll('.prow').forEach((g) => g.classList.toggle('sel', g.dataset.t === t));
    };
    body.querySelectorAll('.prow').forEach((g) => {
      g.addEventListener('click', () => showP(g.dataset.t));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showP(g.dataset.t); } });
    });
    $('#pSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLocaleLowerCase('tr');
      body.querySelectorAll('.prow').forEach((g) => g.classList.toggle('dim', !!q && !g.textContent.toLocaleLowerCase('tr').includes(q) && !g.dataset.t.toLocaleLowerCase('tr').includes(q)));
    });
    if (partySel) { showP(partySel); const g = body.querySelector('.prow.sel'); if (g) g.scrollIntoView({ block: 'center' }); }
  }

  // ------------------------------------------------------------------ 4) olaylar ve animasyon
  const TYPES = ['sistem', 'olay', 'darbe', 'padişah', 'cumhurbaşkanı', 'hükûmet', 'güvenoyu', 'kuruluş', 'kapanış', 'ad değişikliği', 'ittifak'];
  function renderAnim() {
    if (!anim.types) anim.types = new Set(TYPES.filter((t) => t !== 'hükûmet'));
    const lab = A().EV_LABEL;
    body.innerHTML = `<div class="anim-ctl"><button type="button" class="btn" id="aPlay">▶ Oynat</button>` +
      `<input type="range" id="aRange" min="1876" max="${yf(TODAY).toFixed(2)}" step="0.05" value="${anim.t}" aria-label="Tarih">` +
      `<label class="lbl">Hız <select id="aSpeed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>` +
      `<div class="chips small" id="aTypes">${TYPES.map((t) => `<button type="button" class="chip ${anim.types.has(t) ? 'on' : ''}" data-t="${esc(t)}" aria-pressed="${anim.types.has(t)}"><span class="et et-${esc(t.replace(/\s/g, '-'))} sq"></span>${esc(lab[t] || t)}</button>`).join('')}</div>` +
      `<div class="anim-grid"><div><div class="a-year" id="aYear"></div><div id="aHemi"></div><div id="aInfo"></div></div><div><h3>Olaylar</h3><ol class="a-events" id="aEvents"></ol><h3 id="aAliveH">Faal partiler</h3><div id="aAlive" class="hc-seats"></div></div></div>`;
    $('#aSpeed').value = String(anim.speed);
    $('#aPlay').addEventListener('click', () => (anim.on ? stopAnim() : startAnim()));
    $('#aRange').addEventListener('input', (e) => { stopAnim(); anim.t = Number(e.target.value); drawAnim(); });
    $('#aRange').addEventListener('change', setHash);
    $('#aSpeed').addEventListener('change', (e) => { anim.speed = Number(e.target.value); });
    body.querySelectorAll('#aTypes .chip').forEach((c) => c.addEventListener('click', () => {
      const t = c.dataset.t; anim.types.has(t) ? anim.types.delete(t) : anim.types.add(t);
      c.classList.toggle('on'); c.setAttribute('aria-pressed', String(anim.types.has(t))); drawAnim();
    }));
    drawAnim();
  }
  let lastLeg = null;
  function drawAnim() {
    const d = fromYf(anim.t);
    const yEl = $('#aYear'); if (!yEl) return;
    yEl.textContent = A().fmtDate(d).replace(/^\d+ /, '');
    $('#aRange').value = anim.t;
    const leg = legAt(d);
    const today = CUR && anim.t >= yf(TODAY) - 0.02 && leg === H.parliament[H.parliament.length - 1];
    const legKey = today ? 'bugün' : leg;
    if (legKey !== lastLeg) {
      lastLeg = legKey;
      $('#aHemi').innerHTML = today ? A().hemicycle(Object.entries(CUR.national.seats).sort((a, b) => b[1] - a[1])) + '<p class="hint small">Bugünkü TBMM dağılımı.</p>' : leg ? A().hemicycle(Object.entries(leg.seats).sort((a, b) => b[1] - a[1]).map(([n, v]) => [seriesId(n, leg) === n && !A().state.parties[n] ? 'Bilinmiyor' : seriesId(n, leg), v])) : '<p class="note">Bu tarihte seçilmiş meclis bileşimi yok.</p>';
    }
    $('#aInfo').innerHTML = infoHtml(d); bindGo($('#aInfo'));
    const ev = H.events.filter((e) => e.date <= d && anim.types.has(e.type)).slice(-14).reverse();
    $('#aEvents').innerHTML = ev.map((e, i) => `<li data-d="${esc(e.date)}" title="Bu tarihe git" class="${i === 0 && yf(d) - yf(e.date) < 1 ? 'new' : ''}"><span class="muted">${esc(A().fmtDate(e.date))}</span> <span class="et et-${esc(e.type.replace(/\s/g, '-'))}">${esc(A().EV_LABEL[e.type] || e.type)}</span>${esc(e.text)}</li>`).join('') || '<li class="muted">Bu tarihe kadar seçili türde olay yok.</li>';
    const alive = alivePartiesAt(d);
    $('#aAliveH').textContent = `Faal partiler (${alive.length} / derlenen ${H.parties.filter((p) => !p.alliance).length})`;
    $('#aAlive').innerHTML = alive.map((p) => `<span class="pchip"><span class="sw" style="background:${nameColor(p.name)}"></span>${esc(p.name)}</span>`).join(' ');
  }
  function startAnim() {
    if (anim.t >= yf(TODAY) - 0.05) anim.t = 1876;
    anim.on = true; $('#aPlay').textContent = '❚❚ Durdur';
    const tick = () => {
      if (!anim.on) return;
      anim.t = Math.min(yf(TODAY), anim.t + 0.08 * anim.speed);
      drawAnim();
      if (anim.t >= yf(TODAY)) { stopAnim(); return; }
      anim.timer = setTimeout(tick, 90);
    };
    tick();
  }
  function stopAnim() {
    if (anim.on) setTimeout(setHash, 0);
    anim.on = false; clearTimeout(anim.timer);
    const b = $('#aPlay'); if (b) b.textContent = '▶ Oynat';
  }

  // derin bağlantı: #v=tarih&t=<sekme>&d=<tarih>
  function setHash() {
    if (dlg.hidden) return;
    const p = new URLSearchParams({ v: 'tarih', t: tab });
    if (tab === 'chart' && pin) p.set('d', pin);
    if (tab === 'anim') p.set('d', fromYf(anim.t));
    if (tab === 'parties' && partySel) p.set('p', partySel);
    history.replaceState(null, '', '#' + p.toString());
  }
  let rsz = null;
  window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (!dlg.hidden && tab === 'chart' && H) renderChart(); }, 200); });
  body.addEventListener('click', (e) => {
    const li = e.target.closest('#aEvents li[data-d]');
    if (li) { stopAnim(); anim.t = Math.max(1876, yf(li.dataset.d)); drawAnim(); setHash(); }
  });
  window.addEventListener('hashchange', () => {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.get('v') === 'tarih' && dlg.hidden) open(q.get('t') || 'chart', q.get('d'), q.get('p'));
  });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('v') === 'tarih') A().ready.then(() => open(['chart', 'govs', 'parties', 'anim'].includes(hp.get('t')) ? hp.get('t') : 'chart', hp.get('d'), hp.get('p')));
  $('#histShare').addEventListener('click', async (e) => {
    setHash(); const b = e.currentTarget, old = b.innerHTML;
    try { await navigator.clipboard.writeText(location.href); b.textContent = 'Kopyalandı ✓'; } catch (_) { window.prompt('Bağlantıyı kopyalayın:', location.href); }
    setTimeout(() => { b.innerHTML = old; }, 1500);
  });

  window.AtlasHistory = { open };
})();
