// 入口:装配 Hono app,挂载路由 + 页面
// 单所有者模式:对外只有排行榜,后台入口隐藏在 /admin

import { Hono } from 'hono';
import { html } from './core/http.js';
import { render } from './views/shell.js';

import publicRoutes from './routes/public.js';
import workspaceRoutes from './routes/workspace.js';
import adminRoutes from './routes/admin.js';

const app = new Hono();

// API 子路由
app.route('/api', publicRoutes());
app.route('/api', workspaceRoutes());
app.route('/api', adminRoutes());

// 公开页面:首页 + 卡片详情
app.get('/', (c) => html(render('home')));
app.get('/card/:id', (c) => html(render('card', { id: c.req.param('id') })));

// 隐藏后台入口:前端读 localStorage ADMIN_KEY 决定显示登录表单或后台
app.get('/admin', (c) => html(render('admin')));

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};