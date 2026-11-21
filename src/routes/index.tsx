import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Gem, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInstallationStatus } from '@/lib/security.functions';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'KaratDesk | Jewellery POS & Inventory' },
      { name: 'description', content: 'KaratDesk is a secure multi-branch jewellery POS with stock, billing, loans and shop records.' },
      { property: 'og:title', content: 'KaratDesk | Jewellery POS & Inventory' },
      { property: 'og:description', content: 'Login to your jewellery shop workspace.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const installationStatus = useServerFn(getInstallationStatus);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    let active = true;
    void installationStatus()
      .then(async (status) => {
        if (status.needsSetup) {
          await navigate({ to: '/startup', replace: true });
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Could not check installation'))
      .finally(() => { if (active) setCheckingSetup(false); });
    return () => { active = false; };
  }, [installationStatus, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-brand-stack">
        <div className="auth-brand-mark"><Gem size={30} />KaratDesk</div>
        <div className="auth-brand-tagline">Jewellery POS &amp; Inventory</div>
      </div>
      <div className="auth-card">
        <div className="eyebrow">YOUR JEWELLERY WORKSPACE</div>
        <h1>{checkingSetup ? 'Preparing KaratDesk' : 'Welcome to your shop'}</h1>
        <p>{checkingSetup ? 'Checking whether this installation needs first-time setup…' : 'Login with the username and password provided by your shop administrator.'}</p>
        {!checkingSetup && <Button asChild className="w-full mt-7"><Link to="/auth">Login<ArrowRight /></Link></Button>}
        <div className="auth-secure"><ShieldCheck size={15} />Private staff access</div>
      </div>
      <div className="auth-brand-credit">Developed by Scopule</div>
    </div>
  );
}
