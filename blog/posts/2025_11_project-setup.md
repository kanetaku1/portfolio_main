---
title: Jobstaプロジェクトの立ち上げ - Next.js 15とTypeScriptで始めるソーシャルバイトアプリ

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: 友達と一緒に応募できるソーシャル型短期バイトマッチングアプリ「Jobsta」のプロジェクト立ち上げから基盤構築までの開発日記

---

# Jobstaプロジェクトの立ち上げ - Next.js 15とTypeScriptで始めるソーシャルバイトアプリ

## プロジェクト概要

**Jobsta（ジョブスタ）**は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。一人でのバイト応募に不安を感じる学生や、友達と一緒に働きたいというニーズに応えることを目的として開発を開始しました。

### 解決したい課題

- 一人でのバイト応募の不安
- 友達と一緒に働きたいというニーズ
- 短期バイトの情報収集の手間

### 提供する価値

- 友達と一緒にバイトに応募できる
- 信頼できる求人情報の提供
- コミュニティ感のある求職体験

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS
- **データベース**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **認証**: Supabase Auth + Auth0 (Third-Party Auth)
- **テスト**: Vitest
- **UIコンポーネント開発**: Storybook

## 開発過程

### フェーズ1: プロジェクトの初期設定

プロジェクトの立ち上げから、基本的な開発環境の構築までを行いました。

#### Next.js 15プロジェクトの作成

```bash
npx create-next-app@latest jobsta0 --typescript --tailwind --app
```

Next.js 15の最新機能であるApp Routerを使用し、TypeScriptとTailwind CSSを含めたモダンな開発環境を構築しました。

#### プロジェクト構造の設計

```
src/
├── app/              # Next.js App Router
│   ├── page.tsx      # ホームページ
│   ├── jobs/         # 求人関連ページ
│   ├── friends/      # 友達機能ページ
│   ├── applications/  # 応募管理ページ
│   └── notifications/ # 通知ページ
├── components/        # Reactコンポーネント
│   ├── ui/           # 基本UIコンポーネント
│   └── ...           # 機能別コンポーネント
├── lib/              # ライブラリ・ユーティリティ
│   ├── auth/         # 認証関連
│   ├── supabase/     # Supabaseクライアント
│   └── localStorage.ts # ローカルストレージ管理
├── types/            # TypeScript型定義
├── utils/            # ユーティリティ関数
└── hooks/            # カスタムフック
```

#### 基本UIコンポーネントの構築

shadcn/uiをベースに、基本的なUIコンポーネントを作成：

- Button
- Input
- Badge
- Card
- Select
- Label

これらのコンポーネントは、Tailwind CSSとRadix UIを組み合わせて実装し、アクセシビリティとデザインの一貫性を確保しました。

### フェーズ2: データベース設計とPrisma設定

#### Prismaスキーマの設計

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String?  @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Job {
  id           String   @id @default(uuid())
  title        String?
  description  String?
  location     String?
  wageAmount   Int?
  transportFee Int?
  jobDate      DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

初期段階では、ユーザーと求人の基本的なモデルを定義しました。

#### Supabaseとの連携設定

Supabaseをバックエンドとして使用し、認証とデータベース機能を活用する設定を行いました。

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### フェーズ3: ローカルストレージ管理の実装

MVP段階では、クライアント側のlocalStorageを使用してデータを管理する方針としました。

#### localStorage管理ユーティリティの作成

```typescript
// src/lib/localStorage.ts
const STORAGE_KEYS = {
  FRIENDS: 'jobsta_friends',
  JOB_INTERESTS: 'jobsta_job_interests',
  APPLICATION_GROUPS: 'jobsta_application_groups',
  NOTIFICATIONS: 'jobsta_notifications',
  CURRENT_USER_ID: 'jobsta_current_user_id',
  GROUPS: 'jobsta_groups',
} as const

export function getFriends(): Friend[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.FRIENDS)
  return data ? JSON.parse(data) : []
}
```

友達、求人への興味、応募グループ、通知などのデータをlocalStorageで管理する関数を実装しました。

### フェーズ4: 型定義の整備

TypeScriptの型安全性を確保するため、アプリケーション全体で使用する型を定義しました。

```typescript
// src/types/application.ts
export type Friend = {
  id: string
  name: string
  email?: string
}

export type ApplicationGroup = {
  id: string
  jobId: string
  applicantUserId: string
  friendUserIds: string[]
  status: ApplicationGroupStatus
  createdAt: string
  updatedAt: string
}

export type Notification = {
  id: string
  userId: string
  type: NotificationType
  applicationGroupId: string
  jobId: string
  message: string
  read: boolean
  createdAt: string
}
```

## 学んだこと

- **Next.js 15のApp Router**: 最新のApp Routerを使用することで、サーバーコンポーネントとクライアントコンポーネントを適切に使い分けられる
- **TypeScriptの型設計**: アプリケーション全体で使用する型を最初に定義することで、開発効率が向上
- **MVP開発の重要性**: 最初から完璧を目指さず、localStorageを使用したMVPを構築することで、迅速にプロトタイプを完成させられた
- **プロジェクト構造の重要性**: 明確なディレクトリ構造を最初に設計することで、後々の開発がスムーズになる

## 今後の予定

- Supabaseへの完全移行（localStorageからデータベースへ）
- 認証機能の実装（Auth0、LINEログイン）
- 求人機能の実装
- 友達機能の実装
- 応募機能の実装
- 通知機能の実装

