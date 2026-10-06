import './style.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { parsePoints } from './parser.js';

const DEMO = `00NMSDR33 Demo
08KI1               1000.000          2000.000            10.500  BM
08KI2               1025.340          2040.120            10.870  CORNER
08KI3               1060.900          2085.400            11.200  CORNER
08KI4               1100.250          2050.800            10.950  POLE`;

let points = [];
let dirty = false;
let tab = 'table';
let measure = false;
let sel = [];
const opts = { line: true, nums: true, close: false };

const $ = (id) => document.getElementById(id);
const f3 = (v) => v.toFixed(3);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('app').innerHTML = `
<header><h1>Mahmoud Zarzoura</h1><span id="count">0 نقطة</span></header>
<section class="bar">
  <input type="file" id="file" accept=".sdr,.txt,.csv,.dat,.xyz,.pts" />
  <select id="order">
    <option value="AUTO">ترتيب: تلقائي</option>
    <option value="NE">N ثم E</option>
    <option value="EN">E ثم N</option>
  </select>
  <button id="demo">تجريبي</button>
</section>
<main id="views">
  <div id="tableView">
    <div class="bar"><button id="copyAll">نسخ الكل</button></div>
    <div class="wrap"><table>
      <thead><tr><th>#</th><th>النقطة</th><th>N</th><th>E</th><th>Z</th><th>الكود</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </div>
  <div id="mapView" class="hidden">
    <div id="map"></div>
    <div class="tools">
      <button id="bFit" title="ملاءمة">⤢</button>
      <button id="bNums" class="on" title="الأسماء">Ⓝ</button>
      <button id="bLine" class="on" title="ربط النقط">〰</button>
      <button id="bClose" title="إغلاق الشكل">⬠</button>
      <button id="bMeas" title="قياس">📏</button>
    </div>
    <div id="mpanel" class="hidden"></div>
  </div>
</main>
<nav>
  <button id="tTable" class="on">☰ الجدول</button>
  <button id="tMap">🗺 الخريطة</button>
</nav>
<div id="toast"></div>`;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.className = 'show';
  setTimeout(() => (t.className = ''), 1500);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('تم النسخ');
}

// ---------- الجدول ----------
function render() {
  $('count').textContent = points.length + ' نقطة';
  $('rows').innerHTML = points.map((p) =>
    `<tr data-i="${p.id - 1}"><td>${p.id}</td><td>${esc(p.name)}</td><td>${f3(p.n)}</td><td>${f3(p.e)}</td><td>${f3(p.z)}</td><td>${esc(p.code)}</td></tr>`).join('');
}

// ---------- حسابات القياس ----------
function dms(deg) {
  let d = Math.floor(deg);
  let m = Math.floor((deg - d) * 60);
  let s = Math.round(((deg - d) * 60 - m) * 60 * 10) / 10;
  if (s >= 60) { s -= 60; m += 1; }
  if (m >= 60) { m -= 60; d += 1; }
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`;
}
function seg(a, b) {
  const dn = b.n - a.n, de = b.e - a.e;
  const hd = Math.hypot(dn, de);
  let az = (Math.atan2(de, dn) * 180) / Math.PI;
  if (az < 0) az += 360;
  const dz = b.z - a.z;
  return { hd, az, dz, sd: Math.hypot(hd, dz), slope: hd > 0 ? (dz / hd) * 100 : 0 };
}
function polyArea(ps) {
  let s = 0;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    s += a.e * b.n - b.e * a.n;
  }
  return Math.abs(s) / 2;
}

// ---------- الخريطة ----------
const map = L.map('map', { crs: L.CRS.Simple, minZoom: -8, maxZoom: 14, zoomSnap: 0.25, attributionControl: false });
map.setView([0, 0], 0);
L.control.scale({ imperial: false }).addTo(map);
const layer = L.layerGroup().addTo(map);
const mlayer = L.layerGroup().addTo(map);
const ll = (p) => [p.n, p.e];

function popupEl(p) {
  const d = document.createElement('div');
  d.className = 'pop';
  d.innerHTML = `<b>${esc(p.name)}</b><div>N: ${f3(p.n)}</div><div>E: ${f3(p.e)}</div><div>Z: ${f3(p.z)}</div>` +
    (p.code ? `<div>${esc(p.code)}</div>` : '') +
    `<div class="pb"><button data-k="nez">نسخ N,E,Z</button><button data-k="en">نسخ E,N</button></div>`;
  d.addEventListener('click', (ev) => {
    const k = ev.target.dataset.k; if (!k) return;
    copy(k === 'nez' ? `${f3(p.n)},${f3(p.e)},${f3(p.z)}` : `${f3(p.e)},${f3(p.n)}`);
  });
  return d;
}

function fit() {
  if (!points.length) return;
  map.invalidateSize();
  map.fitBounds(L.latLngBounds(points.map(ll)).pad(0.25), { maxZoom: 12 });
}

function drawMap(doFit) {
  layer.clearLayers();
  if (!points.length) return;
  if (opts.line && points.length > 1) {
    const c = points.map(ll);
    if (opts.close) c.push(c[0]);
    L.polyline(c, { color: '#38bdf8', weight: 2 }).addTo(layer);
  }
  points.forEach((p) => {
    const icon = L.divIcon({
      className: 'pt',
      html: `<span class="dot"></span>${opts.nums ? `<span class="lbl">${esc(p.name)}</span>` : ''}`,
      iconSize: [0, 0],
    });
    const m = L.marker(ll(p), { icon }).addTo(layer);
    if (measure) m.on('click', () => addSel(p));
    else m.bindPopup(popupEl(p), { offset: [0, -4] });
  });
  if (doFit) fit();
}

// ---------- القياس ----------
function drawMeasure() {
  mlayer.clearLayers();
  const box = $('mpanel');
  if (!measure) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  sel.forEach((p) => L.circleMarker(ll(p), { radius: 9, color: '#f59e0b', weight: 3, fill: false }).addTo(mlayer));
  if (sel.length > 1) L.polyline(sel.map(ll), { color: '#f59e0b', weight: 3, dashArray: '6 6' }).addTo(mlayer);
  let html = '<div class="mh"><b>📏 قياس</b><span><button id="mUndo">↩</button><button id="mClear">✕</button></span></div>';
  if (sel.length === 0) html += '<div>اضغط على نقطتين أو أكتر</div>';
  if (sel.length === 1) html += `<div>${esc(sel[0].name)} — اختار النقطة التانية</div>`;
  if (sel.length >= 2) {
    const a = sel[sel.length - 2], b = sel[sel.length - 1];
    const s = seg(a, b);
    html += `<div class="mt">${esc(a.name)} ➜ ${esc(b.name)}</div>
      <div>مسافة أفقية: <b>${f3(s.hd)}</b> م</div>
      <div>مسافة مائلة: ${f3(s.sd)} م</div>
      <div>Azimuth: <b>${dms(s.az)}</b> (${s.az.toFixed(4)}°)</div>
      <div>ΔZ: ${f3(s.dz)} م | ميل: ${s.slope.toFixed(2)}%</div>`;
    if (sel.length > 2) {
      let tot = 0;
      for (let i = 1; i < sel.length; i++) tot += seg(sel[i - 1], sel[i]).hd;
      const per = tot + seg(sel[sel.length - 1], sel[0]).hd;
      html += `<div class="mt">المجموع: <b>${f3(tot)}</b> م</div>
        <div>المحيط (مقفول): ${f3(per)} م</div>
        <div>المساحة: <b>${f3(polyArea(sel))}</b> م²</div>`;
    }
  }
  box.innerHTML = html;
}
function addSel(p) { sel.push(p); drawMeasure(); }

// ---------- التنقل ----------
function showTab(t) {
  tab = t;
  $('tableView').classList.toggle('hidden', t !== 'table');
  $('mapView').classList.toggle('hidden', t !== 'map');
  $('tTable').classList.toggle('on', t === 'table');
  $('tMap').classList.toggle('on', t === 'map');
  if (t === 'map') {
    map.invalidateSize();
    if (dirty) { drawMap(true); dirty = false; }
  }
}

function load(text) {
  points = parsePoints(text, $('order').value);
  sel = [];
  render(); window.__changed && window.__changed();
  dirty = true;
  if (tab === 'map') { drawMap(true); dirty = false; }
  drawMeasure();
  toast(points.length ? 'تم استيراد ' + points.length + ' نقطة' : 'مفيش نقط اتقرت');
}

// ---------- الأحداث ----------
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const t = await f.text(); e.target.value = ''; load(t); }
  catch (err) { e.target.value = ''; toast('تعذر قراءة الملف: ' + (err.message || err)); }
});
$('demo').onclick = () => load(DEMO);
$('copyAll').onclick = () => copy(points.map((p) => [p.name, p.n, p.e, p.z, p.code].join('\t')).join('\n'));
$('rows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const p = points[+tr.dataset.i];
  copy(`${p.name}\t${p.n}\t${p.e}\t${p.z}`);
});
$('tTable').onclick = () => showTab('table');
$('tMap').onclick = () => showTab('map');
$('bFit').onclick = fit;
$('bNums').onclick = (e) => { opts.nums = !opts.nums; e.currentTarget.classList.toggle('on', opts.nums); drawMap(false); };
$('bLine').onclick = (e) => { opts.line = !opts.line; e.currentTarget.classList.toggle('on', opts.line); drawMap(false); };
$('bClose').onclick = (e) => { opts.close = !opts.close; e.currentTarget.classList.toggle('on', opts.close); drawMap(false); };
$('bMeas').onclick = (e) => {
  measure = !measure; sel = [];
  e.currentTarget.classList.toggle('on', measure);
  map.closePopup();
  drawMap(false); drawMeasure();
};
$('mpanel').addEventListener('click', (e) => {
  if (e.target.id === 'mUndo') { sel.pop(); drawMeasure(); }
  if (e.target.id === 'mClear') { sel = []; drawMeasure(); }
});
window.__pts = () => points;
import('./geo.js');
window.__map = map;
import('./dxf.js');
window.__setPts = (a) => { points = a; sel = []; render(); dirty = true; if (tab === 'map') { drawMap(false); dirty = false; } drawMeasure(); window.__changed && window.__changed(); };
import('./edit.js');
window.__setPts = (a) => { points = a; sel = []; render(); dirty = true; if (tab === 'map') { drawMap(false); dirty = false; } drawMeasure(); window.__changed && window.__changed(); };
import('./edit.js');
