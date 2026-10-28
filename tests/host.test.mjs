// host half tests: mount lib/index.js with a fake cordis ctx and call every route.
//
// The plugin must work (or fail politely) even when the qq-bridge folder is missing:
// a plugin that cannot activate stops DSH from booting, so activation must never
// depend on configuration or the network.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as plugin from '../lib/index.js';

function mount(bridgeDir) {
  const routes = new Map();
  const ctx = {
    logger: () => ({ info: () => {} }),
    effect: (fn) => fn?.(),
    slots: { inject: () => () => {}, register: () => {} },
    inject: (deps, cb) =>
      cb({
        get: () => ({
          fetch: {
            register: ({ path: p, methods, fetch }) => routes.set(p, { methods, fetch }),
          },
        }),
      }),
  };
  plugin.apply(ctx, bridgeDir ? { bridgeDir } : undefined);
  return routes;
}

async function call(routes, routePath, { method = 'GET', body, query } = {}) {
  const route = routes.get(routePath);
  assert.ok(route, `route missing: ${routePath}`);
  const href = `http://127.0.0.1${routePath}${query ? '?' + query : ''}`;
  const req = new Request(href, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await route.fetch(req);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  return { status: res.status, json: parsed, text };
}

// ── case 1: a throwaway bridge-shaped folder ────────────────────────────────
// 有些环境禁止写系统临时目录（本机就是），所以用仓库内的临时目录；.gitignore 已忽略
const tmpRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '.tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'case-'));
fs.mkdirSync(path.join(tmp, 'roles'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'state'), { recursive: true });
fs.mkdirSync(path.join(tmp, '人格卡', '测试角色', '素材', '表情包'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'roles', '测试角色.md'), '# 角色卡：测试角色\n，短句。\n', 'utf8');
fs.writeFileSync(path.join(tmp, 'state', 'current-role.json'), JSON.stringify({ role: '测试角色', mode: 'active' }), 'utf8');
fs.writeFileSync(path.join(tmp, 'state', 'console-token'), 'x'.repeat(48), 'utf8');
fs.writeFileSync(
  path.join(tmp, 'config.json'),
  JSON.stringify({ ownerQQ: 10001, allow: { private: [10001], groups: [] }, socialV2: { proactive: { enabled: true } }, dsh: { provider: 'p', model: 'm' } }),
  'utf8',
);
fs.writeFileSync(path.join(tmp, '人格卡', '测试角色', '素材', '表情包', 'a.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

const routes = mount(tmp);
assert.equal(routes.size, 10, `expected 10 routes, got ${routes.size}`);

const state = await call(routes, '/api/qq-panel/state');
assert.equal(state.status, 200);
assert.equal(state.json.configured, true);
assert.equal(state.json.activeRole, '测试角色');
assert.equal(state.json.stickers.total, 1);

const persona = await call(routes, '/api/qq-panel/persona');
assert.equal(persona.json.role, '测试角色');
assert.ok(persona.json.chars > 0);

const saved = await call(routes, '/api/qq-panel/persona', {
  method: 'POST',
  body: { role: '测试角色', content: '# 角色卡：测试角色\n，更短。\n' },
});
assert.equal(saved.status, 200);
assert.ok(saved.json.backedUp, 'writing a persona must back up the previous content');
assert.equal(fs.readFileSync(path.join(tmp, 'roles', '测试角色.md'), 'utf8').includes('更短'), true);

const activated = await call(routes, '/api/qq-panel/persona/activate', { method: 'POST', body: { role: '测试角色' } });
assert.equal(activated.json.ok, true);

const stickers = await call(routes, '/api/qq-panel/stickers');
assert.equal(stickers.json.stickers.length, 1);
assert.equal(stickers.json.stickers[0].file, 'a.png');

const cfg = await call(routes, '/api/qq-panel/config');
assert.equal(cfg.json.value.ownerQQ, 10001);

const cfgPost = await call(routes, '/api/qq-panel/config', {
  method: 'POST',
  body: { proactive: { enabled: false, probability: 0.2 }, wakeDefaultMode: 'diving', setWakeConfig: true, reasoningEffort: 'high' },
});
assert.equal(cfgPost.json.ok, true);
const after = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
assert.equal(after.socialV2.proactive.probability, 0.2);
assert.equal(after.socialV2.wake.defaultMode, 'diving');
assert.equal(after.dsh.reasoningEffort, 'high');

const logs = await call(routes, '/api/qq-panel/logs', { query: 'lines=10' });
assert.equal(logs.json.ok, true);
assert.ok(Array.isArray(logs.json.lines));

const badNote = await call(routes, '/api/qq-panel/persona', { method: 'POST', body: { role: '不存在', content: 'x' } });
assert.equal(badNote.json.ok, true, 'writing a new persona card is allowed');

// ── case 2: 指向一个“空目录”（不是 qq-bridge）—— 路由必须给出可读结果，绝不抛───
// 注意：不能真的让探测失败（仓库旁边通常就有 qq-bridge，会被自动探测到），
// 所以这里显式传一个空目录，验证“目录不像 qq-bridge 时”的降级行为。
const emptyDir = path.join(tmpRoot, 'empty-bridge');
fs.mkdirSync(emptyDir, { recursive: true });
const bare = mount(emptyDir);
const bareState = await call(bare, '/api/qq-panel/state');
assert.equal(bareState.status, 200);
assert.equal(bareState.json.ok, true);
assert.deepEqual(bareState.json.roles, []);
const barePersona = await call(bare, '/api/qq-panel/persona');
assert.equal(barePersona.status, 404);
assert.equal(barePersona.json.ok, false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('host.test: ok');
