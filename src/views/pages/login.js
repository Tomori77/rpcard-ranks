// 登录页:账号密码;旁边"注册"和"忘记密码"按钮

export function renderLogin({ next = '/admin' }) {
  const safeNext = String(next).replace(/"/g,'').replace(/[^A-Za-z0-9\-_\/\?=&]/g,'');
  return {
    title: '登录',
    body: `<section class="panel">
  <h2>登录</h2>
  <p class="muted">使用账号密码登录后台。普通用户无需登录即可点赞与查看。</p>
  <label>用户名</label>
  <input id="username" placeholder="用户名" autocomplete="username">
  <label>密码</label>
  <input id="password" type="password" autocomplete="current-password">
  <p class="err" id="err"></p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
    <button class="btn primary" id="go">登录</button>
    <button class="btn" id="toReg">注册</button>
    <button class="btn ghost" id="toRecover">忘记密码</button>
  </div>
</section>`,
    script: `<script>
document.getElementById('go').onclick = async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('err');
  err.textContent='';
  if (!username || !password){ alert('请输入用户名和密码'); return; }
  let r;
  try {
    const res = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const text = await res.text();
    try { r = JSON.parse(text); } catch { alert('登录失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
    if (!res.ok && !r.err){ alert('登录失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
  } catch (e) {
    alert('登录失败\\n\\n网络错误: ' + e.message); return;
  }
  if (r.ok){
    // 验证 session 是否真的生效(cookie 是否被浏览器接受)
    const me = await (await fetch('/api/me', {credentials:'same-origin'})).json().catch(()=>({ok:false}));
    if (me.ok && me.role){
      toast('登录成功,角色: ' + me.role, 1200);
      if (window.refreshWhoami) window.refreshWhoami();
      setTimeout(()=> location.href="${safeNext}", 900);
    } else {
      alert('登录响应成功,但会话未生效\\n\\n可能原因:\\n1. 服务端 SESSION_SECRET 未配置(去 Cloudflare 面板 Variables and Secrets 添加 Secret 类型 SESSION_SECRET=随机字符串)\\n2. 浏览器阻止了 Secure cookie\\n3. 跨域请求未带 cookie');
    }
  }
  else {
    const map = {
      wrong:'用户名或密码错误',
      no_backend_access:'该账号无后台访问权限(普通用户)',
      missing:'请输入用户名和密码',
    };
    alertErr(map, r.err, '登录失败');
    if (r.err === 'no_backend_access'){ setTimeout(()=> location.href='/', 1600); }
  }
};
document.getElementById('toReg').onclick = ()=> location.href='/register?next=${safeNext}';
document.getElementById('toRecover').onclick = ()=> location.href='/emergency';
</script>`,
  };
}