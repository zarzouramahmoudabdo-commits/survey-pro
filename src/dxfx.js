const $ = (id) => document.getElementById(id);
const f3 = (v) => Number(v).toFixed(3);
const OPT = { point: true, id: true, z: true, desc: true, line: true, pdmode: 35 };
try { Object.assign(OPT, JSON.parse(localStorage.getItem('sp_dxfopt') || '{}')); } catch (e) { /* ignore */ }

export function toDXF2(pts, h = 0.5, o = OPT) {
  const g = [];
  const add = (...a) => a.forEach((x) => g.push(String(x)));
  const layers = [['SURVEY_POINTS', 3], ['SURVEY_ID', 7], ['SURVEY_Z', 5], ['DESCRIPTION', 1], ['SURVEY_LINE', 4]];
  add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$PDMODE', 70, o.pdmode, 9, '$PDSIZE', 40, (h * 0.8).toFixed(3), 0, 'ENDSEC');
  add(0, 'SECTION', 2, 'TABLES');
  add(0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0', 0, 'ENDTAB');
  add(0, 'TABLE', 2, 'LAYER', 70, layers.length);
  layers.forEach(([nm, c]) => add(0, 'LAYER', 2, nm, 70, 0, 62, c, 6, 'CONTINUOUS'));
  add(0, 'ENDTAB');
  add(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, '0.0', 41, '1.0', 50, '0.0', 71, 0, 42, '0.2', 3, 'txt', 4, '', 0, 'ENDTAB');
  add(0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const txt = (layer, x, y, t) => add(0, 'TEXT', 8, layer, 10, f3(x), 20, f3(y), 30, 0, 40, h, 1, String(t));
  for (const p of pts) {
    if (o.point) add(0, 'POINT', 8, 'SURVEY_POINTS', 10, f3(p.e), 20, f3(p.n), 30, f3(p.z || 0));
    if (o.id) txt('SURVEY_ID', p.e + h * 0.6, p.n + h * 0.6, p.name);
    if (o.z) txt('SURVEY_Z', p.e + h * 0.6, p.n - h * 0.6, f3(p.z || 0));
    if (o.desc && p.code) txt('DESCRIPTION', p.e + h * 0.6, p.n - h * 1.8, p.code);
  }
  if (o.line) {
    for (let i = 1; i < pts.length; i++) add(0, 'LINE', 8, 'SURVEY_LINE', 10, f3(pts[i - 1].e), 20, f3(pts[i - 1].n), 30, 0, 11, f3(pts[i].e), 21, f3(pts[i].n), 31, 0);
  }
  add(0, 'ENDSEC', 0, 'EOF');
  return g.join('\n') + '\n';
}
window.__toDXF2 = (pts, h) => toDXF2(pts, h, OPT);

// ---------- واجهة خيارات DXF جوه قايمة التصدير ----------
const xp = $('xpanel');
if (xp) {
  const css = document.createElement('style');
  css.textContent = '#dxo{background:#1e293b;border-radius:8px;padding:8px;margin:6px 0}#dxo .dxr{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}#dxo button.on{background:#7c3aed}#dxo.hidden{display:none}';
  document.head.appendChild(css);
  const box = document.createElement('div');
  box.id = 'dxo'; box.className = 'hidden';
  const fg = xp.querySelector('.fg');
  (fg && fg.parentNode ? fg.parentNode : xp).insertBefore(box, fg ? fg.nextSibling : null);
  const NAMES = [['point', 'النقط'], ['id', 'أرقام النقط'], ['z', 'المناسيب Z'], ['desc', 'الأوصاف'], ['line', 'الخطوط']];
  const PD = [[0, '• نقطة بسيطة (0)'], [3, '✕ تقاطع (3)'], [35, '⊕ دائرة + تقاطع (35)']];
  const render = () => {
    box.innerHTML = `<small style="color:#94a3b8">الطبقات اللي تتصدّر في DXF:</small><div class="dxr">${NAMES.map(([k, t]) => `<button data-k="${k}" class="${OPT[k] ? 'on' : ''}">${OPT[k] ? '☑' : '☐'} ${t}</button>`).join('')}</div><small style="color:#94a3b8">شكل رمز النقطة في AutoCAD (PDMODE):</small><div class="dxr">${PD.map(([v, t]) => `<button data-pd="${v}" class="${OPT.pdmode === v ? 'on' : ''}">${t}</button>`).join('')}</div><small style="color:#94a3b8">ارتفاع النص: الخانة اللي فوق (مثلاً 0.5)</small>`;
  };
  const sync = () => { const f = $('xFmt'); box.classList.toggle('hidden', !(f && f.value === 'dxf')); if (!box.classList.contains('hidden')) render(); };
  box.addEventListener('click', (ev) => {
    const d = ev.target.dataset || {};
    if (d.k) OPT[d.k] = !OPT[d.k]; else if (d.pd) OPT.pdmode = +d.pd; else return;
    try { localStorage.setItem('sp_dxfopt', JSON.stringify(OPT)); } catch (e) { /* ignore */ }
    render();
  });
  const f = $('xFmt');
  if (f) f.addEventListener('change', sync);
  new MutationObserver(sync).observe(xp, { attributes: true, attributeFilter: ['class'] });
  sync();
}
