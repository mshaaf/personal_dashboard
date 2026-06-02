import { useState, useEffect, useRef } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, StatBox, Empty, Pill, Spinner } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Activity, Footprints, Bike, Waves, RefreshCw, Link2Off } from 'lucide-react'
import { format, startOfWeek, subWeeks } from 'date-fns'

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
const M_PER_MI = 1609.34

// ——— unit helpers (Strava stores metric; we display imperial) ———
const toMiles = m => (m || 0) / M_PER_MI
const fmtMiles = m => toMiles(m).toFixed(2)
function fmtPace(speedMps) {
  if (!speedMps || speedMps <= 0) return '—'
  const secPerMi = M_PER_MI / speedMps
  const min = Math.floor(secPerMi / 60)
  const sec = Math.round(secPerMi % 60)
  return `${min}:${String(sec).padStart(2, '0')}/mi`
}
function fmtDuration(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`
}
function sportIcon(sport) {
  const s = (sport || '').toLowerCase()
  if (s.includes('run') || s.includes('walk') || s.includes('hike')) return Footprints
  if (s.includes('ride') || s.includes('bike') || s.includes('cycl')) return Bike
  if (s.includes('swim')) return Waves
  return Activity
}

export default function Activities() {
  const { now } = useToday()
  const [account, setAccount] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [banner, setBanner] = useState(null) // { type, text }
  const syncedOnce = useRef(false)

  useEffect(() => { init() }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [acctRes, actRes] = await Promise.all([
      supabase.from('strava_accounts').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('strava_activities').select('*').eq('user_id', user.id)
        .order('start_date', { ascending: false }).limit(100),
    ])
    setAccount(acctRes.data || null)
    setActivities(actRes.data || [])
    setLoading(false)

    // Surface the OAuth return status, then clean the URL.
    const params = new URLSearchParams(window.location.search)
    const status = params.get('strava')
    if (status) {
      if (status === 'connected') setBanner({ type: 'ok', text: 'Strava connected.' })
      else if (status === 'denied') setBanner({ type: 'err', text: 'Authorization was denied.' })
      else setBanner({ type: 'err', text: 'Something went wrong connecting Strava.' })
      window.history.replaceState({}, '', '/activities')
    }

    // Auto-sync once per visit when connected.
    if (acctRes.data && !syncedOnce.current) {
      syncedOnce.current = true
      sync()
    }
  }

  function connect() {
    if (!STRAVA_CLIENT_ID) {
      setBanner({ type: 'err', text: 'VITE_STRAVA_CLIENT_ID is not set.' })
      return
    }
    getToken().then(token => {
      if (!token) { setBanner({ type: 'err', text: 'Please sign in again.' }); return }
      const redirect = `${window.location.origin}/api/strava/callback`
      const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}`
        + `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}`
        + `&approval_prompt=auto&scope=activity:read_all&state=${encodeURIComponent(token)}`
      window.location.href = url
    })
  }

  async function sync() {
    setSyncing(true)
    try {
      const token = await getToken()
      const resp = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setBanner({ type: 'err', text: body.error || 'Sync failed.' })
      } else {
        if (body.synced > 0) setBanner({ type: 'ok', text: `Synced ${body.synced} new activit${body.synced === 1 ? 'y' : 'ies'}.` })
        const { data: { user } } = await supabase.auth.getUser()
        const [acctRes, actRes] = await Promise.all([
          supabase.from('strava_accounts').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('strava_activities').select('*').eq('user_id', user.id)
            .order('start_date', { ascending: false }).limit(100),
        ])
        setAccount(acctRes.data || null)
        setActivities(actRes.data || [])
      }
    } catch {
      setBanner({ type: 'err', text: 'Sync failed — is the app deployed with the Strava functions?' })
    }
    setSyncing(false)
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Strava and remove synced activities?')) return
    const token = await getToken()
    await fetch('/api/strava/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    setAccount(null)
    setActivities([])
    setBanner({ type: 'ok', text: 'Strava disconnected.' })
  }

  // ——— derived stats ———
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeek = activities.filter(a => a.start_date && new Date(a.start_date) >= weekStart)
  const weekMiles = thisWeek.reduce((s, a) => s + toMiles(a.distance_m), 0)
  const weekTime = thisWeek.reduce((s, a) => s + (a.moving_time_s || 0), 0)
  const longest = activities.reduce((mx, a) => Math.max(mx, toMiles(a.distance_m)), 0)

  // Weekly mileage for the last 10 weeks (Mon buckets).
  const chartData = []
  for (let i = 9; i >= 0; i--) {
    const ws = subWeeks(weekStart, i)
    const we = subWeeks(weekStart, i - 1)
    const miles = activities
      .filter(a => a.start_date && new Date(a.start_date) >= ws && new Date(a.start_date) < we)
      .reduce((s, a) => s + toMiles(a.distance_m), 0)
    chartData.push({ label: format(ws, 'M/d'), miles: +miles.toFixed(1) })
  }
  const hasMiles = chartData.some(d => d.miles > 0)

  return (
    <div className="p-4 md:p-7 animate-in">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Activities</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">
            {account ? `Connected as ${account.athlete_name || 'Strava athlete'}` : 'Runs, rides & swims from Strava'}
          </p>
        </div>
        {account && (
          <div className="flex gap-2">
            <Btn variant="ghost" size="sm" onClick={sync} disabled={syncing}>
              {syncing ? <Spinner size={12} /> : <RefreshCw size={12} />} {syncing ? 'Syncing…' : 'Sync'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={disconnect}>
              <Link2Off size={12} /> Disconnect
            </Btn>
          </div>
        )}
      </div>

      {banner && (
        <div className={`mb-4 text-[12px] px-3.5 py-2.5 rounded-[8px] border ${banner.type === 'ok'
          ? 'bg-[var(--green-dim)] text-success border-transparent'
          : 'bg-[var(--crimson-dim)] text-crimson border-transparent'}`}>
          {banner.text}
        </div>
      )}

      {loading ? (
        <Card><Empty icon={Activity} title="Loading…" /></Card>
      ) : !account ? (
        <Card>
          <Empty
            icon={Activity}
            title="Connect Strava"
            sub="Pull your runs, rides and swims in automatically."
            action={
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#fc5200' }}
              >
                <Activity size={15} /> Connect with Strava
              </button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatBox label="This week" value={`${weekMiles.toFixed(1)} mi`} color={weekMiles > 0 ? 'white' : ''} />
            <StatBox label="Activities (wk)" value={thisWeek.length} />
            <StatBox label="Moving (wk)" value={fmtDuration(weekTime)} />
            <StatBox label="Longest" value={`${longest.toFixed(1)} mi`} />
          </div>

          {/* Weekly mileage chart */}
          {hasMiles && (
            <Card className="mb-4">
              <Label>Weekly Mileage · Last 10 Weeks</Label>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [`${v} mi`, 'Distance']}
                      cursor={{ fill: 'rgba(252,82,0,0.08)' }}
                    />
                    <Bar dataKey="miles" fill="#fc5200" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Activity feed */}
          <Card>
            <Label>Recent Activities</Label>
            {activities.length === 0 && (
              <Empty icon={Activity} title="No activities yet" sub="Hit Sync to pull from Strava" />
            )}
            {activities.map(a => {
              const Icon = sportIcon(a.sport_type)
              const isRun = (a.sport_type || '').toLowerCase().includes('run')
              return (
                <div key={a.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <div className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(252,82,0,0.12)' }}>
                    <Icon size={17} style={{ color: '#fc5200' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{a.name || a.sport_type || 'Activity'}</div>
                    <div className="text-[11px] text-[var(--text-3)] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span>{a.start_date ? format(new Date(a.start_date), 'EEE MMM d') : ''}</span>
                      {a.distance_m > 0 && <span>· {fmtMiles(a.distance_m)} mi</span>}
                      <span>· {fmtDuration(a.moving_time_s)}</span>
                      {isRun && a.average_speed > 0 && <span>· {fmtPace(a.average_speed)}</span>}
                      {a.total_elevation_gain_m > 0 && <span>· {Math.round(a.total_elevation_gain_m * 3.281)} ft</span>}
                      {a.average_heartrate > 0 && <span>· {Math.round(a.average_heartrate)} bpm</span>}
                    </div>
                  </div>
                  <Pill color="muted">{a.sport_type || '—'}</Pill>
                </div>
              )
            })}
          </Card>

          <div className="text-[10px] text-[var(--text-3)] mt-3 text-center">Powered by Strava</div>
        </>
      )}
    </div>
  )
}
