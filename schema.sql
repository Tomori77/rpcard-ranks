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

-- 用户(账号密码 + 浏览器指纹)
-- role: owner / admin / user
-- username/password_hash/salt: 注册用户(需邀请码)拥有
-- fingerprint: 所有用户都有(匿名用户只有这个); 也可以为空字符串,UNIQUE 允许多个 NULL/空
-- 注意 SQLite 中 UNIQUE 列对 NULL 视为不同,这里用空字符串给匿名用户的指纹留位置
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,               -- 登录账号,匿名用户为 NULL
  password_hash TEXT,                  -- PBKDF2 哈希(包含 salt)
  fingerprint TEXT,                    -- 浏览器指纹(点赞去重); 匿名用户必填,注册用户也填
  role TEXT NOT NULL DEFAULT 'user',
  invite_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_fp ON users(fingerprint);

-- 老库迁移:如已部署过早期 schema,执行下面三行添加新列(SQLite 不支持 IF NOT EXISTS on ALTER)
-- ALTER TABLE users ADD COLUMN username TEXT;
-- ALTER TABLE users ADD COLUMN password_hash TEXT;
-- 然后用所有者登录后,后台"用户"标签中手动改角色

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