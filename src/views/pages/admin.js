// 统一后台:前端读 /api/me,按 role 自适应显示标签
// admin: 发布新卡 / 我的卡片 / 榜单(只读)
// owner: 发布新卡 / 我的卡片 / 全部卡片 / 邀请码 / 用户 / 榜单

export function renderAdmin() {
  return {
    title: '后台',
    body: '<div id="app"></div>',
    script: `<script>
let boards=[], myCards=[], curTab=null, myRole=null;

(async () => {
  const me = await (await fetch('/api/me')).json();
  if (!me.ok || (me.role !== 'admin' && me.role !== 'owner')){
    document.getElementById('app').innerHTML =
      '<section class="panel"><h2>登录后台</h2>'+
      '<p class="muted">后台需要管理员或所有者身份。请使用账号密码登录。</p>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">'+
      '<button class="btn primary" onclick="location.href='+"'"+'/login?next=/admin'+"'"+'">账号登录</button>'+
      '<button class="btn" onclick="location.href='+"'"+'/register?next=/admin'+"'"+'">使用邀请码注册</button>'+
      '</div></section>';
    return;
  }
  myRole = me.role;
  await loadBoards();
  await loadMy();
  renderTabs();
})();

async function loadBoards(){ const r = await (await fetch('/api/boards')).json(); boards = r.data || []; }
async function loadMy(){ const r = await (await fetch('/api/workspace/me')).json(); if (r.ok) myCards = r.data.cards || []; }

function renderTabs(){
  const tabs = ['publish', 'my', 'boards'];
  const labels = { publish:'发布新卡', my:'我的卡片', boards:'榜单' };
  if (myRole === 'owner'){ tabs.splice(2, 0, 'allcards', 'invites', 'users'); labels.allcards='全部卡片'; labels.invites='邀请码'; labels.users='用户'; }
  document.getElementById('app').innerHTML =
    '<div class="seg" id="tabs">' + tabs.map((t,i)=>'<button data-tab="'+t+'"'+(i===0?' class="active"':'')+'>'+labels[t]+'</button>').join('') + '</div>'+
    '<div class="muted" style="margin:4px 0 12px;">当前: '+(myRole==='owner'?'所有者':'管理员')+' · <button class="linkbtn" id="logout">退出</button></div>'+
    '<div id="tab"></div>';
  document.querySelectorAll('#tabs button').forEach(b=> b.onclick=()=>{ [...document.querySelectorAll('#tabs button')].forEach(x=>x.classList.toggle('active',x===b)); curTab=b.dataset.tab; show(b.dataset.tab); });
  document.getElementById('logout').onclick = async ()=>{ await fetch('/api/logout',{method:'POST'}); location.href='/'; };
  curTab = tabs[0];
  show(curTab);
}

function show(tab){
  if (tab==='publish') showPublish();
  if (tab==='my') showMy();
  if (tab==='allcards') showAllCards();
  if (tab==='invites') showInvites();
  if (tab==='users') showUsers();
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

// ---- 全部卡片(所有者) ----
async function showAllCards(){
  const r = await (await fetch('/api/admin/cards')).json();
  if (!r.ok){ document.getElementById('tab').innerHTML='<p class="err">'+r.err+'</p>'; return; }
  document.getElementById('tab').innerHTML = '<section class="panel"><table><tr><th>ID</th><th>榜</th><th>图</th><th>名称</th><th>官方评级</th><th>作者</th><th>赞</th><th>评价</th><th>操作</th></tr>'+
    (r.data.length? r.data.map(c=>'<tr><td>'+c.id+'</td><td>'+esc(c.board_name)+'</td><td><img src="'+imgUrl(c.image_key)+'" style="width:36px;height:48px;object-fit:cover;border-radius:6px;"></td><td>'+esc(c.name)+'</td><td><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span></td><td class="muted" style="font-size:11px;">'+(c.author_fp||'').slice(0,10)+'…</td><td>'+c.like_count+'</td><td>'+c.review_count+'</td><td><button class="btn danger" data-del="'+c.id+'">删</button></td></tr>').join('') : '<tr><td colspan="9" class="muted">还没有卡片</td></tr>')+'</table></section>';
  document.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除卡片?此操作不可撤销'))return; await fetch('/api/cards/'+b.dataset.del,{method:'DELETE'}); showAllCards(); });
}

// ---- 邀请码(所有者) ----
async function showInvites(){
  const r = await (await fetch('/api/admin/invites')).json();
  document.getElementById('tab').innerHTML =
  '<section class="panel"><h2>生成 / 编辑邀请码</h2>'+
    '<div class="row" style="gap:12px;">'+
      '<div style="flex:1;min-width:120px;"><label>预设角色</label><select id="iRole"><option value="user">普通用户</option><option value="admin">管理员</option></select></div>'+
      '<div style="flex:1;min-width:120px;"><label>总使用次数</label><input id="iMax" type="number" value="1" min="1"></div>'+
    '</div>'+
    '<label>自定义码(可留空自动生成)</label><input id="iCode" placeholder="留空则自动生成">'+
    '<button class="btn primary" id="iAdd" style="margin-top:14px;">保存</button><p class="err" id="iErr"></p></section>'+
  '<section class="panel"><table><tr><th>码</th><th>预设角色</th><th>总次数</th><th>已用</th><th>剩余</th><th>状态</th><th>操作</th></tr>'+
    ((r.data||[]).length? (r.data||[]).map(i=>'<tr><td><code>'+esc(i.code)+'</code></td><td><span class="badge">'+i.role+'</span></td><td id="im_'+esc(i.code)+'">'+i.max_uses+'</td><td>'+i.used_count+'</td><td>'+(i.max_uses-i.used_count)+'</td><td>'+(i.disabled?'<span class="badge off">已禁用</span>':'<span class="badge on">启用</span>')+'</td>'+
      '<td><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn" data-edit="'+esc(i.code)+'">改</button> <button class="btn" data-toggle="'+esc(i.code)+'" data-state="'+i.disabled+'">'+(i.disabled?'启用':'禁用')+'</button> <button class="btn danger" data-del="'+esc(i.code)+'">删</button></div></td></tr>').join('') : '<tr><td colspan="7" class="muted">还没有邀请码</td></tr>')+'</table></section>';
  document.getElementById('iAdd').onclick = async ()=>{
    const rr=await (await fetch('/api/admin/invites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:document.getElementById('iRole').value,max_uses:document.getElementById('iMax').value,code:document.getElementById('iCode').value})})).json();
    if (rr.ok){ toast('已保存'); showInvites(); } else document.getElementById('iErr').textContent=rr.err;
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

// ---- 用户(所有者) ----
async function showUsers(){
  const r = await (await fetch('/api/admin/users')).json();
  document.getElementById('tab').innerHTML = '<section class="panel"><table><tr><th>ID</th><th>用户名</th><th>指纹</th><th>角色</th><th>邀请码</th><th>注册时间</th><th>角色</th><th>重置密码</th></tr>'+
    ((r.data||[]).length? (r.data||[]).map(u=>'<tr><td>'+u.id+'</td><td>'+(u.username?'<code>'+esc(u.username)+'</code>':'<span class="muted">-</span>')+'</td><td class="muted" style="font-size:11px;">'+(u.fingerprint||'').slice(0,12)+'…</td><td><span class="badge">'+u.role+'</span></td><td>'+(u.invite_code?'<code>'+esc(u.invite_code)+'</code>':'-')+'</td><td class="muted" style="font-size:11px;">'+u.created_at+'</td>'+
      '<td><select id="ur_'+u.id+'" style="width:auto;padding:5px 8px;"><option value="user">user</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>admin</option><option value="owner"'+(u.role==='owner'?' selected':'')+'>owner</option></select> <button class="btn" data-uid="'+u.id+'">保存</button></td>'+
      '<td><button class="btn" data-reset="'+u.id+'">重置</button></td></tr>').join('') : '<tr><td colspan="8" class="muted">还没有用户</td></tr>')+'</table></section>';
  document.querySelectorAll('[data-uid]').forEach(b=> b.onclick=async()=>{
    const role=document.getElementById('ur_'+b.dataset.uid).value;
    await fetch('/api/admin/users/'+b.dataset.uid,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
    showUsers();
  });
  document.querySelectorAll('[data-reset]').forEach(b=> b.onclick=async()=>{
    const np = prompt('输入新密码(5 位以上字母数字)');
    if (!np) return;
    const r = await (await fetch('/api/admin/users/'+b.dataset.reset+'/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({new_password:np})})).json();
    if (r.ok) toast('密码已重置'); else toast(r.err||'失败');
  });
}

// ---- 榜单(所有者可增删,管理员只读) ----
async function showBoards(){
  const r = await (await fetch('/api/boards')).json();
  const canEdit = myRole === 'owner';
  let html = '<section class="panel"><table><tr><th>ID</th><th>名称</th><th>排序</th>'+(canEdit?'<th>操作</th>':'')+'</tr>'+
    ((r.data||[]).length? (r.data||[]).map(b=>'<tr><td>'+b.id+'</td><td>'+esc(b.name)+'</td><td>'+b.sort_order+'</td>'+(canEdit?'<td><button class="btn danger" data-bd="'+b.id+'">删</button></td>':'')+'</tr>').join('') : '<tr><td colspan="'+(canEdit?4:3)+'" class="muted">还没有榜单</td></tr>')+'</table></section>';
  if (canEdit){
    html = '<section class="panel"><h2>新建榜单</h2>'+
      '<div class="row" style="gap:12px;"><div style="flex:2;min-width:140px;"><label>名称</label><input id="bName"></div><div style="flex:1;min-width:100px;"><label>排序值(小在前)</label><input id="bOrd" type="number" value="0"></div></div>'+
      '<button class="btn primary" id="bAdd" style="margin-top:14px;">添加</button></section>'+html;
  } else {
    html = '<p class="muted" style="margin:6px 0 14px;">你当前是管理员,榜单为只读。增删由所有者操作。</p>'+html;
  }
  document.getElementById('tab').innerHTML = html;
  if (canEdit){
    document.getElementById('bAdd').onclick = async ()=>{
      const name=document.getElementById('bName').value.trim();
      if(!name) return;
      await fetch('/api/admin/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,sort_order:parseInt(document.getElementById('bOrd').value,10)||0})});
      await loadBoards();
      showBoards();
    };
    document.querySelectorAll('[data-bd]').forEach(b=> b.onclick=async()=>{ if(!confirm('删除榜单会连带删除其下卡片,确定?'))return; await fetch('/api/admin/boards/'+b.dataset.bd,{method:'DELETE'}); await loadBoards(); showBoards(); });
  }
}
</script>`,
  };
}