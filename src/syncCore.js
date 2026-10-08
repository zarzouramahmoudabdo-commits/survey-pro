export function createSync({ get, set, remote, me = () => '', now = Date.now, onState = () => {} }) {
  let code = null, unsub = null, status = 'off', err = '', initialDone = false, fromCache = false;
  const known = new Map();
  const held = new Set();
  const sig = (b) => [b.name, b.desc || '', b.n, b.e, b.z ?? ''].join('|');
  const payload = (b) => ({ name: b.name, desc: b.desc || '', n: b.n, e: b.e, z: b.z ?? null, by: me() || '', at: now() });
  const emit = () => onState({ status, code, err, synced: known.size, held: held.size, fromCache });
  const fail = (e) => { status = 'error'; err = String((e && e.message) || e); emit(); };

  function apply(changes, meta) {
    fromCache = !!(meta && meta.fromCache);
    const local = get().slice();
    let dirty = false;
    for (const ch of changes) {
      const id = ch.id;
      if (ch.type === 'removed') {
        known.delete(id); held.delete(id);
        const i = local.findIndex((x) => x.id === id);
        if (i >= 0) { local.splice(i, 1); dirty = true; }
        continue;
      }
      const d = ch.data || {};
      const rec = { id, name: d.name, desc: d.desc || '', n: d.n, e: d.e, z: d.z ?? null, by: d.by || '' };
      known.set(id, sig(rec)); held.delete(id);
      const i = local.findIndex((x) => x.id === id);
      if (i < 0) { local.push(rec); dirty = true; }
      else if (sig(local[i]) !== sig(rec) || (local[i].by || '') !== rec.by) { local[i] = { ...local[i], ...rec }; dirty = true; }
    }
    if (!initialDone) {
      initialDone = true; status = 'online'; err = '';
      for (const b of local) if (!known.has(b.id)) held.add(b.id);
    }
    if (dirty) set(local);
    emit();
  }

  function join(c) {
    leave();
    code = c; status = 'connecting'; err = ''; initialDone = false; emit();
    try { unsub = remote.subscribe(c, apply, fail); } catch (e) { fail(e); }
  }
  function leave() {
    if (unsub) { try { unsub(); } catch (e) { /* ignore */ } }
    unsub = null; code = null; status = 'off'; err = '';
    known.clear(); held.clear(); initialDone = false; emit();
  }
  function onLocalChange(arr) {
    if (!code || !initialDone) return;
    const ids = new Set();
    for (const b of arr) {
      ids.add(b.id);
      if (held.has(b.id)) continue;
      const s = sig(b);
      if (known.get(b.id) === s) continue;
      known.set(b.id, s);
      remote.set(code, b.id, payload(b)).catch(fail);
    }
    for (const id of [...known.keys()]) {
      if (!ids.has(id)) { known.delete(id); remote.del(code, id).catch(fail); }
    }
    for (const id of [...held]) if (!ids.has(id)) held.delete(id);
    emit();
  }
  function uploadHeld() {
    if (!code || !initialDone) return 0;
    const arr = get();
    let n = 0;
    for (const id of [...held]) {
      const b = arr.find((x) => x.id === id);
      if (!b) continue;
      known.set(id, sig(b));
      remote.set(code, id, payload(b)).catch(fail);
      n++;
    }
    held.clear(); emit();
    return n;
  }
  return { join, leave, onLocalChange, uploadHeld, state: () => ({ status, code, err, synced: known.size, held: held.size, fromCache }) };
}
