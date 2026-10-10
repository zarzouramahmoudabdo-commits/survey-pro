import L from 'leaflet';
import proj4 from 'proj4';
import { readKmz } from './kml.js';
import { listMeta, getFeat, putMeta, putAll, delRec } from './kmzdb.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2200); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
const tick = () => new Promise((r) => setTimeout(r, 30));
const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

let recs = [], gm = null, q = '', delArm = null, bmArm = null, armTimer = 0, openKinds = null;
const groups = new Map();
const rend = L.canvas({ padding: 0.3 });
const HEXTAG = /\s*\[[0-9A-Fa-f]+\](:\d+)?\s*$/;
const kindOf = (f) => {
  const last = String(f.f || '').split(' / ').pop();
  if (HEXTAG.test(last)) return last.replace(HEXTAG, '').trim() || 'عناصر';
  return f.f || (f.g[0].t === 'pt' ? 'نقاط' : f.g[0].t === 'pg' ? 'مضلعات' : 'خطوط');
};
const isLabel = (f) => f.g[0].t === 'pt' || !!(f.n && !HEXTAG.test(f.n));
const defaultHidden = (kinds) => kinds.filter((k) => /TIN|SURFACE|CONTOUR/i.test(k));
function centerOf(f) {
  const g = f.g[0];
  if (g.t === 'pt') return g.p;
  const pts = g.t === 'pg' ? g.p[0] : g.p;
  if (g.t === 'ln') return pts[Math.floor(pts.length / 2)];
  let la = 0, lo = 0, n = pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.length - 1 : pts.length;
  for (let i = 0; i < n; i++) { la += pts[i][0]; lo += pts[i][1]; }
  return [la / n, lo / n];
}
const metaOf = (r) => { const { features, items, idx, _p, ...m } = r; return m; };

// ---------- الواجهة ----------
const css = document.createElement('style');
css.textContent = `
#kzpanel{position:absolute;left:10px;right:10px;bottom:10px;z-index:1100;background:#0f172af7;border:1px solid #f472b6;border-radius:10px;padding:10px;font-size:13px;direction:rtl;max-height:62%;overflow:auto}
#kzpanel.hidden{display:none}
#kzQ{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;margin:6px 0}
.kzr{display:flex;align-items:center;gap:5px;padding:6px 0;border-bottom:1px solid #334155}
.kzr .kzn{flex:1;min-width:0;cursor:pointer}.kzr button{padding:6px 9px}
.kzt{color:#fff;font-size:13px;font-weight:800;text-shadow:0 0 3px #000,0 0 3px #000,0 0 5px #000;white-space:nowrap;transform:translate(-50%,-50%);cursor:pointer}`;
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
function ensureBm(f, c) {
  const def = window.__geoDef ? window.__geoDef() : '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs';
  const [e, n] = proj4('EPSG:4326', def, [c[1], c[0]]);
  const ex = (window.__bmGet ? window.__bmGet() : []).find((b) => b.name === f.n && Math.hypot(b.n - n, b.e - e) < 3);
  if (ex) return { id: ex.id, isNew: false };
  return { id: window.__bmAddLL(f.n || 'نقطة', f.d || '', c[0], c[1]), isNew: true };
}
function popupEl(f) {
  const c = centerOf(f);
  const last = String(f.f || '').split(' / ').pop();
  const sub = f.f && !HEXTAG.test(last) ? f.f : '';
  const d = document.createElement('div');
  d.style.cssText = 'direction:rtl;font-size:13px;line-height:1.6;min-width:170px;max-width:240px';
  d.innerHTML = `<b>${esc(f.n || 'بدون اسم')}</b>${sub ? `<div style="font-size:11px;color:#94a3b8">${esc(sub)}</div>` : ''}${f.d ? `<div>${esc(f.d)}</div>` : ''}<div style="direction:ltr;font-size:12px">${c[0].toFixed(6)}, ${c[1].toFixed(6)}</div><div class="rowb" style="margin-top:6px"><button data-k="go">🧭 توجّه</button><button data-k="bm">➕ ثابتة</button><button data-k="cp">نسخ</button></div>`;
  d.addEventListener('click', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.k; if (!k) return;
    if (!window.__bmAddLL) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
    if (k === 'go') { gm.closePopup(); window.__bmGo(ensureBm(f, c).id); }
    if (k === 'bm') { const r = ensureBm(f, c); toast(r.isNew ? 'اتضافت للثوابت: ' + f.n : 'موجودة في الثوابت بالفعل'); }
    if (k === 'cp') { try { navigator.clipboard.writeText([f.n, c[0].toFixed(6), c[1].toFixed(6)].join(',')); toast('تم النسخ'); } catch (e) { /* ignore */ } }
  });
  return d;
}

// ---------- تحميل البيانات عند الحاجة بس ----------
function prep(rec) {
  rec.items = []; rec.idx = [];
  const kc = {}; let np = 0;
  rec.features.forEach((f, i) => {
    const k = kindOf(f); f._k = k; kc[k] = (kc[k] || 0) + 1;
    if (f.g[0].t === 'pt') np++;
    if (isLabel(f)) { rec.items.push({ i, f, c: centerOf(f), k }); rec.idx.push(norm(f.n + ' ' + String(f.d || '').slice(0, 120))); }
  });
  if (!rec.kc) {
    rec.kc = Object.entries(kc); rec.np = np;
    if (!rec.hidden) rec.hidden = defaultHidden(Object.keys(kc));
    putMeta(metaOf(rec)).catch(() => {});
  }
}
function ensureData(rec) {
  if (rec.features) return Promise.resolve(rec);
  if (!rec._p) rec._p = getFeat(rec.id).then((f) => { rec.features = f || []; prep(rec); return rec; });
  return rec._p;
}

// ---------- الرسم على الخريطة (بنرسم اللي ظاهر بس) ----------
function makeLab(items) {
  const grp = L.layerGroup(), cur = new Map();
  return {
    grp, items,
    refresh() {
      if (!gm || !gm.hasLayer(grp)) return;
      const b = gm.getBounds().pad(0.3), want = [];
      for (const it of items) { if (b.contains(it.c)) { want.push(it); if (want.length >= 350) break; } }
      const ws = new Set(want);
      for (const [it, m] of cur) if (!ws.has(it)) { grp.removeLayer(m); cur.delete(it); }
      for (const it of want) {
        if (cur.has(it)) continue;
        const m = L.marker(it.c, { icon: L.divIcon({ className: 'kzt', html: esc(it.f.n || '•'), iconSize: [0, 0] }) });
        m.bindPopup(() => popupEl(it.f)); grp.addLayer(m); cur.set(it, m);
      }
    },
    clear() { grp.clearLayers(); cur.clear(); },
    marker(it) { return cur.get(it); },
  };
}
function drawLayer(rec) {
  const old = groups.get(rec.id);
  if (old) { gm.removeLayer(old.group); gm.removeLayer(old.lab.grp); old.lab.clear(); }
  const hid = new Set(rec.hidden || []);
  const group = L.layerGroup();
  for (const f of rec.features) {
    if (f.g[0].t === 'pt' || hid.has(f._k)) continue;
    const st = f.s || {}, inter = isLabel(f);
    const pgs = f.g.filter((g) => g.t === 'pg').map((g) => g.p), lns = f.g.filter((g) => g.t === 'ln').map((g) => g.p);
    if (pgs.length) {
      const l = L.polygon(pgs.length === 1 ? pgs[0] : pgs, { color: st.c || '#fbbf24', weight: st.w || 2, fillColor: st.fc || st.c || '#fbbf24', fillOpacity: st.fa === undefined ? 0.25 : st.fa, renderer: rend, interactive: inter });
      if (inter) l.bindPopup(() => popupEl(f));
      group.addLayer(l);
    }
    if (lns.length) {
      const l = L.polyline(lns.length === 1 ? lns[0] : lns, { color: st.c || '#38bdf8', weight: st.w || 2, renderer: rend, interactive: inter });
      if (inter) l.bindPopup(() => popupEl(f));
      group.addLayer(l);
    }
  }
  groups.set(rec.id, { group, lab: makeLab(rec.items.filter((it) => !hid.has(it.k))) });
  applyVis();
}
function applyVis() {
  if (!gm) return;
  const z = gm.getZoom();
  for (const r of recs) {
    const g = groups.get(r.id); if (!g) continue;
    if (r.visible) g.group.addTo(gm); else gm.removeLayer(g.group);
    if (r.visible && z >= 16) { g.lab.grp.addTo(gm); g.lab.refresh(); } else { gm.removeLayer(g.lab.grp); g.lab.clear(); }
  }
}
function ensureMap() {
  if (gm) return true;
  if (!window.__gmap) return false;
  gm = window.__gmap;
  gm.on('moveend', applyVis);
  return true;
}
function loadVisible() {
  if (!ensureMap()) return;
  for (const r of recs) {
    if (!r.visible || groups.has(r.id)) continue;
    toast('جاري تحميل ' + r.name + '…');
    ensureData(r).then(() => { if (r.visible && !groups.has(r.id)) { drawLayer(r); renderPanel(); } }).catch(() => toast('تعذر تحميل ' + r.name));
  }
}
function fitRec(rec) {
  const pts = [];
  rec.features.forEach((f) => f.g.forEach((g) => { (g.t === 'pg' ? g.p[0] : g.t === 'ln' ? g.p : [g.p]).forEach((p) => pts.push(p)); }));
  if (pts.length && ensureMap()) gm.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 19 });
}

// ---------- القايمة والبحث ----------
function hiddenKinds(r) { return new Set(r.hidden || []); }
function renderPanel() {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  let html = '';
  if (terms.length) {
    const res = [];
    for (const r of recs) {
      if (!r.items || !groups.has(r.id)) continue;
      const hid = hiddenKinds(r);
      for (let n = 0; n < r.items.length && res.length < 31; n++) {
        const it = r.items[n];
        if (hid.has(it.k)) continue;
        const h = r.idx[n];
        if (terms.every((t) => h.includes(t))) res.push({ r, it });
      }
    }
    html += `<b>نتائج البحث (${res.length > 30 ? '30+' : res.length})</b>` + res.slice(0, 30).map(({ r, it }) =>
      `<div class="kzr"><div class="kzn" data-fly="${r.id}:${it.i}"><b>${esc(it.f.n || 'بدون اسم')}</b><br><small style="color:#94a3b8">${esc(r.name)}</small></div><button data-go="${r.id}:${it.i}">🧭</button></div>`).join('');
  }
  html += `<div style="margin-top:6px"><b>الطبقات (${recs.length})</b></div>` + (recs.length ? recs.map((r) => {
    let row = `<div class="kzr"><div class="kzn" data-fit="${r.id}"><b>${esc(r.name)}</b><br><small style="color:#94a3b8">${r.count} عنصر${groups.has(r.id) ? '' : r.visible ? ' · بيتحمّل…' : ' · مخفية'}</small></div><button data-vis="${r.id}">${r.visible ? '👁' : '🙈'}</button><button data-kinds="${r.id}">⚙</button>${r.np ? `<button data-bm="${r.id}">${bmArm === r.id ? 'تأكيد؟' : '📌' + r.np}</button>` : ''}<button data-del="${r.id}">${delArm === r.id ? 'تأكيد؟' : '🗑'}</button></div>`;
    if (openKinds === r.id) {
      if (!r.kc) row += '<div style="padding:6px;color:#94a3b8">جاري التحميل…</div>';
      else {
        const hid = hiddenKinds(r);
        row += '<div style="padding:4px 6px;background:#1e293b;border-radius:8px;margin:4px 0"><small style="color:#94a3b8">اختار اللي يظهر على الخريطة:</small>' + r.kc.map(([k, n], ki) => `<div class="kzr"><button data-kd="${r.id}:${ki}">${hid.has(k) ? '☐' : '☑'}</button><span>${esc(k)} (${n})</span></div>`).join('') + '</div>';
      }
    }
    return row;
  }).join('') : '<div style="color:#94a3b8;padding:6px 0">مفيش طبقات. اضغط 📥 واختار ملف KMZ أو KML.</div>');
  $('kzRows').innerHTML = html;
}
const arm = (which, id) => { clearTimeout(armTimer); delArm = which === 'del' ? id : null; bmArm = which === 'bm' ? id : null; armTimer = setTimeout(() => { delArm = null; bmArm = null; renderPanel(); }, 3000); renderPanel(); };
function locate(key) {
  const [id, i] = key.split(':');
  const r = recs.find((x) => x.id === id), g = groups.get(id);
  const it = r && r.items ? r.items.find((x) => x.i === +i) : null;
  return g && it ? { r, g, it } : null;
}
function fly(key) {
  const t = locate(key); if (!t || !ensureMap()) return;
  panel.classList.add('hidden');
  gm.setView(t.it.c, Math.max(gm.getZoom(), 19), { animate: false });
  applyVis();
  const m = t.g.lab.marker(t.it);
  if (m) m.openPopup();
}
async function importFile(f) {
  try {
    toast('جاري قراءة الملف… (ممكن ياخد ثواني)');
    await tick();
    const features = readKmz(await f.arrayBuffer());
    if (!features.length) { toast('مفيش عناصر قابلة للعرض في الملف'); return; }
    const base = f.name.replace(/\.[A-Za-z0-9]+$/, '');
    let nm = base, k = 2;
    while (recs.some((r) => r.name === nm)) nm = base + ' (' + k++ + ')';
    const rec = { id: uid(), name: nm, at: Date.now(), visible: true, count: features.length, features };
    prep(rec);
    let saved = true;
    try { await putAll(metaOf(rec), features); } catch (e) { saved = false; }
    recs.unshift(rec);
    if (ensureMap()) { drawLayer(rec); fitRec(rec); }
    renderPanel();
    const c = (t) => features.filter((x) => x.g.some((g) => g.t === t)).length;
    toast(`تم استيراد ${features.length} عنصر (${c('pt')} نص/نقطة، ${c('pg')} مضلع، ${c('ln')} خط)` + (rec.hidden.length ? ' — اتخبّى: ' + rec.hidden.join('، ') : '') + (saved ? '' : ' — مش هيتحفظ بعد قفل التطبيق'));
  } catch (e) { toast('تعذر قراءة الملف: ' + (e.message || e)); }
}

kbtn.onclick = () => { panel.classList.toggle('hidden'); renderPanel(); };
$('kzX').onclick = () => panel.classList.add('hidden');
$('kzImp').onclick = () => finp.click();
finp.onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (f) await importFile(f); e.target.value = ''; };
$('kzQ').addEventListener('input', debounce((e) => { q = e.target.value; renderPanel(); }, 220));
panel.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-fly],[data-go],[data-fit],[data-vis],[data-kinds],[data-kd],[data-bm],[data-del]'); if (!el) return;
  const d = el.dataset;
  if (d.fly) fly(d.fly);
  else if (d.go) {
    const t = locate(d.go); if (!t) return;
    if (!window.__bmAddLL) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
    panel.classList.add('hidden'); window.__bmGo(ensureBm(t.it.f, t.it.c).id);
  } else if (d.fit) { const r = recs.find((x) => x.id === d.fit); if (r) ensureData(r).then(() => { panel.classList.add('hidden'); fitRec(r); }); }
  else if (d.vis) {
    const r = recs.find((x) => x.id === d.vis); if (!r) return;
    r.visible = !r.visible; putMeta(metaOf(r)).catch(() => {});
    if (r.visible && !groups.has(r.id)) loadVisible(); else applyVis();
    renderPanel();
  } else if (d.kinds) {
    openKinds = openKinds === d.kinds ? null : d.kinds;
    const r = recs.find((x) => x.id === openKinds);
    if (r && !r.kc) ensureData(r).then(renderPanel);
    renderPanel();
  } else if (d.kd) {
    const [id, ki] = d.kd.split(':'); const r = recs.find((x) => x.id === id), kk = r && r.kc && r.kc[+ki];
    if (!kk) return;
    const hid = hiddenKinds(r);
    if (hid.has(kk[0])) hid.delete(kk[0]); else hid.add(kk[0]);
    r.hidden = [...hid]; putMeta(metaOf(r)).catch(() => {});
    if (r.features && ensureMap()) drawLayer(r);
    renderPanel();
  } else if (d.bm) {
    if (bmArm !== d.bm) { arm('bm', d.bm); return; }
    clearTimeout(armTimer); bmArm = null;
    const r = recs.find((x) => x.id === d.bm); if (!r || !window.__bmAddLL) return;
    ensureData(r).then(() => {
      let added = 0, all = 0;
      for (const f of r.features) { if (f.g[0].t !== 'pt') continue; all++; if (ensureBm(f, f.g[0].p).isNew) added++; }
      renderPanel(); toast(`اتضاف ${added} ثابتة من ${all} (الباقي موجود بالفعل)`);
    });
  } else if (d.del) {
    if (delArm !== d.del) { arm('del', d.del); return; }
    clearTimeout(armTimer); delArm = null;
    const g = groups.get(d.del); if (g && gm) { gm.removeLayer(g.group); gm.removeLayer(g.lab.grp); g.lab.clear(); }
    groups.delete(d.del); recs = recs.filter((x) => x.id !== d.del); delRec(d.del).catch(() => {});
    renderPanel(); toast('تم حذف الطبقة');
  }
});
window.addEventListener('geo-draw', loadVisible);
listMeta().then((list) => { recs = (list || []).sort((a, b) => (b.at || 0) - (a.at || 0)); renderPanel(); loadVisible(); }).catch(() => { /* ignore */ });
