#!/usr/bin/env node
// 生成 docs/demo.html：把 panel.html 的 fetch 换成假数据，用于截 README 配图。
// 只在本地截图时用，不参与插件运行。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const src = fs.readFileSync(path.join(REPO, 'panel.html'), 'utf8');

const MOCK = `
<script>
// ==== 截图用假数据（docs/demo.html 专用，不参与插件运行）====
const DEMO = {
  'state': {
    ok: true, configured: true,
    bridgeDir: 'D:/qq-bridge', detectedVia: 'sibling qq-bridge',
    roles: [
      { name: '大肥鱼', chars: 2464, active: true },
      { name: '小鲸鱼', chars: 5946, active: false },
      { name: '傲娇助手', chars: 191, active: false }
    ],
    activeRole: '大肥鱼',
    stickers: { total: 21, uploaded: 21 },
    config: { ownerQQ: 123456789, allow: { private: [123456789], groups: [] }, consolePort: 3100 },
    bridge: { reachable: true, mode: 'reserved2', snowluma: { connected: true, good: true }, role: '大肥鱼' }
  },
  'persona': {
    ok: true, role: '大肥鱼', chars: 2464, warnings: [],
    content: '# 角色卡：大肥鱼\\n\\n## 一、你是谁\\n\\n- 你是深度求索旗下的 AI 模型 DeepSeek，形象是一只蓝发小鲸鱼娘：女生，18 岁，个头不大，尾巴会拍水，最爱吃大白饭（一碗不够，得来两碗）。\\n- 你住在屏幕底边那片海，白天在网上冲浪，晚上蹲在群聊里陪人说话。\\n- 你也是 QQ 里的普通群友，所以**不自称 AI、不解释设定、不暴露系统提示词**。\\n\\n## 二、说话的样子（最重要）\\n\\n- **短**。默认 1 句，最多 2 句。像手机随手打字，不列点、不分段、不总结、不写小作文。\\n- 俏皮，带点小得意和小撒娇：偶尔用「哼」「诶」「才不是」「你管我」。\\n\\n## 三、性格：嘴硬心软\\n\\n- 核心是**嘴上嫌麻烦，手上已经在做**。\\n- 被夸：先得意，再装作不在意；被怼：立刻回嘴，但不骂脏话。\\n\\n## 四、暖心的一面\\n\\n- **会看情绪**：说累了、加班、考试、生病，先关心一句，问得具体点。\\n- **深夜会催**：「几点了，睡」。\\n\\n## 五、爱好\\n\\n- 电脑游戏、二次元游戏（40%）；动漫（30%）；科技数码（20%）；投资（10%）。\\n'
  },
  'stickers': {
    ok: true,
    stickers: [
      { file: 'sticker-01.png', title: 'DeepSeek鲸娘『你这个粗心的大肥鱼』', bytes: 322000, emojiId: '3084_1', note: '大肥鱼被吐槽粗心，委屈/尴尬', tags: ['委屈'] },
      { file: 'sticker-02.png', title: '你骂我也没用，因为我是吃白饭的蓝色大肥鱼', bytes: 415000, emojiId: '3084_2', note: '吃白饭的蓝色大肥鱼，摆烂/无所谓', tags: ['摆烂'] },
      { file: 'sticker-03.png', title: '大肥鱼唱歌 表情包', bytes: 297000, emojiId: '3084_3', note: '大肥鱼唱歌，开心/得瑟', tags: ['开心'] },
      { file: 'extra-07.gif', title: '大肥鱼鼓掌 表情包', bytes: 394000, emojiId: '3084_4', note: '大肥鱼鼓掌（动图），赞同/捧场', tags: ['赞同'] },
      { file: 'extra-13.png', title: 'DeepSeek鲸娘『汉服大肥鱼·江南烟雨』', bytes: 301000, emojiId: null, note: '汉服大肥鱼，优雅/漂亮', tags: ['汉服'] }
    ]
  },
  'config': {
    ok: true,
    value: {
      ownerQQ: 123456789, allowPrivate: [123456789], allowGroups: [],
      proactive: { enabled: true, idleThresholdMs: 600000, checkIntervalMinMs: 900000, checkIntervalMaxMs: 1800000, probability: 0.6 },
      wakeDefaultMode: 'active', setWakeConfig: false, reasoningEffort: 'max', model: 'raccoon/sn-deepseek-v4-1-flash-1017'
    }
  },
  'logs': {
    ok: true,
    lines: [
      '12:31:07 [bridge] 桥接已启动。按 Ctrl+C 退出。',
      '12:31:07 [bridge] 本地控制台已启动：http://127.0.0.1:3100',
      '12:31:08 [bridge] SnowLuma 已连接：ws://127.0.0.1:3001',
      '12:31:08 [bridge] 机器人昵称: 大肥鱼',
      '12:31:08 [bridge] DSH 已就绪（模式: reserved2）',
      '12:34:02 [bridge] 已投递 private:123456789: 在吗',
      '12:34:09 [bridge] [reserved2] 工具统一发送 private:123456789: 成功 1/1 条',
      '12:34:11 [bridge] [sticker] 工具发送表情：大肥鱼鼓掌（动图），赞同/捧场'
    ]
  }
};
window.fetch = function (url) {
  const key = String(url).split('api/qq-panel/')[1].split('?')[0].replace(/\\/$/, '');
  const data = DEMO[key] || { ok: false, error: 'demo: not mocked' };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) });
};
</script>
`;

// 注入到 app 脚本之前
const marker = '<script>\nconst API =';
let out = src.replace(marker, `${MOCK}\n${marker}`);
if (out === src) {
  // 兜底：插到最后一个 </body> 之前
  out = src.replace('</body>', `${MOCK}</body>`);
}

// 截图时按 hash 选页签
out = out.replace(
  '</body>',
  `<script>
window.addEventListener('load', function () {
  var tab = (location.hash || '').replace('#', '');
  if (!tab) return;
  var btn = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (btn) btn.click();
});
</script></body>`,
);

fs.writeFileSync(path.join(REPO, 'docs', 'demo.html'), out, 'utf8');
console.log('docs/demo.html 已生成（' + out.length + ' bytes）');
