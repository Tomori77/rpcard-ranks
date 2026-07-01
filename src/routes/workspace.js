// 工作台 API:发卡/上传图片/改卡/写评价/评论预设。仅所有者可用

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import * as storage from '../core/storage.js';
import { bustRanking, getReviewPreset, setReviewPreset } from '../core/cache.js';
import { requireAdmin } from '../middleware.js';

const RATING_LIST = ['D', 'C', 'B', 'A', 'S'];
const AUTHOR_ID = 0;

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

  // 评论预设:读取
  r.get('/preset', async (c) => {
    const content = await getReviewPreset(c.env.kv);
    return json({ ok: true, content });
  });

  // 评论预设:修改
  r.put('/preset', async (c) => {
    const { content } = await c.req.json();
    await setReviewPreset(c.env.kv, content || '');
    return json({ ok: true });
  });

  // 自己的卡片 + 全部榜单
  r.get('/workspace/me', async (c) => {
    const [cards, boards] = await Promise.all([
      db.listCardsByAuthor(c.env.d1, AUTHOR_ID),
      db.listBoards(c.env.d1),
    ]);
    return json({ ok: true, data: { cards, boards } });
  });

  // 发布新卡片(同时写入评论 = 预设 + 用户评论)
  r.post('/workspace/cards', async (c) => {
    const { name, image_key, owner_rating, board_id, review } = await c.req.json();
    if (!name || !image_key) return json({ ok: false, err: 'missing' }, 400);
    if (!RATING_LIST.includes(owner_rating || 'D')) return json({ ok: false, err: 'bad_rating' }, 400);
    const bid = board_id || 1;
    const ins = await db.createCard(c.env.d1, {
      boardId: bid, name, imageKey: image_key, ownerRating: owner_rating, authorId: AUTHOR_ID,
    });
    const cardId = ins.meta.last_row_id;
    // 拼接预设 + 评论
    if (review && review.trim()) {
      const preset = await getReviewPreset(c.env.kv);
      const fullReview = (preset ? preset + '\\n' : '') + review.trim();
      await db.upsertReview(c.env.d1, cardId, AUTHOR_ID, fullReview);
    }
    await bustRanking(c.env.kv);
    return json({ ok: true, id: cardId });
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