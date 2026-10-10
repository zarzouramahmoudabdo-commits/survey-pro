// بيضيف زرار ✕ كبير في ركن كل قايمة، بيقفلها بنفس زرار الإغلاق بتاعها
const MAP = { epanel: 'eClose', xpanel: 'xClose', apanel: 'aClose', bmform: 'bmX', bmlist: 'bmLX', sypanel: 'syX', kzpanel: 'kzX', bimp: 'bimpX' };
const css = document.createElement('style');
css.textContent = '.pxc{position:absolute;top:4px;left:6px;z-index:5;width:42px;height:42px;border-radius:50%;background:#475569;color:#fff;font-size:20px;line-height:1;border:0;padding:0}';
document.head.appendChild(css);
function attach() {
  for (const pid of Object.keys(MAP)) {
    const p = document.getElementById(pid);
    if (!p || p.querySelector(':scope > .pxc')) continue;
    const b = document.createElement('button');
    b.className = 'pxc'; b.type = 'button'; b.textContent = '✕';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (err) { /* ignore */ }
      const c = document.getElementById(MAP[pid]);
      if (c) c.click(); else p.classList.add('hidden');
    });
    p.appendChild(b);
  }
}
attach();
new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
