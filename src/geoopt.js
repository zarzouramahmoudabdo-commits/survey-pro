const $ = (id) => document.getElementById(id);
const KEY = 'sp_geoline';
let show = true;
try { show = localStorage.getItem(KEY) !== '0'; } catch (e) { show = true; }
window.__geoLine = show;
const tools = document.querySelector('#geoView .gtools');
const btn = document.createElement('button');
btn.id = 'gLine'; btn.title = 'إظهار/إخفاء الخط اللي بيوصل النقط'; btn.textContent = '〰';
btn.className = show ? 'on' : '';
tools.appendChild(btn);
btn.onclick = () => {
  show = !show; window.__geoLine = show; btn.classList.toggle('on', show);
  try { localStorage.setItem(KEY, show ? '1' : '0'); } catch (e) { /* ignore */ }
  const l = window.__geoLineLayer, m = window.__gmap;
  if (l && m) { if (show) l.addTo(m); else l.remove(); }
  const t = $('toast'); if (t) { t.textContent = show ? 'الخط بين النقط: ظاهر' : 'الخط بين النقط: مخفي'; t.className = 'show'; setTimeout(() => (t.className = ''), 1500); }
};
