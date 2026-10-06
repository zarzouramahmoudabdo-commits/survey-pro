import L from 'leaflet';
import { dxfToPrims } from './dxfgeom.js';

const css = document.createElement('style');
css.textContent = `
#dpanel{position:absolute;left:10px;bottom:10px;z-index:1000;max-width:70%;max-height:45%;overflow:auto;background:#0f172af2;border:1px solid #38bdf8;border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.7;direction:rtl}
#dpanel .dh{display:flex;justify-content:space-between;align-items:center;gap:8px}
#dpanel .dh button{padding:2px 10px;background:#334155}
#dpanel label{display:flex;align-items:center;gap:6px;direction:ltr;justify-content:flex-end}
#dpanel .sw{width:12px;height:12px;border-radius:3px;display:inline-block}
#dpanel .ok{color:#4ade80}#dpanel .no{color:#f87171}
.dtx{color:#cbd5e1;font-size:11px;white-space:nowrap;text-shadow:0 0 2px #000}`;
document.head.appendChild(css);

const $ = (id) => document.getElementById(id);
const map = window.__map;
const rend = L.canvas({ padding: 0.5 });
let groups = {};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const tools = document.querySelector('.tools');
const btn = document.createElement('button');
btn.id = 'bDxf'; btn.title = 'DXF'; btn.textContent = '📐';
tools.appendChild(btn);
const inp = document.createElement('input');
inp.type = 'file'; inp.accept = '*/*'; inp.style.display = 'none';
document.body.appendChild(inp);
const panel = document.createElement('div');
panel.id = 'dpanel'; panel.className = 'hidden';
$('mapView').appendChild(panel);

function clearAll() {
  Object.values(groups).forEach((g) => map.removeLayer(g));
  groups = {};
  panel.classList.add('hidden');
}

function show(res, name) {
  clearAll();
  const { prims, layers, ext } = res;
  let nText = 0;
  for (const p of prims) {
    const g = groups[p.layer] || (groups[p.layer] = L.layerGroup());
    const color = p.col || layers[p.layer] || '#e2e8f0';
    if (p.t === 'pl') L.polyline(p.pts, { color, weight: 1.2, renderer: rend, interactive: false }).addTo(g);
    else if (p.t === 'pt') L.circleMarker(p.pt, { radius: 2, color, renderer: rend, interactive: false }).addTo(g);
    else if (p.t === 'tx' && nText < 3000) {
      nText++;
      L.marker(p.pt, { interactive: false, icon: L.divIcon({ className: 'dtx', html: esc(p.text), iconSize: [0, 0] }) }).addTo(g);
    }
  }
  Object.values(groups).forEach((g) => g.addTo(map));
  const pts = window.__pts ? window.__pts() : [];
  let html = `<div class="dh"><b>📐 ${esc(name)}</b><span><button id="dFit">⤢</button><button id="dDel">✕</button></span></div>`;
  html += `<div>${prims.length} عنصر — ${Object.keys(groups).length} طبقة</div>`;
  if (pts.length && isFinite(ext.minE)) {
    const inside = pts.filter((p) => p.e >= ext.minE && p.e <= ext.maxE && p.n >= ext.minN && p.n <= ext.maxN).length;
    html += inside
      ? `<div class="ok">${inside} من ${pts.length} نقطة داخل حدود الرسم</div>`
      : `<div class="no">مفيش نقط الرفع داخل حدود الرسم — غالباً نظام إحداثيات مختلف أو إزاحة</div>`;
  }
  html += Object.keys(groups).map((k) =>
    `<label><span>${esc(k)}</span><input type="checkbox" data-l="${esc(k)}" checked><i class="sw" style="background:${layers[k] || '#e2e8f0'}"></i></label>`).join('');
  panel.innerHTML = html;
  panel.classList.remove('hidden');
  fit(ext);
  panel._ext = ext;
}
function fit(ext) {
  if (!isFinite(ext.minE)) return;
  map.invalidateSize();
  map.fitBounds([[ext.minN, ext.minE], [ext.maxN, ext.maxE]], { padding: [30, 30] });
}

btn.onclick = () => inp.click();
inp.onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const text = await f.text();
    if (/^AC10/.test(text)) throw new Error('ده ملف DWG، حوّله لـ DXF الأول');
    if (/^AutoCAD Binary DXF/.test(text)) throw new Error('DXF بصيغة Binary، احفظه ASCII');
    show(dxfToPrims(text), f.name);
  } catch (err) {
    panel.innerHTML = `<div class="no">${esc(err.message || err)}</div>`;
    panel.classList.remove('hidden');
  }
};
panel.addEventListener('click', (e) => {
  if (e.target.id === 'dFit') fit(panel._ext);
  if (e.target.id === 'dDel') clearAll();
});
panel.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.l;
  if (!k || !groups[k]) return;
  if (e.target.checked) groups[k].addTo(map); else map.removeLayer(groups[k]);
});
