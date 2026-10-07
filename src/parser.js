const num = (v) => {
  const s = String(v ?? '').trim();
  return s !== '' && !isNaN(s) ? parseFloat(s) : NaN;
};
const looksEasting = (v) => v >= 100000 && v <= 900000;
const decOf = (s) => {
  const m = String(s).trim().match(/\.(\d+)/);
  return m ? m[1].length : 0;
};

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
  const fa = line.slice(20, 36), fb = line.slice(36, 52);
  let a = num(fa), b = num(fb);
  let z = num(line.slice(52, 68));
  let code = line.slice(68).trim();
  let dec = Math.max(decOf(fa), decOf(fb));
  if (isNaN(a) || isNaN(b)) {
    const t = line.slice(4).trim().split(/\s+/);
    if (t.length < 3) return null;
    [a, b, z] = [num(t[1]), num(t[2]), num(t[3])];
    code = t.slice(4).join(' ');
    dec = Math.max(decOf(t[1]), decOf(t[2]));
    if (isNaN(a) || isNaN(b)) return null;
  }
  return { name, a, b, z: isNaN(z) ? 0 : z, code, dec };
}

export function parsePoints(text, orderPref = 'AUTO') {
  const clean = text.replace(/^\uFEFF/, '');
  const eol = clean.includes('\r\n') ? '\r\n' : '\n';
  const lines = clean.split(/\r?\n/);
  const isSdr = /^00NMSDR/.test(lines[0] || '') || lines.some((l) => l.startsWith('08'));
  let header = null, delim = ',';
  const raw = [];
  lines.forEach((line, li) => {
    if (!line.trim()) return;
    if (isSdr) {
      const m = line.match(/Coordinate Format:\s*(N-E|E-N)/i);
      if (m) header = m[1].toUpperCase() === 'N-E' ? 'NE' : 'EN';
      if (!line.startsWith('08')) return;
      const p = parseSdrLine(line);
      if (p) raw.push({ ...p, li });
    } else {
      const t = line.trim().split(/[,;\t]+|\s+/);
      if (t.length < 3) return;
      const a = num(t[1]), b = num(t[2]);
      if (isNaN(a) || isNaN(b)) return;
      const z = num(t[3]);
      if (!raw.length) delim = line.includes(',') ? ',' : line.includes(';') ? ';' : line.includes('\t') ? '\t' : ' ';
      raw.push({ name: t[0], a, b, z: isNaN(z) ? 0 : z, code: t.slice(4).join(' '), dec: Math.max(decOf(t[1]), decOf(t[2])), li });
    }
  });
  const order = pickOrder(orderPref, raw, header);
  const pts = raw.map((p, i) => {
    const n = order === 'NE' ? p.a : p.b;
    const e = order === 'NE' ? p.b : p.a;
    return { id: i + 1, name: p.name, n, e, z: p.z, code: p.code, li: p.li, o: { name: p.name, n, e, z: p.z, code: p.code } };
  });
  globalThis.__srcMeta = {
    format: isSdr ? 'sdr' : 'delim',
    order, eol, delim,
    dec: raw.length ? Math.max(...raw.map((r) => r.dec)) : 3,
    lines,
    dl: raw.map((r) => r.li),
  };
  return pts;
}
