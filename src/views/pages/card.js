// 卡片详情:图 + 官方评级 + 点赞 toggle + 用户评级分布 + 多评价

export function renderCard({ id }) {
  return {
    title: '卡片详情',
    body: `<section class="panel" id="detail"><p class="muted">加载中...</p></section>`,
    script: `<script>
let myFp=null;
(async () => {
  myFp = await window.FP();
  await load();
  setInterval(load, 15000);
})();
async function load() {
  const r = await (await fetch('/api/cards/${id}?fp='+encodeURIComponent(myFp))).json();
  const box = document.getElementById('detail');
  if (!r.ok){ box.innerHTML='<p class="err">'+(r.err||'未找到')+'</p>'; return; }
  const c = r.data.card;
  const dist = { D:0,C:0,B:0,A:0,S:0 };
  r.data.dist.forEach(d => dist[d.rating]=d.n);
  const total = dist.D+dist.C+dist.B+dist.A+dist.S;
  const colors = { D:'#8e8e93',C:'#0071e3',B:'#af52de',A:'#ff9f0a',S:'#ff3b30' };
  let bar = '<div class="bar">';
  ['D','C','B','A','S'].forEach(rk => { if (total>0){ const p=dist[rk]/total; bar+='<span style="width:'+(p*100)+'%;background:'+colors[rk]+'" title="'+rk+':'+dist[rk]+'"></span>'; } });
  bar += '</div><div class="muted">用户评级分布 · S'+dist.S+' A'+dist.A+' B'+dist.B+' C'+dist.C+' D'+dist.D+'</div>';

  const liked = r.data.mine.liked, myRate = r.data.mine.rating;
  let rateBtns = '<div class="rate-btns" id="rateBtns">';
  ['D','C','B','A','S'].forEach(rk => {
    const cls = liked ? 'unlocked' : '';
    const mine = myRate===rk ? 'mine':'';
    rateBtns += '<button class="'+cls+' '+mine+'" data-r="'+rk+'">'+rk+'</button>';
  });
  rateBtns += '</div><div class="muted">'+(liked?'已点赞,点选你认为的评级(仅参考)':'需先点赞才能评级')+'</div>';

  let reviews = '';
  if (r.data.reviews && r.data.reviews.length) {
    reviews = '<div class="divider"></div><h3>评价</h3>';
    r.data.reviews.forEach(rv => {
      const who = rv.author_role==='owner'?'所有者':rv.author_role==='admin'?'管理员':'用户';
      reviews += '<div class="panel" style="background:var(--fill);box-shadow:none;"><div class="muted" style="font-size:12px;">'+who+' · '+rv.created_at+'</div><div style="margin-top:8px;white-space:pre-wrap;line-height:1.55;">'+esc(rv.content)+'</div></div>';
    });
  }

  box.innerHTML =
    '<div class="split">'+
      '<img src="'+imgUrl(c.image_key)+'" style="width:240px;border-radius:14px;box-shadow:var(--shadow-md);">'+
      '<div>'+
        '<h2 style="margin-top:0;">'+esc(c.name)+'</h2>'+
        '<div style="display:flex;align-items:center;gap:14px;margin:10px 0;">'+
          '<span class="rating rating-'+c.owner_rating+'">官方 '+c.owner_rating+'</span>'+
          '<span class="muted">♥ '+r.data.likeCount+' 赞</span>'+
        '</div>'+
        '<div style="margin:18px 0;">'+
          '<button class="btn '+(liked?'':'primary')+'" id="likeBtn">♥ '+(liked?'已点赞,再点取消':'点赞')+'</button>'+
        '</div>'+
        '<div style="margin:18px 0;"><div class="muted" style="margin-bottom:6px;">用户认可的评级(仅参考)</div>'+bar+'</div>'+
        rateBtns+
      '</div>'+
    '</div>'+reviews;

  document.getElementById('likeBtn').onclick = async () => {
    const res = await (await fetch('/api/cards/${id}/like', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:myFp})})).json();
    if (res.ok){ toast(res.liked ? '已点赞' : '已取消点赞'); load(); } else toast(res.err||'失败');
  };
  document.querySelectorAll('#rateBtns button').forEach(b => b.onclick = async () => {
    if (!liked){ toast('请先点赞'); return; }
    const res = await (await fetch('/api/cards/${id}/rate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint:myFp,rating:b.dataset.r})})).json();
    if (res.ok){ toast('已评级 '+b.dataset.r); load(); } else toast(res.err||'失败');
  });
}
</script>`,
  };
}