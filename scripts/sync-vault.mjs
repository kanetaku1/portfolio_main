#!/usr/bin/env node
/**
 * Obsidian Vault → src/content/vault/ への同期
 *
 * 公開の境界は「フォルダ」。次のもの以外は一切読まない。
 *   Garden/   → notes   （知識メモ。frontmatter `publish: false` で個別に除外可）
 *   Writing/  → writing （書き上げた記事）
 *   Weekly/   → journal （週次ノートの「## 公開」見出しの下だけ）
 *   Now.md    → now     （Vault 直下のこのファイルだけ。/now とトップページ）
 *
 * 変換内容
 *   - [[ノート]] / [[ノート|表示名]] → 公開ノートならサイト内リンク、非公開ならただの文字列
 *   - ![[画像.png]] / ![](画像.png) → src/content/vault/assets/ にコピーして相対参照
 *   - %%コメント%% と <!-- コメント --> を削除、==ハイライト== → <mark>
 *   - > [!note] タイトル（callout）→ 太字見出し付きの引用
 *
 * src/content/vault/ は毎回まるごと作り直す。手で編集しないこと。
 *
 * 使い方: npm run sync:vault   （VAULT_PATH 環境変数で Vault の場所を変更可）
 *        scripts/publish.mjs からは syncVault() を呼ぶ
 */
import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'src/content/vault');
export const VAULT = path.resolve(
  process.env.VAULT_PATH ?? readEnvFile().VAULT_PATH ?? 'D:/Desktop/obsidian_brain',
);

const SOURCES = [
  { dir: 'Garden', collection: 'notes' },
  { dir: 'Writing', collection: 'writing' },
  { dir: 'Weekly', collection: 'journal' },
];
const PUBLIC_HEADING = /^##\s*公開\s*$/m;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

const NOW_FILE = 'Now.md';

let warnings = [];

// 直接実行されたときだけ動く（publish.mjs から import されたときは動かない）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncVault()
    .then(({ counts, warnings }) => {
      console.log(`Vault: ${VAULT}`);
      console.log(
        `→ notes ${counts.notes} / writing ${counts.writing} / journal ${counts.journal} / now ${counts.now} / assets ${counts.assets}`,
      );
      if (warnings.length) {
        console.log('\n確認してください:');
        for (const w of warnings) console.log(`  - ${w}`);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export async function syncVault() {
  warnings = [];
  if (!existsSync(VAULT)) throw new Error(`Vault が見つかりません: ${VAULT}`);

  // 1. 公開対象を集める
  const docs = [];
  const read = async (file, collection) => {
    const raw = await readFile(file, 'utf8');
    const { data, body } = splitFrontmatter(raw, file);
    if (data.publish === false) return;
    const name = path.basename(file, '.md');
    docs.push({ file, name, collection, data, body, slug: slugify(data.slug ?? name) });
  };
  for (const { dir, collection } of SOURCES) {
    for (const file of await listMarkdown(path.join(VAULT, dir))) await read(file, collection);
  }
  const nowFile = path.join(VAULT, NOW_FILE);
  if (existsSync(nowFile)) await read(nowFile, 'now');
  else warnings.push(`${NOW_FILE} が Vault 直下にありません。/now とトップページの Now 欄が表示できません`);

  // 2. wikilink の解決表（ノート名・エイリアス → URL）
  const linkTable = new Map();
  for (const d of docs) {
    if (d.collection === 'journal' || d.collection === 'now') continue;
    const url = `/${d.collection}/${d.slug}`;
    for (const key of [d.name, ...toArray(d.data.aliases)]) linkTable.set(key.toLowerCase(), url);
  }

  // 3. 出力ディレクトリの中身を空にする（フォルダ自体は残す。消すと dev サーバーの監視が外れる）
  for (const c of ['notes', 'writing', 'journal', 'assets']) {
    const dir = path.join(OUT, c);
    await mkdir(dir, { recursive: true });
    for (const f of await readdir(dir)) await rm(path.join(dir, f), { recursive: true, force: true });
  }
  await rm(path.join(OUT, 'now.md'), { force: true });

  const assetIndex = await indexVaultAssets();
  const counts = { notes: 0, writing: 0, journal: 0, now: 0, assets: 0 };

  for (const d of docs) {
    let body = d.body;
    if (d.collection === 'journal') {
      body = extractPublicSection(body);
      if (!body) continue; // 「公開」欄が空の週は載せない
    }

    const ctx = { doc: d, linkTable, assetIndex, copied: new Set() };
    body = await transformBody(body, ctx);
    counts.assets += ctx.copied.size;

    const fm = await buildFrontmatter(d);
    if (!fm) continue;
    const outFile =
      d.collection === 'now' ? path.join(OUT, 'now.md') : path.join(OUT, d.collection, `${d.slug}.md`);
    await writeFile(outFile, `---\n${stringifyYaml(fm).trim()}\n---\n\n${body.trim()}\n`, 'utf8');
    counts[d.collection]++;
  }

  return { counts, warnings, vault: VAULT };
}

/* ------------------------------------------------------------------ */

async function buildFrontmatter(d) {
  const { data } = d;
  const { birthtime, mtime } = await stat(d.file);
  const title = data.title || d.name;
  const topics = [...toArray(data.topics), ...toArray(data.tags)].map(String).map((t) => t.replace(/^#/, ''));
  const base = { title, ...(data.description && { description: data.description }), topics: unique(topics) };
  if (data.draft) base.draft = true;

  switch (d.collection) {
    case 'notes':
      return {
        ...base,
        stage: ['seedling', 'budding', 'evergreen'].includes(data.stage) ? data.stage : 'seedling',
        created: dateOnly(data.created ?? birthtime),
        updated: dateOnly(data.updated ?? mtime),
      };
    case 'writing':
      return {
        ...base,
        date: dateOnly(data.date ?? data.created ?? birthtime),
        ...(data.updated && { updated: dateOnly(data.updated) }),
        ...(data.kind && { kind: data.kind }),
        ...(data.work && { work: data.work }),
      };
    case 'now':
      return {
        title: data.title || 'いま取り組んでいること',
        ...(data.description && { description: data.description }),
        updated: dateOnly(data.updated ?? mtime),
      };
    case 'journal': {
      const week = String(data.week ?? d.name);
      const monday = isoWeekMonday(week);
      if (!monday) {
        warnings.push(`Weekly/${d.name}.md: 週を判定できないためスキップ（ファイル名か week を 2026-W42 の形式に）`);
        return null;
      }
      const [y, w] = week.split('-W');
      return { ...base, title: data.title || `${y}年 第${Number(w)}週`, week, date: dateOnly(monday) };
    }
  }
}

async function transformBody(body, ctx) {
  // コメントを先に消す（非公開の書き込みを確実に落とす）
  body = body.replace(/%%[\s\S]*?%%/g, '').replace(/<!--[\s\S]*?-->/g, '');

  // コードブロックは変換対象から外す
  const blocks = [];
  body = body.replace(/^(```|~~~)[\s\S]*?^\1/gm, (m) => `\u0000${blocks.push(m) - 1}\u0000`);

  // 埋め込み ![[...]]
  body = await replaceAsync(body, /!\[\[([^\]]+)\]\]/g, async (_, inner) => {
    const [target, alias] = inner.split('|');
    if (IMAGE_EXT.test(target)) {
      const rel = await copyAsset(target.trim(), ctx);
      return rel ? `![${isNaN(Number(alias)) && alias ? alias : ''}](${rel})` : '';
    }
    return wikiLink(target, alias, ctx); // ノートの埋め込みはリンクに落とす
  });

  // 通常リンク [[...]]
  body = body.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [target, alias] = inner.split('|');
    return wikiLink(target, alias, ctx);
  });

  // Markdown 画像 ![alt](相対パス)
  body = await replaceAsync(body, /!\[([^\]]*)\]\((?!https?:|\/)([^)\s]+)\)/g, async (_m, alt, src) => {
    const rel = await copyAsset(decodeURI(src), ctx);
    return rel ? `![${alt}](${rel})` : '';
  });

  // ==highlight==
  body = body.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

  // > [!type] title
  body = body.replace(/^>\s*\[!(\w+)\][-+]?\s*(.*)$/gm, (_, type, title) => `> **${title || type}**\n>`);

  return body.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
}

function wikiLink(target, alias, { doc, linkTable }) {
  const [name, heading] = target.trim().split('#');
  const label = (alias ?? (heading && !name ? heading : name)).trim();
  if (!name) return label; // 同一ノート内の見出しリンク
  const url = linkTable.get(name.toLowerCase());
  if (!url) {
    warnings.push(`${doc.name}: [[${name}]] は非公開のためリンクを外しました`);
    return label;
  }
  return `[${label}](${url}${heading ? `#${slugify(heading)}` : ''})`;
}

async function copyAsset(target, { doc, assetIndex, copied }) {
  const file = assetIndex.get(path.basename(target).toLowerCase());
  if (!file) {
    warnings.push(`${doc.name}: 画像 ${target} が Vault 内に見つかりません`);
    return null;
  }
  const name = path.basename(file);
  await cp(file, path.join(OUT, 'assets', name));
  copied.add(name);
  return `../assets/${encodeURI(name)}`;
}

function extractPublicSection(body) {
  const m = PUBLIC_HEADING.exec(body);
  if (!m) return '';
  const rest = body.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  const section = (next === -1 ? rest : rest.slice(0, next))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/%%[\s\S]*?%%/g, '');
  return section.trim();
}

/* ------------------------------------------------------------------ */

function splitFrontmatter(raw, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  try {
    return { data: normalize(parseYaml(m[1]) ?? {}), body: raw.slice(m[0].length) };
  } catch (e) {
    warnings.push(`${path.relative(VAULT, file)}: frontmatter を読めません (${e.message})`);
    return { data: {}, body: raw.slice(m[0].length) };
  }
}

/**
 * Obsidian のプロパティ編集で崩れた値を単一値に戻す。
 *   stage: [seedling]           → 'seedling'
 *   created: { "{ date }": null } → undefined（未展開のテンプレート）
 *   title: ""                    → undefined
 */
const LIST_KEYS = new Set(['topics', 'tags', 'aliases']);
function normalize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (LIST_KEYS.has(k)) {
      out[k] = v;
      continue;
    }
    let value = Array.isArray(v) ? v[0] : v;
    if (value && typeof value === 'object' && !(value instanceof Date)) value = undefined;
    if (typeof value === 'string' && (value.trim() === '' || value.includes('{{'))) value = undefined;
    if (value !== undefined && value !== null) out[k] = value;
  }
  return out;
}

async function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await listMarkdown(p)));
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Vault 全体の画像をファイル名で引けるようにする（Obsidian と同じ解決方法） */
async function indexVaultAssets() {
  const index = new Map();
  const walk = async (dir) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (IMAGE_EXT.test(ent.name)) index.set(ent.name.toLowerCase(), p);
    }
  };
  await walk(VAULT);
  return index;
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[?#%/\\:*"<>|'`.,()[\]{}!&+=;@$^~]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isoWeekMonday(week) {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const [y, w] = [Number(m[1]), Number(m[2])];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return monday;
}

function dateOnly(d) {
  const date = d instanceof Date ? d : new Date(String(d));
  if (isNaN(+date)) return undefined;
  // ローカル(JST)の日付で書き出す
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]);
const unique = (a) => [...new Set(a)];

async function replaceAsync(str, re, fn) {
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(re)) {
    parts.push(str.slice(last, m.index), await fn(...m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts.join('');
}

function readEnvFile() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(l))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  );
}
