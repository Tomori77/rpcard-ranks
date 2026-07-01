// 所有者管理 API:全部卡片 + 榜单 CRUD

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import { bustRanking } from '../core/cache.js';
import { requireAdmin } from '../middleware.js';

export default function adminRoutes() {
  const r = new Hono();
  r.use('*', requireAdmin);

  // 全部卡片
  r.get('/admin/cards', async (c) => {
    const data = await db.listAllCards(c.env.d1);
    return json({ ok: true, data });
  });

  // 榜单 CRUD
  r.post('/admin/boards', async (c) => {
    const { name, sort_order } = await c.req.json();
    if (!name) return json({ ok: false, err: 'missing' }, 400);
    await db.createBoard(c.env.d1, { name, sortOrder: sort_order || 0 });
    await bustRanking(c.env.kv);
    return json({ ok: true });
  });

  r.delete('/admin/boards/:id', async (c) => {
    await db.deleteBoard(c.env.d1, c.req.param('id'));
    await bustRanking(c.env.kv);
    return json({ ok: true });
  });

  return r;
}