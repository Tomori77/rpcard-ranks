// 所有者应急入口:凭 OWNER_PASSWORD 重置密码并登录

export function renderEmergency() {
  return {
    title: '所有者应急',
    body: `<section class="panel">
  <h2>所有者应急登录</h2>
  <p class="muted">如果你是所有者且忘记密码,可在 Cloudflare 面板查看 <code>OWNER_PASSWORD</code> 这个 secret 的值,然后在此填写你的注册用户名 + 该值即可重置密码并登录。</p>
  <label>注册用户名</label>
  <input id="username" placeholder="所有者账号用户名" autocomplete="username">
  <label>OWNER_PASSWORD</label>
  <input id="password" type="password" autocomplete="current-password">
  <p class="err" id="err"></p>
  <button class="btn primary" id="go">重置并登录</button>
  <div class="divider"></div>
  <p class="muted">管理员/普通用户忘记密码:请联系所有者在后台用户标签中重置。</p>
  <div class="divider"></div>
  <p class="muted">想起来了?<button class="linkbtn" id="toLogin">返回登录 →</button></p>
</section>`,
    script: `<script>
document.getElementById('go').onclick = async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('err');
  err.textContent='';
  if (!username || !password){ alert('请填写用户名和 OWNER_PASSWORD'); return; }
  const r = await (await fetch('/api/emergency', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})).json();
  if (r.ok){ toast('已重置并登录', 1000); setTimeout(()=> location.href='/admin', 700); }
  else {
    const map = {
      wrong:'用户名或 OWNER_PASSWORD 错误',
      not_owner:'该账号不是所有者,无法使用应急入口',
      no_owner_secret:'服务端未配置 OWNER_PASSWORD',
      missing:'请填写完整',
    };
    alertErr(map, r.err, '应急登录失败');
  }
};
document.getElementById('toLogin').onclick = ()=> location.href='/login';
</script>`,
  };
}