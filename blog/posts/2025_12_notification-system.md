---
title: 通知システムの実装 - リアルタイム通知と既読管理

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: 通知機能、通知ドロップダウン、通知一覧、既読管理などの通知システムを実装した開発日記

---

# 通知システムの実装 - リアルタイム通知と既読管理

## プロジェクト概要

Jobsta（ジョブスタ）は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。通知システムは、ユーザーが友達からの応募招待や承認・拒否の通知を受け取るための重要な機能です。

## 技術スタック

- **フレームワーク**: Next.js 15
- **言語**: TypeScript
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS
- **アイコン**: lucide-react
- **データストレージ**: localStorage（MVP段階）

## 開発過程

### フェーズ1: 通知システムの要件定義

#### 機能要件

- 応募招待通知の送信・受信
- 承認・拒否通知の送信・受信
- 通知一覧の表示
- 通知ドロップダウンの表示
- 未読通知数の表示
- 通知の既読管理
- 通知からの遷移（応募詳細、求人詳細）

#### データモデルの設計

```typescript
// src/types/application.ts
export type NotificationType = 
  | 'application_invitation' 
  | 'application_approved' 
  | 'application_rejected'

export type Notification = {
  id: string
  userId: string
  type: NotificationType
  applicationGroupId: string
  jobId: string
  jobTitle?: string
  fromUserName: string
  message: string
  read: boolean
  createdAt: string
}
```

### フェーズ2: 通知管理機能の実装

#### localStorage管理関数

```typescript
// src/lib/localStorage.ts
export function getNotifications(userId: string): Notification[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
  const allNotifications: Notification[] = data ? JSON.parse(data) : []
  return allNotifications
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function createNotification(
  notification: Omit<Notification, 'id' | 'read' | 'createdAt'>
): Notification {
  const notifications = getAllNotifications()
  const newNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString(),
  }
  
  notifications.push(newNotification)
  saveNotifications(notifications)
  
  return newNotification
}

export function markNotificationAsRead(notificationId: string): void {
  const notifications = getAllNotifications()
  const notificationIndex = notifications.findIndex(n => n.id === notificationId)
  
  if (notificationIndex >= 0) {
    notifications[notificationIndex] = {
      ...notifications[notificationIndex],
      read: true,
    }
    saveNotifications(notifications)
  }
}

export function getUnreadNotificationCount(userId: string): number {
  const notifications = getNotifications(userId)
  return notifications.filter(n => !n.read).length
}
```

### フェーズ3: 通知ドロップダウンの実装

#### NotificationDropdownコンポーネント

```typescript
// src/components/NotificationDropdown.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { NotificationIcon } from '@/components/NotificationIcon'
import { useNotifications } from '@/hooks/useNotifications'
import { getNotificationRoute } from '@/utils/notifications'
import type { Notification } from '@/types/application'

export function NotificationDropdown() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { notifications, unreadCount, handleMarkAsRead } = useNotifications({
    limit: 10,
    autoRefresh: true,
    refreshInterval: 2000,
  })

  // クリックアウトサイドで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }

    const route = getNotificationRoute(notification)
    if (route) {
      router.push(route)
    }

    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">通知</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">通知はありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <NotificationIcon type={notification.type} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                        {notification.message}
                      </p>
                      {notification.jobTitle && (
                        <p className="text-xs text-gray-500 mt-1">
                          {notification.jobTitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.createdAt).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-gray-200">
            <Link href="/notifications">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsOpen(false)}
              >
                すべて見る
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
```

### フェーズ4: 通知一覧ページの実装

#### NotificationsListコンポーネント

```typescript
// src/components/NotificationsList.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Bell, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { 
  updateApplicationGroupStatus,
  getApplicationGroups,
  createNotification,
} from '@/lib/localStorage'
import { NotificationIcon } from '@/components/NotificationIcon'
import { useNotifications } from '@/hooks/useNotifications'
import { getNotificationRoute } from '@/utils/notifications'
import type { Notification } from '@/types/application'

export function NotificationsList() {
  const router = useRouter()
  const { notifications, unreadCount, handleMarkAsRead, loadNotifications } = useNotifications({
    autoRefresh: true,
    refreshInterval: 2000,
  })

  const handleApprove = (notification: Notification) => {
    updateApplicationGroupStatus(notification.applicationGroupId, 'approved')
    handleMarkAsRead(notification.id)
    
    // 承認通知を作成
    const groups = getApplicationGroups()
    const group = groups.find(g => g.id === notification.applicationGroupId)
    
    if (group) {
      createNotification({
        userId: group.applicantUserId,
        type: 'application_approved',
        applicationGroupId: notification.applicationGroupId,
        jobId: notification.jobId,
        jobTitle: notification.jobTitle,
        fromUserName: 'あなた',
        message: `${notification.jobTitle || '求人'}への応募が承認されました`,
      })
    }
    
    loadNotifications()
  }

  const handleReject = (notification: Notification) => {
    updateApplicationGroupStatus(notification.applicationGroupId, 'rejected')
    handleMarkAsRead(notification.id)
    loadNotifications()
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center border border-gray-200 rounded-lg bg-white">
        <Bell size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">通知はありません</p>
        <p className="text-sm text-gray-500">
          友達からの応募招待など、通知がここに表示されます
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">通知</h3>
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            {unreadCount}件の未読
          </Badge>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 border rounded-lg transition-all ${
              notification.read 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-white border-blue-300 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <NotificationIcon type={notification.type} size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                  {notification.message}
                </p>
                
                {notification.type === 'application_invitation' && !notification.read && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(notification)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle size={16} className="mr-1" />
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(notification)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle size={16} className="mr-1" />
                      拒否
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### フェーズ5: カスタムフックの実装

#### useNotificationsフック

```typescript
// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { 
  getNotifications, 
  markNotificationAsRead, 
  getUnreadNotificationCount, 
  getCurrentUserId 
} from '@/lib/localStorage'
import type { Notification } from '@/types/application'

interface UseNotificationsOptions {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    limit,
    autoRefresh = true,
    refreshInterval = 2000,
  } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const userId = getCurrentUserId()

  const loadNotifications = useCallback(() => {
    let notifs = getNotifications(userId)
    
    if (limit && limit > 0) {
      notifs = notifs.slice(0, limit)
    }
    
    setNotifications(notifs)
    setUnreadCount(getUnreadNotificationCount(userId))
  }, [userId, limit])

  useEffect(() => {
    loadNotifications()
    
    if (autoRefresh) {
      const interval = setInterval(loadNotifications, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [loadNotifications, autoRefresh, refreshInterval])

  const handleMarkAsRead = useCallback((notificationId: string) => {
    markNotificationAsRead(notificationId)
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  return {
    notifications,
    unreadCount,
    loadNotifications,
    handleMarkAsRead,
  }
}
```

## 学んだこと

- **カスタムフックの活用**: 通知の読み込みと既読処理をカスタムフックに集約することで、コンポーネントの責務を明確化できる
- **自動更新の実装**: 定期的に通知を更新することで、リアルタイムに近い体験を提供できる
- **通知アイコンの共通化**: 通知タイプに応じたアイコンを共通コンポーネント化することで、保守性が向上する
- **UXの最適化**: 未読通知の視覚的な強調や、通知からの直接遷移により、ユーザー体験が向上する

## 今後の予定

- データベースへの移行（localStorageからSupabaseへ）
- リアルタイム通知（WebSocket や Server-Sent Events）
- 通知のフィルタリング機能
- 通知の一括既読機能
- プッシュ通知の実装

