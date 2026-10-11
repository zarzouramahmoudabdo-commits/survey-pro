import L from 'leaflet';
import proj4 from 'proj4';

const $ = (id) => document.getElementById(id);
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2200); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f3 = (v) => Number(v).toFixed(3);
const def = () => (window.__geoDef ? window.__geoDef() : '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs');
const toNE = (lat, lon) => { const [e, n] = proj4('EPSG:4326', def(), [lon, lat]); return [n, e]; };
const toLL = (n, e) => { const [lon, lat] = proj4(def(), 'EPSG:4326', [e, n]); return [lat, lon]; };
function dms(deg) {
  let d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}
let on = false, pts = [], lay = null, cross = null;
const css = document.createElement('style');
css.textContent = `
#gmpanel{position:absolute;left:10px;right:64px;top:70px;z-index:1100;background:#0f172af7;border:1px solid #f59e0b;border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.7;direction:rtl;max-height:46%;overflow:auto}
#gmpanel.hidden{display:none}
.gcross{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;z-index:1000;pointer-events:none}
.gcross:before,.gcross:after{content:"";position:absolute;background:#f59e0b;box-shadow:0 0 3px #000}
.gcross:before{left:16px;top:0;width:2px;height:34px}.gcross:after{top:16px;left:0;height:2px;width:34px}`;
document.head.appendChild(css);
const tools = document.querySelector('#geoView .gtools');
const btn = document.createElement('button');
btn.id = 'gmBtn'; btn.title = 'قياس'; btn.textContent = '📏';
tools.appendChild(btn);
const panel = document.createElement('div');
panel.id = 'gmpanel'; panel.className = 'hidden';
panel.innerHTML = '<div class="rowb"><button class="g" id="gmAdd">➕ نقطة هنا</button><button id="gmSnap">🎯 أقرب ثابتة</button><button class="s" id="gmUndo">↩</button><button class="s" id="gmClr">🗑</button></div><div id="gmInfo"></div>';
$('geoView').appendChild(panel);

function render() {
  const map = window.__gmap; if (!map) return;
  if (!lay) lay = L.layerGroup().addTo(map);
  lay.clearLayers();
  pts.forEach((p, i) => L.circleMarker(toLL(p.n, p.e), { radius: 6, color: '#fff', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }).bindTooltip(String(i + 1) + (p.name ? ' · ' + p.name : ''), { permanent: true, direction: 'top', offset: [0, -6] }).addTo(lay));
  if (pts.length > 1) L.polyline(pts.map((p) => toLL(p.n, p.e)), { color: '#f59e0b', weight: 3, dashArray: '6 6' }).addTo(lay);
  let h = '';
  if (!pts.length) h = 'حرّك الخريطة لحد ما العلامة + تبقى على النقطة، واضغط ➕ (أو 🎯 يلزّق على أقرب ثابتة)';
  let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dn = b.n - a.n, de = b.e - a.e, d = Math.hypot(dn, de);
    let az = (Math.atan2(de, dn) * 180) / Math.PI; if (az < 0) az += 360;
    tot += d;
    h += `<div>${i}→${i + 1}: <b>${f3(d)} م</b> | Az ${dms(az)} | ΔN ${dn.toFixed(2)} ΔE ${de.toFixed(2)}</div>`;
  }
  if (pts.length > 1) h += `<div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px">المجموع: <b>${f3(tot)} م</b></div>`;
  if (pts.length > 2) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.e * b.n - b.e * a.n; }
    const last = pts[pts.length - 1], first = pts[0];
    h += `<div>المحيط (مقفول): ${f3(tot + Math.hypot(first.n - last.n, first.e - last.e))} م | المساحة: <b>${f3(Math.abs(s) / 2)} م²</b></div>`;
  }
  $('gmInfo').innerHTML = h;
}
function centerNE() { const c = window.__gmap.getCenter(); return toNE(c.lat, c.lng); }
function nearest() {
  const [cn, ce] = centerNE();
  const cand = [];
  (window.__bmGet ? window.__bmGet() : []).forEach((b) => cand.push({ n: b.n, e: b.e, name: b.name }));
  (window.__pts ? window.__pts() : []).forEach((p) => cand.push({ n: p.n, e: p.e, name: p.name }));
  let best = null, bd = 40;
  for (const c of cand) { const d = Math.hypot(c.n - cn, c.e - ce); if (d < bd) { bd = d; best = c; } }
  return best;
}
function setOn(v) {
  on = v;
  if (!window.__gmap) return;
  btn.classList.toggle('on', on); panel.classList.toggle('hidden', !on);
  const cont = window.__gmap.getContainer();
  if (on && !cross) { cross = document.createElement('div'); cross.className = 'gcross'; cont.appendChild(cross); }
  if (cross) cross.style.display = on ? '' : 'none';
  if (on) render(); else if (lay) lay.clearLayers();
}
btn.onclick = () => { if (!window.__gmap) { toast('افتح الخريطة الأول'); return; } setOn(!on); };
$('gmAdd').onclick = () => { const [n, e] = centerNE(); pts.push({ n, e }); render(); };
$('gmSnap').onclick = () => {
  const b = nearest();
  if (!b) { toast('مفيش ثابتة أو نقطة على بعد أقل من 40 م من العلامة'); return; }
  pts.push({ n: b.n, e: b.e, name: b.name }); window.__gmap.setView(toLL(b.n, b.e), window.__gmap.getZoom(), { animate: false }); render();
};
$('gmUndo').onclick = () => { pts.pop(); render(); };
$('gmClr').onclick = () => { pts = []; render(); };
