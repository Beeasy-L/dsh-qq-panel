#!/usr/bin/env node
// Install this plugin into a DSH profile.
//
//   node scripts/install.mjs [--profile desktop] [--dry-run]
//
// What it does (all reversible, a timestamped backup is taken first):
//   1. ~/.dsh/profiles/<profile>/package.json: add `dsh-qq-panel` to dependencies
//      as a `link:` spec, and append it to `dsh.profile.bundles`;
//   2. <profile>/node_modules/dsh-qq-panel → this repo (junction on Windows,
//      symlink elsewhere) so the loader can resolve the bundle;
//   3. prints the restart hint (the client bundle and the row only load on boot).
//
// If DSH then fails to start: `node scripts/uninstall.mjs` (or restore the
// printed backup path) puts the profile back exactly as it was.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PKG_NAME = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).name;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const profileArg = args.find((a) => a.startsWith('--profile='));
const profile = profileArg ? profileArg.split('=')[1] : process.env.DSH_PROFILE || 'desktop';

const profileDir = path.join(os.homedir(), '.dsh', 'profiles', profile);
const pkgFile = path.join(profileDir, 'package.json');
const linkPath = path.join(profileDir, 'node_modules', PKG_NAME);

if (!fs.existsSync(pkgFile)) {
  console.error(`找不到 profile：${pkgFile}`);
  console.error('先确认这个 profile 名对不对（~/.dsh/profiles/ 下有哪些目录）。');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${pkgFile}.bak-${PKG_NAME}-${stamp}`;
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];

const linkSpec = `link:${REPO.replace(/\\/g, '/')}`;
const changed = [];
if (pkg.dependencies[PKG_NAME] !== linkSpec) {
  pkg.dependencies[PKG_NAME] = linkSpec;
  changed.push('dependencies');
}
if (!pkg.dsh.profile.bundles.includes(PKG_NAME)) {
  pkg.dsh.profile.bundles.push(PKG_NAME);
  changed.push('bundles');
}

console.log(`profile：${profileDir}`);
console.log(`插件：${REPO}`);
if (!changed.length) console.log('package.json 已经是登记状态，无需改动');
else console.log(`package.json 将更新：${changed.join(' + ')}`);
console.log(`备份：${path.basename(backup)}`);

if (dryRun) {
  console.log('（--dry-run：不写任何文件）');
  process.exit(0);
}

if (changed.length) {
  fs.copyFileSync(pkgFile, backup);
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

// node_modules link
try {
  if (fs.existsSync(linkPath)) {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink() || st.isDirectory()) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(REPO, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  const ok = (() => {
    try {
      return fs.lstatSync(linkPath).isSymbolicLink() && fs.readdirSync(linkPath).includes('package.json');
    } catch {
      return false;
    }
  })();
  if (!ok) throw new Error('链接建好后校验失败（可能被系统降级成了目录副本）');
  console.log(`已链接：${linkPath} → ${REPO}`);
} catch (error) {
  console.error(`创建 node_modules 链接失败：${error.message}`);
  console.error('手动办法：mklink /J "<profile>\\node_modules\\' + PKG_NAME + '" "' + REPO + '"');
  process.exit(1);
}

console.log('');
console.log('装好了。**重启 Harness**（关掉再打开）后，面板出现在：设置 → 插件 → ' + PKG_NAME);
console.log('如果重启失败：node scripts/uninstall.mjs   （或还原上面那份备份）');
