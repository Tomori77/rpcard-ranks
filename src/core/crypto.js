// 核心加密层:全部纯函数,只依赖 Workers 内置 crypto.subtle,无 Hono 依赖

const PBKDF2_ITER = 100000;

// ---- hex 编解码 ----
function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}

// ---- SHA-256 ----
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(buf);
}

// ---- base64url(cookie 安全) ----
export function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str) {
  let t = str.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return atob(t);
}

// ---- 会话签名(结构 body.sig,全部 base64url 安全文法) ----
export async function signSession(payload, secret) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = (await sha256(body + '|' + secret)).slice(0, 32);
  return `${body}.${sig}`;
}
export async function verifySession(token, secret) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = (await sha256(body + '|' + secret)).slice(0, 32);
  if (sig !== expect) return null;
  try { return JSON.parse(b64urlDecode(body)); } catch { return null; }
}

// ---- PBKDF2 密码哈希 ----
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256
  );
  return toHex(salt) + ':' + toHex(bits);
}
export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256
  );
  const got = toHex(bits);
  if (got.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// ---- 时序安全比较(给 OWNER_PASSWORD 用) ----
export async function safeEqual(a, b) {
  const ea = await sha256(String(a));
  const eb = await sha256(String(b));
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea.charCodeAt(i) ^ eb.charCodeAt(i);
  return diff === 0;
}