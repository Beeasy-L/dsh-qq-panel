# dsh-qq-panel

> **给 DeepSeek Harness 上的 QQ 机器人配一个“控制面板”。**
> 不用再翻 `roles/*.md`、不用手改 `config.json`：在 DSH 的设置页里点几下，就能改人格、管表情包、
> 调主动发言，还能看桥接和 SnowLuma 是不是活着。

面向 [qq-bridge](https://github.com/Derpyu520/qq-bridge)（QQ ↔ DeepSeek Harness 的桥接项目，
OneBot v11 / SnowLuma）。本项目**只读写文件**：不启停 SnowLuma、不碰 QQ 客户端、不代发消息。

- 两种形态：**DSH 设置页插件**（设置 → 插件 → dsh-qq-panel），或**完全独立的本地网页**（`node server.mjs`，默认 3101 端口）。
- 零配置即可启动：插件在激活阶段不读配置、不联网、不抛错 —— 装坏了也**不会**拖垮 Harness 启动。

---

## 为什么需要它

qq-bridge 的能力都藏在文件里：人格卡是 `roles/大肥鱼.md`、行为参数是 `config.json`、
表情备注在 `state/stickers.json`、素材散在 `人格卡/*/素材/`。改一句人设要开编辑器找文件，
调个主动发言频率要记字段名，表情想加一张还得敲 OneBot 请求。

这个面板把这些收进一个界面，并且把该自动的事自动做掉：保存前备份人格卡、上传表情后回写 `emoji_id`、
参数写回后提示“需重启桥接生效”。

## 界面

面板分四页（插件版与独立网页版是同一套界面）：

| 页 | 你能做什么 |
| --- | --- |
| **人格卡** | 切人格、等宽字体直接改正文；保存**自动备份**到 `人格卡/<角色>/版本/`（留最近 30 份）；一键启用（热生效）；实时字符数与红线提醒 |
| **表情包** | 看得见每张表情的文件名/标题/体积/是否已上传；改「这张表情的含义」（AI 挑图就看它）；未上传的一键推进 QQ 收藏表情 |
| **行为参数** | ownerQQ、私聊/群白名单、主动发言（开关/冷场阈值/检查间隔/概率）、唤醒模式、是否允许 AI 自己潜水、思考强度 |
| **状态 / 日志** | 桥接在线、当前模式、SnowLuma 连接、当前人格；`state/bridge.log` 尾部；一键打开桥接控制台 |

没找到 qq-bridge 目录时，面板先弹一张“填目录”的卡片，保存后记到 `~/.dsh/qq-panel.json`，下次自动用。

### 截图

> 下面三张用 `docs/demo.html`（同一份界面 + 假数据）渲染，只为展示排版；真实数据来自你的 qq-bridge。

| 人格卡（编辑 + 自动备份 + 热切换） | 表情包（备注 + 一键上传） |
| --- | --- |
| ![人格卡页](docs/screenshot-persona.png) | ![表情包页](docs/screenshot-stickers.png) |

**行为参数**（主动发言、白名单、唤醒方式；保存后需重启桥接进程）：

![行为参数页](docs/screenshot-behaviour.png)

## 快速开始

### A. 作为 DSH 插件（推荐）

要求：Node ≥ 22.13、DSH 0.2.x、已有一个 profile（`~/.dsh/profiles/<profile>/`）。

```bash
git clone https://github.com/Beeasy-L/dsh-qq-panel.git dsh-qq-panel   # 或下载源码
cd dsh-qq-panel
node scripts/install.mjs            # 默认 desktop profile；web 用 --profile=web
```

然后**重启 Harness**（客户端 bundle 与插件行只在启动时加载）。入口：**设置 → 插件 → dsh-qq-panel**。

卸载 / 启动不了时的救援：

```bash
node scripts/uninstall.mjs                  # 移除登记 + node_modules 链接
node scripts/uninstall.mjs --restore-backup # 连同最近一次 package.json 备份一起还原
```

### B. 独立网页（不加载 DSH 插件，零启动风险）

```bash
node server.mjs                    # http://127.0.0.1:3101
QQ_BRIDGE_DIR=/path/to/qq-bridge node server.mjs 3102
```

## 桥接目录怎么找

按顺序取第一个像 qq-bridge 的目录（含 `roles/` 或 `config.json`）：

1. 环境变量 `QQ_BRIDGE_DIR`
2. `~/.dsh/qq-panel.json` 的 `bridgeDir`（面板里保存的）
3. 与本仓库同级的 `qq-bridge/`
4. 本仓库内的 `qq-bridge/`

认的目录约定（不强制，兼容旧布局）：

```
qq-bridge/
├─ roles/<角色>.md                  # 人格卡（桥接读取）
├─ state/current-role.json          # 当前启用人格
├─ state/bridge.log                 # 日志
├─ state/stickers.json              # 表情库备注
├─ config.json                      # 行为参数
└─ 人格卡/<角色>/素材/表情包/        # 表情素材 + uploaded.json / names.json
   └─ ../版本/                      # 人格卡自动备份
```

旧的 `assets/qq-stickers/` 也会被识别为表情素材目录。

## 兼容性

| 组件 | 测试过的版本 |
| --- | --- |
| DeepSeek Harness | 0.2.1-rc.3（Windows 桌面版） |
| qq-bridge | 0.2.1-r1（reserved2 模式） |
| Node.js | 22.19 / 24.x（CI 跑 22 与 24） |
| 平台 | Windows 主要验证；代码只用 `fs/path/os/http`，macOS / Linux 应可直接用（junction 自动改用 symlink） |

## 安全边界

- 只读写 qq-bridge 仓库里的文本与图片文件；**不启停 SnowLuma / QQ / 桥接进程**。
- 不把控制台令牌发到前端：需要令牌的调用都由 host 半边在服务端完成。
- 上传表情走 SnowLuma 的 OneBot HTTP 接口，用的是本机 `config/onebot_<QQ>.json` 里的令牌，不落盘、不外发。
- 面板本身没有鉴权：插件版沿用 DSH 登录态；独立网页版只监听 `127.0.0.1`。

## 排错

| 症状 | 处理 |
| --- | --- |
| 装完 Harness 起不来 | `node scripts/uninstall.mjs --restore-backup`，再启动 |
| 面板里没看到 | 确认重启过 Harness；设置 → 插件 → 找到 dsh-qq-panel |
| 提示“还没有配置 qq-bridge 目录” | 在卡片里填路径保存，或设 `QQ_BRIDGE_DIR` |
| 改完行为参数没反应 | 行为参数要**重启桥接窗口**；人格卡是热生效 |
| 表情上传失败 | SnowLuma 必须在线且 OneBot HTTP 端口可达；看桥接日志 |

## 开发

```bash
node --test tests/*.test.mjs    # 不需要 DSH 运行时
node server.mjs                 # 起独立面板手测
```

- `lib/index.js` — host 半边（cordis 插件），注册 `/api/qq-panel/*`；
- `lib/client.js` — 客户端半边，手写 lazy-CJS，注册进 `plugins.bundle.config` 槽位；
- `tests/host.test.mjs` — 假 ctx 挂载 + 逐条调路由（含“没有桥接目录”的降级路径）；
- `tests/client.test.mjs` — 模拟 `window.__ModuleLoader__`，断言 `inject: ['slots']` 与槽位注册。

### 两个坑（真踩过，写在这里省你一次重装）

1. **客户端插件必须导出 `inject: ['slots']`**。少了它 `ctx.slots` 是 `undefined`，`apply`
   一碰就抛错，entry 变 `failed`，DSH 会报 `web boot: 1 entry did not activate` 并**拒绝启动**。
   所以 `apply` 里还要对缺失的服务做防御：宁可面板不出现，也不能抛。
2. **profile 行不要带 `config`**，除非插件导出对应的 `Config` schema。带 config 却无 schema
   也可能让 entry 激活失败，同样表现为启动不了。本项目改从环境变量/配置文件解析路径，绕开这条。

## 许可

MIT。与 DeepSeek、腾讯/QQ 均无隶属关系；QQ 相关操作的风险由使用者自负。
