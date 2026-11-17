const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
const tv = $('tableView'), rows = $('rows');
let q = '', sort = 'id', dir = 1;
const css = document.createElement('style');
css.textContent = `
#plbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px 12px}
#plQ{flex:1;min-width:140px;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px}
#plbar button.on{background:#7c3aed}#plc{color:#94a3b8;font-size:12px;width:100%}
td.plj{cursor:pointer;font-size:16px;color:#a5b4fc}`;
document.head.appendChild(css);
const bar = document.createElement('div');
bar.id = 'plbar';
bar.innerHTML = '<input id="plQ" placeholder="🔍 بحث برقم النقطة أو الكود"><button data-s="id">#</button><button data-s="z">Z</button><button data-s="name">الاسم</button><div id="plc"></div>';
const wrap = tv.querySelector('.wrap');
tv.insertBefore(bar, wrap);
const obs = new MutationObserver(() => process());
function process() {
  obs.disconnect();
  const th = tv.querySelector('thead tr');
  if (th && !th.querySelector('.plh')) { const h = document.createElement('th'); h.className = 'plh'; h.textContent = '🗺'; th.appendChild(h); }
  const trs = [...rows.children];
  const terms = norm(q).split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const tr of trs) {
    if (!tr.querySelector('td.plj')) { const c = document.createElement('td'); c.className = 'plj'; c.textContent = '🗺'; tr.appendChild(c); }
    const t = norm(tr.children[1].textContent + ' ' + (tr.children[5] ? tr.children[5].textContent : ''));
    const ok = terms.every((x) => t.includes(x));
    tr.style.display = ok ? '' : 'none'; if (ok) shown++;
  }
  const key = (tr) => (sort === 'z' ? parseFloat(tr.children[4].textContent) || 0 : sort === 'name' ? tr.children[1].textContent : +tr.dataset.i);
  trs.sort((a, b) => (sort === 'name' ? String(key(a)).localeCompare(String(key(b)), 'ar', { numeric: true }) : key(a) - key(b)) * dir).forEach((tr) => rows.appendChild(tr));
  $('plc').textContent = trs.length ? `عرض ${shown} من ${trs.length}` : '';
  bar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.s === sort));
  obs.observe(rows, { childList: true });
}
bar.addEventListener('click', (e) => {
  const s = e.target.dataset && e.target.dataset.s; if (!s) return;
  if (sort === s) dir = -dir; else { sort = s; dir = 1; }
  process();
});
let t0 = 0;
$('plQ').addEventListener('input', (e) => { q = e.target.value; clearTimeout(t0); t0 = setTimeout(process, 200); });
rows.addEventListener('click', (e) => {
  const c = e.target.closest('td.plj'); if (!c) return;
  e.stopPropagation();
  const tr = c.parentNode, p = window.__pts ? window.__pts()[+tr.dataset.i] : null;
  if (!p) return;
  const tab = $('tMap'); if (tab) tab.click();
  setTimeout(() => { const m = window.__map; if (m) m.setView([p.n, p.e], Math.max(m.getZoom(), 3), { animate: false }); }, 80);
}, true);
process();
