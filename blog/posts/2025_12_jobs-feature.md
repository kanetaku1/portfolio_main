---
title: 求人機能の実装 - 求人一覧と詳細表示の実装

date: 2024/12

category: dev

thumbnail: ../img/IMG_0987_Original.JPG

description: 求人一覧表示、求人詳細表示、求人への興味管理などの求人機能を実装した開発日記

---

# 求人機能の実装 - 求人一覧と詳細表示の実装

## プロジェクト概要

Jobsta（ジョブスタ）は、友達と一緒に応募できるソーシャル型短期バイトマッチングアプリです。求人機能は、ユーザーが求人を閲覧し、興味のある求人に応募するための基盤となる機能です。

## 技術スタック

- **フレームワーク**: Next.js 15
- **言語**: TypeScript
- **UIライブラリ**: React 19
- **スタイリング**: Tailwind CSS
- **データソース**: JSONファイル（MVP段階）

## 開発過程

### フェーズ1: 求人データモデルの設計

#### データ型の定義

```typescript
// src/utils/getData.ts
export type Job = {
  company_id: string | null
  created_at: string
  description: string | null
  id: string
  job_date: string | null
  location: string | null
  title: string | null
  transport_fee: number | null
  wage_amount: number | null
}
```

求人の基本情報（タイトル、説明、勤務地、日給、交通費、勤務日など）を管理する型を定義しました。

#### JSONデータファイルの作成

MVP段階では、求人データをJSONファイルで管理：

```json
// src/data/jobs.json
[
  {
    "id": "job_001",
    "title": "イベントスタッフ",
    "description": "コンサート会場での案内・誘導業務",
    "location": "東京都渋谷区",
    "wage_amount": 12000,
    "transport_fee": 1000,
    "job_date": "2024-12-25"
  }
]
```

### フェーズ2: 求人データ取得関数の実装

#### データ取得関数

```typescript
// src/utils/getData.ts
import jobsData from '@/data/jobs.json'

export async function getJobsAll(): Promise<Job[]> {
  return jobsData as Job[]
}

export async function getJob(id: string): Promise<Job | null> {
  const jobs = await getJobsAll()
  const job = jobs.find(j => j.id === id)
  return job || null
}
```

サーバーコンポーネントで使用できるように、async関数として実装しました。

### フェーズ3: 求人一覧ページの実装

#### 求人一覧の表示

```typescript
// src/app/jobs/page.tsx
import { getJobsAll } from '@/utils/getData'
import Link from 'next/link'
import { JobCard } from '@/components/JobCard'

export default async function JobsPage() {
  const jobs = await getJobsAll()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 max-w-6xl py-8">
        <div className="mb-8">
          <Link 
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← ホームに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">求人一覧</h1>
          <p className="text-gray-600 mt-2">
            友達と一緒に応募できる求人を探しましょう
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">現在、求人情報はありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

#### JobCardコンポーネントの実装

```typescript
// src/components/JobCard.tsx
import Link from 'next/link'
import type { Job } from '@/utils/getData'

type JobCardProps = {
  job: Job
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 h-full">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {job.title || 'タイトルなし'}
        </h3>
        
        {job.location && (
          <p className="text-gray-600 text-sm mb-2">📍 {job.location}</p>
        )}
        
        {job.wage_amount && (
          <p className="text-blue-600 font-bold text-lg mb-2">
            💰 {job.wage_amount.toLocaleString()}円
          </p>
        )}
        
        {job.job_date && (
          <p className="text-gray-500 text-sm">
            📅 {new Date(job.job_date).toLocaleDateString('ja-JP')}
          </p>
        )}
      </div>
    </Link>
  )
}
```

### フェーズ4: 求人詳細ページの実装

#### 求人詳細の表示

```typescript
// src/app/jobs/[id]/page.tsx
import { getJob } from '@/utils/getData'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await getJob(id)

  if (!job) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link 
          href="/jobs"
          className="text-blue-600 hover:text-blue-800 mb-6 inline-block"
        >
          ← 求人一覧に戻る
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            {job.title || 'タイトルなし'}
          </h1>

          <div className="space-y-4 mb-6">
            {job.location && (
              <div className="flex items-start">
                <span className="font-semibold text-gray-700 w-24">勤務地:</span>
                <span className="text-gray-600">{job.location}</span>
              </div>
            )}

            {job.wage_amount && (
              <div className="flex items-start">
                <span className="font-semibold text-gray-700 w-24">日給:</span>
                <span className="text-blue-600 font-bold text-xl">
                  {job.wage_amount.toLocaleString()}円
                </span>
              </div>
            )}

            {job.transport_fee && (
              <div className="flex items-start">
                <span className="font-semibold text-gray-700 w-24">交通費:</span>
                <span className="text-gray-600">
                  {job.transport_fee.toLocaleString()}円
                </span>
              </div>
            )}

            {job.job_date && (
              <div className="flex items-start">
                <span className="font-semibold text-gray-700 w-24">勤務日:</span>
                <span className="text-gray-600">
                  {new Date(job.job_date).toLocaleDateString('ja-JP')}
                </span>
              </div>
            )}

            {job.description && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  仕事内容
                </h2>
                <p className="text-gray-600 whitespace-pre-line">
                  {job.description}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Link href={`/jobs/${job.id}/apply`}>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                友達と応募する
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### フェーズ5: 求人への興味管理機能の実装

#### 興味ステータスの管理

```typescript
// src/lib/localStorage.ts
export type JobInterestStatus = 'interested' | 'not_interested' | 'none'

export type JobInterest = {
  userId: string
  jobId: string
  status: JobInterestStatus
  updatedAt: string
}

export function setJobInterest(
  jobId: string,
  userId: string,
  status: JobInterestStatus
): void {
  const interests = getJobInterests()
  const existingIndex = interests.findIndex(
    i => i.jobId === jobId && i.userId === userId
  )
  
  if (existingIndex >= 0) {
    interests[existingIndex] = {
      ...interests[existingIndex],
      status,
      updatedAt: new Date().toISOString(),
    }
  } else {
    interests.push({
      userId,
      jobId,
      status,
      updatedAt: new Date().toISOString(),
    })
  }
  
  saveJobInterests(interests)
}
```

#### JobInterestButtonコンポーネント

```typescript
// src/components/JobInterestButton.tsx
'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { 
  getJobInterestForUser, 
  setJobInterest, 
  getCurrentUserId 
} from '@/lib/localStorage'
import type { JobInterestStatus } from '@/types/application'

type JobInterestButtonProps = {
  jobId: string
}

export function JobInterestButton({ jobId }: JobInterestButtonProps) {
  const userId = getCurrentUserId()
  const [interestStatus, setInterestStatus] = useState<JobInterestStatus>(
    getJobInterestForUser(jobId, userId)
  )

  const handleToggle = () => {
    const newStatus: JobInterestStatus = 
      interestStatus === 'interested' ? 'none' : 'interested'
    
    setJobInterest(jobId, userId, newStatus)
    setInterestStatus(newStatus)
  }

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-full transition-colors ${
        interestStatus === 'interested'
          ? 'bg-red-100 text-red-600'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Heart 
        size={20} 
        fill={interestStatus === 'interested' ? 'currentColor' : 'none'}
      />
    </button>
  )
}
```

## 学んだこと

- **サーバーコンポーネントの活用**: Next.js 15のApp Routerでは、データ取得をサーバーコンポーネントで行うことで、パフォーマンスが向上する
- **型安全性の確保**: TypeScriptの型定義を適切に行うことで、開発時のエラーを減らせる
- **MVP開発の重要性**: JSONファイルでデータを管理することで、迅速にプロトタイプを構築できる
- **UIコンポーネントの再利用**: JobCardコンポーネントを再利用することで、コードの重複を減らせる

## 今後の予定

- データベースへの移行（JSONファイルからSupabaseへ）
- 求人検索・フィルタリング機能の実装
- お気に入り機能の実装
- 求人推薦機能の実装
- 求人詳細の拡充（画像、動画など）

