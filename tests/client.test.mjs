// client bundle smoke test.
//
// Why this exists: a client plugin that throws during activation makes DSH report
// "web boot: 1 entry did not activate" and refuse to start. That is exactly the bug
// this plugin shipped once (missing `inject: ['slots']` → ctx.slots undefined →
// apply throws → entry failed → boot aborted). This test fakes window.__ModuleLoader__,
// React and a cordis ctx, then asserts:
//   (a) the module declares `inject: ['slots']`,
//   (b) `apply` registers into plugins.bundle.config,
//   (c) `apply` stays silent when the slots service is absent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(HERE, '..', 'lib', 'client.js'), 'utf8');

let captured = null;
const doc = {
  createElement: () => ({ dataset: {}, remove() {} }),
  head: { appendChild() {} },
};
const win = { __ModuleLoader__: { load: (spec) => (captured = spec) }, document: doc, console };
// eslint-disable-next-line no-new-func
new Function('window', code)(win);
assert.ok(captured, 'client.js must call window.__ModuleLoader__.load()');
assert.equal(captured.id, 'dsh-qq-panel');

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useCallback: (f) => f,
};
const mod = captured.factory((name) => {
  if (name === 'react') return ReactStub;
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return {};
  throw new Error(`unexpected require: ${name}`);
});

assert.ok(Array.isArray(mod.inject), 'module must export inject');
assert.ok(mod.inject.includes('slots'), "inject must include 'slots' (otherwise ctx.slots is undefined)");
assert.equal(typeof mod.apply, 'function');

// A: healthy ctx — registers the page.
const seen = [];
mod.apply({
  effect: (fn) => fn(),
  slots: {
    inject: (name, cb) => cb(),
    register: (meta, comp) => {
      seen.push(`${meta.name}:${meta.key}:${typeof comp}`);
      return () => {};
    },
  },
});
assert.deepEqual(seen, ['plugins.bundle.config:dsh-qq-panel:function']);

// B: no slots service — must not throw (a throw would break DSH boot).
mod.apply({ effect: (fn) => fn() });
console.log('client.test: ok');
