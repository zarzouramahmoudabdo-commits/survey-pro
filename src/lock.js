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
#lockscr{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 0%,#33465c 0%,#111a24 55%,#04070b 100%);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;transition:opacity .7s;overflow:hidden;user-select:none;-webkit-user-select:none}
#lockscr.fade{opacity:0}
#lockscr .tsw{width:min(94vw,400px);max-height:100vh;display:flex;flex-direction:column;align-items:center}
#lockscr .tsv{width:100%;height:auto;max-height:34vh;filter:drop-shadow(0 12px 14px #000a)}
#lockscr .tsp{width:100%;margin-top:-6px;background:linear-gradient(#e7e9ec,#b4bac2 60%,#9ca3ac);border:2px solid #5b636c;border-radius:20px 20px 26px 26px;padding:10px 12px 14px;box-shadow:inset 0 2px 0 #fffa,0 16px 40px #000c}
#lockscr .brand{display:flex;justify-content:space-between;align-items:center;direction:ltr;margin:0 4px 6px;color:#2b3138;font-size:11px;font-weight:800;letter-spacing:.6px}
#lockscr .brand b{color:#c2410c;font-size:12px}
#lockscr .bez{background:#14181d;border-radius:10px;padding:7px;box-shadow:inset 0 2px 6px #000}
#lockscr .lcd{height:132px;border-radius:5px;padding:7px 9px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.5;color:#10240f;background:#07090b;direction:ltr;text-align:left;overflow:hidden;transition:background .4s;position:relative}
#lockscr .lcd.on{background:linear-gradient(#b4d1ad,#93b98d);box-shadow:inset 0 0 14px #0005}
#lockscr .lcd .st{display:flex;justify-content:space-between;border-bottom:1px solid #10240f66;margin-bottom:3px;font-size:11px}
#lockscr .bar{height:9px;border:2px solid #10240f;margin-top:4px}#lockscr .bar i{display:block;height:100%;width:0;background:#10240f;transition:width 1.3s linear}
#lockscr .pw{border:2px solid #10240f;background:#cfe3c9;padding:3px 7px;margin:5px 0 3px;font-size:17px;letter-spacing:3px;min-height:28px}
#lockscr .soft{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:7px 4px 8px}
#lockscr .soft span{background:#3b4249;color:#cbd5e1;border-radius:4px;text-align:center;font-size:10px;padding:3px 0;font-weight:800}
#lockscr .pad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
#lockscr .k{height:clamp(36px,6.4vh,48px);border:0;border-radius:9px;background:linear-gradient(#5a636d,#343a41);color:#f1f5f9;font-weight:800;font-size:15px;line-height:1.05;box-shadow:0 3px 0 #1a1e23,inset 0 1px 0 #fff3;padding:0}
#lockscr .k small{display:block;font-size:8.5px;font-weight:600;color:#cbd5e1;letter-spacing:.5px}
#lockscr .k:active{transform:translateY(2px);box-shadow:0 1px 0 #1a1e23}
#lockscr .k.fn{background:linear-gradient(#475569,#273241);font-size:12px}
#lockscr .k.ent{background:linear-gradient(#15803d,#0f5a2a)}
#lockscr .k.pwr{background:linear-gradient(#b91c1c,#7f1313);font-size:19px}
#lockscr .k.glow{animation:lkg 1.4s infinite}
#lockscr .k.on{outline:2px solid #fbbf24}
@keyframes lkg{50%{box-shadow:0 0 16px 4px #ef4444aa,0 3px 0 #1a1e23}}
#lockscr .hint{text-align:center;color:#2b3138;font-size:11px;margin-top:8px;font-weight:700}
#lockscr .shake{animation:sh .35s}@keyframes sh{25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
#lockscr .led{opacity:.15}#lockscr.run .led{animation:ledb 1s infinite}@keyframes ledb{50%{opacity:1}}
#lockscr .scan{transform-box:fill-box;transform-origin:50% 50%}#lockscr.run .scan{animation:scn 3s ease-in-out infinite alternate}@keyframes scn{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
`;
  document.head.appendChild(css);
  const SVG = `<svg class="tsv" viewBox="0 0 360 250" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="lm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f7"/><stop offset=".5" stop-color="#c3c9d0"/><stop offset="1" stop-color="#7d858f"/></linearGradient>
<linearGradient id="ld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#505a66"/><stop offset="1" stop-color="#1a2027"/></linearGradient>
<radialGradient id="ll" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#bae6fd"/><stop offset=".35" stop-color="#2563eb"/><stop offset=".75" stop-color="#0b1b4a"/><stop offset="1" stop-color="#020617"/></radialGradient>
<linearGradient id="lo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#c2410c"/></linearGradient>
</defs>
<path d="M28 240 L332 240 L320 214 L40 214 Z" fill="url(#ld)"/>
<circle cx="50" cy="241" r="9" fill="url(#lm)" stroke="#222" stroke-width="2"/><circle cx="310" cy="241" r="9" fill="url(#lm)" stroke="#222" stroke-width="2"/>
<path d="M44 214 L44 100 Q44 72 72 72 L98 72 L98 214 Z" fill="url(#lm)" stroke="#59616b" stroke-width="2"/>
<path d="M316 214 L316 100 Q316 72 288 72 L262 72 L262 214 Z" fill="url(#lm)" stroke="#59616b" stroke-width="2"/>
<circle cx="180" cy="226" r="11" fill="#d9f99d" stroke="#1f2937" stroke-width="2.5"/><circle cx="183" cy="228" r="3.5" fill="#fff" opacity=".9"/>
<path d="M72 66 C 86 4, 274 4, 288 66" fill="none" stroke="#2f3740" stroke-width="13" stroke-linecap="round"/>
<path d="M78 60 C 92 14, 268 14, 282 60" fill="none" stroke="#6b7580" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
<g class="scan"><g transform="rotate(-5 180 118)">
<rect x="98" y="92" width="164" height="54" rx="20" fill="url(#lm)" stroke="#59616b" stroke-width="2"/>
<rect x="58" y="86" width="48" height="66" rx="13" fill="url(#ld)"/>
<circle cx="66" cy="119" r="27" fill="url(#ll)" stroke="#0b0f14" stroke-width="5"/>
<ellipse cx="58" cy="108" rx="9" ry="5" fill="#fff" opacity=".55"/>
<rect x="262" y="100" width="42" height="38" rx="11" fill="url(#ld)"/>
<circle cx="304" cy="119" r="13" fill="#0b0f14" stroke="#374151" stroke-width="3"/><circle cx="304" cy="119" r="5" fill="#1d4ed8" opacity=".7"/>
<g stroke="#7d858f" stroke-width="2"><path d="M152 98V140M160 98V140M168 98V140M176 98V140M184 98V140M192 98V140M200 98V140"/></g>
<rect x="150" y="80" width="64" height="12" rx="6" fill="url(#ld)"/>
<rect x="110" y="104" width="18" height="30" rx="5" fill="url(#lo)"/>
<text x="226" y="125" font-family="system-ui" font-weight="800" font-size="13" fill="#4b5563">MZ</text>
<circle class="led" cx="114" cy="99" r="3.4" fill="#ef4444"/>
</g></g>
<circle cx="71" cy="172" r="15" fill="url(#ld)" stroke="#111" stroke-width="2"/><circle cx="71" cy="172" r="10" fill="none" stroke="#9ca3af" stroke-width="3" stroke-dasharray="3 3"/>
<circle cx="289" cy="172" r="15" fill="url(#ld)" stroke="#111" stroke-width="2"/><circle cx="289" cy="172" r="10" fill="none" stroke="#9ca3af" stroke-width="3" stroke-dasharray="3 3"/>
</svg>`;
  const KEYS = [['ESC', '', 'fn'], ['ALPHA', '', 'fn'], ['◀', '', 'fn'], ['ENT', '', 'ent'], ['1', '.@', ''], ['2', 'ABC', ''], ['3', 'DEF', ''], ['⏻', '', 'pwr glow'], ['4', 'GHI', ''], ['5', 'JKL', ''], ['6', 'MNO', ''], ['★', '', 'fn'], ['7', 'PQRS', ''], ['8', 'TUV', ''], ['9', 'WXYZ', ''], ['MENU', '', 'fn'], ['*', '', ''], ['0', '_', ''], ['#', '', ''], ['F1', '', 'fn']];
  const LET = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
  const el = document.createElement('div');
  el.id = 'lockscr';
  el.innerHTML = '<div class="tsw">' + SVG + '<div class="tsp"><div class="brand"><b>MAHMOUD ZARZOURA</b><span>MZ-7467 · TOTAL STATION</span></div><div class="bez"><div class="lcd" id="lkLcd"></div></div><div class="soft"><span>F1</span><span>F2</span><span>F3</span><span>F4</span></div><div class="pad">' + KEYS.map(([k, s, c]) => '<button class="k ' + c + '" data-k="' + k + '">' + k + (s ? '<small>' + s + '</small>' : '') + '</button>').join('') + '</div><div class="hint" id="lkHint">اضغط ⏻ لتشغيل الجهاز</div></div></div>';
  document.body.appendChild(el);
  const lcd = document.getElementById('lkLcd'), hint = document.getElementById('lkHint'), pwr = el.querySelector('.pwr');
  let state = 'off', tries = 5, buf = '', alpha = false, pend = null, timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; };
  const flash = () => { lcd.classList.remove('shake'); void lcd.offsetWidth; lcd.classList.add('shake'); };
  function off() { clearAll(); state = 'off'; buf = ''; pend = null; alpha = false; lcd.className = 'lcd'; lcd.innerHTML = ''; el.classList.remove('run'); pwr.classList.add('glow'); hint.textContent = 'اضغط ⏻ لتشغيل الجهاز'; }
  function boot() {
    clearAll(); state = 'boot'; pwr.classList.remove('glow'); lcd.className = 'lcd on'; hint.textContent = 'جاري التشغيل…'; el.classList.add('run');
    lcd.innerHTML = '<div class="st"><span>MZ-7467</span><span>BAT ▮▮▮</span></div><div>MAHMOUD ZARZOURA</div><div>TOTAL STATION</div>';
    later(() => { lcd.innerHTML += '<div>FIRMWARE 1.0.0</div>'; }, 400);
    later(() => { lcd.innerHTML += '<div>SELF CHECK ...</div><div class="bar"><i id="lkBar"></i></div>'; const b = document.getElementById('lkBar'); if (b) setTimeout(() => { b.style.width = '100%'; }, 30); }, 800);
    later(() => { lcd.innerHTML += '<div>COMPENSATOR  OK</div>'; }, 1750);
    later(askPw, 2300);
  }
  function showPw() {
    const shown = '*'.repeat(buf.length) + (pend ? pend.ch : '');
    lcd.innerHTML = '<div class="st"><span>SECURITY</span><span>[' + (alpha ? 'ABC' : '123') + ']</span></div><div>ENTER PASSWORD</div><div class="pw">' + shown + '</div><div id="lkMsg">TRIES: ' + tries + '</div>';
  }
  function askPw() { state = 'pw'; buf = ''; pend = null; alpha = false; hint.textContent = 'ALPHA للحروف · ENT للتأكيد'; showPw(); }
  function commit() { if (pend) { clearTimeout(pend.t); buf += pend.ch; pend = null; } }
  function verify() {
    if (state !== 'pw') return;
    commit();
    if (okPw(buf)) {
      state = 'ok'; clearAll();
      lcd.innerHTML = '<div class="st"><span>SECURITY</span><span>OK</span></div><div>PASSWORD OK</div><div>ACCESS GRANTED</div><div style="margin-top:8px">STARTING ...</div>';
      hint.textContent = 'أهلاً يا محمود';
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
      later(() => { el.classList.add('fade'); }, 900);
      later(() => { el.remove(); }, 1700);
      return;
    }
    tries--; buf = ''; flash();
    if (tries > 0) { showPw(); const m = document.getElementById('lkMsg'); if (m) m.textContent = 'WRONG PASSWORD  TRIES: ' + tries; return; }
    state = 'lock'; let left = 30;
    const tick = () => {
      lcd.innerHTML = '<div class="st"><span>SECURITY</span><span>LOCK</span></div><div>TOO MANY TRIES</div><div>LOCKED ' + left + 's</div>'; hint.textContent = 'استنى ' + left + ' ثانية';
      if (left-- > 0) later(tick, 1000); else { tries = 5; askPw(); }
    };
    tick();
  }
  function press(k) {
    if (state === 'off') { if (k === '⏻') boot(); return; }
    if (k === '⏻') { if (state === 'pw' || state === 'boot') off(); return; }
    if (state !== 'pw') return;
    if (k === 'ENT') { verify(); return; }
    if (k === 'ESC') { buf = ''; if (pend) { clearTimeout(pend.t); pend = null; } showPw(); return; }
    if (k === '◀') { if (pend) { clearTimeout(pend.t); pend = null; } else buf = buf.slice(0, -1); showPw(); return; }
    if (k === 'ALPHA') { commit(); alpha = !alpha; showPw(); return; }
    if (!/^[0-9]$/.test(k) || buf.length >= 24) return;
    if (alpha && LET[k]) {
      const set = LET[k];
      if (pend && pend.key === k) { pend.i = (pend.i + 1) % set.length; pend.ch = set[pend.i]; clearTimeout(pend.t); pend.t = setTimeout(() => { commit(); showPw(); }, 900); }
      else { commit(); pend = { key: k, i: 0, ch: set[0], t: setTimeout(() => { commit(); showPw(); }, 900) }; }
    } else { commit(); buf += k; }
    showPw();
  }
  el.querySelector('.pad').addEventListener('click', (e) => { const b = e.target.closest('.k'); if (b) press(b.dataset.k); });
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lockscr') || state !== 'pw') return;
    if (e.key === 'Enter') verify();
    else if (e.key === 'Backspace') press('◀');
    else if (/^[A-Za-z0-9]$/.test(e.key) && buf.length < 24) { commit(); buf += e.key; showPw(); }
  });
  window.__lockState = () => state;
  off();
}
