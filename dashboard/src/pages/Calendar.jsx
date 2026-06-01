import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { loadGapi, initTokenClient, requestToken, revokeToken, isSignedIn, fetchMonth, fetchUpcoming, formatEventTime } from '../lib/googleCalendar'
import { Card, Label, Btn, Empty } from '../components/ui'
import { Calendar, ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns'

const EVENT_COLORS = [
  '#dc2626','#ea580c','#d97706','#16a34a','#0891b2','#2563eb','#7c3aed','#db2777',
]

export default function CalendarPage() {
  const { now } = useToday()
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState([])
  const [viewMonth, setViewMonth] = useState(now)
  const [selectedDay, setSelectedDay] = useState(now)
  const [gapiReady, setGapiReady] = useState(false)
  const [error, setError] = useState(null)

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

  // ——— Initialise gapi + GIS, then silently try to restore a saved token ———
  useEffect(() => {
    if (!CLIENT_ID) return

    const check = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(check)
        loadGapi().then(() => {
          // Register the callback BEFORE trying to restore
          initTokenClient((token) => {
            setSignedIn(true)
          })
          setGapiReady(true)
          setSignedIn(isSignedIn())
        })
      }
    }, 200)

    return () => clearInterval(check)
  }, [CLIENT_ID])

  // ——— Load events whenever month changes or sign-in state flips ———
  useEffect(() => {
    if (signedIn) loadEvents()
  }, [viewMonth, signedIn])

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMonth(viewMonth.getFullYear(), viewMonth.getMonth())
      setEvents(data)
    } catch (e) {
      setError('Failed to load events — try signing out and back in.')
    }
    setLoading(false)
  }

  function handleSignIn() {
    requestToken()
  }

  function handleSignOut() {
    revokeToken()
    setSignedIn(false)
    setEvents([])
  }

  // ——— Calendar grid helpers ———
  const monthStart = startOfMonth(viewMonth)
  const calDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewMonth) })
  const startPad = (monthStart.getDay() + 6) % 7        // Mon = 0
  const paddedDays = [...Array(startPad).fill(null), ...calDays]
  while (paddedDays.length % 7 !== 0) paddedDays.push(null)

  const dayEvents = (day) => {
    if (!day) return []
    return events.filter(e => {
      const start = e.start.date
        ? new Date(e.start.date + 'T00:00:00')
        : new Date(e.start.dateTime)
      return isSameDay(start, day)
    })
  }

  // Stable color per calendar
  const calColors = {}
  events.forEach(e => {
    const cal = e.organizer?.email || 'primary'
    if (!calColors[cal]) {
      calColors[cal] = EVENT_COLORS[Object.keys(calColors).length % EVENT_COLORS.length]
    }
  })
  const eventColor = (e) => calColors[e.organizer?.email || 'primary'] || EVENT_COLORS[0]

  const selectedEvents = dayEvents(selectedDay)
  const todayEvents = events.filter(e => {
    const start = e.start.date ? new Date(e.start.date + 'T00:00:00') : new Date(e.start.dateTime)
    return isToday(start)
  })

  // ——— No client ID configured ———
  if (!CLIENT_ID) {
    return (
      <div className="p-7 animate-in">
        <h1 className="text-[22px] font-black tracking-[-0.03em] mb-2">Calendar</h1>
        <Card>
          <Empty
            icon={Calendar}
            title="Google Calendar not configured"
            sub="Add VITE_GOOGLE_CLIENT_ID to your .env file"
            action={
              <div className="text-left bg-surface2 rounded-[8px] p-4 font-mono text-[11px] text-[var(--text-3)] mt-2 leading-relaxed">
                1. console.cloud.google.com → Create project<br/>
                2. Enable Google Calendar API<br/>
                3. APIs & Services → OAuth 2.0 Client ID (Web)<br/>
                4. Add http://localhost:5173 to authorized origins<br/>
                5. VITE_GOOGLE_CLIENT_ID=your_id in .env
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  // ——— Not signed in ———
  if (!signedIn) {
    return (
      <div className="p-7 animate-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.03em]">Calendar</h1>
            <p className="text-[13px] text-[var(--text-2)] mt-0.5">Google Calendar</p>
          </div>
        </div>
        <Card>
          <Empty
            icon={Calendar}
            title="Connect Google Calendar"
            sub="Sign in once — your session is saved across refreshes"
            action={
              <Btn onClick={handleSignIn} disabled={!gapiReady}>
                <LogIn size={13} /> {gapiReady ? 'Sign in with Google' : 'Loading…'}
              </Btn>
            }
          />
        </Card>
      </div>
    )
  }

  // ——— Signed in ———
  return (
    <div className="p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Calendar</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Google Calendar · {events.length} events</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={loadEvents} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spinner' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut size={12} /> Disconnect
          </Btn>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-[var(--crimson-dim)] border border-[rgba(220,38,38,0.2)] rounded-[8px] text-[13px] text-crimson">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* ——— Month grid ——— */}
        <Card>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="p-1.5 text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-[15px] font-bold">{format(viewMonth, 'MMMM yyyy')}</div>
            <button
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="p-1.5 text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-[9px] font-bold tracking-wider uppercase text-[var(--text-3)] pb-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {paddedDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const evts = dayEvents(day)
              const selected = isSameDay(day, selectedDay)
              const today = isToday(day)
              const inMonth = isSameMonth(day, viewMonth)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`
                    flex flex-col items-center py-2 rounded-[8px] transition-all min-h-[54px]
                    ${selected
                      ? 'bg-crimson text-white'
                      : today
                      ? 'bg-[var(--crimson-dim)] text-crimson'
                      : 'hover:bg-surface2 text-[var(--text)]'}
                    ${!inMonth ? 'opacity-25' : ''}
                  `}
                >
                  <span className="text-[12px] font-semibold leading-none">{format(day, 'd')}</span>
                  {evts.length > 0 && (
                    <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center px-1">
                      {evts.slice(0, 3).map((e, j) => (
                        <div
                          key={j}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: selected ? 'rgba(255,255,255,0.8)' : eventColor(e) }}
                        />
                      ))}
                      {evts.length > 3 && (
                        <span className={`text-[8px] ${selected ? 'text-white/70' : 'text-[var(--text-3)]'}`}>
                          +{evts.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* ——— Right panel ——— */}
        <div className="flex flex-col gap-3">
          {/* Selected day */}
          <Card>
            <Label>{format(selectedDay, 'EEEE, MMM d')}</Label>
            {selectedEvents.length === 0 ? (
              <div className="text-[12px] text-[var(--text-3)] py-4 text-center">No events</div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedEvents.map(e => (
                  <EventRow key={e.id} event={e} color={eventColor(e)} />
                ))}
              </div>
            )}
          </Card>

          {/* Today's events (if different from selected) */}
          {!isToday(selectedDay) && todayEvents.length > 0 && (
            <Card>
              <Label>Today</Label>
              <div className="flex flex-col gap-2">
                {todayEvents.map(e => (
                  <EventRow key={e.id} event={e} color="#dc2626" dim />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function EventRow({ event, color, dim = false }) {
  return (
    <div className={`flex gap-2.5 p-2.5 rounded-[8px] ${dim ? 'bg-[var(--crimson-dim)]' : 'bg-surface2'}`}>
      <div
        className="w-1 rounded-full flex-shrink-0 mt-0.5"
        style={{ background: color, minHeight: 20 }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate">{event.summary || '(No title)'}</div>
        <div className="text-[11px] text-[var(--text-3)] mt-0.5">{formatEventTime(event)}</div>
        {event.location && (
          <div className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">📍 {event.location}</div>
        )}
        {event.description && (
          <div className="text-[10px] text-[var(--text-3)] mt-0.5 line-clamp-1">{event.description}</div>
        )}
      </div>
    </div>
  )
}
