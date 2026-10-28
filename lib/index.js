/**
 * dsh-qq-panel — host half.
 *
 * Routes under /api/qq-panel/* (same-origin from the client page, no CORS):
 *   GET  state                 roles + stickers summary + bridge config + live status
 *   GET  persona?name=         read a persona card
 *   POST persona               write a persona card (auto backup first)
 *   POST persona/activate      switch the active persona (hot: injected per message)
 *   POST persona/backup        snapshot the active card
 *   GET  stickers              sticker library with notes
 *   POST stickers/upload       push one sticker into QQ favourites (OneBot add_custom_face)
 *   POST stickers/note         write a sticker's note (proxied to the bridge console)
 *   GET  config                behavioural settings (subset of bridge config.json)
 *   POST config                write behavioural settings
 *   GET  logs?lines=           tail of state/bridge.log
 *   GET  bridge-dir            which qq-bridge folder is in use, and how it was found
 *   POST bridge-dir            persist a folder override to ~/.dsh/qq-panel.json
 *
 * Design rules learned the hard way:
 *   1. never throw out of a route — answer JSON with {ok:false,error};
 *   2. never require configuration at activation time (a plugin that cannot activate
 *      stops DSH from booting);
 *   3. never touch the network at activation time either.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'qq-panel';
export const inject = [];

const SETTINGS_FILE = path.join(os.homedir(), '.dsh', 'qq-panel.json');

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
const readText = (file, fallback = '') => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
};
const readJson = (file, fallback) => {
  try {
    return JSON.parse(readText(file, 'null')) ?? fallback;
  } catch {
    return fallback;
  }
};
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Where the qq-bridge checkout lives: env → saved override → sibling guesses. */
function detectBridgeDir() {
  const candidates = [];
  if (process.env.QQ_BRIDGE_DIR) candidates.push({ dir: process.env.QQ_BRIDGE_DIR, via: 'env QQ_BRIDGE_DIR' });
  const saved = readJson(SETTINGS_FILE, null);
  if (saved?.bridgeDir) candidates.push({ dir: saved.bridgeDir, via: '~/.dsh/qq-panel.json' });
  // 必须用 fileURLToPath：import.meta.url 是百分号编码的，含中文/空格的路径会变成 %E8%... 导致探测失败
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..');
  candidates.push({ dir: path.join(path.dirname(root), 'qq-bridge'), via: 'sibling qq-bridge' });
  candidates.push({ dir: path.join(root, 'qq-bridge'), via: 'nested qq-bridge' });
  for (const c of candidates) {
    if (!c.dir) continue;
    const dir = path.resolve(c.dir);
    if (isDir(path.join(dir, 'roles')) || fs.existsSync(path.join(dir, 'config.json'))) return { dir, via: c.via };
  }
  return { dir: null, via: null };
}

export function apply(ctx, config) {
  const log = (...a) => {
    try {
      ctx?.logger?.(name)?.info?.(...a);
    } catch {}
  };

  let bridgeDir = config && config.bridgeDir ? { dir: path.resolve(String(config.bridgeDir)), via: 'config' } : detectBridgeDir();
  log(`mounted; qq-bridge = ${bridgeDir.dir ?? '(not configured)'}${bridgeDir.via ? ` via ${bridgeDir.via}` : ''}`);

  const paths = () => {
    const dir = bridgeDir.dir;
    return {
      dir,
      roles: dir && path.join(dir, 'roles'),
      state: dir && path.join(dir, 'state'),
      config: dir && path.join(dir, 'config.json'),
      persona: dir && path.join(dir, '人格卡'),
      legacyStickers: dir && path.join(dir, 'assets', 'qq-stickers'),
    };
  };

  function requireBridge() {
    const p = paths();
    if (!p.dir) {
      const error = '还没有配置 qq-bridge 目录';
      const hint = '设置环境变量 QQ_BRIDGE_DIR，或在面板里填目录后保存';
      return { ok: false, error, hint };
    }
    return { ok: true, p };
  }

  // ── persona cards ────────────────────────────────────────────────────────
  function listRoles() {
    const { p, ok } = (() => {
      const pp = paths();
      return { p: pp, ok: !!pp.dir };
    })();
    if (!ok) return [];
    const active = String(readJson(path.join(p.state, 'current-role.json'), { role: null }).role ?? '');
    let files = [];
    try {
      files = fs.readdirSync(p.roles).filter((f) => /\.md$/i.test(f) && !/^readme\.md$/i.test(f));
    } catch {}
    return files
      .map((f) => {
        const role = f.replace(/\.md$/i, '');
        let chars = 0;
        let mtime = 0;
        try {
          const st = fs.statSync(path.join(p.roles, f));
          mtime = st.mtimeMs;
          chars = readText(path.join(p.roles, f)).length;
        } catch {}
        return { name: role, chars, mtime, active: role === active };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  function backupRole(role, content) {
    const { p } = requireBridge();
    if (!p.dir) throw new Error('未配置 qq-bridge 目录');
    const dir = path.join(p.persona || path.join(p.dir, '人格卡'), role, '版本');
    ensureDir(dir);
    const stamp = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/[:/\s]/g, '-').replace(/,/g, '');
    const file = path.join(dir, `${role}-${stamp}.md`);
    fs.writeFileSync(file, content, 'utf8');
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.rmSync(path.join(dir, old), { force: true });
    return path.basename(file);
  }

  function roleStats(content) {
    const warnings = [];
    if (/[\u4e00-\u9fff]\s+[\u4e00-\u9fff]/.test(content)) warnings.push('正文里有「中文 空格 中文」：一代协议会把空格当分条信号');
    if (content.length > 6000) warnings.push('超过 role.maxInjectChars（默认 6000），会被截断');
    return { chars: content.length, warnings };
  }

  // ── stickers ─────────────────────────────────────────────────────────────
  function stickerDirs() {
    const { p } = requireBridge();
    if (!p.dir) return [];
    const found = [];
    // 推荐布局：人格卡/<角色>/素材/表情包/
    try {
      for (const role of fs.readdirSync(p.persona || '')) {
        const dir = path.join(p.persona, role, '素材', '表情包');
        if (isDir(dir)) found.push(dir);
      }
    } catch {}
    if (isDir(p.legacyStickers)) found.push(p.legacyStickers);
    return found;
  }

  function snowlumaOneBot() {
    const { p } = requireBridge();
    if (!p.dir) return null;
    const sibling = path.join(path.dirname(p.dir), 'QQsnowluma', 'config');
    const candidates = [sibling, path.join(p.dir, 'snowluma', 'config')];
    for (const dir of candidates) {
      let files = [];
      try {
        files = fs.readdirSync(dir).filter((f) => /^onebot_\d+\.json$/.test(f));
      } catch {
        continue;
      }
      for (const f of files) {
        const j = readJson(path.join(dir, f), null);
        const http = j?.networks?.httpServers?.[0];
        if (http?.port) return { port: http.port, token: http.accessToken || '' };
      }
    }
    return null;
  }

  function stickerList() {
    const list = [];
    for (const dir of stickerDirs()) {
      const uploaded = readJson(path.join(dir, 'uploaded.json'), {});
      const names = { ...readJson(path.join(dir, 'names.json'), {}), ...readJson(path.join(dir, 'extra-names.json'), {}) };
      let files = [];
      try {
        files = fs.readdirSync(dir).filter((f) => /\.(png|gif|jpe?g|webp)$/i.test(f)).sort();
      } catch {}
      for (const f of files) {
        const rec = uploaded[f] || {};
        let bytes = 0;
        try {
          bytes = fs.statSync(path.join(dir, f)).size;
        } catch {}
        list.push({ file: f, dir, title: names[f] || '', emojiId: rec.emoji_id || null, uploadedAt: rec.at || null, bytes });
      }
    }
    return list;
  }

  async function uploadSticker(dir, file) {
    const onebot = snowlumaOneBot();
    if (!onebot) throw new Error('找不到 SnowLuma 的 OneBot 配置（config/onebot_<QQ>.json）');
    const abs = path.join(dir, file).replace(/\\/g, '/');
    const res = await fetch(`http://127.0.0.1:${onebot.port}/add_custom_face`, {
      method: 'POST',
      headers: { authorization: `Bearer ${onebot.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ file: `file:///${abs}` }),
      signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    if (parsed?.retcode !== 0) throw new Error(`上传失败：${text.slice(0, 160)}`);
    const uploadedFile = path.join(dir, 'uploaded.json');
    const uploaded = readJson(uploadedFile, {});
    uploaded[file] = { emoji_id: parsed?.data?.emoji_id ?? null, at: new Date().toISOString() };
    fs.writeFileSync(uploadedFile, `${JSON.stringify(uploaded, null, 2)}\n`, 'utf8');
    return parsed?.data ?? {};
  }

  async function bridgeStatus() {
    const pre = requireBridge();
    const out = { reachable: false };
    if (!pre.ok) return out;
    const p = pre.p;
    if (!p.dir) return out;
    const token = readText(path.join(p.state, 'console-token')).trim();
    const port = Number(readJson(p.config, {}).consolePort ?? 3100);
    out.port = port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/status`, {
        headers: token ? { 'x-console-token': token } : {},
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const j = await res.json();
        Object.assign(out, { reachable: true, mode: j.mode ?? null, snowluma: j.snowluma ?? null, role: j.role ?? null });
      } else out.error = `HTTP ${res.status}`;
    } catch (error) {
      out.error = String(error?.message ?? error);
    }
    return out;
  }

  // ── routes ───────────────────────────────────────────────────────────────
  ctx.inject(['connection'], (injected) => {
    const connection = injected.get('connection');
    if (!connection?.fetch?.register) {
      log('connection.fetch is unavailable; panel routes not registered');
      return;
    }
    const route = (p, methods, fn) =>
      connection.fetch.register({
        path: `/api/qq-panel/${p}`,
        methods,
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            return await fn(request);
          } catch (error) {
            return json({ ok: false, error: String(error?.message ?? error) }, 500);
          }
        },
      });

    route('state', ['GET'], async () => {
      const pre = requireBridge();
      const cfg = pre.ok ? readJson(paths().config, {}) : {};
      const stickers = pre.ok ? stickerList() : [];
      return json({
        ok: true,
        configured: pre.ok,
        bridgeDir: paths().dir,
        detectedVia: bridgeDir.via,
        hint: pre.ok ? undefined : pre.hint,
        roles: listRoles(),
        activeRole: listRoles().find((r) => r.active)?.name ?? null,
        stickers: { total: stickers.length, uploaded: stickers.filter((s) => s.emojiId).length },
        config: {
          ownerQQ: cfg.ownerQQ ?? null,
          allow: cfg.allow ?? { private: [], groups: [] },
          proactive: cfg.socialV2?.proactive ?? null,
          wake: { defaultMode: cfg.socialV2?.wake?.defaultMode ?? null, setWakeConfig: cfg.socialV2?.tools?.setWakeConfig ?? null },
          reasoningEffort: cfg.dsh?.reasoningEffort ?? null,
          consolePort: cfg.consolePort ?? 3100,
        },
        bridge: await bridgeStatus(),
      });
    });

    route('bridge-dir', ['GET', 'POST'], async (request) => {
      if (request.method === 'GET') return json({ ok: true, bridgeDir: bridgeDir.dir, via: bridgeDir.via });
      const body = await request.json();
      const dir = String(body.bridgeDir ?? '').trim();
      if (!dir) return json({ ok: false, error: '目录不能为空' }, 400);
      const resolved = path.resolve(dir);
      if (!isDir(path.join(resolved, 'roles')) && !fs.existsSync(path.join(resolved, 'config.json'))) {
        return json({ ok: false, error: `这个目录看起来不是 qq-bridge：${resolved}（没有 roles/ 或 config.json）` }, 400);
      }
      ensureDir(path.dirname(SETTINGS_FILE));
      fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify({ bridgeDir: resolved }, null, 2)}\n`, 'utf8');
      bridgeDir = { dir: resolved, via: '面板保存' };
      return json({ ok: true, bridgeDir: resolved, note: '已保存到 ~/.dsh/qq-panel.json' });
    });

    route('persona', ['GET', 'POST'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error, hint: pre.hint }, 409);
      const { p } = pre;
      if (request.method === 'GET') {
        const role = new URL(request.url).searchParams.get('name') || listRoles().find((r) => r.active)?.name;
        if (!role) return json({ ok: false, error: '没有任何人格卡（roles/*.md）' }, 404);
        const content = readText(path.join(p.roles, `${role}.md`));
        return json({ ok: true, role, content, ...roleStats(content) });
      }
      const body = await request.json();
      const role = String(body.role || '').trim().replace(/[^\w\u4e00-\u9fff-]/g, '');
      if (!role) return json({ ok: false, error: '人格名非法（只允许中文/字母/数字/横线）' }, 400);
      const content = String(body.content ?? '');
      if (!content.trim()) return json({ ok: false, error: '内容不能为空' }, 400);
      const target = path.join(p.roles, `${role}.md`);
      const previous = readText(target);
      const backedUp = previous ? backupRole(role, previous) : null;
      fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
      return json({ ok: true, role, backedUp, ...roleStats(content), savedAt: new Date().toISOString() });
    });

    route('persona/activate', ['POST'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error, hint: pre.hint }, 409);
      const { p } = pre;
      const body = await request.json();
      const role = String(body.role || '').trim();
      if (!fs.existsSync(path.join(p.roles, `${role}.md`))) return json({ ok: false, error: `没有人格卡 ${role}` }, 404);
      const file = path.join(p.state, 'current-role.json');
      const prev = readJson(file, { mode: 'active' });
      ensureDir(p.state);
      fs.writeFileSync(file, `${JSON.stringify({ role, mode: prev.mode || 'active' }, null, 2)}\n`, 'utf8');
      return json({ ok: true, role, note: '已热切换：人格随每条消息注入，无需重启' });
    });

    route('persona/backup', ['POST'], async () => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error }, 409);
      const role = listRoles().find((r) => r.active)?.name;
      if (!role) return json({ ok: false, error: '没有启用的人格卡' }, 404);
      const saved = backupRole(role, readText(path.join(pre.p.roles, `${role}.md`)));
      return json({ ok: true, role, saved });
    });

    route('stickers', ['GET'], async () => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error, hint: pre.hint }, 409);
      const notes = new Map();
      const store = readJson(path.join(paths().state, 'stickers.json'), []);
      const arr = Array.isArray(store) ? store : store.entries || [];
      for (const e of arr) notes.set(e.id || e.resId, { note: e.localNote || '', tags: e.tags || [] });
      const list = stickerList().map((s) => {
        const n = s.emojiId ? notes.get(s.emojiId) : null;
        return { ...s, note: n?.note ?? '', tags: n?.tags ?? [] };
      });
      return json({ ok: true, stickers: list });
    });

    route('stickers/upload', ['POST'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error }, 409);
      const body = await request.json();
      const dir = String(body.dir || '');
      const file = String(body.file || '');
      if (!/^[\w.\u4e00-\u9fff-]+\.(png|gif|jpe?g|webp)$/i.test(file)) return json({ ok: false, error: '文件名非法' }, 400);
      const allowed = stickerDirs();
      const target = dir && allowed.includes(path.resolve(dir)) ? path.resolve(dir) : allowed[0];
      if (!target) return json({ ok: false, error: '没找到表情包目录' }, 404);
      const data = await uploadSticker(target, file);
      return json({ ok: true, file, emojiId: data?.emoji_id ?? null });
    });

    route('stickers/note', ['POST'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error }, 409);
      const { p } = pre;
      const token = readText(path.join(p.state, 'console-token')).trim();
      const port = Number(readJson(p.config, {}).consolePort ?? 3100);
      const body = await request.json();
      const res = await fetch(`http://127.0.0.1:${port}/api/stickers/note`, {
        method: 'POST',
        headers: { 'x-console-token': token, 'content-type': 'application/json' },
        body: JSON.stringify({ stickerId: body.stickerId, note: body.note, tags: body.tags }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8' } });
    });

    route('config', ['GET', 'POST'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error, hint: pre.hint }, 409);
      const { p } = pre;
      const cfg = readJson(p.config, null);
      if (!cfg) return json({ ok: false, error: '读不到 config.json' }, 500);
      if (request.method === 'GET') {
        return json({
          ok: true,
          value: {
            ownerQQ: cfg.ownerQQ ?? null,
            allowPrivate: cfg.allow?.private ?? [],
            allowGroups: cfg.allow?.groups ?? [],
            proactive: cfg.socialV2?.proactive ?? {},
            wakeDefaultMode: cfg.socialV2?.wake?.defaultMode ?? 'diving',
            setWakeConfig: cfg.socialV2?.tools?.setWakeConfig !== false,
            reasoningEffort: cfg.dsh?.reasoningEffort ?? 'max',
            model: `${cfg.dsh?.provider ?? ''}/${cfg.dsh?.model ?? ''}`,
          },
        });
      }
      const patch = await request.json();
      if (patch.ownerQQ !== undefined && patch.ownerQQ !== null && patch.ownerQQ !== '') {
        const qq = Number(patch.ownerQQ);
        if (!Number.isInteger(qq) || qq <= 0) return json({ ok: false, error: 'ownerQQ 必须是正整数 QQ 号' }, 400);
        cfg.ownerQQ = qq;
      }
      const toIds = (arr) => (Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0) : null);
      if (Array.isArray(patch.allowPrivate)) cfg.allow = { ...(cfg.allow || {}), private: toIds(patch.allowPrivate) };
      if (Array.isArray(patch.allowGroups)) cfg.allow = { ...(cfg.allow || {}), groups: toIds(patch.allowGroups) };
      if (patch.proactive && typeof patch.proactive === 'object') {
        cfg.socialV2 = cfg.socialV2 || {};
        const prev = cfg.socialV2.proactive || {};
        cfg.socialV2.proactive = {
          enabled: patch.proactive.enabled ?? prev.enabled ?? true,
          idleThresholdMs: Math.max(60000, Number(patch.proactive.idleThresholdMs ?? prev.idleThresholdMs ?? 600000)),
          checkIntervalMinMs: Math.max(60000, Number(patch.proactive.checkIntervalMinMs ?? prev.checkIntervalMinMs ?? 900000)),
          checkIntervalMaxMs: Math.max(60000, Number(patch.proactive.checkIntervalMaxMs ?? prev.checkIntervalMaxMs ?? 1800000)),
          probability: Math.min(1, Math.max(0, Number(patch.proactive.probability ?? prev.probability ?? 0.6))),
        };
      }
      if (patch.wakeDefaultMode === 'active' || patch.wakeDefaultMode === 'diving') {
        cfg.socialV2 = cfg.socialV2 || {};
        cfg.socialV2.wake = { ...(cfg.socialV2.wake || {}), defaultMode: patch.wakeDefaultMode };
      }
      if (typeof patch.setWakeConfig === 'boolean') {
        cfg.socialV2 = cfg.socialV2 || {};
        cfg.socialV2.tools = { ...(cfg.socialV2.tools || {}), setWakeConfig: patch.setWakeConfig };
      }
      if (['low', 'high', 'max'].includes(patch.reasoningEffort)) {
        cfg.dsh = cfg.dsh || {};
        cfg.dsh.reasoningEffort = patch.reasoningEffort;
      }
      fs.writeFileSync(p.config, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
      return json({ ok: true, note: '已写入 config.json；行为参数在桥接重启后生效' });
    });

    route('logs', ['GET'], async (request) => {
      const pre = requireBridge();
      if (!pre.ok) return json({ ok: false, error: pre.error }, 409);
      const lines = Math.min(400, Math.max(5, Number(new URL(request.url).searchParams.get('lines') || 60)));
      const text = readText(path.join(paths().state, 'bridge.log'));
      return json({ ok: true, lines: text.split('\n').filter(Boolean).slice(-lines) });
    });

    log('routes registered: /api/qq-panel/{state,bridge-dir,persona,stickers,config,logs}');
  });
}
