---
title: ESM と CommonJS の違い
description: JavaScript の2つのモジュール方式。import/export と require の違いを整理したメモ。
topics:
  - JavaScript
  - Node.js
stage: budding
created: 2026-10-04
updated: 2026-10-12
---

どちらも、ソースコードを整理・分割して、別ファイルで定義した変数や関数を使えるようにする仕組み。

## ESM（ES Modules）

- ES6（ES2015）で導入された、JavaScript 標準のモジュール方式
- `import` / `export` を使う
- ブラウザでも Node.js でも動く
- モジュールを非同期に読み込む
- 静的解析ができる（どれを使うかを実行前に判断できる）

```js
// math.js
export const add = (a, b) => a + b;

// main.js
import { add } from './math.js';
```

## CommonJS

- `require` / `module.exports` を使う
- Node.js で長く使われてきた標準の仕様
- モジュールを同期的に読み込む
- `require` は実行時に評価されるので、静的解析には向かない

```js
// math.js
module.exports = { add: (a, b) => a + b };

// main.js
const { add } = require('./math.js');
```

## 比べると

|      | ESM                 | CommonJS                     |
| ---- | ------------------- | ---------------------------- |
| 書き方  | `import` / `export` | `require` / `module.exports` |
| 読み込み | 非同期                 | 同期                           |
| 静的解析 | できる                 | 向かない                         |
| 主な環境 | ブラウザ・Node.js        | Node.js                      |

## 補足
### 静的解析できることのメリット

ESM（ECMAScript Modules）は `import` / `export` の構文が固定されているため、ツールが実行前にモジュール間の依存関係を把握できます。これにより、実際に使われていないコードをビルド時に削除する **Tree Shaking** が可能になります。

例えばライブラリから複数の関数を読み込んでいても、実際に使用しているものだけを最終的なバンドルへ含められるため、ファイルサイズの削減やパフォーマンス向上につながります。また、依存関係を事前に解析できることで、コード分割やIDEの補完・リファクタリングなども行いやすくなります。

### ESMとCommonJSを混在させる際の注意点

既存のNode.jsプロジェクトでは、ESMとCommonJSが混在するケースがあります。ただし両者には互換性の違いがあり、特に注意が必要です。

ESMからCommonJSを読み込むことは比較的容易ですが、CommonJSからESMを読み込む場合は `require()` が使えず、動的 `import()` が必要になります。また、ESMでは `__dirname` や `__filename` が利用できない、`require()` が使えないなど、CommonJSとは異なる仕様もあります。

そのため新規開発ではESMへの統一を基本としつつ、既存ライブラリとの互換性を考慮して段階的に移行するのが一般的です。
