// 视图层:HTML 模板(内联 CSS/JS,引用 FingerprintJS CDN)
// render 同步返回字符串;动态页面只放容器,数据由 client fetch 渲染

const FP_CDN = `<script src="https://openfpcdn.io/fingerprintjs/v4"></script>`;

const CSS = `
:root { --bg:#0f1216; --panel:#161b22; --panel2:#1c2330; --border:#2a3340; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --s:#ff7b72; --a:#ffa657; --b:#d2a8ff; --c:#58a6ff; --d:#8b949e; --ok:#3fb950; --err:#f85149; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; line-height:1.6; }
a { color:var(--accent); text-decoration:none; }
header.top { position:sticky; top:0; z-index:50; background:rgba(15,18,22,.86); backdrop-filter:blur(10px); border-bottom:1px solid var(--border); padding:12px 18px; display:flex; gap:18px; align-items:center; }
header.top .brand { font-weight:700; font-size:18px; }
header.top nav { display:flex; gap:14px; flex-wrap:wrap; }
header.top nav a { color:var(--muted); }
header.top nav a:hover, header.top nav a.active { color:var(--text); }
header.top .right { margin-left:auto; color:var(--muted); font-size:13px; }
main { max-width:1100px; margin:0 auto; padding:24px 18px 80px; }
.panel { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:18px; margin:14px 0; }
.panel h2 { margin:0 0 14px; }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); font-size:14px; vertical-align:top; }
th { color:var(--muted); font-weight:600; }
.btn { background:var(--panel2); border:1px solid var(--border); color:var(--text); padding:7px 14px; border-radius:7px; cursor:pointer; font-size:14px; }
.btn:hover { border-color:var(--accent); }
.btn.primary { background:var(--accent); color:#000; border-color:var(--accent); }
.btn.danger { color:var(--err); border-color:#5c2a2a; }
input, select, textarea { background:var(--panel2); border:1px solid var(--border); color:var(--text); padding:7px 10px; border-radius:7px; font-size:14px; }
input[type=file] { padding:3px; }
textarea { width:100%; min-height:80px; resize:vertical; }
label { color:var(--muted); font-size:13px; display:block; margin:8px 0 4px; }
.rating { display:inline-block; padding:2px 9px; border-radius:6px; font-weight:700; font-size:13px; }
.rating-D { background:var(--d); color:#000; } .rating-C { background:var(--c); color:#000; }
.rating-B { background:var(--b); color:#000; } .rating-A { background:var(--a); color:#000; }
.rating-S { background:var(--s); color:#000; }
.grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
.card { background:var(--panel); border:1px solid var(--border); border-radius:10px; overflow:hidden; cursor:pointer; transition:transform .12s, border-color .12s; }
.card:hover { transform:translateY(-2px); border-color:var(--accent); }
.card img { width:100%; aspect-ratio:3/4; object-fit:cover; display:block; background:#111; }
.card .body { padding:10px; }
.card .name { font-weight:600; }
.card .meta { color:var(--muted); font-size:12px; display:flex; justify-content:space-between; margin-top:6px; }
.seg { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }
.seg button { background:var(--panel2); border:1px solid var(--border); color:var(--muted); padding:6px 12px; border-radius:7px; cursor:pointer; }
.seg button.active { color:var(--text); border-color:var(--accent); }
.rate-btns { display:flex; gap:6px; margin:8px 0; }
.rate-btns button { opacity:.35; padding:5px 12px; border-radius:6px; border:1px solid var(--border); background:var(--panel2); color:var(--text); cursor:pointer; }
.rate-btns button.unlocked { opacity:1; }
.rate-btns button.mine { outline:2px solid var(--accent); }
.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--panel2); border:1px solid var(--border); padding:10px 18px; border-radius:8px; box-shadow:0 6px 22px rgba(0,0,0,.4); z-index:99; }
.err { color:var(--err); font-size:13px; }
.ok { color:var(--ok); }
.bar { display:flex; height:10px; background:var(--panel2); border-radius:5px; overflow:hidden; margin:6px 0; }
.bar span { display:block; height:100%; }
footer.bottom { text-align:center; color:var(--muted); font-size:12px; padding:30px 0; }
canvas.hidden { display:none; }
.row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.muted { color:var(--muted); }
`;

function shell(title, body, extraHead = '', script = '') {
  return `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · RP角色卡排行</title><link rel="icon" href="data:,">
<style>${CSS}</style>${extraHead}</head>
<body><header class="top">
<div class="brand">RP卡榜</div>
<nav>
  <a href="/" data-page="home">排行</a>
  <a href="/register">注册</a>
  <a href="/workspace" data-page="workspace">工作台</a>
  <a href="/admin" data-page="admin">所有者后台</a>
</nav>
<div class="right" id="whoami"></div>
</header><main>${body}</main>
<footer class="bottom">Powered by Cloudflare Workers · D1 · R2</footer>
<script>
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
(async () => {
  const r = await (await fetch('/api/me')).json().catch(()=>({ok:false}));
  const el = document.getElementById('whoami');
  if (r.ok && r.role && r.role!=='user') el.textContent = '当前:'+r.role;
  else if (r.ok && r.role==='user') el.textContent = '普通用户';
})();
</script>${script}</body></html>`;
}

export function render(page, opts = {}) {
  switch (page) {
    case 'home':        return shell('排行榜',     homeHtml(),        FP_CDN, homeScript());
    case 'card':        return shell('卡片详情',   cardHtml(opts.id),  FP_CDN, cardScript(opts.id));
    case 'register':    return shell('注册',       registerHtml(opts.presetCode), FP_CDN, registerScript());
    case 'login':      return shell('登录',       loginHtml(opts.next),           FP_CDN, loginScript(opts.next));
    case 'workspace':  return shell('工作台',     '<div id="app"></div>',          FP_CDN, workspaceScript());
    case 'admin':      return shell('所有者后台', '<div id="app"></div>',          FP_CDN, adminScript());
    case 'admin_login':return shell('后台登录',   adminLoginHtml(),                FP_CDN, adminLoginScript());
    default:           return shell('404', '<p>页面不存在</p>');
  }
}

// ===== 首页 =====
function homeHtml() {
  return `<section class="panel">
    <h2>角色卡排行榜</h2>
    <div class="seg" id="boards"></div>
    <div class="seg" id="sorts">
      <button data-sort="rating" class="active">官方评级优先</button>
      <button data-sort="likes">点赞数</button>
      <button data-sort="median">用户评级</button>
    </div>
    <p class="err" id="err"></p>
    <div class="grid" id="grid"></div>
  </section>`;
}
function homeScript() {
  return `<script>
let curBoard=null, curSort='rating';
(async () => {
  const bs = await (await fetch('/api/boards')).json();
  const bd = document.getElementById('boards');
  bs.data.forEach(b => {
    const btn=document.createElement('button'); btn.textContent=b.name; btn.dataset.id=b.id;
    btn.onclick = () => { curBoard=b.id; [...bd.children].forEach(x=>x.classList.toggle('active',x===btn)); load(); };
    bd.appendChild(btn);
  });
  if (bs.data.length) { curBoard=bs.data[0].id; bd.firstChild.classList.add('active'); }
  document.querySelectorAll('#sorts button').forEach(b=> b.onclick=()=>{ curSort=b.dataset.sort; [...document.querySelectorAll('#sorts button')].forEach(x=>x.classList.toggle('active',x===b)); load(); });
  load(); setInterval(load, 15000);
})();
async function load() {
  if (!curBoard) return;
  const r = await (await fetch('/api/ranking?board='+curBoard+'&sort='+curSort)).json();
  if (!r.ok) { document.getElementById('err').textContent=r.err||'加载失败'; return; }
  document.getElementById('err').textContent='';
  const grid=document.getElementById('grid'); grid.innerHTML='';
  if (!r.data.length){ grid.innerHTML='<p class="muted">暂无卡片</p>'; return; }
  r.data.forEach(c=>{
    const el=document.createElement('div'); el.className='card';
    el.onclick=()=>location.href='/card/'+c.id;
    el.innerHTML='<img src="'+imgUrl(c.image_key)+'" loading="lazy" alt="'+c.name.replace(/"/g,'')+'">'+
      '<div class="body"><div class="name">'+c.name.replace(/</g,'&lt;')+'</div>'+
      '<div class="meta"><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span><span>♥ '+c.like_count+'</span></div></div>';
    grid.appendChild(el);
  });
}
</script>`;
}

// ===== 卡片详情 =====
function cardHtml(id) {
  return `<section class="panel" id="detail"><p class="muted">加载中...</p></section>`;
}
function cardScript(id) {
  return `<script>
let D=null, myFp=null;
(async () => {
  myFp = await window.FP();
  await load();
  setInterval(load, 15000);
})();
async function load() {
  const r = await (await fetch('/api/cards/${id}?fp='+encodeURIComponent(myFp))).json();
  if (!r.ok) { document.getElementById('detail').innerHTML='<p class="err">'+(r.err||'未找到')+'</p>'; return; }
  D = r.data;
  const c = D.card;
  const dist = { D:0,C:0,B:0,A:0,S:0 };
  D.dist.forEach(d => dist[d.rating]=d.n);
  const total = dist.D+dist.C+dist.B+dist.A+dist.S;
  const colors = { D:'#8b949e',C:'#58a6ff',B:'#d2a8ff',A:'#ffa657',S:'#ff7b72' };
  let bar = '<div class="bar">';
  ['D','C','B','A','S'].forEach(rk => { if (total>0){ const p=dist[rk]/total; bar+='<span style="width:'+(p*100)+'%;background:'+colors[rk]+'" title="'+rk+':'+dist[rk]+'"></span>'; } });
  bar += '</div><div class="muted" style="font-size:12px;">用户评级分布: S'+dist.S+' A'+dist.A+' B'+dist.B+' C'+dist.C+' D'+dist.D+'</div>';

  let reviews = '';
  if (D.reviews.length) {
    reviews = '<h3>评价</h3>';
    D.reviews.forEach(rv => {
      const who = rv.author_role==='owner'?'所有者':rv.author_role==='admin'?'管理员':'用户';
      reviews += '<div class="panel" style="background:var(--panel2);border-color:var(--border);"><div class="muted" style="font-size:12px;">'+who+' · '+rv.created_at+'</div><div style="margin-top:6px;white-space:pre-wrap;">'+rv.content.replace(/</g,'&lt;')+'</div></div>';
    });
  }

  const liked = D.mine.liked;
  const myRate = D.mine.rating;
  let rateBtns = '<div class="rate-btns" id="rateBtns">';
  ['D','C','B','A','S'].forEach(rk => {
    const cls = liked ? 'unlocked' : '';
    const mine = myRate===rk ? 'mine':'';
    rateBtns += '<button class="'+cls+' '+mine+'" data-r="'+rk+'">'+rk+'</button>';
  });
  rateBtns += '</div><div class="muted" style="font-size:12px;">'+(liked?'已点赞,可点选你认为的评级(仅作参考)':'点击下方 ♥ 点赞后才可评级')+'</div>';

  document.getElementById('detail').innerHTML =
    '<div class="row" style="align-items:flex-start;">'+
      '<img src="'+imgUrl(c.image_key)+'" style="width:240px;border-radius:10px;border:1px solid var(--border);">'+
      '<div style="flex:1;min-width:240px;">'+
        '<h2>'+c.name.replace(/</g,'&lt;')+'</h2>'+
        '<p><span class="rating rating-'+c.owner_rating+'">官方 '+c.owner_rating+'</span> <span class="muted">♥ '+D.likeCount+' 赞</span></p>'+
        '<div style="margin:14px 0;">'+
          '<button class="btn '+(liked?'':'primary')+'" id="likeBtn">♥ '+(liked?'已点赞':'点赞')+'</button>'+
        '</div>'+
        '<div style="margin:14px 0;"><div class="muted" style="font-size:13px;">用户认可的评级(仅参考)</div>'+bar+'</div>'+
        rateBtns+
      '</div>'+
    '</div>'+reviews;

  document.getElementById('likeBtn').onclick = async () => {
    const r = await (await fetch('/api/cards/${id}/like', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:myFp})})).json();
    if (r.ok){ toast('已点赞'); load(); } else toast(r.err||'失败');
  };
  document.querySelectorAll('#rateBtns button').forEach(b => b.onclick = async () => {
    if (!liked){ toast('请先点赞'); return; }
    const r = await (await fetch('/api/cards/${id}/rate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:myFp,rating:b.dataset.r})})).json();
    if (r.ok){ toast('已评级 '+b.dataset.r); load(); } else toast(r.err||'失败');
  });
}
</script>`;
}

// ===== 注册 =====
function registerHtml(presetCode) {
  return `<section class="panel">
  <h2>用邀请码注册</h2>
  <label>邀请码</label>
  <input id="code" value="${(presetCode||'').replace(/"/g,'&quot;')}" placeholder="输入邀请码">
  <p class="err" id="err"></p>
  <button class="btn primary" id="go">激活</button>
  </section>`;
}
function registerScript() {
  return `<script>
document.getElementById('go').onclick = async () => {
  const code = document.getElementById('code').value.trim();
  const fp = await window.FP();
  const r = await (await fetch('/api/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,fingerprint:fp})})).json();
  if (r.ok){ toast('注册成功,角色: '+r.role); setTimeout(()=>location.href = (r.role==='admin'||r.role==='owner')?'/workspace':'/', 800); }
  else document.getElementById('err').textContent = r.err;
};
</script>`;
}

// ===== 登录 =====
function loginHtml(next) {
  return `<section class="panel">
  <h2>指纹登录</h2>
  <p class="muted">使用浏览器指纹登录已注册账号(管理员/所有者可用)。</p>
  <p class="err" id="err"></p>
  <button class="btn primary" id="go">用指纹登录</button>
  </section>`;
}
function loginScript(next) {
  return `<script>
document.getElementById('go').onclick = async () => {
  const fp = await window.FP();
  const r = await (await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:fp})})).json();
  if (r.ok) location.href = "${(next||'/').replace(/"/g,'')}";
  else document.getElementById('err').textContent = r.err;
};
</script>`;
}

// ===== 所有者后台登录 =====
function adminLoginHtml() {
  return `<section class="panel">
  <h2>所有者后台 · 登录</h2>
  <label>密码</label>
  <input id="pw" type="password" autocomplete="current-password">
  <p class="err" id="err"></p>
  <button class="btn primary" id="go">登录</button>
  </section>`;
}
function adminLoginScript() {
  return `<script>
document.getElementById('go').onclick = async () => {
  const pw = document.getElementById('pw').value;
  const r = await (await fetch('/api/admin/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})).json();
  if (r.ok) location.href='/admin';
  else document.getElementById('err').textContent = r.err;
};
</script>`;
}

// ===== 工作台(管理员/所有者) =====
function workspaceScript() {
  return `<script>
let boards=[], myCards=[];
(async () => { await Promise.all([loadBoards(), loadMy()]); })();
async function loadBoards() {
  const r = await (await fetch('/api/boards')).json(); boards=r.data||[];
  render();
}
async function loadMy() {
  const r = await (await fetch('/api/workspace/me')).json();
  if (!r.ok){ document.getElementById('app').innerHTML='<p class="err">'+r.err+'。请<p><a href="/login">登录</a> 或 <a href="/register">注册</a>。</p>'; return; }
  myCards=r.data.cards||[]; render();
}
function esc(s){return String(s).replace(/</g,'&lt;');}
function render() {
  const bidOpts = boards.map(b=>'<option value="'+b.id+'">'+b.name+'</option>').join('');
  document.getElementById('app').innerHTML =
  '<section class="panel"><h2>发布新卡片</h2>'+
    '<label>名称</label><input id="nName" placeholder="角色卡名称">'+
    '<label>官方评级</label><select id="nRating">'+['D','C','B','A','S'].map(x=>'<option>'+x+'</option>').join('')+'</select>'+
    '<label>榜单</label><select id="nBoard">'+bidOpts+'</select>'+
    '<label>图片</label><input id="nFile" type="file" accept="image/*">'+
    '<canvas class="hidden" id="cv"></canvas>'+
    '<p class="muted" style="font-size:12px;">上传前自动压缩到 1080px / 质量 85</p>'+
    '<p class="err" id="nErr"></p>'+
    '<button class="btn primary" id="nGo">上传并发布</button>'+
  '</section>'+
  '<section class="panel"><h2>我的卡片</h2>'+
    '<table><tr><th>ID</th><th>图</th><th>名称</th><th>评级</th><th>赞</th><th>我的评价</th><th>操作</th></tr>'+
    myCards.map(c=>{
      const rev = c.my_review||'';
      return '<tr><td>'+c.id+'</td><td><img src="'+imgUrl(c.image_key)+'" style="width:48px;height:64px;object-fit:cover;border-radius:4px;"></td>'+
        '<td id="n_'+c.id+'">'+esc(c.name)+'</td><td><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span></td>'+
        '<td>'+c.like_count+'</td><td><textarea id="rv_'+c.id+'" placeholder="你的评价">'+esc(rev)+'</textarea></td>'+
        '<td><button class="btn" data-act="edit" data-id="'+c.id+'">改</button> <button class="btn" data-act="rev" data-id="'+c.id+'">存评价</button></td></tr>';
    }).join('')+
    '</table></section>';

  document.getElementById('nGo').onclick = onPublish;
  document.querySelectorAll('button[data-act]').forEach(b => b.onclick = ()=>{
    if (b.dataset.act==='edit') editCard(b.dataset.id);
    if (b.dataset.act==='rev') saveReview(b.dataset.id);
  });
}
async function compress(file) {
  const img = await createImageBitmap(file);
  const max = 1080;
  let w=img.width, h=img.height;
  if (w>max || h>max){ const k=Math.min(max/w, max/h); w=Math.round(w*k); h=Math.round(h*k); }
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  cv.getContext('2d').drawImage(img,0,0,w,h);
  const blob = await new Promise(res=>cv.toBlob(res,'image/jpeg',0.85));
  return new File([blob], 'card.jpg', {type:'image/jpeg'});
}
async function onPublish() {
  const name = document.getElementById('nName').value.trim();
  const rating = document.getElementById('nRating').value;
  const board = parseInt(document.getElementById('nBoard').value,10);
  const fInput = document.getElementById('nFile');
  if (!name || !fInput.files.length){ document.getElementById('nErr').textContent='名称和图片必填'; return; }
  document.getElementById('nErr').textContent='';
  const comp = await compress(fInput.files[0]);
  const fd = new FormData(); fd.append('file', comp);
  const up = await (await fetch('/api/upload',{method:'POST',body:fd})).json();
  if (!up.ok){ document.getElementById('nErr').textContent='图片上传失败: '+up.err; return; }
  const r = await (await fetch('/api/workspace/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,image_key:up.key,owner_rating:rating,board_id:board})})).json();
  if (r.ok){ toast('已发布'); loadMy(); } else document.getElementById('nErr').textContent=r.err;
}
async function editCard(id){
  const name = document.getElementById('n_'+id).textContent;
  const nw = prompt('新名称', name); if (nw==null) return;
  const nr = prompt('新评级 D/C/B/A/S', 'D'); if (!['D','C','B','A','S'].includes(nr)) return;
  const r = await (await fetch('/api/cards/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nw,owner_rating:nr})})).json();
  if (r.ok){ toast('已更新'); loadMy(); } else toast(r.err||'失败');
}
async function saveReview(id){
  const v = document.getElementById('rv_'+id).value;
  const r = await (await fetch('/api/cards/'+id+'/review',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:v})})).json();
  if (r.ok) toast('评价已保存'); else toast(r.err||'失败');
}
</script>`;
}

// ===== 所有者后台 =====
function adminScript() {
  return `<script>
(async () => { renderTabs(); })();
function renderTabs() {
  document.getElementById('app').innerHTML =
  '<div class="seg">'+
    '<button data-tab="cards" class="active">全部卡片</button>'+
    '<button data-tab="invites">邀请码</button>'+
    '<button data-tab="users">用户</button>'+
    '<button data-tab="boards">榜单</button>'+
  '</div><div id="tab"></div>';
  document.querySelectorAll('[data-tab]').forEach(b=> b.onclick=()=>{ [...document.querySelectorAll('[data-tab]')].forEach(x=>x.classList.toggle('active',x===b)); show(b.dataset.tab); });
  show('cards');
}
function show(tab){
  if (tab==='cards') showCards();
  if (tab==='invites') showInvites();
  if (tab==='users') showUsers();
  if (tab==='boards') showBoards();
}
function esc(s){return String(s==null?'':s).replace(/</g,'&lt;');}
async function showCards() {
  const r = await (await fetch('/api/admin/cards')).json();
  if (!r.ok){ document.getElementById('tab').innerHTML='<p class="err">'+r.err+'</p>'; return; }
  document.getElementById('tab').innerHTML = '<table><tr><th>ID</th><th>榜</th><th>图</th><th>名称</th><th>官方评级</th><th>作者</th><th>赞</th><th>评价数</th><th>操作</th></tr>'+
    r.data.map(c=>'<tr><td>'+c.id+'</td><td>'+esc(c.board_name)+'</td><td><img src="'+imgUrl(c.image_key)+'" style="width:40px;height:54px;object-fit:cover;border-radius:4px;"></td><td>'+esc(c.name)+'</td><td><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span></td><td class="muted" style="font-size:12px;">'+c.author_fp.slice(0,10)+'…</td><td>'+c.like_count+'</td><td>'+c.review_count+'</td><td><button class="btn danger" data-del="'+c.id+'">删</button></td></tr>').join('')+'</table>';
  document.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除卡片?'))return; await fetch('/api/cards/'+b.dataset.del,{method:'DELETE'}); showCards(); });
}
async function showInvites() {
  const r = await (await fetch('/api/admin/invites')).json();
  document.getElementById('tab').innerHTML =
  '<section class="panel"><h2>生成/编辑邀请码</h2>'+
    '<label>角色预设</label><select id="iRole"><option value="user">普通用户</option><option value="admin">管理员</option></select>'+
    '<label>总使用次数</label><input id="iMax" type="number" value="1" min="1">'+
    '<label>自定义码(可留空自动生成)</label><input id="iCode" placeholder="留空则自动生成">'+
    '<button class="btn primary" id="iAdd">保存</button><p class="err" id="iErr"></p></section>'+
  '<table><tr><th>码</th><th>预设角色</th><th>总次数</th><th>已用</th><th>剩余</th><th>状态</th><th>操作</th></tr>'+
    (r.data||[]).map(i=>'<tr><td><code>'+esc(i.code)+'</code></td><td>'+i.role+'</td><td id="im_'+i.code+'">'+i.max_uses+'</td><td>'+i.used_count+'</td><td>'+(i.max_uses-i.used_count)+'</td><td>'+(i.disabled?'<span class="err">已禁用</span>':'启用')+'</td>'+
      '<td><button class="btn" data-edit="'+esc(i.code)+'">改次数/角色</button> <button class="btn" data-toggle="'+esc(i.code)+'" data-state="'+i.disabled+'">'+(i.disabled?'启用':'禁用')+'</button> <button class="btn danger" data-del="'+esc(i.code)+'">删</button></td></tr>').join('')+'</table>';
  document.getElementById('iAdd').onclick = async ()=>{
    const r=await (await fetch('/api/admin/invites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:document.getElementById('iRole').value,max_uses:document.getElementById('iMax').value,code:document.getElementById('iCode').value})})).json();
    if (r.ok) showInvites(); else document.getElementById('iErr').textContent=r.err;
  };
  document.querySelectorAll('[data-edit]').forEach(b=> b.onclick=async()=>{
    const role=prompt('角色 admin/user','user'); if(!['admin','user'].includes(role))return;
    const m=prompt('总使用次数','1'); if(m==null)return;
    await fetch('/api/admin/invites/'+encodeURIComponent(b.dataset.edit),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,max_uses:m})});
    showInvites();
  });
  document.querySelectorAll('[data-toggle]').forEach(b=> b.onclick=async()=>{
    await fetch('/api/admin/invites/'+encodeURIComponent(b.dataset.toggle),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({disabled:b.dataset.state==='0'?true:false})});
    showInvites();
  });
  document.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除邀请码?'))return; await fetch('/api/admin/invites/'+encodeURIComponent(b.dataset.del),{method:'DELETE'}); showInvites(); });
}
async function showUsers() {
  const r = await (await fetch('/api/admin/users')).json();
  document.getElementById('tab').innerHTML = '<table><tr><th>ID</th><th>指纹</th><th>角色</th><th>邀请码</th><th>注册时间</th><th>改角色</th></tr>'+
    (r.data||[]).map(u=>'<tr><td>'+u.id+'</td><td class="muted" style="font-size:12px;">'+u.fingerprint.slice(0,16)+'…</td><td>'+u.role+'</td><td>'+(u.invite_code||'-')+'</td><td>'+u.created_at+'</td>'+
      '<td><select id="ur_'+u.id+'"><option value="user">user</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>admin</option><option value="owner"'+(u.role==='owner'?' selected':'')+'>owner</option></select> <button class="btn" data-uid="'+u.id+'">保存</button></td></tr>').join('')+'</table>';
  document.querySelectorAll('[data-uid]').forEach(b=> b.onclick=async()=>{
    const role=document.getElementById('ur_'+b.dataset.uid).value;
    await fetch('/api/admin/users/'+b.dataset.uid,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
    showUsers();
  });
}
async function showBoards() {
  const r = await (await fetch('/api/boards')).json();
  document.getElementById('tab').innerHTML = '<section class="panel"><h2>新建榜单</h2>'+
    '<label>名称</label><input id="bName"><label>排序值(小在前)</label><input id="bOrd" type="number" value="0">'+
    '<button class="btn primary" id="bAdd">添加</button></section>'+
    '<table><tr><th>ID</th><th>名称</th><th>排序</th><th>操作</th></tr>'+
    (r.data||[]).map(b=>'<tr><td>'+b.id+'</td><td>'+esc(b.name)+'</td><td>'+b.sort_order+'</td><td><button class="btn danger" data-bd="'+b.id+'">删</button></td></tr>').join('')+'</table>';
  document.getElementById('bAdd').onclick = async ()=>{
    await fetch('/api/admin/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('bName').value,sort_order:parseInt(document.getElementById('bOrd').value,10)||0})});
    showBoards();
  };
  document.querySelectorAll('[data-bd]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除榜单会连带删除其下卡片?'))return; await fetch('/api/admin/boards/'+b.dataset.bd,{method:'DELETE'}); showBoards(); });
}
</script>`;
}