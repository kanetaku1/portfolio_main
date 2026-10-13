#!/usr/bin/env node
/**
 * 旧URL（https://kanetaku1.github.io/portfolio_main/）用の転送ページを dist-legacy/ に生成する。
 * 名刺や SNS に旧URLが載っているので、GitHub Pages の gh-pages ブランチにこれを置いて生かし続ける。
 *
 * 使い方: npm run legacy:build   → dist-legacy/ を gh-pages ブランチに push する
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-legacy');

// astro.config.mjs の site を新しい転送先にする
const SITE = readFileSync(path.join(ROOT, 'astro.config.mjs'), 'utf8')
  .match(/site:\s*'([^']+)'/)?.[1]
  ?.replace(/\/$/, '');
if (!SITE) throw new Error('astro.config.mjs に site が見つかりません');

/** 旧ページ → 新ページ */
const PAGES = {
  'index.html': '/',
  'blog/2023_4_cherry-blossom.html': '/writing/spring-walk',
  'blog/2025_11_line-login-connect.html': '/works/jobsta',
};

/** 旧トップページのアンカー → 新ページ */
const ANCHORS = {
  '#about': '/about',
  '#skills': '/about',
  '#projects': '/works',
  '#blog': '/writing',
  '#contact': '/contact',
};

const page = (target, script = '') => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Golcha Works は移転しました</title>
<link rel="canonical" href="${SITE}${target}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${SITE}${target}">
${script}
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:20vh auto;padding:0 1rem;line-height:1.8;color:#1d1c1a;background:#f6f4ef}a{color:#2f6a4f}</style>
</head>
<body>
<p>Golcha Works は新しいアドレスに移転しました。</p>
<p><a href="${SITE}${target}">${SITE}${target}</a></p>
</body>
</html>
`;

// トップページだけはアンカー（#projects など）を見て行き先を変える
const anchorScript = `<script>
var map = ${JSON.stringify(ANCHORS)};
location.replace(${JSON.stringify(SITE)} + (map[location.hash] || '/'));
</script>`;

// 存在しないパスは、わかる範囲で新しいページに、わからなければトップに送る
const notFoundScript = `<script>
var pages = ${JSON.stringify(PAGES)};
var rel = location.pathname.replace(/^\\/portfolio_main\\/?/, '');
location.replace(${JSON.stringify(SITE)} + (pages[rel] || '/'));
</script>`;

await rm(OUT, { recursive: true, force: true });
for (const [from, to] of Object.entries(PAGES)) {
  const file = path.join(OUT, from);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(to, from === 'index.html' ? anchorScript : ''));
}
await writeFile(path.join(OUT, '404.html'), page('/', notFoundScript));
await writeFile(path.join(OUT, '.nojekyll'), '');

console.log(`dist-legacy/ に転送ページを生成しました → ${SITE}`);
