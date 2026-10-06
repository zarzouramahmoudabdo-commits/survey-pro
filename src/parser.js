const num = (v) => {
  const s = String(v ?? '').trim();
  return s !== '' && !isNaN(s) ? parseFloat(s) : NaN;
};
const looksEasting = (v) => v >= 100000 && v <= 900000;

function pickOrder(raw, pts, header) {
  if (raw === 'NE' || raw === 'EN') return raw;
  if (header === 'NE' || header === 'EN') return header;
  let ne = 0, en = 0;
  for (const p of pts) {
    const eA = looksEasting(p.a), eB = looksEasting(p.b);
    if (eA && !eB) en++;
    else if (eB && !eA) ne++;
  }
  return en > ne ? 'EN' : 'NE';
}

function parseSdrLine(line) {
  const name = line.slice(4, 20).trim();
  let a = num(line.slice(20, 36));
  let b = num(line.slice(36, 52));
  let z = num(line.slice(52, 68));
  let code = line.slice(68).trim();
  if (isNaN(a) || isNaN(b)) {
    const t = line.slice(4).trim().split(/\s+/);
    if (t.length < 3) return null;
    [a, b, z] = [num(t[1]), num(t[2]), num(t[3])];
    code = t.slice(4).join(' ');
    if (isNaN(a) || isNaN(b)) return null;
  }
  return { name, a, b, z: isNaN(z) ? 0 : z, code };
}

export function parsePoints(text, orderPref = 'AUTO') {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const isSdr = /^00NMSDR/.test(lines[0] || '') || lines.some((l) => l.startsWith('08'));
  let header = null;
  const raw = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isSdr) {
      const m = line.match(/Coordinate Format:\s*(N-E|E-N)/i);
      if (m) header = m[1].toUpperCase() === 'N-E' ? 'NE' : 'EN';
      if (!line.startsWith('08')) continue;
      const p = parseSdrLine(line);
      if (p) raw.push(p);
    } else {
      const t = line.trim().split(/[,;\t]+|\s+/);
      if (t.length < 3) continue;
      const a = num(t[1]), b = num(t[2]);
      if (isNaN(a) || isNaN(b)) continue;
      const z = num(t[3]);
      raw.push({ name: t[0], a, b, z: isNaN(z) ? 0 : z, code: t.slice(4).join(' ') });
    }
  }
  const order = pickOrder(orderPref, raw, header);
  return raw.map((p, i) => ({
    id: i + 1,
    name: p.name,
    n: order === 'NE' ? p.a : p.b,
    e: order === 'NE' ? p.b : p.a,
    z: p.z,
    code: p.code,
  }));
}
