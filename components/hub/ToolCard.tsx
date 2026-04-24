import Link from 'next/link';
import type { ReactNode } from 'react';
import { ACCENTS, type AccentKey } from '@/lib/accents';

export type ToolStatus = 'available' | 'beta' | 'coming-soon';

interface ToolCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  accent?: AccentKey;
  status?: ToolStatus;
  meta?: string;
}

export function ToolCard({
  href,
  icon,
  title,
  description,
  accent,
  status = 'available',
  meta,
}: ToolCardProps) {
  const tokens = accent ? ACCENTS[accent] : null;
  const disabled = status === 'coming-soon';

  const cardBase =
    'group relative flex flex-col overflow-hidden rounded-2xl border bg-surface-1 p-5 transition-all';
  const cardState = disabled
    ? 'border-border opacity-60 cursor-not-allowed'
    : tokens
    ? `border-border ${tokens.hoverBorder} ${tokens.glow} hover:-translate-y-0.5`
    : 'border-border hover:border-surface-4 hover:-translate-y-0.5';

  const inner = (
    <>
      {/* Left accent bar */}
      {tokens && !disabled && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-5 bottom-5 w-0.5 rounded-full ${tokens.bg} opacity-60 group-hover:opacity-100 transition-opacity`}
        />
      )}

      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            tokens ? tokens.iconBg : 'bg-surface-3 text-muted'
          }`}
        >
          {icon}
        </div>
        {status === 'beta' && (
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
              tokens ? `${tokens.bgSoft} ${tokens.text}` : 'bg-surface-3 text-muted'
            }`}
          >
            Beta
          </span>
        )}
        {status === 'coming-soon' && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-surface-3 text-muted">
            Soon
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold tracking-tight text-white mb-1">
        {title}
      </h3>
      <p className="text-[13px] text-muted leading-relaxed flex-1">{description}</p>

      {meta && (
        <p
          className="text-[11px] text-muted/70 mt-3 font-mono"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {meta}
        </p>
      )}

      {!disabled && (
        <div
          className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${
            tokens ? tokens.text : 'text-white'
          } opacity-70 group-hover:opacity-100 transition-opacity`}
        >
          Open <span aria-hidden>→</span>
        </div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div className={`${cardBase} ${cardState}`} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={`${cardBase} ${cardState}`}>
      {inner}
    </Link>
  );
}
