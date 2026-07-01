// 认证 API:仅 login(单所有者模式,无注册无邀请码)

import { Hono } from 'hono';
import { json, cookieHeader } from '../core/http.js';
import * as db from '../core/db.js';
import { verifyPassword, signSession } from '../core/crypto.js';
import { sessionMiddleware } from '../middleware.js';

const SESSION_TTL = 7 * 86400;

export default function authRoutes() {
  const r = new Hono();
  r.use('*', sessionMiddleware);

  // 登录:账号密码(仅 admin/owner 可登录后台)
  r.post('/login', async (c) => {
    const { username, password } = await c.req.json().catch(() => ({}));
    if (!username || !password) return json({ ok: false, err: 'missing' }, 400);
    const u = await db.getUserByUsername(c.env.d1, username);
    if (!u) return json({ ok: false, err: 'wrong' }, 401);
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) return json({ ok: false, err: 'wrong' }, 401);
    if (u.role === 'user') return json({ ok: false, err: 'no_backend_access' }, 403);
    const token = await signSession({ uid: u.id, role: u.role, username: u.username }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, SESSION_TTL));
    return json({ ok: true, role: u.role, username: u.username });
  });

  // 登出
  r.post('/logout', (c) => {
    c.header('Set-Cookie', cookieHeader('session', '', 0));
    return json({ ok: true });
  });

  return r;
}