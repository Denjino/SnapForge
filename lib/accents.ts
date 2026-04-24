export type AccentKey = 'emerald' | 'cyan' | 'amber' | 'violet' | 'rose';

export interface AccentTokens {
  hex: string;
  text: string;
  bg: string;
  bgHover: string;
  bgSoft: string;
  border: string;
  hoverBorder: string;
  ring: string;
  glow: string;
  iconBg: string;
}

// Full class strings (including variant prefixes) are kept as literals so
// Tailwind's JIT scanner picks them up. Do NOT construct these with template
// strings at render time — e.g. `hover:${token.border}` won't be detected.
//
// Every hover:* / shadow-[...] variant used in the app lives here.
export const ACCENTS: Record<AccentKey, AccentTokens> = {
  emerald: {
    hex: '#6ee7b7',
    text: 'text-emerald-300',
    bg: 'bg-emerald-400',
    bgHover: 'hover:bg-emerald-300',
    bgSoft: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    hoverBorder: 'hover:border-emerald-400/50',
    ring: 'ring-emerald-400/40',
    glow: 'hover:shadow-[0_0_32px_rgba(110,231,183,0.18)]',
    iconBg: 'bg-emerald-400/10 text-emerald-300',
  },
  cyan: {
    hex: '#22d3ee',
    text: 'text-cyan-300',
    bg: 'bg-cyan-400',
    bgHover: 'hover:bg-cyan-300',
    bgSoft: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
    hoverBorder: 'hover:border-cyan-400/50',
    ring: 'ring-cyan-400/40',
    glow: 'hover:shadow-[0_0_32px_rgba(34,211,238,0.18)]',
    iconBg: 'bg-cyan-400/10 text-cyan-300',
  },
  amber: {
    hex: '#fbbf24',
    text: 'text-amber-300',
    bg: 'bg-amber-400',
    bgHover: 'hover:bg-amber-300',
    bgSoft: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    hoverBorder: 'hover:border-amber-400/50',
    ring: 'ring-amber-400/40',
    glow: 'hover:shadow-[0_0_32px_rgba(251,191,36,0.18)]',
    iconBg: 'bg-amber-400/10 text-amber-300',
  },
  violet: {
    hex: '#a78bfa',
    text: 'text-violet-300',
    bg: 'bg-violet-400',
    bgHover: 'hover:bg-violet-300',
    bgSoft: 'bg-violet-400/10',
    border: 'border-violet-400/30',
    hoverBorder: 'hover:border-violet-400/50',
    ring: 'ring-violet-400/40',
    glow: 'hover:shadow-[0_0_32px_rgba(167,139,250,0.18)]',
    iconBg: 'bg-violet-400/10 text-violet-300',
  },
  rose: {
    hex: '#fb7185',
    text: 'text-rose-300',
    bg: 'bg-rose-400',
    bgHover: 'hover:bg-rose-300',
    bgSoft: 'bg-rose-400/10',
    border: 'border-rose-400/30',
    hoverBorder: 'hover:border-rose-400/50',
    ring: 'ring-rose-400/40',
    glow: 'hover:shadow-[0_0_32px_rgba(251,113,133,0.18)]',
    iconBg: 'bg-rose-400/10 text-rose-300',
  },
};
