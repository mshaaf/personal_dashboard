import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Select, TabBar, Bar, Empty } from '../components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Trophy, ChevronDown, ChevronUp, Search, Dumbbell, Activity } from 'lucide-react'
import { format } from 'date-fns'

// Default PPL exercises
const SPLIT_EXERCISES = {
  push: ['Incline Dumbbell Press','Bench Press','Weighted Dips','Overhead Shoulder Press','Cable Lateral Raise','Cable Overhead Tricep Extension','Tricep Rope Pushdown'],
  pull: ['Pull-Ups','Lat Pulldown','Dumbbell Row','Archer Rear Delt Cable','Cable Hammer Curl','Reverse Barbell Curl','Dumbbell Kelso Shrug'],
  legs: ['Dumbbell Split Squat','Squat','Sissy Squat','Seated Leg Curl'],
}

const SPLIT_LABELS = { push: 'Push', pull: 'Pull', legs: 'Legs', cardio: 'Cardio' }
const SPLIT_COLORS = {
  push: 'text-crimson bg-[var(--crimson-dim)]',
  pull: 'text-blue-400 bg-blue-400/10',
  legs: 'text-green-400 bg-green-400/10',
  cardio: 'text-yellow-400 bg-yellow-400/10',
}

export default function Gym() {
  const { now } = useToday()
  const [tab, setTab] = useState('workout')
  const [selectedSplit, setSelectedSplit] = useState(null)
  const [session, setSession] = useState(null) // today's session
  const [sets, setSets] = useState({}) // { exerciseName: [{ weight, reps }] }
  const [exercises, setExercises] = useState([]) // DB exercise list
  const [history, setHistory] = useState({}) // { exerciseName: [ {date, topWeight, topReps} ] }
  const [expanded, setExpanded] = useState({})
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [uid, setUid] = useState(null)
  const [err, setErr] = useState(null)
  const today = format(now, 'yyyy-MM-dd')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)

    // Load today's session
    const { data: todaySession } = await supabase.from('workout_sessions')
      .select('*').eq('user_id', user.id).eq('session_date', today).maybeSingle()
    if (todaySession) {
      setSession(todaySession)
      setSelectedSplit(todaySession.split_day)
      await loadSets(todaySession.id)
    }

    // Load exercise DB — two queries to avoid PostgREST .or() + null RLS edge case
    const [globalRes, userRes] = await Promise.all([
      supabase.from('exercises').select('*').is('user_id', null).order('name'),
      supabase.from('exercises').select('*').eq('user_id', user.id).order('name'),
    ])
    const merged = [
      ...(globalRes.data || []),
      ...(userRes.data || []),
    ].sort((a, b) => a.name.localeCompare(b.name))
    setExercises(merged)

    // Load recent history for all exercises
    await loadHistory(user.id)
  }

  async function loadSets(sessionId) {
    const { data } = await supabase.from('workout_sets')
      .select('*, exercises(name)').eq('session_id', sessionId).order('set_number')
    const grouped = {}
    ;(data || []).forEach(s => {
      const name = s.exercises?.name || 'Unknown'
      if (!grouped[name]) grouped[name] = []
      grouped[name].push({ id: s.id, setNum: s.set_number, weight: s.weight || '', reps: s.reps || '' })
    })
    setSets(grouped)
  }

  async function loadHistory(userId) {
    const { data } = await supabase.from('workout_sets')
      .select('*, exercises(name), workout_sessions!inner(session_date,split_day)')
      .eq('workout_sessions.user_id', userId)
      .order('workout_sessions(session_date)', { ascending: false })
      .limit(500)

    const byEx = {}
    ;(data || []).forEach(s => {
      const name = s.exercises?.name
      if (!name) return
      if (!byEx[name]) byEx[name] = {}
      const date = s.workout_sessions?.session_date
      if (!byEx[name][date]) byEx[name][date] = { date, topWeight: 0, topReps: 0 }
      if (+s.weight > byEx[name][date].topWeight) {
        byEx[name][date].topWeight = +s.weight
        byEx[name][date].topReps = +s.reps
      }
    })

    const result = {}
    Object.entries(byEx).forEach(([name, dateMap]) => {
      result[name] = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
    })
    setHistory(result)
  }

  async function selectSplit(split) {
    if (!uid) { setErr('Still loading your account — please try again in a moment.'); return }
    setSelectedSplit(split)
    if (session) {
      await supabase.from('workout_sessions').update({ split_day: split }).eq('id', session.id)
      setSession(s => ({ ...s, split_day: split }))
      return
    }
    // Create new session
    const { data, error } = await supabase.from('workout_sessions').insert({
      user_id: uid, session_date: today, split_day: split,
    }).select().single()
    if (error) { console.error('selectSplit failed:', error); setErr('Could not start workout: ' + error.message); return }
    setErr(null)
    setSession(data)

    // Init sets structure from default exercises
    if (split !== 'cardio') {
      const exNames = SPLIT_EXERCISES[split] || []
      const newSets = {}
      exNames.forEach(name => { newSets[name] = [{ weight: '', reps: '' }] })
      setSets(newSets)
    }
  }

  async function logSet(exerciseName, setIdx, field, value) {
    const newSets = { ...sets }
    newSets[exerciseName] = [...(newSets[exerciseName] || [])]
    newSets[exerciseName][setIdx] = { ...newSets[exerciseName][setIdx], [field]: value }
    setSets(newSets)
  }

  async function saveSet(exerciseName, setIdx) {
    if (!session) return
    const setData = sets[exerciseName]?.[setIdx]
    if (!setData?.weight || !setData?.reps) return

    // Get exercise ID (prefer global/own match, then create a custom one owned by the user)
    let { data: ex } = await supabase.from('exercises').select('id')
      .eq('name', exerciseName)
      .or(`user_id.is.null,user_id.eq.${uid}`)
      .limit(1).maybeSingle()
    if (!ex) {
      const { data: newEx, error: exErr } = await supabase.from('exercises')
        .insert({ name: exerciseName, source: 'custom', user_id: uid })
        .select().single()
      if (exErr) { console.error('create exercise failed:', exErr); setErr('Could not save exercise: ' + exErr.message); return }
      ex = newEx
    }

    const { error } = await supabase.from('workout_sets').upsert({
      session_id: session.id, exercise_id: ex.id,
      set_number: setIdx + 1, weight: +setData.weight, reps: +setData.reps,
    })
    if (error) { console.error('saveSet failed:', error); setErr('Could not save set: ' + error.message) }
  }

  async function addSet(exerciseName) {
    setSets(prev => ({
      ...prev,
      [exerciseName]: [...(prev[exerciseName] || []), { weight: '', reps: '' }],
    }))
  }

  async function addExercise() {
    const name = form.exerciseName?.trim()
    if (!name || !session) return
    setSets(prev => ({ ...prev, [name]: [{ weight: '', reps: '' }] }))
    setModal(null)
    setForm({})
  }

  async function saveCardio() {
    if (!form.cardio_type || !form.duration) return
    if (!uid) { setErr('Still loading your account — please try again in a moment.'); return }
    const { error } = await supabase.from('cardio_sessions').insert({
      user_id: uid, session_date: form.date || today,
      cardio_type: form.cardio_type, duration_min: +form.duration,
      distance: form.distance ? +form.distance : null,
      avg_hr: form.avg_hr ? +form.avg_hr : null,
      calories: form.calories ? +form.calories : null,
      notes: form.notes || null,
    })
    if (error) { console.error('saveCardio failed:', error); setErr('Could not save cardio: ' + error.message); return }
    setErr(null)
    setModal(null)
    setForm({})
  }

  async function completeWorkout() {
    if (!session) return
    await supabase.from('workout_sessions').update({ completed_at: new Date().toISOString() }).eq('id', session.id)
    setSession(s => ({ ...s, completed_at: new Date().toISOString() }))
    // Save all pending sets
    for (const [exName, exSets] of Object.entries(sets)) {
      for (let i = 0; i < exSets.length; i++) {
        await saveSet(exName, i)
      }
    }
    await loadHistory(uid)
  }

  const currentExercises = selectedSplit && selectedSplit !== 'cardio'
    ? (Object.keys(sets).length ? Object.keys(sets) : SPLIT_EXERCISES[selectedSplit] || [])
    : []

  const filteredDB = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  // Get last session data for "vs last week" display
  function getLastSession(exName) {
    const hist = history[exName]
    if (!hist || hist.length < 2) return null
    const last = hist[hist.length - 2]
    return `${last.topWeight}×${last.topReps}`
  }

  // Check if current top set is a PR
  function isPR(exName) {
    const hist = history[exName]
    const current = sets[exName]
    if (!hist || !current) return false
    const currentMax = Math.max(...current.map(s => +s.weight || 0))
    const allTimeMax = Math.max(...hist.map(h => h.topWeight))
    return currentMax > allTimeMax && currentMax > 0
  }

  const estOneRM = (w, r) => r === 1 ? w : Math.round(w * (1 + r / 30))

  return (
    <div className="p-7 animate-in">
      {err && (
        <div className="mb-4 text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">
          {err}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Gym</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Progressive overload tracker</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={() => { setForm({}); setModal('cardio') }}>
            <Activity size={13} /> Log Cardio
          </Btn>
          {session && !session.completed_at && (
            <Btn size="sm" onClick={completeWorkout}>✓ Complete</Btn>
          )}
          {session?.completed_at && (
            <span className="text-[11px] text-success font-semibold px-2">✓ Completed</span>
          )}
        </div>
      </div>

      {/* Quick Split Selection */}
      <Card className="mb-5">
        <Label>Today's Workout — Quick Select</Label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {['push', 'pull', 'legs', 'cardio'].map(split => (
            <button
              key={split}
              onClick={() => selectSplit(split)}
              className={`py-3 rounded-[10px] text-[13px] font-bold tracking-wide transition-all border
                ${selectedSplit === split
                  ? `${SPLIT_COLORS[split]} border-current`
                  : 'bg-surface2 border-border text-[var(--text-2)] hover:border-border-light hover:text-[var(--text)]'
                }`}
            >
              {SPLIT_LABELS[split]}
            </button>
          ))}
        </div>
        {selectedSplit && selectedSplit !== 'cardio' && (
          <div className="mt-3 text-[11px] text-[var(--text-3)]">
            PPL rotates week-over-week — select which session you're on today
          </div>
        )}
      </Card>

      {/* Workout / History tabs */}
      <TabBar
        tabs={[{ key: 'workout', label: 'Today' }, { key: 'history', label: 'History' }]}
        active={tab}
        onChange={setTab}
      />

      {/* Today tab */}
      {tab === 'workout' && (
        <>
          {!selectedSplit ? (
            <Card>
              <Empty icon={Dumbbell} title="Select a workout above" sub="Push, Pull, Legs, or Cardio" />
            </Card>
          ) : selectedSplit === 'cardio' ? (
            <Card>
              <Empty
                icon={Activity}
                title="Log a cardio session"
                sub="Run, bike, row, walk, swim..."
                action={<Btn onClick={() => { setForm({ date: today }); setModal('cardio') }}>+ Log Cardio</Btn>}
              />
            </Card>
          ) : (
            <>
              {currentExercises.map(exName => {
                const exSets = sets[exName] || [{ weight: '', reps: '' }]
                const lastWk = getLastSession(exName)
                const pr = isPR(exName)
                const isOpen = expanded[exName] !== false
                const hist = history[exName] || []

                return (
                  <Card key={exName} className="mb-3">
                    {/* Exercise header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-[14px] font-bold">{exName}</div>
                          {pr && (
                            <span className="inline-flex items-center gap-1 bg-crimson text-white text-[9px] font-black px-1.5 py-0.5 rounded-[4px] tracking-wider">
                              <Trophy size={9} /> PR
                            </span>
                          )}
                        </div>
                        {lastWk && <div className="text-[11px] text-[var(--text-3)] mt-0.5">Last: {lastWk}</div>}
                      </div>
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [exName]: !isOpen }))}
                        className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isOpen && (
                      <>
                        {/* Set headers */}
                        <div className="grid grid-cols-[28px_1fr_1fr_80px] gap-2 text-[9px] font-bold tracking-[0.07em] uppercase text-[var(--text-3)] mb-1.5 px-0.5">
                          <span>SET</span><span className="text-center">LBS</span><span className="text-center">REPS</span><span className="text-right">LAST WK</span>
                        </div>

                        {exSets.map((s, i) => (
                          <div key={i} className="grid grid-cols-[28px_1fr_1fr_80px] gap-2 items-center mb-1.5">
                            <span className="font-mono text-[10px] text-[var(--text-3)]">S{i + 1}</span>
                            <input
                              className="px-2 py-1.5 text-[12px] font-mono bg-surface border border-border rounded-[6px] text-[var(--text)] focus:border-crimson outline-none text-center w-full"
                              placeholder="lbs"
                              value={s.weight}
                              onChange={e => logSet(exName, i, 'weight', e.target.value)}
                              onBlur={() => saveSet(exName, i)}
                            />
                            <input
                              className="px-2 py-1.5 text-[12px] font-mono bg-surface border border-border rounded-[6px] text-[var(--text)] focus:border-crimson outline-none text-center w-full"
                              placeholder="reps"
                              value={s.reps}
                              onChange={e => logSet(exName, i, 'reps', e.target.value)}
                              onBlur={() => saveSet(exName, i)}
                            />
                            <div className="font-mono text-[11px] text-[var(--text-3)] text-right">
                              {i === 0 && lastWk ? lastWk : '—'}
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-between items-center mt-2">
                          <button
                            onClick={() => addSet(exName)}
                            className="text-[11px] text-[var(--text-3)] hover:text-crimson transition-colors font-medium"
                          >
                            + Add set
                          </button>
                          {exSets.some(s => s.weight && s.reps) && (
                            <div className="text-[10px] text-[var(--text-3)]">
                              Est 1RM: <span className="text-[var(--text)] font-mono font-semibold">
                                {estOneRM(Math.max(...exSets.map(s => +s.weight || 0)), +exSets[0]?.reps || 1)}lbs
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Mini trend chart */}
                        {hist.length > 1 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-[9px] font-bold tracking-[0.07em] uppercase text-[var(--text-3)] mb-1.5">1RM TREND</div>
                            <div style={{ height: 48 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hist.map(h => ({ date: h.date.slice(5), rm: estOneRM(h.topWeight, h.topReps) }))}>
                                  <Line type="monotone" dataKey="rm" stroke="#dc2626" strokeWidth={1.5} dot={false} />
                                  <XAxis dataKey="date" hide />
                                  <YAxis hide domain={['auto', 'auto']} />
                                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} formatter={v => [`${v}lbs`, '1RM']} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )
              })}

              <Btn variant="ghost" size="sm" onClick={() => setModal('addExercise')} className="mt-1">
                <Search size={12} /> Search & Add Exercise
              </Btn>
            </>
          )}
        </>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <Card>
          <Label>Exercise History</Label>
          {Object.keys(history).length === 0 && (
            <Empty icon={Dumbbell} title="No history yet" sub="Log your first workout to see trends" />
          )}
          {Object.entries(history).map(([name, data]) => (
            <div key={name} className="mb-5">
              <div className="text-[13px] font-semibold mb-1">{name}</div>
              <div className="text-[11px] text-[var(--text-3)] mb-1.5">
                Best: {Math.max(...data.map(d => d.topWeight))}lbs × {data.find(d => d.topWeight === Math.max(...data.map(d => d.topWeight)))?.topReps}
              </div>
              {data.length > 1 && (
                <div style={{ height: 50 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.map(d => ({ date: d.date.slice(5), w: d.topWeight }))}>
                      <Line type="monotone" dataKey="w" stroke="#dc2626" strokeWidth={1.5} dot={{ r: 2, fill: '#dc2626' }} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Add exercise modal */}
      <Modal open={modal === 'addExercise'} onClose={() => setModal(null)} title="Add Exercise">
        <div className="mb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercise database..."
            className="w-full px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] focus:border-crimson outline-none"
          />
        </div>
        <div className="max-h-52 overflow-y-auto mb-3">
          {filteredDB.map(ex => (
            <button
              key={ex.id}
              onClick={() => {
                setSets(prev => ({ ...prev, [ex.name]: [{ weight: '', reps: '' }] }))
                setModal(null)
                setSearch('')
              }}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface2 rounded-[6px] transition-colors border-b border-border last:border-0"
            >
              <div className="font-medium">{ex.name}</div>
              {ex.primary_muscles && <div className="text-[10px] text-[var(--text-3)]">{Array.isArray(ex.primary_muscles) ? ex.primary_muscles.join(', ') : ex.primary_muscles}</div>}
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <Input label="Or add custom exercise" placeholder="Exercise name" value={form.exerciseName || ''} onChange={e => setForm(p => ({ ...p, exerciseName: e.target.value }))} />
          <Btn size="full" className="mt-2" onClick={addExercise}>Add Custom</Btn>
        </div>
      </Modal>

      {/* Cardio modal */}
      <Modal open={modal === 'cardio'} onClose={() => setModal(null)} title="Log Cardio Session">
        <div className="flex flex-col gap-3">
          <Select label="Type" value={form.cardio_type || ''} onChange={e => setForm(p => ({ ...p, cardio_type: e.target.value }))}
            options={['Run','Bike','Row','Incline Walk','Stairs','Swim','HIIT','Other'].map(v => ({ value: v.toLowerCase().replace(' ','_'), label: v }))} />
          <Input label="Duration (min)" type="number" placeholder="30" value={form.duration || ''} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} />
          <Input label="Distance (optional)" placeholder="3.1 mi" value={form.distance || ''} onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} />
          <Input label="Avg HR (optional)" type="number" placeholder="145" value={form.avg_hr || ''} onChange={e => setForm(p => ({ ...p, avg_hr: e.target.value }))} />
          <Input label="Calories (optional)" type="number" placeholder="320" value={form.calories || ''} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} />
          <Input label="Date" type="date" value={form.date || today} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Btn size="full" onClick={saveCardio}>Save Session</Btn>
        </div>
      </Modal>
    </div>
  )
}
