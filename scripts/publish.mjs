#!/usr/bin/env node
/**
 * npm run publish — Vault の内容をサイトに公開する
 *
 *   1. Vault から同期（Garden / Writing / Weekly / Now.md）
 *   2. プライバシーチェック
 *   3. 型チェックとビルド
 *   4. 変更の一覧を表示して確認
 *   5. src/content だけをコミットして push → Cloudflare Workers が自動で公開
 *
 * オプション
 *   --dry-run   コミットと push をしない（確認だけ）
 *   --yes       最後の確認を省略する（プライバシーの警告がある場合は省略できない）
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { OUT, syncVault } from './sync-vault.mjs';
import { checkPrivacy } from './privacy-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISH_BRANCH = 'main';
const NOW_STALE_DAYS = 45;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const YES = args.has('--yes');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};
const step = (n, s) => console.log(`\n${c.bold(`[${n}/5]`)} ${s}`);
const abort = (msg) => {
  console.error(`\n${c.red('✖ 中止しました:')} ${msg}`);
  process.exit(1);
};

main().catch((e) => abort(e.message));

async function main() {
  // 0. ブランチの確認
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== PUBLISH_BRANCH && !DRY_RUN) {
    abort(`公開は ${PUBLISH_BRANCH} ブランチから行います（現在: ${branch}）。確認だけなら --dry-run を付けてください`);
  }
  const otherChanges = changedFiles().filter((f) => !f.path.startsWith('src/content/'));
  if (otherChanges.length) {
    console.log(c.yellow(`※ src/content 以外の変更が ${otherChanges.length} 件あります。これらは公開に含めません。`));
  }

  // 1. 同期
  step(1, 'Vault から同期');
  const { counts, warnings, vault } = await syncVault();
  console.log(c.dim(`  ${vault}`));
  console.log(
    `  notes ${counts.notes} / writing ${counts.writing} / journal ${counts.journal} / now ${counts.now} / 画像 ${counts.assets}`,
  );
  for (const w of warnings) console.log(c.yellow(`  ! ${w}`));
  warnIfNowIsStale();

  // 2. プライバシーチェック
  step(2, 'プライバシーチェック');
  const privacy = await checkPrivacy(OUT);
  console.log(c.dim(`  NGワード ${privacy.denylistSize} 語で確認`));
  if (privacy.errors.length) {
    for (const e of privacy.errors) console.log(c.red(`  ✖ ${e.where} ${e.label}\n      ${e.line.trim()}`));
    abort('NGワードが含まれています。Vault 側で直してから、もう一度実行してください');
  }
  for (const w of privacy.warnings) console.log(c.yellow(`  ! ${w.where} ${w.label}らしき表記\n      ${w.line.trim()}`));
  if (privacy.warnings.length === 0) console.log(c.green('  ✔ 問題なし'));

  // 3. 型チェックとビルド
  step(3, '型チェックとビルド');
  run('npx astro check');
  run('npx astro build --silent');
  console.log(c.green('  ✔ ビルド成功'));

  // 4. 変更の確認
  step(4, '公開される変更');
  const changes = changedFiles().filter((f) => f.path.startsWith('src/content/'));
  if (changes.length === 0) {
    console.log('  公開する変更はありません。');
    return;
  }
  const mark = { A: c.green('+ 追加'), M: c.yellow('~ 更新'), D: c.red('- 削除') };
  for (const f of changes) console.log(`  ${mark[f.status]}  ${f.path.replace('src/content/', '')}`);

  if (DRY_RUN) {
    console.log(c.dim('\n--dry-run のため、ここで終了します。'));
    return;
  }
  if (privacy.warnings.length && YES) abort('プライバシーの警告があるため --yes は使えません。内容を確認して実行し直してください');
  if (!YES) {
    const question = privacy.warnings.length
      ? '\n上の警告を確認しました。公開してよいですか？ [y/N] '
      : '\n公開してよいですか？ [y/N] ';
    if (!(await confirm(question))) abort('公開をキャンセルしました（同期した内容は手元に残っています）');
  }

  // 5. コミットと push
  step(5, 'コミットして push');
  const summary = summarize(changes);
  git('add', '--', 'src/content');
  git('commit', '-m', `publish: ${today()} ${summary}`);
  run(`git push origin ${PUBLISH_BRANCH}`);
  console.log(c.green(`\n✔ 公開しました（${summary}）。1〜2分で本番に反映されます。`));
}

/* ------------------------------------------------------------------ */

function git(...a) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function run(cmd) {
  const r = spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) abort(`「${cmd}」が失敗しました`);
}

/** git status から変更ファイルを取り出す（追加 A / 更新 M / 削除 D） */
function changedFiles() {
  const out = git('status', '--porcelain', '-uall');
  if (!out) return [];
  return out.split('\n').map((line) => {
    const code = line.slice(0, 2);
    const file = line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '');
    const status = code.includes('D') ? 'D' : code.includes('?') || code.includes('A') ? 'A' : 'M';
    return { status, path: file };
  });
}

function summarize(changes) {
  const byKind = {};
  for (const f of changes) {
    const kind = f.path.match(/src\/content\/(?:vault\/)?([^/.]+)/)?.[1] ?? 'other';
    const label = kind === 'assets' || kind === 'images' ? '画像' : kind;
    byKind[label] ??= { A: 0, M: 0, D: 0 };
    byKind[label][f.status]++;
  }
  return Object.entries(byKind)
    .map(([k, v]) => `${k}(${[v.A && `+${v.A}`, v.M && `~${v.M}`, v.D && `-${v.D}`].filter(Boolean).join(' ')})`)
    .join(' ');
}

function warnIfNowIsStale() {
  try {
    const fm = readFileSync(path.join(OUT, 'now.md'), 'utf8');
    const updated = new Date(fm.match(/^updated:\s*(\S+)/m)?.[1] ?? '');
    const days = Math.floor((Date.now() - +updated) / 86_400_000);
    if (days > NOW_STALE_DAYS) {
      console.log(c.yellow(`  ! Now.md が ${days} 日更新されていません。そろそろ書き直しどきです`));
    }
  } catch {
    /* Now.md が無い場合は同期側で警告済み */
  }
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
}
