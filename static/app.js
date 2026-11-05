const IDS = Array.from({ length: 10 }, (_, i) => `RADAR-${String(i + 1).padStart(2, '0')}`);
const $ = id => document.getElementById(id);
let live = {}, demo = false, selected = null, lastFetch = 0;
const cards = $('cards');
const canvases = {};

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
    <canvas width="300" height="300" aria-label="Радар ${rid}"></canvas>
    <div class="meta" id="meta-${rid}">Немає зв’язку</div>
    <div class="unit-actions">
      <button class="alarm-button off" id="alarm-${rid}" type="button">OFFLINE</button>
    </div>`;
  cell.addEventListener('click', () => openDetail(rid));
  cell.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(rid); });
  cell.querySelector(`#alarm-${rid}`).addEventListener('click', e => { e.stopPropagation(); openDetail(rid); });
  cards.appendChild(cell);
  canvases[rid] = cell.querySelector('canvas');
}

$('demo').addEventListener('click', () => {
  demo = !demo;
  $('demo').textContent = demo ? 'Вимкнути ДЕМО' : 'Увімкнути ДЕМО';
  $('mode').textContent = demo ? 'DEMO' : 'LIVE';
  $('mode').className = 'pill ' + (demo ? 'demo' : '');
});

$('close').onclick = () => { selected = null; $('detail').classList.add('hidden'); };
$('detail').onclick = e => { if (e.target === $('detail')) $('close').click(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) $('close').click(); });

function openDetail(rid) {
  selected = rid;
  $('detail').classList.remove('hidden');
  $('detail-id').textContent = rid;
}

function fake(rid, t) {
  const i = IDS.indexOf(rid);
  const offline = [4, 9].includes(i);
  const alarm = [0, 2, 5, 7].includes(i);
  const targets = [];
  if (!offline && alarm) {
    targets.push({
      sector: (i % 3) + 1,
      x_mm: Math.round(1400 * Math.sin(t * 0.00025 + i)),
      y_mm: 3300 + 200 * i,
      speed_cm_s: i % 2 ? 0 : -32
    });
    if (i % 3 === 0) {
      targets.push({
        sector: ((i + 1) % 3) + 1,
        x_mm: 400 + Math.round(700 * Math.cos(t * 0.00018 + i)),
        y_mm: 1800 + 50 * i,
        speed_cm_s: -18
      });
    }
  }
  return {
    device_id: rid,
    online: !offline,
    age_seconds: offline ? 12 : 0,
    sensors: offline ? [false, false, false] : [true, true, true],
    targets,
    heading_deg: (i * 37) % 360,
    alarm: targets.length > 0
  };
}

function get(rid, t) {
  return demo
    ? fake(rid, t)
    : (live[rid] || { device_id: rid, online: false, age_seconds: null, sensors: [false, false, false], targets: [], heading_deg: null, alarm: false });
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
    $('notice').textContent = 'Дані з сервера. Натисни на радар або кнопку ALARM/CLEAR для перегляду на весь екран.';
  } catch (e) {
    live = {};
    $('notice').textContent = 'Немає зв’язку із сервером: ' + e.message;
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

function directionName(deg) {
  const dirs = [
    'півночі', 'північного сходу', 'сходу', 'південного сходу',
    'півдня', 'південного заходу', 'заходу', 'північного заходу'
  ];
  return dirs[Math.round(deg / 45) % 8];
}

function shortDirection(deg) {
  const dirs = ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'];
  return dirs[Math.round(deg / 45) % 8];
}

function speedKmh(speedCmS) {
  return Math.abs(speedCmS) * 0.036;
}

function targetDescription(tar, headingDeg, idx, compact = false) {
  const g = toGlobalTarget(tar, headingDeg || 0);
  const brg = bearingDeg(g.x, g.y);
  const dirLong = directionName(brg);
  const dirShort = shortDirection(brg);
  const kmh = speedKmh(g.speed);
  const distTxt = `${g.dist.toFixed(1)} м`;

  if (Math.abs(g.speed) < 5) {
    return compact
      ? `Ціль ${idx}: стоїть • ${distTxt}`
      : `Ціль ${idx}: нерухома • ${distTxt}`;
  }

  if (g.speed < 0) {
    return compact
      ? `Ціль ${idx}: з ${dirShort} • ${kmh.toFixed(1)} км/год`
      : `Ціль ${idx}: наближається з ${dirLong} • ${kmh.toFixed(1)} км/год • ${distTxt}`;
  }

  return compact
    ? `Ціль ${idx}: у бік ${dirShort} • ${kmh.toFixed(1)} км/год`
    : `Ціль ${idx}: віддаляється у бік ${dirLong} • ${kmh.toFixed(1)} км/год • ${distTxt}`;
}

function buildSummary(d, compact = false, maxItems = 3) {
  if (!d.online) return compact ? 'Без зв’язку' : 'Комплекс офлайн.';
  const targets = d.targets || [];
  if (!targets.length) return compact ? 'Цілей немає' : 'Цілей немає.';
  const out = [];
  for (let i = 0; i < Math.min(targets.length, maxItems); i++) {
    out.push(targetDescription(targets[i], d.heading_deg || 0, i + 1, compact));
  }
  if (targets.length > maxItems) out.push(`Ще цілей: ${targets.length - maxItems}`);
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
    btn.setAttribute('aria-label', `Стан ${d.device_id || ''}: ${btn.textContent}`);
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
      ctx.fillText(`${ring * 2} м`, c + ringRadius * Math.sin(Math.PI / 7) + 5, c - ringRadius * Math.cos(Math.PI / 7) + 5);
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

function draw(t) {
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
      Цілей: <strong>${d.online ? d.targets.length : 0}</strong> · ${d.online ? 'S1/S2/S3 ' + d.sensors.map(x => x ? '✓' : '—').join(' / ') : 'без зв’язку'}<br>
      ${Array.isArray(summary) ? summary.join('<br>') : summary}<br>
      Курс: ${d.heading_deg == null ? 'немає компаса' : d.heading_deg + '°'}`;

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
      ? `<div class="summary-title">Цілі в зоні:</div><ul>${summary.map(x => `<li>${x}</li>`).join('')}</ul>`
      : summary;
    $('detail-stats').innerHTML = `
      <div class="details">
        <div>СТАН<strong>${d.online ? (d.targets.length ? 'ALARM!' : 'ONLINE') : 'OFFLINE'}</strong></div>
        <div>ЦІЛЕЙ<strong>${d.online ? d.targets.length : 0}</strong></div>
        <div>НАПРЯМОК<strong>${d.heading_deg == null ? '—' : d.heading_deg + '°'}</strong></div>
        <p>S1 ${sd[0] ? 'OK' : '—'} · S2 ${sd[1] ? 'OK' : '—'} · S3 ${sd[2] ? 'OK' : '—'} · Оновлення: ${d.age_seconds == null ? '—' : d.age_seconds + ' с'}</p>
      </div>`;
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
