---
title: 認証システムの実装 - Auth0とSupabaseを使ったThird-Party認証

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: Auth0とSupabaseを組み合わせたThird-Party認証システム（LINEログイン対応）の実装過程を記録した開発日記

---

# 認証システムの実装 - Auth0とSupabaseを使ったThird-Party認証

## プロジェクト概要

Jobsta（ジョブスタ）は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。ユーザー認証には、Supabase AuthとAuth0を組み合わせたThird-Party認証システムを実装し、LINEログインなどの外部認証プロバイダーに対応しました。

## 技術スタック

- **フレームワーク**: Next.js 15
- **言語**: TypeScript
- **認証プロバイダー**: Auth0
- **バックエンド**: Supabase
- **データベース**: PostgreSQL
- **認証方式**: OAuth 2.0 / OpenID Connect

## 開発過程

### フェーズ1: 認証要件の定義

#### 要件

- LINEログインなどの外部認証プロバイダーに対応
- ユーザー情報をSupabaseデータベースに保存
- クライアント側で認証状態を管理
- セッション管理とトークン管理

#### 技術選定の理由

- **Auth0**: 複数の認証プロバイダー（LINE、Google、Facebookなど）を統一的に管理できる
- **Supabase**: 認証とデータベースを一元的に管理できる
- **Third-Party Auth**: SupabaseのThird-Party認証機能を使用することで、Auth0のトークンをSupabaseで管理

### フェーズ2: Auth0の設定

#### Auth0アプリケーションの作成

1. Auth0ダッシュボードでアプリケーションを作成
2. Application Type: Single Page Application (SPA)
3. Allowed Callback URLs: `http://localhost:3000/auth/callback`
4. Allowed Logout URLs: `http://localhost:3000/login`

#### LINE認証プロバイダーの設定

Auth0でLINEをSocial Connectionとして設定し、LINE Developersで取得したClient IDとClient Secretを設定しました。

### フェーズ3: SupabaseのThird-Party認証設定

#### Supabaseでの設定

Supabaseの認証設定で、Auth0をThird-Party認証プロバイダーとして設定しました。

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 認証が必要なページのチェック
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user && request.nextUrl.pathname.startsWith('/applications')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

### フェーズ4: 認証コールバックの実装

#### Auth0コールバック処理

```typescript
// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/auth-code-error?error=${error}`, request.url)
    )
  }

  if (code) {
    const supabase = await createClient()
    
    // Auth0の認証コードをSupabaseに渡す
    const { data, error: supabaseError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (supabaseError) {
      return NextResponse.redirect(
        new URL(`/auth/auth-code-error?error=${supabaseError.message}`, request.url)
      )
    }

    // 認証成功後、ホームページにリダイレクト
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
```

### フェーズ5: クライアント側での認証状態管理

#### Auth0 IDトークンの取得とユーザー情報の取得

クライアント側では、Auth0のIDトークンをクッキーから取得し、JWTをデコードしてユーザー情報を取得する実装を行いました。

```typescript
// src/lib/auth/auth0-utils.ts
export function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

export function getAuth0IdTokenFromCookie(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const cookies = document.cookie.split(';')
  const idTokenCookie = cookies.find(cookie => cookie.trim().startsWith('auth0_id_token='))
  if (idTokenCookie) {
    return decodeURIComponent(idTokenCookie.split('=')[1].trim())
  }
  return null
}

export function getCurrentUserFromAuth0() {
  const idToken = getAuth0IdTokenFromCookie()
  return getUserFromAuth0Token(idToken)
}
```

#### ログインページの実装

```typescript
// src/app/login/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUserFromAuth0 } from '@/lib/auth/auth0-utils'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // 既にログインしている場合はホームにリダイレクト
    const user = getCurrentUserFromAuth0()
    if (user) {
      router.push('/')
    }
  }, [router])

  const handleLogin = () => {
    // Auth0の認証URLにリダイレクト
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/callback`
    
    const authUrl = `https://${auth0Domain}/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=openid profile email`
    
    window.location.href = authUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Jobsta</h1>
        <p className="text-center text-gray-600 mb-8">友達と一緒に応募できる短期バイトマッチングアプリ</p>
        <button
          onClick={handleLogin}
          className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
        >
          LINEでログイン
        </button>
      </div>
    </div>
  )
}
```

### フェーズ6: 認証状態の保護

#### ミドルウェアでの認証チェック

認証が必要なページへのアクセスをミドルウェアで保護しました。

#### コンポーネントでの認証チェック

```typescript
// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUserFromAuth0 } from '@/lib/auth/auth0-utils'

export default function HomePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const user = getCurrentUserFromAuth0()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setIsChecking(false)
    }
    
    checkAuth()
    
    // クッキーの変更を監視
    const checkAuthInterval = setInterval(() => {
      const user = getCurrentUserFromAuth0()
      if (!user && !isChecking) {
        router.push('/login')
      }
    }, 2000)

    return () => clearInterval(checkAuthInterval)
  }, [router, isChecking])

  if (isChecking) {
    return <div>読み込み中...</div>
  }

  return (
    <div>
      {/* ホームページのコンテンツ */}
    </div>
  )
}
```

## 学んだこと

- **Third-Party認証の複雑さ**: Auth0とSupabaseを組み合わせることで、柔軟な認証システムを構築できるが、トークンの管理やセッション管理が複雑になる
- **JWTデコードの実装**: クライアント側でJWTをデコードする際は、セキュリティに注意が必要
- **クッキー管理の重要性**: 認証トークンをクッキーで管理する際は、適切な設定（Secure、HttpOnly、SameSite）が必要
- **認証状態の同期**: クライアント側とサーバー側で認証状態を適切に同期させる必要がある

## 今後の予定

- 認証エラーハンドリングの改善
- リフレッシュトークンの実装
- ログアウト機能の完全実装
- ユーザープロフィール管理機能の実装
- セッション管理の最適化

