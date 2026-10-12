import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * コンテンツは2つの出どころを持つ。
 *  - src/content/{works,writing,pages}  … このリポジトリで直接書く「玄関」
 *  - src/content/vault/{notes,writing,journal,now.md} … Obsidian Vault から同期される「庭」
 *    （scripts/sync-vault.mjs が丸ごと再生成するので手で編集しない）
 */

// ファイル名（拡張子なし）をそのまま id にする。同期スクリプトが付けるリンクと一致させるため。
const byFilename = ({ entry }: { entry: string }) =>
  entry.split('/').pop()!.replace(/\.mdx?$/, '');

const topics = z.array(z.string()).default([]);

const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works', generateId: byFilename }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      period: z.coerce.string(),
      status: z.enum(['active', 'wip', 'done', 'archived']),
      role: z.string().optional(),
      stack: z.array(z.string()).default([]),
      links: z
        .object({
          github: z.url().optional(),
          demo: z.url().optional(),
        })
        .default({}),
      cover: image().optional(),
      featured: z.boolean().default(false),
      order: z.number().default(100),
      topics,
      draft: z.boolean().default(false),
    }),
});

const writing = defineCollection({
  loader: glob({
    pattern: ['writing/*.md', 'vault/writing/*.md'],
    base: './src/content',
    generateId: byFilename,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      kind: z.enum(['essay', 'travel', 'tech', 'dev-diary']).default('essay'),
      cover: image().optional(),
      work: z.string().optional(),
      topics,
      draft: z.boolean().default(false),
    }),
});

const notes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/vault/notes', generateId: byFilename }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    stage: z.enum(['seedling', 'budding', 'evergreen']).default('seedling'),
    created: z.coerce.date(),
    updated: z.coerce.date().optional(),
    topics,
    draft: z.boolean().default(false),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/vault/journal', generateId: byFilename }),
  schema: z.object({
    title: z.string(),
    week: z.string().regex(/^\d{4}-W\d{2}$/),
    date: z.coerce.date(),
    topics,
    draft: z.boolean().default(false),
  }),
});

// about はリポジトリ、now は Vault 直下の Now.md から同期される
const pages = defineCollection({
  loader: glob({
    pattern: ['pages/*.md', 'vault/now.md'],
    base: './src/content',
    generateId: byFilename,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updated: z.coerce.date(),
  }),
});

export const collections = { works, writing, notes, journal, pages };
