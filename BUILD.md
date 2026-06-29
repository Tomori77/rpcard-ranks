# 重构构建步骤

> 目标:把当前单文件 3 个 js(`index.js` 460 行 / `views.js` 660 行 / `lib.js` 100 行)拆成低耦合的多模块结构。每个模块单一职责、接口稳定,可独立替换或单测。`wrangler.toml` 不动。

## 一、目录结构(目标)

```
rpcard-ranks/
├── wrangler.toml           # 不动
├── schema.sql               # 不动
├── package.json             # 不动
├── src/
│   ├── index.js             # 入口:装配 Hono + 挂载路由(只剩约 30 行胶水)
│   ├── middleware.js        # session 解析/角色守卫
│   │
│   ├── core/                # 核心层:纯逻辑,不依赖 Hono,可单测可替换
│   │   ├── crypto.js        # sha256/b64url/PBKDF2/会话签名
│   │   ├── db.js            # D1 仓储:boards/cards/users/likes/invites 各自函数
│   │   ├── storage.js       # R2 上传/读取
│   │   └── cache.js         # KV 缓存 + 失效
│   │
│   ├── routes/              # 路由层:Hono 路由,薄胶水,只做参数解析+调 core+返回 json
│   │   ├── public.js        # 公开:ranks/boards/cards/like/rate/img/me
│   │   ├── auth.js          # 认证:register/login/emergency/logout
│   │   ├── workspace.js     # 工作台:upload/my-cards/card CRUD/review
│   │   └── admin.js         # 所有者:cards/invites/users/boards
│   │
│   └── views/               # 视图层:HTML 模板,每页一文件
│       ├── shell.js         # 通用骨架(CSS/导航/公共脚本)
│       └── pages/
│           ├── home.js
│           ├── card.js
│           ├── register.js
│           ├── login.js
│           ├── emergency.js
│           └── admin.js
```

**层次依赖单向**:routes → core,views 被入口直接引用,routes/core 不引用 views。替换 DB(从 D1 换成 KV)只动 `core/db.js` + `schema.sql`;换前端框架只动 `views/`。

## 二、模块接口契约(写代码前先冻结)

每个 core 模块导出纯函数,不持有状态,全部依赖通过参数传入。这是解耦的关键。

### `core/crypto.js`
```js
export const sha256(text)                    // → hex 字符串
export const b64urlEncode(str) / b64urlDecode(str)
export const signSession(payload, secret)    // → "body.sig"
export const verifySession(token, secret)    // → payload | null
export const hashPassword(password)          // → "saltHex:hashHex"
export const verifyPassword(password, stored) // → boolean
```

### `core/db.js` (D1 仓储,每个领域一组函数,第一参永远是 `db`)
```js
// boards
export const listBoards(db)
// cards
export const getCard(db, id)
export const listRanking(db, boardId, sort)   // sort ∈ rating/likes/median
export const listCardsByAuthor(db, authorId)
export const listAllCards(db)                  // 所有者用
export const createCard(db, { boardId, name, imageKey, ownerRating, authorId })
export const updateCard(db, id, fields, actorUid, actorRole) // 权限校验在路由层
export const deleteCard(db, id)
export const getCardStats(db, id)             // like_count + dist + mine(fp)
// reviews
export const upsertReview(db, cardId, authorId, content)
export const listReviews(db, cardId)
// likes / user_ratings
export const toggleLike(db, cardId, fp)        // → { liked }
export const saveRating(db, cardId, fp, rating)
// users
export const getUserByUsername(db, username)
export const getUserByFingerprint(db, fp)
export const createUser(db, { username, passwordHash, fingerprint, role, inviteCode })
export const setUserRole(db, id, role)
export const setUserPassword(db, id, hash)
export const listUsers(db)
// invites
export const listInvites(db)
export const upsertInvite(db, { code, role, maxUses })
export const patchInvite(db, code, fields)
export const deleteInvite(db, code)
export const getInvite(db, code)
export const consumeInvite(db, code)
// boards 写
export const createBoard(db, { name, sortOrder })
export const deleteBoard(db, id)
```

### `core/storage.js` (R2)
```js
export const uploadImage(r2, file)            // → { key }
export const getImage(r2, key)               // → Response | null
```

### `core/cache.js` (KV)
```js
export const withCache(kv, key, ttlSec, loader)   // loader 异步
export const bustRanking(kv)                         // 清榜缓存
```

### `middleware.js`
```js
export const sessionMiddleware     // use('*', ...) 解析 cookie → c.set('session')
export const requireRole(...roles)  // 路由级守卫,失败返 403
```

### `routes/*.js` 每个导出一个 Hono 子 app 工厂
```js
// 例如 routes/public.js
export default function publicRoutes() {
  const r = new Hono();
  r.get('/me', ...);
  r.get('/ranking', ...);
  return r;
}
```

入口 `index.js` 只做装配:
```js
app.use('*', sessionMiddleware);
app.route('/api/public', publicRoutes());
app.route('/api/auth', authRoutes());
app.route('/api/workspace', workspaceRoutes());
app.route('/api/admin', adminRoutes());
app.get('/', (c) => html(render('home')));
// ...其余页面
```

## 三、分步构建顺序(每步独立可跑、可验证)

每一步完成后必须能 `node --check` 通过,且 wrangler dev 不报错。前一步不通不进下一步。

### 步骤 0:清空 src,准备骨架
- 删除 `src/lib.js` `src/views.js` `src/index.js`
- 建空目录:`src/core/ src/routes/ src/views/pages/`
- 项目此时无法运行,下一步开始填充

### 步骤 1:core/crypto.js(最底层,零依赖)
- 实现 sha256/b64url/signSession/verifySession/hashPassword/verifyPassword
- 全部纯函数,无 Hono/Workers API 依赖(只用了 `crypto.subtle`,Workers 自带)
- 验证:`node --check src/core/crypto.js`

### 步骤 2:core/db.js(D1 仓储)
- 把 index.js 中所有 `c.env.DB.prepare(...)` 抽出来,按上面的接口分组
- 每个 exported 函数只接受 `(db, ...params)`,返回 `Promise<数据>`
- **不含任何 HTTP 概念**,纯 DB 层
- 验证:写一个 `scripts/check-db.mjs` 临时脚本跑一遍,或者在步骤 6 联调

### 步骤 3:core/storage.js + core/cache.js
- `storage.js`:uploadImage/getImage,接收 `r2` 实例
- `cache.js`:withCache/bustRanking,接收 `kv` 实例
- 验证:`node --check`

### 步骤 4:middleware.js
- `sessionMiddleware`:解析 cookie 调 `verifySession`,`c.set('session', payload|null)`
- `requireRole`:返回中间件函数,失败 `json({ok:false,err:'forbidden'}, 403)`
- 验证:`node --check`

### 步骤 5:routes/public.js(第一个路由模块,跑通最小闭环)
- 实现公开端点:me / boards / ranking / cards/:id / cards/:id/like / cards/:id/rate / img
- 路由层职责:取参 → 调 db/cache/storage → 返回 `json(...)`
- 业务逻辑全部下沉到 core,路由层只做"胶水"
- 验证:`wrangler dev` 起服,`curl /api/boards`、`curl /api/ranking` 通

### 步骤 6:routes/auth.js(注册/登录/应急/登出)
- register/login/emergency/logout
- 涉及密码哈希、会话签名、cookie 下发
- 路由层调 `crypto.hashPassword` 和 `db.createUser`
- 验证:注册→登录→me 三步联调

### 步骤 7:routes/workspace.js(管理员发卡)
- upload/me/cards CRUD/review
- 复用 requireRole('admin','owner')
- 验证:管理员发卡→出现在"我的卡片"

### 步骤 8:routes/admin.js(所有者管理)
- cards/invites/users/boards 各 CRUD
- 复用 requireRole('owner')
- 保留 RPRPRP 保留码校验
- 验证:所有者新建邀请码、注册码配额校验

### 步骤 9:src/index.js 入口装配(15~30 行)
```js
import { Hono } from 'hono';
import { sessionMiddleware } from './middleware.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';
import adminRoutes from './routes/admin.js';
import { render } from './views/shell.js';

const app = new Hono();
app.use('*', sessionMiddleware);
app.route('/api', publicRoutes());
app.route('/api', authRoutes());
app.route('/api', workspaceRoutes());
app.route('/api', adminRoutes());

// 页面路由(纯返回 HTML)
app.get('/', (c) => c.body(render('home'), 200, {'Content-Type':'text/html'}));
// ...card/register/login/emergency/admin
export default { fetch: (r,e,ctx) => app.fetch(r,e,ctx) };
```
- 验证:所有 API 端点全通

### 步骤 10:views/shell.js 通用骨架
- 导出 `render(page, opts)`,同步返回完整 HTML
- 内含公共 CSS、导航栏、`window.FP`/`toast`/`imgUrl` 公共脚本
- 按 page 分发到 `pages/*.js`
- 每页只导出 `html(opts)` 和 `script(opts)` 两个函数

### 步骤 11~16:views/pages/ 各页面
按依赖顺序写:
1. `pages/home.js`(排行榜,无登录依赖)
2. `pages/card.js`(卡片详情,点赞 toggle)
3. `pages/register.js`(注册,账号密码+邀请码)
4. `pages/login.js`(登录,含"注册""忘记密码"按钮)
5. `pages/emergency.js`(所有者应急)
6. `pages/admin.js`(自适应 role 后台)

每写完一页:wrrangler dev 打开对应路径肉眼检查。

### 步骤 17:全链路验收
- 注册管理员(RPRPRP 注册所有者 → 后台生成邀请码 → 用邀请码注册管理员)→
  登录后台 → 发卡 → 主页看到卡 → 点赞 toggle → 评级 → 取消点赞评级消失 →
  所有者后台重置管理员密码 → 用新密码登录
- 任何断点先修再继续

## 四、解耦原则(贯穿每一步)

1. **core 不引用 Hono**:只用 `crypto.subtle` 和传入的 `db/r2/kv` 实例 → 可在 Node 单测
2. **routes 不写 SQL**:全部 `await db.xxx(env.DB, ...)` → 换 D1→KV 只改 db.js
3. **routes 不写 HTML**:页面路由只调 `render(page,opts)` → 换 React 只改 views
4. **views 不直连 API 业务**:只 fetch `/api/*`,不感知后端实现 → 后端可整体重写
5. **每文件不超过 ~150 行**:超出说明职责过重,再拆

## 五、验收检查清单(写完逐条勾)

- [ ] `node --check` 全部文件通过
- [ ] `wrangler dev` 启动无 error
- [ ] 未登录用户能看榜、能点赞、能取消
- [ ] 管理员能发卡、能改自己的卡、能写自己的评价
- [ ] 所有者能看全部、能改任意卡、能管理邀请码/用户/榜单
- [ ] 注册:账号 5~32 位字母数字、密码 5 位以上、必须邀请码
- [ ] 单指纹仅一个账号
- [ ] RPRPRP 注册所有者(系统仅一个)
- [ ] 所有者能在后台重置他人密码
- [ ] 所有者自己忘密码能用 OWNER_PASSWORD 走 /emergency
- [ ] Apple 风格视觉与现版一致
- [ ] 不改 wrangler.toml

## 六、不动声明

`wrangler.toml`、`schema.sql`、`package.json`、`.dev.vars`、`.gitignore` 保持原样。重构只在 `src/` 内进行。