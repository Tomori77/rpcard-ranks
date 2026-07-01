// 核心加密层:仅 sha256 + 时序安全比较(Octopus 式 ADMIN_KEY 验证,无 session 无密码哈希)

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function safeEqual(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const aa = new Uint8Array(da), bb = new Uint8Array(db);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}