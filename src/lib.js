// 共享工具库:加密/会话/数据库查询/KV缓存/响应(ESM)

export const RATING_ORDER = { D: 1, C: 2, B: 3, A: 4, S: 5 };
export const RATING_LIST = ['D', 'C', 'B', 'A', 'S'];

// ---- hash ----
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- 会话 cookie(value 形如 role:user_id|hmac) ----
export async function signSession(payload, secret) {
  const body = btoa(JSON.stringify(payload));
  const sig = (await sha256(body + '|' + secret)).slice(0, 32);
  return `${body}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = (await sha256(body + '|' + secret)).slice(0, 32);
  if (sig !== expect) return null;
  try { return JSON.parse(atob(body)); } catch { return null; }
}

export function cookieHeader(name, value, maxAge) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + maxAge,
  ];
  // Workers 域名几乎都是 HTTPS;通过启动 URL 判断不可靠,这里直接添加 Secure
  parts.push('Secure');
  return parts.join('; ');
}

export function parseCookies(req) {
  const h = req.headers.get('Cookie') || '';
  const out = {};
  h.split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

// ---- 邀请码生成 ----
export function genInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 12);
}

// ---- 用户工具 ----
// 通过 fingerprint 查/建用户,返回 user 行
export async function getOrCreateUser(db, fingerprint) {
  const row = await db.prepare('SELECT * FROM users WHERE fingerprint = ?').bind(fingerprint).first();
  if (row) return row;
  // 默认匿名用户(无邀请码 = user)
  const info = await db.prepare('INSERT INTO users(fingerprint, role) VALUES(?, ?)').bind(fingerprint, 'user').run();
  return { id: info.meta.last_row_id, fingerprint, role: 'user', invite_code: null };
}

// ---- KV 缓存 ----
export async function withCache(kv, key, ttlSec, loader) {
  const cached = await kv.get(key, 'json');
  if (cached) return cached;
  const fresh = await loader();
  if (fresh !== null && fresh !== undefined) {
    try { await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSec }); } catch {}
  }
  return fresh;
}

// ---- 响应 ----
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// 简单 HTML 包装
export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}