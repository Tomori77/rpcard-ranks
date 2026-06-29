// 入口:装配 Hono app,挂载所有路由 + 页面
// 路由层全部独立模块,本文件只做胶水

import { Hono } from 'hono';
import { sessionMiddleware } from './middleware.js';
import { html } from './core/http.js';
import { render } from './views/shell.js';

import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';
import adminRoutes from './routes/admin.js';

const app = new Hono();

// 全局 session 解析(所有路由共享)
app.use('*', sessionMiddleware);

// API 子路由
app.route('/api', publicRoutes());
app.route('/api', authRoutes());
app.route('/api', workspaceRoutes());
app.route('/api', adminRoutes());

// 页面路由(只返回 HTML)
app.get('/', (c) => html(render('home')));
app.get('/card/:id', (c) => html(render('card', { id: c.req.param('id') })));
app.get('/register', (c) => html(render('register', { presetCode: c.req.query('code') || '' })));
app.get('/login', (c) => html(render('login', { next: c.req.query('next') || '/admin' })));
app.get('/emergency', (c) => html(render('emergency')));
app.get('/admin', (c) => html(render('admin')));
app.get('/workspace', (c) => c.redirect('/admin')); // 兼容旧链接

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};