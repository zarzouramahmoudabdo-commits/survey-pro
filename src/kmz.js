import L from 'leaflet';
import proj4 from 'proj4';
import { readKmz } from './kml.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2200); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

// ---------- التخزين (IndexedDB) ----------
const DB = 'sp_kmz', ST = 'layers';
const idb = () => new Promise((res, rej) => {
  try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
});
const tx = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
};
const dbAll = () => tx('readonly', (s) => s.getAll());
const dbPut = (rec) => tx('readwrite', (s) => s.put(rec));
const dbDel = (id) => tx('readwrite', (s) => s.delete(id));

let recs = [], gm = null, drawn = false, q = '', delArm = null, bmArm = null, armTimer = 0;
const groups = new Map();
const rend = L.canvas({ padding: 0.5 });

// ---------- الواجهة ----------
const css = document.createElement('style');
css.textContent = `
#kzpanel{position:absolute;left:10px;right:10px;bottom:10px;z-index:1100;background:#0f172af7;border:1px solid #f472b6;border-radius:10px;padding:10px;font-size:13px;direction:rtl;max-height:62%;overflow:auto}
#kzpanel.hidden{display:none}
#kzQ{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;margin:6px 0}
.kzr{display:flex;align-items:center;gap:5px;padding:6px 0;border-bottom:1px solid #334155}
.kzr .kzn{flex:1;min-width:0;cursor:pointer}.kzr button{padding:6px 9px}
.kzl{color:#fde68a;font-size:11px;font-weight:700;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;transform:translate(-50%,-50%)}`;
document.head.appendChild(css);
const tools = document.querySelector('#geoView .gtools');
const kbtn = document.createElement('button');
kbtn.id = 'kzBtn'; kbtn.title = 'طبقات KMZ'; kbtn.textContent = '🗂';
tools.appendChild(kbtn);
const panel = document.createElement('div');
panel.id = 'kzpanel'; panel.className = 'hidden';
panel.innerHTML = '<b>🗂 طبقات KMZ / KML</b><div class="rowb" style="margin:6px 0"><button class="g" id="kzImp">📥 استيراد KMZ / KML</button><button class="s" id="kzX">إغلاق</button></div><input id="kzQ" placeholder="🔍 ابحث في الفيلات/العناصر بالاسم" /><div id="kzRows"></div>';
$('geoView').appendChild(panel);
const finp = document.createElement('input');
finp.type = 'file'; finp.style.display = 'none';
document.body.appendChild(finp);

// ---------- أدوات ----------
function centerOf(f) {
  const g = f.g[0];
  if (g.t === 'pt') return g.p;
  const pts = g.t === 'pg' ? g.p[0] : g.p;
  if (g.t === 'ln') return pts[Math.floor(pts.length / 2)];
  let la = 0, lo = 0, n = pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.length - 1 : pts.length;
  for (let i = 0; i < n; i++) { la += pts[i][0]; lo += pts[i][1]; }
  return [la / n, lo / n];
}
function ensureBm(f, c) {
  const def = window.__geoDef ? window.__geoDef() : '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs';
  const [e, n] = proj4('EPSG:4326', def, [c[1], c[0]]);
  const ex = (window.__bmGet ? window.__bmGet() : []).find((b) => b.name === f.n && Math.hypot(b.n - n, b.e - e) < 3);
  if (ex) return { id: ex.id, isNew: false };
  return { id: window.__bmAddLL(f.n || 'نقطة', f.d || '', c[0], c[1]), isNew: true };
}
function popupEl(f) {
  const c = centerOf(f);
  const d = document.createElement('div');
  d.style.cssText = 'direction:rtl;font-size:13px;line-height:1.6;min-width:170px;max-width:240px';
  d.innerHTML = `<b>${esc(f.n || 'بدون اسم')}</b>${f.f ? `<div style="font-size:11px;color:#94a3b8">${esc(f.f)}</div>` : ''}${f.d ? `<div>${esc(f.d)}</div>` : ''}<div style="direction:ltr;font-size:12px">${c[0].toFixed(6)}, ${c[1].toFixed(6)}</div><div class="rowb" style="margin-top:6px"><button data-k="go">🧭 توجّه</button><button data-k="bm">➕ ثابتة</button><button data-k="cp">نسخ</button></div>`;
  d.addEventListener('click', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.k; if (!k) return;
    if (!window.__bmAddLL) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
    if (k === 'go') { gm.closePopup(); window.__bmGo(ensureBm(f, c).id); }
    if (k === 'bm') { const r = ensureBm(f, c); toast(r.isNew ? 'اتضافت للثوابت: ' + f.n : 'موجودة في الثوابت بالفعل'); }
    if (k === 'cp') { try { navigator.clipboard.writeText([f.n, c[0].toFixed(6), c[1].toFixed(6)].join(',')); toast('تم النسخ'); } catch (e) { /* ignore */ } }
  });
  return d;
}

// ---------- الرسم على الخريطة ----------
function drawLayer(rec) {
  const old = groups.get(rec.id);
  if (old) { gm.removeLayer(old.group); gm.removeLayer(old.labels); }
  const group = L.layerGroup(), labels = L.layerGroup(), refs = new Map();
  rec.features.forEach((f, i) => {
    const st = f.s || {}, ls = [];
    for (const g of f.g) {
      let lyr;
      if (g.t === 'pg') lyr = L.polygon(g.p, { color: st.c || '#fbbf24', weight: st.w || 2, fillColor: st.fc || st.c || '#fbbf24', fillOpacity: st.fa === undefined ? 0.25 : st.fa, renderer: rend });
      else if (g.t === 'ln') lyr = L.polyline(g.p, { color: st.c || '#38bdf8', weight: st.w || 2, renderer: rend });
      else lyr = L.circleMarker(g.p, { radius: 6, color: '#fff', weight: 2, fillColor: '#fb923c', fillOpacity: 1, renderer: rend });
      lyr.bindPopup(() => popupEl(f));
      group.addLayer(lyr); ls.push(lyr);
    }
    const c = centerOf(f);
    refs.set(i, { ls, c });
    if (f.n && rec.features.length <= 2000) L.marker(c, { icon: L.divIcon({ className: 'kzl', html: esc(f.n), iconSize: [0, 0] }), interactive: false }).addTo(labels);
  });
  groups.set(rec.id, { group, labels, refs });
  applyVis();
}
function applyVis() {
  if (!gm) return;
  const z = gm.getZoom();
  for (const r of recs) {
    const g = groups.get(r.id); if (!g) continue;
    if (r.visible) g.group.addTo(gm); else gm.removeLayer(g.group);
    if (r.visible && z >= 17) g.labels.addTo(gm); else gm.removeLayer(g.labels);
  }
}
function ensureMap() {
  if (gm) return true;
  if (!window.__gmap) return false;
  gm = window.__gmap;
  gm.on('zoomend', applyVis);
  return true;
}
function drawAll() { if (!ensureMap()) return; recs.forEach(drawLayer); drawn = true; }
function fitRec(rec) {
  const pts = [];
  rec.features.forEach((f) => f.g.forEach((g) => { (g.t === 'pg' ? g.p[0] : g.t === 'ln' ? g.p : [g.p]).forEach((p) => pts.push(p)); }));
  if (pts.length && ensureMap()) gm.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 19 });
}

// ---------- القايمة والبحث ----------
function renderPanel() {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  let html = '';
  if (terms.length) {
    const res = [];
    for (const r of recs) r.features.forEach((f, i) => { const h = norm(f.n + ' ' + f.f + ' ' + f.d); if (terms.every((t) => h.includes(t))) res.push({ r, f, i }); });
    html += `<b>نتائج البحث (${res.length})</b>` + res.slice(0, 40).map(({ r, f, i }) =>
      `<div class="kzr"><div class="kzn" data-fly="${r.id}:${i}"><b>${esc(f.n || 'بدون اسم')}</b><br><small style="color:#94a3b8">${esc(f.f || r.name)}</small></div><button data-go="${r.id}:${i}">🧭</button></div>`).join('') + (res.length > 40 ? '<div>… ضيّق البحث</div>' : '');
  }
  html += `<div style="margin-top:6px"><b>الطبقات (${recs.length})</b></div>` + (recs.length ? recs.map((r) => {
    const np = r.features.filter((f) => f.g[0].t === 'pt').length;
    return `<div class="kzr"><div class="kzn" data-fit="${r.id}"><b>${esc(r.name)}</b><br><small style="color:#94a3b8">${r.count} عنصر</small></div><button data-vis="${r.id}">${r.visible ? '👁' : '🙈'}</button>${np ? `<button data-bm="${r.id}">${bmArm === r.id ? 'تأكيد؟' : '📌' + np}</button>` : ''}<button data-del="${r.id}">${delArm === r.id ? 'تأكيد؟' : '🗑'}</button></div>`;
  }).join('') : '<div style="color:#94a3b8;padding:6px 0">مفيش طبقات. اضغط 📥 واختار ملف KMZ أو KML.</div>');
  $('kzRows').innerHTML = html;
}
const arm = (which, id) => { clearTimeout(armTimer); delArm = which === 'del' ? id : null; bmArm = which === 'bm' ? id : null; armTimer = setTimeout(() => { delArm = null; bmArm = null; renderPanel(); }, 3000); renderPanel(); };
function locate(key) {
  const [id, i] = key.split(':');
  const r = recs.find((x) => x.id === id), g = groups.get(id);
  return r && g ? { r, f: r.features[+i], ref: g.refs.get(+i) } : null;
}
function fly(key) {
  const t = locate(key); if (!t || !ensureMap()) return;
  if (!t.r.visible) { t.r.visible = true; dbPut(t.r).catch(() => {}); applyVis(); }
  panel.classList.add('hidden');
  gm.setView(t.ref.c, Math.max(gm.getZoom(), 19));
  try { t.ref.ls[0].openPopup(); } catch (e) { /* ignore */ }
}
async function importFile(f) {
  try {
    const features = readKmz(await f.arrayBuffer());
    if (!features.length) { toast('مفيش عناصر قابلة للعرض في الملف'); return; }
    const base = f.name.replace(/\.[A-Za-z0-9]+$/, '');
    let nm = base, k = 2;
    while (recs.some((r) => r.name === nm)) nm = base + ' (' + k++ + ')';
    const rec = { id: uid(), name: nm, at: Date.now(), visible: true, count: features.length, features };
    recs.unshift(rec);
    let saved = true;
    try { await dbPut(rec); } catch (e) { saved = false; }
    if (ensureMap()) { drawLayer(rec); fitRec(rec); }
    renderPanel();
    const c = (t) => features.filter((x) => x.g.some((g) => g.t === t)).length;
    toast(`تم استيراد ${features.length} عنصر (${c('pg')} مضلع، ${c('pt')} نقطة، ${c('ln')} خط)` + (saved ? '' : ' — مش هيتحفظ بعد قفل التطبيق'));
  } catch (e) { toast('تعذر قراءة الملف: ' + (e.message || e)); }
}

kbtn.onclick = () => { panel.classList.toggle('hidden'); renderPanel(); };
$('kzX').onclick = () => panel.classList.add('hidden');
$('kzImp').onclick = () => finp.click();
finp.onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (f) await importFile(f); e.target.value = ''; };
$('kzQ').addEventListener('input', (e) => { q = e.target.value; renderPanel(); });
panel.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-fly],[data-go],[data-fit],[data-vis],[data-bm],[data-del]'); if (!el) return;
  const d = el.dataset;
  if (d.fly) fly(d.fly);
  else if (d.go) {
    const t = locate(d.go); if (!t) return;
    if (!window.__bmAddLL) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
    panel.classList.add('hidden'); window.__bmGo(ensureBm(t.f, t.ref.c).id);
  } else if (d.fit) { const r = recs.find((x) => x.id === d.fit); if (r) { panel.classList.add('hidden'); fitRec(r); } }
  else if (d.vis) { const r = recs.find((x) => x.id === d.vis); if (r) { r.visible = !r.visible; dbPut(r).catch(() => {}); applyVis(); renderPanel(); } }
  else if (d.bm) {
    if (bmArm !== d.bm) { arm('bm', d.bm); return; }
    clearTimeout(armTimer); bmArm = null;
    const r = recs.find((x) => x.id === d.bm); if (!r || !window.__bmAddLL) return;
    let added = 0, all = 0;
    for (const f of r.features) { if (f.g[0].t !== 'pt') continue; all++; if (ensureBm(f, f.g[0].p).isNew) added++; }
    renderPanel(); toast(`اتضاف ${added} ثابتة من ${all} (الباقي موجود بالفعل)`);
  } else if (d.del) {
    if (delArm !== d.del) { arm('del', d.del); return; }
    clearTimeout(armTimer); delArm = null;
    const g = groups.get(d.del); if (g && gm) { gm.removeLayer(g.group); gm.removeLayer(g.labels); }
    groups.delete(d.del); recs = recs.filter((x) => x.id !== d.del); dbDel(d.del).catch(() => {});
    renderPanel(); toast('تم حذف الطبقة');
  }
});
window.addEventListener('geo-draw', () => { if (!drawn && ensureMap()) drawAll(); });
dbAll().then((list) => { recs = (list || []).sort((a, b) => (b.at || 0) - (a.at || 0)); if (ensureMap()) drawAll(); renderPanel(); }).catch(() => { /* ignore */ });
