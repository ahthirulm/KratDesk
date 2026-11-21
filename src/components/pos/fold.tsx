import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Expandable/closable group used across settings and administration. */
export function Fold({ title, icon, note, actions, children, defaultOpen = false, sub = false, tone }: { title: ReactNode; icon?: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode; defaultOpen?: boolean; sub?: boolean; tone?: 'danger' }) {
  return <details className={`fold ${sub ? 'fold-sub' : ''} ${tone === 'danger' ? 'fold-danger' : ''}`} open={defaultOpen || undefined}>
    <summary className="fold-summary">
      <span className="fold-title">{icon && <span className="fold-icon">{icon}</span>}<span className="min-w-0"><b>{title}</b>{note && <small>{note}</small>}</span></span>
      {actions && <span className="fold-actions" onClick={(e) => e.preventDefault()}>{actions}</span>}
      <ChevronDown className="fold-chevron" />
    </summary>
    <div className="fold-body">{children}</div>
  </details>;
}

export function FoldGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="fold-group"><h2 className="fold-group-title">{title}</h2>{children}</div>;
}
