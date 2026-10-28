#!/usr/bin/env node
// Point the repository at its own GitHub home (independent repo, not a branch of
// someone else's project) and rewrite the metadata that mentions it.
//
//   node scripts/set-repo.mjs https://github.com/<user>/dsh-qq-panel.git [--dry-run]
//
// Updates:
//   - git remote origin                      → the given URL
//   - package.json repository/homepage/bugs  → derived from the URL
//   - README.md clone line                    → derived from the URL
// and commits the metadata change (unless --dry-run).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urlArg = args.find((a) => /^https?:\/\//.test(a) || /^git@/.test(a));

if (!urlArg) {
  console.error('用法：node scripts/set-repo.mjs https://github.com/<user>/<repo>.git [--dry-run]');
  process.exit(1);
}

// 统一成 https 形式便于派生 homepage / bugs
const httpsUrl = urlArg
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/\.git$/, '');
const cloneUrl = `${httpsUrl}.git`;

const pkgFile = path.join(REPO, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.repository = { type: 'git', url: cloneUrl };
pkg.homepage = `${httpsUrl}#readme`;
pkg.bugs = { url: `${httpsUrl}/issues` };
if (!pkg.author) pkg.author = httpsUrl.split('/')[3];

const readmeFile = path.join(REPO, 'README.md');
let readme = fs.readFileSync(readmeFile, 'utf8');
readme = readme.replace(
  /git clone \S+ dsh-qq-panel/,
  `git clone ${cloneUrl} dsh-qq-panel`,
);

const steps = [
  ['package.json', `${path.basename(pkgFile)}：repository/homepage/bugs → ${httpsUrl}`],
  ['README.md', `README.md：clone 行 → ${cloneUrl}`],
  ['git remote', `origin → ${cloneUrl}`],
];

if (dryRun) {
  console.log('（--dry-run，不写文件、不改 remote）');
  for (const [, label] of steps) console.log(`  · ${label}`);
  process.exit(0);
}

fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
fs.writeFileSync(readmeFile, readme, 'utf8');

try {
  const remotes = execFileSync('git', ['-C', REPO, 'remote'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (remotes.includes('origin')) execFileSync('git', ['-C', REPO, 'remote', 'set-url', 'origin', cloneUrl]);
  else execFileSync('git', ['-C', REPO, 'remote', 'add', 'origin', cloneUrl]);
} catch (error) {
  console.error(`设置 git remote 失败：${error.message}`);
}

try {
  execFileSync('git', ['-C', REPO, 'add', 'package.json', 'README.md']);
  execFileSync('git', ['-C', REPO, 'commit', '-m', `chore: 指向独立仓库 ${httpsUrl}`]);
} catch {
  console.log('（没有需要提交的元信息改动）');
}

for (const [, label] of steps) console.log(`  ✓ ${label}`);
console.log('');
console.log('下一步：git push -u origin main');
