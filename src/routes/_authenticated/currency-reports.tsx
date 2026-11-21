import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/currency-reports')({
  beforeLoad: () => {
    throw redirect({ to: '/reports', search: { report: 'currency' } });
  },
  head: () => ({ meta: [
    { title: 'Currency reports | KaratDesk' },
    { name: 'description', content: 'Open currency exchange turnover, holdings and realised profit in the unified Reports area.' },
    { property: 'og:title', content: 'Currency reports | KaratDesk' },
    { property: 'og:description', content: 'Exchange-only branch reports and exports within Reports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
});
