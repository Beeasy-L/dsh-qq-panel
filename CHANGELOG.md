# Changelog

## 0.1.1 — 2026-10-28

### 修复
- 桥接目录自动探测改用 `fileURLToPath(import.meta.url)`：`import.meta.url` 是百分号编码的，
  含中文或空格的路径（如 `C:/Users/x/桌面/共享文件夹/qq-bridge`）会被解析成 `%E8%...`，导致探测失败。
- `server.mjs` 不再内置任何本机路径，统一走环境变量 `QQ_BRIDGE_DIR` 或插件自身探测。

### 测试
- “未配置”用例改为“目录不像 qq-bridge 时”的降级验证（真实探测会命中同级的 qq-bridge 仓库）。

## 0.1.0 — 2026-10-27

首个可用版本。

### 功能
- 人格卡页：列出 / 编辑 / 自动备份 / 热切换启用人格，字符数与红线提醒。
- 表情包页：素材列表、按备注管理、未上传的一键推送到 QQ 收藏表情（OneBot `add_custom_face`）。
- 行为参数页：ownerQQ、私聊/群白名单、主动发言（开关/阈值/间隔/概率）、唤醒模式、是否允许自行潜水、思考强度。
- 状态页：桥接状态徽标 + `state/bridge.log` 尾部。
- 独立面板模式（`node server.mjs`），不加载 DSH 插件，不影响 Harness 启动。
- `scripts/install.mjs` / `scripts/uninstall.mjs`：带备份的安装与一键救援卸载。
- 桥接目录自动探测（env → `~/.dsh/qq-panel.json` → 同级/内嵌 `qq-bridge`），并可在面板里改。

### 修复（开发期踩到的坑）
- 客户端插件未导出 `inject: ['slots']` 导致 `ctx.slots` 为 undefined、`apply` 抛错，
  DSH 报 `web boot: 1 entry did not activate` 并拒绝启动；现已在 `apply` 内做防御并对缺失服务安静退出。
- profile 行带 `config` 但无对应 `Config` schema 同样可能导致 entry 激活失败；现改为从环境变量/配置文件解析路径。
