// 工作台 API:发卡/上传图片/改自己的卡/写评价。admin 与 owner 共用

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import * as storage from '../core/storage.js';
import { bustRanking } from '../core/cache.js';
import { sessionMiddleware, requireRole, uidOf } from '../middleware.js';

const RATING_LIST = ['D', 'C', 'B', 'A', 'S'];

export default function workspaceRoutes() {
  const r = new Hono();
  r.use('*', sessionMiddleware);
  r.use('*', requireRole('admin', 'owner'));

  // 上传图片(R2)
  r.post('/upload', async (c) => {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ ok: false, err: 'no_file' }, 400);
    const { key } = await storage.uploadImage(c.env.IMAGES, file);
    return json({ ok: true, key });
  });

  // 自己的卡片 + 全部榜单(用于发布下拉)
  r.get('/workspace/me', async (c) => {
    const uid = uidOf(c);
    const [cards, boards] = await Promise.all([
      db.listCardsByAuthor(c.env.DB, uid),
      db.listBoards(c.env.DB),
    ]);
    return json({ ok: true, data: { cards, boards } });
  });

  // 发布新卡片
  r.post('/workspace/cards', async (c) => {
    const { name, image_key, owner_rating, board_id } = await c.req.json();
    if (!name || !image_key) return json({ ok: false, err: 'missing' }, 400);
    if (!RATING_LIST.includes(owner_rating || 'D')) return json({ ok: false, err: 'bad_rating' }, 400);
    const bid = board_id || 1;
    await db.createCard(c.env.DB, {
      boardId: bid, name, imageKey: image_key, ownerRating: owner_rating, authorId: uidOf(c),
    });
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  // 修改卡片(仅作者本人或所有者)
  r.patch('/cards/:id', async (c) => {
    const id = c.req.param('id');
    const card = await db.getCardAuthor(c.env.DB, id);
    if (!card) return json({ ok: false, err: 'not_found' }, 404);
    const s = c.get('session');
    if (card.author_id !== s.uid && s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    await db.updateCardFields(c.env.DB, id, await c.req.json());
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  // 写/更新自己的评价
  r.put('/cards/:id/review', async (c) => {
    const { content } = await c.req.json();
    if (!content) return json({ ok: false, err: 'empty' }, 400);
    await db.upsertReview(c.env.DB, c.req.param('id'), uidOf(c), content);
    return json({ ok: true });
  });

  // 删除卡片(作者本人或所有者)
  r.delete('/cards/:id', async (c) => {
    const id = c.req.param('id');
    const card = await db.getCardAuthor(c.env.DB, id);
    if (!card) return json({ ok: false, err: 'not_found' }, 404);
    const s = c.get('session');
    if (card.author_id !== s.uid && s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    await db.deleteCard(c.env.DB, id);
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  return r;
}