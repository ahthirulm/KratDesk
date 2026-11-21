import { createFileRoute } from '@tanstack/react-router';
import { SalesHistory } from '@/components/pos/sales-history';

export const Route = createFileRoute('/_authenticated/sales')({
  head: () => ({ meta: [
    { title: 'Sales history | KaratDesk' },
    { name: 'description', content: 'Review original jewellery bills, selected-piece returns, voids, refunds and safe deletions.' },
    { property: 'og:title', content: 'Sales history | KaratDesk' },
    { property: 'og:description', content: 'Trace every sale, return, void, refund and linked loan without losing the original bill.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: SalesHistory,
});
