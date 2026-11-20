/* Türkiye Seçim Atlası — statik, sunucusuz ön yüz (Leaflet + TopoJSON). */
(() => {
  'use strict';

  const TYPES = {
    genel: { label: 'Genel seçim', color: '#8d1c1c' },
    yerel: { label: 'Yerel seçim', color: '#2f6f4e' },
    cumhurbaskanligi: { label: 'Cumhurbaşkanlığı', color: '#6b3fa0' },
    referandum: { label: 'Halkoylaması', color: '#b26b00' },
    senato: { label: 'Senato', color: '#2a5d8f' },
    ara: { label: 'Ara seçim', color: '#6d6d6d' },
  };
  const ERA_LABEL = { osmanli: 'Osmanlı dönemi', cumhuriyet: 'Cumhuriyet dönemi' };
  const THEMES = {
    light: { nodata: '#d6d3cc', lo: '#f4f1ea', land: '#ebe8e1', landStroke: '#cfcac0', border: '#ffffff', hover: '#222222', sel: '#111111', ramp: '#7a2a1d', turnout: '#24557f' },
    dark: { nodata: '#3b3f46', lo: '#2b2f35', land: '#23272d', landStroke: '#353a41', border: '#16191d', hover: '#f2f2f2', sel: '#ffffff', ramp: '#e07a62', turnout: '#6fa8dc' },
  };
  let T = THEMES.light;
  let NODATA = T.nodata;
  const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

  const nf = new Intl.NumberFormat('tr-TR');
  const pf = (x, d = 1) => (x == null || isNaN(x)) ? '–' : '%' + Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const $ = (s) => document.querySelector(s);
  const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = { index: [], parties: {}, era: 'all', types: new Set(Object.keys(TYPES)), cur: null, data: null,
                  mode: null, party: null, unit: null, geoFamily: null, prev: null, dom: null,
                  play: { on: false, timer: null, speed: 1, skipEmpty: true } };
  const VERSION = '1.2.0';
  const cache = { geo: {}, el: {} };

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return r.json();
  }

  // ------------------------------------------------------------------ renkler / etiketler
  function hashColor(k) {
    let h = 0; for (const ch of String(k)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  const pColor = (k) => (state.parties[k] && (T === THEMES.dark ? state.parties[k].d : state.parties[k].c)) || hashColor(k);
  const pFull = (k) => (state.data && state.data.partyNames && state.data.partyNames[k]) || '';
  const pLabel = (k) => (state.parties[k] && (/\d{2}$/.test(k) || k.length > 22)) ? state.parties[k].s : k;
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  let RAMP_LO = T.lo;
  const SWING_UP = '#0f766e', SWING_DOWN = '#c2410c';

  // ------------------------------------------------------------------ harita
  const map = L.map('map', { zoomSnap: 0.25, minZoom: 3, maxZoom: 10, worldCopyJump: false });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  map.attributionControl.addAttribution('Sınırlar: © OpenStreetMap katkıcıları, OCHA/HDX, Natural Earth · Sonuçlar: YSK/TÜİK, Vikipedi (CC BY-SA 4.0)');
  map.setView([39, 35], 6);
  let worldLayer = null, unitLayer = null, hatchLayer = null;
  state.showHatch = localStorage.getItem('hatch') !== '0';
  function drawHatch(fc) {
    if (hatchLayer) { map.removeLayer(hatchLayer); hatchLayer = null; }
    const d = state.data;
    if (!state.showHatch || !d || !d.geo || d.level === 'vilayet') return;
    const feats = fc.features.filter((f) => d.units[f.properties.id] && d.units[f.properties.id].boundary);
    if (!feats.length) return;
    hatchLayer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
      interactive: false, style: { stroke: false, fill: true, fillColor: 'url(#hatch)', fillOpacity: 1 },
    }).addTo(map);
  }

  async function loadWorld() {
    const w = await getJSON('data/geo/world.json');
    const fc = topojson.feature(w, w.objects[Object.keys(w.objects)[0]]);
    worldLayer = L.geoJSON(fc, { interactive: false, style: () => ({ fillColor: T.land, fillOpacity: 1, color: T.landStroke, weight: 0.6 }) }).addTo(map);
  }

  async function loadGeo(id) {
    if (!cache.geo[id]) {
      const t = await getJSON('data/geo/' + id + '.json');
      cache.geo[id] = topojson.feature(t, t.objects[Object.keys(t.objects)[0]]);
    }
    return cache.geo[id];
  }
  async function loadElection(id) {
    if (!cache.el[id]) cache.el[id] = await getJSON('data/elections/' + id + '.json');
    return cache.el[id];
  }

  // ------------------------------------------------------------------ modlar
  function modesFor(d) {
    const us = Object.values(d.units || {});
    const ms = [];
    const has = (f) => us.some(f);
    const isRef = d.type === 'referandum', isCB = d.type === 'cumhurbaskanligi';
    if (d.metric === 'members' && has((u) => u.total)) ms.push(['count', d.id === '1930yerel' ? 'SCF belediye sayısı' : 'Vekil sayısı']);
    if (has((u) => u.winner)) ms.push(['winner', isRef ? 'Sonuç' : isCB ? 'Önde olan aday' : d.metric === 'members' ? (d.id === '1946' ? 'Birinci parti' : d.id === '1930yerel' ? 'İl merkezi' : 'Çoğunluk') : 'Birinci parti']);
    if (has((u) => u.pct && Object.keys(u.pct).length)) ms.push(['party', isRef ? 'Seçenek oranı' : isCB ? 'Aday oy oranı' : 'Parti oy oranı']);
    else if (has((u) => u.seats) && (d.parties || []).length > 1 && d.id !== '1930yerel') ms.push(['share', 'Grup payı']);
    if (has((u) => u.turnout != null)) ms.push(['turnout', 'Katılım']);
    if (state.prev && state.prev.id !== d.id && prevMetaFor(d)) ms.push(['swing', 'Değişim']);
    return ms;
  }
  // Değişim modu için aynı türden bir önceki seçim (yalnız oy verisi olan 1950 sonrası kayıtlar)
  function family(e) { return e.type + (e.id.endsWith('-igm') ? '-igm' : ''); }
  function prevMetaFor(d) {
    if (!d || d.era !== 'cumhuriyet' || d.metric !== 'votes' || d.type === 'ara') return null;
    const i = state.index.findIndex((e) => e.id === d.id);
    for (let j = i - 1; j >= 0; j--) {
      const e = state.index[j];
      if (family(e) === family(d) && e.metric === 'votes' && e.id !== d.id) return e;
    }
    return null;
  }
  function partyChoices(d, mode = state.mode) {
    const fromNat = Object.keys((d.national && (d.national.pct || d.national.seats)) || {});
    let list = (d.parties && d.parties.length ? d.parties : fromNat).filter((p) => p !== 'Diğer');
    if (mode === 'swing' && state.prev) {
      const pn = (state.prev.national && state.prev.national.pct) || {};
      list = list.filter((p) => pn[p] != null);
    }
    return list.slice(0, 12);
  }

  const uidMap = new WeakMap();
  const uid = (u) => uidMap.get(u);
  function indexUnits(d) { Object.entries(d.units).forEach(([k, u]) => uidMap.set(u, k)); }
  function unitValue(u, mode) {
    if (!u || u.nodata) return null;
    switch (mode) {
      case 'party': return u.pct ? (u.pct[state.party] ?? (u.unknownVotes && u.unknownVotes.includes(state.party) ? null : (u.pct && Object.keys(u.pct).length ? 0 : null))) : null;
      case 'share': return u.seats && u.initial ? 100 * (u.seats[state.party] || 0) / u.initial : null;
      case 'turnout': return u.turnout ?? null;
      case 'count': return u.total || 0;
      case 'swing': {
        const pu = state.prev && state.prev.units[uid(u)];
        if (!u.pct || !pu || !pu.pct || u.pct[state.party] == null || pu.pct[state.party] == null) return null;
        return u.pct[state.party] - pu.pct[state.party];
      }
      default: return null;
    }
  }
  function domain(d, mode) {
    const vals = Object.values(d.units).map((u) => unitValue(u, mode)).filter((v) => v != null);
    if (!vals.length) return [0, 1];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (mode === 'party' || mode === 'share') { lo = 0; hi = Math.max(10, Math.ceil(hi / 10) * 10); }
    if (mode === 'count') { lo = 0; }
    if (mode === 'turnout') { lo = Math.floor(lo / 5) * 5; hi = Math.ceil(hi / 5) * 5; }
    if (mode === 'swing') { const m = Math.max(5, Math.ceil(Math.max(Math.abs(lo), Math.abs(hi)) / 5) * 5); lo = -m; hi = m; }
    if (hi === lo) hi = lo + 1;
    return [lo, hi];
  }
  function rampColor(mode) {
    if (mode === 'party' || mode === 'share') return pColor(state.party);
    if (mode === 'turnout') return T.turnout;
    if (state.data && state.data.id === '1930yerel') return pColor('Serbest Cumhuriyet Fırkası');
    return T.ramp;
  }

  function styleFor(u) {
    const d = state.data, mode = state.mode;
    const base = { weight: borderWeight(), color: T.border, opacity: 1, fillOpacity: 1, lineJoin: 'round' };
    if (!u || u.nodata) return { ...base, fillColor: NODATA };
    if (mode === 'winner') {
      if (!u.winner) return { ...base, fillColor: NODATA };
      let t = 0.85;
      const share = u.pct && u.pct[u.winner];
      if (share != null) t = Math.max(0.35, Math.min(1, 0.35 + (share - 30) / 45 * 0.65));
      return { ...base, fillColor: mix(RAMP_LO, pColor(u.winner), t) };
    }
    if (!mode) return { ...base, fillColor: '#e3dfd6', color: '#b9b4aa' };
    const v = unitValue(u, mode);
    if (v == null) return { ...base, fillColor: NODATA };
    const [lo, hi] = state.dom || domain(d, mode);
    if (mode === 'swing') {
      const t = Math.max(-1, Math.min(1, v / hi));
      return { ...base, fillColor: t >= 0 ? mix(RAMP_LO, SWING_UP, 0.1 + 0.9 * t) : mix(RAMP_LO, SWING_DOWN, 0.1 + 0.9 * -t) };
    }
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return { ...base, fillColor: mix(RAMP_LO, rampColor(mode), 0.08 + 0.92 * t) };
  }

  // ------------------------------------------------------------------ çizim
  async function draw() {
    const d = state.data;
    $('#mapOverlay').hidden = true;
    if (!d.geo) {
      if (unitLayer) { map.removeLayer(unitLayer); unitLayer = null; }
      if (hatchLayer) { map.removeLayer(hatchLayer); hatchLayer = null; }
      $('#mapOverlay').hidden = false;
      $('#mapOverlay').innerHTML = '<b>Bu kayıt için harita verisi yok.</b><br>Ayrıntılar sağdaki panelde.';
      if (state.geoFamily !== 'otto') { map.fitBounds([[12, 12], [47, 48]]); state.geoFamily = 'otto'; }
      renderLegend();
      return;
    }
    const fc = await loadGeo(d.geo);
    if (state.data !== d) return; // bu arada başka seçim seçildi
    updateDomain();
    const old = unitLayer;
    state.fc = fc;
    unitLayer = L.geoJSON(fc, {
      style: (f) => styleFor(d.units[f.properties.id]),
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => { layer.setStyle({ weight: borderWeight() + 1.4, color: T.hover }); layer.bringToFront(); if (hatchLayer) hatchLayer.bringToFront(); },
          mouseout: () => { unitLayer && unitLayer.resetStyle(layer); markSelected(); },
          click: () => selectUnit(f.properties.id),
        });
        layer.bindTooltip(() => tooltipHtml(f), { sticky: true, className: 'unit-tip', direction: 'top', offset: [0, -6] });
      },
    }).addTo(map);
    if (old) map.removeLayer(old);
    drawHatch(fc);
    const fam = d.geo.startsWith('h-1877') || ['h-1908', 'h-1912', 'h-1914'].includes(d.geo) ? 'otto' : 'tr';
    if (fam !== state.geoFamily) {
      map.fitBounds(unitLayer.getBounds(), { padding: [12, 12] });
      state.geoFamily = fam;
    }
    markSelected();
    renderLegend();
  }
  function borderWeight() {
    const z = map.getZoom();
    return z <= 4.5 ? 0.4 : z <= 5.5 ? 0.6 : z <= 6.5 ? 0.8 : z <= 7.5 ? 1.1 : 1.4;
  }
  function updateDomain() {
    const m = state.mode;
    state.dom = (state.data && m && m !== 'winner') ? domain(state.data, m) : null;
  }
  function restyle() {
    updateDomain();
    if (unitLayer) unitLayer.setStyle((f) => styleFor(state.data.units[f.properties.id]));
    markSelected();
    renderLegend();
  }
  function markSelected() {
    if (!unitLayer || !state.unit) return;
    unitLayer.eachLayer((l) => { if (l.feature.properties.id === state.unit) { l.setStyle({ weight: borderWeight() + 1.8, color: T.sel }); l.bringToFront(); } });
    if (hatchLayer) hatchLayer.bringToFront();
  }

  function tooltipHtml(f) {
    const d = state.data, u = d.units[f.properties.id];
    const name = esc((u && u.name) || f.properties.name);
    if (!u || u.nodata) return `<b>${name}</b><span class="muted">${u && u.note ? esc(u.note) : 'Veri yok'}</span>`;
    const parts = [];
    if (state.mode === 'winner' && u.winner) parts.push(`${esc(pFull(u.winner) || pLabel(u.winner))}${u.pct && u.pct[u.winner] != null ? ' ' + pf(u.pct[u.winner]) : ''}`);
    else if (state.mode === 'party' || state.mode === 'share') parts.push(`${esc(pLabel(state.party))}: ${pf(unitValue(u, state.mode))}`);
    else if (state.mode === 'turnout') parts.push('Katılım ' + pf(u.turnout));
    else if (state.mode === 'swing') { const v = unitValue(u, 'swing'); parts.push(`${esc(pLabel(state.party))}: ${v == null ? 'karşılaştırılamaz' : sgn(v) + ' puan'}`); }
    else if (state.mode === 'count') parts.push(d.id === '1930yerel' ? `SCF: ${u.total} belediye` : `${u.initial ?? u.total} vekil${u.total > (u.initial ?? u.total) ? ` (+${u.total - u.initial} sonradan)` : ''}`);
    if (u.note && !parts.length) parts.push(esc(u.note));
    return `<b>${name}</b>${parts.join('<br>')}`;
  }

  // ------------------------------------------------------------------ lejant
  function renderLegend() {
    const d = state.data, el = $('#legend');
    if (!d || !d.geo) { el.innerHTML = ''; return; }
    const mode = state.mode;
    let html = '';
    if (!mode) { el.innerHTML = '<div class="t">Dönemin sınırları</div><div class="muted">İl düzeyinde sonuç verisi yok</div>' + hatchLegend(d); bindHatchToggle(); return; }
    if (mode === 'winner') {
      const cnt = {};
      Object.values(d.units).forEach((u) => { if (u.winner) cnt[u.winner] = (cnt[u.winner] || 0) + 1; });
      const title = d.type === 'referandum' ? 'Sonuç' : d.type === 'cumhurbaskanligi' ? 'Önde olan aday' : d.id === '1930yerel' ? 'İl merkezi belediyesi' : d.id === '1946' ? 'Birinci parti (oy; bilinmiyorsa vekil)' : d.metric === 'members' ? 'Çoğunluk (vekil)' : 'Birinci parti';
      html += `<div class="t">${title}</div>`;
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
        html += `<div class="item" title="${esc(pFull(k))}"><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))} <span class="muted">(${n})</span></div>`;
      });
      if (Object.values(d.units).some((u) => u.pct && u.winner)) html += '<div class="muted" style="margin-top:4px">Ton koyulaştıkça oy oranı artar</div>';
    } else if (mode === 'swing') {
      const [, hi] = state.dom || domain(d, mode);
      html += `<div class="t">${esc(pLabel(state.party))} oyundaki değişim (puan)</div><div class="muted">Karşılaştırılan: ${esc(state.prev.title)}</div>`;
      html += `<div class="ramp" style="background:linear-gradient(90deg, ${SWING_DOWN}, ${RAMP_LO}, ${SWING_UP})"></div>`;
      html += `<div class="ramp-l"><span>−${nf.format(hi)}</span><span>0</span><span>+${nf.format(hi)}</span></div>`;
    } else {
      const [lo, hi] = state.dom || domain(d, mode);
      const t = mode === 'turnout' ? 'Katılım (%)' : mode === 'count' ? (d.id === '1930yerel' ? 'SCF\'nin kazandığı belediye' : 'Vekil sayısı') : `${esc(pLabel(state.party))} (%)`;
      const c = rampColor(mode);
      html += `<div class="t">${t}</div><div class="ramp" style="background:linear-gradient(90deg, ${mix(RAMP_LO, c, 0.08)}, ${c})"></div>`;
      html += `<div class="ramp-l"><span>${nf.format(lo)}</span><span>${nf.format(hi)}</span></div>`;
    }
    html += `<div class="item" style="margin-top:4px"><span class="sw" style="background:${NODATA}"></span><span class="muted">Veri yok / seçim yapılmadı</span></div>`;
    html += hatchLegend(d);
    el.innerHTML = html;
    bindHatchToggle();
  }
  function hatchLegend(d) {
    if (d.level === 'vilayet') return '';
    const n = Object.values(d.units).filter((u) => u.boundary).length;
    if (!n) return '';
    return `<label class="item hatch-toggle"><input type="checkbox" id="hatchChk" ${state.showHatch ? 'checked' : ''}><span class="sw hatch"></span><span class="muted">Sınırı tahmine dayanan birim (${n})</span></label>`;
  }
  function bindHatchToggle() {
    const c = document.getElementById('hatchChk');
    if (c) c.addEventListener('change', () => { state.showHatch = c.checked; localStorage.setItem('hatch', c.checked ? '1' : '0'); if (state.fc) drawHatch(state.fc); });
  }

  // ------------------------------------------------------------------ panel
  function bars(entries, total, opts = {}) {
    const max = opts.max || Math.max(...entries.map((e) => e[1]), 1);
    return '<div class="bars">' + entries.map(([k, v, extra]) => {
      const w = Math.max(0.5, 100 * v / max);
      const val = opts.pct ? pf(v) : nf.format(v);
      return `<div class="bar"><span class="lab" title="${esc(pFull(k) || k)}"><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))}</span>` +
        `<span class="tr"><span class="fl" style="display:block;width:${w}%;background:${pColor(k)}"></span></span>` +
        `<span class="val">${val}${extra ? ' · ' + extra : ''}</span></div>`;
    }).join('') + '</div>';
  }

  function renderElectionInfo() {
    const d = state.data, meta = state.cur;
    const t = TYPES[d.type] || { label: d.type, color: '#666' };
    let h = `<h2>${esc(d.title)}</h2>`;
    h += `<div class="muted">${esc(d.dateLabel || meta.dateLabel || d.date)}${d.subtitle ? ' · ' + esc(d.subtitle) : ''}</div>`;
    const tc = T === THEMES.dark ? mix(t.color, '#ffffff', 0.45) : t.color;
    h += `<div class="badges"><span class="badge" style="background:${t.color}${T === THEMES.dark ? '40' : '1a'};color:${tc}">${t.label}</span><span class="badge">${ERA_LABEL[d.era] || ''}</span>`;
    if (d.reliability) h += `<span class="badge rel rel-${esc(d.reliability.level)}" title="${esc(d.reliability.why)}">${esc(d.reliability.label)}</span>`;
    if (d.approxBoundaries) h += '<span class="badge">Yaklaşık sınırlar</span>';
    if (d.level) h += `<span class="badge">Birim: ${d.level}</span>`;
    h += '</div>';
    if (d.description) h += `<p class="desc">${esc(d.description)}</p>`;
    if (d.reliability) h += `<p class="note rel-note"><b>Veri güvenilirliği — ${esc(d.reliability.label)}:</b> ${esc(d.reliability.why)}</p>`;

    const n = d.national || {};
    if (n.pct && Object.keys(n.pct).length) {
      const ent = Object.entries(n.pct).filter(([k]) => k !== 'Diğer').slice(0, 8)
        .map(([k, v]) => [k, v, n.seats && n.seats[k] ? `${n.seats[k]} snd.` : '']);
      const label = d.type === 'referandum' ? 'Ülke geneli' : d.type === 'cumhurbaskanligi' ? 'Ülke geneli (aday)' : 'Ülke geneli oy';
      h += `<h3>${label}</h3>` + bars(ent, 100, { pct: true, max: Math.max(...ent.map((e) => e[1])) });
      if (n.seats && Object.keys(n.seats).length && (d.type === 'genel' || d.type === 'senato')) {
        h += `<h3>${d.type === 'senato' ? 'Bu seçimde kazanılan sandalyeler' : 'Meclis dağılımı'}</h3>` + hemicycle(Object.entries(n.seats).filter((e) => e[1] > 0));
      }
      const kv = [];
      if (n.voters) kv.push(['Kayıtlı seçmen', nf.format(n.voters)]);
      if (n.valid) kv.push(['Geçerli oy', nf.format(n.valid)]);
      if (n.voters && n.valid) kv.push(['Geçerli oy / seçmen', pf(100 * n.valid / n.voters)]);
      if (n.total_seats) kv.push(['Toplam sandalye', nf.format(n.total_seats)]);
      if (kv.length) h += '<dl class="kv">' + kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('') + '</dl>';
    } else if (n.seats && Object.keys(n.seats).length) {
      const lbl = d.id === '1930yerel' ? 'Kazanılan seçim bölgesi (belediye)' : (d.groupLabel || 'Dağılım');
      h += `<h3>${esc(lbl)}</h3>` + bars(Object.entries(n.seats).slice(0, 10), null);
    }
    if (n.members_listed != null) {
      h += `<dl class="kv">${n.total_seats ? `<dt>Toplam sandalye</dt><dd>${nf.format(n.total_seats)}</dd>` : ''}<dt>Listedeki vekil</dt><dd>${nf.format(n.members_listed)}</dd>`;
      if (n.members_initial !== n.members_listed) h += `<dt>Sonradan katılan hariç</dt><dd>${nf.format(n.members_initial)}</dd>`;
      h += '</dl>';
    }
    if (n.turnout_note) h += `<p class="note">${esc(n.turnout_note)}</p>`;
    $('#electionInfo').innerHTML = h;
  }

  function renderModes() {
    const d = state.data, ms = modesFor(d), box = $('#modeBox');
    if (!ms.length) { box.innerHTML = ''; return; }
    let h = '<h3>Harita görünümü</h3><div class="seg" role="group" aria-label="Harita modu">' +
      ms.map(([k, l]) => `<button type="button" data-mode="${k}" class="${k === state.mode ? 'active' : ''}" aria-pressed="${k === state.mode}">${l}</button>`).join('') + '</div>';
    if (state.mode === 'swing' && state.prev) h += `<p class="hint">Karşılaştırma: ${esc(state.prev.title)} (${esc(state.prev.dateLabel || state.prev.date)}). İl sınırları değişmişse yalnız eşleşen iller boyanır.</p>`;
    if (state.mode === 'party' || state.mode === 'share' || state.mode === 'swing') {
      h += '<select id="partySelect" aria-label="Parti">' + partyChoices(d).map((p) => `<option value="${esc(p)}" ${p === state.party ? 'selected' : ''}>${esc(pLabel(p))}${pFull(p) && pFull(p) !== pLabel(p) ? ' — ' + esc(pFull(p)) : ''}</option>`).join('') + '</select>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); }));
    const ps = $('#partySelect');
    if (ps) ps.addEventListener('change', () => { state.party = ps.value; restyle(); renderTable(); writeHash(); });
  }
  function setMode(m) {
    state.mode = m;
    if ((m === 'party' || m === 'share' || m === 'swing') && !partyChoices(state.data, m).includes(state.party)) state.party = partyChoices(state.data, m)[0];
    renderModes(); restyle(); renderTable(); writeHash();
  }

  function renderUnit() {
    const d = state.data, box = $('#unitInfo');
    const u = state.unit && d.units[state.unit];
    if (!u) {
      box.innerHTML = d.geo ? '<p class="hint">Ayrıntı için haritada bir il ya da vilayete tıklayın.</p>' : '';
      return;
    }
    let h = `<div class="unit-card"><button class="close" type="button" aria-label="Kapat" id="unitClose">✕</button><h3>${esc(u.name)}</h3>`;
    if (u.nodata) {
      h += `<p class="note">${esc(u.note || 'Bu birim için bu seçimde veri yok (seçim yapılmamış, işgal altında ya da kaynakta bulunmuyor olabilir).')}</p></div>`;
      box.innerHTML = h; $('#unitClose').onclick = () => selectUnit(null); return;
    }
    const kv = [];
    if (u.winner) kv.push([d.type === 'referandum' ? 'Sonuç' : d.type === 'cumhurbaskanligi' ? 'Önde' : d.id === '1930yerel' ? 'İl merkezi' : 'Birinci', esc(pLabel(u.winner)) + (u.winnerBasis === 'seats' ? ' <span class="muted">(vekil sayısına göre)</span>' : '')]);
    if (u.voters) kv.push(['Kayıtlı seçmen', nf.format(u.voters)]);
    if (u.valid) kv.push(['Geçerli oy', nf.format(u.valid)]);
    if (u.turnout != null) kv.push(['Katılım', pf(u.turnout)]);
    if (u.seatsOfficial) kv.push(['Resmî sandalye', nf.format(u.seatsOfficial)]);
    if (d.metric === 'members' && d.id !== '1930yerel') {
      kv.push(['Listedeki vekil', nf.format(u.total || 0) + (u.total > u.initial ? ` <span class="muted">(${u.total - u.initial} sonradan)</span>` : '')]);
    }
    if (u.sub) kv.push(['Seçim bölgeleri', esc(u.sub.join(', '))]);
    if (kv.length) h += '<dl class="kv">' + kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('') + '</dl>';
    if (u.pct && Object.keys(u.pct).length) {
      const ent = Object.entries(u.pct).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => {
        const extra = [];
        if (u.votes && u.votes[k] != null) extra.push(nf.format(u.votes[k]));
        if (u.seats && u.seats[k]) extra.push(u.seats[k] + ' snd.');
        if (u.approxVotes && u.approxVotes.includes(k)) extra.push('yaklaşık');
        return [k, v, extra.join(' · ')];
      });
      h += `<h3>${d.type === 'referandum' ? 'Oylar' : 'Oy oranı'}</h3>` + bars(ent, 100, { pct: true, max: Math.max(...ent.map((e) => e[1])) });
      if (u.candidates) h += '<p class="note">Adaylar: ' + Object.entries(u.candidates).map(([p, c]) => `${esc(pLabel(p))}: ${esc(c)}`).join('; ') + '</p>';
      if (u.unknownVotes) h += `<p class="note">Oyu bilinmeyen: ${u.unknownVotes.map((x) => esc(pLabel(x))).join(', ')}</p>`;
    } else if (u.seats && Object.keys(u.seats).length) {
      h += `<h3>${esc(d.groupLabel || 'Dağılım')}</h3>` + bars(Object.entries(u.seats), null);
    }
    if (u.seats && u.pct && d.type !== 'referandum' && d.type !== 'cumhurbaskanligi' && !Object.keys(u.pct).some((k) => u.seats[k])) {
      h += '<p class="note">Sandalye: ' + Object.entries(u.seats).map(([k, v]) => `${esc(pLabel(k))} ${v}`).join(', ') + '</p>';
    }
    if (u.members && u.members.length) {
      const li = u.members.map((m) => {
        const g = [m.g, m.g2 && m.g2 !== m.g ? '→ ' + m.g2 : null].filter(Boolean).map(esc).join(' ');
        return `<li class="${m.later ? 'later' : ''}">${esc(m.n)}${g ? ` <span class="g">· ${g}</span>` : ''}${m.later ? ' <span class="g">(sonradan)</span>' : ''}</li>`;
      }).join('');
      const label = d.id === '1930yerel' ? 'SCF\'nin kazandığı belediyeler' : `Vekiller${d.group2Label ? ` (${esc(d.groupLabel || '')} → ${esc(d.group2Label)})` : d.groupLabel ? ` (${esc(d.groupLabel)})` : ''}`;
      h += u.members.length > 12
        ? `<details><summary>${label} — ${u.members.length}</summary><ul class="members">${li}</ul></details>`
        : `<h3>${label}</h3><ul class="members">${li}</ul>`;
    }
    if (u.note) h += `<p class="note">${esc(u.note)}</p>`;
    if (u.boundary) h += `<p class="note warn"><b>Sınır notu:</b> ${esc(u.boundary)}</p>`;
    if (d.geo && d.geo.startsWith('tr-')) h += '<details id="histBox"><summary>Bu ilin seçim geçmişi (aynı tür, 1950 sonrası)</summary><div class="hist">Yükleniyor…</div></details>';
    h += '</div>';
    box.innerHTML = h;
    $('#unitClose').onclick = () => selectUnit(null);
    const hb = $('#histBox');
    if (hb) {
      if (histOpen) hb.open = true;
      hb.addEventListener('toggle', () => { histOpen = hb.open; if (hb.open) renderHistory(state.unit); });
      if (hb.open) renderHistory(state.unit);
    }
  }

  // ------------------------------------------------------------------ il seçim geçmişi
  let histOpen = false;
  async function renderHistory(id) {
    const d = state.data, box = document.querySelector('#histBox .hist');
    if (!box) return;
    const fam = family(state.cur);
    const metas = state.index.filter((e) => family(e) === fam && e.geo && e.geo.startsWith('tr-'));
    const datas = await Promise.all(metas.map((e) => loadElection(e.id).catch(() => null)));
    if (state.unit !== id || state.data !== d) return;
    const rows = metas.map((e, i) => ({ e, u: datas[i] && datas[i].units[id] })).filter((r) => r.u && !r.u.nodata);
    if (!rows.length) { box.innerHTML = '<p class="note">Bu il için başka kayıt yok.</p>'; return; }
    const party = (['party', 'swing'].includes(state.mode) && state.party) || (d.units[id] && d.units[id].winner) || null;
    // seçili partinin oy oranı çizgisi
    let chart = '';
    const pts = rows.map((r) => [Number(r.e.date.slice(0, 4)), r.u.pct ? r.u.pct[party] : null]).filter((p) => p[1] != null);
    if (party && pts.length > 1) {
      const W = 320, H = 90, x0 = pts[0][0], x1 = pts[pts.length - 1][0], ymax = Math.max(10, Math.ceil(Math.max(...pts.map((p) => p[1])) / 10) * 10);
      const X = (x) => 24 + (x - x0) / Math.max(1, x1 - x0) * (W - 34), Y = (y) => H - 14 - y / ymax * (H - 24);
      const c = pColor(party);
      chart = `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(pLabel(party))} oy oranı">` +
        `<line x1="24" x2="${W - 10}" y1="${Y(0)}" y2="${Y(0)}" stroke="#d6d3cc"/><text x="2" y="${Y(ymax) + 4}" font-size="9" fill="#5f6670">%${ymax}</text><text x="2" y="${Y(0) + 3}" font-size="9" fill="#5f6670">0</text>` +
        `<polyline fill="none" stroke="${c}" stroke-width="2" points="${pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>` +
        pts.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.6" fill="${c}"><title>${p[0]}: ${pf(p[1])}</title></circle>`).join('') +
        `<text x="24" y="${H - 2}" font-size="9" fill="#5f6670">${x0}</text><text x="${W - 10}" y="${H - 2}" font-size="9" fill="#5f6670" text-anchor="end">${x1}</text></svg>` +
        `<div class="muted" style="font-size:12px">${esc(pLabel(party))} oy oranı</div>`;
    }
    let t = '<table class="utable"><thead><tr><th>Yıl</th><th>Birinci</th>' + (party ? `<th class="num">${esc(pLabel(party))}</th>` : '') + '<th class="num">Katılım</th></tr></thead><tbody>';
    for (const { e, u } of rows) {
      t += `<tr data-e="${esc(e.id)}" class="${e.id === d.id ? 'sel' : ''}"><td>${esc(e.date.slice(0, 4))}${e.subtitle && /tur/.test(e.subtitle) ? ' ' + esc(e.subtitle) : ''}</td>` +
        `<td>${u.winner ? `<span class="sw" style="background:${pColor(u.winner)}"></span>${esc(pLabel(u.winner))}${u.pct && u.pct[u.winner] != null ? ' ' + pf(u.pct[u.winner]) : ''}` : '–'}</td>` +
        (party ? `<td class="num">${u.pct && u.pct[party] != null ? pf(u.pct[party]) : '–'}</td>` : '') +
        `<td class="num">${u.turnout != null ? pf(u.turnout) : '–'}</td></tr>`;
    }
    t += '</tbody></table>';
    box.innerHTML = chart + t;
    box.querySelectorAll('tr[data-e]').forEach((tr) => tr.addEventListener('click', () => go(tr.dataset.e, { unit: id, keepMode: true })));
  }

  // ------------------------------------------------------------------ meclis sandalye grafiği
  function hemicycle(entries) {
    const total = entries.reduce((a, e) => a + e[1], 0);
    if (!total) return '';
    const R = Math.max(2, Math.round(Math.sqrt(total / 3.2)));
    const r0 = 0.38, radii = [...Array(R)].map((_, i) => r0 + (1 - r0) * i / (R - 1));
    const sr = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map((r) => Math.floor(total * r / sr));
    let rest = total - counts.reduce((a, b) => a + b, 0);
    for (let i = R - 1; rest > 0; i = (i - 1 + R) % R, rest--) counts[i]++;
    const pts = [];
    radii.forEach((r, i) => { const n = counts[i]; for (let j = 0; j < n; j++) pts.push({ a: Math.PI * (1 - (n === 1 ? 0.5 : j / (n - 1))), r }); });
    pts.sort((p, q) => q.a - p.a || q.r - p.r);
    const dot = Math.min(0.045, 0.42 * (1 - r0) / R);
    let k = 0, svg = '';
    for (const [party, n] of entries) {
      for (let i = 0; i < n; i++, k++) {
        const p = pts[k];
        svg += `<circle cx="${(p.r * Math.cos(p.a)).toFixed(3)}" cy="${(-p.r * Math.sin(p.a)).toFixed(3)}" r="${dot.toFixed(3)}" fill="${pColor(party)}"><title>${esc(pLabel(party))}: ${n}</title></circle>`;
      }
    }
    return `<svg class="hemi" viewBox="-1.06 -1.06 2.12 1.12" role="img" aria-label="Meclis sandalye dağılımı, ${total} sandalye">${svg}<text x="0" y="-0.05" text-anchor="middle" font-size="0.16" font-weight="700" fill="#1f2328">${total}</text></svg>`;
  }

  // ------------------------------------------------------------------ il tablosu
  let tableSort = 'value';
  function rowValue(u) {
    if (state.mode === 'winner') return u.winner && u.pct ? (u.pct[u.winner] ?? null) : (u.total ?? null);
    return unitValue(u, state.mode);
  }
  function fmtValue(v) {
    if (v == null) return '–';
    if (state.mode === 'count') return nf.format(v);
    if (state.mode === 'swing') return sgn(v);
    if (state.mode === 'winner' && state.data.metric === 'members' && !Object.values(state.data.units).some((u) => u.pct)) return nf.format(v);
    return pf(v);
  }
  function renderTable() {
    const d = state.data, box = $('#tableBox');
    const rows = Object.entries(d.units || {}).filter(([, u]) => !u.nodata);
    if (!rows.length || !state.mode) { box.innerHTML = ''; return; }
    const head = { winner: d.type === 'referandum' ? 'Sonuç' : 'Birinci', party: pLabel(state.party || ''), share: pLabel(state.party || ''),
                   swing: pLabel(state.party || '') + ' (puan)', turnout: 'Katılım', count: d.id === '1930yerel' ? 'SCF' : 'Vekil' }[state.mode];
    const data = rows.map(([k, u]) => ({ k, u, v: rowValue(u) }));
    if (tableSort === 'name') data.sort((a, b) => a.u.name.localeCompare(b.u.name, 'tr'));
    else data.sort((a, b) => (b.v ?? -1e9) - (a.v ?? -1e9));
    const open = box.querySelector('details') ? box.querySelector('details').open : false;
    let h = `<details${open ? ' open' : ''}><summary>Birim tablosu (${rows.length})</summary><table class="utable"><thead><tr>` +
      `<th><button type="button" data-sort="name" class="${tableSort === 'name' ? 'on' : ''}">Birim</button></th>` +
      (state.mode === 'winner' ? '<th>Birinci</th>' : '') +
      `<th class="num"><button type="button" data-sort="value" class="${tableSort === 'value' ? 'on' : ''}">${esc(state.mode === 'winner' ? (d.metric === 'members' && !rows.some(([, u]) => u.pct) ? 'Vekil' : 'Oran') : head)}</button></th></tr></thead><tbody>`;
    for (const { k, u, v } of data) {
      h += `<tr data-u="${esc(k)}" class="${k === state.unit ? 'sel' : ''}"><td>${esc(u.name)}</td>` +
        (state.mode === 'winner' ? `<td>${u.winner ? `<span class="sw" style="background:${pColor(u.winner)}"></span>${esc(pLabel(u.winner))}` : '–'}</td>` : '') +
        `<td class="num">${fmtValue(v)}</td></tr>`;
    }
    h += '</tbody></table></details>';
    box.innerHTML = h;
    box.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { tableSort = b.dataset.sort; renderTable(); }));
    box.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => selectUnit(tr.dataset.u)));
  }

  // ------------------------------------------------------------------ CSV ve paylaşım
  function csvCell(x) { const t = x == null ? '' : String(x); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function downloadCsv() {
    const d = state.data;
    const units = Object.entries(d.units || {});
    const keys = new Set();
    units.forEach(([, u]) => ['pct', 'votes', 'seats'].forEach((f) => Object.keys(u[f] || {}).forEach((k) => keys.add(k))));
    const groups = [...keys];
    const head = ['birim_id', 'birim', 'birinci', 'secmen', 'gecerli_oy', 'katilim', 'vekil_listede', 'vekil_ilk', 'not'];
    groups.forEach((g) => head.push(g + ' oy', g + ' %', g + ' sandalye'));
    const lines = [head.map(csvCell).join(';')];
    for (const [k, u] of units) {
      const r = [k, u.name, u.winner, u.voters, u.valid, u.turnout, u.total, u.initial, u.note || (u.nodata ? 'veri yok' : '')];
      groups.forEach((g) => r.push(u.votes && u.votes[g], u.pct && u.pct[g] != null ? String(u.pct[g]).replace('.', ',') : '', u.seats && u.seats[g]));
      lines.push(r.map(csvCell).join(';'));
    }
    lines.push('', csvCell('Kaynak: ' + (d.sources || []).map((x) => x.name + ' ' + x.url).join(' | ')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `secim-${d.id}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function copyLink(btn) {
    const old = btn.textContent;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Kopyalandı'; }
    catch (e) { window.prompt('Bağlantıyı kopyalayın:', location.href); }
    setTimeout(() => { btn.textContent = old; }, 1500);
  }

  // ------------------------------------------------------------------ zaman atlamalı oynatma
  const SPEEDS = { 0.5: 3200, 1: 1800, 2: 900, 4: 450 };
  function playList() {
    return filtered().filter((e) => !state.play.skipEmpty || (e.geo && e.units > 0));
  }
  function updateYearBadge() {
    const b = $('#yearBadge');
    if (!state.play.on || !state.cur) { b.hidden = true; return; }
    const list = playList(), i = list.findIndex((e) => e.id === state.cur.id);
    b.hidden = false;
    b.innerHTML = `<span class="y">${esc(state.cur.date.slice(0, 4))}</span><span class="t">${esc(state.cur.title.replace(/^\d{4}\s*/, ''))}</span><span class="n">${i + 1} / ${list.length}</span>`;
  }
  function setPlayUi() {
    const b = $('#playBtn');
    b.textContent = state.play.on ? '❚❚ Durdur' : '▶ Oynat';
    b.setAttribute('aria-pressed', String(state.play.on));
    b.classList.toggle('on', state.play.on);
  }
  async function playStep() {
    if (!state.play.on) return;
    const list = playList();
    let i = list.findIndex((e) => e.id === state.cur.id);
    const next = list[i + 1];
    if (!next) { stopPlay(); return; }
    // bir sonrakini önceden yükle
    const after = list[i + 2];
    if (after) { loadElection(after.id).then((x) => x.geo && loadGeo(x.geo)).catch(() => {}); }
    await go(next.id, { keepMode: true, fromPlay: true });
    if (state.play.on) state.play.timer = setTimeout(playStep, SPEEDS[state.play.speed]);
  }
  async function startPlay() {
    const list = playList();
    if (!list.length) return;
    state.play.on = true; setPlayUi();
    // sondaysa ya da listede değilse baştan başla
    let i = list.findIndex((e) => e.id === state.cur.id);
    if (i < 0 || i === list.length - 1) { await go(list[0].id, { keepMode: true, fromPlay: true }); }
    updateYearBadge();
    state.play.timer = setTimeout(playStep, SPEEDS[state.play.speed]);
  }
  function stopPlay() {
    state.play.on = false; clearTimeout(state.play.timer); state.play.timer = null;
    setPlayUi(); updateYearBadge();
  }
  function togglePlay() { state.play.on ? stopPlay() : startPlay(); }

  function renderNotes() {
    const d = state.data;
    let h = '';
    if (d.notes && d.notes.length) h += '<h3>Notlar</h3>' + d.notes.filter(Boolean).map((n) => `<p class="note">${esc(n)}</p>`).join('');
    if (d.sources && d.sources.length) h += '<h3>Kaynak</h3>' + d.sources.map((s) => `<p class="src"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></p>`).join('');
    $('#notesBox').innerHTML = h;
  }

  function selectUnit(id) {
    state.unit = id;
    restyle(); renderUnit(); renderTable(); writeHash();
  }

  // ------------------------------------------------------------------ seçim seçimi
  function filtered() {
    return state.index.filter((e) => (state.era === 'all' || e.era === state.era) && state.types.has(e.type));
  }
  function renderSelect() {
    const sel = $('#electionSelect'), list = filtered();
    const groups = { osmanli: [], cumhuriyet: [] };
    list.forEach((e) => groups[e.era].push(e));
    let h = '';
    for (const [era, arr] of Object.entries(groups)) {
      if (!arr.length) continue;
      h += `<optgroup label="${ERA_LABEL[era]}">` + arr.map((e) => `<option value="${e.id}">${esc(e.title)}${e.units === 0 && e.geo ? ' — sınırlar' : ''}</option>`).join('') + '</optgroup>';
    }
    if (state.cur && !list.includes(state.cur)) h += `<option value="${state.cur.id}">${esc(state.cur.title)} (filtre dışı)</option>`;
    sel.innerHTML = h;
    if (state.cur) sel.value = state.cur.id;
  }
  function renderChips() {
    $('#typeChips').innerHTML = Object.entries(TYPES).map(([k, t]) =>
      `<button type="button" class="chip ${state.types.has(k) ? 'on' : ''}" data-type="${k}" aria-pressed="${state.types.has(k)}"><span class="dot" style="background:${t.color}"></span>${t.label}</button>`).join('');
    document.querySelectorAll('#typeChips .chip').forEach((c) => c.addEventListener('click', () => {
      const k = c.dataset.type;
      if (state.types.has(k)) { if (state.types.size > 1) state.types.delete(k); } else state.types.add(k);
      renderChips(); renderSelect(); renderTimeline();
    }));
  }

  const Y0 = 1836, Y1 = 2030;
  function yearFrac(date) {
    const [y, m, d] = date.split('-').map(Number);
    return y + ((m || 1) - 1) / 12 + ((d || 1) - 1) / 365;
  }
  function renderTimeline() {
    const tl = $('#timeline');
    const W = Math.max(tl.clientWidth, (Y1 - Y0) * 7);
    const x = (y) => (y - Y0) / (Y1 - Y0) * W;
    let h = `<div class="track" style="width:${W}px"><div class="axis"></div>`;
    for (let y = 1840; y <= 2020; y += 10) h += `<span class="tick" style="left:${x(y)}px">${y}</span>`;
    h += `<span class="era-band" style="left:${x(1836)}px">Osmanlı</span><span class="era-band" style="left:${x(1923.83)}px">Cumhuriyet (29 Ekim 1923)</span>`;
    const used = {};
    filtered().forEach((e) => {
      let px = Math.round(x(yearFrac(e.date)));
      while (used[px] || used[px - 1] || used[px + 1] || used[px - 2] || used[px + 2] || used[px - 3] || used[px + 3]) px += 7;
      used[px] = 1;
      const c = (TYPES[e.type] || {}).color;
      h += `<button type="button" class="ev ${state.cur && e.id === state.cur.id ? 'sel' : ''}" data-id="${e.id}" style="left:${px}px;background:${c}" title="${esc(e.title)} — ${esc(e.dateLabel || e.date)}" aria-label="${esc(e.title)}"></button>`;
    });
    h += '</div>';
    tl.innerHTML = h;
    tl.querySelectorAll('.ev').forEach((b) => b.addEventListener('click', () => go(b.dataset.id)));
    const s = tl.querySelector('.ev.sel');
    if (s) { const left = s.offsetLeft - tl.clientWidth / 2; if (left < tl.scrollLeft || s.offsetLeft > tl.scrollLeft + tl.clientWidth - 20) tl.scrollLeft = Math.max(0, left); }
  }

  async function go(id, opts = {}) {
    if (state.play.on && !opts.fromPlay) stopPlay();
    const meta = state.index.find((e) => e.id === id) || state.index[state.index.length - 1];
    state.cur = meta;
    $('#electionSelect').value = meta.id;
    let d;
    try { d = await loadElection(meta.id); } catch (e) { $('#electionInfo').innerHTML = `<p class="note warn">Veri yüklenemedi: ${esc(e.message)}</p>`; return; }
    if (state.cur !== meta) return;
    indexUnits(d);
    const pm = prevMetaFor(d);
    state.prev = null;
    if (pm) { try { state.prev = await loadElection(pm.id); indexUnits(state.prev); } catch (e) { state.prev = null; } }
    if (state.cur !== meta) return;
    state.data = d;
    const ms = modesFor(d).map((m) => m[0]);
    if (opts.mode && ms.includes(opts.mode)) state.mode = opts.mode;
    else if (!ms.includes(state.mode) || (d.defaultMode && !opts.keepMode)) state.mode = (d.defaultMode && ms.includes(d.defaultMode)) ? d.defaultMode : (ms.includes('winner') ? 'winner' : ms[0] || null);
    const choices = partyChoices(d, state.mode);
    if (opts.party && choices.includes(opts.party)) state.party = opts.party;
    else if (!choices.includes(state.party)) state.party = choices[0];
    if (!(opts.unit && d.units[opts.unit])) { if (!(state.unit && d.units[state.unit])) state.unit = null; } else state.unit = opts.unit;
    renderElectionInfo(); renderModes(); renderUnit(); renderTable(); renderNotes(); renderTimeline();
    await draw();
    writeHash();
    updateYearBadge();
  }
  function step(dir) {
    const list = filtered();
    if (!list.length) return;
    let i = list.findIndex((e) => e.id === state.cur.id);
    if (i < 0) {  // seçili kayıt filtre dışında: tarihine en yakın komşuya git
      let k = list.findIndex((e) => e.date > state.cur.date);
      if (k < 0) k = list.length;
      i = dir > 0 ? k - 1 : k;
    }
    const j = Math.max(0, Math.min(list.length - 1, i + dir));
    if (list[j]) go(list[j].id, { keepMode: true });
  }

  // ------------------------------------------------------------------ adres (#e=...&u=...&m=...&p=...)
  function readHash() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    return { e: p.get('e'), u: p.get('u'), m: p.get('m'), p: p.get('p') };
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (state.cur) p.set('e', state.cur.id);
    if (state.unit) p.set('u', state.unit);
    if (state.mode) p.set('m', state.mode);
    if ((state.mode === 'party' || state.mode === 'share' || state.mode === 'swing') && state.party) p.set('p', state.party);
    history.replaceState(null, '', '#' + p.toString());
  }

  // ------------------------------------------------------------------ tema (sistem / açık / koyu)
  const THEME_LABEL = { auto: 'Tema: Sistem', light: 'Tema: Açık', dark: 'Tema: Koyu' };
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function themePref() { return localStorage.getItem('theme') || 'auto'; }
  function applyTheme(rerender) {
    const pref = themePref();
    const dark = pref === 'dark' || (pref === 'auto' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    T = dark ? THEMES.dark : THEMES.light; NODATA = T.nodata; RAMP_LO = T.lo;
    const b = $('#themeBtn'); if (b) { b.textContent = THEME_LABEL[pref]; b.setAttribute('aria-label', THEME_LABEL[pref] + ' (değiştirmek için tıklayın)'); }
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#16191d' : '#8d1c1c');
    if (rerender && state.data) {
      if (worldLayer) worldLayer.setStyle(() => ({ fillColor: T.land, fillOpacity: 1, color: T.landStroke, weight: 0.6 }));
      renderElectionInfo(); renderModes(); renderUnit(); renderTable(); renderChips(); restyle();
    }
  }
  function cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    localStorage.setItem('theme', order[(order.indexOf(themePref()) + 1) % 3]);
    applyTheme(true);
  }

  // ------------------------------------------------------------------ başlat
  async function init() {
    applyTheme(false);
    mq.addEventListener('change', () => { if (themePref() === 'auto') applyTheme(true); });
    map.on('zoomend', () => { if (state.data) restyle(); });
    const [idx, parties] = await Promise.all([getJSON('data/index.json'), getJSON('data/parties.json')]);
    state.index = idx; state.parties = parties;
    renderChips(); renderSelect();
    document.querySelectorAll('#eraSeg button').forEach((b) => b.addEventListener('click', () => {
      state.era = b.dataset.era;
      document.querySelectorAll('#eraSeg button').forEach((x) => x.classList.toggle('active', x === b));
      renderSelect(); renderTimeline();
      const list = filtered();
      if (list.length && !list.includes(state.cur)) go(state.era === 'osmanli' ? list[0].id : list[list.length - 1].id);
    }));
    $('#electionSelect').addEventListener('change', (e) => go(e.target.value, { keepMode: true }));
    $('#prevBtn').addEventListener('click', () => step(-1));
    $('#nextBtn').addEventListener('click', () => step(1));
    $('#aboutBtn').addEventListener('click', () => $('#about').showModal());
    $('#themeBtn').addEventListener('click', cycleTheme);
    $('#playBtn').addEventListener('click', togglePlay);
    $('#speedSel').addEventListener('change', (e) => { state.play.speed = Number(e.target.value); });
    $('#skipEmpty').addEventListener('change', (e) => { state.play.skipEmpty = e.target.checked; updateYearBadge(); });
    $('#csvBtn').addEventListener('click', downloadCsv);
    $('#shareBtn').addEventListener('click', (e) => copyLink(e.currentTarget));
    $('#version').textContent = 'Sürüm ' + VERSION;
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('select, input, textarea, dialog[open]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
    });
    window.addEventListener('resize', () => renderTimeline());
    window.addEventListener('hashchange', () => {
      const h = readHash();
      if (h.e && state.index.some((e) => e.id === h.e) && (!state.cur || h.e !== state.cur.id || h.u !== state.unit)) go(h.e, { unit: h.u, mode: h.m, party: h.p });
    });
    await loadWorld();
    const h = readHash();
    const def = state.index.filter((e) => e.type === 'genel' && e.units > 0).slice(-1)[0];
    await go(h.e && state.index.some((e) => e.id === h.e) ? h.e : def.id, { unit: h.u, mode: h.m, party: h.p });
  }
  init().catch((e) => { console.error(e); $('#electionInfo').innerHTML = `<p class="note warn">Uygulama başlatılamadı: ${esc(e.message)}</p>`; });
})();
