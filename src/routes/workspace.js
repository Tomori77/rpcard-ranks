// 工作台 API:发卡/上传图片/改卡/写评价。仅所有者可用

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import * as storage from '../core/storage.js';
import { bustRanking } from '../core/cache.js';
import { requireAdmin } from '../middleware.js';

const RATING_LIST = ['D', 'C', 'B', 'A', 'S'];
const AUTHOR_ID = 0; // 单所有者模式,固定为 0

export default function workspaceRoutes() {
  const r = new Hono();
  r.use('*', requireAdmin);

  // 上传图片(R2)
  r.post('/upload', async (c) => {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ ok: false, err: 'no_file' }, 400);
    const { key } = await storage.uploadImage(c.env.r2, file);
    return json({ ok: true, key });
  });

  // 自己的卡片 + 全部榜单
  r.get('/workspace/me', async (c) => {
    const [cards, boards] = await Promise.all([
      db.listCardsByAuthor(c.env.d1, AUTHOR_ID),
      db.listBoards(c.env.d1),
    ]);
    return json({ ok: true, data: { cards, boards } });
  });

  // 发布新卡片
  r.post('/workspace/cards', async (c) => {
    const { name, image_key, owner_rating, board_id } = await c.req.json();
    if (!name || !image_key) return json({ ok: false, err: 'missing' }, 400);
    if (!RATING_LIST.includes(owner_rating || 'D')) return json({ ok: false, err: 'bad_rating' }, 400);
    const bid = board_id || 1;
    await db.createCard(c.env.d1, {
      boardId: bid, name, imageKey: image_key, ownerRating: owner_rating, authorId: AUTHOR_ID,
    });
    await bustRanking(c.env.kv);
    return json({ ok: true });
  });

  // 修改卡片
  r.patch('/cards/:id', async (c) => {
    await db.updateCardFields(c.env.d1, c.req.param('id'), await c.req.json());
    await bustRanking(c.env.kv);
    return json({ ok: true });
  });

  // 写/更新评价
  r.put('/cards/:id/review', async (c) => {
    const { content } = await c.req.json();
    if (!content) return json({ ok: false, err: 'empty' }, 400);
    await db.upsertReview(c.env.d1, c.req.param('id'), AUTHOR_ID, content);
    return json({ ok: true });
  });

  // 删除卡片
  r.delete('/cards/:id', async (c) => {
    await db.deleteCard(c.env.d1, c.req.param('id'));
    await bustRanking(c.env.kv);
    return json({ ok: true });
  });

  return r;
}