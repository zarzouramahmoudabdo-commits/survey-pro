import { unzipSync } from 'fflate';

const colorOf = (k) => {
  const s = String(k || '').trim();
  if (!/^[0-9a-fA-F]{8}$/.test(s)) return null;
  return { hex: '#' + s.slice(6, 8) + s.slice(4, 6) + s.slice(2, 4), a: parseInt(s.slice(0, 2), 16) / 255 };
};
const kid = (el, tag) => [...el.children].find((x) => x.localName === tag);
const ktxt = (el, tag) => { const c = kid(el, tag); return c ? c.textContent.trim() : ''; };
function coords(el) {
  const c = el.getElementsByTagName('coordinates')[0];
  if (!c) return [];
  return c.textContent.trim().split(/\s+/).map((p) => p.split(',').map(Number))
    .filter((a) => a.length >= 2 && isFinite(a[0]) && isFinite(a[1])).map((a) => [a[1], a[0]]);
}
function plain(html, Parser) {
  if (!html) return '';
  const h = html.replace(/<(br|\/p|\/div|\/tr|\/li|\/td)[^>]*>/gi, ' ');
  let t = h;
  try { t = new Parser().parseFromString(h, 'text/html').body.textContent || ''; } catch (e) { t = h.replace(/<[^>]*>/g, ' '); }
  t = t.replace(/\s+/g, ' ').trim();
  return t.length > 400 ? t.slice(0, 400) + '…' : t;
}

export function parseKmlText(text, Parser = DOMParser) {
  const doc = new Parser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('ملف KML غير صالح');
  const styles = {};
  for (const st of [...doc.getElementsByTagName('Style')]) {
    const id = st.getAttribute('id'); if (!id) continue;
    const ls = kid(st, 'LineStyle'), ps = kid(st, 'PolyStyle');
    styles[id] = {
      line: ls ? colorOf(ktxt(ls, 'color')) : null, w: ls ? Number(ktxt(ls, 'width')) || 0 : 0,
      fill: ps ? colorOf(ktxt(ps, 'color')) : null, fillOff: ps ? ktxt(ps, 'fill') === '0' : false,
    };
  }
  const maps = {};
  for (const sm of [...doc.getElementsByTagName('StyleMap')]) {
    const id = sm.getAttribute('id'); if (!id) continue;
    const pair = [...sm.children].find((p) => p.localName === 'Pair' && ktxt(p, 'key') === 'normal');
    if (pair) maps[id] = ktxt(pair, 'styleUrl').replace(/^#/, '');
  }
  const styleOf = (url) => { let id = String(url || '').replace(/^#/, ''); if (maps[id]) id = maps[id]; return styles[id] || null; };
  const out = [];
  for (const pm of [...doc.getElementsByTagName('Placemark')]) {
    const gs = [];
    for (const p of [...pm.getElementsByTagName('Point')]) { const c = coords(p); if (c.length) gs.push({ t: 'pt', p: c[0] }); }
    for (const l of [...pm.getElementsByTagName('LineString')]) { const c = coords(l); if (c.length > 1) gs.push({ t: 'ln', p: c }); }
    for (const pg of [...pm.getElementsByTagName('Polygon')]) {
      const rings = [];
      const ob = pg.getElementsByTagName('outerBoundaryIs')[0];
      if (ob) { const c = coords(ob); if (c.length > 2) rings.push(c); }
      for (const ib of [...pg.getElementsByTagName('innerBoundaryIs')]) { const c = coords(ib); if (c.length > 2) rings.push(c); }
      if (rings.length) gs.push({ t: 'pg', p: rings });
    }
    if (!gs.length) continue;
    const path = [];
    for (let n = pm.parentNode; n && n.nodeType === 1; n = n.parentNode) { if (n.localName === 'Folder') { const nm = ktxt(n, 'name'); if (nm) path.unshift(nm); } }
    const st = styleOf(ktxt(pm, 'styleUrl'));
    const s = {};
    if (st) {
      if (st.line) { s.c = st.line.hex; if (st.w) s.w = st.w; }
      if (st.fill && !st.fillOff) { s.fc = st.fill.hex; s.fa = Math.min(0.6, Math.max(0.1, st.fill.a)); }
      if (st.fillOff) s.fa = 0;
    }
    out.push({ n: ktxt(pm, 'name'), d: plain(ktxt(pm, 'description'), Parser), f: path.join(' / '), s, g: gs });
  }
  return out;
}

export function readKmz(buf, Parser) {
  const u8 = new Uint8Array(buf);
  let text;
  if (u8[0] === 0x50 && u8[1] === 0x4b) {
    const files = unzipSync(u8, { filter: (f) => /\.kml$/i.test(f.name) });
    const names = Object.keys(files);
    if (!names.length) throw new Error('مفيش ملف KML جوه الـ KMZ');
    const nm = names.find((n) => /(^|\/)doc\.kml$/i.test(n)) || names[0];
    text = new TextDecoder('utf-8').decode(files[nm]);
  } else text = new TextDecoder('utf-8').decode(u8);
  return parseKmlText(text, Parser);
}
