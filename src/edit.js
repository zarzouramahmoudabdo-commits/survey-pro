import { toCSV, toSDR, toDXF, toSame } from './exportfmt.js';
import { Capacitor } from '@capacitor/core';

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
// (اتشال الفتح التلقائي للنقط القديمة، دلوقتي المشاريع بتتفتح من القايمة الجانبية)

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

// ---------- تعديل / حذف نقطة ----------
const css2 = document.createElement('style');
css2.textContent = '#epanel{position:fixed;left:10px;right:10px;bottom:70px;z-index:1200;background:#0f172af7;border:1px solid #f59e0b;border-radius:10px;padding:10px;font-size:13px;direction:rtl}#epanel.hidden{display:none}';
document.head.appendChild(css2);
const ep = document.createElement('div');
ep.id = 'epanel'; ep.className = 'hidden';
ep.innerHTML = `<b>✏ تعديل نقطة</b>
<div class="fg">
  <input id="eName" placeholder="الاسم" />
  <input id="eCode" placeholder="الكود" />
  <input id="eN" inputmode="decimal" placeholder="N" />
  <input id="eE" inputmode="decimal" placeholder="E" />
  <input id="eZ" inputmode="decimal" placeholder="Z" />
</div>
<div class="rowb"><button class="g" id="eSave">حفظ</button><button id="eCopy">نسخ</button><button class="s" id="eDel">🗑 حذف</button><button class="s" id="eClose">إغلاق</button></div>`;
document.body.appendChild(ep);
let ei = -1, delTimer = 0;
const resetDel = () => { clearTimeout(delTimer); delTimer = 0; $('eDel').textContent = '🗑 حذف'; };
window.__editPt = (i) => {
  const p = get()[i]; if (!p) return;
  ei = i; resetDel();
  $('eName').value = p.name; $('eCode').value = p.code || '';
  $('eN').value = p.n; $('eE').value = p.e; $('eZ').value = p.z;
  ep.classList.remove('hidden');
};
$('eClose').onclick = () => { resetDel(); ep.classList.add('hidden'); };
$('eCopy').onclick = async () => {
  const p = get()[ei]; if (!p) return;
  try { await navigator.clipboard.writeText(`${p.n},${p.e},${p.z}`); toast('تم النسخ'); } catch (e) { toast('فشل النسخ'); }
};
$('eSave').onclick = () => {
  const n = num($('eN').value), e = num($('eE').value), z = num($('eZ').value);
  const name = $('eName').value.trim();
  if (isNaN(n) || isNaN(e)) { toast('اكتب N و E صح'); return; }
  if (!name) { toast('الاسم مطلوب'); return; }
  const a = get().slice(); const p = a[ei]; if (!p) return;
  a[ei] = { ...p, name, code: $('eCode').value.trim(), n, e, z: isNaN(z) ? 0 : z };
  window.__setPts(renum(a));
  resetDel(); ep.classList.add('hidden'); toast('تم الحفظ');
};
$('eDel').onclick = () => {
  if (!delTimer) { delTimer = setTimeout(resetDel, 3000); $('eDel').textContent = 'تأكيد الحذف؟'; return; }
  resetDel();
  window.__setPts(renum(get().filter((_, k) => k !== ei)));
  ep.classList.add('hidden'); toast('تم الحذف');
};

// ---------- حفظ بيانات الملف المستورد ----------
const MKEY = 'sp_meta_v1';
const fileIn = $('file');
if (fileIn) fileIn.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) window.__srcName = f.name; });
const prevChanged = window.__changed;
window.__changed = () => {
  const m = globalThis.__srcMeta;
  if (m && window.__srcName && m.name !== window.__srcName) m.name = window.__srcName;
  prevChanged();
  try { localStorage.setItem(MKEY, JSON.stringify(m || null)); } catch (e) { /* ignore */ }
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
  <select id="xFmt"></select>
  <select id="xOrd"><option value="NE">N ثم E</option><option value="EN">E ثم N</option></select>
  <input id="xH" inputmode="decimal" value="1" placeholder="ارتفاع النص (DXF)" />
  <input id="xName" placeholder="اسم الملف" />
</div>
<div class="rowb"><button class="g" id="xDl">⬇ حفظ / مشاركة</button><button id="xCp">نسخ النص</button><button class="s" id="xClose">إغلاق</button></div>`;
document.body.appendChild(xp);

const extOf = (n) => { const m = String(n || '').match(/\.[A-Za-z0-9]+$/); return m ? m[0] : ''; };
function defName(fmt) {
  const m = globalThis.__srcMeta;
  if (fmt === 'same' && m && m.name) return m.name.replace(/\.[A-Za-z0-9]+$/, '') + '_edited';
  return 'survey_points';
}
function refresh() {
  const m = globalThis.__srcMeta;
  const o = [];
  if (m && m.lines) o.push(['same', 'نفس صيغة الملف المستورد (' + (m.format === 'sdr' ? 'SDR' : 'نصي') + ')']);
  o.push(['sdr', 'SDR33 (.sdr)'], ['csv', 'CSV (.csv)'], ['dxf', 'DXF (.dxf)']);
  $('xFmt').innerHTML = o.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join('');
  $('xFmt').value = o[0][0];
  $('xName').value = defName(o[0][0]);
  $('xOrd').disabled = o[0][0] === 'same';
}
$('xFmt').onchange = () => { $('xName').value = defName($('xFmt').value); $('xOrd').disabled = $('xFmt').value === 'same'; };
bX.onclick = () => { if (xp.classList.contains('hidden')) { refresh(); xp.classList.remove('hidden'); } else xp.classList.add('hidden'); };
$('xClose').onclick = () => xp.classList.add('hidden');

function build() {
  const pts = get();
  if (!pts.length) { toast('مفيش نقط للتصدير'); return null; }
  const f = $('xFmt').value, o = $('xOrd').value;
  const nm = ($('xName').value.trim() || 'survey_points').replace(/[^\w\-.]+/g, '_');
  if (f === 'same') {
    const m = globalThis.__srcMeta, text = toSame(pts, m);
    if (text === null) { toast('مفيش ملف مستورد'); return null; }
    return { text, file: nm + (extOf(m.name) || (m.format === 'sdr' ? '.sdr' : '.txt')), mime: 'text/plain' };
  }
  if (f === 'sdr') return { text: toSDR(pts, o), file: nm + '.sdr', mime: 'text/plain' };
  if (f === 'csv') return { text: toCSV(pts, o), file: nm + '.csv', mime: 'text/csv' };
  const h = num($('xH').value);
  return { text: toDXF(pts, isNaN(h) || h <= 0 ? 1 : h, true), file: nm + '.dxf', mime: 'application/dxf' };
}
async function saveFile(name, text, mime) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, url: r.uri, dialogTitle: 'حفظ / مشاركة الملف' });
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (!/cancel/i.test(msg)) toast('تعذر الحفظ: ' + msg);
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('تم تجهيز ' + name);
}
$('xDl').onclick = async () => { const r = build(); if (r) await saveFile(r.file, r.text, r.mime); };
$('xCp').onclick = async () => {
  const r = build(); if (!r) return;
  try { await navigator.clipboard.writeText(r.text); toast('تم النسخ'); } catch (e) { toast('فشل النسخ'); }
};
import('./projects.js');
