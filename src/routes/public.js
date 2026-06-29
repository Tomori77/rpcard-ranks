// 公开 API:不需要登录的端点(me/boards/ranking/cards/like/rate/img)

import { Hono } from 'hono';
import { json } from '../core/http.js';
import * as db from '../core/db.js';
import * as storage from '../core/storage.js';
import { withCache, bustRanking } from '../core/cache.js';
import { sessionMiddleware } from '../middleware.js';

const RATING_LIST = ['D', 'C', 'B', 'A', 'S'];

export default function publicRoutes() {
  const r = new Hono();
  r.use('*', sessionMiddleware);

  // 当前会话
  r.get('/me', (c) => {
    const s = c.get('session');
    if (!s) return json({ ok: true, role: null });
    return json({ ok: true, role: s.role, uid: s.uid, username: s.username || null });
  });

  // 榜单列表(任何人都可看)
  r.get('/boards', async (c) => {
    const data = await db.listBoards(c.env.DB);
    return json({ ok: true, data });
  });

  // 排行榜(轮询用,15s 缓存)
  r.get('/ranking', async (c) => {
    const board = parseInt(c.req.query('board') || '1', 10);
    const sort = c.req.query('sort') || 'rating';
    const data = await withCache(c.env.CACHE, `rank:${board}:${sort}`, 15, () =>
      db.listRanking(c.env.DB, board, sort)
    );
    return json({ ok: true, data });
  });

  // 卡片详情
  r.get('/cards/:id', async (c) => {
    const id = c.req.param('id');
    const fp = c.req.query('fp');
    const card = await db.getCard(c.env.DB, id);
    if (!card) return json({ ok: false, err: 'not_found' }, 404);
    const [reviews, stats] = await Promise.all([
      db.listReviews(c.env.DB, id),
      db.getCardStats(c.env.DB, id, fp),
    ]);
    return json({ ok: true, data: { card, reviews, ...stats } });
  });

  // 点赞 toggle(指纹去重,再点取消)
  r.post('/cards/:id/like', async (c) => {
    const { fingerprint } = await c.req.json().catch(() => ({}));
    if (!fingerprint) return json({ ok: false, err: 'no_fp' }, 400);
    const id = c.req.param('id');
    try {
      const { liked } = await db.toggleLike(c.env.DB, id, fingerprint);
      await bustRanking(c.env.CACHE);
      return json({ ok: true, liked });
    } catch (e) {
      return json({ ok: false, err: e.message }, 400);
    }
  });

  // 用户评级(必须已点赞)
  r.post('/cards/:id/rate', async (c) => {
    const { fingerprint, rating } = await c.req.json().catch(() => ({}));
    if (!fingerprint) return json({ ok: false, err: 'no_fp' }, 400);
    if (!RATING_LIST.includes(rating)) return json({ ok: false, err: 'bad_rating' }, 400);
    const id = c.req.param('id');
    const liked = await db.hasLiked(c.env.DB, id, fingerprint);
    if (!liked) return json({ ok: false, err: 'must_like_first' }, 400);
    await db.saveRating(c.env.DB, id, fingerprint, rating);
    await bustRanking(c.env.CACHE);
    return json({ ok: true });
  });

  // R2 图片代理
  r.get('/img', async (c) => {
    const res = await storage.getImage(c.env.IMAGES, c.req.query('key'));
    return res || new Response('not found', { status: 404 });
  });

  return r;
}