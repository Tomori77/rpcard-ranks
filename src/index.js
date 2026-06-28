import { Hono } from 'hono';
import {
  RATING_ORDER, RATING_LIST,
  sha256, signSession, verifySession, cookieHeader, parseCookies,
  genInviteCode, getOrCreateUser,
  withCache, json, html,
} from './lib.js';
import { render } from './views.js';

const app = new Hono();

// ====== 中间件:注入 env.user / 注入当前用户对象 ======
app.use('*', async (c, next) => {
  c.env.c = c; // 兼容
  const cookies = parseCookies(c.req.raw);
  let session = null;
  if (cookies.session) {
    session = await verifySession(cookies.session, c.env.SESSION_SECRET);
  }
  c.set('session', session); // 可能 null
  await next();
});

// ====== 页面:首页(排行榜) ======
app.get('/', (c) => html(render('home', { boards: [], session: c.get('session') })));
app.get('/card/:id', (c) => html(render('card', { id: c.req.param('id'), session: c.get('session') })));

// ====== 注册页 ======
app.get('/register', (c) => html(render('register', { presetCode: c.req.query('code') || '', session: c.get('session') })));

// ====== 工作台(管理员) ======
app.get('/workspace', (c) => {
  const s = c.get('session');
  if (!s || (s.role !== 'admin' && s.role !== 'owner')) {
    return c.redirect('/login?next=/workspace');
  }
  return html(render('workspace', { session: s }));
});

// ====== 所有者后台 ======
app.get('/admin', (c) => {
  const s = c.get('session');
  if (!s || s.role !== 'owner') return c.redirect('/admin/login');
  return html(render('admin', { session: s }));
});

app.get('/admin/login', (c) => html(render('admin_login', { session: c.get('session') })));

// ====== 登录页(管理员/所有者共用) ======
app.get('/login', (c) => html(render('login', { next: c.req.query('next') || '/workspace', session: c.get('session') })));

// ====== API ======
app.route('/api', apiRoutes());

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};

// =================================================================
// API 子路由:封装为函数便于引用 lib
// =================================================================
function apiRoutes() {
  const api = new Hono();

  // 注入 env.DB / CACHE / IMAGES 实际引用(便于 api 子路由访问)
  api.use('*', async (c, next) => {
    if (!c.env) c.env = {};
    await next();
  });

  // ---- 当前会话信息(前端 whoami 用) ----
  api.get('/me', (c) => {
    const s = c.get('session');
    if (!s) return json({ ok: true, role: null });
    return json({ ok: true, role: s.role, uid: s.uid });
  });

  // ---- 排行榜 ----
  api.get('/ranking', async (c) => {
    const board = parseInt(c.req.query('board') || '1', 10);
    const sort = c.req.query('sort') || 'rating'; // rating / likes / median
    const cacheKey = `rank:${board}:${sort}`;
    const data = await withCache(c.env.CACHE, cacheKey, 15, async () => {
      return await queryRanking(c.env, board, sort);
    });
    return json({ ok: true, data });
  });

  // ---- 榜单列表 ----
  api.get('/boards', async (c) => {
    const r = await c.env.DB.prepare('SELECT * FROM boards ORDER BY sort_order, id').all();
    return json({ ok: true, data: r.results });
  });

  // ---- 卡片详情 ----
  api.get('/cards/:id', async (c) => {
    const id = c.req.param('id');
    const fp = c.req.query('fp');
    const card = await c.env.DB.prepare(`
      SELECT c.*, u.fingerprint AS author_fp, u.role AS author_role
      FROM cards c LEFT JOIN users u ON u.id = c.author_id
      WHERE c.id = ?`).bind(id).first();
    if (!card) return json({ ok: false, err: 'not_found' }, 404);

    // 评价
    const reviews = await c.env.DB.prepare(`
      SELECT r.*, u.fingerprint AS author_fp, u.role AS author_role
      FROM reviews r LEFT JOIN users u ON u.id = r.author_id
      WHERE r.card_id = ? ORDER BY r.created_at`).bind(id).all();

    // 点赞数 + 用户评级分布
    const likeCount = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM likes WHERE card_id = ?').bind(id).first();
    const dist = await c.env.DB.prepare(`
      SELECT rating, COUNT(*) AS n FROM user_ratings
      WHERE card_id = ? AND rating IS NOT NULL
      GROUP BY rating`).bind(id).all();

    // 当前用户的点赞/评级状态
    let mine = { liked: false, rating: null };
    if (fp) {
      const l = await c.env.DB.prepare('SELECT 1 FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(id, fp).first();
      const r = await c.env.DB.prepare('SELECT rating FROM user_ratings WHERE card_id = ? AND user_fingerprint = ?').bind(id, fp).first();
      mine = { liked: !!l, rating: r?.rating || null };
    }

    return json({ ok: true, data: { card, reviews, likeCount: likeCount.n, dist: dist.results, mine } });
  });

  // ---- 点赞(指纹去重) ----
  api.post('/cards/:id/like', async (c) => {
    const { fingerprint } = await c.req.json().catch(() => ({}));
    if (!fingerprint) return json({ ok: false, err: 'no_fp' }, 400);
    const id = c.req.param('id');
    try {
      await c.env.DB.prepare('INSERT OR IGNORE INTO likes(card_id, user_fingerprint) VALUES(?, ?)').bind(id, fingerprint).run();
      // 同时为 user_ratings 占位(无评级)
      await c.env.DB.prepare('INSERT OR IGNORE INTO user_ratings(card_id, user_fingerprint, rating) VALUES(?, ?, NULL)').bind(id, fingerprint).run();
    } catch (e) {
      return json({ ok: false, err: e.message }, 400);
    }
    await invalidate(c.env, id);
    return json({ ok: true });
  });

  // ---- 用户评级(必须已点赞) ----
  api.post('/cards/:id/rate', async (c) => {
    const { fingerprint, rating } = await c.req.json().catch(() => ({}));
    if (!fingerprint) return json({ ok: false, err: 'no_fp' }, 400);
    if (!RATING_LIST.includes(rating)) return json({ ok: false, err: 'bad_rating' }, 400);
    const id = c.req.param('id');
    // 校验是否已点赞
    const liked = await c.env.DB.prepare('SELECT 1 FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(id, fingerprint).first();
    if (!liked) return json({ ok: false, err: 'must_like_first' }, 400);
    await c.env.DB.prepare(`INSERT INTO user_ratings(card_id, user_fingerprint, rating) VALUES(?, ?, ?)
      ON CONFLICT(card_id, user_fingerprint) DO UPDATE SET rating = excluded.rating`)
      .bind(id, fingerprint, rating).run();
    await invalidate(c.env, id);
    return json({ ok: true });
  });

  // ---- 上传图片(R2) ----
  api.post('/upload', async (c) => {
    const s = c.get('session');
    if (!s || (s.role !== 'admin' && s.role !== 'owner')) return json({ ok: false, err: 'forbidden' }, 403);
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ ok: false, err: 'no_file' }, 400);
    const buf = await file.arrayBuffer();
    const key = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${(file.type.split('/')[1] || 'jpg')}`;
    await c.env.IMAGES.put(key, buf, { httpMetadata: { contentType: file.type } });
    return json({ ok: true, key });
  });

  // ---- 图片代理(从 R2 读) ----
  api.get('/img', async (c) => {
    const key = c.req.query('key');
    if (!key) return new Response('not found', { status: 404 });
    const obj = await c.env.IMAGES.get(key);
    if (!obj) return new Response('not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(obj.body, { headers });
  });

  // ---- 工作台:获取自己的卡片 + 全部榜单(选择) ----
  api.get('/workspace/me', async (c) => {
    const s = c.get('session');
    if (!s || (s.role !== 'admin' && s.role !== 'owner')) return json({ ok: false, err: 'forbidden' }, 403);
    const r = await c.env.DB.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
        (SELECT content FROM reviews WHERE card_id = c.id AND author_id = ?) AS my_review
      FROM cards c WHERE author_id = ? ORDER BY c.created_at DESC`).bind(s.uid, s.uid).all();
    const boards = await c.env.DB.prepare('SELECT * FROM boards ORDER BY sort_order, id').all();
    return json({ ok: true, data: { cards: r.results, boards: boards.results } });
  });

  // ---- 工作台:创建卡片 ----
  api.post('/workspace/cards', async (c) => {
    const s = c.get('session');
    if (!s || (s.role !== 'admin' && s.role !== 'owner')) return json({ ok: false, err: 'forbidden' }, 403);
    const { name, image_key, owner_rating, board_id } = await c.req.json();
    if (!name || !image_key) return json({ ok: false, err: 'missing' }, 400);
    if (!RATING_LIST.includes(owner_rating || 'D')) return json({ ok: false, err: 'bad_rating' }, 400);
    const bid = board_id || 1;
    const r = await c.env.DB.prepare(
      `INSERT INTO cards(board_id, name, image_key, owner_rating, author_id) VALUES(?, ?, ?, ?, ?)`
    ).bind(bid, name, image_key, owner_rating, s.uid).run();
    await invalidate(c.env, null);
    return json({ ok: true, id: r.meta.last_row_id });
  });

  // ---- 工作台:修改只读字段(仅作者==自己 / 所有者任意) ----
  api.patch('/cards/:id', async (c) => {
    const s = c.get('session');
    if (!s || (s.role !== 'admin' && s.role !== 'owner')) return json({ ok: false, err: 'forbidden' }, 403);
    const id = c.req.param('id');
    const card = await c.env.DB.prepare('SELECT author_id FROM cards WHERE id = ?').bind(id).first();
    if (!card) return json({ ok: false, err: 'not_found' }, 404);
    if (card.author_id !== s.uid && s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const body = await c.req.json();
    const fields = [];
    const vals = [];
    for (const k of ['name', 'owner_rating', 'board_id']) {
      if (body[k] !== undefined) { fields.push(`${k} = ?`); vals.push(body[k]); }
    }
    if (body.image_key) { fields.push('image_key = ?'); vals.push(body.image_key); }
    if (fields.length === 0) return json({ ok: false, err: 'empty' }, 400);
    vals.push(id);
    await c.env.DB.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    await invalidate(c.env, id);
    return json({ ok: true });
  });

  // ---- 评价(创建/更新 own review) ----
  api.put('/cards/:id/review', async (c) => {
    const s = c.get('session');
    if (!s || (s.role !== 'admin' && s.role !== 'owner')) return json({ ok: false, err: 'forbidden' }, 403);
    const id = c.req.param('id');
    const { content } = await c.req.json();
    if (!content) return json({ ok: false, err: 'empty' }, 400);
    await c.env.DB.prepare(`
      INSERT INTO reviews(card_id, author_id, content) VALUES(?, ?, ?)
      ON CONFLICT(card_id, author_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')
    `).bind(id, s.uid, content).run();
    return json({ ok: true });
  });

  // ---- 所有者:管理卡片(可任意删) ----
  api.delete('/cards/:id', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
    await invalidate(c.env, id);
    return json({ ok: true });
  });

  // ---- 所有者:列出全部卡片 ----
  api.get('/admin/cards', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const r = await c.env.DB.prepare(`
      SELECT c.*, b.name AS board_name, u.fingerprint AS author_fp,
        (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
        (SELECT COUNT(*) FROM reviews WHERE card_id = c.id) AS review_count
      FROM cards c
      LEFT JOIN boards b ON b.id = c.board_id
      LEFT JOIN users u ON u.id = c.author_id
      ORDER BY c.created_at DESC`).all();
    return json({ ok: true, data: r.results });
  });

  // ---- 所有者:邀请码 CRUD ----
  api.get('/admin/invites', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const r = await c.env.DB.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC').all();
    return json({ ok: true, data: r.results });
  });

  api.post('/admin/invites', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const { role, max_uses, code } = await c.req.json();
    const finalCode = code?.trim() || genInviteCode();
    if (!['admin', 'user'].includes(role || 'user')) return json({ ok: false, err: 'bad_role' }, 400);
    const uses = Math.max(1, parseInt(max_uses || 1, 10));
    try {
      await c.env.DB.prepare(
        'INSERT INTO invite_codes(code, role, max_uses) VALUES(?, ?, ?) ON CONFLICT(code) DO UPDATE SET role=excluded.role, max_uses=excluded.max_uses'
      ).bind(finalCode, role, uses).run();
    } catch (e) {
      return json({ ok: false, err: e.message }, 400);
    }
    return json({ ok: true, code: finalCode });
  });

  api.patch('/admin/invites/:code', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const code = c.req.param('code');
    const { role, max_uses, disabled } = await c.req.json();
    const sets = [];
    const vals = [];
    if (role) { sets.push('role = ?'); vals.push(role); }
    if (max_uses !== undefined) { sets.push('max_uses = ?'); vals.push(Math.max(0, parseInt(max_uses, 10))); }
    if (disabled !== undefined) { sets.push('disabled = ?'); vals.push(disabled ? 1 : 0); }
    if (sets.length === 0) return json({ ok: false, err: 'empty' }, 400);
    vals.push(code);
    await c.env.DB.prepare(`UPDATE invite_codes SET ${sets.join(', ')} WHERE code = ?`).bind(...vals).run();
    return json({ ok: true });
  });

  api.delete('/admin/invites/:code', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    await c.env.DB.prepare('DELETE FROM invite_codes WHERE code = ?').bind(c.req.param('code')).run();
    return json({ ok: true });
  });

  // ---- 所有者:用户列表 ----
  api.get('/admin/users', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const r = await c.env.DB.prepare('SELECT id, fingerprint, role, invite_code, created_at FROM users ORDER BY created_at DESC').all();
    return json({ ok: true, data: r.results });
  });

  api.patch('/admin/users/:id', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const { role } = await c.req.json();
    if (!['owner', 'admin', 'user'].includes(role)) return json({ ok: false, err: 'bad_role' }, 400);
    await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, c.req.param('id')).run();
    return json({ ok: true });
  });

  // ---- 所有者:榜单 CRUD ----
  api.post('/admin/boards', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    const { name, sort_order } = await c.req.json();
    if (!name) return json({ ok: false, err: 'missing' });
    const r = await c.env.DB.prepare('INSERT INTO boards(name, sort_order) VALUES(?, ?)').bind(name, sort_order || 0).run();
    await invalidate(c.env, null);
    return json({ ok: true, id: r.meta.last_row_id });
  });

  api.delete('/admin/boards/:id', async (c) => {
    const s = c.get('session');
    if (!s || s.role !== 'owner') return json({ ok: false, err: 'forbidden' }, 403);
    await c.env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(c.req.param('id')).run();
    await invalidate(c.env, null);
    return json({ ok: true });
  });

  // ---- 注册:用邀请码落地管理员/普通用户 ----
  api.post('/register', async (c) => {
    const { code, fingerprint } = await c.req.json();
    if (!code || !fingerprint) return json({ ok: false, err: 'missing' }, 400);
    const row = await c.env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();
    if (!row || row.disabled) return json({ ok: false, err: 'invalid_code' }, 400);
    if (row.used_count >= row.max_uses) return json({ ok: false, err: 'exhausted' }, 400);

    // 已存在用户:更新角色
    const exist = await c.env.DB.prepare('SELECT id FROM users WHERE fingerprint = ?').bind(fingerprint).first();
    if (exist) {
      await c.env.DB.prepare('UPDATE users SET role = ?, invite_code = ? WHERE id = ?').bind(row.role, code, exist.id).run();
    } else {
      await c.env.DB.prepare('INSERT INTO users(fingerprint, role, invite_code) VALUES(?, ?, ?)').bind(fingerprint, row.role, code).run();
    }
    // 邀请码 +1
    await c.env.DB.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ?').bind(code).run();

    // 颁发会话 cookie
    const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE fingerprint = ?').bind(fingerprint).first();
    const token = await signSession({ uid: user.id, role: user.role }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, 7 * 86400));
    return json({ ok: true, role: user.role });
  });

  // ---- 登录(管理员):指纹 + 一次性激活码 = 复用邀请码? 简化:用户首次已注册即用指纹登录 ----
  api.post('/login', async (c) => {
    const { fingerprint } = await c.req.json();
    if (!fingerprint) return json({ ok: false, err: 'no_fp' }, 400);
    const u = await c.env.DB.prepare('SELECT id, role FROM users WHERE fingerprint = ?').bind(fingerprint).first();
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return json({ ok: false, err: 'not_registered' }, 403);
    const token = await signSession({ uid: u.id, role: u.role }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, 7 * 86400));
    return json({ ok: true, role: u.role });
  });

  // ---- 所有者后台登录:密码 ----
  api.post('/admin/login', async (c) => {
    const { password } = await c.req.json();
    if (!password) return json({ ok: false, err: 'no_pw' }, 400);
    const ok = await safeCompare(password, c.env.OWNER_PASSWORD);
    if (!ok) return json({ ok: false, err: 'wrong' }, 401);
    // 找到或创建 owner 用户(用固定 fingerprint 占位)
    const ow_fp = '__owner__' + (await sha256(c.env.OWNER_PASSWORD)).slice(0, 16);
    let u = await c.env.DB.prepare('SELECT id FROM users WHERE fingerprint = ?').bind(ow_fp).first();
    if (!u) {
      const r = await c.env.DB.prepare('INSERT INTO users(fingerprint, role) VALUES(?, ?)').bind(ow_fp, 'owner').run();
      u = { id: r.meta.last_row_id };
    }
    const token = await signSession({ uid: u.id, role: 'owner' }, c.env.SESSION_SECRET);
    c.header('Set-Cookie', cookieHeader('session', token, 7 * 86400));
    return json({ ok: true });
  });

  // ---- 登出 ----
  api.post('/logout', (c) => {
    c.header('Set-Cookie', cookieHeader('session', '', 0));
    return json({ ok: true });
  });

  return api;
}

// ====== 排行榜查询(可切换排序) ======
async function queryRanking(env, board, sort) {
  const order =
    sort === 'likes' ? 'like_count DESC, c.owner_rating DESC' :
    sort === 'median' ? 'median DESC, like_count DESC' :
    `CASE c.owner_rating WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 ELSE 1 END DESC, like_count DESC`;
  const r = await env.DB.prepare(`
    SELECT c.id, c.name, c.image_key, c.owner_rating, c.author_id,
      (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
      (SELECT AVG(CASE ur.rating WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 END)
         FROM user_ratings ur WHERE ur.card_id = c.id AND ur.rating IS NOT NULL) AS median
    FROM cards c WHERE c.board_id = ?
    ORDER BY ${order} Limit 200`).bind(board).all();
  return r.results;
}

// ====== 缓存失效:简单策略 —— 写操作时清空所有 rank:* ======
async function invalidate(env, cardId) {
  const list = await env.CACHE.list({ prefix: 'rank:' });
  await Promise.all((list.keys || []).map(k => env.CACHE.delete(k.name)));
}

// 时序安全比较
async function safeCompare(a, b) {
  const ea = await sha256(String(a));
  const eb = await sha256(String(b));
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea.charCodeAt(i) ^ eb.charCodeAt(i);
  return diff === 0;
}