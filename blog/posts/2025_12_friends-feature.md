---
title: 友達機能の実装 - 招待リンクとQRコードを使った友達追加システム

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: 友達リスト管理、招待リンク生成、QRコード表示などの友達機能を実装した開発日記

---

# 友達機能の実装 - 招待リンクとQRコードを使った友達追加システム

## プロジェクト概要

Jobsta（ジョブスタ）は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。友達機能は、ユーザーが友達を追加し、一緒にバイトに応募するための基盤となる重要な機能です。

## 技術スタック

- **フレームワーク**: Next.js 15
- **言語**: TypeScript
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS
- **QRコード生成**: qrcode.react
- **データストレージ**: localStorage（MVP段階）

## 開発過程

### フェーズ1: 友達機能の要件定義

#### 機能要件

- 友達リストの表示・管理
- 友達追加（招待リンク方式）
- 招待リンクの生成と共有
- QRコードによる招待リンクの共有
- 友達の編集・削除

#### データモデルの設計

```typescript
// src/types/application.ts
export type Friend = {
  id: string
  name: string
  email?: string
}
```

シンプルな構造で、友達のID、名前、メールアドレス（オプション）を管理します。

### フェーズ2: localStorage管理機能の実装

#### 友達管理関数の実装

```typescript
// src/lib/localStorage.ts
const STORAGE_KEYS = {
  FRIENDS: 'jobsta_friends',
  // ...
} as const

export function getFriends(): Friend[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.FRIENDS)
  return data ? JSON.parse(data) : []
}

export function saveFriends(friends: Friend[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends))
}

export function addFriend(friend: Friend): void {
  const friends = getFriends()
  if (!friends.find(f => f.id === friend.id)) {
    friends.push(friend)
    saveFriends(friends)
  }
}

export function removeFriend(friendId: string): void {
  const friends = getFriends()
  saveFriends(friends.filter(f => f.id !== friendId))
}
```

基本的なCRUD操作を実装しました。

### フェーズ3: 招待リンク生成機能の実装

#### 招待リンクの生成

```typescript
// src/lib/localStorage.ts
export function generateFriendInviteLink(userId: string): string {
  if (typeof window === 'undefined') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/friends/invite?from=${userId}`
  }
  return `${window.location.origin}/friends/invite?from=${userId}`
}
```

ユーザーIDをクエリパラメータに含めた招待リンクを生成します。

#### 招待ページの実装

```typescript
// src/app/friends/invite/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUserId, addFriend } from '@/lib/localStorage'

export default function FriendInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromUserId = searchParams.get('from')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAccept = async () => {
    if (!fromUserId) return

    setIsProcessing(true)
    
    // 招待を承認して友達を追加
    const currentUserId = getCurrentUserId()
    if (currentUserId && fromUserId !== currentUserId) {
      // 友達を追加（実際の実装では、fromUserIdからユーザー情報を取得）
      addFriend({
        id: fromUserId,
        name: '友達', // 実際にはユーザー情報から取得
        email: undefined,
      })
      
      router.push('/friends')
    }
    
    setIsProcessing(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">友達招待</h1>
        <p className="text-gray-600 mb-6">
          友達から招待されました。承認しますか？
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            承認する
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
```

### フェーズ4: 友達リストページの実装

#### 友達リストの表示

```typescript
// src/app/friends/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { getFriends, removeFriend, generateFriendInviteLink, getCurrentUserId } from '@/lib/localStorage'
import { QRCodeSVG } from 'qrcode.react'
import type { Friend } from '@/types/application'

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [showQRCode, setShowQRCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    loadFriends()
  }, [])

  const loadFriends = () => {
    const friendsList = getFriends()
    setFriends(friendsList)
  }

  const handleCopyLink = () => {
    const userId = getCurrentUserId()
    const inviteLink = generateFriendInviteLink(userId)
    navigator.clipboard.writeText(inviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleRemoveFriend = (friendId: string) => {
    if (confirm('この友達を削除しますか？')) {
      removeFriend(friendId)
      loadFriends()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">友達リスト</h1>

        {/* 招待リンクセクション */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">友達を招待</h2>
          <div className="flex gap-4 items-center">
            <button
              onClick={handleCopyLink}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {copiedLink ? 'コピーしました！' : '招待リンクをコピー'}
            </button>
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              QRコードを表示
            </button>
          </div>
          
          {showQRCode && (
            <div className="mt-4 flex justify-center">
              <QRCodeSVG
                value={generateFriendInviteLink(getCurrentUserId())}
                size={200}
              />
            </div>
          )}
        </div>

        {/* 友達リスト */}
        <div className="bg-white rounded-lg shadow">
          {friends.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              友達がいません。招待リンクを共有して友達を追加しましょう。
            </div>
          ) : (
            <ul className="divide-y">
              {friends.map((friend) => (
                <li key={friend.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    {friend.email && (
                      <p className="text-sm text-gray-500">{friend.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

### フェーズ5: QRコード生成機能の実装

#### qrcode.reactの導入

```bash
npm install qrcode.react
```

#### QRコードコンポーネントの使用

```typescript
import { QRCodeSVG } from 'qrcode.react'

<QRCodeSVG
  value={generateFriendInviteLink(getCurrentUserId())}
  size={200}
/>
```

招待リンクをQRコードとして表示し、スマートフォンで簡単にスキャンできるようにしました。

### フェーズ6: UI/UXの改善

#### トースト通知の実装

友達追加や削除時に、ユーザーにフィードバックを提供するため、トースト通知を実装しました。

```typescript
import { useToast } from '@/components/ui/use-toast'

const { toast } = useToast()

toast({
  title: '友達を追加しました',
  description: `${friend.name}さんを友達リストに追加しました。`,
})
```

## 学んだこと

- **localStorageの活用**: MVP段階では、localStorageを使用することで迅速にプロトタイプを構築できる
- **QRコードの実装**: qrcode.reactを使用することで、簡単にQRコードを生成・表示できる
- **招待リンクの設計**: ユーザーIDをクエリパラメータに含めることで、シンプルな招待システムを実装できる
- **UXの重要性**: コピーボタンやQRコード表示など、ユーザーが簡単に使える機能を追加することで、使いやすさが向上する

## 今後の予定

- データベースへの移行（localStorageからSupabaseへ）
- 友達検索機能の実装
- 友達のプロフィール表示機能
- 友達とのメッセージング機能
- 友達の活動履歴表示機能

