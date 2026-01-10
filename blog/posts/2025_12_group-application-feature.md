---
title: グループ応募機能の実装 - 友達と一緒に応募するシステム

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: グループ作成、友達招待、承認フロー、応募管理などのグループ応募機能を実装した開発日記

---

# グループ応募機能の実装 - 友達と一緒に応募するシステム

## プロジェクト概要

Jobsta（ジョブスタ）は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。グループ応募機能は、ユーザーが友達を招待して一緒にバイトに応募するためのコア機能です。

## 技術スタック

- **フレームワーク**: Next.js 15
- **言語**: TypeScript
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS
- **QRコード生成**: qrcode.react
- **データストレージ**: localStorage（MVP段階）

## 開発過程

### フェーズ1: グループ応募の要件定義

#### 機能要件

- グループの作成（応募時に統合）
- 友達の招待（既存友達 or 新規友達）
- 招待リンクの生成と共有
- 友達の承認・拒否
- 応募状況の管理
- 全員承認後の応募送信

#### データモデルの設計

```typescript
// src/types/application.ts
export type Group = {
  id: string
  jobId: string
  ownerName: string
  ownerUserId: string
  members: GroupMember[]
  requiredCount: number
  createdAt: string
  updatedAt: string
}

export type GroupMember = {
  id: string
  name: string
  inviteLink: string
  status: GroupMemberStatus
}

export type GroupMemberStatus = 'pending' | 'approved' | 'rejected'

export type ApplicationGroup = {
  id: string
  jobId: string
  applicantUserId: string
  friendUserIds: string[]
  groupId?: string
  status: ApplicationGroupStatus
  createdAt: string
  updatedAt: string
}
```

### フェーズ2: グループ作成モーダルの実装

#### GroupCreateModalコンポーネント

```typescript
// src/components/GroupCreateModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { 
  createGroup,
  generateInviteLink,
  getFriends,
  getCurrentUserId,
  getCurrentUserFromAuth0
} from '@/lib/localStorage'
import type { Group, Friend } from '@/types/application'

type GroupCreateModalProps = {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (group: Group) => void
  jobId: string
}

export function GroupCreateModal({ 
  isOpen, 
  onClose, 
  onGroupCreated, 
  jobId 
}: GroupCreateModalProps) {
  const [ownerName, setOwnerName] = useState('')
  const [requiredCount, setRequiredCount] = useState<number>(1)
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [newMembers, setNewMembers] = useState<Array<{ name: string }>>([
    { name: '' }
  ])
  const [friends, setFriends] = useState<Friend[]>([])

  useEffect(() => {
    if (isOpen) {
      // Auth0からユーザー情報を取得
      const user = getCurrentUserFromAuth0()
      if (user) {
        setOwnerName(user.displayName || user.name || '')
      }
      
      // 友達リストを読み込む
      const friendsList = getFriends()
      setFriends(friendsList)
    }
  }, [isOpen])

  const handleCreateGroup = () => {
    if (!ownerName.trim()) {
      alert('あなたの名前を入力してください')
      return
    }

    const userId = getCurrentUserId()
    const members = activeTab === 'existing'
      ? selectedFriendIds.map(friendId => {
          const friend = friends.find(f => f.id === friendId)
          return { name: friend?.name || '' }
        })
      : newMembers.filter(m => m.name.trim())

    if (members.length === 0) {
      alert('少なくとも1人のメンバーを追加してください')
      return
    }

    const group = createGroup(
      jobId,
      ownerName,
      userId,
      members,
      requiredCount
    )

    onGroupCreated(group)
    onClose()
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* モーダルコンテンツ */}
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">グループを作成</h2>
            
            {/* オーナー名入力 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                あなたの名前
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* タブ切り替え */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('existing')}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === 'existing'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200'
                }`}
              >
                既存の友達から選択
              </button>
              <button
                onClick={() => setActiveTab('new')}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === 'new'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200'
                }`}
              >
                新しい友達を追加
              </button>
            </div>

            {/* メンバー選択・追加 */}
            {activeTab === 'existing' ? (
              <div className="space-y-2 mb-4">
                {friends.map(friend => (
                  <label key={friend.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedFriendIds.includes(friend.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFriendIds([...selectedFriendIds, friend.id])
                        } else {
                          setSelectedFriendIds(
                            selectedFriendIds.filter(id => id !== friend.id)
                          )
                        }
                      }}
                      className="mr-2"
                    />
                    <span>{friend.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {newMembers.map((member, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder="友達の名前"
                    value={member.name}
                    onChange={(e) => {
                      const updated = [...newMembers]
                      updated[index].name = e.target.value
                      setNewMembers(updated)
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ))}
                <button
                  onClick={() => setNewMembers([...newMembers, { name: '' }])}
                  className="text-blue-600 text-sm"
                >
                  + 友達を追加
                </button>
              </div>
            )}

            {/* 希望者数 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                希望者数
              </label>
              <input
                type="number"
                min="1"
                value={requiredCount}
                onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-4">
              <button
                onClick={handleCreateGroup}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                グループを作成
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### フェーズ3: 招待リンク機能の実装

#### 招待リンクの生成

```typescript
// src/lib/localStorage.ts
export function generateInviteLink(
  groupId: string, 
  memberId: string
): string {
  if (typeof window === 'undefined') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/invite/${groupId}/${memberId}`
  }
  return `${window.location.origin}/invite/${groupId}/${memberId}`
}
```

#### 招待ページの実装

```typescript
// src/app/invite/[groupId]/[memberId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  getGroupAndMemberFromInvite,
  updateGroupMemberStatus,
  getCurrentUserId
} from '@/lib/localStorage'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.groupId as string
  const memberId = params.memberId as string
  const [group, setGroup] = useState<any>(null)
  const [member, setMember] = useState<any>(null)

  useEffect(() => {
    const { group: g, member: m } = getGroupAndMemberFromInvite(
      groupId,
      memberId
    )
    setGroup(g)
    setMember(m)
  }, [groupId, memberId])

  const handleApprove = () => {
    updateGroupMemberStatus(groupId, memberId, 'approved')
    router.push('/applications')
  }

  const handleReject = () => {
    updateGroupMemberStatus(groupId, memberId, 'rejected')
    router.push('/')
  }

  if (!group || !member) {
    return <div>読み込み中...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">グループ招待</h1>
        <p className="text-gray-600 mb-6">
          {group.ownerName}さんからグループ招待が届きました。
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleApprove}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            承認する
          </button>
          <button
            onClick={handleReject}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
          >
            辞退する
          </button>
        </div>
      </div>
    </div>
  )
}
```

### フェーズ4: 応募フォームの実装

#### 応募画面の実装

```typescript
// src/app/jobs/[id]/apply/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GroupCreateModal } from '@/components/GroupCreateModal'
import { 
  getUserGroups,
  getCurrentUserId,
  createApplicationGroup
} from '@/lib/localStorage'
import type { Group } from '@/types/application'

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const userId = getCurrentUserId()
    const userGroups = getUserGroups(userId)
    setGroups(userGroups.filter(g => g.jobId === jobId))
    
    // グループがない場合は自動でモーダルを開く
    if (userGroups.length === 0) {
      setIsModalOpen(true)
    }
  }, [jobId])

  const handleGroupCreated = (group: Group) => {
    setGroups([...groups, group])
    setSelectedGroupId(group.id)
    setIsModalOpen(false)
  }

  const handleSubmit = () => {
    if (!selectedGroupId) {
      alert('グループを選択してください')
      return
    }

    const userId = getCurrentUserId()
    const selectedGroup = groups.find(g => g.id === selectedGroupId)
    
    if (selectedGroup) {
      // 承認済みメンバーのIDを取得
      const approvedMemberIds = selectedGroup.members
        .filter(m => m.status === 'approved')
        .map(m => m.id)

      createApplicationGroup(
        jobId,
        userId,
        approvedMemberIds,
        '求人タイトル', // 実際には求人情報から取得
        selectedGroupId
      )

      router.push('/applications')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">応募する</h1>

        {/* グループ選択 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">グループを選択</h2>
          
          {groups.length === 0 ? (
            <p className="text-gray-500 mb-4">グループがありません</p>
          ) : (
            <div className="space-y-2 mb-4">
              {groups.map(group => (
                <label key={group.id} className="flex items-center">
                  <input
                    type="radio"
                    name="group"
                    value={group.id}
                    checked={selectedGroupId === group.id}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="mr-2"
                  />
                  <span>{group.ownerName}のグループ</span>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            新しくグループを作成
          </button>
        </div>

        {/* 応募ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!selectedGroupId}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          応募する
        </button>
      </div>

      <GroupCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={handleGroupCreated}
        jobId={jobId}
      />
    </div>
  )
}
```

## 学んだこと

- **複雑なフローの設計**: グループ作成、招待、承認、応募という複雑なフローを適切に設計する重要性
- **状態管理の重要性**: モーダルやフォームの状態を適切に管理することで、ユーザー体験が向上する
- **招待リンクの設計**: グループIDとメンバーIDを含む招待リンクにより、柔軟な招待システムを実装できる
- **UXの最適化**: グループがない場合に自動でモーダルを開くなど、ユーザーが迷わない設計が重要

## 今後の予定

- データベースへの移行（localStorageからSupabaseへ）
- リアルタイム更新機能（WebSocket）
- 通知機能の拡充
- 応募状況の詳細表示
- グループチャット機能の実装

