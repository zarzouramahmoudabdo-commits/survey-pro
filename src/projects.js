const IKEY = 'sp_pjs_v1', PFX = 'sp_pj_';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 1800); };
const get = () => (window.__pts ? window.__pts() : []);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const baseName = (n) => String(n || '').replace(/\.[A-Za-z0-9]+$/, '').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

let index = [];
try { index = JSON.parse(localStorage.getItem(IKEY) || '[]'); if (!Array.isArray(index)) index = []; } catch (e) { index = []; }
let activeId = null, lastMeta = null, q = '', renId = null, delArm = null, delTimer = 0, isOpen = false;
const saveIndex = () => { try { localStorage.setItem(IKEY, JSON.stringify(index)); } catch (e) { toast('مساحة التخزين ممتلئة'); } };
const readP = (id) => { try { return JSON.parse(localStorage.getItem(PFX + id) || 'null'); } catch (e) { return null; } };
const writeP = (id, d) => { try { localStorage.setItem(PFX + id, JSON.stringify(d)); return true; } catch (e) { toast('تعذر الحفظ: مساحة التخزين ممتلئة'); return false; } };

// نقل البيانات القديمة (كانت بتتفتح لوحدها) لمشروع في القايمة
try {
  const lp = JSON.parse(localStorage.getItem('sp_points_v1') || '[]');
  if (Array.isArray(lp) && lp.length && !index.length) {
    let lm = null; try { lm = JSON.parse(localStorage.getItem('sp_meta_v1') || 'null'); } catch (e) { lm = null; }
    const id = uid();
    if (writeP(id, { points: lp, meta: lm })) { index.unshift({ id, name: lm && lm.name ? baseName(lm.name) : 'مشروع محفوظ سابقاً', at: Date.now(), count: lp.length }); saveIndex(); }
  }
  localStorage.removeItem('sp_points_v1'); localStorage.removeItem('sp_meta_v1');
} catch (e) { /* ignore */ }

// ---------- الواجهة ----------
const css = document.createElement('style');
css.textContent = `
#pjBtn{background:#334155;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pjback{position:fixed;inset:0;background:#000a;z-index:3000}
#pjdrawer{position:fixed;top:0;bottom:0;right:0;width:min(86vw,360px);background:#0f172a;border-left:1px solid #334155;z-index:3001;padding:12px;display:flex;flex-direction:column;direction:rtl;transition:transform .2s}
#pjdrawer.closed{transform:translateX(105%)}#pjback.hidden{display:none}
#pjdrawer .pjh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
#pjQ,#pjdrawer .pjin{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;margin-bottom:8px}
#pjRows{flex:1;overflow:auto}
.pjr{display:flex;align-items:center;gap:6px;padding:8px 6px;border-bottom:1px solid #334155;border-radius:6px}
.pjr.act{background:#0ea5e933;border:1px solid #0ea5e9}
.pjr .pjn{flex:1;cursor:pointer;min-width:0}.pjr .pjn b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pjr small{color:#94a3b8}.pjr button{padding:6px 10px}
#pjdrawer .pjf{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}`;
document.head.appendChild(css);
const hdr = document.querySelector('header');
const btn = document.createElement('button');
btn.id = 'pjBtn';
hdr.insertBefore(btn, hdr.firstChild);
const back = document.createElement('div');
back.id = 'pjback'; back.className = 'hidden';
const dr = document.createElement('div');
dr.id = 'pjdrawer'; dr.className = 'closed';
dr.innerHTML = '<div class="pjh"><b id="pjT">📁 المشاريع</b><button id="pjClose">✕</button></div><input id="pjQ" placeholder="🔍 ابحث عن مشروع" /><div id="pjRows"></div><div class="pjf"><button id="pjImp">📂 استيراد ملف</button><button id="pjOff" class="s">⏏ إغلاق المشروع الحالي</button></div>';
document.body.appendChild(back); document.body.appendChild(dr);

function renderBtn() {
  const e = index.find((x) => x.id === activeId);
  btn.textContent = '☰ ' + (e ? e.name : 'المشاريع');
}
function renderList() {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const rows = index.filter((e) => { const h = norm(e.name); return terms.every((t) => h.includes(t)); }).sort((a, b) => (b.at || 0) - (a.at || 0));
  $('pjT').textContent = '📁 المشاريع (' + index.length + ')';
  $('pjRows').innerHTML = rows.length ? rows.map((e) => {
    const d = e.at ? new Date(e.at).toLocaleDateString('ar-EG') : '';
    const name = renId === e.id
      ? `<div class="pjn"><input class="pjin" id="pjRn" value="${esc(e.name)}" style="margin:0" /></div><button data-s="${e.id}">✓</button>`
      : `<div class="pjn" data-o="${e.id}"><b>${e.id === activeId ? '✅ ' : ''}${esc(e.name)}</b><small>${e.count || 0} نقطة${d ? ' · ' + d : ''}</small></div><button data-r="${e.id}">✏</button><button data-d="${e.id}">${delArm === e.id ? 'تأكيد؟' : '🗑'}</button>`;
    return `<div class="pjr${e.id === activeId ? ' act' : ''}">${name}</div>`;
  }).join('') : '<div style="padding:10px;color:#94a3b8">' + (index.length ? 'مفيش نتيجة' : 'مفيش مشاريع لسه. اضغط 📂 استيراد ملف، وكل ملف بتفتحه هيتحفظ هنا.') + '</div>';
}
function toggle(open) {
  isOpen = open;
  dr.classList.toggle('closed', !open); back.classList.toggle('hidden', !open);
  if (open) renderList();
}
function fitView() {
  const g = $('geoView');
  if (g && !g.classList.contains('hidden')) { const c = $('crs'); if (c && c.onchange) c.onchange(); }
  else if ($('mapView') && !$('mapView').classList.contains('hidden')) { const f = $('bFit'); if (f) f.click(); }
}
function commit(e, pts, meta) {
  e.at = Date.now(); e.count = pts.length;
  if (writeP(e.id, { points: pts, meta })) saveIndex();
  renderBtn(); if (isOpen) renderList();
}
function openProject(id) {
  const e = index.find((x) => x.id === id), d = readP(id);
  if (!e || !d) { toast('تعذر فتح المشروع'); return; }
  activeId = id; lastMeta = d.meta || null;
  globalThis.__srcMeta = d.meta || null; window.__srcName = (d.meta && d.meta.name) || e.name;
  window.__setPts(d.points || []);
  renderBtn(); toggle(false); fitView();
  toast('اتفتح: ' + e.name);
}
function closeProject() {
  activeId = null; lastMeta = null; globalThis.__srcMeta = null; window.__srcName = '';
  window.__setPts([]);
  renderBtn(); if (isOpen) renderList(); toast('اتقفل المشروع (لسه محفوظ في القايمة)');
}

// بيتنادى بعد أي تغيير في النقط: استيراد ملف جديد أو تعديل
window.__changed = () => {
  const pts = get(), meta = globalThis.__srcMeta || null;
  if (meta && meta !== lastMeta) {
    lastMeta = meta;
    const nm = baseName(window.__srcName) || 'ملف بدون اسم';
    meta.name = window.__srcName || meta.name || '';
    let nm2 = nm, k = 2;
    while (index.some((x) => x.name.toLowerCase() === nm2.toLowerCase())) nm2 = nm + ' (' + k++ + ')';
    const e = { id: uid(), name: nm2, at: 0, count: 0 };
    index.unshift(e);
    activeId = e.id; commit(e, pts, meta);
    return;
  }
  if (!pts.length && !activeId) return;
  if (!activeId) { const e0 = { id: uid(), name: 'مشروع جديد ' + new Date().toLocaleDateString('ar-EG'), at: 0, count: 0 }; index.unshift(e0); activeId = e0.id; }
  const e = index.find((x) => x.id === activeId);
  if (e) commit(e, pts, meta);
};

btn.onclick = () => toggle(true);
back.onclick = () => toggle(false);
$('pjClose').onclick = () => toggle(false);
$('pjQ').addEventListener('input', (ev) => { q = ev.target.value; renderList(); });
$('pjImp').onclick = () => { toggle(false); const f = $('file'); if (f) f.click(); };
$('pjOff').onclick = () => { closeProject(); toggle(false); };
$('pjRows').addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-o],[data-r],[data-d],[data-s]'); if (!el) return;
  const d = el.dataset;
  if (d.o) openProject(d.o);
  else if (d.r) { renId = d.r; renderList(); const i = $('pjRn'); if (i) i.focus(); }
  else if (d.s) {
    const e = index.find((x) => x.id === d.s), v = ($('pjRn') ? $('pjRn').value : '').trim();
    if (e && v) { e.name = v; saveIndex(); }
    renId = null; renderBtn(); renderList();
  } else if (d.d) {
    clearTimeout(delTimer);
    if (delArm === d.d) {
      delArm = null;
      if (activeId === d.d) closeProject();
      index = index.filter((x) => x.id !== d.d);
      try { localStorage.removeItem(PFX + d.d); } catch (e) { /* ignore */ }
      saveIndex(); renderBtn(); renderList(); toast('تم حذف المشروع');
    } else { delArm = d.d; delTimer = setTimeout(() => { delArm = null; renderList(); }, 3000); renderList(); }
  }
});
renderBtn();
