import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getJournal, getNotes, getWriting, KIND_LABEL, lastTouched, urlOf } from '@/lib/content';
import { SITE } from '@/lib/site';

export async function GET(context: APIContext) {
  const entries = [...(await getWriting()), ...(await getNotes()), ...(await getJournal())]
    .filter((e) => !e.data.draft)
    .sort((a, b) => +lastTouched(b) - +lastTouched(a));

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: entries.map((e) => ({
      title: `[${KIND_LABEL[e.collection]}] ${e.data.title}`,
      link: urlOf(e),
      pubDate: lastTouched(e),
      description: 'description' in e.data ? e.data.description : undefined,
    })),
    customData: '<language>ja</language>',
  });
}
