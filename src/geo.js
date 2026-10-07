import L from 'leaflet';
import proj4 from 'proj4';

const PRESETS = [
  ['utm35', 'UTM زون 35N (WGS84)', '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs'],
  ['utm36', 'UTM زون 36N (WGS84)', '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs'],
  ['utm37', 'UTM زون 37N (WGS84)', '+proj=utm +zone=37 +datum=WGS84 +units=m +no_defs'],
  ['geo', 'خط طول/عرض WGS84 (N=lat, E=lon)', 'EPSG:4326'],
  ['custom', 'نظام مخصص (proj4)', ''],
];

const css = document.createElement('style');
css.textContent = `
#geoView{position:absolute;inset:0;display:flex;flex-direction:column}
#geoView.hidden{display:none}
#gmap{flex:1;min-height:0;background:#0b1220}
#geoInfo{padding:6px 12px;font-size:12px;color:#94a3b8;direction:ltr;text-align:left}
#geoInfo a{color:#38bdf8}
#geoInfo .bad{color:#f87171}
#geoCustom{flex:1;min-width:180px;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:8px;font-size:12px;direction:ltr}
.gl{background:#0f172ad9;border:0;color:#fde68a;font-weight:700;box-shadow:none;padding:1px 4px}
.gl:before{display:none}`;
document.head.appendChild(css);

const $ = (id) => document.getElementById(id);
const f6 = (v) => v.toFixed(6);
const f3 = (v) => v.toFixed(3);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function dmsLL(v, pos, neg) {
  const h = v >= 0 ? pos : neg;
  v = Math.abs(v);
  const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = (mf - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2).padStart(5, '0')}"${h}`;
}

// ---- بناء الواجهة ----
const nav = document.querySelector('nav');
const btn = document.createElement('button');
btn.id = 'tGeo'; btn.textContent = '🌍 قمر صناعي';
nav.appendChild(btn);

const view = document.createElement('div');
view.id = 'geoView'; view.className = 'hidden';
view.innerHTML = `
<div class="bar">
  <select id="crs">${PRESETS.map((p) => `<option value="${p[0]}">${p[1]}</option>`).join('')}</select>
  <input id="geoCustom" class="hidden" placeholder="+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs" />
</div>
<div id="geoInfo"></div>
<div id="gmap"></div>`;
$('views').appendChild(view);

let gmap = null, layer = null;
const getPts = () => (window.__pts ? window.__pts() : []);

function defOf() {
  const k = $('crs').value;
  if (k === 'custom') return $('geoCustom').value.trim();
  return PRESETS.find((p) => p[0] === k)[2];
}

function initMap() {
  if (gmap) return;
  gmap = L.map('gmap', { maxZoom: 22 });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 17, attribution: 'Esri' });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
  sat.addTo(gmap);
  L.control.layers({ 'قمر صناعي': sat, 'خريطة': osm }).addTo(gmap);
  L.control.scale({ imperial: false }).addTo(gmap);
  gmap.setView([30, 31], 5);
  layer = L.layerGroup().addTo(gmap);
  window.__gmap = gmap;
}

function draw() {
  initMap();
  gmap.invalidateSize();
  layer.clearLayers();
  window.dispatchEvent(new Event('geo-draw'));
  const info = $('geoInfo');
  const pts = getPts();
  if (!pts.length) { info.textContent = 'ارفع ملف نقط الأول.'; return; }
  const def = defOf();
  if (!def) { info.textContent = 'اكتب تعريف النظام.'; return; }
  let conv;
  try { conv = proj4(def, 'EPSG:4326'); conv.forward([pts[0].e, pts[0].n]); }
  catch (err) { info.innerHTML = '<span class="bad">تعريف النظام غير صحيح</span>'; return; }
  const out = [];
  let bad = 0;
  for (const p of pts) {
    let lon, lat;
    try { [lon, lat] = conv.forward([p.e, p.n]); } catch { bad++; continue; }
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { bad++; continue; }
    out.push({ p, lat, lon });
  }
  if (!out.length) { info.innerHTML = '<span class="bad">الإحداثيات دي مش مناسبة للنظام ده</span>'; return; }
  const ll = out.map((o) => [o.lat, o.lon]);
  if (ll.length > 1) L.polyline(ll, { color: '#38bdf8', weight: 2 }).addTo(layer);
  out.forEach(({ p, lat, lon }) => {
    const m = L.circleMarker([lat, lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#f43f5e', fillOpacity: 1 }).addTo(layer);
    m.bindTooltip(String(p.name), { permanent: true, direction: 'right', offset: [6, 0], className: 'gl' });
    const d = document.createElement('div');
    d.style.cssText = 'direction:ltr;font-size:13px;line-height:1.6';
    d.innerHTML = `<b>${esc(p.name)}</b><div>Lat: ${f6(lat)}</div><div>Lon: ${f6(lon)}</div><div>${dmsLL(lat, 'N', 'S')} ${dmsLL(lon, 'E', 'W')}</div><div>N: ${f3(p.n)} E: ${f3(p.e)}</div><button>نسخ lat,lon</button>`;
    d.querySelector('button').onclick = async () => { try { await navigator.clipboard.writeText(`${f6(lat)},${f6(lon)}`); } catch {} };
    m.bindPopup(d);
  });
  gmap.fitBounds(L.latLngBounds(ll).pad(0.3), { maxZoom: 19 });
  const f = out[0];
  info.innerHTML = `أول نقطة (${esc(f.p.name)}): ${f6(f.lat)}, ${f6(f.lon)} — <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${f6(f.lat)},${f6(f.lon)}">افتح في Google Maps</a>` + (bad ? ` <span class="bad">(${bad} نقطة خارج النطاق)</span>` : '');
}

function show() {
  $('tableView').classList.add('hidden');
  $('mapView').classList.add('hidden');
  view.classList.remove('hidden');
  $('tTable').classList.remove('on');
  $('tMap').classList.remove('on');
  btn.classList.add('on');
  draw();
}
function hide() { view.classList.add('hidden'); btn.classList.remove('on'); }

btn.onclick = show;
$('tTable').addEventListener('click', hide);
$('tMap').addEventListener('click', hide);
$('crs').onchange = () => { $('geoCustom').classList.toggle('hidden', $('crs').value !== 'custom'); draw(); };
$('geoCustom').addEventListener('change', draw);
window.__geoDef = defOf;
import('./bm.js');
