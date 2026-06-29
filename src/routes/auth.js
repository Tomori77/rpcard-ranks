// 认证 API:register / login / emergency / logout

import { Hono } from 'hono';
import { json, cookieHeader } from '../core/http.js';
import * as db from '../core/db.js';
import { hashPassword, verifyPassword, safeEqual, signSession } from '../core/crypto.js';
import { sessionMiddleware } from '../middleware.js';

const USERNAME_RE = /^[A-Za-z0-9]{5,32}$/;
const PASSWORD_RE = /^[A-Za-z0-9]{5,}$/;
const OWNER_CODE = 'RPRPRP';
const SESSION_TTL = 7 * 86400;

export default function authRoutes() {
  const r = new Hono();
  r.use('*', sessionMiddleware);

  // 注册:账号密码 + 邀请码
  r.post('/register', async (c) => {
    const { username, password, code, fingerprint } = await c.req.json().catch(() => ({}));
    if (!username || !password || !code) return json({ ok: false, err: 'missing' }, 400);
    if (!USERNAME_RE.test(username)) return json({ ok: false, err: 'bad_username' }, 400);
    if (!PASSWORD_RE.test(password)) return json({ ok: false, err: 'weak_password' }, 400);

    // 单指纹仅可注册一个账号
    if (fingerprint) {
      const fpExist = await db.getUserByFingerprint(c.env.DB, fingerprint);
      if (fpExist) return json({ ok: false, err: 'fp_registered' }, 400);
    }

    // 用户名查重
    if (await db.getUserByUsername(c.env.DB, username)) return json({ ok: false, err: 'username_taken' }, 400);

    let role;
    if (code === OWNER_CODE) {
      // 所有者引导注册码:整个系统仅允许一个 owner
      if (await db.hasOwner(c.env.DB)) return json({ ok: false, err: 'owner_exists' }, 400);
      role = 'owner';
    } else {
      const row = await db.getInvite(c.env.DB, code);
      if (!row || row.disabled) return json({ ok: false, err: 'invalid_code' }, 400);
      if (row.used_count >= row.max_uses) return json({ ok: false, err: 'exhausted' }, 400);
      if (!['admin', 'user'].includes(row.role)) return json({ ok: false, err: 'bad_code_role' }, 400);
      role = row.role;
      await db.consumeInvite(c.env.DB, code);
    }

    const hash = await hashPassword(password);
    const ins = await db.createUser(c.env.DB, { username, passwordHash: hash, fingerprint, role, inviteCode: code });
    const uid = ins.meta.last_row_id;
    const token = await signSession({ uid, role, username }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, SESSION_TTL));
    return json({ ok: true, role, username });
  });

  // 登录:账号密码
  r.post('/login', async (c) => {
    const { username, password } = await c.req.json().catch(() => ({}));
    if (!username || !password) return json({ ok: false, err: 'missing' }, 400);
    const u = await db.getUserByUsername(c.env.DB, username);
    if (!u) return json({ ok: false, err: 'wrong' }, 401);
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) return json({ ok: false, err: 'wrong' }, 401);
    if (u.role === 'user') return json({ ok: false, err: 'no_backend_access' }, 403);
    const token = await signSession({ uid: u.id, role: u.role, username: u.username }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, SESSION_TTL));
    return json({ ok: true, role: u.role, username: u.username });
  });

  // 所有者应急:凭 OWNER_PASSWORD 重置密码并登录
  r.post('/emergency', async (c) => {
    const { username, password } = await c.req.json().catch(() => ({}));
    if (!username || !password) return json({ ok: false, err: 'missing' }, 400);
    if (!c.env.OWNER_PASSWORD) return json({ ok: false, err: 'no_owner_secret' }, 500);
    if (!await safeEqual(password, c.env.OWNER_PASSWORD)) return json({ ok: false, err: 'wrong' }, 401);
    const u = await db.getUserByUsername(c.env.DB, username);
    if (!u) return json({ ok: false, err: 'wrong' }, 401);
    if (u.role !== 'owner') return json({ ok: false, err: 'not_owner' }, 403);
    // 同步密码哈希,以便后续正常登录
    const hash = await hashPassword(password);
    await db.setUserPassword(c.env.DB, u.id, hash);
    const token = await signSession({ uid: u.id, role: 'owner', username: u.username }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, SESSION_TTL));
    return json({ ok: true, role: 'owner', username: u.username });
  });

  // 登出
  r.post('/logout', (c) => {
    c.header('Set-Cookie', cookieHeader('session', '', 0));
    return json({ ok: true });
  });

  return r;
}