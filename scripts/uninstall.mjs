#!/usr/bin/env node
// Uninstall this plugin from a DSH profile — the safety net for
// "installed a plugin, Harness no longer starts".
//
//   node scripts/uninstall.mjs [--profile desktop] [--restore-backup]
//
// Default: remove `dsh-qq-panel` from dependencies + bundles and delete the
// node_modules link. That is enough for a normal uninstall.
//
// --restore-backup: additionally restore the newest package.json backup that
// install.mjs / the manual install left behind (use this when you are not sure
// what else got edited).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PKG_NAME = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).name;

const args = process.argv.slice(2);
const restore = args.includes('--restore-backup');
const profileArg = args.find((a) => a.startsWith('--profile='));
const profile = profileArg ? profileArg.split('=')[1] : process.env.DSH_PROFILE || 'desktop';

const profileDir = path.join(os.homedir(), '.dsh', 'profiles', profile);
const pkgFile = path.join(profileDir, 'package.json');
const linkPath = path.join(profileDir, 'node_modules', PKG_NAME);

if (!fs.existsSync(pkgFile)) {
  console.error(`找不到 profile：${pkgFile}`);
  process.exit(1);
}

if (restore) {
  const dir = path.dirname(pkgFile);
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${path.basename(pkgFile)}.bak-`) && f.includes(PKG_NAME))
    .sort();
  if (!candidates.length) {
    console.error('没有找到与插件相关的 package.json 备份，改用普通卸载流程。');
  } else {
    const newest = candidates[candidates.length - 1];
    fs.copyFileSync(path.join(dir, newest), pkgFile);
    console.log(`已还原 package.json ← ${newest}`);
  }
}

const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
let removed = 0;
if (pkg.dependencies && pkg.dependencies[PKG_NAME]) {
  delete pkg.dependencies[PKG_NAME];
  removed += 1;
}
const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || [];
const idx = bundles.indexOf(PKG_NAME);
if (idx >= 0) {
  bundles.splice(idx, 1);
  removed += 1;
}
if (removed && !restore) {
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}
console.log(removed ? `已从 package.json 移除 ${removed} 处登记` : 'package.json 里本来就没有登记');

try {
  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
    console.log(`已删除链接：${linkPath}`);
  } else {
    console.log('node_modules 链接不存在（无需删除）');
  }
} catch (error) {
  console.log(`删除链接失败：${error.message}（重启 Harness 后再跑一次）`);
}

console.log('');
console.log('完成。现在应该可以正常启动 Harness 了。');
console.log('独立面板模式仍然可用：node server.mjs（默认 http://127.0.0.1:3101）');
