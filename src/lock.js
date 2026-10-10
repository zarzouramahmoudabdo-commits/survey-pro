const HASH = '1920aa0a004094';
const KEY = 'sp_unlocked';
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};
const okPw = (s) => cyrb53('MZTS|' + String(s).trim().toUpperCase()) === HASH;
let already = false;
try { already = sessionStorage.getItem(KEY) === '1'; } catch (e) { already = false; }

if (!already) {
  const css = document.createElement('style');
  css.textContent = `
#lockscr{position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 50% 30%,#1c2733,#05080c);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;transition:opacity .6s}
#lockscr.fade{opacity:0}
#lockscr .ts{width:min(92vw,380px);background:linear-gradient(#cfd3d8,#9aa1a9);border-radius:26px;padding:16px 16px 20px;box-shadow:0 20px 60px #000c,inset 0 2px 0 #fff8;border:2px solid #5b636c}
#lockscr .lens{width:78px;height:78px;margin:-4px auto 8px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#6b7f94,#0b1118 70%);border:6px solid #3d444c;box-shadow:inset 0 0 12px #000,0 2px 0 #fff6}
#lockscr .brand{display:flex;justify-content:space-between;font-weight:800;font-size:12px;letter-spacing:.5px;color:#2b3138;margin:0 4px 8px;direction:ltr}
#lockscr .brand b{color:#c2410c}
#lockscr .lcd{height:190px;border-radius:10px;border:4px solid #2b3138;padding:10px;font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.55;color:#10240f;background:#0a0d10;transition:background .3s;overflow:hidden;direction:ltr;text-align:left}
#lockscr .lcd.on{background:linear-gradient(#a7c7a1,#8fb48a);box-shadow:inset 0 0 18px #0004}
#lockscr .bar{height:10px;border:2px solid #10240f;margin-top:6px}#lockscr .bar i{display:block;height:100%;width:0;background:#10240f;transition:width 1.4s linear}
#lockscr input{width:100%;background:#cfe3c9;border:2px solid #10240f;color:#10240f;font:inherit;font-size:18px;letter-spacing:3px;padding:6px 8px;margin:6px 0;outline:none;border-radius:3px}
#lockscr .keys{display:flex;gap:10px;justify-content:center;margin-top:14px}
#lockscr .k{flex:1;padding:12px 0;border-radius:10px;border:0;background:linear-gradient(#4a525b,#2f353c);color:#e5e7eb;font-weight:800;font-size:14px;box-shadow:0 3px 0 #1b1f24}
#lockscr .k:active{transform:translateY(2px);box-shadow:0 1px 0 #1b1f24}
#lockscr .pwr{background:linear-gradient(#b91c1c,#7f1313);flex:0 0 74px;font-size:22px}
#lockscr .pwr.glow{animation:lk 1.4s infinite}
@keyframes lk{50%{box-shadow:0 0 18px 4px #ef4444aa}}
#lockscr .hint{text-align:center;color:#2b3138;font-size:12px;margin-top:10px;font-weight:700}
#lockscr .shake{animation:sh .35s}@keyframes sh{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
`;
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.id = 'lockscr';
  el.innerHTML = '<div class="ts"><div class="lens"></div><div class="brand"><b>MAHMOUD ZARZOURA</b><span>TS-7467</span></div><div class="lcd" id="lkLcd"></div><div class="keys"><button class="k" id="lkEsc">ESC</button><button class="k pwr glow" id="lkPwr">⏻</button><button class="k" id="lkEnt">ENT</button></div><div class="hint" id="lkHint">اضغط ⏻ لتشغيل الجهاز</div></div>';
  document.body.appendChild(el);
  const lcd = document.getElementById('lkLcd'), hint = document.getElementById('lkHint'), pwr = document.getElementById('lkPwr');
  let state = 'off', tries = 5, timers = [], lockT = 0;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; };
  const off = () => { clearAll(); state = 'off'; lcd.className = 'lcd'; lcd.innerHTML = ''; pwr.classList.add('glow'); hint.textContent = 'اضغط ⏻ لتشغيل الجهاز'; };
  function boot() {
    clearAll(); state = 'boot'; pwr.classList.remove('glow'); lcd.className = 'lcd on'; hint.textContent = 'جاري التشغيل…';
    lcd.innerHTML = '<div>MZ TOTAL STATION</div>';
    later(() => { lcd.innerHTML += '<div>FIRMWARE 1.0.0</div>'; }, 350);
    later(() => { lcd.innerHTML += '<div>SELF CHECK ...</div><div class="bar"><i id="lkBar"></i></div>'; const b = document.getElementById('lkBar'); if (b) setTimeout(() => { b.style.width = '100%'; }, 30); }, 700);
    later(() => { lcd.innerHTML += '<div style="margin-top:6px">BATTERY [|||]</div>'; }, 1500);
    later(askPw, 2100);
  }
  function askPw() {
    state = 'pw'; hint.textContent = 'اكتب الباسورد واضغط ENT';
    lcd.innerHTML = '<div>ENTER PASSWORD</div><input id="lkPw" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false"><div id="lkMsg">TRIES: ' + tries + '</div>';
    const i = document.getElementById('lkPw');
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); });
    setTimeout(() => { try { i.focus(); } catch (e) { /* ignore */ } }, 50);
  }
  function verify() {
    if (state !== 'pw') return;
    const i = document.getElementById('lkPw'), m = document.getElementById('lkMsg');
    if (!i) return;
    if (okPw(i.value)) {
      state = 'ok'; clearAll();
      lcd.innerHTML = '<div>PASSWORD OK</div><div>ACCESS GRANTED</div><div style="margin-top:8px">STARTING ...</div>';
      hint.textContent = 'أهلاً يا محمود';
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
      later(() => { el.classList.add('fade'); }, 800);
      later(() => { el.remove(); }, 1500);
      return;
    }
    tries--; i.value = '';
    lcd.classList.remove('shake'); void lcd.offsetWidth; lcd.classList.add('shake');
    if (tries > 0) { m.textContent = 'WRONG PASSWORD  TRIES: ' + tries; return; }
    state = 'lock'; let left = 30;
    const tick = () => {
      lcd.innerHTML = '<div>TOO MANY TRIES</div><div>LOCKED ' + left + 's</div>'; hint.textContent = 'استنى ' + left + ' ثانية';
      if (left-- > 0) lockT = setTimeout(tick, 1000); else { tries = 5; askPw(); }
    };
    tick();
  }
  pwr.onclick = () => { if (state === 'off') boot(); else if (state === 'pw' || state === 'boot') off(); };
  document.getElementById('lkEnt').onclick = verify;
  document.getElementById('lkEsc').onclick = () => { const i = document.getElementById('lkPw'); if (i) { i.value = ''; i.focus(); } };
  window.__lockState = () => state;
  off();
}
