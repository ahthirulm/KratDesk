import { createFileRoute } from '@tanstack/react-router';
import { Billing } from '@/components/pos/billing';

export const Route = createFileRoute('/_authenticated/billing')({
  head: () => ({
    meta: [
      { title: 'Billing | KaratDesk' },
      { name: 'description', content: 'Create secure jewellery bills with weight-based prices and installment payments.' },
      { property: 'og:title', content: 'Billing | KaratDesk' },
      { property: 'og:description', content: 'Your daily jewellery workspace for billing, inventory and loans.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Billing,
});
