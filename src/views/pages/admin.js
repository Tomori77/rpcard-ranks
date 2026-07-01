// 后台页:未登录显示登录表单,登录后显示管理界面
// 单所有者模式:只保留 发布新卡 / 我的卡片 / 全部卡片 / 榜单

export function renderAdmin() {
  return {
    title: '后台',
    body: '<div id="app"></div>',
    script: `<script>
let boards=[], myCards=[], curTab=null, myRole=null;

(async () => {
  const me = await (await fetch('/api/me')).json();
  if (!me.ok || !me.role){
    showLoginForm();
    return;
  }
  if (me.role === 'user'){
    document.getElementById('app').innerHTML =
      '<section class="panel"><h2>无后台权限</h2>'+
      '<p class="muted">你当前是普通用户,只能查看排行榜和点赞。</p>'+
      '<button class="btn primary" onclick="location.href='+"'"+'/'+"'"+'">返回排行</button></section>';
    return;
  }
  myRole = me.role;
  if (window.refreshWhoami) window.refreshWhoami();
  await loadBoards();
  await loadMy();
  renderTabs();
})();

// ============ 登录表单(内联在 /admin 页) ============
function showLoginForm(){
  document.getElementById('app').innerHTML =
    '<section class="panel"><h2>登录</h2>'+
    '<label>用户名</label><input id="lgUser" autocomplete="username">'+
    '<label>密码</label><input id="lgPass" type="password" autocomplete="current-password">'+
    '<p class="err" id="lgErr"></p>'+
    '<button class="btn primary" id="lgGo">登录</button></section>';
  document.getElementById('lgGo').onclick = async () => {
    const username = document.getElementById('lgUser').value.trim();
    const password = document.getElementById('lgPass').value;
    const err = document.getElementById('lgErr');
    err.textContent='';
    if (!username || !password){ alert('请输入用户名和密码'); return; }
    let r;
    try {
      const res = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      const text = await res.text();
      try { r = JSON.parse(text); } catch { alert('登录失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
      if (!res.ok && !r.err){ alert('登录失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
    } catch (e) { alert('登录失败\\n\\n网络错误: ' + e.message); return; }
    if (r.ok){
      const me = await (await fetch('/api/me', {credentials:'same-origin'})).json().catch(()=>({ok:false}));
      if (me.ok && (me.role === 'admin' || me.role === 'owner')){
        toast('登录成功', 800);
        if (window.refreshWhoami) window.refreshWhoami();
        setTimeout(()=> location.reload(), 600);
      } else {
        alert('会话未生效\\n\\n[err: session_invalid]');
      }
    } else {
      alert('登录失败\\n\\n' + (r.err || '未知错误') + '\\n[err: ' + r.err + ']');
    }
  };
}

// ============ 后台主界面 ============
async function loadBoards(){ const r = await (await fetch('/api/boards')).json(); boards = r.data || []; }
async function loadMy(){ const r = await (await fetch('/api/workspace/me')).json(); if (r.ok) myCards = r.data.cards || []; }

function renderTabs(){
  const tabs = ['publish', 'my', 'allcards', 'boards'];
  const labels = { publish:'发布新卡', my:'我的卡片', allcards:'全部卡片', boards:'榜单' };
  document.getElementById('app').innerHTML =
    '<div class="seg" id="tabs">' + tabs.map((t,i)=>'<button data-tab="'+t+'"'+(i===0?' class="active"':'')+'>'+labels[t]+'</button>').join('') + '</div>'+
    '<div class="muted" style="margin:4px 0 12px;">当前: '+(myRole==='owner'?'所有者':'管理员')+' · <button class="linkbtn" id="logout">退出</button></div>'+
    '<div id="tab"></div>';
  document.querySelectorAll('#tabs button').forEach(b=> b.onclick=()=>{ [...document.querySelectorAll('#tabs button')].forEach(x=>x.classList.toggle('active',x===b)); curTab=b.dataset.tab; show(b.dataset.tab); });
  document.getElementById('logout').onclick = async ()=>{ await fetch('/api/logout',{method:'POST'}); if (window.refreshWhoami) window.refreshWhoami(); showLoginForm(); };
  curTab = tabs[0];
  show(curTab);
}

function show(tab){
  if (tab==='publish') showPublish();
  if (tab==='my') showMy();
  if (tab==='allcards') showAllCards();
  if (tab==='boards') showBoards();
}

// ---- 发布新卡 ----
function showPublish(){
  const bidOpts = boards.map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join('');
  document.getElementById('tab').innerHTML =
  '<section class="panel"><h2>发布新卡片</h2>'+
    '<label>名称</label><input id="nName" placeholder="角色卡名称">'+
    '<div class="row" style="gap:12px;">'+
      '<div style="flex:1;min-width:140px;"><label>官方评级</label><select id="nRating">'+['D','C','B','A','S'].map(x=>'<option>'+x+'</option>').join('')+'</select></div>'+
      '<div style="flex:2;min-width:140px;"><label>榜单</label><select id="nBoard">'+bidOpts+'</select></div>'+
    '</div>'+
    '<label>图片</label><input id="nFile" type="file" accept="image/*">'+
    '<p class="muted">上传前自动压缩到 1080px / 质量 85</p>'+
    '<p class="err" id="nErr"></p>'+
    '<button class="btn primary" id="nGo">上传并发布</button>'+
  '</section>';
  document.getElementById('nGo').onclick = onPublish;
}
async function compress(file){
  const img = await createImageBitmap(file);
  const max = 1080;
  let w=img.width, h=img.height;
  if (w>max || h>max){ const k=Math.min(max/w, max/h); w=Math.round(w*k); h=Math.round(h*k); }
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  cv.getContext('2d').drawImage(img,0,0,w,h);
  const blob = await new Promise(res=>cv.toBlob(res,'image/jpeg',0.85));
  return new File([blob], 'card.jpg', {type:'image/jpeg'});
}
async function onPublish(){
  const name = document.getElementById('nName').value.trim();
  const rating = document.getElementById('nRating').value;
  const board = parseInt(document.getElementById('nBoard').value,10);
  const fInput = document.getElementById('nFile');
  const nErr = document.getElementById('nErr');
  if (!name || !fInput.files.length){ nErr.textContent='名称和图片必填'; return; }
  nErr.textContent='';
  const comp = await compress(fInput.files[0]);
  const fd = new FormData(); fd.append('file', comp);
  const up = await (await fetch('/api/upload',{method:'POST',body:fd})).json();
  if (!up.ok){ nErr.textContent='图片上传失败: '+up.err; return; }
  const r = await (await fetch('/api/workspace/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,image_key:up.key,owner_rating:rating,board_id:board})})).json();
  if (r.ok){ toast('已发布'); fInput.value=''; document.getElementById('nName').value=''; await loadMy(); if (curTab==='my') showMy(); }
  else nErr.textContent=r.err;
}

// ---- 我的卡片 ----
function showMy(){
  document.getElementById('tab').innerHTML =
  '<section class="panel"><h2>我的卡片</h2>'+
    '<table><tr><th>ID</th><th>图</th><th>名称</th><th>评级</th><th>赞</th><th>我的评价</th><th>操作</th></tr>'+
    (myCards.length? myCards.map(c=>{
      const rev = c.my_review||'';
      return '<tr><td>'+c.id+'</td><td><img src="'+imgUrl(c.image_key)+'" style="width:44px;height:58px;object-fit:cover;border-radius:8px;"></td>'+
        '<td id="n_'+c.id+'">'+esc(c.name)+'</td><td><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span></td>'+
        '<td>'+c.like_count+'</td><td><textarea id="rv_'+c.id+'" placeholder="你的评价">'+esc(rev)+'</textarea></td>'+
        '<td><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn" data-act="edit" data-id="'+c.id+'">改</button><button class="btn" data-act="rev" data-id="'+c.id+'">存评价</button></div></td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">还没有卡片,在"发布新卡"标签里发一张</td></tr>')+
    '</table></section>';
  document.querySelectorAll('button[data-act]').forEach(b=> b.onclick=()=>{
    if (b.dataset.act==='edit') editCard(b.dataset.id);
    if (b.dataset.act==='rev') saveReview(b.dataset.id);
  });
}
async function editCard(id){
  const name = document.getElementById('n_'+id).textContent;
  const nw = prompt('新名称', name); if (nw==null) return;
  const nr = prompt('新评级 D/C/B/A/S', 'D'); if (!['D','C','B','A','S'].includes(nr)) return;
  const r = await (await fetch('/api/cards/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nw,owner_rating:nr})})).json();
  if (r.ok){ toast('已更新'); await loadMy(); if (curTab==='my') showMy(); } else toast(r.err||'失败');
}
async function saveReview(id){
  const v = document.getElementById('rv_'+id).value;
  const r = await (await fetch('/api/cards/'+id+'/review',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:v})})).json();
  if (r.ok) toast('评价已保存'); else toast(r.err||'失败');
}

// ---- 全部卡片 ----
async function showAllCards(){
  const r = await (await fetch('/api/admin/cards')).json();
  if (!r.ok){ document.getElementById('tab').innerHTML='<p class="err">'+r.err+'</p>'; return; }
  document.getElementById('tab').innerHTML = '<section class="panel"><table><tr><th>ID</th><th>榜</th><th>图</th><th>名称</th><th>官方评级</th><th>赞</th><th>评价</th><th>操作</th></tr>'+
    (r.data.length? r.data.map(c=>'<tr><td>'+c.id+'</td><td>'+esc(c.board_name)+'</td><td><img src="'+imgUrl(c.image_key)+'" style="width:36px;height:48px;object-fit:cover;border-radius:6px;"></td><td>'+esc(c.name)+'</td><td><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span></td><td>'+c.like_count+'</td><td>'+c.review_count+'</td><td><button class="btn danger" data-del="'+c.id+'">删</button></td></tr>').join('') : '<tr><td colspan="8" class="muted">还没有卡片</td></tr>')+'</table></section>';
  document.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除卡片?此操作不可撤销'))return; await fetch('/api/cards/'+b.dataset.del,{method:'DELETE'}); showAllCards(); });
}

// ---- 榜单 ----
async function showBoards(){
  const r = await (await fetch('/api/boards')).json();
  document.getElementById('tab').innerHTML =
    '<section class="panel"><h2>新建榜单</h2>'+
      '<div class="row" style="gap:12px;"><div style="flex:2;min-width:140px;"><label>名称</label><input id="bName"></div><div style="flex:1;min-width:100px;"><label>排序值(小在前)</label><input id="bOrd" type="number" value="0"></div></div>'+
      '<button class="btn primary" id="bAdd" style="margin-top:14px;">添加</button></section>'+
    '<section class="panel"><table><tr><th>ID</th><th>名称</th><th>排序</th><th>操作</th></tr>'+
    ((r.data||[]).length? (r.data||[]).map(b=>'<tr><td>'+b.id+'</td><td>'+esc(b.name)+'</td><td>'+b.sort_order+'</td><td><button class="btn danger" data-bd="'+b.id+'">删</button></td></tr>').join('') : '<tr><td colspan="4" class="muted">还没有榜单</td></tr>')+'</table></section>';
  document.getElementById('bAdd').onclick = async ()=>{
    const name=document.getElementById('bName').value.trim();
    if(!name) return;
    await fetch('/api/admin/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,sort_order:parseInt(document.getElementById('bOrd').value,10)||0})});
    await loadBoards();
    showBoards();
  };
  document.querySelectorAll('[data-bd]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除榜单会连带删除其下卡片,确定?'))return; await fetch('/api/admin/boards/'+b.dataset.bd,{method:'DELETE'}); await loadBoards(); showBoards(); });
}
</script>`,
  };
}