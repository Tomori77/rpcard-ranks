// 视图外壳:统一 HTML 骨架 + 公共 CSS + 公共客户端脚本
// render(page, opts) 同步返回完整 HTML 字符串;分发到 views/pages/<page>.js

import { renderHome } from './pages/home.js';
import { renderCard } from './pages/card.js';
import { renderAdmin } from './pages/admin.js';

const FP_CDN = `<script src="https://openfpcdn.io/fingerprintjs/v4"></script>`;

// 公共 CSS(Apple 风格)
const CSS = `
:root {
  --bg:#fbfbfd; --bg-elev:#ffffff;
  --fill:#f5f5f7; --fill-2:#ececf0;
  --border:#d2d2d7;
  --text:#1d1d1f; --text-2:#6e6e73; --text-3:#86868b;
  --accent:#0071e3; --accent-hover:#0077ed; --accent-press:#006edb;
  --ok:#34c759; --err:#ff3b30;
  --rD:#8e8e93; --rC:#0071e3; --rB:#af52de; --rA:#ff9f0a; --rS:#ff3b30;
  --shadow-sm:0 1px 2px rgba(0,0,0,.04), 0 0 0 1px rgba(0,0,0,.03);
  --shadow-md:0 4px 12px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
  --shadow-lg:0 12px 32px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.04);
  --radius:14px; --radius-sm:10px; --radius-pill:980px;
}
* { box-sizing:border-box; }
html, body { margin:0; }
body {
  background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",system-ui,sans-serif;
  line-height:1.47; -webkit-font-smoothing:antialiased; letter-spacing:-0.01em;
}
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
header.top {
  position:sticky; top:0; z-index:50;
  background:rgba(251,251,253,.72);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(0,0,0,.08);
  padding:12px 22px; display:flex; gap:22px; align-items:center;
}
header.top .brand { font-weight:600; font-size:17px; letter-spacing:-0.02em; }
header.top nav { display:flex; gap:18px; flex-wrap:wrap; }
header.top nav a { color:var(--text-2); font-size:14px; font-weight:500; }
header.top nav a:hover { color:var(--text); text-decoration:none; }
header.top nav a.active { color:var(--accent); }
header.top .right { margin-left:auto; color:var(--text-3); font-size:13px; }
main { max-width:1080px; margin:0 auto; padding:32px 22px 96px; }
section { margin:18px 0; }
.panel { background:var(--bg-elev); border-radius:var(--radius); box-shadow:var(--shadow-sm); padding:24px; margin:14px 0; }
.panel h2 { margin:0 0 16px; font-size:22px; font-weight:600; letter-spacing:-0.02em; }
.panel h3 { margin:18px 0 10px; font-size:17px; font-weight:600; }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:12px; border-bottom:1px solid var(--fill-2); font-size:14px; vertical-align:top; }
th { color:var(--text-3); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; }
tr:last-child td { border-bottom:none; }
.btn {
  background:var(--fill); color:var(--text);
  border:1px solid transparent; border-radius:var(--radius-pill);
  padding:8px 18px; cursor:pointer; font-size:14px; font-weight:500;
  transition:background .15s, transform .05s;
}
.btn:hover { background:var(--fill-2); }
.btn:active { transform:scale(.98); }
.btn.primary { background:var(--accent); color:#fff; }
.btn.primary:hover { background:var(--accent-hover); }
.btn.primary:active { background:var(--accent-press); }
.btn.danger { color:var(--err); background:rgba(255,59,48,.08); }
.btn.danger:hover { background:rgba(255,59,48,.14); }
.btn.ghost { background:transparent; color:var(--accent); }
.btn.ghost:hover { background:rgba(0,113,227,.08); }
input, select, textarea {
  background:var(--fill); border:1px solid transparent; border-radius:var(--radius-sm);
  color:var(--text); padding:9px 12px; font-size:14px; font-family:inherit;
  width:100%; transition:border-color .15s, box-shadow .15s;
}
input:focus, select:focus, textarea:focus {
  outline:none; border-color:var(--accent); box-shadow:0 0 0 4px rgba(0,113,227,.16);
  background:var(--bg-elev);
}
input[type=file] { padding:6px; }
textarea { width:100%; min-height:84px; resize:vertical; line-height:1.5; }
label { color:var(--text-2); font-size:13px; display:block; margin:12px 0 6px; font-weight:500; }
.rating {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:22px; height:22px; padding:0 7px;
  border-radius:var(--radius-pill); font-weight:600; font-size:12px; color:#fff;
}
.rating-D { background:var(--rD); }
.rating-C { background:var(--rC); }
.rating-B { background:var(--rB); }
.rating-A { background:var(--rA); }
.rating-S { background:var(--rS); }
.grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
.card {
  background:var(--bg-elev); border-radius:var(--radius); overflow:hidden;
  cursor:pointer; transition:transform .18s ease, box-shadow .18s ease;
  box-shadow:var(--shadow-sm);
}
.card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); }
.card img { width:100%; aspect-ratio:3/4; object-fit:cover; display:block; background:var(--fill); }
.card .body { padding:14px 14px 16px; }
.card .name { font-weight:600; font-size:15px; }
.card .meta { color:var(--text-3); font-size:12px; display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
.seg { display:flex; gap:8px; flex-wrap:wrap; margin:14px 0; }
.seg button {
  background:var(--fill); border:1px solid transparent; color:var(--text-2);
  padding:7px 14px; border-radius:var(--radius-pill); cursor:pointer;
  font-size:13px; font-weight:500; transition:background .15s, color .15s;
}
.seg button:hover { background:var(--fill-2); color:var(--text); }
.seg button.active { background:var(--text); color:#fff; }
.rate-btns { display:flex; gap:8px; margin:10px 0; }
.rate-btns button {
  opacity:.4; padding:6px 14px; border-radius:var(--radius-pill);
  border:1px solid var(--border); background:var(--fill); color:var(--text);
  cursor:pointer; font-weight:500; transition:opacity .15s, transform .05s;
}
.rate-btns button.unlocked { opacity:1; }
.rate-btns button.mine { background:var(--accent); color:#fff; border-color:var(--accent); }
.rate-btns button:active { transform:scale(.96); }
.toast {
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
  background:rgba(29,29,31,.94); color:#fff;
  padding:12px 20px; border-radius:var(--radius-pill);
  font-size:14px; box-shadow:0 12px 28px rgba(0,0,0,.2); z-index:99;
  -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
}
.err { color:var(--err); font-size:13px; }
.ok { color:var(--ok); }
.muted { color:var(--text-3); font-size:13px; }
.hint { background:var(--fill); border-radius:var(--radius-sm); padding:14px 16px; color:var(--text-2); font-size:13px; }
.badge { display:inline-block; background:var(--fill); color:var(--text-2); padding:2px 9px; border-radius:var(--radius-pill); font-size:12px; font-weight:500; }
.badge.on { background:rgba(52,199,89,.14); color:var(--ok); }
.badge.off { background:rgba(255,59,48,.12); color:var(--err); }
.bar { display:flex; height:8px; background:var(--fill); border-radius:var(--radius-pill); overflow:hidden; margin:8px 0; }
.bar span { display:block; height:100%; transition:width .25s; }
footer.bottom { text-align:center; color:var(--text-3); font-size:12px; padding:32px 0; }
canvas.hidden { display:none; }
.row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.split { display:grid; grid-template-columns:240px 1fr; gap:24px; align-items:flex-start; }
@media (max-width: 720px){ .split { grid-template-columns:1fr; } }
code { font-family:"SF Mono",ui-monospace,Menlo,monospace; background:var(--fill); padding:2px 6px; border-radius:6px; font-size:12px; }
.divider { height:1px; background:var(--fill-2); margin:18px 0; }
.linkbtn { background:none; border:none; color:var(--accent); cursor:pointer; font:inherit; padding:0; }
.linkbtn:hover { text-decoration:underline; }
`;

// 公共客户端脚本:指纹/toast/imgUrl/whoami
const COMMON_JS = `
window.FP = (() => { let p=null; return async () => {
  if (p) return p;
  if (window.FingerprintJS) { try { const f = await FingerprintJS.load(); const r = await f.get(); p = r.visitorId; return p; } catch {} }
  const s = [navigator.userAgent, screen.width+'x'+screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, new Date().getTimezoneOffset()].join('|');
  p = 'fp_'+ s; return p;
};})();
window.toast = (msg, ms=2000) => {
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
};
window.imgUrl = (key) => '/api/img?key=' + encodeURIComponent(key);
window.esc = (s) => String(s==null?'':s).replace(/</g,'&lt;');
window.refreshWhoami = async () => {
  const el = document.getElementById('whoami');
  if (!el) return;
  let r;
  try { r = await (await fetch('/api/me', {credentials:'same-origin'})).json(); } catch { r = {ok:false}; }
  if (!r.ok){ el.innerHTML = '<a href="/login" class="muted">登录</a>'; return; }
  if (r.role === 'owner') el.innerHTML = '所有者 · <button class="linkbtn" id="hdrLogout">退出</button>';
  else if (r.role === 'admin') el.innerHTML = '管理员 · <button class="linkbtn" id="hdrLogout">退出</button>';
  else if (r.role === 'user') el.innerHTML = '已登录 · <button class="linkbtn" id="hdrLogout">退出</button>';
  else el.innerHTML = '<a href="/login" class="muted">登录</a>';
  const lg = document.getElementById('hdrLogout');
  if (lg) lg.onclick = async () => { await fetch('/api/logout',{method:'POST'}); await refreshWhoami(); if (location.pathname.startsWith('/admin')) location.href='/'; };
};
refreshWhoami();
`;

function shell(title, body, script = '') {
  return `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · RP角色卡排行</title><link rel="icon" href="data:,">
<style>${CSS}</style>${FP_CDN}</head>
<body><header class="top">
<div class="brand">RP卡榜</div>
<nav>
  <a href="/" data-page="home">排行</a>
</nav>
<div class="right" id="whoami"></div>
</header><main>${body}</main>
<footer class="bottom">Powered by Cloudflare Workers · D1 · R2</footer>
<script>${COMMON_JS}</script>${script}</body></html>`;
}

// 同步分发器:每页返回 { title, body, script }
export function render(page, opts = {}) {
  let p;
  switch (page) {
    case 'home':  p = renderHome(opts); break;
    case 'card':  p = renderCard(opts); break;
    case 'admin': p = renderAdmin(opts); break;
    default:      p = { title: '404', body: '<p>页面不存在</p>', script: '' };
  }
  return shell(p.title, p.body, p.script);
}