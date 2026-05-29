import { Loader2 } from 'lucide-react'

// ——— Card ———
export function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border rounded-[12px] p-5 ${onClick ? 'cursor-pointer hover:border-border-light transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// ——— Section Label ———
export function Label({ children, className = '' }) {
  return (
    <div className={`text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--text-3)] mb-2 ${className}`}>
      {children}
    </div>
  )
}

// ——— Button ———
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', className = '' }) {
  const base = 'inline-flex items-center gap-1.5 font-semibold rounded-[8px] transition-all font-sans cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2 text-[13px]',
    lg: 'px-5 py-2.5 text-[14px]',
    full: 'px-4 py-3 text-[14px] w-full justify-center',
  }
  const variants = {
    primary: 'bg-crimson text-white hover:bg-crimson-h',
    ghost: 'bg-transparent border border-border text-[var(--text-2)] hover:border-border-light hover:text-[var(--text)]',
    surface: 'bg-surface2 border border-border text-[var(--text-2)] hover:text-[var(--text)]',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ——— Checkbox ———
export function Checkbox({ checked, onChange, size = 18 }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{ width: size, height: size }}
      className={`rounded-full border flex items-center justify-center flex-shrink-0 transition-all
        ${checked
          ? 'bg-crimson border-crimson'
          : 'border-border-light bg-transparent hover:border-[var(--crimson)]'}`}
    >
      {checked && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

// ——— Progress Bar ———
export function Bar({ value, max = 100, color = 'crimson', height = 4, className = '' }) {
  const pct = Math.min(100, (value / max) * 100)
  const colors = {
    crimson: 'bg-crimson',
    green: 'bg-success',
    yellow: 'bg-warn',
    muted: 'bg-border-light',
  }
  return (
    <div className={`bg-border rounded-full overflow-hidden ${className}`} style={{ height }}>
      <div
        className={`${colors[color]} rounded-full transition-all duration-500`}
        style={{
          height,
          width: `${pct}%`,
          boxShadow: color === 'crimson' ? '0 0 8px var(--crimson-glow)' : undefined,
        }}
      />
    </div>
  )
}

// ——— Pill ———
export function Pill({ children, color = 'muted' }) {
  const colors = {
    red: 'bg-[var(--crimson-dim)] text-crimson',
    green: 'bg-[var(--green-dim)] text-success',
    yellow: 'bg-[var(--yellow-dim)] text-warn',
    muted: 'bg-surface2 text-[var(--text-3)] border border-border',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[color]}`}>
      {children}
    </span>
  )
}

// ——— Streak Badge ———
export function StreakBadge({ count, label = 'day streak' }) {
  return (
    <div className="flex items-center gap-1 bg-[var(--crimson-dim)] text-crimson text-[11px] font-bold px-3 py-1.5 rounded-full">
      ⚡ {count} {label}
    </div>
  )
}

// ——— Loading Spinner ———
export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="spinner text-[var(--text-3)]" />
}

// ——— Loading State ———
export function Loading() {
  return (
    <div className="flex items-center justify-center h-32">
      <Spinner size={20} />
    </div>
  )
}

// ——— Empty State ———
export function Empty({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      {Icon && <Icon size={28} className="text-[var(--text-3)]" />}
      <div className="text-[13px] font-semibold text-[var(--text-2)]">{title}</div>
      {sub && <div className="text-[12px] text-[var(--text-3)]">{sub}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ——— Input ———
export function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--text-3)]">{label}</label>}
      <input
        className="px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] text-[var(--text)] focus:border-crimson outline-none transition-colors"
        {...props}
      />
    </div>
  )
}

// ——— Select ———
export function Select({ label, options = [], ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--text-3)]">{label}</label>}
      <select
        className="px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] text-[var(--text)] focus:border-crimson outline-none transition-colors"
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ——— Modal ———
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-[16px] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto animate-in">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[16px] font-bold">{title}</div>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ——— Stat Box ———
export function StatBox({ label, value, color = 'white' }) {
  const colors = { white: 'text-[var(--text)]', red: 'text-crimson', green: 'text-success' }
  return (
    <div className="flex-1 bg-surface2 border border-border rounded-[8px] p-3.5">
      <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--text-3)] mb-1.5">{label}</div>
      <div className={`font-mono text-[20px] font-bold ${colors[color]}`}>{value}</div>
    </div>
  )
}

// ——— Tab Bar ———
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 bg-surface2 p-1 rounded-[8px] w-fit mb-4">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 text-[12px] font-semibold rounded-[6px] transition-all
            ${active === t.key
              ? 'bg-surface text-[var(--text)] shadow-sm'
              : 'text-[var(--text-2)] hover:text-[var(--text)]'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ——— Divider ———
export function Divider({ className = '' }) {
  return <div className={`border-t border-border ${className}`} />
}
