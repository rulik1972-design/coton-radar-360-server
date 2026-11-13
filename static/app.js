const IDS = Array.from({ length: 10 }, (_, i) => `RADAR-${String(i + 1).padStart(2, '0')}`);
const $ = id => document.getElementById(id);
let live = {}, demo = false, selected = null, lastFetch = 0, fetchError = null, hasFetched = false;
const cards = $('cards');
const canvases = {};

// Interface localization. Language preference is stored only in this browser.
const I18N = {
  uk: {
    pageTitle: 'COTON RADAR NETWORK — 10 комплексів',
    subtitle: 'Диспетчерська панель · 10 комплексів × 3 датчики',
    demoOn: 'Увімкнути ДЕМО', demoOff: 'Вимкнути ДЕМО',
    online: 'Комплексів онлайн', alarms: 'Тривог', total: 'Усього цілей', offline: 'Без зв’язку',
    mapTab: '🗺 КАРТА', radarsTab: '◎ 10 РАДАРІВ', viewLabel: 'Режим перегляду',
    mapTitle: 'Карта радарів · реальні GPS-координати',
    mapSubtitle: 'Показуються лише координати, отримані від пристроїв',
    mapAria: 'Карта східної Фінляндії з радарними прапорцями',
    legendClear: '🟢 CLEAR', legendAlarm: '🔴 ALARM — блимає', legendOffline: '⚪ OFFLINE',
    close: '✕ Закрити', closeAria: 'Закрити', detailTitle: 'Огляд 360°',
    noTargets: 'Цілей немає', noTargetsFull: 'Цілей немає.', outOfRange: 'Комплекс офлайн.', noConnection: 'Без зв’язку',
    footer: 'Тільки реальні дані через /api/ingest. Render Free не гарантує збереження журналів після перезапуску.',
    initialNotice: 'LIVE: очікуємо дані від реальних радарів. Фальшиві цілі вимкнені.',
    liveNotice: 'Дані з сервера. Натисни на радар або кнопку ALARM/CLEAR для перегляду на весь екран.',
    errorPrefix: 'Немає зв’язку із сервером: ',
    leafletError: 'Не вдалося завантажити карту. Перевір з’єднання з інтернетом.',
    hintDemo: 'ДЕМО: місця прапорців вигадані, GPS-модулі не підключені. Натисни на будь-який прапорець.',
    hintLive: 'LIVE: відображаються координати, які передані комплексами через сервер.',
    hintNoGps: 'LIVE: GPS-координати ще не надходили. Прапорці з’являться після отримання реального GPS FIX та успішного передавання на сервер.',
    state: 'СТАН', targets: 'ЦІЛЕЙ', direction: 'НАПРЯМОК', heading: 'Курс', noCompass: 'немає компаса', updated: 'Оновлення',
    targetsInZone: 'Цілі в зоні:', numberTargets: 'Цілей', radar: 'Радар', target: 'Ціль', moreTargets: 'Ще цілей:',
    stationary: 'нерухома', standing: 'стоїть', approachingFrom: 'наближається з', movingAwayTowards: 'віддаляється у бік',
    from: 'з', towards: 'у бік', statusPrefix: 'Стан', sensorsOffline: 'без зв’язку',
    northDirections: ['півночі', 'північного сходу', 'сходу', 'південного сходу', 'півдня', 'південного заходу', 'заходу', 'північного заходу'],
    shortDirections: ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'],
    meters: 'м', kmh: 'км/год', sec: 'с',
    pinClear: 'немає тривоги', pinAlarm: 'тривога', pinOffline: 'немає зв’язку',
    log: 'ЛОГ', logTitle: 'Журнал спрацювань', download: 'Скачати .TXT', logEmpty: 'Спрацювань поки немає', logStart: 'Початок', logEnd: 'Кінець', logDuration: 'Тривалість', logActive: 'ТРИВАЄ', logSeconds: 'с', logDemo: 'ДЕМО: журнал цього браузера', logLive: 'LIVE: журнал сервера', logUnavailable: 'Не вдалося отримати журнал', logNote: 'У ДЕМО події зберігаються в цьому браузері; у LIVE — в пам’яті сервера, яка може очищатися під час перезапуску.'
  },
  en: {
    pageTitle: 'COTON RADAR NETWORK — 10 systems',
    subtitle: 'Monitoring dashboard · 10 systems × 3 sensors',
    demoOn: 'Enable DEMO', demoOff: 'Disable DEMO',
    online: 'Systems online', alarms: 'Alerts', total: 'Total targets', offline: 'Offline',
    mapTab: '🗺 MAP', radarsTab: '◎ 10 RADARS', viewLabel: 'View mode',
    mapTitle: 'Radar map · live GPS positions',
    mapSubtitle: 'Only positions received from real radar devices are displayed',
    mapAria: 'Map of eastern Finland with radar pins',
    legendClear: '🟢 CLEAR', legendAlarm: '🔴 ALARM — flashing', legendOffline: '⚪ OFFLINE',
    close: '✕ Close', closeAria: 'Close', detailTitle: '360° View',
    noTargets: 'No targets', noTargetsFull: 'No targets detected.', outOfRange: 'System offline.', noConnection: 'No connection',
    footer: 'Real data only via /api/ingest. Render Free may lose alarm logs after server restart.',
    initialNotice: 'LIVE: waiting for real radar devices. Simulated targets are disabled.',
    liveNotice: 'Live server data. Click a radar or its ALARM/CLEAR button to open the full view.',
    errorPrefix: 'Cannot connect to server: ',
    leafletError: 'Map could not be loaded. Check your internet connection.',
    hintDemo: 'DEMO: pin locations are fictional. GPS hardware is not connected. Click any pin.',
    hintLive: 'LIVE: showing coordinates reported by the systems through the server.',
    hintNoGps: 'LIVE: no GPS positions received yet. Pins appear after a GPS fix and successful server upload.',
    state: 'STATUS', targets: 'TARGETS', direction: 'HEADING', heading: 'Heading', noCompass: 'no compass', updated: 'Updated',
    targetsInZone: 'Targets in range:', numberTargets: 'Targets', radar: 'Radar', target: 'Target', moreTargets: 'Additional targets:',
    stationary: 'stationary', standing: 'stationary', approachingFrom: 'approaching from', movingAwayTowards: 'moving away toward',
    from: 'from', towards: 'toward', statusPrefix: 'Status', sensorsOffline: 'no connection',
    northDirections: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    shortDirections: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    meters: 'm', kmh: 'km/h', sec: 's',
    pinClear: 'clear', pinAlarm: 'alarm', pinOffline: 'offline',
    log: 'LOG', logTitle: 'Detection log', download: 'Download .TXT', logEmpty: 'No detections yet', logStart: 'Start', logEnd: 'End', logDuration: 'Duration', logActive: 'ACTIVE', logSeconds: 's', logDemo: 'DEMO: this browser log', logLive: 'LIVE: server log', logUnavailable: 'Could not load log', logNote: 'DEMO logs are saved in this browser; LIVE logs are kept in server memory and may disappear after a restart.'
  }
};
let language = 'uk';
try { language = localStorage.getItem('coton-language') === 'en' ? 'en' : 'uk'; } catch(e) { /* storage disabled */ }
const tr = () => I18N[language];
const decimal = n => Number(n).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function setLanguage(lang) {
  language = lang === 'en' ? 'en' : 'uk';
  try { localStorage.setItem('coton-language', language); } catch(e) { /* private mode */ }
  const x = tr();
  document.documentElement.lang = language;
  document.title = x.pageTitle;
  const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  set('subtitle', x.subtitle);
  // LIVE only: demo toggle removed.
  set('label-online', x.online); set('label-alarms', x.alarms);
  set('label-total', x.total); set('label-offline', x.offline);
  set('tab-map', x.mapTab); set('tab-radars', x.radarsTab);
  $('view-tabs').setAttribute('aria-label', x.viewLabel);
  set('map-title', x.mapTitle); set('map-subtitle', x.mapSubtitle);
  $('radar-map').setAttribute('aria-label', x.mapAria);
  set('legend-clear', x.legendClear); set('legend-alarm', x.legendAlarm); set('legend-offline', x.legendOffline);
  set('detail-title', x.detailTitle); set('close', x.close); $('close').setAttribute('aria-label', x.closeAria);
  set('detail-log', x.log); set('log-title-label', x.logTitle); set('log-download', x.download); set('log-close', x.close); set('log-note', x.logNote);
  document.querySelectorAll('.log-open').forEach(b => b.textContent = x.log);
  if (activeLogRadar) renderLog();
  set('footer-note', x.footer);
  set('notice', fetchError ? x.errorPrefix + fetchError : hasFetched ? x.liveNotice : x.initialNotice);
  set('map-hint', x.hintNoGps);
  if (!window.L) set('radar-map', x.leafletError);
  for (const id of ['uk','en']) {
    const button = $('lang-' + id);
    button.classList.toggle('active', id === language);
    button.setAttribute('aria-pressed', String(id === language));
  }
  // Keep live/demo data, selected radar, and map state when switching.
  for (const marker of Object.values(mapMarkers)) marker._cotonState = null;
  updateMapMarkers(Date.now(), true);
}
$('lang-uk').addEventListener('click', () => setLanguage('uk'));
$('lang-en').addEventListener('click', () => setLanguage('en'));


for (const rid of IDS) {
  const cell = document.createElement('article');
  cell.className = 'unit';
  cell.setAttribute('tabindex', '0');
  cell.setAttribute('role', 'button');
  cell.innerHTML = `
    <div class="unit-top">
      <h2>${rid}</h2>
      <span class="state off" id="badge-${rid}">OFFLINE</span>
    </div>
    <canvas width="300" height="300" aria-label="${tr().radar} ${rid}"></canvas>
    <div class="meta" id="meta-${rid}">${tr().noConnection}</div>
    <div class="unit-actions">
      <button class="alarm-button off" id="alarm-${rid}" type="button">OFFLINE</button>
      <button class="log-open" id="log-${rid}" type="button">${tr().log}</button>
    </div>`;
  cell.addEventListener('click', () => openDetail(rid));
  cell.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(rid); });
  cell.querySelector(`#alarm-${rid}`).addEventListener('click', e => { e.stopPropagation(); openDetail(rid); });
  cell.querySelector(`#log-${rid}`).addEventListener('click', e => { e.stopPropagation(); openLog(rid); });
  cards.appendChild(cell);
  canvases[rid] = cell.querySelector('canvas');
}


$('close').onclick = () => { selected = null; $('detail').classList.add('hidden'); };
$('detail').onclick = e => { if (e.target === $('detail')) $('close').click(); };
$('detail-log').onclick = () => { if (selected) openLog(selected); };
$('log-close').onclick = closeLog;
$('log-overlay').onclick = e => { if (e.target === $('log-overlay')) closeLog(); };
$('log-download').onclick = downloadLog;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (activeLogRadar) closeLog(); else if (selected) $('close').click(); } });

function openDetail(rid) {
  selected = rid;
  $('detail').classList.remove('hidden');
  $('detail-id').textContent = rid;
}

function get(rid, t) {
  return live[rid] || { device_id: rid, online: false, age_seconds: null,
    sensors: [false, false, false], targets: [], heading_deg: null, alarm: false };
}

async function refresh() {
  if (demo) return;
  try {
    const rsp = await fetch('/api/states', { cache: 'no-store' });
    if (!rsp.ok) throw Error('HTTP ' + rsp.status);
    const json = await rsp.json();
    if (!Array.isArray(json.radars)) throw Error('Bad data');
    for (const r of json.radars) {
      if (IDS.includes(r.device_id)) live[r.device_id] = r;
    }
    lastFetch = Date.now();
    hasFetched = true; fetchError = null;
    $('notice').textContent = tr().liveNotice;
  } catch (e) {
    live = {}; fetchError = e.message;
    $('notice').textContent = tr().errorPrefix + e.message;
  }
}
setInterval(refresh, 1200);
refresh();

function toGlobalTarget(tar, headingDeg = 0) {
  const h = (headingDeg * Math.PI / 180) + (tar.sector - 1) * Math.PI * 2 / 3;
  const xx = tar.x_mm / 1000;
  const yy = tar.y_mm / 1000;
  const x = xx * Math.cos(h) + yy * Math.sin(h);
  const y = yy * Math.cos(h) - xx * Math.sin(h);
  return { x, y, dist: Math.hypot(x, y), speed: tar.speed_cm_s || 0 };
}

function bearingDeg(x, y) {
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

function directionName(deg) { return tr().northDirections[Math.round(deg / 45) % 8]; }
function shortDirection(deg) { return tr().shortDirections[Math.round(deg / 45) % 8]; }

function speedKmh(speedCmS) {
  return Math.abs(speedCmS) * 0.036;
}

function targetDescription(tar, headingDeg, idx, compact = false) {
  const x = tr();
  const g = toGlobalTarget(tar, headingDeg || 0);
  const brg = bearingDeg(g.x, g.y);
  const dirLong = directionName(brg);
  const dirShort = shortDirection(brg);
  const kmh = speedKmh(g.speed);
  const distTxt = `${decimal(g.dist)} ${x.meters}`;
  const speedTxt = `${decimal(kmh)} ${x.kmh}`;
  if (Math.abs(g.speed) < 5) return `${x.target} ${idx}: ${compact ? x.standing : x.stationary} • ${distTxt}`;
  if (g.speed < 0) {
    return compact ? `${x.target} ${idx}: ${x.from} ${dirShort} • ${speedTxt}`
                   : `${x.target} ${idx}: ${x.approachingFrom} ${dirLong} • ${speedTxt} • ${distTxt}`;
  }
  return compact ? `${x.target} ${idx}: ${x.towards} ${dirShort} • ${speedTxt}`
                 : `${x.target} ${idx}: ${x.movingAwayTowards} ${dirLong} • ${speedTxt} • ${distTxt}`;
}

function buildSummary(d, compact = false, maxItems = 3) {
  const x = tr();
  if (!d.online) return compact ? x.noConnection : x.outOfRange;
  const targets = d.targets || [];
  if (!targets.length) return compact ? x.noTargets : x.noTargetsFull;
  const out = [];
  for (let i = 0; i < Math.min(targets.length, maxItems); i++) {
    out.push(targetDescription(targets[i], d.heading_deg || 0, i + 1, compact));
  }
  if (targets.length > maxItems) out.push(`${x.moreTargets} ${targets.length - maxItems}`);
  return out;
}

function setAlarmButton(btn, d, large = false) {
  btn.classList.remove('alert', 'clear', 'off');
  if (!d.online) {
    btn.textContent = 'OFFLINE';
    btn.classList.add('off');
  } else if ((d.targets || []).length > 0) {
    btn.textContent = 'ALARM!';
    btn.classList.add('alert');
  } else {
    btn.textContent = 'CLEAR';
    btn.classList.add('clear');
  }
  if (large) {
    btn.setAttribute('aria-label', `${tr().statusPrefix} ${d.device_id || ''}: ${btn.textContent}`);
  }
}

function paint(canvas, d, t, large = false) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width, c = s / 2, r = s * 0.45;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#082329';
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = large ? 1.6 : 0.8;

  for (let ring = 1; ring <= 4; ring++) {
    ctx.strokeStyle = '#28625a';
    ctx.beginPath();
    ctx.arc(c, c, r * ring / 4, 0, Math.PI * 2);
    ctx.stroke();
    if (large) {
      ctx.fillStyle = '#9bcabc';
      ctx.font = '15px system-ui';
      ctx.textAlign = 'left';
      const ringRadius = r * ring / 4;
      ctx.fillText(`${ring * 2} ${tr().meters}`, c + ringRadius * Math.sin(Math.PI / 7) + 5, c - ringRadius * Math.cos(Math.PI / 7) + 5);
    }
  }
  for (let k = 0; k < 12; k++) {
    let a = k * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + r * Math.sin(a), c - r * Math.cos(a));
    ctx.strokeStyle = k % 4 === 0 ? '#428475' : '#22504d';
    ctx.stroke();
  }
  const sweep = t * 0.00038;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r, sweep - Math.PI / 2 - 0.38, sweep - Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(37,217,155,.13)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(c + r * Math.sin(sweep), c - r * Math.cos(sweep));
  ctx.strokeStyle = '#55eab2';
  ctx.lineWidth = large ? 2 : 1.3;
  ctx.stroke();

  // Підписи градусів через 30° на всіх десяти малих радарах і на великому.
  // Текст всередині зовнішнього кільця, щоб не обрізався по краях canvas.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${large ? 15 : 12}px system-ui`;
  for (let deg = 0; deg < 360; deg += 30) {
    const a = deg * Math.PI / 180;
    const labelRadius = r - (large ? 19 : 16);
    const px = c + labelRadius * Math.sin(a);
    const py = c - labelRadius * Math.cos(a);
    const label = `${deg}°`;
    ctx.lineWidth = large ? 4 : 3;
    ctx.strokeStyle = '#082329';
    ctx.strokeText(label, px, py);
    ctx.fillStyle = deg % 90 === 0 ? '#e5fff6' : '#a5d8ca';
    ctx.fillText(label, px, py);
  }
  ctx.textBaseline = 'alphabetic';

  if (d.online) {
    const head = (d.heading_deg || 0) * Math.PI / 180;
    for (const tar of d.targets || []) {
      const h = head + (tar.sector - 1) * Math.PI * 2 / 3;
      const xx = tar.x_mm / 1000, yy = tar.y_mm / 1000;
      const x = xx * Math.cos(h) + yy * Math.sin(h);
      const y = yy * Math.cos(h) - xx * Math.sin(h);
      if (Math.hypot(x, y) > 8) continue;
      ctx.fillStyle = Math.abs(tar.speed_cm_s) > 0 ? '#ff7067' : '#ffd069';
      ctx.beginPath();
      ctx.arc(c + x * r / 8, c - y * r / 8, large ? 8 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!d.online) {
    ctx.fillStyle = '#ffce83';
    ctx.textAlign = 'center';
    ctx.font = `bold ${large ? 24 : 13}px system-ui`;
    ctx.fillText('OFFLINE', c, c + 6);
  }
  ctx.beginPath();
  ctx.arc(c, c, large ? 5 : 3, 0, Math.PI * 2);
  ctx.fillStyle = '#c8f9dd';
  ctx.fill();
}

// V9 — isolated alarm history for each radar.
// DEMO: persistent in this browser. LIVE: fetched from server (recorded on ingest).
let activeLogRadar = null, activeLogEntries = [], activeLogError = '';
let logFetchInProgress = false, lastLogRefresh = 0;
function timeText(value) {
  if (!value) return '—';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString(language === 'uk' ? 'uk-UA' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function durationText(item, at = Date.now()) {
  const start = Date.parse(item.start), end = item.end ? Date.parse(item.end) : at;
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) + ' ' + tr().logSeconds : '—';
}
function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function renderLog() {
  if (!activeLogRadar) return;
  const x = tr();
  $('log-radar-id').textContent = activeLogRadar;
  $('log-mode').textContent = x.logLive;
  $('log-note').textContent = x.logNote;
  if (activeLogError) {
    $('log-content').textContent = x.logUnavailable + ': ' + activeLogError;
    return;
  }
  if (!activeLogEntries.length) {
    $('log-content').textContent = x.logEmpty;
    return;
  }
  const rows = [...activeLogEntries].reverse().map((item, i) =>
    `<tr><td>${activeLogEntries.length-i}</td><td>${escapeHtml(timeText(item.start))}</td><td>${item.end ? escapeHtml(timeText(item.end)) : `<strong class="log-active">${escapeHtml(x.logActive)}</strong>`}</td><td>${escapeHtml(durationText(item))}</td></tr>`).join('');
  $('log-content').innerHTML = `<div class="log-table-scroll"><table class="log-table"><thead><tr><th>№</th><th>${x.logStart}</th><th>${x.logEnd}</th><th>${x.logDuration}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
async function refreshLog(force = false) {
  if (!activeLogRadar || logFetchInProgress || (!force && Date.now() - lastLogRefresh < 2500)) return;
  const rid = activeLogRadar;
  lastLogRefresh = Date.now();

  logFetchInProgress = true;
  try {
    const response = await fetch('/api/logs/' + encodeURIComponent(rid), { cache: 'no-store' });
    if (!response.ok) throw Error('HTTP ' + response.status);
    const data = await response.json();
    if (rid === activeLogRadar && !demo) {
      activeLogEntries = Array.isArray(data.events) ? data.events : [];
      activeLogError = '';
      renderLog();
    }
  } catch (err) {
    if (rid === activeLogRadar && !demo) { activeLogError = err.message; renderLog(); }
  } finally { logFetchInProgress = false; }
}
function openLog(rid) {
  activeLogRadar = rid;
  activeLogEntries = [];
  activeLogError = '';
  $('log-overlay').classList.remove('hidden');
  lastLogRefresh = 0;
  refreshLog(true);
  renderLog();
}
function closeLog() { activeLogRadar = null; $('log-overlay').classList.add('hidden'); }
function downloadLog() {
  if (!activeLogRadar) return;
  const x = tr();
  const lines = [`COTON RADAR 360 — ${x.logTitle}`, `Radar: ${activeLogRadar}`, 'Mode: LIVE', `Export: ${timeText(new Date())}`, '----------------------------------------'];
  if (!activeLogEntries.length) lines.push(x.logEmpty);
  for (let i = 0; i < activeLogEntries.length; i++) {
    const event = activeLogEntries[i];
    lines.push(`#${i + 1} | ${x.logStart}: ${timeText(event.start)} | ${x.logEnd}: ${event.end ? timeText(event.end) : x.logActive} | ${x.logDuration}: ${durationText(event)}`);
  }
  lines.push('');
  const file = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = `COTON_${activeLogRadar}_LIVE_LOG_${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// COTON RADAR NETWORK LIVE: no fictitious locations.
let mapView = null;
const mapMarkers = {};
let currentTab = 'map';
function setTab(tab) {
  currentTab = tab;
  const showMap = tab === 'map';
  $('map-panel').classList.toggle('hidden', !showMap);
  $('cards').classList.toggle('hidden', showMap);
  $('tab-map').classList.toggle('active', showMap);
  $('tab-radars').classList.toggle('active', !showMap);
  $('tab-map').setAttribute('aria-pressed', String(showMap));
  $('tab-radars').setAttribute('aria-pressed', String(!showMap));
  if (showMap && mapView) {
    setTimeout(() => mapView.invalidateSize(), 0);
    updateMapMarkers(Date.now(), true);
  }
}
$('tab-map').addEventListener('click', () => setTab('map'));
$('tab-radars').addEventListener('click', () => setTab('radars'));
function initMap() {
  if (!window.L) {
    $('radar-map').textContent = tr().leafletError;
    return;
  }
  mapView = L.map('radar-map', { zoomControl: true }).setView([50.5, 25.0], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(mapView);
  // Center on first confirmed live GPS coordinate when available.
  setTimeout(() => mapView.invalidateSize(), 0);
}
function mapPositionFor(d, i) {
  // No demo locations in LIVE version.
  // LIVE points only if verified numeric GPS fields are returned by the server.
  const lat = d.latitude, lon = d.longitude;
  if (typeof lat === 'number' && typeof lon === 'number' &&
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0)) {
    return [lat, lon];
  }
  return null;
}
let lastMarkerUpdate = 0, centeredOnLiveGps = false;
function updateMapMarkers(t, force = false) {
  if (!mapView || (!force && t - lastMarkerUpdate < 350)) return;
  lastMarkerUpdate = t;
  let activePositions = 0;
  let firstPosition = null;
  for (let i = 0; i < IDS.length; i++) {
    const rid = IDS[i], d = get(rid, t);
    const coords = mapPositionFor(d, i);
    if (!coords) {
      if (mapMarkers[rid]) { mapMarkers[rid].remove(); delete mapMarkers[rid]; }
      continue;
    }
    activePositions++;
    if (!firstPosition) firstPosition = coords;
    const state = !d.online ? 'offline' : (d.targets || []).length ? 'alarm' : 'clear';
    const label = String(i + 1);
    const icon = L.divIcon({
      className: 'radar-pin-wrap',
      html: `<span class="radar-pin ${state}" aria-label="${rid}: ${state === 'offline' ? tr().pinOffline : state === 'alarm' ? tr().pinAlarm : tr().pinClear}"><span class="pin-number">${label}</span></span>`,
      iconSize: [36, 46], iconAnchor: [18, 42]
    });
    if (!mapMarkers[rid]) {
      const marker = L.marker(coords, { icon, title: rid }).addTo(mapView);
      marker.on('click', () => openDetail(rid));
      mapMarkers[rid] = marker;
    } else {
      const marker = mapMarkers[rid];
      const oldPos = marker.getLatLng();
      if (oldPos.lat !== coords[0] || oldPos.lng !== coords[1]) marker.setLatLng(coords);
      if (marker._cotonState !== state) marker.setIcon(icon);
    }
    mapMarkers[rid]._cotonState = state;
  }
  if (firstPosition && !centeredOnLiveGps) {
    mapView.setView(firstPosition, 13);
    centeredOnLiveGps = true;
  }
  $('map-hint').textContent = activePositions ? tr().hintLive : tr().hintNoGps;
}
initMap();
setTab('map');
setLanguage(language);

function draw(t) {
  // Never generate simulated targets/events in LIVE mode.
  if (activeLogRadar) refreshLog();
  let online = 0, alarm = 0, n = 0;

  for (const rid of IDS) {
    const d = get(rid, t);
    paint(canvases[rid], d, t);
    if (d.online) online++;
    if (d.online && (d.targets || []).length) alarm++;
    n += d.online ? (d.targets || []).length : 0;

    const badge = $('badge-' + rid);
    badge.textContent = d.online ? ((d.targets || []).length ? 'ALARM!' : 'ONLINE') : 'OFFLINE';
    badge.className = 'state ' + (d.online ? ((d.targets || []).length ? 'alert' : 'on') : 'off');

    const summary = buildSummary(d, true, 2);
    $('meta-' + rid).innerHTML = `
      ${tr().numberTargets}: <strong>${d.online ? d.targets.length : 0}</strong> · ${d.online ? 'S1/S2/S3 ' + d.sensors.map(x => x ? '✓' : '—').join(' / ') : tr().sensorsOffline}<br>
      ${Array.isArray(summary) ? summary.join('<br>') : summary}<br>
      ${tr().heading}: ${d.heading_deg == null ? tr().noCompass : d.heading_deg + '°'}`;

    setAlarmButton($('alarm-' + rid), d);
  }

  $('online').textContent = `${online} / 10`;
  $('alarms').textContent = alarm;
  $('total').textContent = n;
  $('offline').textContent = 10 - online;

  if (selected) {
    const d = get(selected, t);
    paint($('big'), d, t, true);
    setAlarmButton($('detail-alarm'), d, true);
    const sd = d.sensors || [false, false, false];
    const summary = buildSummary(d, false, 3);
    $('detail-summary').innerHTML = Array.isArray(summary)
      ? `<div class="summary-title">${tr().targetsInZone}</div><ul>${summary.map(x => `<li>${x}</li>`).join('')}</ul>`
      : summary;
    $('detail-stats').innerHTML = `
      <div class="details">
        <div>${tr().state}<strong>${d.online ? (d.targets.length ? 'ALARM!' : 'ONLINE') : 'OFFLINE'}</strong></div>
        <div>${tr().targets}<strong>${d.online ? d.targets.length : 0}</strong></div>
        <div>${tr().direction}<strong>${d.heading_deg == null ? '—' : d.heading_deg + '°'}</strong></div>
        <p>S1 ${sd[0] ? 'OK' : '—'} · S2 ${sd[1] ? 'OK' : '—'} · S3 ${sd[2] ? 'OK' : '—'} · ${tr().updated}: ${d.age_seconds == null ? '—' : d.age_seconds + ' ' + tr().sec}</p>
      </div>`;
  }

  updateMapMarkers(t);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
