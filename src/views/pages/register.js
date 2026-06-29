// 注册页:账号密码 + 邀请码

export function renderRegister({ presetCode = '' }) {
  const code = presetCode.replace(/"/g, '&quot;');
  return {
    title: '注册',
    body: `<section class="panel">
  <h2>注册账号</h2>
  <p class="muted">需要邀请码才能注册。账号以密码加密存储,浏览器指纹将用于本机点赞追踪。</p>
  <label>用户名</label>
  <input id="username" placeholder="5~32 位字母数字" autocomplete="username">
  <label>密码</label>
  <input id="password" type="password" placeholder="至少 5 位字母数字" autocomplete="new-password">
  <label>邀请码</label>
  <input id="code" value="${code}" placeholder="输入邀请码">
  <p class="err" id="err"></p>
  <button class="btn primary" id="go">注册</button>
  <div class="divider"></div>
  <div class="hint">忘记密码?管理员请联系所有者在后台重置;所有者可凭部署时设置的 <code>OWNER_PASSWORD</code> 走应急入口(<a href="/emergency">/emergency</a>)。</div>
  <div class="divider"></div>
  <p class="muted">已有账号?<button class="linkbtn" id="toLogin">前往登录 →</button></p>
</section>`,
    script: `<script>
document.getElementById('go').onclick = async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const code = document.getElementById('code').value.trim();
  const err = document.getElementById('err');
  err.textContent='';
  if (!username || !password || !code){ alert('请填写完整'); return; }
  const fp = await window.FP();
  let r;
  try {
    const res = await fetch('/api/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,code,fingerprint:fp})});
    const text = await res.text();
    try { r = JSON.parse(text); } catch { alert('注册失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
    if (!res.ok && !r.err){ alert('注册失败\\n\\nHTTP ' + res.status + '\\n' + text.slice(0,300)); return; }
  } catch (e) {
    alert('注册失败\\n\\n网络错误: ' + e.message); return;
  }
  if (r.ok){
    toast('注册成功,角色: '+r.role, 1500);
    setTimeout(()=> location.href='/admin', 900);
  } else {
    const map = {
      invalid_code:'邀请码无效或已禁用', exhausted:'邀请码已用完', missing:'参数缺失',
      bad_username:'用户名需 5~32 位字母或数字', weak_password:'密码至少 5 位字母或数字',
      username_taken:'该用户名已被占用', bad_code_role:'邀请码角色不合法',
      fp_registered:'此设备已注册过账号,一个指纹仅可注册一个账号',
      owner_exists:'所有者账号已存在(系统仅允许一个所有者)',
    };
    alertErr(map, r.err, '注册失败');
  }
};
document.getElementById('toLogin').onclick = ()=> location.href='/login';
</script>`,
  };
}