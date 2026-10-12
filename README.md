# Golcha Works

金子拓朗のポートフォリオ兼デジタルガーデン。Astro で作り、Cloudflare Pages で公開しています。

## ふだんの使い方

コンテンツは Obsidian Vault（`D:/Desktop/obsidian_brain`）で書き、公開するときだけこのリポジトリを開きます。

```sh
npm run publish            # 同期 → プライバシーチェック → ビルド → 確認 → push（main ブランチで実行）
npm run publish -- --dry-run   # 確認だけ
```

運用ルールは Vault 内の `00_運用ガイド.md` を参照してください。

## コンテンツの置き場所

| 種類 | 場所 | 編集する場所 |
|---|---|---|
| Notes（知識メモ） | `src/content/vault/notes/` | Vault の `Garden/` |
| Journal（週の記録） | `src/content/vault/journal/` | Vault の `Weekly/` の「## 公開」欄 |
| Now | `src/content/vault/now.md` | Vault 直下の `Now.md` |
| Writing（記事） | `src/content/writing/`・`src/content/vault/writing/` | リポジトリ / Vault の `Writing/` |
| Works（作品） | `src/content/works/` | このリポジトリ |
| About | `src/content/pages/about.md` | このリポジトリ |

`src/content/vault/` は同期のたびに作り直されます。手で編集しないでください。
frontmatter に `draft: true` を付けると、開発サーバーでは表示され、本番ビルドからは除外されます。

## 開発

```sh
npm install
cp .env.example .env   # PUBLIC_WEB3FORMS_KEY（お問い合わせフォーム）を設定
npm run dev            # http://localhost:4321
npm run sync:vault     # Vault から同期だけ行う
```

## 公開まわりの仕組み

| 仕組み | 内容 |
|---|---|
| Cloudflare Pages | `main` への push で自動ビルド・公開。ブランチや PR ごとにプレビューURLが発行される |
| プライバシーチェック | `.publish-denylist`（git 管理外）の語が含まれると公開を止める。金額やメールアドレスは警告 |
| CI | push・PR ごとに型チェックとビルド（`.github/workflows/ci.yml`） |
| Dependabot | 月1回、依存パッケージの更新を1つの PR にまとめる |
| 旧URLの転送 | `npm run legacy:build` で `dist-legacy/` を作り、`gh-pages` ブランチに置く。名刺などに載っている `kanetaku1.github.io/portfolio_main/` を新サイトへ転送する |

### Cloudflare Pages の設定値

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- 環境変数: `PUBLIC_WEB3FORMS_KEY`
- Node のバージョンは `.node-version` で指定
