// 首页:排行榜(榜单切换 + 排序切换 + 15s 轮询)

export function renderHome() {
  return {
    title: '排行榜',
    body: `<section class="panel">
  <h2>角色卡排行榜</h2>
  <div class="seg" id="boards"></div>
  <div class="seg" id="sorts">
    <button data-sort="rating" class="active">官方评级优先</button>
    <button data-sort="likes">点赞数</button>
    <button data-sort="median">用户评级</button>
  </div>
  <p class="err" id="err"></p>
  <div class="grid" id="grid"></div>
</section>`,
    script: `<script>
let curBoard=null, curSort='rating';
(async () => {
  const bs = await (await fetch('/api/boards')).json();
  const bd = document.getElementById('boards');
  (bs.data||[]).forEach(b => {
    const btn=document.createElement('button'); btn.textContent=b.name; btn.dataset.id=b.id;
    btn.onclick = () => { curBoard=b.id; [...bd.children].forEach(x=>x.classList.toggle('active',x===btn)); load(); };
    bd.appendChild(btn);
  });
  if (bs.data && bs.data.length) { curBoard=bs.data[0].id; bd.firstChild.classList.add('active'); }
  document.querySelectorAll('#sorts button').forEach(b=> b.onclick=()=>{ curSort=b.dataset.sort; [...document.querySelectorAll('#sorts button')].forEach(x=>x.classList.toggle('active',x===b)); load(); });
  load(); setInterval(load, 15000);
})();
async function load() {
  if (!curBoard) return;
  const r = await (await fetch('/api/ranking?board='+curBoard+'&sort='+curSort)).json();
  const grid=document.getElementById('grid');
  if (!r.ok){ document.getElementById('err').textContent=r.err||'加载失败'; return; }
  document.getElementById('err').textContent='';
  grid.innerHTML='';
  if (!r.data.length){ grid.innerHTML='<p class="muted">暂无卡片</p>'; return; }
  r.data.forEach(c=>{
    const el=document.createElement('div'); el.className='card';
    el.onclick=()=>location.href='/card/'+c.id;
    el.innerHTML='<img src="'+imgUrl(c.image_key)+'" loading="lazy" alt="">'+
      '<div class="body"><div class="name">'+esc(c.name)+'</div>'+
      '<div class="meta"><span class="rating rating-'+c.owner_rating+'">'+c.owner_rating+'</span><span>♥ '+c.like_count+'</span></div></div>';
    grid.appendChild(el);
  });
}
</script>`,
  };
}