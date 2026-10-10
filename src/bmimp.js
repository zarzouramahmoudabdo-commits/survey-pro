import { readKmz } from './kml.js';
import { parsePoints } from './parser.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2500); };
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

let items = [], sel = new Set(), q = '', lim = 60, shown = [];
const css = document.createElement('style');
css.textContent = `
#bimp{position:fixed;left:10px;right:10px;bottom:70px;z-index:1300;background:#0f172af7;border:1px solid #22c55e;border-radius:10px;padding:10px;font-size:13px;direction:rtl;max-height:75%;display:flex;flex-direction:column}
#bimp.hidden{display:none}
#bimpQ{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;margin:6px 0}
#bimpRows{flex:1;overflow:auto;min-height:80px}
.bir{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #334155}
.bir .bin{flex:1;min-width:0;cursor:pointer}.bir button{padding:6px 10px}`;
document.head.appendChild(css);
const box = document.createElement('div');
box.id = 'bimp'; box.className = 'hidden';
box.innerHTML = '<b id="bimpT">📥 استيراد ثوابت</b><input id="bimpQ" placeholder="🔍 فلتر بالاسم أو الوصف" /><div class="rowb"><button id="bimpAll">☑ تحديد الكل</button><button class="s" id="bimpNone">☐ إلغاء</button></div><div id="bimpRows"></div><div class="rowb" style="margin-top:6px"><button class="g" id="bimpAdd">➕ إضافة المحدد</button><button class="s" id="bimpX">إغلاق</button></div>';
document.body.appendChild(box);
const finp = document.createElement('input');
finp.type = 'file'; finp.style.display = 'none';
document.body.appendChild(finp);

function matches() {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const out = [];
  items.forEach((it, i) => { if (terms.every((t) => it.key.includes(t))) out.push(i); });
  return out;
}
function render() {
  const all = matches();
  shown = all;
  const part = all.slice(0, lim);
  $('bimpT').textContent = `📥 استيراد ثوابت (${items.length} نقطة في الملف)`;
  $('bimpRows').innerHTML = part.map((i) => {
    const it = items[i];
    return `<div class="bir"><button data-t="${i}">${sel.has(i) ? '☑' : '☐'}</button><div class="bin" data-t="${i}"><b>${esc(it.name)}</b>${it.desc ? '<br><small style="color:#94a3b8">' + esc(it.desc) + '</small>' : ''}</div></div>`;
  }).join('') + (all.length > lim ? `<button class="s" data-more="1" style="width:100%;margin-top:6px">عرض المزيد (${all.length - lim})</button>` : '') + (all.length ? '' : '<div style="padding:8px 0">مفيش نتيجة</div>');
  $('bimpAdd').textContent = `➕ إضافة المحدد (${sel.size})`;
}
async function readFile(f) {
  const buf = await f.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const out = [];
  if (/\.(kmz|kml)$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b)) {
    for (const x of readKmz(buf)) { if (x.g[0].t === 'pt' && x.n) out.push({ name: x.n, desc: String(x.d || '').slice(0, 120), lat: x.g[0].p[0], lon: x.g[0].p[1] }); }
  } else {
    const keep = globalThis.__srcMeta;
    try { for (const p of parsePoints(new TextDecoder('utf-8').decode(u8), 'AUTO')) out.push({ name: p.name, desc: p.code || '', n: p.n, e: p.e, z: p.z }); }
    finally { globalThis.__srcMeta = keep; }
  }
  return out.map((it) => ({ ...it, key: norm(it.name + ' ' + it.desc) }));
}
finp.onchange = async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    toast('جاري قراءة الملف…');
    items = await readFile(f);
    if (!items.length) { toast('مفيش نقط في الملف'); return; }
    sel = new Set(items.map((_, i) => i)); q = ''; lim = 60; $('bimpQ').value = '';
    render(); box.classList.remove('hidden');
    toast(`اتقرا ${items.length} نقطة. حدّد وأضف مرة واحدة`);
  } catch (err) { toast('تعذر قراءة الملف: ' + (err.message || err)); }
};
let qt = 0;
$('bimpQ').addEventListener('input', (e) => { q = e.target.value; lim = 60; clearTimeout(qt); qt = setTimeout(render, 220); });
$('bimpAll').onclick = () => { matches().forEach((i) => sel.add(i)); render(); };
$('bimpNone').onclick = () => { matches().forEach((i) => sel.delete(i)); render(); };
$('bimpX').onclick = () => box.classList.add('hidden');
$('bimpRows').addEventListener('click', (ev) => {
  if (ev.target.dataset && ev.target.dataset.more) { lim += 60; render(); return; }
  const el = ev.target.closest('[data-t]'); if (!el) return;
  const i = +el.dataset.t;
  if (sel.has(i)) sel.delete(i); else sel.add(i);
  render();
});
$('bimpAdd').onclick = () => {
  if (!window.__bmAddMany) { toast('مكوّن الثوابت لسه ما اتحمّلش'); return; }
  const chosen = [...sel].map((i) => items[i]);
  if (!chosen.length) { toast('مفيش حاجة متحددة'); return; }
  const r = window.__bmAddMany(chosen);
  box.classList.add('hidden');
  toast(`اتضاف ${r.added} ثابتة` + (r.skipped ? ` (اتخطّى ${r.skipped} موجودة أو غلط)` : ''));
};
const bar = document.querySelector('#bmlist .rowb');
if (bar) {
  const b = document.createElement('button');
  b.id = 'bimpOpen'; b.textContent = '📥 استيراد ثوابت من ملف';
  b.onclick = () => finp.click();
  bar.prepend(b);
}
