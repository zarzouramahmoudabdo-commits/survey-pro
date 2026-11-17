import L from 'leaflet';

const $ = (id) => document.getElementById(id);
const KEY = 'sp_layers';
const st = { dot: true, id: true, z: false, desc: false, line: true, grid: false, north: true, ts: 1 };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const mv = $('mapView');
const css = document.createElement('style');
css.textContent = `
.pt .lz,.pt .ld{position:absolute;left:9px;white-space:nowrap;font-weight:700;text-shadow:0 0 3px #000,0 0 3px #000}
.pt .lz{top:-6px;color:#7dd3fc}.pt .ld{top:7px;color:#fca5a5}
#mapView .pt .lbl{font-size:calc(12px*var(--ts,1))}#mapView .pt .lz,#mapView .pt .ld{font-size:calc(11px*var(--ts,1))}
#mapView.nodot .pt .dot{display:none}#mapView.noid .pt .lbl{display:none}#mapView.noz .pt .lz{display:none}#mapView.nodesc .pt .ld{display:none}
.gl-lbl{color:#94a3b8;font-size:10px;white-space:nowrap;text-shadow:0 0 3px #000;pointer-events:none}
#mnorth{position:absolute;left:10px;top:10px;z-index:900;width:46px;padding:6px 0;text-align:center;background:#1e293bcc;border-radius:12px;color:#fca5a5;font-weight:800;font-size:13px;line-height:1.1;pointer-events:none}
#mnorth.hidden{display:none}
#lypanel{position:absolute;left:10px;right:64px;top:64px;z-index:1100;background:#0f172af7;border:1px solid #a78bfa;border-radius:12px;padding:10px 12px;font-size:14px;direction:rtl;max-height:75%;overflow:auto}
#lypanel.hidden{display:none}
#lypanel .lyr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #334155}
#lypanel .sw{min-width:52px;padding:6px 10px;border-radius:14px;background:#475569}#lypanel .sw.on{background:#7c3aed}
#lypanel .sz{display:flex;gap:6px;margin:8px 0}#lypanel .sz button{flex:1;padding:8px 0}#lypanel .sz button.on{background:#7c3aed}`;
document.head.appendChild(css);
const tools = mv.querySelector('.tools');
const btn = document.createElement('button');
btn.id = 'lyBtn'; btn.title = 'الطبقات وحجم الخط'; btn.textContent = '🎚';
tools.appendChild(btn);
const north = document.createElement('div');
north.id = 'mnorth'; north.innerHTML = '▲<br>N';
mv.appendChild(north);
const panel = document.createElement('div');
panel.id = 'lypanel'; panel.className = 'hidden';
mv.appendChild(panel);

const ROWS = [['dot', 'رمز النقطة'], ['id', 'رقم النقطة'], ['z', 'المنسوب (Z)'], ['desc', 'الوصف / الكود'], ['line', 'الخطوط بين النقط (الترافرس)'], ['grid', 'شبكة الإحداثيات (Grid)'], ['north', 'سهم الشمال']];
const SIZES = [0.75, 1, 1.4, 1.8];
function renderPanel() {
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>🎚 الطبقات وحجم الخط</b><button class="s" data-x="close">✕</button></div>
<div>حجم الخط: <b>${st.ts}x</b></div><div class="sz">${SIZES.map((s) => `<button data-ts="${s}" class="${s === st.ts ? 'on' : ''}">${s}x</button>`).join('')}</div>
${ROWS.map(([k, t]) => `<div class="lyr"><span>${t}</span><button class="sw ${st[k] ? 'on' : ''}" data-k="${k}">${st[k] ? 'ON' : 'OFF'}</button></div>`).join('')}`;
}
const nice = (x) => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
let grid = null;
function drawGrid() {
  const map = window.__map; if (!map) return;
  if (!grid) grid = L.layerGroup();
  grid.clearLayers();
  if (!st.grid) { map.removeLayer(grid); return; }
  grid.addTo(map);
  const b = map.getBounds(), span = Math.max(b.getNorth() - b.getSouth(), b.getEast() - b.getWest());
  if (!(span > 0) || !isFinite(span)) return;
  const s = nice(span / 6), fmt = (v) => String(Number(v.toFixed(2)));
  const o = { color: '#94a3b8', weight: 1, opacity: 0.35, interactive: false };
  const lab = (pos, t) => L.marker(pos, { interactive: false, icon: L.divIcon({ className: 'gl-lbl', html: t, iconSize: [0, 0] }) }).addTo(grid);
  for (let n = Math.ceil(b.getSouth() / s) * s, i = 0; n <= b.getNorth() && i < 30; n += s, i++) { L.polyline([[n, b.getWest()], [n, b.getEast()]], o).addTo(grid); lab([n, b.getWest()], 'N:' + fmt(n)); }
  for (let e = Math.ceil(b.getWest() / s) * s, i = 0; e <= b.getEast() && i < 30; e += s, i++) { L.polyline([[b.getSouth(), e], [b.getNorth(), e]], o).addTo(grid); lab([b.getSouth(), e], 'E:' + fmt(e)); }
}
function apply() {
  mv.classList.toggle('nodot', !st.dot); mv.classList.toggle('noid', !st.id);
  mv.classList.toggle('noz', !st.z); mv.classList.toggle('nodesc', !st.desc);
  mv.style.setProperty('--ts', st.ts);
  north.classList.toggle('hidden', !st.north);
  const lb = $('bLine'); if (lb && lb.classList.contains('on') !== st.line) lb.click();
  drawGrid();
}
btn.onclick = () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) renderPanel(); };
panel.addEventListener('click', (ev) => {
  const t = ev.target; const d = t.dataset || {};
  if (d.x === 'close') { panel.classList.add('hidden'); return; }
  if (d.ts) st.ts = +d.ts;
  else if (d.k) st[d.k] = !st[d.k];
  else return;
  save(); apply(); renderPanel();
});
const hook = () => { if (window.__map) window.__map.on('moveend', () => { if (st.grid) drawGrid(); }); };
hook();
apply();
