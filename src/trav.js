import { adjustTraverse, fmtRatio } from './travcalc.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 2600); };
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
const f3 = (v) => Number(v).toFixed(3);
const sg = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
function dms(deg) {
  let d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

let src = 'pj', q = '', lim = 60, seq = [], known = null, pickKnown = false, res = null, applyArm = 0, applyTimer = 0;
const css = document.createElement('style');
css.textContent = `
#tvwrap{position:fixed;inset:0;z-index:3500;background:#0b1220;display:flex;flex-direction:column;direction:rtl}
#tvwrap.hidden{display:none}
.tvh{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#1e293b}
.tvb{flex:1;overflow:auto;padding:10px 12px 40px}
.tvrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.tvrow button.on{background:#0ea5e9}
#tvwrap input{background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px}
#tvQ{width:100%}
.tvl{max-height:34vh;overflow:auto;border:1px solid #334155;border-radius:8px}
.tvi{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid #334155;cursor:pointer;direction:ltr}
.tvi small{color:#94a3b8}.tvi.pk{background:#f59e0b33}
.tvchips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;direction:ltr}
.tvchips span{background:#0ea5e9;color:#fff;border-radius:12px;padding:3px 9px;font-size:12px}
.tvs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
.tvs div{background:#1e293b;border-radius:8px;padding:7px 9px;font-size:13px}.tvs b{display:block;color:#7dd3fc;font-size:15px;direction:ltr;text-align:right}
.tvok{background:#14532d!important;color:#bbf7d0}.tvbad{background:#7f1d1d!important;color:#fecaca}
.tvt{overflow:auto;border:1px solid #334155;border-radius:8px;direction:ltr}
.tvt table{border-collapse:collapse;font:12px ui-monospace,Menlo,monospace;min-width:100%}
.tvt th{background:#1e3a5f;color:#e0f2fe;padding:6px 8px;position:sticky;top:0;white-space:nowrap}
.tvt td{padding:5px 8px;text-align:right;white-space:nowrap;border-bottom:1px solid #1e293b}
.tvt tr:nth-child(even) td{background:#111b2e}.tvt td.nm{text-align:left;font-weight:700;color:#fde68a}.tvt td.c{color:#fca5a5}.tvt td.n{color:#86efac;font-weight:700}`;
document.head.appendChild(css);
const wrap = document.createElement('div');
wrap.id = 'tvwrap'; wrap.className = 'hidden';
wrap.innerHTML = '<div class="tvh"><b>🧮 تقفيل ترافرس</b><button id="tvX" class="s">✕</button></div><div class="tvb" id="tvBody"></div>';
document.body.appendChild(wrap);
const hdr = document.querySelector('header');
const ob = document.createElement('button');
ob.id = 'tvOpen'; ob.title = 'تقفيل ترافرس'; ob.textContent = '🧮';
ob.style.cssText = 'padding:6px 12px;font-size:20px;background:#334155';
if (hdr) hdr.insertBefore(ob, hdr.children[1] || null);

const items = () => {
  const source = pickKnown ? (src === 'pj' ? 'bm' : 'pj') : src;
  return (source === 'pj'
    ? (window.__pts ? window.__pts() : [])
    : (window.__bmGet ? window.__bmGet() : [])
  ).map((p) => ({ id: p.id, name: String(p.name), n: p.n, e: p.e, z: p.z }));
};
const label = (it) => it.name + ' (' + f3(it.n) + ', ' + f3(it.e) + ')';

function setup() {
  const all = items(), terms = norm(q).split(/\s+/).filter(Boolean);
  const list = all.map((it, i) => ({ it, i })).filter(({ it }) => terms.every((t) => norm(it.name).includes(t)));
  const part = list.slice(0, lim);
  $('tvBody').innerHTML = `
<div class="tvrow"><button data-src="pj" class="${src === 'pj' ? 'on' : ''}">نقط المشروع</button><button data-src="bm" class="${src === 'bm' ? 'on' : ''}">الثوابت</button></div>
<input id="tvQ" placeholder="🔍 ابحث بالاسم" value="${esc(q)}" />
<div class="tvrow"><input id="tvFrom" inputmode="numeric" placeholder="من رقم صف" style="width:34%"><input id="tvTo" inputmode="numeric" placeholder="إلى" style="width:26%"><button id="tvRange">➕ أضف نطاق</button></div>
<small style="color:#94a3b8">${pickKnown ? '👆 اضغط على النقطة المعلومة اللي هتقفل عليها' : 'اضغط على النقط بالترتيب (بداية ← … ← نقطة التقفيل المرصودة)'}</small>
<div class="tvl">${part.map(({ it, i }) => `<div class="tvi${pickKnown ? ' pk' : ''}" data-i="${i}"><span>${esc(it.name)}</span><small>${f3(it.n)} , ${f3(it.e)}</small></div>`).join('') || '<div style="padding:10px;color:#94a3b8">مفيش نقط</div>'}${list.length > lim ? `<button class="s" data-more="1" style="width:100%">عرض المزيد (${list.length - lim})</button>` : ''}</div>
<b>سلسلة الترافرس (${seq.length}):</b>
<div class="tvchips">${seq.map((s, k) => `<span>${k + 1}: ${esc(s.name)}</span>`).join('') || '<small style="color:#94a3b8">فاضية</small>'}</div>
<div class="tvrow"><button id="tvUndo">↩ آخر نقطة</button><button id="tvClear" class="s">🗑 مسح</button></div>
<div class="tvrow"><button id="tvKnown" class="${pickKnown ? 'on' : ''}">🎯 التقفيل على: ${known ? esc(known.name) : seq.length ? 'نقطة البداية (' + esc(seq[0].name) + ')' : 'نقطة البداية'}</button>${known ? '<button id="tvKnownReset" class="s">رجوع للبداية</button>' : ''}</div>
<div class="tvrow">الحد المسموح للنسبة 1 : <input id="tvAllow" inputmode="numeric" value="${window.__tvAllow || 5000}" style="width:90px"></div>
<button id="tvGo" class="g" style="width:100%;margin-top:8px;padding:12px">احسب وقفّل الترافرس</button>`;
}

function result() {
  const r = res.r, ok = r.ratio >= res.allow;
  const rows = r.rows.map((x, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(x.name)}</td><td>${x.d == null ? '—' : f3(x.d)}</td><td>${f3(x.n0)}</td><td>${f3(x.e0)}</td><td class="c">${i ? sg(x.cN) : '—'}</td><td class="c">${i ? sg(x.cE) : '—'}</td><td class="n">${f3(x.n1)}</td><td class="n">${f3(x.e1)}</td><td>${x.az1 == null ? '—' : dms(x.az1)}</td></tr>`).join('');
  $('tvBody').innerHTML = `
<div class="tvs"><div>عدد المحطات<b>${r.rows.length}</b></div><div>الطول الكلي<b>${f3(r.L)} م</b></div>
<div>خطأ التقفيل ΔN<b>${sg(r.eN, 4)} م</b></div><div>خطأ التقفيل ΔE<b>${sg(r.eE, 4)} م</b></div>
<div>الخطأ الخطي<b>${r.f.toFixed(4)} م</b></div><div>اتجاه الخطأ<b>${dms(r.errAz)}</b></div>
<div class="${ok ? 'tvok' : 'tvbad'}" style="grid-column:1/3">نسبة الخطأ<b>${fmtRatio(r.ratio)}</b>الحد المسموح 1 : ${res.allow} — ${ok ? '✅ مقبول' : '⚠ أكبر من المسموح'}</div></div>
<div class="tvt"><table><thead><tr><th>#</th><th>النقطة</th><th>المسافة</th><th>N قديم</th><th>E قديم</th><th>تصحيح N</th><th>تصحيح E</th><th>N جديد</th><th>E جديد</th><th>Az جديد</th></tr></thead><tbody>${rows}</tbody></table></div>
<small style="color:#94a3b8">طريقة البوديتش (Compass Rule): التصحيح بالتناسب مع الأطوال المتراكمة. نقطة البداية ثابتة ونقطة التقفيل بتتطابق مع المعلومة.</small>
<div class="tvrow"><button id="tvCopy">📋 نسخ الجدول</button><button id="tvCsv">⬇ CSV</button><button id="tvApply" class="g">${applyArm ? 'تأكيد التطبيق؟' : '✅ تطبيق التعديل'}</button><button id="tvBack" class="s">↩ رجوع</button></div>`;
}
function tsv() {
  const h = ['#', 'Point', 'Dist', 'N_old', 'E_old', 'dN', 'dE', 'N_new', 'E_new', 'Az_new'];
  const lines = res.r.rows.map((x, i) => [i + 1, x.name, x.d == null ? '' : f3(x.d), f3(x.n0), f3(x.e0), f3(x.cN), f3(x.cE), f3(x.n1), f3(x.e1), x.az1 == null ? '' : dms(x.az1)]);
  return [h, ...lines];
}
function run() {
  if (seq.length < 3) { toast('اختار 3 نقط على الأقل بالترتيب'); return; }
  const allow = Math.max(1, parseFloat($('tvAllow').value) || 5000); window.__tvAllow = allow;
  try { res = { r: adjustTraverse(seq, known || seq[0]), allow, src }; } catch (e) { toast(e.message); return; }
  applyArm = 0; result();
}
function apply() {
  const m = new Map(res.r.rows.filter((x, i) => i > 0).map((x) => [x.id, x]));
  if (res.src === 'pj') {
    if (!window.__setPts) return;
    window.__setPts((window.__pts() || []).map((p) => (m.has(p.id) ? { ...p, n: +m.get(p.id).n1.toFixed(3), e: +m.get(p.id).e1.toFixed(3) } : p)));
  } else {
    if (!window.__bmSet) return;
    window.__bmSet((window.__bmGet() || []).map((b) => (m.has(b.id) ? { ...b, n: +m.get(b.id).n1.toFixed(3), e: +m.get(b.id).e1.toFixed(3) } : b)));
  }
  toast('اتطبّق التعديل على ' + m.size + ' نقطة');
}
function open() { wrap.classList.remove('hidden'); if (res) result(); else setup(); }
ob.onclick = open;
$('tvX').onclick = () => wrap.classList.add('hidden');
$('tvBody').addEventListener('click', async (ev) => {
  const t = ev.target, id = t.id;
  if (t.dataset.src) { src = t.dataset.src; seq = []; known = null; pickKnown = false; lim = 60; setup(); return; }
  if (t.dataset.more) { lim += 60; setup(); return; }
  const row = t.closest('.tvi');
  if (row) {
    const it = items()[+row.dataset.i]; if (!it) return;
    if (pickKnown) { known = it; pickKnown = false; } else if (!seq.length || seq[seq.length - 1].id !== it.id) seq.push(it);
    const sc = document.querySelector('.tvl') ? document.querySelector('.tvl').scrollTop : 0; setup(); if (document.querySelector('.tvl')) document.querySelector('.tvl').scrollTop = sc; return;
  }
  if (id === 'tvRange') {
    const a = parseInt($('tvFrom').value, 10), b = parseInt($('tvTo').value, 10), all = items();
    if (!(a >= 1 && b >= a && b <= all.length)) { toast('اكتب نطاق صح (رقم الصف من 1 لـ ' + all.length + ')'); return; }
    for (let k = a - 1; k < b; k++) if (!seq.length || seq[seq.length - 1].id !== all[k].id) seq.push(all[k]);
    setup(); return;
  }
  if (id === 'tvUndo') { seq.pop(); setup(); return; }
  if (id === 'tvClear') { seq = []; known = null; pickKnown = false; setup(); return; }
  if (id === 'tvKnown') { pickKnown = !pickKnown; setup(); return; }
  if (id === 'tvKnownReset') { known = null; setup(); return; }
  if (id === 'tvGo') { run(); return; }
  if (id === 'tvBack') { res = null; setup(); return; }
  if (id === 'tvCopy') { try { await navigator.clipboard.writeText(tsv().map((r) => r.join('\t')).join('\n')); toast('تم نسخ الجدول (الصقه في Excel)'); } catch (e) { toast('فشل النسخ'); } return; }
  if (id === 'tvCsv') {
    const text = '\ufeff' + tsv().map((r) => r.join(',')).join('\n') + '\n';
    if (window.__saveFile) await window.__saveFile('traverse_adjustment.csv', text, 'text/csv');
    else { const u = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const a = document.createElement('a'); a.href = u; a.download = 'traverse_adjustment.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    return;
  }
  if (id === 'tvApply') {
    clearTimeout(applyTimer);
    if (!applyArm) { applyArm = 1; applyTimer = setTimeout(() => { applyArm = 0; if (res) result(); }, 3000); result(); return; }
    applyArm = 0; apply(); result();
  }
});
$('tvBody').addEventListener('input', (ev) => { if (ev.target.id === 'tvQ') { q = ev.target.value; lim = 60; clearTimeout(window.__tvT); window.__tvT = setTimeout(() => { const keep = q; setup(); const i = $('tvQ'); i.focus(); i.setSelectionRange(keep.length, keep.length); }, 250); } });
