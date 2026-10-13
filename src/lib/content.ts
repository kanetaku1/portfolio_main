import { getCollection, type CollectionEntry } from 'astro:content';

type Kind = 'works' | 'writing' | 'notes' | 'journal';
type AnyEntry = CollectionEntry<Kind>;

/** 開発中は下書きも表示し、本番ビルドでは除外する */
const visible = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

export const getWorks = async () =>
  (await getCollection('works', visible)).sort((a, b) => a.data.order - b.data.order);

export const getWriting = async () =>
  (await getCollection('writing', visible)).sort((a, b) => +b.data.date - +a.data.date);

export const getNotes = async () =>
  (await getCollection('notes', visible)).sort((a, b) => +lastTouched(b) - +lastTouched(a));

export const getJournal = async () =>
  (await getCollection('journal', visible)).sort((a, b) => +b.data.date - +a.data.date);

export function lastTouched(entry: AnyEntry): Date {
  switch (entry.collection) {
    case 'notes':
      return entry.data.updated ?? entry.data.created;
    case 'writing':
      return entry.data.updated ?? entry.data.date;
    case 'journal':
      return entry.data.date;
    default:
      return new Date(0);
  }
}

export const urlOf = (entry: AnyEntry) =>
  entry.collection === 'journal'
    ? `/journal#${entry.data.week}`
    : `/${entry.collection}/${entry.id}`;

export const KIND_LABEL: Record<Kind, string> = {
  works: 'Work',
  writing: 'Writing',
  notes: 'Note',
  journal: 'Journal',
};

/** すべての公開コンテンツ */
export async function getAll(): Promise<AnyEntry[]> {
  const [w, wr, n, j] = await Promise.all([getWorks(), getWriting(), getNotes(), getJournal()]);
  return [...w, ...wr, ...n, ...j];
}

/** トピック → それを持つコンテンツ。「関心の地図」の元データ */
export async function getTopicMap(): Promise<Map<string, AnyEntry[]>> {
  const map = new Map<string, AnyEntry[]>();
  for (const entry of await getAll()) {
    for (const topic of entry.data.topics) {
      map.set(topic, [...(map.get(topic) ?? []), entry]);
    }
  }
  return new Map([...map].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])));
}

/** target を本文中でリンクしているコンテンツ（バックリンク） */
export async function getBacklinks(target: AnyEntry): Promise<AnyEntry[]> {
  const href = urlOf(target);
  const pattern = new RegExp(`\\]\\(${escapeRegExp(href)}(?:[#)/])`);
  return (await getAll()).filter((e) => e !== target && e.body && pattern.test(e.body));
}

/** 作品に紐づく記事（writing の frontmatter `work`） */
export async function getWritingForWork(workId: string) {
  return (await getWriting())
    .filter((w) => w.data.work === workId)
    .sort((a, b) => +a.data.date - +b.data.date);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
