// 中间件:会话解析 + 角色守卫

import { verifySession } from './core/crypto.js';
import { parseCookies, json } from './core/http.js';

// 解析 cookie → c.set('session', payload | null)
export const sessionMiddleware = async (c, next) => {
  const cookies = parseCookies(c.req.raw);
  let session = null;
  if (cookies.session) {
    session = await verifySession(cookies.session, c.env.SESSION_SECRET);
  }
  c.set('session', session);
  await next();
};

// 角色守卫:requireRole('admin','owner') 返回中间件函数
// 失败返 403 JSON
export const requireRole = (...roles) => async (c, next) => {
  const s = c.get('session');
  if (!s || !roles.includes(s.role)) return json({ ok: false, err: 'forbidden' }, 403);
  await next();
};

// 便捷:从当前 session 取 uid
export const uidOf = (c) => c.get('session')?.uid || null;
export const roleOf = (c) => c.get('session')?.role || null;