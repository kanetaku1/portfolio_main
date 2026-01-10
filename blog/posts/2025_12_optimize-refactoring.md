---
title: Jobsta パフォーマンス最適化とプロジェクト構造リファクタリング
date: 2025/12
category: dev
thumbnail: ../img/IMG_0987_Original.JPG
description: localStorageからSupabaseへの移行、DBアクセス最適化、プロジェクト構造の整理を通じて、パフォーマンスと保守性を大幅に向上させた開発記録
---

# Jobsta パフォーマンス最適化とプロジェクト構造リファクタリング

## プロジェクト概要

**Jobsta（ジョブスタ）**は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。今回の開発では、localStorage から Supabase への完全移行、データベースアクセスの最適化、プロジェクト構造のリファクタリングを実施し、パフォーマンスと保守性を大幅に向上させました。

## 技術スタック

- **フレームワーク**: Next.js 15.4.5 (App Router)
- **言語**: TypeScript v5
- **データベース**: PostgreSQL (Supabase) + Prisma v6.13.0
- **認証**: Supabase Auth (LINE Login 対応)
- **UI**: TailwindCSS v3.4.17, Shadcn/ui
- **その他**: React 19.1.0, Vercel

## 開発過程

### フェーズ 1: データベース移行と localStorage 削除

最初のタスクは、localStorage から Supabase への完全移行でした。これにより、複数ユーザーでの利用が可能になり、LINE ログイン経由でのアクセスが実現しました。

**実装内容:**

- Server Actions の実装（friends, groups, applications, notifications）
- Prisma スキーマの拡張（Friend モデル追加、Group モデルに jobId 追加）
- 認証ヘルパー関数の作成（getCurrentUser, requireAuth）
- localStorage.ts ファイルの完全削除

```typescript
// 例: Server Actionの実装
"use server";

import { requireAuth } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma/client";
import { unstable_cache } from "next/cache";

export async function getFriends(): Promise<Friend[]> {
  const user = await requireAuth();
  const cacheKey = `friends:${user.id}`;

  return await unstable_cache(
    async () => {
      const friends = await prisma.friend.findMany({
        where: { userId: user.id },
        include: {
          friend: {
            select: { id: true, name: true, email: true, displayName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return friends.map((f) => ({
        id: f.friendUserId || f.id,
        name: f.friend?.displayName || f.friend?.name || f.name,
        email: f.friend?.email || f.email || undefined,
      }));
    },
    [cacheKey],
    { revalidate: 30, tags: ["friends", cacheKey] }
  )();
}
```

### フェーズ 2: パフォーマンス最適化

移行後、データベースアクセスが頻繁になり、パフォーマンスの問題が発生しました。これを解決するため、多層的なキャッシュ戦略を実装しました。

**実装内容:**

1. **サーバー側キャッシュ**

   - Next.js の`unstable_cache`を使用
   - データ種別ごとに適切な TTL を設定（友達・グループ・応募: 30 秒、通知: 10 秒、ユーザー: 60 秒）
   - データ更新時に`revalidateTag`でキャッシュを無効化

2. **クライアント側キャッシュ**

   - メモリベースのキャッシュ（Map 使用）
   - TTL（Time To Live）機能付き
   - 自動クリーンアップ機能

3. **N+1 問題の解決**

   - `getJobsByIds()`: 複数の求人を一括取得
   - `getGroupsByIds()`: 複数のグループを一括取得
   - 応募一覧ページで 20 回の fetch を 2 回に削減（約 90%削減）

4. **自動リフレッシュ間隔の最適化**
   - 通知の自動リフレッシュ: 2 秒 → 30 秒
   - 不要な自動リフレッシュの削除

```typescript
// クライアント側キャッシュの実装例
class ClientCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
}
```

**パフォーマンス改善結果:**

- データベースアクセス回数: 約 90%削減
- 画面遷移速度: キャッシュヒット時は即時表示
- サーバー負荷: 大幅軽減

### フェーズ 3: プロジェクト構造のリファクタリング

プロジェクトが成長するにつれ、ファイル数が増加し、構造の整理が必要になりました。

**実装内容:**

1. **コンポーネントの機能別整理**

   ```
   components/
   ├── applications/    # IndividualApplicationForm, ApplicationToggle
   ├── common/         # Header, Providers
   ├── friends/         # FriendList
   ├── groups/         # GroupCreateModal, GroupInviteLinkModal, GroupMemberList
   ├── jobs/           # JobCard, JobInfo
   ├── notifications/  # NotificationDropdown, NotificationIcon, NotificationsList
   └── ui/             # Shadcn/uiコンポーネント
   ```

2. **utils ディレクトリの統合**

   - `src/utils/` → `src/lib/utils/` に統合
   - `getData.ts`, `group.ts`, `notifications.ts`を移動
   - `lib/utils.ts` → `lib/utils/cn.ts`に分割

3. **インポートパスの統一**
   - すべてのインポートパスを新しい構造に更新
   - 型安全性の向上

### フェーズ 4: ビルドエラーの修正

ビルド時に Prisma Client の生成エラーと型エラーが発生しました。

**解決内容:**

- Prisma Client 生成時の EPERM エラー: Node プロセス停止後に再生成
- `package.json`の`packageManager`フィールド削除（pnpm 参照の削除）
- 型エラーの修正（`friends/invite/page.tsx`の`id`フィールド削除）

## 学んだこと

### 1. 多層キャッシュ戦略の重要性

- サーバー側とクライアント側の両方でキャッシュを実装することで、パフォーマンスを大幅に向上できる
- データの更新頻度に応じて TTL を調整することが重要
- キャッシュの無効化タイミングを適切に設計することで、データの一貫性を保ちながらパフォーマンスを向上できる

### 2. N+1 問題の早期発見と解決

- ログを確認することで、N+1 問題を早期に発見できる
- 一括取得関数を実装することで、fetch 回数を大幅に削減できる
- データ取得パターンを分析し、最適な取得方法を選択することが重要

### 3. プロジェクト構造の重要性

- 機能別にコンポーネントを整理することで、保守性が向上する
- 統一されたディレクトリ構造により、新規開発者のオンボーディングが容易になる
- リファクタリングは継続的に行うことで、技術的負債を防げる

### 4. Prisma Client の扱い

- Windows 環境での Prisma Client 生成時の EPERM エラーは、プロセス停止後に再生成することで解決できる
- 型キャストを避け、正しい型を使用することで、型安全性が向上する

### 5. パフォーマンス最適化の段階的アプローチ

- まず問題を特定（ログ分析）
- 次に最適化戦略を立案（キャッシュ、一括取得、間隔調整）
- 最後に実装と検証を繰り返す

## 今後の予定

### 短期

- [ ] React Query や SWR の導入検討（より高度なキャッシュ管理）
- [ ] 楽観的更新（Optimistic Updates）の実装
- [ ] 無限スクロールやページネーションの導入（大量データ対応）

### 中期

- [ ] 求人情報入力ページの実装（Google Forms の代替）
- [ ] リアルタイム通知機能の強化（Supabase Realtime）
- [ ] パフォーマンスモニタリングの導入

### 長期

- [ ] モバイルアプリの開発検討
- [ ] AI を活用した求人マッチング機能
- [ ] コミュニティ機能の拡充

## まとめ

今回の開発を通じて、データベース移行、パフォーマンス最適化、プロジェクト構造の整理を実施しました。特に、多層キャッシュ戦略と N+1 問題の解決により、データベースアクセス回数を約 90%削減し、ユーザー体験を大幅に改善できました。また、プロジェクト構造の整理により、保守性と拡張性が向上し、今後の開発がより効率的に行えるようになりました。
