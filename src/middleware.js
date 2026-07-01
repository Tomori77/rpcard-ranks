// 中间件:ADMIN_KEY 校验(Octopus 式,无 cookie 无 session)
// 前端把 ADMIN_KEY 存 localStorage,每次请求通过 X-Admin-Key header 带上

import { safeEqual } from './core/crypto.js';
import { json } from './core/http.js';

// 校验 X-Admin-Key header vs env.ADMIN_KEY
export const requireAdmin = async (c, next) => {
  if (!c.env.ADMIN_KEY) return json({ ok: false, err: 'admin_key_not_configured' }, 503);
  const provided = c.req.header('X-Admin-Key') || '';
  if (!(await safeEqual(provided, c.env.ADMIN_KEY))) return json({ ok: false, err: 'unauthorized' }, 401);
  await next();
};

// 给前端 /api/me 用的检查:返回 boolean(不阻断请求)
export async function isAdmin(c) {
  if (!c.env.ADMIN_KEY) return false;
  const provided = c.req.header('X-Admin-Key') || '';
  return safeEqual(provided, c.env.ADMIN_KEY);
}