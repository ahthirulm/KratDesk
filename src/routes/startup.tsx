import { createFileRoute } from '@tanstack/react-router';
import { Startup } from '@/components/pos/startup';

export const Route = createFileRoute('/startup')({
  head: () => ({
    meta: [
      { title: 'First-run setup | KaratDesk' },
      { name: 'description', content: 'Create the first KaratDesk owner account and prepare your jewellery shop workspace.' },
      { property: 'og:title', content: 'First-run setup | KaratDesk' },
      { property: 'og:description', content: 'Secure one-time administrator setup for your jewellery POS and inventory workspace.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Startup,
});
