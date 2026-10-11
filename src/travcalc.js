const azOf = (dn, de) => { let a = (Math.atan2(de, dn) * 180) / Math.PI; if (a < 0) a += 360; return a; };

// تقفيل ترافرس بطريقة البوديتش (Compass Rule). pts: [{name,n,e,z}] بالترتيب، known: {n,e} إحداثي نقطة التقفيل المعلوم
export function adjustTraverse(pts, known) {
  const n = pts.length - 1;
  if (n < 2) throw new Error('محتاج 3 نقط على الأقل (بداية ونقطة وسطية ونقطة تقفيل)');
  const legs = [];
  let L = 0;
  for (let i = 1; i <= n; i++) {
    const dn = pts[i].n - pts[i - 1].n, de = pts[i].e - pts[i - 1].e, d = Math.hypot(dn, de);
    L += d; legs.push({ d, dn, de });
  }
  if (!(L > 0)) throw new Error('طول الترافرس صفر');
  const eN = pts[n].n - known.n, eE = pts[n].e - known.e, f = Math.hypot(eN, eE);
  let S = 0;
  const rows = pts.map((p, i) => {
    if (i > 0) S += legs[i - 1].d;
    const cN = i === 0 ? 0 : (-eN * S) / L, cE = i === 0 ? 0 : (-eE * S) / L;
    return { name: p.name, id: p.id, z: p.z, d: i === 0 ? null : legs[i - 1].d, az0: i === 0 ? null : azOf(legs[i - 1].dn, legs[i - 1].de), n0: p.n, e0: p.e, cN, cE, n1: p.n + cN, e1: p.e + cE };
  });
  for (let i = 1; i <= n; i++) {
    const dn = rows[i].n1 - rows[i - 1].n1, de = rows[i].e1 - rows[i - 1].e1;
    rows[i].d1 = Math.hypot(dn, de); rows[i].az1 = azOf(dn, de);
  }
  return { rows, L, eN, eE, f, ratio: f > 0 ? L / f : Infinity, errAz: azOf(eN, eE) };
}
export const fmtRatio = (r) => (isFinite(r) ? '1 : ' + Math.round(r).toLocaleString('en-US') : '1 : ∞');
