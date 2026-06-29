// 所有者管理 API:全部卡片/邀请码/用户/榜单 CRUD + 重置他人密码

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import { genInviteCode } from './invite-code.js';
import { hashPassword } from '../core/crypto.js';
import { bustRanking } from '../core/cache.js';
import { sessionMiddleware, requireRole, uidOf } from '../middleware.js';

const PASSWORD_RE = /^[A-Za-z0-9]{5,}$/;
const OWNER_CODE = 'RPRPRP';
const ROLES = ['owner', 'admin', 'user'];

export default function adminRoutes() {
  const r = new Hono();
  r.use('*', sessionMiddleware);
  r.use('*', requireRole('owner'));

  // ============ 全部卡片 ============
  r.get('/admin/cards', async (c) => {
    const data = await db.listAllCards(c.env.DB);
    return json({ ok: true, data });
  });

  // ============ 邀请码 CRUD ============
  r.get('/admin/invites', async (c) => {
    const data = await db.listInvites(c.env.DB);
    return json({ ok: true, data });
  });

  r.post('/admin/invites', async (c) => {
    const { role, max_uses, code } = await c.req.json();
    const finalCode = (code?.trim()) || genInviteCode();
    if (finalCode === OWNER_CODE) return json({ ok: false, err: 'reserved_code' }, 400);
    if (!['admin', 'user'].includes(role || 'user')) return json({ ok: false, err: 'bad_role' }, 400);
    const uses = Math.max(1, parseInt(max_uses || 1, 10));
    try {
      await db.upsertInvite(c.env.DB, { code: finalCode, role, maxUses: uses });
      return json({ ok: true, code: finalCode });
    } catch (e) {
      return json({ ok: false, err: e.message }, 400);
    }
  });

  r.patch('/admin/invites/:code', async (c) => {
    const code = c.req.param('code');
    if (code === OWNER_CODE) return json({ ok: false, err: 'reserved_code' }, 400);
    const body = await c.req.json();
    const fields = {};
    if (body.role) fields.role = body.role;
    if (body.max_uses !== undefined) fields.maxUses = parseInt(body.max_uses, 10);
    if (body.disabled !== undefined) fields.disabled = body.disabled;
    await db.patchInvite(c.env.DB, code, fields);
    return json({ ok: true });
  });

  r.delete('/admin/invites/:code', async (c) => {
    if (c.req.param('code') === OWNER_CODE) return json({ ok: false, err: 'reserved_code' }, 400);
    await db.deleteInvite(c.env.DB, c.req.param('code'));
    return json({ ok: true });
  });

  // ============ 用户管理 ============
  r.get('/admin/users', async (c) => {
    const data = await db.listUsers(c.env.DB);
    return json({ ok: true, data });
  });

  r.patch('/admin/users/:id', async (c) => {
    const { role } = await c.req.json();
    if (!ROLES.includes(role)) return json({ ok: false, err: 'bad_role' }, 400);
    await db.setUserRole(c.env.DB, c.req.param('id'), role);
    return json({ ok: true });
  });

  // 重置他人密码(所有者代设)
  r.post('/admin/users/:id/reset', async (c) => {
    const { new_password } = await c.req.json();
    if (!PASSWORD_RE.test(new_password || '')) return json({ ok: false, err: 'weak_password' }, 400);
    const uid = c.req.param('id');
    const target = await db.getUserById(c.env.DB, uid);
    if (!target) return json({ ok: false, err: 'not_found' }, 404);
    if (target.role === 'owner' && String(uid) !== String(uidOf(c))) {
      return json({ ok: false, err: 'cannot_reset_other_owner' }, 403);
    }
    const hash = await hashPassword(new_password);
    await db.setUserPassword(c.env.DB, uid, hash);
    return json({ ok: true });
  });

  // ============ 榜单 CRUD ============
  r.post('/admin/boards', async (c) => {
    const { name, sort_order } = await c.req.json();
    if (!name) return json({ ok: false, err: 'missing' }, 400);
    await db.createBoard(c.env.DB, { name, sortOrder: sort_order || 0 });
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  r.delete('/admin/boards/:id', async (c) => {
    await db.deleteBoard(c.env.DB, c.req.param('id'));
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  return r;
}