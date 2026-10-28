// qq-panel 独立面板服务（不依赖 DSH 插件机制，零启动风险）
//
// 复用 lib/index.js 里的同一套路由逻辑：给它一个假 ctx + 假 connection，把注册到的
// /api/qq-panel/* 路由直接挂到本机 HTTP 服务上。所以面板版和独立版的读写行为完全一致。
//
// 用法：node server.mjs [端口]    默认 3101
// 打开：http://127.0.0.1:3101
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as plugin from './lib/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 3101);
// 不写死任何本机路径：优先环境变量，否则交给插件自己探测（同级/内嵌 qq-bridge、
// ~/.dsh/qq-panel.json）。
const BRIDGE_DIR = process.env.QQ_BRIDGE_DIR || null;

const routes = new Map();
const fakeConnection = {
  fetch: {
    register({ path: p, methods, fetch }) {
      routes.set(p, { methods, fetch });
    },
  },
};
const fakeCtx = {
  logger: () => ({ info: (...a) => console.log('[panel]', ...a) }),
  effect: (fn) => (typeof fn === 'function' ? fn() : undefined),
  slots: { inject: () => () => {}, register: () => {} },
  inject: (deps, cb) => cb({ get: () => fakeConnection }),
};

plugin.apply(fakeCtx, BRIDGE_DIR ? { bridgeDir: BRIDGE_DIR } : undefined);
console.log(`[panel] bridgeDir=${BRIDGE_DIR ?? '(自动探测)'}，已注册路由 ${routes.size} 条`);

const HTML = fs.readFileSync(path.join(HERE, 'panel.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(HTML);
    return;
  }

  const route = routes.get(url.pathname);
  if (!route) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
    return;
  }
  if (route.methods && !route.methods.includes(req.method)) {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyBuf = Buffer.concat(chunks);
    const request = new Request(url.href, {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] || 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyBuf,
    });
    const response = await route.fetch(request);
    const text = await response.text();
    res.writeHead(response.status, {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(text);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[panel] 已在 http://127.0.0.1:${PORT} 启动（Ctrl+C 退出）`);
});
