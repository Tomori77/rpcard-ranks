// D1 仓储层:所有 SQL 收口于此。每个函数第一参为 db 实例,返回 Promise<数据>。
// 不含任何 HTTP/角色概念,权限校验在 routes 层。

const RATING_CASE = `CASE c.owner_rating WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 ELSE 1 END`;

// ============ boards ============
export const listBoards = (db) =>
  db.prepare('SELECT * FROM boards ORDER BY sort_order, id').all().then(r => r.results);

export const createBoard = (db, { name, sortOrder = 0 }) =>
  db.prepare('INSERT INTO boards(name, sort_order) VALUES(?, ?)').bind(name, sortOrder).run();

export const deleteBoard = (db, id) =>
  db.prepare('DELETE FROM boards WHERE id = ?').bind(id).run();

// ============ cards ============
export const getCard = (db, id) =>
  db.prepare(`SELECT c.*, u.fingerprint AS author_fp, u.role AS author_role
    FROM cards c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?`).bind(id).first();

export const listRanking = (db, boardId, sort) => {
  const order =
    sort === 'likes' ? 'like_count DESC, c.owner_rating DESC' :
    sort === 'median' ? 'median DESC, like_count DESC' :
    `${RATING_CASE} DESC, like_count DESC`;
  return db.prepare(`
    SELECT c.id, c.name, c.image_key, c.owner_rating, c.author_id,
      (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
      (SELECT AVG(CASE ur.rating WHEN 'S' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 END)
         FROM user_ratings ur WHERE ur.card_id = c.id AND ur.rating IS NOT NULL) AS median
    FROM cards c WHERE c.board_id = ? ORDER BY ${order} LIMIT 200`).bind(boardId).all().then(r => r.results);
};

export const listCardsByAuthor = (db, authorId) =>
  db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
    (SELECT content FROM reviews WHERE card_id = c.id AND author_id = ?) AS my_review
    FROM cards c WHERE author_id = ? ORDER BY c.created_at DESC`).bind(authorId, authorId).all().then(r => r.results);

export const listAllCards = (db) =>
  db.prepare(`SELECT c.*, b.name AS board_name, u.fingerprint AS author_fp,
    (SELECT COUNT(*) FROM likes WHERE card_id = c.id) AS like_count,
    (SELECT COUNT(*) FROM reviews WHERE card_id = c.id) AS review_count
    FROM cards c LEFT JOIN boards b ON b.id = c.board_id LEFT JOIN users u ON u.id = c.author_id
    ORDER BY c.created_at DESC`).all().then(r => r.results);

export const createCard = (db, { boardId, name, imageKey, ownerRating, authorId }) =>
  db.prepare('INSERT INTO cards(board_id, name, image_key, owner_rating, author_id) VALUES(?, ?, ?, ?, ?)')
    .bind(boardId, name, imageKey, ownerRating, authorId).run();

export const getCardAuthor = (db, id) =>
  db.prepare('SELECT author_id FROM cards WHERE id = ?').bind(id).first();

// fields = { name?, ownerRating?, boardId?, imageKey? } 中任意子集
export const updateCardFields = async (db, id, fields) => {
  const sets = [], vals = [];
  const map = { name: 'name', ownerRating: 'owner_rating', boardId: 'board_id', imageKey: 'image_key' };
  for (const k in map) if (fields[k] !== undefined) { sets.push(`${map[k]} = ?`); vals.push(fields[k]); }
  if (!sets.length) return;
  vals.push(id);
  await db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
};

export const deleteCard = (db, id) =>
  db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();

// 卡片详情的统计:点赞数 + 评级分布 + 当前用户(指纹)状态
export const getCardStats = async (db, id, fp) => {
  const likeCount = await db.prepare('SELECT COUNT(*) AS n FROM likes WHERE card_id = ?').bind(id).first();
  const dist = await db.prepare(`SELECT rating, COUNT(*) AS n FROM user_ratings
    WHERE card_id = ? AND rating IS NOT NULL GROUP BY rating`).bind(id).all().then(r => r.results);
  let mine = { liked: false, rating: null };
  if (fp) {
    const l = await db.prepare('SELECT 1 FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(id, fp).first();
    const r = await db.prepare('SELECT rating FROM user_ratings WHERE card_id = ? AND user_fingerprint = ?').bind(id, fp).first();
    mine = { liked: !!l, rating: r?.rating || null };
  }
  return { likeCount: likeCount.n, dist, mine };
};

// ============ reviews ============
export const listReviews = (db, cardId) =>
  db.prepare(`SELECT r.*, u.fingerprint AS author_fp, u.role AS author_role
    FROM reviews r LEFT JOIN users u ON u.id = r.author_id
    WHERE r.card_id = ? ORDER BY r.created_at`).bind(cardId).all().then(r => r.results);

export const upsertReview = (db, cardId, authorId, content) =>
  db.prepare(`INSERT INTO reviews(card_id, author_id, content) VALUES(?, ?, ?)
    ON CONFLICT(card_id, author_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`)
    .bind(cardId, authorId, content).run();

// ============ likes / user_ratings ============
// 返回 { liked } —— toggle 后的状态
export const toggleLike = async (db, cardId, fp) => {
  const liked = await db.prepare('SELECT 1 FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(cardId, fp).first();
  if (liked) {
    await db.prepare('DELETE FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(cardId, fp).run();
    await db.prepare('DELETE FROM user_ratings WHERE card_id = ? AND user_fingerprint = ?').bind(cardId, fp).run();
    return { liked: false };
  }
  await db.prepare('INSERT OR IGNORE INTO likes(card_id, user_fingerprint) VALUES(?, ?)').bind(cardId, fp).run();
  await db.prepare('INSERT OR IGNORE INTO user_ratings(card_id, user_fingerprint, rating) VALUES(?, ?, NULL)').bind(cardId, fp).run();
  return { liked: true };
};

export const hasLiked = (db, cardId, fp) =>
  db.prepare('SELECT 1 FROM likes WHERE card_id = ? AND user_fingerprint = ?').bind(cardId, fp).first().then(Boolean);

export const saveRating = (db, cardId, fp, rating) =>
  db.prepare(`INSERT INTO user_ratings(card_id, user_fingerprint, rating) VALUES(?, ?, ?)
    ON CONFLICT(card_id, user_fingerprint) DO UPDATE SET rating = excluded.rating`).bind(cardId, fp, rating).run();

// ============ users ============
export const getUserByUsername = (db, username) =>
  db.prepare('SELECT id, username, role, password_hash, invite_code FROM users WHERE username = ?').bind(username).first();

export const getUserByFingerprint = (db, fp) =>
  db.prepare('SELECT 1 FROM users WHERE fingerprint = ?').bind(fp).first();

export const getUserById = (db, id) =>
  db.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();

export const hasOwner = (db) =>
  db.prepare("SELECT 1 FROM users WHERE role = 'owner'").first();

export const createUser = (db, { username, passwordHash, fingerprint, role, inviteCode }) =>
  db.prepare('INSERT INTO users(username, password_hash, fingerprint, role, invite_code) VALUES(?, ?, ?, ?, ?)')
    .bind(username, passwordHash, fingerprint || null, role, inviteCode).run();

export const listUsers = (db) =>
  db.prepare('SELECT id, username, fingerprint, role, invite_code, created_at FROM users ORDER BY created_at DESC').all().then(r => r.results);

export const setUserRole = (db, id, role) =>
  db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();

export const setUserPassword = (db, id, hash) =>
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, id).run();

// ============ invite_codes ============
export const getInvite = (db, code) =>
  db.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();

export const listInvites = (db) =>
  db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC').all().then(r => r.results);

export const upsertInvite = (db, { code, role, maxUses }) =>
  db.prepare('INSERT INTO invite_codes(code, role, max_uses) VALUES(?, ?, ?) ON CONFLICT(code) DO UPDATE SET role=excluded.role, max_uses=excluded.max_uses')
    .bind(code, role, maxUses).run();

export const patchInvite = async (db, code, fields) => {
  const sets = [], vals = [];
  if (fields.role) { sets.push('role = ?'); vals.push(fields.role); }
  if (fields.maxUses !== undefined) { sets.push('max_uses = ?'); vals.push(Math.max(0, fields.maxUses)); }
  if (fields.disabled !== undefined) { sets.push('disabled = ?'); vals.push(fields.disabled ? 1 : 0); }
  if (!sets.length) return;
  vals.push(code);
  await db.prepare(`UPDATE invite_codes SET ${sets.join(', ')} WHERE code = ?`).bind(...vals).run();
};

export const deleteInvite = (db, code) =>
  db.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code).run();

export const consumeInvite = (db, code) =>
  db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ?').bind(code).run();