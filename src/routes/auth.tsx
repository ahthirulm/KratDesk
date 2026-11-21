import { createFileRoute } from '@tanstack/react-router';
import { Auth } from '@/components/pos/auth';

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search['reason'] === 'string' ? { reason: search['reason'] } : {}),
    ...(search['mfa'] === '1' ? { mfa: '1' as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: 'Login | KaratDesk' },
      { name: 'description', content: 'Secure username and optional authenticator login for your KaratDesk jewellery workspace.' },
      { property: 'og:title', content: 'Login | KaratDesk' },
      { property: 'og:description', content: 'Jewellery POS & Inventory — secure staff access for your shop.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Auth,
});
