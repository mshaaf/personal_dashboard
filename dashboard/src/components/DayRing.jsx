import { useToday } from '../hooks/useToday'

const RADIUS = 48
const CIRC = 2 * Math.PI * RADIUS

export function DayRing({ compact = false }) {
  const { time, phase, dayPct, remainingLabel } = useToday()
  const offset = CIRC * (1 - dayPct)
  const pct = Math.round(dayPct * 100)

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative" style={{ width: 52, height: 52 }}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r="21" fill="none" stroke="#1e1e1e" strokeWidth="5" />
            <circle
              cx="26" cy="26" r="21"
              fill="none" stroke="#dc2626" strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 21}`}
              strokeDashoffset={`${2 * Math.PI * 21 * (1 - dayPct)}`}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 4px rgba(220,38,38,0.5))', transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[10px] font-bold">{pct}%</span>
          </div>
        </div>
        <div>
          <div className="font-mono text-[16px] font-bold">{time}</div>
          <div className="text-[11px] text-[var(--text-3)]">{remainingLabel}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6">
      {/* Ring */}
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#1e1e1e" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none" stroke="#dc2626" strokeWidth="10"
            strokeDasharray={`${CIRC.toFixed(1)}`}
            strokeDashoffset={`${offset.toFixed(1)}`}
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.55))',
              transition: 'stroke-dashoffset 1s linear',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[24px] font-bold leading-none">{pct}%</div>
          <div className="text-[8px] font-bold tracking-[0.12em] uppercase text-[var(--text-3)] mt-0.5">day</div>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <div className="font-mono text-[22px] font-bold leading-none">{time}</div>
        <div className="text-[14px] font-bold mt-1">{phase.emoji} {phase.label} — {phase.message}</div>
        <div className="text-[12px] text-[var(--text-2)]">{remainingLabel}</div>
        <div className="inline-flex items-center gap-1 bg-[var(--crimson-dim)] text-crimson text-[10px] font-bold px-2.5 py-1 rounded-full mt-1 w-fit uppercase tracking-wider">
          ⚡ {phase.label}
        </div>
      </div>
    </div>
  )
}
