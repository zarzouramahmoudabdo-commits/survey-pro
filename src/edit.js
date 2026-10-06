import { toCSV, toSDR, toDXF } from './exportfmt.js';

const css = document.createElement('style');
css.textContent = `
#apanel,#xpanel{position:absolute;left:10px;right:10px;bottom:10px;z-index:1100;background:#0f172af7;border:1px solid #22c55e;border-radius:10px;padding:10px;font-size:13px;direction:rtl}
#xpanel{position:fixed;border-color:#0ea5e9;bottom:70px}
#apanel.hidden,#xpanel.hidden{display:none}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
.fg input,.fg select,#xpanel input,#xpanel select{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:8px;font-size:14px;direction:ltr}
.rowb{display:flex;gap:6px;flex-wrap:wrap}
.rowb button{padding:8px 10px;font-size:13px}
.rowb .g{background:#16a34a}.rowb .s{background:#475569}`;
document.head.appendChild(css);

const $ = (id) => document.getElementById(id);
const map = window.__map;
const KEY = 'sp_points_v1';
const get = () => (window.__pts ? window.__pts() : []);
const renum = (a) => a.map((p, i) => ({ ...p, id: i + 1 }));
const toast = (m) => { const t = $('toast'); t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 1600); };
const num = (v) => { const s = String(v).trim().replace(',', '.'); return s !== '' && !isNaN(s) ? parseFloat(s) : NaN; };

// ---------- حفظ تلقائي ----------
window.__changed = () => {
  try { localStorage.setItem(KEY, JSON.stringify(get())); } catch (e) { /* ignore */ }
};
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(saved) && saved.length && !get().length) window.__setPts(renum(saved));
} catch (e) { /* ignore */ }

// ---------- إضافة نقطة يدوي ----------
const tools = document.querySelector('.tools');
const bAdd = document.createElement('button');
bAdd.id = 'bAdd'; bAdd.title = 'إضافة نقطة'; bAdd.textContent = '➕';
tools.appendChild(bAdd);
const ap = document.createElement('div');
ap.id = 'apanel'; ap.className = 'hidden';
ap.innerHTML = `<b>➕ إضافة نقطة</b>
<div class="fg">
  <input id="aName" placeholder="الاسم" />
  <input id="aCode" placeholder="الكود" />
  <input id="aN" inputmode="decimal" placeholder="N" />
  <input id="aE" inputmode="decimal" placeholder="E" />
  <input id="aZ" inputmode="decimal" placeholder="Z (اختياري)" />
</div>
<div class="rowb"><button class="g" id="aOk">إضافة</button><button id="aPick">📍 من الخريطة</button><button class="s" id="aUndo">حذف آخر يدوية</button><button class="s" id="aClose">إغلاق</button></div>`;
$('mapView').appendChild(ap);

function nextName() {
  let mx = 0;
  get().forEach((p) => { const n = parseInt(p.name, 10); if (!isNaN(n) && n > mx) mx = n; });
  return String(mx + 1);
}
bAdd.onclick = () => { ap.classList.toggle('hidden'); if (!ap.classList.contains('hidden')) $('aName').value = nextName(); };
$('aClose').onclick = () => ap.classList.add('hidden');
$('aPick').onclick = () => {
  toast('اضغط على الخريطة');
  map.once('click', (e) => { $('aN').value = e.latlng.lat.toFixed(3); $('aE').value = e.latlng.lng.toFixed(3); });
};
$('aOk').onclick = () => {
  const n = num($('aN').value), e = num($('aE').value), z = num($('aZ').value);
  if (isNaN(n) || isNaN(e)) { toast('اكتب N و E صح'); return; }
  const p = { id: 0, name: $('aName').value.trim() || nextName(), n, e, z: isNaN(z) ? 0 : z, code: $('aCode').value.trim() || 'MAN', manual: true };
  window.__setPts(renum(get().concat([p])));
  map.panTo([n, e]);
  toast('تمت إضافة ' + p.name);
  $('aName').value = nextName(); $('aN').value = ''; $('aE').value = ''; $('aZ').value = '';
};
$('aUndo').onclick = () => {
  const a = get(); let i = a.length - 1;
  while (i >= 0 && !a[i].manual) i--;
  if (i < 0) { toast('مفيش نقط يدوية'); return; }
  const name = a[i].name;
  window.__setPts(renum(a.filter((_, k) => k !== i)));
  toast('اتحذفت ' + name);
};

// ---------- التصدير ----------
const hdr = document.querySelector('section.bar');
const bX = document.createElement('button');
bX.id = 'bX'; bX.textContent = '📤 تصدير';
hdr.appendChild(bX);
const xp = document.createElement('div');
xp.id = 'xpanel'; xp.className = 'hidden';
xp.innerHTML = `<b>📤 تصدير النقط</b>
<div class="fg">
  <select id="xFmt"><option value="sdr">SDR33 (.sdr)</option><option value="csv">CSV (.csv)</option><option value="dxf">DXF (.dxf)</option></select>
  <select id="xOrd"><option value="NE">N ثم E</option><option value="EN">E ثم N</option></select>
  <input id="xH" inputmode="decimal" value="1" placeholder="ارتفاع النص (DXF)" />
  <input id="xName" value="survey_points" placeholder="اسم الملف" />
</div>
<div class="rowb"><button class="g" id="xDl">⬇ تحميل</button><button id="xCp">نسخ النص</button><button class="s" id="xClose">إغلاق</button></div>`;
document.body.appendChild(xp);
bX.onclick = () => xp.classList.toggle('hidden');
$('xClose').onclick = () => xp.classList.add('hidden');

function build() {
  const pts = get();
  if (!pts.length) { toast('مفيش نقط للتصدير'); return null; }
  const f = $('xFmt').value, o = $('xOrd').value;
  const nm = ($('xName').value.trim() || 'survey_points').replace(/[^\w\-.]+/g, '_');
  if (f === 'sdr') return { text: toSDR(pts, o), file: nm + '.sdr', mime: 'text/plain' };
  if (f === 'csv') return { text: toCSV(pts, o), file: nm + '.csv', mime: 'text/csv' };
  const h = num($('xH').value);
  return { text: toDXF(pts, isNaN(h) || h <= 0 ? 1 : h, true), file: nm + '.dxf', mime: 'application/dxf' };
}
$('xDl').onclick = () => {
  const r = build(); if (!r) return;
  const url = URL.createObjectURL(new Blob([r.text], { type: r.mime }));
  const a = document.createElement('a');
  a.href = url; a.download = r.file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('تم تجهيز ' + r.file);
};
$('xCp').onclick = async () => {
  const r = build(); if (!r) return;
  try { await navigator.clipboard.writeText(r.text); toast('تم النسخ'); } catch (e) { toast('فشل النسخ'); }
};
