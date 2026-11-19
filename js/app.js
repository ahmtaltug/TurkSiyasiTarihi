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
  const NODATA = '#d6d3cc';
  const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

  const nf = new Intl.NumberFormat('tr-TR');
  const pf = (x, d = 1) => (x == null || isNaN(x)) ? '–' : '%' + Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = { index: [], parties: {}, era: 'all', types: new Set(Object.keys(TYPES)), cur: null, data: null,
                  mode: null, party: null, unit: null, geoFamily: null };
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
  const pColor = (k) => (state.parties[k] && state.parties[k].c) || hashColor(k);
  const pLabel = (k) => (state.parties[k] && (/\d{2}$/.test(k) || k.length > 22)) ? state.parties[k].s : k;
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const RAMP_LO = '#f4f1ea';

  // ------------------------------------------------------------------ harita
  const map = L.map('map', { zoomSnap: 0.25, minZoom: 3, maxZoom: 10, worldCopyJump: false });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  map.attributionControl.addAttribution('Sınırlar: © OpenStreetMap katkıcıları, OCHA/HDX, Natural Earth · Sonuçlar: YSK/TÜİK, Vikipedi (CC BY-SA 4.0)');
  map.setView([39, 35], 6);
  let worldLayer = null, unitLayer = null;

  async function loadWorld() {
    const w = await getJSON('data/geo/world.json');
    const fc = topojson.feature(w, w.objects[Object.keys(w.objects)[0]]);
    worldLayer = L.geoJSON(fc, { interactive: false, style: { fillColor: '#ebe8e1', fillOpacity: 1, color: '#cfcac0', weight: 0.6 } }).addTo(map);
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
    return ms;
  }
  function partyChoices(d) {
    const fromNat = Object.keys((d.national && (d.national.pct || d.national.seats)) || {});
    const list = (d.parties && d.parties.length ? d.parties : fromNat).filter((p) => p !== 'Diğer');
    return list.slice(0, 12);
  }

  function unitValue(u, mode) {
    if (!u || u.nodata) return null;
    switch (mode) {
      case 'party': return u.pct ? (u.pct[state.party] ?? (u.unknownVotes && u.unknownVotes.includes(state.party) ? null : (u.pct && Object.keys(u.pct).length ? 0 : null))) : null;
      case 'share': return u.seats && u.initial ? 100 * (u.seats[state.party] || 0) / u.initial : null;
      case 'turnout': return u.turnout ?? null;
      case 'count': return u.total || 0;
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
    if (hi === lo) hi = lo + 1;
    return [lo, hi];
  }
  function rampColor(mode) {
    if (mode === 'party' || mode === 'share') return pColor(state.party);
    if (mode === 'turnout') return '#24557f';
    if (state.data && state.data.id === '1930yerel') return pColor('Serbest Cumhuriyet Fırkası');
    return '#7a2a1d';
  }

  function styleFor(u) {
    const d = state.data, mode = state.mode;
    const base = { weight: 0.7, color: '#ffffff', opacity: 1, fillOpacity: 1 };
    if (!u || u.nodata) return { ...base, fillColor: NODATA, color: '#f4f2ee' };
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
    const [lo, hi] = domain(d, mode);
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return { ...base, fillColor: mix(RAMP_LO, rampColor(mode), 0.08 + 0.92 * t) };
  }

  // ------------------------------------------------------------------ çizim
  async function draw() {
    const d = state.data;
    $('#mapOverlay').hidden = true;
    if (unitLayer) { map.removeLayer(unitLayer); unitLayer = null; }
    if (!d.geo) {
      $('#mapOverlay').hidden = false;
      $('#mapOverlay').innerHTML = '<b>Bu kayıt için harita verisi yok.</b><br>Ayrıntılar sağdaki panelde.';
      if (state.geoFamily !== 'otto') { map.fitBounds([[12, 12], [47, 48]]); state.geoFamily = 'otto'; }
      renderLegend();
      return;
    }
    const fc = await loadGeo(d.geo);
    if (state.data !== d) return; // bu arada başka seçim seçildi
    unitLayer = L.geoJSON(fc, {
      style: (f) => styleFor(d.units[f.properties.id]),
      onEachFeature: (f, layer) => {
        layer.on({
          mouseover: () => { layer.setStyle({ weight: 2, color: '#222' }); layer.bringToFront(); },
          mouseout: () => { unitLayer && unitLayer.resetStyle(layer); markSelected(); },
          click: () => selectUnit(f.properties.id),
        });
        layer.bindTooltip(() => tooltipHtml(f), { sticky: true, className: 'unit-tip', direction: 'top', offset: [0, -6] });
      },
    }).addTo(map);
    const fam = d.geo.startsWith('h-1877') || ['h-1908', 'h-1912', 'h-1914'].includes(d.geo) ? 'otto' : 'tr';
    if (fam !== state.geoFamily) {
      map.fitBounds(unitLayer.getBounds(), { padding: [12, 12] });
      state.geoFamily = fam;
    }
    markSelected();
    renderLegend();
  }
  function restyle() {
    if (unitLayer) unitLayer.setStyle((f) => styleFor(state.data.units[f.properties.id]));
    markSelected();
    renderLegend();
  }
  function markSelected() {
    if (!unitLayer || !state.unit) return;
    unitLayer.eachLayer((l) => { if (l.feature.properties.id === state.unit) { l.setStyle({ weight: 2.5, color: '#111' }); l.bringToFront(); } });
  }

  function tooltipHtml(f) {
    const d = state.data, u = d.units[f.properties.id];
    const name = esc((u && u.name) || f.properties.name);
    if (!u || u.nodata) return `<b>${name}</b><span class="muted">${u && u.note ? esc(u.note) : 'Veri yok'}</span>`;
    const parts = [];
    if (state.mode === 'winner' && u.winner) parts.push(`${esc(pLabel(u.winner))}${u.pct && u.pct[u.winner] != null ? ' ' + pf(u.pct[u.winner]) : ''}`);
    else if (state.mode === 'party' || state.mode === 'share') parts.push(`${esc(pLabel(state.party))}: ${pf(unitValue(u, state.mode))}`);
    else if (state.mode === 'turnout') parts.push('Katılım ' + pf(u.turnout));
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
    if (!mode) { el.innerHTML = '<div class="t">Dönemin sınırları</div><div class="muted">İl düzeyinde sonuç verisi yok</div>'; return; }
    if (mode === 'winner') {
      const cnt = {};
      Object.values(d.units).forEach((u) => { if (u.winner) cnt[u.winner] = (cnt[u.winner] || 0) + 1; });
      const title = d.type === 'referandum' ? 'Sonuç' : d.type === 'cumhurbaskanligi' ? 'Önde olan aday' : d.id === '1930yerel' ? 'İl merkezi belediyesi' : d.id === '1946' ? 'Birinci parti (oy; bilinmiyorsa vekil)' : d.metric === 'members' ? 'Çoğunluk (vekil)' : 'Birinci parti';
      html += `<div class="t">${title}</div>`;
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
        html += `<div class="item"><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))} <span class="muted">(${n})</span></div>`;
      });
      if (Object.values(d.units).some((u) => u.pct && u.winner)) html += '<div class="muted" style="margin-top:4px">Ton koyulaştıkça oy oranı artar</div>';
    } else {
      const [lo, hi] = domain(d, mode);
      const t = mode === 'turnout' ? 'Katılım (%)' : mode === 'count' ? (d.id === '1930yerel' ? 'SCF\'nin kazandığı belediye' : 'Vekil sayısı') : `${esc(pLabel(state.party))} (%)`;
      const c = rampColor(mode);
      html += `<div class="t">${t}</div><div class="ramp" style="background:linear-gradient(90deg, ${mix(RAMP_LO, c, 0.08)}, ${c})"></div>`;
      html += `<div class="ramp-l"><span>${nf.format(lo)}</span><span>${nf.format(hi)}</span></div>`;
    }
    html += `<div class="item" style="margin-top:4px"><span class="sw" style="background:${NODATA}"></span><span class="muted">Veri yok / seçim yapılmadı</span></div>`;
    el.innerHTML = html;
  }

  // ------------------------------------------------------------------ panel
  function bars(entries, total, opts = {}) {
    const max = opts.max || Math.max(...entries.map((e) => e[1]), 1);
    return '<div class="bars">' + entries.map(([k, v, extra]) => {
      const w = Math.max(0.5, 100 * v / max);
      const val = opts.pct ? pf(v) : nf.format(v);
      return `<div class="bar"><span class="lab" title="${esc(k)}"><span class="sw" style="background:${pColor(k)}"></span>${esc(pLabel(k))}</span>` +
        `<span class="tr"><span class="fl" style="display:block;width:${w}%;background:${pColor(k)}"></span></span>` +
        `<span class="val">${val}${extra ? ' · ' + extra : ''}</span></div>`;
    }).join('') + '</div>';
  }

  function renderElectionInfo() {
    const d = state.data, meta = state.cur;
    const t = TYPES[d.type] || { label: d.type, color: '#666' };
    let h = `<h2>${esc(d.title)}</h2>`;
    h += `<div class="muted">${esc(d.dateLabel || meta.dateLabel || d.date)}${d.subtitle ? ' · ' + esc(d.subtitle) : ''}</div>`;
    h += `<div class="badges"><span class="badge" style="background:${t.color}1a;color:${t.color}">${t.label}</span><span class="badge">${ERA_LABEL[d.era] || ''}</span>`;
    if (d.approxBoundaries) h += '<span class="badge">Yaklaşık sınırlar</span>';
    if (d.level) h += `<span class="badge">Birim: ${d.level}</span>`;
    h += '</div>';
    if (d.description) h += `<p class="desc">${esc(d.description)}</p>`;

    const n = d.national || {};
    if (n.pct && Object.keys(n.pct).length) {
      const ent = Object.entries(n.pct).filter(([k]) => k !== 'Diğer').slice(0, 8)
        .map(([k, v]) => [k, v, n.seats && n.seats[k] ? `${n.seats[k]} snd.` : '']);
      const label = d.type === 'referandum' ? 'Ülke geneli' : d.type === 'cumhurbaskanligi' ? 'Ülke geneli (aday)' : 'Ülke geneli oy';
      h += `<h3>${label}</h3>` + bars(ent, 100, { pct: true, max: Math.max(...ent.map((e) => e[1])) });
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
      h += `<dl class="kv"><dt>Listedeki vekil</dt><dd>${nf.format(n.members_listed)}</dd>`;
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
    if (state.mode === 'party' || state.mode === 'share') {
      h += '<select id="partySelect" aria-label="Parti">' + partyChoices(d).map((p) => `<option value="${esc(p)}" ${p === state.party ? 'selected' : ''}>${esc(pLabel(p))}</option>`).join('') + '</select>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); }));
    const ps = $('#partySelect');
    if (ps) ps.addEventListener('change', () => { state.party = ps.value; restyle(); writeHash(); });
  }
  function setMode(m) {
    state.mode = m;
    if ((m === 'party' || m === 'share') && !partyChoices(state.data).includes(state.party)) state.party = partyChoices(state.data)[0];
    renderModes(); restyle(); writeHash();
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
    h += '</div>';
    box.innerHTML = h;
    $('#unitClose').onclick = () => selectUnit(null);
  }

  function renderNotes() {
    const d = state.data;
    let h = '';
    if (d.notes && d.notes.length) h += '<h3>Notlar</h3>' + d.notes.filter(Boolean).map((n) => `<p class="note">${esc(n)}</p>`).join('');
    if (d.sources && d.sources.length) h += '<h3>Kaynak</h3>' + d.sources.map((s) => `<p class="src"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></p>`).join('');
    $('#notesBox').innerHTML = h;
  }

  function selectUnit(id) {
    state.unit = id;
    restyle(); renderUnit(); writeHash();
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
    const meta = state.index.find((e) => e.id === id) || state.index[state.index.length - 1];
    state.cur = meta;
    $('#electionSelect').value = meta.id;
    let d;
    try { d = await loadElection(meta.id); } catch (e) { $('#electionInfo').innerHTML = `<p class="note warn">Veri yüklenemedi: ${esc(e.message)}</p>`; return; }
    if (state.cur !== meta) return;
    state.data = d;
    const ms = modesFor(d).map((m) => m[0]);
    if (opts.mode && ms.includes(opts.mode)) state.mode = opts.mode;
    else if (!ms.includes(state.mode) || (d.defaultMode && !opts.keepMode)) state.mode = (d.defaultMode && ms.includes(d.defaultMode)) ? d.defaultMode : (ms.includes('winner') ? 'winner' : ms[0] || null);
    const choices = partyChoices(d);
    if (opts.party && choices.includes(opts.party)) state.party = opts.party;
    else if (!choices.includes(state.party)) state.party = choices[0];
    if (!(opts.unit && d.units[opts.unit])) { if (!(state.unit && d.units[state.unit])) state.unit = null; } else state.unit = opts.unit;
    renderElectionInfo(); renderModes(); renderUnit(); renderNotes(); renderTimeline();
    await draw();
    writeHash();
  }
  function step(dir) {
    const list = filtered();
    let i = list.findIndex((e) => e.id === state.cur.id);
    if (i < 0) i = list.findIndex((e) => e.date > state.cur.date) - (dir > 0 ? 1 : 0);
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
    if ((state.mode === 'party' || state.mode === 'share') && state.party) p.set('p', state.party);
    history.replaceState(null, '', '#' + p.toString());
  }

  // ------------------------------------------------------------------ başlat
  async function init() {
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
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('select, input, textarea, dialog[open]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
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
