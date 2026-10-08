import { createSync } from './syncCore.js';

const PKEY = 'sp_proj_v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('toast'); if (!t) return; t.textContent = m; t.className = 'show'; setTimeout(() => (t.className = ''), 1800); };
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch (e) { cfg = {}; }
const saveCfg = () => { try { localStorage.setItem(PKEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

let remotePromise = null;
let stageText = '';
let connectAt = Date.now();
function stage(t) { stageText = t; try { render(sync.state()); } catch (e) { /* ignore */ } }
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
async function makeFirebaseRemote() {
  stage('تحميل مكتبة Firebase');
  const { firebaseConfig } = await import('./firebase-config.js');
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await withTimeout(Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]), 30000, 'تعذر تحميل مكتبة Firebase (تأكد من النت)');
  const app = initializeApp(firebaseConfig);
  stage('تسجيل الدخول (Anonymous)');
  const auth = getAuth(app);
  await withTimeout((async () => { if (auth.authStateReady) await auth.authStateReady(); if (!auth.currentUser) await signInAnonymously(auth); })(), 20000, 'انتهت مهلة تسجيل الدخول: تأكد من النت ومن تفعيل Anonymous في Authentication');
  stage('فتح قاعدة البيانات');
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true }); } catch (e) { db = fs.getFirestore(app); }
  stage('الاستماع للثوابت');
  const col = (c) => fs.collection(db, 'projects', c, 'benchmarks');
  return {
    subscribe: (c, cb, er) => fs.onSnapshot(col(c), { includeMetadataChanges: true }, (snap) => cb(snap.docChanges().map((ch) => ({ type: ch.type, id: ch.doc.id, data: ch.doc.data(), pending: ch.doc.metadata.hasPendingWrites })), { fromCache: snap.metadata.fromCache }), er),
    set: (c, id, data) => fs.setDoc(fs.doc(db, 'projects', c, 'benchmarks', id), data),
    del: (c, id) => fs.deleteDoc(fs.doc(db, 'projects', c, 'benchmarks', id)),
  };
}
const getRemote = () => {
  if (!remotePromise) {
    remotePromise = (window.__syncRemoteFactory ? window.__syncRemoteFactory() : makeFirebaseRemote());
    remotePromise.catch(() => { remotePromise = null; });
  }
  return remotePromise;
};
const remote = {
  subscribe(code, cb, er) {
    let un = null, dead = false;
    getRemote().then((r) => { if (!dead) un = r.subscribe(code, cb, er); }).catch(er);
    return () => { dead = true; if (un) un(); };
  },
  set: async (c, id, d) => (await getRemote()).set(c, id, d),
  del: async (c, id) => (await getRemote()).del(c, id),
};

// ---------- الواجهة ----------
const css = document.createElement('style');
css.textContent = `
#sypanel{position:absolute;left:10px;right:10px;bottom:10px;z-index:1100;background:#0f172af7;border:1px solid #a78bfa;border-radius:10px;padding:10px;font-size:13px;direction:rtl}
#sypanel.hidden{display:none}
#sypanel input{width:100%;background:#334155;color:#e2e8f0;border:0;border-radius:8px;padding:9px;font-size:14px;direction:ltr;margin:3px 0}
#syState{margin:6px 0;line-height:1.6}`;
document.head.appendChild(css);
const tools = document.querySelector('#geoView .gtools');
const btn = document.createElement('button');
btn.id = 'syBtn'; btn.title = 'المشروع المشترك'; btn.textContent = '👥';
tools.appendChild(btn);
const panel = document.createElement('div');
panel.id = 'sypanel'; panel.className = 'hidden';
panel.innerHTML = `<b>👥 المشروع المشترك</b>
<input id="syCode" placeholder="كود المشروع (6 حروف/أرقام أو أكتر)" autocapitalize="characters" />
<input id="syName" placeholder="اسمك (يظهر لصحابك)" style="direction:rtl" />
<div class="rowb"><button class="g" id="syJoin">اتصال</button><button id="syGen">🎲 كود جديد</button><button id="syCopy">نسخ الكود</button><button class="s" id="syLeave">خروج</button><button class="s" id="syX">إغلاق</button></div>
<div id="syState"></div>
<div class="rowb"><button id="syUp" class="hidden">⬆ رفع ثوابت الجهاز</button></div>`;
$('geoView').appendChild(panel);

function render(s) {
  let t = '⚪ مش متصل بمشروع';
  if (s.status === 'connecting') t = '🟠 جاري الاتصال…' + (stageText ? '<br>المرحلة: ' + esc(stageText) : '') + (Date.now() - connectAt > 12000 ? '<br>طوّل الوقت؟ جرّب تقفل التابات التانية للتطبيق وتعمل تحديث، وتأكد من النت.' : '');
  if (s.status === 'online') t = `🟢 متصل بالمشروع <b>${esc(s.code)}</b><br>${s.synced} ثابتة متزامنة` + (s.fromCache ? '<br>⚠ مفيش اتصال بالسيرفر دلوقتي (شغال من التخزين المحلي)' : '') + (navigator.onLine === false ? '<br>⏳ أوفلاين: هيتزامن لما النت يرجع' : '');
  if (s.status === 'error') {
    const hint = /permission|insufficient/i.test(s.err) ? '<br>راجع قواعد الأمان (Rules)' : /auth|admin-restricted|operation-not-allowed/i.test(s.err) ? '<br>فعّل Anonymous في Authentication' : '';
    t = `🔴 خطأ: ${esc(s.err)}${hint}`;
  }
  $('syState').innerHTML = t;
  btn.classList.toggle('on', s.status === 'online');
  const up = $('syUp');
  up.classList.toggle('hidden', !(s.status === 'online' && s.held > 0));
  up.textContent = `⬆ رفع ${s.held} ثابتة من الجهاز للمشروع`;
}
const sync = createSync({
  get: () => (window.__bmGet ? window.__bmGet() : []),
  set: (a) => { if (window.__bmSet) window.__bmSet(a); },
  remote, me: () => String(cfg.name || '').slice(0, 30), onState: render,
});
window.__bmChanged = (arr) => sync.onLocalChange(arr);
window.addEventListener('online', () => render(sync.state()));
window.addEventListener('offline', () => render(sync.state()));

const OK = /^[A-Z0-9_-]{6,40}$/;
function genCode() {
  const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(8);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 4e9); });
  return 'SP-' + [...a].map((x) => al[x % al.length]).join('');
}
function connect() {
  const code = $('syCode').value.trim().toUpperCase();
  if (!OK.test(code)) { toast('الكود لازم 6 حروف/أرقام أو أكتر (حروف إنجليزي وأرقام و - _)'); return; }
  cfg.code = code; cfg.name = $('syName').value.trim().slice(0, 30); saveCfg();
  $('syCode').value = code;
  connectAt = Date.now();
  sync.join(code);
}
btn.onclick = () => { panel.classList.toggle('hidden'); };
$('syX').onclick = () => panel.classList.add('hidden');
$('syJoin').onclick = connect;
$('syGen').onclick = () => { $('syCode').value = genCode(); toast('اضغط اتصال، وابعت الكود لصحابك'); };
$('syCopy').onclick = async () => { try { await navigator.clipboard.writeText($('syCode').value.trim()); toast('تم نسخ الكود'); } catch (e) { toast('فشل النسخ'); } };
$('syLeave').onclick = () => { sync.leave(); cfg.code = ''; saveCfg(); toast('خرجت من المشروع (الثوابت لسه عندك على الجهاز)'); };
$('syName').onchange = () => { cfg.name = $('syName').value.trim().slice(0, 30); saveCfg(); };
$('syUp').onclick = () => { const n = sync.uploadHeld(); toast('اترفع ' + n + ' ثابتة'); };
$('syCode').value = cfg.code || ''; $('syName').value = cfg.name || '';
render(sync.state());
if (cfg.code && OK.test(cfg.code)) sync.join(cfg.code);
setInterval(() => { const st = sync.state(); if (st.status === 'connecting') render(st); }, 2000);
