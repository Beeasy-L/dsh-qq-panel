# dsh-qq-panel

A **settings panel for QQ bridges on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)**:
edit persona cards, manage a sticker library, tune proactive messaging and other behaviour,
and watch runtime status — right inside DSH's settings page.

It targets the repository layout of [qq-bridge](https://github.com/Derpyu520/qq-bridge)
(QQ ↔ DSH bridge) and only **reads and writes files**: it never starts/stops SnowLuma,
never touches the QQ client, never sends a message.

> Also works **without DSH** as a local web page: `node server.mjs` → <http://127.0.0.1:3101>.
> Both modes share the same read/write code.

## Features

| Tab | What it does |
| --- | --- |
| **Persona** | Lists `roles/*.md`; edits them in a monospace editor; backs up before saving to `人格卡/<role>/版本/` (keeps the last 30); switches the active persona (hot — injected per message); shows character count and lint hints |
| **Stickers** | Lists sticker assets with title/size/uploaded state; edits the per-sticker note the model uses when picking an image; uploads a sticker into QQ favourites via OneBot `add_custom_face` |
| **Behaviour** | Owner QQ, private/group allow-lists, proactive messaging (on/off, idle threshold, check interval, probability), wake mode, whether the model may set its own dive timer, reasoning effort; writes `config.json` (takes effect after the bridge restarts) |
| **Status / logs** | Bridge reachability, mode, SnowLuma connection, active persona; tail of `state/bridge.log` |

## Install

Requires Node ≥ 22.13 and an existing DSH profile under `~/.dsh/profiles/<profile>/`.

```bash
git clone https://github.com/<you>/dsh-qq-panel.git
cd dsh-qq-panel
node scripts/install.mjs              # --dry-run to preview, --profile=web for another profile
```

Then **restart Harness** (the client bundle and the plugin row load at boot).
Entry point: **Settings → Plugins → dsh-qq-panel**.

Uninstall / emergency recovery:

```bash
node scripts/uninstall.mjs                  # remove registration + link
node scripts/uninstall.mjs --restore-backup # also restore the newest package.json backup
```

## Standalone mode

```bash
node server.mjs                    # http://127.0.0.1:3101
QQ_BRIDGE_DIR=/path/to/qq-bridge node server.mjs 3102
```

No DSH plugin is loaded, so it cannot affect Harness startup.

## Finding the bridge folder

1. `QQ_BRIDGE_DIR` environment variable
2. `bridgeDir` in `~/.dsh/qq-panel.json` (saved from the panel)
3. a sibling `qq-bridge/` next to this repo
4. a nested `qq-bridge/` inside this repo

## Development

```bash
node --test tests/*.test.mjs
node server.mjs
```

- `lib/index.js` — host half (cordis plugin) registering `/api/qq-panel/*`
- `lib/client.js` — client half, hand-written lazy-CJS, registered into `plugins.bundle.config`
- `tests/host.test.mjs` — mounts the host with a fake ctx and calls every route
- `tests/client.test.mjs` — fakes `window.__ModuleLoader__` and asserts the plugin contract

### Two traps worth knowing (both cost a reinstall once)

1. A client plugin **must** export `inject: ['slots']`. Without it `ctx.slots` is `undefined`,
   `apply` throws, the entry becomes `failed`, and DSH refuses to boot with
   `web boot: 1 entry did not activate`.
2. Do **not** put `config` on the profile row unless the plugin exports a matching `Config`
   schema — that can also leave the entry unactivated, with the same symptom.

## License

MIT. Not affiliated with DeepSeek or Tencent/QQ.
