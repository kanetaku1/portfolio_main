---
title: Jobsta
summary: 友達と一緒に応募できる、ソーシャル型の短期バイトマッチングアプリ。LINE ログインと友達・グループ応募の仕組みを中心に開発。
period: 2025.11 – 2025.12
status: wip
stack: [Next.js, TypeScript, Supabase, Prisma, Auth0, Tailwind CSS]
links:
  github: https://github.com/kanetaku1/jobsta0
cover: ../../assets/works/jobsta-line.png
featured: true
order: 2
topics: [Jobsta, 認証, パフォーマンス]
---

## 背景

短期バイトは「ひとりで知らない現場に行くのが不安」という理由で敬遠されがちです。**友達と一緒なら応募できる**という人のために、友達とグループを組んで応募できるマッチングアプリを作りました。

## 作ったもの

- **LINE ログイン** — Auth0 経由の LINE ログインを Supabase の Third-Party Auth と連携
- **友達機能** — 招待リンクと QR コードで友達を追加
- **グループ応募** — グループを作って友達を招待し、承認を経て一緒に応募
- **求人一覧・詳細**、興味ありの管理
- **通知** — 通知ドロップダウン・一覧・既読管理

## 技術的な判断

- **認証は自前で持たない。** LINE ログインは Auth0 に任せ、Supabase の Third-Party Auth で受け取る構成にしました。利用者が普段使っている LINE から、手間なく始められることを優先しています。
- **まず localStorage で動かし、あとから DB に移す。** MVP では localStorage で画面と体験を固め、その後 Supabase（PostgreSQL + Prisma）に移行しました。

## 学び

DB に移したあと、ログを見ると同じデータを何度も取りにいく **N+1 問題** が起きていました。一括取得の関数をつくり、サーバー側とクライアント側の二層でキャッシュを持たせた結果、**DB へのアクセス回数を約 90% 減らせました**。

最適化は「勘で直す」のではなく、ログで問題を特定 → 戦略を立てる → 実装と計測を繰り返す、という順番で進めるのが大事だと実感しました。
