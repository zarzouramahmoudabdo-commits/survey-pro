import L from 'leaflet';
import proj4 from 'proj4';

const $ = (id) => document.getElementById(id);
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2000); };
const f3 = (v) => Number(v).toFixed(3);
const def = () => (window.__geoDef ? window.__geoDef() : '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs');
const toNE = (lat, lon) => { const [e, n] = proj4('EPSG:4326', def(), [lon, lat]); return [n, e]; };
function dms(deg) {
  let d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}
let pin = null, ll = null, armed = false, timer = 0, tick = 0, count = 0;
const css = document.createElement('style');
css.textContent = `
#pincard{position:absolute;left:10px;right:10px;bottom:10px;z-index:1100;background:#0f172af7;border:1px solid #ef4444;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.7;direction:rtl}
#pincard.hidden{display:none}
#pincard .pr{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#pincard input{background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:8px;font-size:14px;width:100%;margin-top:4px}
.pinic{font-size:34px;line-height:1;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 2px #000)}`;
document.head.appendChild(css);
const tools = document.querySelector('#geoView .gtools');
const btn = document.createElement('button');
btn.id = 'pinBtn'; btn.title = 'حط نقطة'; btn.textContent = '📍+';
btn.style.fontSize = '15px';
tools.appendChild(btn);
const card = document.createElement('div');
card.id = 'pincard'; card.className = 'hidden';
$('geoView').appendChild(card);

function info() {
  const [n, e] = toNE(ll.lat, ll.lng);
  let me = '';
  const m = window.__bmMe ? window.__bmMe() : null;
  if (m) {
    const [mn, mE] = toNE(m.lat, m.lon), dn = n - mn, de = e - mE, d = Math.hypot(dn, de);
    let az = (Math.atan2(de, dn) * 180) / Math.PI; if (az < 0) az += 360;
    me = `<div>المسافة من موقعك: <b>${d >= 1000 ? (d / 1000).toFixed(2) + ' كم' : d.toFixed(1) + ' م'}</b> | الاتجاه ${dms(az)}</div>`;
  }
  return { n, e, me };
}
function render() {
  if (!ll) { card.classList.add('hidden'); return; }
  const { n, e, me } = info();
  const nm = card.querySelector('#pinName') ? card.querySelector('#pinName').value : '';
  card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>📍 نقطة على الخريطة</b><button class="s" data-a="del">✕</button></div>
<div style="direction:ltr;text-align:right">N ${f3(n)} | E ${f3(e)}<br>${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}</div>${me}
<input id="pinName" placeholder="اسم (اختياري) للحفظ كثابتة" value="${nm.replace(/"/g, '&quot;')}">
<div class="pr"><button class="g" data-a="go">🧭 توجّه ليها</button><button data-a="save">💾 احفظها كثابتة</button><button data-a="cp">📋 نسخ</button></div>
<small style="color:#94a3b8">اسحب الدبوس عشان تغيّر مكانه.</small>`;
  card.classList.remove('hidden');
}
function drop(latlng) {
  const gm = window.__gmap; if (!gm) return;
  ll = L.latLng(latlng.lat, latlng.lng);
  if (!pin) {
    pin = L.marker(ll, { draggable: true, icon: L.divIcon({ className: '', html: '<div class="pinic">📍</div>', iconSize: [0, 0] }) }).addTo(gm);
    pin.on('dragend', () => { ll = pin.getLatLng(); if (window.__bmTmp) { const { n, e } = info(); window.__bmGoTmp(n, e, 'نقطة'); } render(); });
  } else pin.setLatLng(ll);
  try { navigator.vibrate && navigator.vibrate(30); } catch (err) { /* ignore */ }
  render();
  clearInterval(tick); tick = setInterval(() => { if (ll && !card.querySelector('#pinName:focus')) render(); }, 2500);
}
function clearPin() {
  clearInterval(tick);
  if (pin && window.__gmap) window.__gmap.removeLayer(pin);
  pin = null; ll = null; card.classList.add('hidden');
  if (window.__bmClearTmp) window.__bmClearTmp();
}
card.addEventListener('click', (ev) => {
  const a = ev.target.dataset && ev.target.dataset.a; if (!a || !ll) return;
  const { n, e } = info();
  if (a === 'del') clearPin();
  else if (a === 'go') { if (window.__bmGoTmp) window.__bmGoTmp(n, e, (card.querySelector('#pinName').value || '').trim() || 'نقطة'); }
  else if (a === 'save') {
    if (!window.__bmAddLL) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
    count++; const nm = (card.querySelector('#pinName').value || '').trim() || 'نقطة ' + count;
    window.__bmAddLL(nm, 'اتحطت يدوي من الخريطة', ll.lat, ll.lng); toast('اتحفظت كثابتة: ' + nm);
  } else if (a === 'cp') { try { navigator.clipboard.writeText(`${f3(n)},${f3(e)}`); toast('تم نسخ N,E'); } catch (err) { /* ignore */ } }
});
// الضغطة الطويلة على الخريطة
function bind(gm) {
  const c = gm.getContainer();
  let sx = 0, sy = 0, ev0 = null;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  c.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.leaflet-control,.leaflet-popup,.gcross')) return;
    cancel(); sx = e.clientX; sy = e.clientY; ev0 = e;
    timer = setTimeout(() => { timer = 0; drop(gm.mouseEventToLatLng(ev0)); }, 550);
  });
  c.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, cancel));
  c.addEventListener('contextmenu', (e) => e.preventDefault());
}
btn.onclick = () => {
  const gm = window.__gmap; if (!gm) { toast('افتح الخريطة الأول'); return; }
  armed = !armed; btn.classList.toggle('on', armed);
  if (armed) { toast('اضغط على أي مكان في الخريطة'); gm.once('click', (e) => { armed = false; btn.classList.remove('on'); drop(e.latlng); }); }
};
let bound = false;
const tryBind = () => { if (!bound && window.__gmap) { bound = true; bind(window.__gmap); } };
window.addEventListener('geo-draw', tryBind);
tryBind();
