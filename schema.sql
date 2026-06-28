-- rpcard-ranks D1 schema
-- 所有表 IF NOT EXISTS,可重复执行

-- 榜单
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 角色卡
-- owner_rating: 由上传者(管理员/所有者)给出的官方评级 D/C/B/A/S
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  image_key TEXT NOT NULL,
  owner_rating TEXT NOT NULL DEFAULT 'D',
  author_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cards_board ON cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_author ON cards(author_id);

-- 评价(一卡可多条,一作者一卡一条)
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(card_id, author_id),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- 用户(浏览器指纹追踪)
-- role: owner / admin / user
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  invite_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户对卡的点赞(指纹去重)
CREATE TABLE IF NOT EXISTS likes (
  card_id INTEGER NOT NULL,
  user_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (card_id, user_fingerprint),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- 用户对卡的评级(点赞后才解锁,一张卡一个用户只能一个)
-- rating: null = 仅点赞未评级
CREATE TABLE IF NOT EXISTS user_ratings (
  card_id INTEGER NOT NULL,
  user_fingerprint TEXT NOT NULL,
  rating TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (card_id, user_fingerprint),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- 邀请码
-- role: 注册成功后落地的角色 admin / user
-- max_uses: 总使用次数; used_count: 已使用次数; disabled=1 失效
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初始化一个默认榜单
INSERT OR IGNORE INTO boards(id, name, sort_order) VALUES (1, '总榜', 0);