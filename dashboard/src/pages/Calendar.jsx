import { useState, useEffect, useCallback } from 'react'
import { useToday } from '../hooks/useToday'
import { loadGapi, initTokenClient, requestToken, revokeToken, isSignedIn, fetchMonth, fetchUpcoming, formatEventTime } from '../lib/googleCalendar'
import { Card, Label, Btn, Empty } from '../components/ui'
import { Calendar, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

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

  useEffect(() => {
    if (!CLIENT_ID) return
    // Wait for gapi + gsi to load
    const check = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(check)
        loadGapi().then(() => {
          initTokenClient((token) => {
            setSignedIn(true)
            loadEvents()
          })
          setGapiReady(true)
          setSignedIn(isSignedIn())
        })
      }
    }, 300)
    return () => clearInterval(check)
  }, [CLIENT_ID])

  async function signIn() {
    if (!gapiReady) return
    requestToken()
  }

  async function signOut() {
    revokeToken()
    setSignedIn(false)
    setEvents([])
  }

  async function loadEvents() {
    setLoading(true)
    try {
      const monthEvents = await fetchMonth(viewMonth.getFullYear(), viewMonth.getMonth())
      setEvents(monthEvents)
      setError(null)
    } catch (e) {
      setError('Failed to load calendar events')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (signedIn) loadEvents()
  }, [viewMonth, signedIn])

  // Calendar grid
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad start to Monday
  const startPad = (monthStart.getDay() + 6) % 7 // Mon=0
  const paddedDays = [...Array(startPad).fill(null), ...calDays]
  while (paddedDays.length % 7 !== 0) paddedDays.push(null)

  const dayEvents = (day) => {
    if (!day) return []
    return events.filter(e => {
      const start = e.start.date ? new Date(e.start.date + 'T00:00:00') : new Date(e.start.dateTime)
      return isSameDay(start, day)
    })
  }

  const selectedEvents = dayEvents(selectedDay)
  const upcomingToday = events.filter(e => {
    const start = e.start.date ? new Date(e.start.date + 'T00:00:00') : new Date(e.start.dateTime)
    return isToday(start)
  })

  // Assign colors to calendars
  const calendarColors = {}
  events.forEach(e => {
    const cal = e.organizer?.email || 'primary'
    if (!calendarColors[cal]) {
      calendarColors[cal] = EVENT_COLORS[Object.keys(calendarColors).length % EVENT_COLORS.length]
    }
  })

  function eventColor(event) {
    const cal = event.organizer?.email || 'primary'
    return calendarColors[cal] || EVENT_COLORS[0]
  }

  if (!CLIENT_ID) {
    return (
      <div className="p-7 animate-in">
        <div className="mb-6">
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Calendar</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Google Calendar integration</p>
        </div>
        <Card>
          <Empty
            icon={Calendar}
            title="Google Calendar not configured"
            sub="Add VITE_GOOGLE_CLIENT_ID to your .env file to enable calendar sync"
            action={
              <div className="text-[12px] text-[var(--text-3)] text-left bg-surface2 rounded-[8px] p-3 font-mono mt-2">
                <div className="mb-1">1. Go to console.cloud.google.com</div>
                <div className="mb-1">2. Create OAuth 2.0 Client ID (Web)</div>
                <div className="mb-1">3. Add your domain to authorized origins</div>
                <div>4. Add to .env: VITE_GOOGLE_CLIENT_ID=your_client_id</div>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-7 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Calendar</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Google Calendar</p>
        </div>
        {!signedIn ? (
          <Btn onClick={signIn} disabled={!gapiReady}>
            <LogIn size={13} /> Connect Google Calendar
          </Btn>
        ) : (
          <Btn variant="ghost" size="sm" onClick={signOut}>
            <LogOut size={12} /> Disconnect
          </Btn>
        )}
      </div>

      {!signedIn ? (
        <Card>
          <Empty
            icon={Calendar}
            title="Connect your Google Calendar"
            sub="Sign in with Google to see your events"
            action={<Btn onClick={signIn} disabled={!gapiReady}><LogIn size={13} /> Sign in with Google</Btn>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-[1fr_280px] gap-4">
          {/* Calendar grid */}
          <div>
            {/* Month nav */}
            <Card className="mb-3">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setViewMonth(m => subMonths(m, 1))} className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div className="text-[15px] font-bold">{format(viewMonth, 'MMMM yyyy')}</div>
                <button onClick={() => setViewMonth(m => addMonths(m, 1))} className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold tracking-wider uppercase text-[var(--text-3)] pb-2">{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-0.5">
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} />
                  const evts = dayEvents(day)
                  const selected = isSameDay(day, selectedDay)
                  const today = isToday(day)
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`relative flex flex-col items-center py-1.5 rounded-[8px] transition-all min-h-[52px]
                        ${selected ? 'bg-crimson text-white' : today ? 'bg-[var(--crimson-dim)] text-crimson' : 'hover:bg-surface2 text-[var(--text)]'}
                        ${!isSameMonth(day, viewMonth) ? 'opacity-30' : ''}`}
                    >
                      <span className={`text-[12px] font-semibold leading-none ${selected ? 'text-white' : ''}`}>{format(day, 'd')}</span>
                      {/* Event dots */}
                      {evts.length > 0 && (
                        <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center px-1">
                          {evts.slice(0, 3).map((e, j) => (
                            <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: selected ? 'white' : eventColor(e) }} />
                          ))}
                          {evts.length > 3 && <div className={`text-[8px] ${selected ? 'text-white' : 'text-[var(--text-3)]'}`}>+{evts.length - 3}</div>}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {loading && <div className="text-center text-[11px] text-[var(--text-3)] mt-3">Loading events...</div>}
              {error && <div className="text-center text-[11px] text-crimson mt-3">{error}</div>}
            </Card>
          </div>

          {/* Right panel: selected day + today */}
          <div className="flex flex-col gap-3">
            {/* Selected day events */}
            <Card>
              <Label>{format(selectedDay, 'EEEE, MMM d')}</Label>
              {selectedEvents.length === 0 ? (
                <div className="text-[12px] text-[var(--text-3)] py-3 text-center">No events</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedEvents.map(e => (
                    <div key={e.id} className="flex gap-2.5 p-2.5 bg-surface2 rounded-[8px]">
                      <div className="w-1 rounded-full flex-shrink-0 mt-0.5" style={{ background: eventColor(e), minHeight: 20 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">{e.summary || '(No title)'}</div>
                        <div className="text-[11px] text-[var(--text-3)] mt-0.5">{formatEventTime(e)}</div>
                        {e.location && <div className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">📍 {e.location}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Today's events */}
            {!isToday(selectedDay) && upcomingToday.length > 0 && (
              <Card>
                <Label>Today</Label>
                <div className="flex flex-col gap-2">
                  {upcomingToday.map(e => (
                    <div key={e.id} className="flex gap-2.5 p-2.5 bg-[var(--crimson-dim)] rounded-[8px]">
                      <div className="w-1 rounded-full flex-shrink-0" style={{ background: '#dc2626', minHeight: 20 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">{e.summary || '(No title)'}</div>
                        <div className="text-[11px] text-[var(--text-3)] mt-0.5">{formatEventTime(e)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
