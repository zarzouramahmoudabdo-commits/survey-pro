import L from 'leaflet';
import proj4 from 'proj4';

const KEY = 'sp_bm_v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => { const s = String(v).trim().replace(',', '.'); return s !== '' && !isNaN(s) ? parseFloat(s) : NaN; };
const f3 = (v) => Number(v).toFixed(3);
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 1800); };

let bms = [];
try { bms = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(bms)) bms = []; } catch (e) { bms = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(bms)); } catch (e) { /* ignore */ } if (window.__bmChanged) window.__bmChanged(bms); };
window.__bmGet = () => bms;
window.__bmAddLL = (name, desc, lat, lon) => { const [n, e] = toNE(lat, lon); const b = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, desc, n: Number(n.toFixed(3)), e: Number(e.toFixed(3)), z: null }; bms.push(b); save(); if (ensureMap()) renderBms(); return b.id; };
window.__bmGo = (id) => setTarget(id);
window.__bmSet = (a) => { bms = a; try { localStorage.setItem(KEY, JSON.stringify(bms)); } catch (e) { /* ignore */ } if (window.__bmChanged) window.__bmChanged(bms); if (ensureMap()) renderBms(); if (!list.classList.contains('hidden')) renderRows(); };
let target = null, me = null, watchId = null, editing = null, arrived = false, firstFix = false;
let gm = null, bmLayer = null, meLayer = null;

const def = () => (window.__geoDef ? window.__geoDef() : '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs');
const toLL = (n, e) => { const [lon, lat] = proj4(def(), 'EPSG:4326', [e, n]); return [lat, lon]; };
const toNE = (lat, lon) => { const [e, n] = proj4('EPSG:4326', def(), [lon, lat]); return [n, e]; };
const DIRS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
const fmtDist = (d) => (d >= 1000 ? (d / 1000).toFixed(2) + ' كم' : d.toFixed(1) + ' م');
function dms(deg) {
  let d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}
function navTo(b) {
  const [mn, mE] = toNE(me.lat, me.lon);
  const dn = b.n - mn, de = b.e - mE;
  let az = (Math.atan2(de, dn) * 180) / Math.PI; if (az < 0) az += 360;
  return { dist: Math.hypot(dn, de), az, dn, de };
}

// ---------- الواجهة ----------
const css = document.createElement('style');
css.textContent = `
.gtools{position:absolute;right:10px;top:96px;z-index:1000;display:flex;flex-direction:column;gap:8px}
.gtools button{width:42px;height:42px;font-size:20px;padding:0;background:#1e293bdd;border:1px solid #475569;color:#fff;border-radius:8px}
.gtools button.on{background:#0ea5e9}
.bmi .bmt{position:absolute;left:-10px;top:-12px;font-size:22px;color:#fb923c;text-shadow:0 0 3px #000,0 0 3px #000}
.bmi .bmt.tg{color:#22c55e;font-size:28px;left:-13px;top:-16px}
.bmi .bml{position:absolute;left:10px;top:-14px;font-size:12px;font-weight:700;color:#fde68a;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap}
#bmform,#bmlist,#navbox{position:absolute;left:10px;right:10px;z-index:1100;background:#0f172af7;border-radius:10px;padding:10px;font-size:13px;direction:rtl}
#bmform{bottom:10px;border:1px solid #fb923c}#bmlist{bottom:10px;border:1px solid #38bdf8;max-height:55%;overflow:auto}
#navbox{top:70px;border:1px solid #22c55e;line-height:1.7}
#bmform.hidden,#bmlist.hidden,#navbox.hidden{display:none}
#bmform input,#bmform textarea{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:8px;font-size:14px;direction:ltr;margin:2px 0}
.bmr{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #334155}
.bmr button{padding:6px 10px}`;
document.head.appendChild(css);

const gv = $('geoView');
const tl = document.createElement('div');
tl.className = 'gtools';
tl.innerHTML = '<button id="bmGps" title="موقعي (GPS)">📍</button><button id="bmAdd" title="إضافة ثابتة">➕</button><button id="bmLs" title="الثوابت">📌</button><button id="bmFit" title="تركيز">🎯</button>';
gv.appendChild(tl);
const form = document.createElement('div');
form.id = 'bmform'; form.className = 'hidden';
form.innerHTML = `<b id="bmT">➕ إضافة ثابتة</b>
<input id="bmName" placeholder="اسم الثابتة" />
<input id="bmDesc" placeholder="الوصف (مكانها / علامتها)" />
<div class="fg"><input id="bmN" inputmode="decimal" placeholder="N" /><input id="bmE" inputmode="decimal" placeholder="E" /><input id="bmZ" inputmode="decimal" placeholder="Z (اختياري)" /></div>
<div class="rowb"><button class="g" id="bmSave">حفظ</button><button id="bmHere">📍 موقعي</button><button id="bmPick">🗺 من الخريطة</button><button class="s" id="bmDel">🗑 حذف</button><button class="s" id="bmX">إغلاق</button></div>`;
gv.appendChild(form);
const list = document.createElement('div');
list.id = 'bmlist'; list.className = 'hidden';
gv.appendChild(list);
const nb = document.createElement('div');
nb.id = 'navbox'; nb.className = 'hidden';
gv.appendChild(nb);

// ---------- الخريطة ----------
function ensureMap() {
  if (gm) return true;
  if (!window.__gmap) return false;
  gm = window.__gmap;
  bmLayer = L.layerGroup().addTo(gm);
  meLayer = L.layerGroup().addTo(gm);
  return true;
}
function popupEl(b, ll) {
  const d = document.createElement('div');
  d.style.cssText = 'direction:rtl;font-size:13px;line-height:1.6;min-width:170px';
  d.innerHTML = `<b>${esc(b.name)}</b>${b.desc ? `<div>${esc(b.desc)}</div>` : ''}${b.by ? `<div style="font-size:11px;color:#94a3b8">بواسطة: ${esc(b.by)}</div>` : ''}<div style="direction:ltr">N: ${f3(b.n)}<br>E: ${f3(b.e)}${b.z !== null && b.z !== undefined ? `<br>Z: ${f3(b.z)}` : ''}<br>${ll[0].toFixed(6)}, ${ll[1].toFixed(6)}</div>
  <div class="rowb" style="margin-top:6px"><button data-k="go">🧭 توجّه</button><button data-k="ed">✏</button><button data-k="cp">نسخ</button></div>`;
  d.addEventListener('click', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.k; if (!k) return;
    if (k === 'go') { gm.closePopup(); setTarget(b.id); }
    if (k === 'ed') { gm.closePopup(); openForm(b.id); }
    if (k === 'cp') { try { navigator.clipboard.writeText([b.name, b.n, b.e, b.z ?? ''].join(',')); toast('تم النسخ'); } catch (e) { /* ignore */ } }
  });
  return d;
}
function renderBms() {
  if (!ensureMap()) return;
  bmLayer.clearLayers();
  bms.forEach((b) => {
    let ll; try { ll = toLL(b.n, b.e); } catch (e) { return; }
    if (!isFinite(ll[0]) || !isFinite(ll[1])) return;
    const icon = L.divIcon({ className: 'bmi', html: `<span class="bmt${b.id === target ? ' tg' : ''}">▲</span><span class="bml">${esc(b.name)}</span>`, iconSize: [0, 0] });
    L.marker(ll, { icon }).addTo(bmLayer).bindPopup(popupEl(b, ll));
  });
  renderNav();
}
function renderNav() {
  if (!meLayer) return;
  meLayer.clearLayers();
  if (!me) { nb.classList.add('hidden'); return; }
  L.circle([me.lat, me.lon], { radius: me.acc || 5, color: '#38bdf8', weight: 1, fillOpacity: 0.12 }).addTo(meLayer);
  L.circleMarker([me.lat, me.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(meLayer);
  const b = bms.find((x) => x.id === target);
  let html = `<b>📍 موقعك</b> (±${Math.round(me.acc || 0)} م)`;
  if (b) {
    try {
      const ll = toLL(b.n, b.e), r = navTo(b);
      L.polyline([[me.lat, me.lon], ll], { color: '#fbbf24', weight: 3, dashArray: '8 8' }).addTo(meLayer);
      if (r.dist <= 2) { html = `<b>✅ وصلت إلى ${esc(b.name)}</b> (±${Math.round(me.acc || 0)} م)`; if (!arrived) { arrived = true; try { navigator.vibrate && navigator.vibrate(400); } catch (e) { /* ignore */ } } }
      else {
        if (r.dist > 5) arrived = false;
        html = `<b>🧭 إلى ${esc(b.name)}</b>${b.desc ? ' — ' + esc(b.desc) : ''}<br>المسافة: <b>${fmtDist(r.dist)}</b><br>الاتجاه: <b>${dms(r.az)}</b> (${DIRS[Math.round(r.az / 45) % 8]})<br>ΔN: ${r.dn.toFixed(2)} | ΔE: ${r.de.toFixed(2)}<br>دقة الـ GPS: ±${Math.round(me.acc || 0)} م <button id="navStop" style="float:left;padding:4px 10px">إلغاء التوجيه</button>`;
      }
    } catch (e) { /* ignore */ }
  } else html += '<br>اختار ثابتة من 📌 أو من الخريطة وفعّل 🧭';
  nb.innerHTML = html;
  nb.classList.remove('hidden');
}
function fitMe() {
  if (!gm) return;
  const b = bms.find((x) => x.id === target);
  const pts = [];
  if (me) pts.push([me.lat, me.lon]);
  if (b) { try { pts.push(toLL(b.n, b.e)); } catch (e) { /* ignore */ } }
  if (pts.length > 1) gm.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 19 });
  else if (pts.length) gm.setView(pts[0], Math.max(gm.getZoom(), 18));
}

// ---------- GPS ----------
function startGps() {
  if (watchId !== null) return;
  if (!navigator.geolocation) { toast('الموقع غير مدعوم هنا'); return; }
  firstFix = true;
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      me = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      renderNav();
      if (firstFix) { firstFix = false; fitMe(); }
    },
    (err) => toast('تعذر تحديد الموقع: ' + (err.message || err.code)),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
  );
  $('bmGps').classList.add('on');
  toast('جاري تحديد موقعك…');
}
function stopGps() {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null; me = null;
  $('bmGps').classList.remove('on');
  renderNav();
}
function setTarget(id) {
  target = id; arrived = false;
  renderBms();
  if (watchId === null) startGps(); else fitMe();
}

// ---------- نموذج الإضافة / التعديل ----------
function openForm(id) {
  editing = id || null;
  const b = id ? bms.find((x) => x.id === id) : null;
  $('bmT').textContent = b ? '✏ تعديل ثابتة' : '➕ إضافة ثابتة';
  $('bmName').value = b ? b.name : '';
  $('bmDesc').value = b ? b.desc || '' : '';
  $('bmN').value = b ? b.n : ''; $('bmE').value = b ? b.e : ''; $('bmZ').value = b && b.z !== null && b.z !== undefined ? b.z : '';
  $('bmDel').style.display = b ? '' : 'none';
  list.classList.add('hidden');
  form.classList.remove('hidden');
}
$('bmAdd').onclick = () => { if (form.classList.contains('hidden')) openForm(null); else form.classList.add('hidden'); };
$('bmX').onclick = () => form.classList.add('hidden');
$('bmHere').onclick = () => {
  if (!me) { startGps(); toast('استنى لحد ما يتحدد موقعك ثم اضغط تاني'); return; }
  try { const [n, e] = toNE(me.lat, me.lon); $('bmN').value = n.toFixed(3); $('bmE').value = e.toFixed(3); } catch (err) { toast('تعذر التحويل'); }
};
$('bmPick').onclick = () => {
  if (!ensureMap()) return;
  toast('اضغط على مكان الثابتة في الخريطة');
  gm.once('click', (ev) => { try { const [n, e] = toNE(ev.latlng.lat, ev.latlng.lng); $('bmN').value = n.toFixed(3); $('bmE').value = e.toFixed(3); } catch (err) { toast('تعذر التحويل'); } });
};
$('bmSave').onclick = () => {
  const name = $('bmName').value.trim(), n = num($('bmN').value), e = num($('bmE').value), z = num($('bmZ').value);
  if (!name || isNaN(n) || isNaN(e)) { toast('اكتب الاسم و N و E'); return; }
  const rec = { name, desc: $('bmDesc').value.trim(), n, e, z: isNaN(z) ? null : z };
  let b;
  if (editing) { b = bms.find((x) => x.id === editing); Object.assign(b, rec); }
  else { b = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...rec }; bms.push(b); }
  save(); form.classList.add('hidden');
  if (ensureMap()) { renderBms(); try { gm.setView(toLL(b.n, b.e), Math.max(gm.getZoom(), 18)); } catch (err) { /* ignore */ } }
  toast('تم حفظ ' + b.name);
};
$('bmDel').onclick = () => {
  if (!editing) return;
  bms = bms.filter((x) => x.id !== editing);
  if (target === editing) target = null;
  save(); form.classList.add('hidden'); renderBms(); toast('تم الحذف');
};

// ---------- قايمة الثوابت (بحث + توجيه + تعديل + حذف) ----------
const css3 = document.createElement('style');
css3.textContent = '#bmQ{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;margin:6px 0}.bmr .bmn{flex:1;cursor:pointer}';
document.head.appendChild(css3);
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
let q = '', delArm = null, delTimer = 0, backToList = false;
list.innerHTML = '<b id="bmLc"></b><input id="bmQ" placeholder="🔍 ابحث بالاسم أو الوصف" /><div id="bmRows"></div><div class="rowb" style="margin-top:8px"><button class="s" id="bmLX">إغلاق</button></div>';
const safeDist = (b) => { try { return navTo(b).dist; } catch (e) { return null; } };
function renderRows() {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const rows = bms.map((b) => ({ b, d: me ? safeDist(b) : null }))
    .filter(({ b }) => { const hay = norm(b.name + ' ' + (b.desc || '')); return terms.every((t) => hay.includes(t)); })
    .sort((x, y) => (x.d !== null && y.d !== null ? x.d - y.d : x.d !== null ? -1 : y.d !== null ? 1 : String(x.b.name).localeCompare(String(y.b.name), 'ar', { numeric: true })));
  $('bmLc').textContent = '📌 الثوابت (' + rows.length + (terms.length ? ' من ' + bms.length : '') + ')';
  $('bmRows').innerHTML = rows.length ? rows.map(({ b, d }) =>
    `<div class="bmr"><div class="bmn" data-g="${b.id}"><b>${esc(b.name)}</b>${b.desc ? '<br>' + esc(b.desc) : ''}${d !== null ? '<br>' + fmtDist(d) : ''}</div><button data-g="${b.id}">🧭</button><button data-v="${b.id}">👁</button><button data-e="${b.id}">✏</button><button data-d="${b.id}">${delArm === b.id ? 'تأكيد؟' : '🗑'}</button></div>`).join('')
    : '<div style="padding:8px 0">' + (bms.length ? 'مفيش نتيجة للبحث' : 'مفيش ثوابت، اضغط ➕ لإضافة.') + '</div>';
}
function openList() { form.classList.add('hidden'); renderRows(); list.classList.remove('hidden'); }
$('bmQ').addEventListener('input', (e) => { q = e.target.value; renderRows(); });
list.addEventListener('click', (ev) => {
  if (ev.target.id === 'bmLX') { list.classList.add('hidden'); return; }
  const el = ev.target.closest('[data-g],[data-v],[data-e],[data-d]'); if (!el) return;
  const d = el.dataset;
  if (d.g) { list.classList.add('hidden'); setTarget(d.g); }
  else if (d.e) { backToList = true; openForm(d.e); }
  else if (d.v) { const b = bms.find((x) => x.id === d.v); if (b && ensureMap()) { list.classList.add('hidden'); gm.setView(toLL(b.n, b.e), Math.max(gm.getZoom(), 19)); } }
  else if (d.d) {
    clearTimeout(delTimer);
    if (delArm === d.d) {
      delArm = null; bms = bms.filter((x) => x.id !== d.d);
      if (target === d.d) target = null;
      save(); renderBms(); renderRows(); toast('تم الحذف');
    } else { delArm = d.d; delTimer = setTimeout(() => { delArm = null; renderRows(); }, 3000); renderRows(); }
  }
});
// الرجوع للقايمة بعد التعديل أو الإلغاء
const back = () => { if (backToList && form.classList.contains('hidden')) { backToList = false; openList(); } };
const oAdd = $('bmAdd').onclick, oX = $('bmX').onclick, oSave = $('bmSave').onclick, oDel = $('bmDel').onclick;
$('bmAdd').onclick = () => { backToList = false; oAdd(); };
$('bmX').onclick = () => { oX(); back(); };
$('bmSave').onclick = () => { oSave(); back(); };
$('bmDel').onclick = () => { oDel(); back(); };
$('bmLs').onclick = () => { if (list.classList.contains('hidden')) openList(); else list.classList.add('hidden'); };
nb.addEventListener('click', (ev) => { if (ev.target.id === 'navStop') { target = null; renderBms(); } });
$('bmGps').onclick = () => { if (watchId === null) startGps(); else stopGps(); };
$('bmFit').onclick = fitMe;
window.addEventListener('geo-draw', () => { if (ensureMap()) renderBms(); });
import('./sync.js');
import('./kmz.js');
