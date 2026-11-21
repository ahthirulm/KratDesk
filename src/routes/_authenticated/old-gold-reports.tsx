import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/old-gold-reports')({
  beforeLoad: () => {
    throw redirect({ to: '/reports', search: { report: 'old-gold' } });
  },
  head: () => ({ meta: [
    { title: 'Old gold profit reports | KaratDesk' },
    { name: 'description', content: 'Open old-gold purchase costs, realised profit and trading history in the unified Reports area.' },
    { property: 'og:title', content: 'Old gold profit reports | KaratDesk' },
    { property: 'og:description', content: 'Separate old-gold trading reports within Reports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
});
