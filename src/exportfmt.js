const pad = (s, n) => String(s).padStart(n, ' ');
const padE = (s, n) => String(s).padEnd(n, ' ');
const f3 = (v) => Number(v).toFixed(3);
const pair = (p, order) => (order === 'EN' ? [p.e, p.n] : [p.n, p.e]);

export function toCSV(pts, order = 'NE') {
  return pts.map((p) => {
    const [a, b] = pair(p, order);
    return [p.name, f3(a), f3(b), f3(p.z), p.code || ''].join(',');
  }).join('\n') + '\n';
}

export function toSDR(pts, order = 'NE') {
  const hdr = order === 'EN' ? 'E-N' : 'N-E';
  const lines = ['00NMSDR33 Survey Pro', `13NMCoordinate Format: ${hdr}`];
  for (const p of pts) {
    const [a, b] = pair(p, order);
    lines.push('08KI' + pad(String(p.name).slice(0, 16), 16) + padE(f3(a), 16) + padE(f3(b), 16) + padE(f3(p.z), 16) + (p.code || ''));
  }
  return lines.join('\r\n') + '\r\n';
}

export function toDXF(pts, h = 1, link = true) {
  const g = [];
  const add = (...a) => a.forEach((x) => g.push(String(x)));
  add(0, 'SECTION', 2, 'ENTITIES');
  for (const p of pts) {
    add(0, 'POINT', 8, 'PTS', 10, f3(p.e), 20, f3(p.n), 30, f3(p.z));
    add(0, 'TEXT', 8, 'PTNUM', 10, f3(p.e + h * 0.4), 20, f3(p.n + h * 0.4), 30, 0, 40, h, 1, String(p.name));
  }
  if (link) {
    for (let i = 1; i < pts.length; i++) {
      add(0, 'LINE', 8, 'PTLINE', 10, f3(pts[i - 1].e), 20, f3(pts[i - 1].n), 30, 0, 11, f3(pts[i].e), 21, f3(pts[i].n), 31, 0);
    }
  }
  add(0, 'ENDSEC', 0, 'EOF');
  return g.join('\n') + '\n';
}
