import { createFileRoute } from '@tanstack/react-router';
import { HelpCenter } from '@/components/pos/help';

export const Route = createFileRoute('/_authenticated/help')({
  head: () => ({
    meta: [
      { title: 'Help | KaratDesk' },
      { name: 'description', content: 'Ask how anything is done in the shop — resets, backups, billing, loans, jobs and more.' },
      { property: 'og:title', content: 'Help | KaratDesk' },
      { property: 'og:description', content: 'Plain-language guides for every screen in the shop.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: HelpCenter,
});
