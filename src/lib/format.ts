const ymd = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/** 2026.10.12 */
export const formatDate = (d: Date) => ymd.format(d).replaceAll('/', '.');

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const STAGE = {
  seedling: { icon: '🌱', label: 'Seedling', note: '書きかけのメモ' },
  budding: { icon: '🌿', label: 'Budding', note: '育ちつつあるメモ' },
  evergreen: { icon: '🌳', label: 'Evergreen', note: 'ひとまず書き上げたもの' },
} as const;

export const WORK_STATUS = {
  active: '運用中',
  wip: '開発中',
  done: '完了',
  archived: 'アーカイブ',
} as const;

export const WRITING_KIND = {
  essay: 'エッセイ',
  travel: '旅',
  tech: '技術',
  'dev-diary': '開発記録',
} as const;
