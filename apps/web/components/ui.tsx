'use client';
import { useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-cyan-300 shadow-[0_0_0_1px_rgb(34_211_238/0.4),0_8px_24px_-8px_rgb(34_211_238/0.6)]',
  secondary: 'bg-white/5 text-ink border border-line hover:bg-white/10 hover:border-line-strong',
  ghost: 'text-muted hover:text-ink hover:bg-white/5',
  danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25',
  warm: 'bg-warm text-zinc-950 hover:bg-amber-300 shadow-[0_8px_24px_-8px_rgb(245_158_11/0.6)]',
};
const SIZE = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' };

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex cursor-pointer select-none items-center justify-center rounded-xl font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className, as: Tag = 'section' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return (
    <Tag className={cx('glass min-w-0 rounded-2xl p-4 sm:p-5', className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        'h-10 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-line bg-surface/80 bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9 pl-3 text-sm text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%2394a3b8' stroke-width='1.6'/%3E%3C/svg%3E\")]",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Slider({ id, value, min, max, step = 1, onChange, label, format, disabled }: { id?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; format?: (v: number) => string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format ? format(value) : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full min-w-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="tabular w-16 shrink-0 text-right font-mono text-sm text-ink">{format ? format(value) : value}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex cursor-pointer items-center gap-2.5 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={cx('relative h-5 w-9 rounded-full border transition-colors', checked ? 'border-accent/60 bg-accent/30' : 'border-line bg-white/5')}>
        <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left,background-color]', checked ? 'left-[1.15rem] bg-accent' : 'left-0.5 bg-muted')} />
      </span>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-xl border border-line bg-surface/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'cursor-pointer rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(34_211_238/0.35)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warm' | 'good' | 'bad'; className?: string }) {
  const tones = {
    neutral: 'bg-white/5 text-muted border-line',
    accent: 'bg-accent/10 text-accent border-accent/30',
    warm: 'bg-warm/10 text-amber-300 border-warm/30',
    good: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
    bad: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; title?: string }) {
  const tones = {
    info: 'border-accent/25 bg-accent/5 text-cyan-100',
    warn: 'border-warm/30 bg-warm/5 text-amber-100',
    error: 'border-rose-400/30 bg-rose-500/5 text-rose-100',
    success: 'border-emerald-400/30 bg-emerald-500/5 text-emerald-100',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-white/5 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted">{children}</kbd>;
}
