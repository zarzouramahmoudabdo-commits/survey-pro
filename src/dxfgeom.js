import DxfParser from 'dxf-parser';

const rgbHex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

export function dxfToPrims(text) {
  const dxf = new DxfParser().parseSync(text);
  const layers = {};
  const lt = (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) || {};
  for (const k of Object.keys(lt)) {
    let c = lt[k].color;
    layers[k] = !c || c === 0 || c === 0x000000 ? '#e2e8f0' : rgbHex(c);
  }
  const blocks = dxf.blocks || {};
  const prims = [];
  const ext = { minE: Infinity, maxE: -Infinity, minN: Infinity, maxN: -Infinity };

  const mk = (tf) => (x, y) => {
    const sx = x * tf.sx, sy = y * tf.sy;
    const c = Math.cos(tf.rot), s = Math.sin(tf.rot);
    return [tf.ty + sx * s + sy * c, tf.tx + sx * c - sy * s]; // [N, E]
  };
  const addExt = (n, e) => {
    if (n < ext.minN) ext.minN = n; if (n > ext.maxN) ext.maxN = n;
    if (e < ext.minE) ext.minE = e; if (e > ext.maxE) ext.maxE = e;
  };
  const pl = (pts, layer, closed, col) => {
    if (pts.length < 2) return;
    if (closed) pts = pts.concat([pts[0]]);
    pts.forEach((p) => addExt(p[0], p[1]));
    prims.push({ t: 'pl', pts, layer, col });
  };

  function walk(ents, tf, depth, parentLayer) {
    const P = mk(tf);
    for (const en of ents || []) {
      const layer = en.layer && en.layer !== '0' ? en.layer : parentLayer || en.layer || '0';
      const col = en.color && en.color !== 0 ? rgbHex(en.color) : null;
      switch (en.type) {
        case 'LINE':
          pl((en.vertices || []).map((v) => P(v.x, v.y)), layer, false, col); break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          pl((en.vertices || []).map((v) => P(v.x, v.y)), layer, !!en.shape, col); break;
        case 'SPLINE': {
          const src = (en.fitPoints && en.fitPoints.length ? en.fitPoints : en.controlPoints) || [];
          pl(src.map((v) => P(v.x, v.y)), layer, false, col); break;
        }
        case 'CIRCLE': {
          const pts = [];
          for (let i = 0; i <= 72; i++) {
            const a = (i / 72) * 2 * Math.PI;
            pts.push(P(en.center.x + en.radius * Math.cos(a), en.center.y + en.radius * Math.sin(a)));
          }
          pl(pts, layer, false, col); break;
        }
        case 'ARC': {
          let a0 = en.startAngle, a1 = en.endAngle;
          while (a1 <= a0) a1 += 2 * Math.PI;
          const steps = Math.max(8, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 72));
          const pts = [];
          for (let i = 0; i <= steps; i++) {
            const a = a0 + ((a1 - a0) * i) / steps;
            pts.push(P(en.center.x + en.radius * Math.cos(a), en.center.y + en.radius * Math.sin(a)));
          }
          pl(pts, layer, false, col); break;
        }
        case 'POINT': {
          const v = en.position; if (!v) break;
          const q = P(v.x, v.y); addExt(q[0], q[1]);
          prims.push({ t: 'pt', pt: q, layer, col }); break;
        }
        case 'TEXT':
        case 'MTEXT': {
          const v = en.startPoint || en.position; if (!v || !en.text) break;
          const q = P(v.x, v.y);
          prims.push({ t: 'tx', pt: q, text: String(en.text).replace(/\\P/g, ' ').replace(/\{?\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, ''), layer, col }); break;
        }
        case 'INSERT': {
          const b = blocks[en.name];
          if (!b || depth >= 3) break;
          const base = b.position || { x: 0, y: 0 };
          const ip = en.position || { x: 0, y: 0 };
          const [pn, pe] = P(ip.x, ip.y);
          const rot = ((en.rotation || 0) * Math.PI) / 180;
          const ntf = {
            tx: pe - 0, ty: pn - 0,
            sx: (en.xScale ?? 1) * tf.sx, sy: (en.yScale ?? 1) * tf.sy,
            rot: rot + tf.rot,
          };
          // translate by -base before scaling: emulate by wrapping child coords
          const shifted = (b.entities || []).map((c) => shiftEnt(c, -base.x, -base.y));
          walk(shifted, ntf, depth + 1, layer);
          break;
        }
        default: break;
      }
    }
  }

  function shiftEnt(en, dx, dy) {
    if (!dx && !dy) return en;
    const c = { ...en };
    const sv = (v) => (v ? { ...v, x: v.x + dx, y: v.y + dy } : v);
    if (c.vertices) c.vertices = c.vertices.map(sv);
    if (c.center) c.center = sv(c.center);
    if (c.position) c.position = sv(c.position);
    if (c.startPoint) c.startPoint = sv(c.startPoint);
    if (c.controlPoints) c.controlPoints = c.controlPoints.map(sv);
    if (c.fitPoints) c.fitPoints = c.fitPoints.map(sv);
    return c;
  }

  walk(dxf.entities, { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 }, 0, null);
  return { prims, layers, ext };
}
