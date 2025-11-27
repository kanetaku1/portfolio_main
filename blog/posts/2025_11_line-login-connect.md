---
title: LINEログイン機能の実装完了
date: 2025/11
category: dev
thumbnail: ../img/Jobsta-LINE.png
description: Auth0経由のLINEログインをSupabase Third-Party Authと連携させ、ユーザー認証システムを構築しました。
---

# LINE ログイン機能の実装完了

Jobsta アプリケーションに LINE ログイン機能を実装し、Auth0 と Supabase の Third-Party Auth を連携させることで、セキュアな認証システムを構築しました。

## プロジェクト概要

**Jobsta（ジョブスタ）**は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。LINE 公式アカウントや Discord と連携し、LINE ログインによる Web アプリケーションでの運営を目指しています。

### 主な機能

- 友達と一緒にバイトに応募できる
- LINE ログインによる簡単な認証
- グループ機能による求人共有
- 信頼できる求人情報の提供

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **データベース**: PostgreSQL (Supabase)
- **認証**: Supabase Third-Party Auth + Auth0
- **ORM**: Prisma
- **スタイリング**: TailwindCSS
- **その他**: LINE Login API (Auth0 経由)

## 開発過程

### フェーズ 1: 設計と要件定義

#### 認証フローの設計

LINE ログインを実装するにあたり、以下の認証フローを設計しました：

ユーザー
↓
LINE Developers (LINE Login)
↓
Auth0 (LINE Social Connection)
↓
Auth0 ID Token を取得
↓
クッキーに保存 (auth0_id_token)
↓
Supabase Client に accessToken として提供
↓
Supabase Third-Party Auth がトークンを検証
↓
Postgres の authenticated ロールを割り当て
↓
Supabase Data API / Storage / Realtime にアクセス可能

#### 技術的な課題

1. **Supabase の Third-Party Auth 機能の理解**

   - Supabase Auth のユーザーとして登録されるわけではない
   - Auth0 の JWT トークンを直接 Supabase API で使用する
   - `supabase.auth.getUser()`は動作しない

2. **環境変数の管理**
   - クライアント側とサーバー側で異なる環境変数が必要
   - `NEXT_PUBLIC_`プレフィックスの理解
   - `.env`と`.env.local`の違いと優先順位

### フェーズ 2: 実装

#### 1. LINE ログインページの実装

`src/app/login/page.tsx`で、Auth0 の認証 URL を直接構築し、LINE ログインを開始する実装を行いました。
pt
const handleLineLogin = async () => {
const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN
const auth0ClientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
const redirectUri = `${window.location.origin}/auth/callback`

// Auth0 の認証 URL を構築（LINE ログイン用）
const auth0AuthUrl = `https://${auth0Domain}/authorize?` +
`response_type=code&` +
`client_id=${auth0ClientId}&` +
`redirect_uri=${encodeURIComponent(redirectUri)}&` +
`scope=openid profile email&` +
`connection=line` // LINE 接続を指定

window.location.href = auth0AuthUrl
}

#### 2. コールバック処理の実装

`src/app/auth/callback/route.ts`で、Auth0 から取得した認証コードをトークンに交換し、クッキーに保存する処理を実装しました。

// Auth0 からトークンを交換
const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({
grant_type: 'authorization_code',
client_id: auth0ClientId,
client_secret: auth0ClientSecret,
code: code,
redirect_uri: redirectUri,
}),
})

const tokenData = await tokenResponse.json()
const idToken = tokenData.id_token

// クッキーに保存
response.cookies.set('auth0_id_token', idToken, {
httpOnly: false, // クライアントサイドで読み取れるようにする
secure: process.env.NODE_ENV === 'production',
sameSite: 'lax',
maxAge: 60 \* 60, // 1 時間
path: '/',
})

// Prisma の User テーブルに同期
await syncUserFromAuth0(idToken)

#### 3. Supabase クライアントの設定

`src/lib/supabase/client.ts`で、Auth0 の ID トークンを Supabase クライアントに提供する実装を行いました。

export function createClient() {
return createSupabaseClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
// Auth0 の Third-Party Auth を使用する場合、ID トークンを非同期関数として提供
accessToken: async () => {
return getAuth0IdToken() // クッキーから取得
},
}
)
}

#### 4. ユーザー情報の同期

`src/lib/auth/sync-user.ts`で、Auth0 の ID トークンからユーザー情報を取得し、Prisma の User テーブルに同期する処理を実装しました。
pt
export async function syncUserFromAuth0(idToken: string) {
const userInfo = getUserFromAuth0Token(idToken)

// 既存ユーザーを更新、または新規ユーザーを作成
await prisma.user.upsert({
where: { supabaseId: userInfo.id },
update: { ...userData },
create: { ...userData },
})
}#### 5. ミドルウェアの実装

`middleware.ts`で、セッション管理とアクセス制御を実装しました。
pescript
export async function middleware(request: NextRequest) {
return await updateSession(request)
}### フェーズ 3: エラーハンドリングと UI 改善

#### エラーページの作成

認証エラー時にユーザーフレンドリーなエラーメッセージを表示するため、`src/app/auth/auth-code-error/page.tsx`を作成しました。

#### 環境変数の検証

サーバー側の環境変数（`AUTH0_DOMAIN`、`AUTH0_CLIENT_ID`、`AUTH0_CLIENT_SECRET`）が設定されていない場合に、適切なエラーメッセージを表示するようにしました。

### フェーズ 4: 設定とドキュメント整備

#### 設定ガイドの作成

以下のドキュメントを作成し、設定手順を明確化しました：

- `docs/AUTH_SETUP_GUIDE.md`: 認証設定の詳細ガイド
- `docs/THIRD_PARTY_AUTH_FLOW.md`: Third-Party Auth の仕組みとフロー
- `docs/ENV_VARIABLES.md`: 環境変数の説明
- `docs/CALLBACK_URL_SETUP.md`: コールバック URL の設定方法

## 学んだこと

### 1. Supabase Third-Party Auth の仕組み

- **Third-Party Auth とは**: Supabase Auth のユーザーとして登録されるのではなく、外部の JWT トークンを直接 Supabase API で使用する機能
- **トークンの検証**: Supabase が Auth0 の公開鍵を使用してトークンを検証し、`role: 'authenticated'` claim を確認
- **ロールの割り当て**: Postgres の`authenticated`ロールを割り当て、RLS ポリシーに基づいてデータにアクセス可能

### 2. 環境変数の管理

- **`.env`と`.env.local`の違い**: `.env.local`が優先され、Git 管理から除外される
- **`NEXT_PUBLIC_`プレフィックス**: クライアント側に公開されるため、機密情報を含めない
- **サーバー側の環境変数**: `NEXT_PUBLIC_`なしの変数はサーバー側でのみ使用可能

### 3. OAuth 2.0 フローの理解

- **認証コードフロー**: 認証コードを取得し、サーバー側でトークンに交換する方式
- **コールバック URL**: Auth0 と Supabase の両方で正しく設定する必要がある
- **トークンの保存**: クッキーに保存し、クライアント側で Supabase クライアントが使用できるようにする

### 4. JWT トークンの扱い

- **ID トークンのデコード**: クライアント側で JWT をデコードしてユーザー情報を取得
- **トークンの有効期限**: 1 時間に設定し、必要に応じてリフレッシュ
- **セキュリティ**: `httpOnly: false`でクライアント側から読み取れるようにする（Third-Party Auth の要件）

### 5. エラーハンドリングの重要性

- **適切なエラーメッセージ**: ユーザーに分かりやすいエラーメッセージを表示
- **ログの記録**: サーバー側でエラーをログに記録し、デバッグを容易にする
- **フォールバック処理**: エラーが発生してもアプリケーションがクラッシュしないようにする

## 今後の予定

### 短期（1-2 ヶ月）

1. **セッション管理の改善**

   - トークンのリフレッシュ機能の実装
   - ログアウト機能の実装
   - セッションタイムアウトの処理

2. **ユーザープロフィール機能**

   - プロフィール編集機能
   - アバター画像のアップロード
   - プロフィール公開設定

3. **友達機能の実装**
   - LINE 友達の取得
   - 友達一覧の表示
   - 友達への招待機能

### 中期（3-6 ヶ月）

1. **グループ機能の拡張**

   - グループ内での求人共有
   - グループでの応募管理
   - グループチャット機能

2. **通知機能**

   - LINE 通知の実装
   - アプリ内通知
   - メール通知

3. **求人機能の拡張**
   - 求人検索・フィルタリング
   - お気に入り機能
   - 応募履歴の管理

### 長期（6 ヶ月以上）

1. **モバイルアプリの開発**

   - React Native での実装
   - LINE SDK の統合
   - プッシュ通知

2. **パフォーマンス最適化**

   - データベースクエリの最適化
   - キャッシュ戦略の実装
   - CDN の活用

3. **セキュリティ強化**
   - セキュリティ監査
   - 脆弱性スキャン
   - ペネトレーションテスト

---

この実装を通じて、OAuth 2.0 フロー、Supabase Third-Party Auth、JWT トークンの扱いなど、認証システムの基礎を深く理解することができました。今後は、これらの知識を活かして、より高度な機能を実装していきます。
