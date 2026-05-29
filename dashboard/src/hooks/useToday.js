import { useState, useEffect } from 'react'
import { format } from 'date-fns'

const PHASES = [
  { start: 0, end: 6, label: 'Night', emoji: '🌙', message: 'Rest and recover. Tomorrow starts now.' },
  { start: 6, end: 12, label: 'Morning', emoji: '🌅', message: 'Peak focus window. Attack the day.' },
  { start: 12, end: 17, label: 'Midday', emoji: '⚡', message: 'Keep moving. Sustain the momentum.' },
  { start: 17, end: 21, label: 'Evening', emoji: '🔥', message: 'Finish strong. Close your loops.' },
  { start: 21, end: 24, label: 'Night', emoji: '🌙', message: 'Wind down. Tomorrow starts now.' },
]

export function useToday() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const h = now.getHours()
  const phase = PHASES.find(p => h >= p.start && h < p.end) || PHASES[0]
  const totalSeconds = h * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const dayPct = totalSeconds / 86400
  const remainingSeconds = 86400 - totalSeconds
  const remainH = Math.floor(remainingSeconds / 3600)
  const remainM = Math.floor((remainingSeconds % 3600) / 60)

  return {
    now,
    time: format(now, 'h:mm a'),
    date: format(now, 'EEEE, MMMM d, yyyy'),
    dateShort: format(now, 'EEE MMM d').toUpperCase(),
    phase,
    dayPct,
    remainingLabel: `${remainH}h ${remainM}m remaining`,
    dayOfWeek: now.getDay(), // 0=Sun
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
  }
}
