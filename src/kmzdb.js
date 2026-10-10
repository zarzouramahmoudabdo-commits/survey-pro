const DB = 'sp_kmz';
function open() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 2);
      r.onupgradeneeded = (e) => {
        const d = r.result;
        if (!d.objectStoreNames.contains('layers')) d.createObjectStore('layers', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('feat')) d.createObjectStore('feat');
        if (e.oldVersion === 1) {
          const ls = r.transaction.objectStore('layers'), fs = r.transaction.objectStore('feat');
          const cur = ls.openCursor();
          cur.onsuccess = () => {
            const c = cur.result; if (!c) return;
            const rec = c.value;
            if (rec.features) { fs.put(rec.features, rec.id); const m = { ...rec }; delete m.features; c.update(m); }
            c.continue();
          };
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
let dbp = null;
const db = () => dbp || (dbp = open());
async function run(names, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(names, mode);
    const out = fn(...[].concat(names).map((n) => t.objectStore(n)));
    t.oncomplete = () => res(out && out.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const listMeta = () => run('layers', 'readonly', (s) => s.getAll());
export const getFeat = (id) => run('feat', 'readonly', (s) => s.get(id));
export const putMeta = (m) => run('layers', 'readwrite', (s) => s.put(m));
export const putAll = (m, feats) => run(['layers', 'feat'], 'readwrite', (ls, fs) => { fs.put(feats, m.id); return ls.put(m); });
export const delRec = (id) => run(['layers', 'feat'], 'readwrite', (ls, fs) => { fs.delete(id); return ls.delete(id); });
