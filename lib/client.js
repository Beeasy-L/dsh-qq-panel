/**
 * dsh-qq-panel — 客户端半边（DSH 设置页里的插件面板）。
 *
 * 注册进 `plugins.bundle.config` 槽位：安装后在「设置 → 插件 → dsh-qq-panel」页显示。
 * 数据全部来自同源路由 `api/qq-panel/*`（host 半边代理桥接，避免跨域）。
 * 手写 lazy-CJS + 原生 HTML 元素，不依赖构建产物。
 */
window.__ModuleLoader__.load({
  id: 'dsh-qq-panel',
  factory(require) {
    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;

    var API = 'api/qq-panel/';
    var CSS = [
      '.qqp{display:flex;flex-direction:column;gap:14px;font-size:13px}',
      '.qqp-tabs{display:flex;gap:6px;flex-wrap:wrap}',
      '.qqp-tab{padding:6px 12px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;cursor:pointer;font-size:13px}',
      '.qqp-tab[data-on="1"]{background:rgba(90,140,255,.18);border-color:rgba(90,140,255,.6);font-weight:600}',
      '.qqp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.qqp-field{display:flex;flex-direction:column;gap:4px;min-width:180px;flex:1}',
      '.qqp-label{font-size:12px;opacity:.7}',
      '.qqp input,.qqp textarea,.qqp select{width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;font-size:13px}',
      '.qqp textarea{min-height:260px;font-family:ui-monospace,Consolas,monospace;line-height:1.5;resize:vertical}',
      '.qqp button{padding:6px 12px;border-radius:6px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.12);color:inherit;cursor:pointer;font-size:13px}',
      '.qqp button:disabled{opacity:.5;cursor:default}',
      '.qqp button[data-primary="1"]{background:rgba(90,140,255,.22);border-color:rgba(90,140,255,.65);font-weight:600}',
      '.qqp-card{border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px}',
      '.qqp-mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:320px;overflow:auto;background:rgba(127,127,127,.08);padding:8px;border-radius:8px}',
      '.qqp-badge{font-size:11px;padding:2px 8px;border-radius:99px;border:1px solid rgba(127,127,127,.35)}',
      '.qqp-ok{color:#31c48d}.qqp-err{color:#f05252}.qqp-dim{opacity:.6}',
    ].join('');

    function api(path, init) {
      return fetch(API + path, Object.assign({ cache: 'no-store' }, init || {})).then(function (r) {
        return r.json().catch(function () {
          return { ok: false, error: 'HTTP ' + r.status };
        });
      });
    }
    function postJson(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    function fmtTime(ms) {
      if (!ms) return '—';
      try {
        return new Date(ms).toLocaleString('zh-CN', { hour12: false });
      } catch {
        return '—';
      }
    }

    function Panel() {
      var tabState = useState('persona');
      var tab = tabState[0];
      var setTab = tabState[1];
      var stateState = useState(null);
      var state = stateState[0];
      var setState = stateState[1];
      var msgState = useState('');
      var msg = msgState[0];
      var setMsg = msgState[1];
      var busyState = useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      var refresh = useCallback(function () {
        return api('state').then(function (j) {
          if (j && j.ok) setState(j);
          else setMsg((j && j.error) || '读取失败');
        });
      }, []);

      useEffect(function () {
        refresh();
        var t = setInterval(refresh, 15000);
        return function () {
          clearInterval(t);
        };
      }, [refresh]);

      function act(label, fn) {
        setBusy(true);
        setMsg(label + '…');
        Promise.resolve()
          .then(fn)
          .then(function (r) {
            setMsg(r && r.ok ? label + '：成功' + (r.note ? '（' + r.note + '）' : '') : label + '：失败 ' + ((r && r.error) || ''));
            return refresh();
          })
          .catch(function (e) {
            setMsg(label + '：异常 ' + (e && e.message));
          })
          .then(function () {
            setBusy(false);
          });
      }

      if (!state) {
        return h('div', { className: 'qqp' }, h('div', { className: 'qqp-dim' }, '正在读取桥接状态…'));
      }
      var bridge = state.bridge || {};
      var sl = bridge.snowluma || {};

      var header = h(
        'div',
        { className: 'qqp-card' },
        h(
          'div',
          { className: 'qqp-row' },
          h('span', { className: 'qqp-badge' }, '桥接 ' + (bridge.reachable ? '在线' : '离线')),
          h('span', { className: 'qqp-badge' }, '模式 ' + (bridge.mode || '—')),
          h('span', { className: 'qqp-badge' }, 'SnowLuma ' + (sl.connected ? '已连接' : '未连接')),
          h('span', { className: 'qqp-badge' }, '人格 ' + (state.activeRole || '—')),
          h('span', { style: { flex: 1 } }),
          h(
            'button',
            { disabled: busy, onClick: refresh },
            '刷新状态',
          ),
          h(
            'a',
            { href: 'http://127.0.0.1:' + (state.config.consolePort || 3100) + '/', target: '_blank', rel: 'noreferrer' },
            h('button', null, '打开桥接控制台'),
          ),
        ),
        msg ? h('div', { className: 'qqp-dim' }, msg) : null,
      );

      // 没配置 qq-bridge 目录时，先让用户填路径（点保存后写 ~/.dsh/qq-panel.json）
      var setupBanner = null;
      if (!state.configured) {
        setupBanner = h(SetupCard, { state: state, refresh: refresh, setMsg: setMsg, busy: busy });
      }

      var tabs = h(
        'div',
        { className: 'qqp-tabs' },
        ['persona', 'stickers', 'behaviour', 'status'].map(function (id) {
          var label = { persona: '人格卡', stickers: '表情包', behaviour: '行为参数', status: '状态 / 日志' }[id];
          return h(
            'button',
            { key: id, className: 'qqp-tab', 'data-on': tab === id ? '1' : '0', onClick: function () { setTab(id); } },
            label,
          );
        }),
      );

      var body = null;
      if (tab === 'persona') body = h(PersonaTab, { state: state, act: act, busy: busy, refresh: refresh, setMsg: setMsg });
      if (tab === 'stickers') body = h(StickersTab, { act: act, busy: busy, setMsg: setMsg });
      if (tab === 'behaviour') body = h(BehaviourTab, { state: state, act: act, busy: busy });
      if (tab === 'status') body = h(StatusTab, { act: act, busy: busy, bridgeDir: state.bridgeDir });

      return h('div', { className: 'qqp' }, header, setupBanner, tabs, body);
    }

    function SetupCard(props) {
      var vState = useState((props.state && props.state.bridgeDir) || '');
      var value = vState[0];
      var setValue = vState[1];
      return h(
        'div',
        { className: 'qqp-card' },
        h('div', { style: { fontWeight: 600 } }, '先指定 qq-bridge 目录'),
        h('div', { className: 'qqp-dim' }, (props.state && props.state.hint) || '例如 C:/Users/you/qq-bridge（含 roles/ 与 config.json 的目录）'),
        h('input', { value: value, placeholder: 'C:/path/to/qq-bridge', onChange: function (e) { setValue(e.target.value); } }),
        h(
          'div',
          { className: 'qqp-row' },
          h(
            'button',
            {
              'data-primary': '1',
              disabled: props.busy,
              onClick: function () {
                props.setMsg('保存目录…');
                postJson('bridge-dir', { bridgeDir: value }).then(function (r) {
                  props.setMsg(r.ok ? '目录已保存' : '保存失败：' + r.error);
                  props.refresh();
                });
              },
            },
            '保存目录',
          ),
        ),
      );
    }

    function PersonaTab(props) {
      var state = props.state;
      var roles = state.roles || [];
      var pickState = useState(state.activeRole || (roles[0] && roles[0].name) || '');
      var role = pickState[0];
      var setRole = pickState[1];
      var textState = useState('');
      var text = textState[0];
      var setText = textState[1];
      var infoState = useState(null);
      var info = infoState[0];
      var setInfo = infoState[1];

      function load(name) {
        api('persona?name=' + encodeURIComponent(name)).then(function (j) {
          if (j && j.ok) {
            setText(j.content || '');
            setInfo(j);
          } else props.setMsg((j && j.error) || '读取人格卡失败');
        });
      }
      useEffect(function () {
        if (role) load(role);
      }, [role]);

      return h(
        'div',
        { className: 'qqp' },
        h(
          'div',
          { className: 'qqp-row' },
          roles.map(function (r) {
            return h(
              'button',
              { key: r.name, className: 'qqp-tab', 'data-on': r.name === role ? '1' : '0', onClick: function () { setRole(r.name); } },
              r.name + (r.active ? '（启用中）' : ''),
            );
          }),
        ),
        h(
          'div',
          { className: 'qqp-dim' },
          '文件：roles/' + role + '.md ｜ ' + (info ? info.chars : text.length) + ' 字符' + (info && info.warnings && info.warnings.length ? ' ｜ 提醒：' + info.warnings.join('；') : '') + ' ｜ 保存即生效（人格随每条消息注入）',
        ),
        h('textarea', {
          value: text,
          spellCheck: false,
          onChange: function (e) { setText(e.target.value); },
        }),
        h(
          'div',
          { className: 'qqp-row' },
          h(
            'button',
            { 'data-primary': '1', disabled: props.busy, onClick: function () { props.act('保存人格卡', function () { return postJson('persona', { role: role, content: text }).then(function (r) { if (r.ok) load(role); return r; }); }); } },
            '保存（自动备份）',
          ),
          h('button', { disabled: props.busy, onClick: function () { props.act('启用该人格', function () { return postJson('persona/activate', { role: role }).then(function (r) { if (r.ok) setRole(role); return r; }); }); } }, '启用这个人格'),
          h('button', { disabled: props.busy, onClick: function () { props.act('备份人格卡', function () { return postJson('persona/backup', {}); }); } }, '备份当前卡'),
          h('button', { disabled: props.busy, onClick: function () { load(role); } }, '重新读取'),
        ),
      );
    }

    function StickersTab(props) {
      var listState = useState([]);
      var list = listState[0];
      var setList = listState[1];
      var qState = useState('');
      var q = qState[0];
      var setQ = qState[1];
      var draftState = useState({});
      var drafts = draftState[0];
      var setDrafts = draftState[1];

      function load() {
        api('stickers').then(function (j) {
          if (j && j.ok) setList(j.stickers || []);
          else props.setMsg((j && j.error) || '读取表情包失败');
        });
      }
      useEffect(function () {
        load();
      }, []);

      var filtered = list.filter(function (s) {
        if (!q) return true;
        return (s.file + ' ' + s.title + ' ' + s.note + ' ' + (s.tags || []).join(' ')).toLowerCase().indexOf(q.toLowerCase()) >= 0;
      });

      return h(
        'div',
        { className: 'qqp' },
        h(
          'div',
          { className: 'qqp-row' },
          h('input', { placeholder: '搜索文件名 / 备注 / 标签', value: q, onChange: function (e) { setQ(e.target.value); }, style: { maxWidth: 260 } }),
          h('span', { className: 'qqp-dim' }, '共 ' + list.length + ' 张，已上传 ' + list.filter(function (s) { return s.emojiId; }).length + ' 张'),
          h('button', { disabled: props.busy, onClick: load }, '刷新'),
        ),
        filtered.map(function (s) {
          var key = s.file;
          var draft = drafts[key] !== undefined ? drafts[key] : s.note;
          return h(
            'div',
            { key: key, className: 'qqp-card' },
            h(
              'div',
              { className: 'qqp-row' },
              h('span', { className: 'qqp-badge' }, s.emojiId ? '已上传' : '未上传'),
              h('span', { style: { fontWeight: 600 } }, s.file),
              h('span', { className: 'qqp-dim' }, Math.round((s.bytes || 0) / 1024) + ' KB'),
              h('span', { className: 'qqp-dim', title: s.title }, (s.title || '').slice(0, 40)),
              h('span', { style: { flex: 1 } }),
              s.emojiId
                ? h('button', {
                    disabled: props.busy,
                    onClick: function () {
                      props.act('保存备注', function () {
                        return postJson('stickers/note', { stickerId: s.emojiId, note: draft, tags: s.tags });
                      });
                    },
                  }, '保存备注')
                : h('button', {
                    disabled: props.busy,
                    onClick: function () {
                      props.act('上传 ' + s.file, function () {
                        return postJson('stickers/upload', { file: s.file, dir: s.dir }).then(function (r) { if (r.ok) load(); return r; });
                      });
                    },
                  }, '上传到 QQ'),
            ),
            h('input', {
              placeholder: '这张表情的含义（AI 挑图就看这里）',
              value: draft,
              onChange: function (e) {
                var next = Object.assign({}, drafts);
                next[key] = e.target.value;
                setDrafts(next);
              },
            }),
          );
        }),
      );
    }

    function BehaviourTab(props) {
      var cfg = (props.state && props.state.config) || {};
      var formState = useState(null);
      var form = formState[0];
      var setForm = formState[1];
      var loadedState = useState(false);
      var loaded = loadedState[0];
      var setLoaded = loadedState[1];

      useEffect(function () {
        api('config').then(function (j) {
          if (j && j.ok) {
            setForm(Object.assign({}, j.value, {
              allowPrivateText: (j.value.allowPrivate || []).join(','),
              allowGroupsText: (j.value.allowGroups || []).join(','),
              proactive: Object.assign({}, j.value.proactive || {}),
            }));
            setLoaded(true);
          } else props.setMsg((j && j.error) || '读取配置失败');
        });
      }, []);
      if (!loaded || !form) return h('div', { className: 'qqp-dim' }, '读取配置中…');

      function set(key, value) {
        var next = Object.assign({}, form);
        next[key] = value;
        setForm(next);
      }
      function setProactive(key, value) {
        var next = Object.assign({}, form);
        next.proactive = Object.assign({}, form.proactive);
        next.proactive[key] = value;
        setForm(next);
      }
      function num(v, fallback) {
        var n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      }
      function save() {
        props.act('保存行为参数', function () {
          return postJson('config', {
            ownerQQ: form.ownerQQ,
            allowPrivate: String(form.allowPrivateText || '').split(/[,，\s]+/).filter(Boolean),
            allowGroups: String(form.allowGroupsText || '').split(/[,，\s]+/).filter(Boolean),
            proactive: {
              enabled: !!form.proactive.enabled,
              idleThresholdMs: num(form.proactive.idleThresholdMin, 10) * 60000,
              checkIntervalMinMs: num(form.proactive.checkIntervalMinMin, 15) * 60000,
              checkIntervalMaxMs: num(form.proactive.checkIntervalMaxMin, 30) * 60000,
              probability: num(form.proactive.probability, 0.6),
            },
            wakeDefaultMode: form.wakeDefaultMode,
            setWakeConfig: !!form.setWakeConfig,
            reasoningEffort: form.reasoningEffort,
          });
        });
      }

      var p = form.proactive || {};
      return h(
        'div',
        { className: 'qqp' },
        h(
          'div',
          { className: 'qqp-card' },
          h('div', { style: { fontWeight: 600 } }, '访问控制'),
          h(
            'div',
            { className: 'qqp-row' },
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '管理员 QQ（ownerQQ）'), h('input', { value: form.ownerQQ || '', onChange: function (e) { set('ownerQQ', e.target.value); } })),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '私聊白名单（逗号分隔）'), h('input', { value: form.allowPrivateText, onChange: function (e) { set('allowPrivateText', e.target.value); } })),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '群白名单（逗号分隔）'), h('input', { value: form.allowGroupsText, onChange: function (e) { set('allowGroupsText', e.target.value); } })),
          ),
        ),
        h(
          'div',
          { className: 'qqp-card' },
          h('div', { style: { fontWeight: 600 } }, '主动发言（它自己找话题）'),
          h(
            'div',
            { className: 'qqp-row' },
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '启用'), h('select', { value: p.enabled ? '1' : '0', onChange: function (e) { setProactive('enabled', e.target.value === '1'); } }, h('option', { value: '1' }, '开'), h('option', { value: '0' }, '关'))),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '冷场多少分钟后算“可以搭话”（分钟）'), h('input', { value: p.idleThresholdMin !== undefined ? p.idleThresholdMin : Math.round((p.idleThresholdMs || 600000) / 60000), onChange: function (e) { setProactive('idleThresholdMin', e.target.value); } })),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '检查间隔最小（分钟）'), h('input', { value: p.checkIntervalMinMin !== undefined ? p.checkIntervalMinMin : Math.round((p.checkIntervalMinMs || 900000) / 60000), onChange: function (e) { setProactive('checkIntervalMinMin', e.target.value); } })),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '检查间隔最大（分钟）'), h('input', { value: p.checkIntervalMaxMin !== undefined ? p.checkIntervalMaxMin : Math.round((p.checkIntervalMaxMs || 1800000) / 60000), onChange: function (e) { setProactive('checkIntervalMaxMin', e.target.value); } })),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '真开口的概率（0~1）'), h('input', { value: p.probability !== undefined ? p.probability : 0.6, onChange: function (e) { setProactive('probability', e.target.value); } })),
          ),
        ),
        h(
          'div',
          { className: 'qqp-card' },
          h('div', { style: { fontWeight: 600 } }, '唤醒与模型'),
          h(
            'div',
            { className: 'qqp-row' },
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '唤醒模式'), h('select', { value: form.wakeDefaultMode || 'active', onChange: function (e) { set('wakeDefaultMode', e.target.value); } }, h('option', { value: 'active' }, 'active（任意消息都醒）'), h('option', { value: 'diving' }, 'diving（会自己潜水）'))),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '允许 AI 自己设置潜水'), h('select', { value: form.setWakeConfig ? '1' : '0', onChange: function (e) { set('setWakeConfig', e.target.value === '1'); } }, h('option', { value: '1' }, '允许'), h('option', { value: '0' }, '禁止'))),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '思考强度'), h('select', { value: form.reasoningEffort || 'max', onChange: function (e) { set('reasoningEffort', e.target.value); } }, h('option', { value: 'max' }, 'max'), h('option', { value: 'high' }, 'high'), h('option', { value: 'low' }, 'low'))),
            h('label', { className: 'qqp-field' }, h('span', { className: 'qqp-label' }, '当前模型'), h('input', { value: form.model || '', disabled: true })),
          ),
        ),
        h(
          'div',
          { className: 'qqp-row' },
          h('button', { 'data-primary': '1', disabled: props.busy, onClick: save }, '保存（桥接重启后生效）'),
          h('span', { className: 'qqp-dim' }, '人格卡改完不用重启；这里的参数写进 config.json，需重启桥接窗口'),
        ),
      );
    }

    function StatusTab(props) {
      var logState = useState([]);
      var lines = logState[0];
      var setLines = logState[1];
      function load() {
        api('logs?lines=60').then(function (j) {
          if (j && j.ok) setLines(j.lines || []);
          else props.setMsg((j && j.error) || '读取日志失败');
        });
      }
      useEffect(function () {
        load();
      }, []);
      return h(
        'div',
        { className: 'qqp' },
        h(
          'div',
          { className: 'qqp-row' },
          h('button', { disabled: props.busy, onClick: load }, '刷新日志'),
          h('span', { className: 'qqp-dim' }, '仓库：' + props.bridgeDir),
        ),
        h('div', { className: 'qqp-mono' }, lines.join('\n') || '（暂无日志）'),
      );
    }

    return {
      // cordis 客户端 entry 必须声明它要用到的服务名，否则 ctx.slots 是 undefined，
      // apply 里一碰就抛错，整个 entry 变 failed → DSH 启动直接中止（实测过）。
      inject: ['slots'],
      apply: function (ctx) {
        if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function') {
          // 拿不到 slots 服务时安静退出：宁可面板不出现，也不要让 Harness 起不来
          try { console.warn('[dsh-qq-panel] slots 服务不可用，面板跳过'); } catch {}
          return;
        }
        ctx.effect(function () {
          if (typeof document === 'undefined') return function () {};
          var tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-qq-panel';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return function () {
            tag.remove();
          };
        }, 'qq-panel: styles');

        ctx.effect(function () {
          return ctx.slots.inject('plugins.bundle.config', function () {
            return ctx.slots.register(
              {
                name: 'plugins.bundle.config',
                key: 'dsh-qq-panel',
                inject: function () {
                  return {};
                },
              },
              Panel,
            );
          });
        }, 'qq-panel: page');
      },
    };
  },
});
