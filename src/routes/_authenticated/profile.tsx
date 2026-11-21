import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettings } from '@/components/pos/profile';

export const Route = createFileRoute('/_authenticated/profile')({
  validateSearch: (search: Record<string, unknown>) => ({ ...(search['setup2fa'] === '1' ? { setup2fa: '1' as const } : {}) }),
  head: () => ({
    meta: [
      { title: 'My profile | KaratDesk' },
      { name: 'description', content: 'Manage your staff profile, password and optional authenticator-app verification.' },
      { property: 'og:title', content: 'My profile | KaratDesk' },
      { property: 'og:description', content: 'Personal staff profile and security settings.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ProfileSettings,
});
