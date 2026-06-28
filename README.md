# RP角色卡排行榜

运行于 Cloudflare Workers 的角色卡排行榜。零额外服务器,D1 + KV + R2 全部在 Workers 免费额度内。

## 功能

- 5 级评级 D / C / B / A / S(所有者或管理员给出的官方评级)
- 普通用户在点赞后可点击一个评级作为"参考"(仅展示,不影响排行)
- 多个榜单可由所有者后台任意创建
- 排行支持三种排序切换:官方评级优先 / 点赞数 / 用户评级众值
- 一张卡可被多个管理员/所有者各写一条评价
- 三档权限:
  - 所有者(`/admin`):管理邀请码、用户、榜单、全部卡片 CRUD
  - 管理员(`/workspace`):发布/修改自己上传的卡片、写自己的评价
  - 普通用户:查看、点赞、对已赞卡片给出参考评级
- 邀请码由所有者后台生成,预设角色(管理员/普通)与使用次数,可实时编辑/禁用
- 浏览器指纹追踪(FingerprintJS 开源版),无需注册也可点赞
- 图片上传前在浏览器端 canvas 压缩到 1080px / 质量 85
- 排行榜 15 秒自动轮询刷新后端

## 部署步骤

### 1. 准备资源(一次性)

```bash
npm install
npx wrangler d1 create rpcard                      # 记下 database_id
npx wrangler kv namespace create CACHE             # 记下 id
npx wrangler r2 bucket create rpcard-images
```

把得到的 ID 填到 `wrangler.toml`:
- `database_id` → D1
- `id` → KV

### 2. 设置 secrets

```bash
npx wrangler secret put OWNER_PASSWORD    # 所有者后台登录密码
npx wrangler secret put SESSION_SECRET    # 随机字符串,用于签名 cookie
```

### 3. 初始化数据库

```bash
npm run db:init        # 远程执行 schema.sql
# 本地开发可用: npm run db:local
```

### 4. 部署

```bash
npm run deploy
```

### 5. 首次登录后台

访问 `https://你的域名/admin`,用 `OWNER_PASSWORD` 登录。所有者用户记录会在首次登录时自动写入。

## 本地开发

```bash
npm install
npm run db:local      # 建本地 D1 表
npm run dev           # http://127.0.0.1:8787
```

本地 dev 用 `.dev.vars` 里的密码/secret,无需设置真实 wrangler secret。

## 目录结构

```
.
├── schema.sql        D1 建表脚本(可重复执行)
├── wrangler.toml     Workers 配置与绑定
├── .dev.vars         本地开发 secret(gitignored)
└── src
    ├── index.js      Hono app + 全部 API/路由/中间件
    ├── lib.js        工具:hash/session/cookie/KV缓存/响应
    └── views.js      HTML 模板(内联 CSS/JS,前端逻辑)
```

## API 概览

| 方法 | 路径 | 角色 | 作用 |
|------|------|------|------|
| GET  | `/` | 公开 | 排行榜主页 |
| GET  | `/card/:id` | 公开 | 卡片详情 |
| GET  | `/register`,POST `/api/register` | 公开 | 邀请码注册 |
| GET  | `/admin/login`,POST `/api/admin/login` | 公开 | 所有者密码登录 |
| GET/POST | `/api/login`,`/api/logout` | 公开 | 指纹登录/登出 |
| GET  | `/api/boards` | 公开 | 榜单列表 |
| GET  | `/api/ranking?board=&sort=` | 公开 | 排行榜 |
| GET  | `/api/cards/:id` | 公开 | 卡片详情 + 评价 + 评级分布 + 我的赞/评级 |
| POST | `/api/cards/:id/like` | 公开 | 点赞(指纹去重) |
| POST | `/api/cards/:id/rate` | 公开 | 给参考评级(需先点赞) |
| GET  | `/api/img?key=` | 公开 | R2 图片代理 |
| GET  | `/api/me` | 公开 | 当前会话信息 |
| GET  | `/api/workspace/me` | 管理员+ | 自己的卡 + 榜单 |
| POST | `/api/workspace/cards` | 管理员+ | 发卡 |
| PATCH| `/api/cards/:id` | 作者/所有者 | 改卡(管理员仅自己的) |
| PUT  | `/api/cards/:id/review` | 管理员+ | 写/改自己的评价 |
| POST | `/api/upload` | 管理员+ | 上传图片到 R2 |
| DELETE | `/api/cards/:id` | 所有者 | 删除任意卡 |
| GET  | `/api/admin/cards` | 所有者 | 全部卡片 + 统计 |
| GET/POST/PATCH/DELETE | `/api/admin/invites` | 所有者 | 邀请码 CRUD |
| GET/PATCH | `/api/admin/users` | 所有者 | 用户列表与改角色 |
| POST/DELETE | `/api/admin/boards` | 所有者 | 榜单 CRUD |

## 安全说明

- 所有者后台用 `OWNER_PASSWORD`(wrangler secret)+ HMAC 签名 cookie 验证,密码不入库
- 会话 cookie 是 `HttpOnly + SameSite=Lax + Secure`
- 时序安全的密码比较(sha256 后逐字节异或)
- 点赞/评级用 `PRIMARY KEY(card_id, user_fingerprint)` 数据库级去重
- 普通用户评级需先有 `likes` 记录,后端二次校验
- 邀请码达 `max_uses` 自动不可用,可在后台手动禁用/删除

## 免费额度参考

- Workers: 10 万请求/天
- D1: 500 万行读/天,10 万行写/天
- R2: 10 GB 存储,无出口流量费
- KV: 10 万读/天,1000 写/天

够个人项目跑很久。

## 已知限制 / 可改进点

- 浏览器指纹并非 100% 唯一,隐私模式下可能变化;如需更准确可换 FingerprintJS Pro(收费)
- 实时刷新用 15 秒轮询,如需"真·实时"可加 Durable Objects + WebSocket
- 文本未做富文本/Markdown,如需要再在前端加渲染库
- 后台改榜单/卡片后通过清理 KV 缓存立即生效;前端轮询天然拿到新数据