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
                  play: { on: false, timer: null, speed: 1, skipEmpty: true, lastDate: null },
                  cmp: { on: false, id: null, data: null, ctx: null }, hist: null, demo: null };
  const VERSION = '3.0.2';
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
  const pFull = (k, d = state.data) => (d && d.partyNames && d.partyNames[k]) || '';
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
    worldFc = fc;
    worldLayer = L.geoJSON(fc, { interactive: false, style: () => ({ fillColor: T.land, fillOpacity: 1, color: T.landStroke, weight: 0.6 }) }).addTo(map);
    worldLayer.bringToBack();
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
  function unitValue(u, mode, c = state) {
    if (!u || u.nodata) return null;
    switch (mode) {
      case 'party': return u.pct ? (u.pct[c.party] ?? (u.unknownVotes && u.unknownVotes.includes(c.party) ? null : (u.pct && Object.keys(u.pct).length ? 0 : null))) : null;
      case 'share': return u.seats && u.initial ? 100 * (u.seats[c.party] || 0) / u.initial : null;
      case 'turnout': return u.turnout ?? null;
      case 'count': return u.total || 0;
      case 'swing': {
        const pu = c.prev && c.prev.units[uid(u)];
        if (!u.pct || !pu || !pu.pct || u.pct[c.party] == null || pu.pct[c.party] == null) return null;
        return u.pct[c.party] - pu.pct[c.party];
      }
      default: return null;
    }
  }
  function domain(d, mode, c = state) {
    const vals = Object.values(d.units).map((u) => unitValue(u, mode, c)).filter((v) => v != null);
    if (!vals.length) return [0, 1];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (mode === 'party' || mode === 'share') { lo = 0; hi = Math.max(10, Math.ceil(hi / 10) * 10); }
    if (mode === 'count') { lo = 0; }
    if (mode === 'turnout') { lo = Math.floor(lo / 5) * 5; hi = Math.ceil(hi / 5) * 5; }
    if (mode === 'swing') { const m = Math.max(5, Math.ceil(Math.max(Math.abs(lo), Math.abs(hi)) / 5) * 5); lo = -m; hi = m; }
    if (hi === lo) hi = lo + 1;
    return [lo, hi];
  }
  function rampColor(mode, c = state) {
    if (mode === 'party' || mode === 'share') return pColor(c.party);
    if (mode === 'turnout') return T.turnout;
    if (c.data && c.data.id === '1930yerel') return pColor('Serbest Cumhuriyet Fırkası');
    return T.ramp;
  }

  function styleFor(u, c = state) {
    const d = c.data, mode = c.mode;
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
    const v = unitValue(u, mode, c);
    if (v == null) return { ...base, fillColor: NODATA };
    const [lo, hi] = c.dom || domain(d, mode, c);
    if (mode === 'swing') {
      const t = Math.max(-1, Math.min(1, v / hi));
      return { ...base, fillColor: t >= 0 ? mix(RAMP_LO, SWING_UP, 0.1 + 0.9 * t) : mix(RAMP_LO, SWING_DOWN, 0.1 + 0.9 * -t) };
    }
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return { ...base, fillColor: mix(RAMP_LO, rampColor(mode, c), 0.08 + 0.92 * t) };
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
    if (map.getSize().x > 0) state.mapFitted = true;
    const fam = d.geo.startsWith('h-1877') || ['h-1908', 'h-1912', 'h-1914'].includes(d.geo) ? 'otto' : 'tr';
    if (fam !== state.geoFamily) {
      map.fitBounds(unitLayer.getBounds(), { padding: [12, 12] });
      state.geoFamily = fam;
    }
    markSelected();
    renderLegend();
    if (state.cmp.on) { drawCompare(); renderCompareBox(); }
  }
  function borderWeight() {
    const z = map.getZoom();
    return z <= 4.5 ? 0.4 : z <= 5.5 ? 0.6 : z <= 6.5 ? 0.8 : z <= 7.5 ? 1.1 : 1.4;
  }
  function updateDomain() {
    const m = state.mode;
    state.dom = (state.data && m && m !== 'winner') ? domain(state.data, m) : null;
    const c = state.cmp.on && state.cmp.data ? cmpCtx() : null;
    state.cmp.ctx = c;
    if (c && c.mode && c.mode !== 'winner') {
      c.dom = domain(c.data, c.mode, c);
      // aynı görünüm ve partide iki harita aynı renk ölçeğini kullanır
      if (state.dom && c.mode === m && c.party === state.party && m !== 'count') {
        state.dom = c.dom = [Math.min(state.dom[0], c.dom[0]), Math.max(state.dom[1], c.dom[1])];
        state.cmp.shared = true;
      } else state.cmp.shared = false;
    }
  }
  function restyle() {
    updateDomain();
    if (unitLayer) unitLayer.setStyle((f) => styleFor(state.data.units[f.properties.id]));
    markSelected();
    renderLegend();
    if (state.cmp.on) { restyleCompare(); renderCompareBox(); }
    renderDemo();
  }
  function markSelected() {
    if (!state.unit) return;
    for (const lay of [unitLayer, layer2]) {
      if (lay) lay.eachLayer((l) => { if (l.feature.properties.id === state.unit) { l.setStyle({ weight: borderWeight() + 1.8, color: T.sel }); l.bringToFront(); } });
    }
    if (hatchLayer) hatchLayer.bringToFront();
  }

  function tooltipHtml(f, c = state) {
    const d = c.data, u = d.units[f.properties.id];
    const name = esc((u && u.name) || f.properties.name);
    if (!u || u.nodata) return `<b>${name}</b><span class="muted">${u && u.note ? esc(u.note) : 'Veri yok'}</span>`;
    const parts = [];
    if (c.mode === 'winner' && u.winner) parts.push(`${esc(pFull(u.winner, d) || pLabel(u.winner))}${u.pct && u.pct[u.winner] != null ? ' ' + pf(u.pct[u.winner]) : ''}`);
    else if (c.mode === 'party' || c.mode === 'share') parts.push(`${esc(pLabel(c.party))}: ${pf(unitValue(u, c.mode, c))}`);
    else if (c.mode === 'turnout') parts.push('Katılım ' + pf(u.turnout));
    else if (c.mode === 'swing') { const v = unitValue(u, 'swing', c); parts.push(`${esc(pLabel(c.party))}: ${v == null ? 'karşılaştırılamaz' : sgn(v) + ' puan'}`); }
    else if (c.mode === 'count') parts.push(d.id === '1930yerel' ? `SCF: ${u.total} belediye` : `${u.initial ?? u.total} vekil${u.total > (u.initial ?? u.total) ? ` (+${u.total - u.initial} sonradan)` : ''}`);
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
    if (state.cmp.on && state.cmp.ctx) html += `<div class="muted" style="margin-top:4px">${state.cmp.shared ? 'Renk ölçeği iki harita için ortak.' : 'Sağ harita: ' + esc((modesFor(state.cmp.data).find((m) => m[0] === state.cmp.ctx.mode) || [, ''])[1]) + (state.cmp.ctx.party && state.cmp.ctx.mode !== 'winner' ? ' · ' + esc(pLabel(state.cmp.ctx.party)) : '')}</div>`;
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
      const tag = opts.click ? `button type="button" class="bar clickable" data-k="${esc(k)}" aria-label="${esc(pLabel(k))}: parti geçmişini göster"` : 'div class="bar"';
      return `<${tag}><span class="lab" title="${esc(pFull(k) || k)}"><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))}</span>` +
        `<span class="tr"><span class="fl" style="display:block;width:${w}%;background:${pColor(k)}"></span></span>` +
        `<span class="val">${val}${extra ? ' · ' + extra : ''}</span></${opts.click ? 'button' : 'div'}>`;
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
    h += '<div id="ctxLine"></div>';
    if (d.reliability) h += `<p class="note rel-note"><b>Veri güvenilirliği — ${esc(d.reliability.label)}:</b> ${esc(d.reliability.why)}</p>`;

    const n = d.national || {};
    if (n.pct && Object.keys(n.pct).length) {
      const ent = Object.entries(n.pct).filter(([k]) => k !== 'Diğer').slice(0, 8)
        .map(([k, v]) => [k, v, n.seats && n.seats[k] ? `${n.seats[k]} snd.` : '']);
      const label = d.type === 'referandum' ? 'Ülke geneli' : d.type === 'cumhurbaskanligi' ? 'Ülke geneli (aday)' : 'Ülke geneli oy';
      const canHist = d.era === 'cumhuriyet' && d.metric === 'votes' && d.type !== 'ara';
      h += `<h3>${label}</h3>` + bars(ent, 100, { pct: true, max: Math.max(...ent.map((e) => e[1])), click: canHist });
      if (canHist) h += '<p class="hint small">Bir partiye tıklayınca haritada oy oranı ve aşağıda geçmişi gösterilir.</p><div id="partyHist"></div>';
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
    // 1950 öncesi genel seçimler: meclis grafiği (listedeki vekiller; grup verisi yoksa tek renk)
    if (d.type === 'genel' && !(n.pct && Object.keys(n.pct).length) && (n.members_initial || (n.seats && Object.keys(n.seats).length))) {
      const ent = n.seats && Object.keys(n.seats).length ? Object.entries(n.seats).filter((e) => e[1] > 0) : [['Bilinmiyor', n.members_initial]];
      h += `<h3>Meclis dağılımı${d.groupLabel ? ' — ' + esc(d.groupLabel.toLocaleLowerCase('tr')) : ''}</h3>` + hemicycle(ent) +
        `<p class="hint small">${n.seats && Object.keys(n.seats).length ? 'Dönem listesinden sayılan vekiller; gruplama kaynağın sınıflandırmasıdır.' : 'Dönem listesindeki vekil sayısı; grup (parti) verisi derlenmedi.'}</p>`;
    }
    if (n.members_listed != null) {
      h += `<dl class="kv">${n.total_seats ? `<dt>Toplam sandalye</dt><dd>${nf.format(n.total_seats)}</dd>` : ''}<dt>Listedeki vekil</dt><dd>${nf.format(n.members_listed)}</dd>`;
      if (n.members_initial !== n.members_listed) h += `<dt>Sonradan katılan hariç</dt><dd>${nf.format(n.members_initial)}</dd>`;
      h += '</dl>';
    }
    if (n.turnout_note) h += `<p class="note">${esc(n.turnout_note)}</p>`;
    $('#electionInfo').innerHTML = h;
    document.querySelectorAll('#electionInfo .bar.clickable').forEach((b) => b.addEventListener('click', () => {
      state.party = b.dataset.k;
      if (modesFor(state.data).some((m) => m[0] === 'party')) setMode('party'); else restyle();
      renderPartyHistory(b.dataset.k);
    }));
    if (partyHistKey && state.data.national && state.data.national.pct && state.data.national.pct[partyHistKey] != null) renderPartyHistory(partyHistKey);
    if (state.hist) renderContextLine(); else loadHistory().then(renderContextLine).catch(() => {});
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
    if (d.geo && d.geo.startsWith('tr-')) {
      if (state.demo) unitDemoRows(state.unit).forEach((r) => kv.push([r[0], r[1]]));
      else loadDemo().then(() => { if (state.unit) renderUnit(); }).catch(() => {});
    }
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

  // ------------------------------------------------------------------ parti geçmişi (aynı türdeki seçimlerde ülke geneli oy)
  let partyHistKey = null;
  async function renderPartyHistory(key) {
    partyHistKey = key;
    const d = state.data, box = $('#partyHist');
    if (!box) return;
    box.innerHTML = '<p class="hint">Yükleniyor…</p>';
    const name = pFull(key) || key;
    const fam = family(state.cur);
    const metas = state.index.filter((e) => family(e) === fam && e.metric === 'votes' && e.era === 'cumhuriyet');
    const datas = await Promise.all(metas.map((e) => loadElection(e.id).catch(() => null)));
    if (state.data !== d || partyHistKey !== key) return;
    // aynı kısaltma farklı yıllarda farklı partiyi gösterebilir: tam adı aynı olanları al
    const pts = metas.map((e, i) => {
      const x = datas[i]; if (!x || !x.national || !x.national.pct) return null;
      const v = x.national.pct[key]; if (v == null) return null;
      const n = (x.partyNames && x.partyNames[key]) || key;
      if (n !== name) return null;
      return { e, y: Number(e.date.slice(0, 4)) + (e.date.slice(5, 7) - 1) / 12, v, seats: x.national.seats && x.national.seats[key] };
    }).filter(Boolean);
    // parti bir seçime girmediyse (ör. CHP 1983–1991) çizgi o aralıkta kesilir
    const segs = []; let cur = [];
    metas.forEach((e) => { const p = pts.find((q) => q.e === e); if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    if (pts.length < 2) { box.innerHTML = `<p class="note">${esc(name)}: aynı türden karşılaştırılabilir başka seçim yok.</p>`; return; }
    const W = 330, H = 120, x0 = pts[0].y, x1 = pts[pts.length - 1].y, ymax = Math.max(10, Math.ceil(Math.max(...pts.map((p) => p.v)) / 10) * 10);
    const X = (x) => 26 + (x - x0) / Math.max(1, x1 - x0) * (W - 38), Y = (y) => H - 16 - y / ymax * (H - 28);
    const c = pColor(key);
    let svg = `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} ülke geneli oy oranı">` +
      `<line x1="26" x2="${W - 12}" y1="${Y(0)}" y2="${Y(0)}"/><line x1="26" x2="${W - 12}" y1="${Y(ymax / 2)}" y2="${Y(ymax / 2)}" stroke-dasharray="2 3"/>` +
      `<text x="2" y="${Y(ymax) + 4}" font-size="9">%${ymax}</text><text x="2" y="${Y(ymax / 2) + 3}" font-size="9">%${ymax / 2}</text>` +
      segs.map((sg) => `<polyline fill="none" stroke="${c}" stroke-width="2.2" points="${sg.map((p) => X(p.y) + ',' + Y(p.v)).join(' ')}"/>`).join('');
    for (const p of pts) svg += `<circle class="pt${p.e.id === d.id ? ' cur' : ''}" data-e="${esc(p.e.id)}" cx="${X(p.y)}" cy="${Y(p.v)}" r="${p.e.id === d.id ? 4.5 : 3.2}" fill="${c}"><title>${esc(p.e.title)}: ${pf(p.v)}${p.seats ? ' · ' + p.seats + ' sandalye' : ''}</title></circle>`;
    svg += `<text x="26" y="${H - 3}" font-size="9">${Math.floor(x0)}</text><text x="${W - 12}" y="${H - 3}" font-size="9" text-anchor="end">${Math.floor(x1)}</text></svg>`;
    const best = pts.reduce((a, b) => (b.v > a.v ? b : a));
    box.innerHTML = `<div class="ph"><div class="ph-t"><span class="sw" style="background:${c}"></span><b>${esc(name)}</b> — ülke geneli oy, ${pts.length} seçim</div>${svg}` +
      `<div class="muted small">En yüksek: ${pf(best.v)} (${esc(best.e.date.slice(0, 4))}).${segs.length > 1 ? ' Çizgideki boşluklar, partinin listede ayrı yer almadığı seçimlerdir.' : ''} Noktaya tıklayınca o seçime geçilir.</div>` +
      '<details class="lin" id="partyLin" open><summary>Parti tarihçesi: kuruluş, kapanış, ad değişikliği, öncül ve ardıllar</summary><div class="lin-b">Yükleniyor…</div></details></div>';
    box.querySelectorAll('circle.pt').forEach((cc) => cc.addEventListener('click', () => go(cc.dataset.e, { keepMode: true })));
    loadHistory().then(() => {
      const lb = document.querySelector('#partyLin .lin-b'); if (!lb || partyHistKey !== key) return;
      const pr = findParty(name, d.date);
      lb.innerHTML = pr ? lineageHtml(pr) + '<button type="button" class="linkbtn" id="linOpen">Bütün partiler zaman çizelgesinde</button>' : `<p class="note">${esc(name)} için parti maddesi derlenmedi.</p>`;
      bindLineage(lb);
      const ob = document.getElementById('linOpen');
      if (ob) ob.addEventListener('click', () => window.AtlasHistory && window.AtlasHistory.open('parties', d.date, pr.title));
    }).catch(() => {});
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
    box.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => selectUnit(tr.dataset.u, true)));
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
    const old = btn.innerHTML;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Kopyalandı ✓'; }
    catch (e) { window.prompt('Bağlantıyı kopyalayın:', location.href); }
    setTimeout(() => { btn.innerHTML = old; }, 1500);
  }

  // ------------------------------------------------------------------ zaman atlamalı oynatma
  const SPEEDS = { 0.5: 3200, 1: 1800, 2: 900, 4: 450 };
  function playList() {
    return filtered().filter((e) => !state.play.skipEmpty || (e.geo && e.units > 0));
  }
  function updateYearBadge() {
    const b = $('#yearBadge');
    if (!state.play.on || !state.cur) { b.hidden = true; renderTicker(); return; }
    const list = playList(), i = list.findIndex((e) => e.id === state.cur.id);
    b.hidden = false;
    b.innerHTML = `<span class="y">${esc(state.cur.date.slice(0, 4))}</span><span class="t">${esc(state.cur.title.replace(/^\d{4}\s*/, ''))}</span><span class="n">${i + 1} / ${list.length}</span>`;
    renderTicker();
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
    state.play.lastDate = state.cur.date;
    await go(next.id, { keepMode: true, fromPlay: true });
    if (state.play.on) state.play.timer = setTimeout(playStep, SPEEDS[state.play.speed]);
  }
  async function startPlay() {
    const list = playList();
    if (!list.length) return;
    if (state.cmp.on) await setCompare(false);
    loadHistory().catch(() => {});
    state.play.on = true; state.play.lastDate = null; setPlayUi();
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

  function selectUnit(id, zoom) {
    state.unit = id;
    restyle(); renderUnit(); renderTable(); writeHash();
    if (zoom && unitLayer) unitLayer.eachLayer((l) => { if (l.feature.properties.id === id) map.flyToBounds(l.getBounds(), { maxZoom: 7.5, padding: [40, 40], duration: 0.6 }); });
  }
  function renderSearch() {
    const d = state.data, dl = $('#unitList'), inp = $('#unitSearch');
    const units = Object.entries((d && d.units) || {}).filter(([, u]) => !u.nodata).sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));
    inp.disabled = !units.length || !d.geo;
    inp.placeholder = d && d.level === 'vilayet' ? 'Vilayet ara…' : d && d.level === 'sancak' ? 'Sancak / vilayet ara…' : 'İl ara…';
    dl.innerHTML = units.map(([, u]) => `<option value="${esc(u.name)}"></option>`).join('');
  }
  function searchPick() {
    const v = $('#unitSearch').value.trim().toLocaleLowerCase('tr');
    if (!v || !state.data) return;
    const ents = Object.entries(state.data.units).filter(([, u]) => !u.nodata);
    const hit = ents.find(([, u]) => u.name.toLocaleLowerCase('tr') === v) || ents.find(([, u]) => u.name.toLocaleLowerCase('tr').includes(v));
    if (hit) { selectUnit(hit[0], true); $('#unitSearch').value = ''; $('#unitSearch').blur(); }
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

  let loadingTimer = null;
  function setLoading(on) {
    clearTimeout(loadingTimer);
    const el = $('#loading');
    if (on) loadingTimer = setTimeout(() => { el.hidden = false; }, 180);
    else el.hidden = true;
  }
  async function go(id, opts = {}) {
    if (state.play.on && !opts.fromPlay) stopPlay();
    setLoading(true);
    try { await goInner(id, opts); } finally { setLoading(false); }
  }
  async function goInner(id, opts = {}) {
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
    renderElectionInfo(); renderModes(); renderUnit(); renderTable(); renderNotes(); renderTimeline(); renderSearch(); renderDemo();
    await draw();
    writeHash();
    updateYearBadge();
    if (!opts.fromPlay) prefetchAround();
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
    return { e: p.get('e'), u: p.get('u'), m: p.get('m'), p: p.get('p'), c: p.get('c') };
  }
  function writeHash() {
    const hv = document.getElementById('historyDlg');
    if (hv && !hv.hidden) return;   // siyasi tarih açıkken adres onun
    const p = new URLSearchParams();
    if (state.cur) p.set('e', state.cur.id);
    if (state.unit) p.set('u', state.unit);
    if (state.mode) p.set('m', state.mode);
    if ((state.mode === 'party' || state.mode === 'share' || state.mode === 'swing') && state.party) p.set('p', state.party);
    if (state.cmp.on && state.cmp.id) p.set('c', state.cmp.id);
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
    const b = $('#themeBtn'); if (b) { b.innerHTML = `<span aria-hidden="true">${dark ? '☾' : '☀'}</span><span class="long"> ${THEME_LABEL[pref]}</span>`; b.title = THEME_LABEL[pref] + ' — değiştirmek için tıklayın'; b.setAttribute('aria-label', THEME_LABEL[pref] + ' (değiştirmek için tıklayın)'); }
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

  // ------------------------------------------------------------------ siyasi tarih verisi (hükûmetler, partiler, olaylar)
  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function fmtDate(s) {
    if (!s) return '';
    const [y, m, d] = String(s).split('-');
    return [d ? Number(d) : '', m ? AY[Number(m) - 1] : '', y].filter(Boolean).join(' ');
  }
  let histPromise = null;
  function loadHistory() {
    if (!histPromise) histPromise = getJSON('data/history.json?v=' + VERSION).then((h) => (state.hist = h)).catch((e) => { histPromise = null; throw e; });
    return histPromise;
  }
  const normName = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').replace(/Millî/g, 'Milli').replace(/Selâmet/g, 'Selamet').trim();
  // Tam adı ve tarihe göre parti kaydı (aynı ad farklı dönemlerde farklı partiler olabilir: DP 1946 / DP 2007)
  function findParty(name, date) {
    const H = state.hist; if (!H || !name) return null;
    const n = normName(name);
    let c = H.parties.filter((p) => normName(p.name) === n || normName(p.title) === n);
    if (!c.length) {  // eski adıyla arandıysa (ör. Güven Partisi → CGP, Muhafazakâr Parti → MÇP)
      const r = H.renames.find((x) => x.from.split(' + ').some((f) => normName(f) === n) || normName(x.to) === n);
      if (r) c = H.parties.filter((p) => p.title === r.party);
    }
    if (!c.length) return null;
    const alive = (p) => p.periods.some(([a, b]) => (!a || a <= date) && (!b || date <= b));
    return (date && c.find(alive)) || c.sort((a, b) => String(b.founded).localeCompare(String(a.founded)))[0];
  }
  function partyByTitle(t) {
    const H = state.hist; if (!H) return null;
    return H.parties.find((p) => p.title === t) || H.parties.find((p) => normName(p.title) === normName(t) || normName(p.name) === normName(t)) || null;
  }
  function partyKey(name) {
    const H = state.hist;
    return (H && H.nameKeys[name]) || (state.parties[name] ? name : null);
  }
  function lineageHtml(p) {
    if (!p) return '';
    const H = state.hist;
    const chip = (t) => {
      const q = partyByTitle(t);
      const k = q && (partyKey(q.name) || partyKey(q.title));
      const sw = k ? `<span class="sw" style="background:${pColor(k)}"></span>` : '';
      return q ? `<button type="button" class="lchip" data-t="${esc(q.title)}">${sw}${esc(t)}</button>` : `<span class="lchip off">${esc(t)}</span>`;
    };
    const per = p.periods.map(([a, b]) => `${a ? fmtDate(a) : '?'} – ${b ? fmtDate(b) : 'günümüz'}`).join('<br>');
    let h = `<div class="lin-h"><b>${esc(p.name)}</b>${p.short ? ` <span class="muted">(${esc(p.short)})</span>` : ''}</div><dl class="kv">`;
    h += `<dt>${p.alliance ? 'Kuruluş – sona eriş' : 'Faaliyet dönemi'}</dt><dd>${per}</dd>`;
    const rn = H.renames.filter((r) => r.party === p.title);
    if (rn.length) h += `<dt>Ad değişiklikleri</dt><dd>${rn.map((r) => `${esc(fmtDate(r.date))}: ${esc(r.from)} → ${esc(r.to)}${r.note ? ` <span class="muted">(${esc(r.note)})</span>` : ''}`).join('<br>')}</dd>`;
    if (p.tbmm) h += `<dt>TBMM sandalyesi</dt><dd>${p.tbmm[0]} / ${p.tbmm[1]} <span class="muted">(madde bilgi kutusundaki güncel sayı)</span></dd>`;
    h += '</dl>';
    if (p.note) h += `<p class="note">${esc(p.note)}</p>`;
    const rows = [['predecessors', 'Öncülleri (selef)'], ['successors', 'Ardılları (halef)'], ['splits', 'Ayrılanların kurduğu partiler'],
                  ['mergers', 'Birleşmeler / katılımlar'], ['alliances', 'İttifaklar']];
    for (const [k, l] of rows) if (p[k] && p[k].length) h += `<div class="lin-r"><span class="muted">${l}:</span> ${p[k].map(chip).join(' ')}</div>`;
    if (p.alliance) {
      const mem = H.parties.filter((q) => (q.alliances || []).includes(p.title) || (q.alliances || []).includes(p.name));
      if (mem.length) h += `<div class="lin-r"><span class="muted">Üye partiler (madde bağlantılarına göre):</span> ${mem.map((q) => chip(q.title)).join(' ')}</div>`;
    }
    h += `<p class="src small"><a href="${esc(p.wiki)}" target="_blank" rel="noopener">Vikipedi: ${esc(p.title)}</a> · Öncül/ardıl ve bölünme bilgisi maddenin bilgi kutusundan alınmıştır.</p>`;
    return h;
  }
  function bindLineage(box) {
    box.querySelectorAll('.lchip[data-t]').forEach((b) => b.addEventListener('click', () => {
      const q = partyByTitle(b.dataset.t);
      if (q) { box.innerHTML = lineageHtml(q); bindLineage(box); }
    }));
  }
  // seçim tarihindeki cumhurbaşkanı ve hükûmet
  function politicalContext(date) {
    const H = state.hist; if (!H || date < '1876') return null;
    const inR = (x) => x.start && x.start <= date && (!x.end || date < x.end);
    return { pres: H.presidents.find(inR), gov: H.governments.find(inR), sultan: (H.sultans || []).find(inR),
             vizier: (H.viziers || []).find(inR), tbmm: H.tbmmHead && inR(H.tbmmHead) ? H.tbmmHead : null };
  }
  function renderContextLine() {
    const box = document.getElementById('ctxLine'), d = state.data;
    if (!box || !d) return;
    const c = politicalContext(d.date);
    if (!c) { box.innerHTML = ''; return; }
    const parts = [];
    if (c.sultan) parts.push(`Padişah: <b>${esc(c.sultan.name)}</b>`);
    if (c.vizier) parts.push(`Sadrazam: <b>${esc(c.vizier.name)}</b>`);
    if (c.tbmm) parts.push(`${esc(c.tbmm.title)}: <b>${esc(c.tbmm.name)}</b>`);
    if (c.pres) parts.push(`Cumhurbaşkanı: <b>${esc(c.pres.name)}</b>`);
    if (c.gov) {
      const ps = c.gov.parties.map((p) => p.name).filter((n) => n !== 'Bağımsızlar');
      parts.push(`Hükûmet: <b>${esc(c.gov.name)}</b> (${esc(c.gov.title)} ${esc(c.gov.head)}${ps.length ? '; ' + esc(ps.join(' + ')) : ''})`);
    }
    box.innerHTML = parts.length ? `<p class="ctx">Seçim tarihinde — ${parts.join(' · ')} <button type="button" class="linkbtn" id="ctxOpen">Siyasi tarihte göster</button></p>` : '';
    const b = document.getElementById('ctxOpen');
    if (b) b.addEventListener('click', () => window.AtlasHistory && window.AtlasHistory.open('chart', d.date));
  }

  // ------------------------------------------------------------------ karşılaştırma modu (iki seçim yan yana)
  let map2 = null, layer2 = null, syncing = false, worldFc = null;
  function cmpCtx() {
    const d = state.cmp.data; if (!d) return null;
    const ms = modesFor(d).map((m) => m[0]).filter((m) => m !== 'swing');
    let mode = state.mode === 'swing' ? 'party' : state.mode;
    if (!ms.includes(mode)) mode = ms.includes('winner') ? 'winner' : ms[0] || null;
    let party = state.party;
    if ((mode === 'party' || mode === 'share') && !partyChoices(d, mode).includes(party)) {
      if (ms.includes('winner')) mode = 'winner'; else party = partyChoices(d, mode)[0];
    }
    return { data: d, mode, party, prev: null, dom: null };
  }
  function defaultCompareId() {
    const d = state.data;
    const pm = prevMetaFor(d); if (pm) return pm.id;
    const i = state.index.findIndex((e) => e.id === d.id);
    for (let j = i - 1; j >= 0; j--) if (family(state.index[j]) === family(d) && state.index[j].geo) return state.index[j].id;
    for (let j = i - 1; j >= 0; j--) if (state.index[j].geo && state.index[j].units > 0) return state.index[j].id;
    return state.index.find((e) => e.geo && e.id !== d.id).id;
  }
  function ensureMap2() {
    if (map2) return;
    const el = document.createElement('div');
    el.id = 'map2'; el.setAttribute('aria-label', 'Karşılaştırılan seçimin haritası');
    $('.map-wrap').appendChild(el);
    const lab = document.createElement('div'); lab.className = 'cmp-label b'; lab.id = 'cmpLabelB'; el.appendChild(lab);
    map2 = L.map(el, { zoomSnap: 0.25, minZoom: 3, maxZoom: 10, zoomControl: false, attributionControl: false });
    map2.setView(map.getCenter(), map.getZoom(), { animate: false });
    if (worldFc) L.geoJSON(worldFc, { interactive: false, style: () => ({ fillColor: T.land, fillOpacity: 1, color: T.landStroke, weight: 0.6 }) }).addTo(map2);
    const sync = (a, b) => a.on('move', () => { if (syncing) return; syncing = true; b.setView(a.getCenter(), a.getZoom(), { animate: false }); syncing = false; });
    sync(map, map2); sync(map2, map);
  }
  async function drawCompare() {
    const c = state.cmp; if (!c.on || !c.data || !map2) return;
    const d = c.data;
    $('#cmpLabelB').innerHTML = `<b>Sağ:</b> ${esc(d.title)}`;
    $('#cmpLabelA').innerHTML = `<b>Sol:</b> ${esc(state.data.title)}`;
    if (!d.geo) {
      if (layer2) { map2.removeLayer(layer2); layer2 = null; }
      $('#cmpLabelB').innerHTML += ' <span class="muted">— harita verisi yok</span>';
      return;
    }
    const fc = await loadGeo(d.geo);
    if (state.cmp.data !== d) return;
    updateDomain();
    const old = layer2;
    layer2 = L.geoJSON(fc, {
      style: (f) => styleFor(d.units[f.properties.id], state.cmp.ctx),
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => { layer.setStyle({ weight: borderWeight() + 1.4, color: T.hover }); layer.bringToFront(); },
          mouseout: () => { layer2 && layer2.resetStyle(layer); markSelected(); },
          click: () => { if (state.data.units[f.properties.id]) selectUnit(f.properties.id); },
        });
        layer.bindTooltip(() => tooltipHtml(f, state.cmp.ctx), { sticky: true, className: 'unit-tip', direction: 'top', offset: [0, -6] });
      },
    }).addTo(map2);
    if (old) map2.removeLayer(old);
    if (unitLayer) unitLayer.setStyle((f) => styleFor(state.data.units[f.properties.id]));
    markSelected(); renderLegend();
  }
  function restyleCompare() {
    if (layer2 && state.cmp.ctx) layer2.setStyle((f) => styleFor(state.cmp.data.units[f.properties.id], state.cmp.ctx));
  }
  async function setCompare(on, id) {
    state.cmp.on = on;
    $('.map-wrap').classList.toggle('compare', on);
    $('#cmpBtn').classList.toggle('on', on);
    $('#cmpBtn').setAttribute('aria-pressed', String(on));
    if (!on) {
      $('#cmpBox').innerHTML = '';
      setTimeout(() => { map.invalidateSize(); if (unitLayer) map.fitBounds(unitLayer.getBounds(), { padding: [12, 12] }); }, 30);
      restyle(); writeHash(); return;
    }
    if (state.play.on) stopPlay();
    ensureMap2();
    setTimeout(() => { map.invalidateSize(); map2.invalidateSize(); if (unitLayer) map.fitBounds(unitLayer.getBounds(), { padding: [8, 8] }); map2.setView(map.getCenter(), map.getZoom(), { animate: false }); }, 30);
    await setCompareTarget(id || state.cmp.id || defaultCompareId());
  }
  async function setCompareTarget(id) {
    state.cmp.id = id;
    try { state.cmp.data = await loadElection(id); indexUnits(state.cmp.data); } catch (e) { state.cmp.data = null; }
    if (state.cmp.id !== id) return;
    await drawCompare(); renderCompareBox(); writeHash();
  }
  function renderCompareBox() {
    const box = $('#cmpBox'), A = state.data, B = state.cmp.data;
    if (!state.cmp.on || !A) { box.innerHTML = ''; return; }
    const opts = state.index.filter((e) => e.geo || e.id === state.cmp.id).map((e) => `<option value="${esc(e.id)}" ${e.id === state.cmp.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('');
    let h = `<h3>Karşılaştırma</h3><p class="hint small">Sol harita seçili seçimi, sağ harita aşağıda seçtiğiniz seçimi gösterir. Haritalar birlikte kayar ve yakınlaşır.</p>` +
      `<label class="lbl full">Sağ harita: <select id="cmpSelect" aria-label="Karşılaştırılacak seçim">${opts}</select></label>`;
    if (!B) { box.innerHTML = h; bindCmpSelect(); return; }
    const [O, N] = A.date <= B.date ? [A, B] : [B, A];
    const yr = (x) => esc(x.title.match(/\d{4}/) ? x.title : x.date.slice(0, 4));
    const ctx = state.cmp.ctx;
    const ml = (d, m) => ((modesFor(d).find((x) => x[0] === m) || [, m])[1]);
    if (ctx && ctx.mode !== state.mode) h += `<p class="note">Sağ haritada "${esc(ml(A, state.mode))}" görünümü yok; "${esc(ml(B, ctx.mode))}" gösteriliyor.</p>`;
    else if (ctx && ctx.party !== state.party && ctx.mode !== 'winner') h += `<p class="note">Sağ haritada ${esc(pLabel(state.party))} yok; ${esc(pLabel(ctx.party))} gösteriliyor.</p>`;
    if (state.cmp.shared) h += '<p class="hint small">İki harita aynı renk ölçeğini kullanır.</p>';
    // ülke geneli
    const po = (O.national && O.national.pct) || {}, pn = (N.national && N.national.pct) || {};
    if (Object.keys(po).length && Object.keys(pn).length) {
      const keys = [...new Set([...Object.keys(pn), ...Object.keys(po)])].filter((k) => k !== 'Diğer')
        .sort((a, b) => Math.max(pn[b] || 0, po[b] || 0) - Math.max(pn[a] || 0, po[a] || 0)).slice(0, 9);
      h += `<table class="utable cmp"><thead><tr><th>Ülke geneli</th><th class="num">${yr(O)}</th><th class="num">${yr(N)}</th><th class="num">Fark</th></tr></thead><tbody>` +
        keys.map((k) => {
          const a = po[k], b = pn[k], df = a != null && b != null ? b - a : null;
          return `<tr><td><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))}</td><td class="num">${a != null ? pf(a) : '–'}</td><td class="num">${b != null ? pf(b) : '–'}</td>` +
            `<td class="num ${df > 0 ? 'up' : df < 0 ? 'down' : ''}">${df != null ? sgn(df) : '–'}</td></tr>`;
        }).join('') + '</tbody></table><p class="hint small">Aynı kısaltma farklı yıllarda farklı partiye ait olabilir; tam adlar parti seçiminde yazar.</p>';
    }
    // il bazında
    const common = Object.keys(O.units).filter((k) => N.units[k] && !O.units[k].nodata && !N.units[k].nodata);
    if (!common.length) {
      h += '<p class="note">İki seçimin harita birimleri eşleşmiyor (farklı dönem sınırları ya da birim türleri). İl bazında karşılaştırma yapılamıyor.</p>';
    } else {
      if (O.geo !== N.geo) h += `<p class="note">Sınırlar farklı dönemlere ait. Aynı kimlikli ${common.length} birim eşleştirildi; arada kurulan iller dışarıda kaldı ve bazı illerin sınırları değişmiş olabilir.</p>`;
      const changed = common.filter((k) => O.units[k].winner && N.units[k].winner && O.units[k].winner !== N.units[k].winner);
      const sameName = (k) => pFull(O.units[k].winner, O) && pFull(O.units[k].winner, O) === pFull(N.units[k].winner, N);
      const realChanged = changed.filter((k) => !sameName(k));
      h += `<dl class="kv"><dt>Eşleşen birim</dt><dd>${common.length}</dd><dt>Birinci partisi/sonucu değişen</dt><dd>${realChanged.length}</dd></dl>`;
      if (realChanged.length) {
        const flows = {};
        realChanged.forEach((k) => { const f = `${O.units[k].winner}→${N.units[k].winner}`; (flows[f] = flows[f] || []).push(k); });
        h += `<details open><summary>Değişen birimler (${yr(O)} → ${yr(N)})</summary><ul class="flows">` +
          Object.entries(flows).sort((a, b) => b[1].length - a[1].length).map(([f, ks]) => {
            const [a, b] = f.split('→');
            return `<li><span class="sw" style="background:${pColor(a)}"></span>${esc(pLabel(a))} → <span class="sw" style="background:${pColor(b)}"></span>${esc(pLabel(b))} <b>${ks.length}</b>: ` +
              ks.map((k) => `<button type="button" class="linkbtn" data-u="${esc(k)}">${esc(N.units[k].name)}</button>`).join(', ') + '</li>';
          }).join('') + '</ul></details>';
      }
      // seçili partinin il bazında puan değişimi
      const p = state.party;
      const same = p && pFull(p, O) === pFull(p, N);
      const diffs = common.map((k) => [k, O.units[k].pct && N.units[k].pct && O.units[k].pct[p] != null && N.units[k].pct[p] != null ? N.units[k].pct[p] - O.units[k].pct[p] : null]).filter((x) => x[1] != null);
      if (p && diffs.length > 3 && same) {
        diffs.sort((a, b) => b[1] - a[1]);
        const li = (arr) => arr.map(([k, v]) => `<li><button type="button" class="linkbtn" data-u="${esc(k)}">${esc(N.units[k].name)}</button> <span class="${v > 0 ? 'up' : 'down'}">${sgn(v)}</span></li>`).join('');
        const avg = diffs.reduce((a, x) => a + x[1], 0) / diffs.length;
        h += `<h3>${esc(pLabel(p))} — il bazında puan değişimi</h3><p class="small">${diffs.length} ilde ortalama ${sgn(avg)} puan; ${diffs.filter((x) => x[1] > 0).length} ilde arttı, ${diffs.filter((x) => x[1] < 0).length} ilde azaldı.</p>` +
          `<div class="cols2"><div><div class="muted small">En çok artan</div><ol class="mini">${li(diffs.slice(0, 5))}</ol></div><div><div class="muted small">En çok azalan</div><ol class="mini">${li(diffs.slice(-5).reverse())}</ol></div></div>`;
      } else if (p && diffs.length > 3 && !same) {
        h += `<p class="note">"${esc(pLabel(p))}" iki seçimde farklı partileri gösteriyor (${esc(pFull(p, O) || '?')} / ${esc(pFull(p, N) || '?')}); il bazında oy farkı hesaplanmadı.</p>`;
      }
    }
    box.innerHTML = h;
    bindCmpSelect();
    box.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => selectUnit(b.dataset.u, true)));
  }
  function bindCmpSelect() {
    const s = $('#cmpSelect'); if (s) s.addEventListener('change', () => setCompareTarget(s.value));
  }

  // ------------------------------------------------------------------ demografik analiz
  let demoPromise = null, demoOpen = false, demoInd = 'pop';
  function loadDemo() {
    if (!demoPromise) demoPromise = getJSON('data/demographics.json?v=' + VERSION).then((x) => (state.demo = x)).catch((e) => { demoPromise = null; throw e; });
    return demoPromise;
  }
  // Seçimin birimleri için göstergeler: günümüz illeri o dönemin illerine toplanır
  function demoFor(d) {
    const D = state.demo;
    if (!D || !d || !d.geo || !d.geo.startsWith('tr-')) return null;
    const y = Number(d.date.slice(0, 4)), yrs = D.censusYears.map(Number);
    const cy = yrs.filter((v) => v <= y).pop(); if (!cy) return null;
    const py = yrs.filter((v) => v <= cy - 4).pop();
    const em = D.eraMap[d.geo], modern = !em;
    const out = {};
    for (const [pl, p] of Object.entries(D.provinces)) {
      const id = em ? em[pl] : pl;
      if (!id || !d.units[id]) continue;
      const o = out[id] || (out[id] = { pop: 0, prev: 0, area: 0, n: 0 });
      o.pop += p.pop[cy] || 0; o.prev += py ? (p.pop[py] || 0) : 0; o.area += p.area || 0; o.n++;
      if (modern) { o.gdppc = p.gdppc_usd_2024; o.life = p.life_2021_2023; }
    }
    for (const o of Object.values(out)) {
      o.density = o.area ? o.pop / o.area : null;
      o.growth = py && o.prev ? 100 * (Math.pow(o.pop / o.prev, 1 / (cy - py)) - 1) : null;
    }
    return { cy, py, modern, units: out };
  }
  const IND = { pop: { l: 'Nüfus', log: true, f: (v) => nf.format(Math.round(v)) }, density: { l: 'Yoğunluk (kişi/km²)', log: true, f: (v) => nf.format(Math.round(v)) },
                growth: { l: 'Yıllık nüfus artışı (%)', f: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) },
                gdppc: { l: 'Kişi başı GSYH (ABD $, 2024)', log: true, f: (v) => nf.format(Math.round(v)) }, life: { l: 'Yaşam beklentisi (yıl)', f: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) } };
  function demoY(d) {
    const m = state.mode;
    if (['party', 'turnout', 'swing', 'share'].includes(m)) {
      const lab = m === 'turnout' ? 'Katılım (%)' : m === 'swing' ? `${pLabel(state.party)} değişim (puan)` : `${pLabel(state.party)} (%)`;
      return { lab, f: (u) => unitValue(u, m) };
    }
    const top = Object.keys((d.national && d.national.pct) || {}).filter((k) => k !== 'Diğer')[0];
    if (top) return { lab: `${pLabel(top)} (%)`, f: (u) => (u.pct ? u.pct[top] ?? null : null) };
    if (Object.values(d.units).some((u) => u.turnout != null)) return { lab: 'Katılım (%)', f: (u) => u.turnout ?? null };
    return null;
  }
  function pearson(xs, ys) {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, slope: sxx ? sxy / sxx : 0, mx, my };
  }
  function renderDemo() {
    const box = $('#demoBox'), d = state.data;
    if (!box) return;
    if (!d || !d.geo || !d.geo.startsWith('tr-') || !Object.values(d.units).some((u) => !u.nodata)) { box.innerHTML = ''; return; }
    if (!box.firstChild) {
      box.innerHTML = '<details id="demoDet"><summary>Demografik karşılaştırma (nüfus, yoğunluk, nüfus artışı, gelir, yaşam beklentisi)</summary><div class="demo"></div></details>';
      const det = $('#demoDet');
      det.open = demoOpen;
      det.addEventListener('toggle', () => { demoOpen = det.open; if (det.open) renderDemo(); });
    }
    if (!demoOpen) return;
    const inner = box.querySelector('.demo');
    if (!state.demo) { inner.innerHTML = '<p class="hint">Yükleniyor…</p>'; loadDemo().then(renderDemo).catch((e) => { inner.innerHTML = `<p class="note warn">${esc(e.message)}</p>`; }); return; }
    const dm = demoFor(d), Y = demoY(d);
    if (!dm || !Y) { inner.innerHTML = '<p class="note">Bu seçim için karşılaştırılabilir değer yok.</p>'; return; }
    const avail = Object.keys(IND).filter((k) => (k === 'gdppc' || k === 'life') ? dm.modern : k === 'growth' ? !!dm.py : true);
    if (!avail.includes(demoInd)) demoInd = 'pop';
    const ind = IND[demoInd];
    const pts = Object.entries(dm.units).map(([id, o]) => ({ id, u: d.units[id], x: o[demoInd], y: Y.f(d.units[id]) }))
      .filter((p) => p.x != null && p.y != null && isFinite(p.x) && (!ind.log || p.x > 0));
    let h = `<div class="demo-ctl"><select id="demoSel" aria-label="Gösterge">${avail.map((k) => `<option value="${k}" ${k === demoInd ? 'selected' : ''}>${IND[k].l}</option>`).join('')}</select></div>`;
    if (pts.length < 5) { inner.innerHTML = h + '<p class="note">Yeterli il yok.</p>'; bindDemo(); return; }
    const tx = (v) => (ind.log ? Math.log10(v) : v);
    const xs = pts.map((p) => tx(p.x)), ys = pts.map((p) => p.y);
    const { r, slope, mx, my } = pearson(xs, ys);
    const W = 340, H = 230, L0 = 42, B0 = 30;
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
    const X = (v) => L0 + (v - x0) / ((x1 - x0) || 1) * (W - L0 - 10), Yp = (v) => H - B0 - (v - y0) / ((y1 - y0) || 1) * (H - B0 - 10);
    let svg = `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ind.l)} ile ${esc(Y.lab)} ilişkisi">`;
    svg += `<line class="ax" x1="${L0}" x2="${W - 10}" y1="${H - B0}" y2="${H - B0}"/><line class="ax" x1="${L0}" x2="${L0}" y1="10" y2="${H - B0}"/>`;
    if (y0 < 0) svg += `<line class="ax0" x1="${L0}" x2="${W - 10}" y1="${Yp(0)}" y2="${Yp(0)}"/>`;
    const fmtX = (v) => ind.f(ind.log ? Math.pow(10, v) : v);
    svg += `<text x="${L0}" y="${H - B0 + 12}" font-size="9">${fmtX(x0)}</text><text x="${W - 10}" y="${H - B0 + 12}" font-size="9" text-anchor="end">${fmtX(x1)}</text>`;
    svg += `<text x="${(L0 + W) / 2}" y="${H - 4}" font-size="10" text-anchor="middle">${esc(ind.l)}${ind.log ? ' (log ölçek)' : ''}</text>`;
    svg += `<text x="${L0 - 4}" y="14" font-size="9" text-anchor="end">${y1.toFixed(0)}</text><text x="${L0 - 4}" y="${H - B0}" font-size="9" text-anchor="end">${y0.toFixed(0)}</text>`;
    svg += `<text x="10" y="${(H - B0) / 2}" font-size="10" text-anchor="middle" transform="rotate(-90 10 ${(H - B0) / 2})">${esc(Y.lab)}</text>`;
    const ly = (v) => my + slope * (v - mx);
    svg += `<line class="fit" x1="${X(x0)}" y1="${Yp(ly(x0))}" x2="${X(x1)}" y2="${Yp(ly(x1))}"/>`;
    for (const p of pts) {
      const c = p.u.winner ? pColor(p.u.winner) : T.ramp;
      svg += `<circle class="dp${p.id === state.unit ? ' sel' : ''}" data-u="${esc(p.id)}" cx="${X(tx(p.x)).toFixed(1)}" cy="${Yp(p.y).toFixed(1)}" r="${p.id === state.unit ? 5.5 : 3.6}" fill="${c}"><title>${esc(p.u.name)}: ${esc(ind.l)} ${ind.f(p.x)} · ${esc(Y.lab)} ${p.y.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</title></circle>`;
    }
    svg += '</svg>';
    const ar = Math.abs(r), str = ar < 0.2 ? 'çok zayıf' : ar < 0.4 ? 'zayıf' : ar < 0.6 ? 'orta' : ar < 0.8 ? 'güçlü' : 'çok güçlü';
    h += svg + `<p class="small"><b>r = ${r.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</b> (${pts.length} il): ${str} ${r >= 0 ? 'pozitif' : 'negatif'} doğrusal ilişki${ind.log ? ' (göstergenin logaritmasıyla)' : ''}. Nokta rengi ildeki birinci partidir; noktaya tıklayınca il seçilir.</p>`;
    h += `<p class="hint small">Nüfus: ${dm.cy} ${dm.cy >= 2007 ? 'ADNKS' : 'genel nüfus sayımı'}${demoInd === 'growth' ? `, artış ${dm.py}–${dm.cy} arası` : ''}. ${dm.modern ? '' : 'Günümüz illerinin nüfusu o dönemin il sınırlarına toplanmıştır; ayrılan ilçeler kaynak verisinde ayrı izlenemediği için değerler yaklaşıktır. '}` +
      `${(demoInd === 'gdppc' || demoInd === 'life') ? 'Bu gösterge tek bir döneme aittir (GSYH 2024, yaşam beklentisi 2021–2023). ' : ''}İl düzeyinde kentleşme ve göç verisi kaynaklarda yoktur; nüfus artışı göçün dolaylı göstergesidir. Korelasyon nedensellik göstermez ve il ortalamaları bireylerin davranışı hakkında sonuç çıkarmaya elvermez (ekolojik yanılgı).</p>`;
    inner.innerHTML = h;
    bindDemo();
  }
  function bindDemo() {
    const s = $('#demoSel'); if (s) s.addEventListener('change', () => { demoInd = s.value; renderDemo(); });
    document.querySelectorAll('#demoBox circle.dp').forEach((c) => c.addEventListener('click', () => selectUnit(c.dataset.u)));
  }
  function unitDemoRows(id) {
    const dm = demoFor(state.data); if (!dm || !dm.units[id]) return [];
    const o = dm.units[id], rows = [[`Nüfus (${dm.cy})`, nf.format(o.pop)]];
    if (o.density) rows.push(['Yoğunluk', nf.format(Math.round(o.density)) + ' kişi/km²']);
    if (o.growth != null) rows.push([`Yıllık artış (${dm.py}–${dm.cy})`, '%' + o.growth.toLocaleString('tr-TR', { maximumFractionDigits: 2 })]);
    if (o.gdppc) rows.push(['Kişi başı GSYH (2024)', nf.format(o.gdppc) + ' $']);
    if (o.life) rows.push(['Yaşam beklentisi', o.life.toLocaleString('tr-TR') + ' yıl']);
    return rows;
  }

  // ------------------------------------------------------------------ zaman atlamalı oynatmada siyasi olaylar
  const EV_LABEL = { 'padişah': 'Padişah', 'olay': 'Siyasi olay', 'kuruluş': 'Kuruluş', 'kapanış': 'Kapanış', 'ad değişikliği': 'Ad değişikliği', 'hükûmet': 'Hükûmet', 'güvenoyu': 'Güvenoyu', 'cumhurbaşkanı': 'Cumhurbaşkanı', 'ittifak': 'İttifak', 'darbe': 'Askerî müdahale', 'sistem': 'Sistem' };
  function eventsBetween(a, b, types) {
    const H = state.hist; if (!H) return [];
    return H.events.filter((e) => e.date > a && e.date <= b && (!types || types.includes(e.type)));
  }
  function renderTicker() {
    const el = $('#eventTicker');
    if (!state.play.on || !state.hist || !state.cur || !state.play.lastDate) { el.hidden = true; return; }
    const ev = eventsBetween(state.play.lastDate, state.cur.date);
    if (!ev.length) { el.hidden = true; return; }
    const show = ev.filter((e) => e.type !== 'hükûmet').slice(-5);
    const nGov = ev.filter((e) => e.type === 'hükûmet').length;
    el.hidden = false;
    el.innerHTML = `<div class="tt">${esc(state.play.lastDate.slice(0, 4))}–${esc(state.cur.date.slice(0, 4))} arasında</div><ul>` +
      show.map((e) => `<li><span class="et et-${esc(e.type.replace(/\s/g, '-'))}">${esc(EV_LABEL[e.type] || e.type)}</span> ${esc(e.text)} <span class="muted">${esc(e.date.slice(0, 4))}</span></li>`).join('') +
      (nGov ? `<li class="muted">${nGov} hükûmet kuruldu</li>` : '') + '</ul>';
  }

  // ------------------------------------------------------------------ başlat
  async function init() {
    applyTheme(false);
    mq.addEventListener('change', () => { if (themePref() === 'auto') applyTheme(true); });
    map.on('zoomend', () => { if (state.data) restyle(); });
    const [idx, parties] = await Promise.all([getJSON('data/index.json'), getJSON('data/parties.json')]);
    state.index = idx; state.parties = parties;
    readyResolve();
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
    $('#unitSearch').addEventListener('change', searchPick);
    $('#unitSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPick(); });
    $('#panelBtn').addEventListener('click', () => {
      const c = document.querySelector('.layout').classList.toggle('collapsed');
      $('#panelBtn').textContent = c ? 'Paneli göster' : 'Paneli gizle';
      $('#panelBtn').setAttribute('aria-expanded', String(!c));
      setTimeout(() => { map.invalidateSize(); renderTimeline(); }, 50);
    });
    $('#playBtn').addEventListener('click', togglePlay);
    $('#speedSel').addEventListener('change', (e) => { state.play.speed = Number(e.target.value); });
    $('#skipEmpty').addEventListener('change', (e) => { state.play.skipEmpty = e.target.checked; updateYearBadge(); });
    $('#csvBtn').addEventListener('click', downloadCsv);
    $('#cmpBtn').addEventListener('click', () => setCompare(!state.cmp.on));
    $('#shareBtn').addEventListener('click', (e) => copyLink(e.currentTarget));
    $('#version').textContent = 'Sürüm ' + VERSION;
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('select, input, textarea, dialog[open]')) return;
      if (!document.getElementById('historyDlg').hidden) return;   // siyasi tarih açıkken harita kısayolları kapalı
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
      if (e.key === '/' ) { e.preventDefault(); $('#unitSearch').focus(); }
      if (e.key === 'Escape' && state.unit) selectUnit(null);
    });
    window.addEventListener('resize', () => renderTimeline());
    window.addEventListener('hashchange', () => {
      const h = readHash();
      if (h.e && state.index.some((e) => e.id === h.e) && (!state.cur || h.e !== state.cur.id || h.u !== state.unit)) go(h.e, { unit: h.u, mode: h.m, party: h.p });
    });
    const h = readHash();
    const def = state.index.filter((e) => e.type === 'genel' && e.units > 0).slice(-1)[0];
    const first = h.e && state.index.some((e) => e.id === h.e) ? h.e : def.id;
    // arka plan, ilk seçim ve sınırları aynı anda indir
    const meta = state.index.find((e) => e.id === first);
    const world = loadWorld().catch((e) => console.warn('Arka plan yüklenemedi', e));
    if (meta && meta.geo) loadGeo(meta.geo).catch(() => {});
    await go(first, { unit: h.u, mode: h.m, party: h.p });
    if (h.c && state.index.some((e) => e.id === h.c)) await setCompare(true, h.c);
    await world;
    if (unitLayer) unitLayer.bringToFront();
    registerSW();
  }

  // ------------------------------------------------------------------ önceden yükleme ve çevrimdışı önbellek
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  function prefetchAround() {
    const list = filtered(), i = list.findIndex((e) => state.cur && e.id === state.cur.id);
    if (i < 0) return;
    idle(() => [list[i + 1], list[i - 1]].filter(Boolean).forEach((e) => {
      loadElection(e.id).catch(() => {});
      if (e.geo) loadGeo(e.geo).catch(() => {});
    }));
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/localhost/.test(location.href)) return;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker kaydedilemedi', e));
  }
  let readyResolve; const appReady = new Promise((r) => { readyResolve = r; });
  window.Atlas = { state, pColor, pLabel, esc, nf, pf, fmtDate, loadHistory, findParty, partyByTitle, partyKey, lineageHtml, bindLineage,
                   hemicycle, EV_LABEL, isDark: () => T === THEMES.dark, writeHash, ready: appReady, stopPlay: () => { if (state.play.on) stopPlay(); },
                   refit: () => { map.invalidateSize(); if (unitLayer && !state.mapFitted) { map.fitBounds(unitLayer.getBounds(), { padding: [12, 12] }); state.mapFitted = true; } }, go: (id) => go(id, { keepMode: true }) };
  init().catch((e) => { console.error(e); $('#electionInfo').innerHTML = `<p class="note warn">Uygulama başlatılamadı: ${esc(e.message)}</p>`; });
})();
