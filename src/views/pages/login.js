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
  if (!username || !password){ err.textContent='请输入用户名和密码'; return; }
  const r = await (await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})).json();
  if (r.ok){ toast('登录成功', 900); setTimeout(()=> location.href="${safeNext}", 700); }
  else {
    const map = {
      wrong:'用户名或密码错误',
      no_backend_access:'该账号无后台访问权限(普通用户)',
      missing:'请输入用户名和密码',
    };
    err.textContent = map[r.err] || r.err || '失败';
    if (r.err === 'no_backend_access'){ setTimeout(()=> location.href='/', 1600); }
  }
};
document.getElementById('toReg').onclick = ()=> location.href='/register?next=${safeNext}';
document.getElementById('toRecover').onclick = ()=> location.href='/emergency';
</script>`,
  };
}