/**
 * 公開前のプライバシーチェック（publish.mjs から呼ばれる）
 *
 *  - error   : .publish-denylist に書いた語が含まれる → 公開を止める
 *  - warning : 金額・メールアドレス・電話番号らしき表記 → 確認を求める
 *
 * .publish-denylist は git 管理外。クライアント名など「書いてあること自体が秘密」の語を1行1語で書く。
 * `#` で始まる行はコメント。
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DENYLIST = path.join(ROOT, '.publish-denylist');

const SUSPICIOUS = [
  {
    label: '金額',
    re: /[¥￥]\s?\d|\d[\d,]*(?:\.\d+)?\s*(?:万|億)?円|\d+(?:\.\d+)?\s*[万億](?!歩|人|回|件|部|点|字|行|年|km|PV)/,
  },
  { label: 'お金に関する語', re: /単価|見積|請求額|報酬|人月/ },
  { label: 'メールアドレス', re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { label: '電話番号', re: /\b0\d{1,4}-\d{1,4}-\d{3,4}\b/ },
];

export function loadDenylist() {
  if (!existsSync(DENYLIST)) return [];
  return readFileSync(DENYLIST, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

/** dir 以下の .md を調べる */
export async function checkPrivacy(dir) {
  const terms = loadDenylist();
  const errors = [];
  const warnings = [];

  for (const file of await listMarkdown(dir)) {
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    let inCode = false;
    lines.forEach((line, i) => {
      if (/^(```|~~~)/.test(line)) inCode = !inCode;
      const where = `${rel}:${i + 1}`;
      for (const term of terms) {
        if (line.toLowerCase().includes(term.toLowerCase())) errors.push({ where, label: `NGワード「${term}」`, line });
      }
      if (inCode) return; // コード例の中の数値やアドレスは警告しない
      for (const { label, re } of SUSPICIOUS) {
        if (re.test(line)) warnings.push({ where, label, line });
      }
    });
  }
  return { errors, warnings, denylistSize: terms.length };
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
