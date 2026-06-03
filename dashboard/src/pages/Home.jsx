import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { DayRing } from '../components/DayRing'
import { Card, Label, Bar, Pill, Checkbox, StreakBadge } from '../components/ui'
import { Dumbbell, Pill as PillIcon, BookOpen, Target, Activity, TrendingDown, TrendingUp, Plus } from 'lucide-react'
import { format, startOfWeek, subWeeks } from 'date-fns'

export default function Home() {
  const { date, now } = useToday()
  const nav = useNavigate()
  const today = format(now, 'yyyy-MM-dd')

  const [finance, setFinance] = useState(null)
  const [tasks, setTasks] = useState([])
  const [suppCount, setSuppCount] = useState({ done: 0, total: 0 })
  const [bevel, setBevel] = useState(null)
  const [sprint, setSprint] = useState(null)
  const [book, setBook] = useState(null)
  const [gymSession, setGymSession] = useState(null)
  const [volume, setVolume] = useState({ thisWeek: 0, lastWeek: 0 })
  const [newTask, setNewTask] = useState('')

  useEffect(() => { loadAll() }, [today])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const uid = user.id

    // Finance: this month
    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
    const [incomeRes, expenseRes, subRes] = await Promise.all([
      supabase.from('income_checks').select('amount').eq('user_id', uid).gte('check_date', monthStart),
      supabase.from('expenses').select('amount').eq('user_id', uid).gte('expense_date', monthStart),
      supabase.from('subscriptions').select('amount').eq('user_id', uid).eq('active', true),
    ])
    const income = (incomeRes.data || []).reduce((s, r) => s + +r.amount, 0)
    const expenses = (expenseRes.data || []).reduce((s, r) => s + +r.amount, 0)
    const subs = (subRes.data || []).reduce((s, r) => s + +r.amount, 0)
    setFinance({ income, expenses, subs, net: income - expenses - subs })

    // Today's daily tasks + lead measures
    const [taskRes, leadRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('user_id', uid).eq('task_date', today),
      supabase.from('lead_measures')
        .select('*, lead_measure_logs!left(log_date)')
        .eq('active', true)
        .eq('cadence', 'daily'),
    ])
    const dailyTasks = (taskRes.data || []).map(t => ({ ...t, source: 'task' }))
    const leadTasks = (leadRes.data || []).map(l => ({
      id: l.id,
      text: l.name,
      done: (l.lead_measure_logs || []).some(lg => lg.log_date === today),
      source: '12WY',
      lead: true,
    }))
    setTasks([...leadTasks, ...dailyTasks])

    // Supplements
    const [suppAll, suppDone] = await Promise.all([
      supabase.from('supplements').select('id').eq('user_id', uid).eq('active', true),
      supabase.from('supplement_logs').select('id').eq('user_id', uid).eq('log_date', today),
    ])
    setSuppCount({ done: (suppDone.data || []).length, total: (suppAll.data || []).length })

    // Bevel today
    const { data: bevelData } = await supabase.from('bevel_daily').select('*').eq('user_id', uid).eq('entry_date', today).maybeSingle()
    setBevel(bevelData)

    // Active sprint
    const { data: sprintData } = await supabase.from('sprints')
      .select('*, goal_projects(id,name,lead_measures(id,lead_measure_logs(log_date)))')
      .eq('user_id', uid).eq('active', true).maybeSingle()
    setSprint(sprintData)

    // Current book
    const { data: bookData } = await supabase.from('books')
      .select('*').eq('user_id', uid).eq('status', 'reading').maybeSingle()
    setBook(bookData)

    // Today's gym session
    const { data: gymData } = await supabase.from('workout_sessions')
      .select('*').eq('user_id', uid).eq('session_date', today).maybeSingle()
    setGymSession(gymData)

    // Weekly training volume (sum of weight×reps) — this week vs last week
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const lastWeekStart = subWeeks(thisWeekStart, 1)
    const thisWeekStartStr = format(thisWeekStart, 'yyyy-MM-dd')
    const { data: volData } = await supabase.from('workout_sets')
      .select('weight,reps,workout_sessions!inner(session_date,user_id)')
      .eq('workout_sessions.user_id', uid)
      .gte('workout_sessions.session_date', format(lastWeekStart, 'yyyy-MM-dd'))
    let thisWeekVol = 0, lastWeekVol = 0
    ;(volData || []).forEach(s => {
      const vol = (+s.weight || 0) * (+s.reps || 0)
      if (s.workout_sessions?.session_date >= thisWeekStartStr) thisWeekVol += vol
      else lastWeekVol += vol
    })
    setVolume({ thisWeek: thisWeekVol, lastWeek: lastWeekVol })
  }

  async function toggleTask(task) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (task.lead) {
      const done = !task.done
      if (done) {
        await supabase.from('lead_measure_logs').upsert({ lead_measure_id: task.id, log_date: today, completed: true })
      } else {
        await supabase.from('lead_measure_logs').delete().eq('lead_measure_id', task.id).eq('log_date', today)
      }
    } else {
      await supabase.from('daily_tasks').update({ done: !task.done }).eq('id', task.id)
    }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
  }

  async function addTask() {
    if (!newTask.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('daily_tasks').insert({
      user_id: user.id, task_date: today, text: newTask.trim(), done: false,
    }).select().single()
    setTasks(prev => [...prev, { ...data, source: 'task' }])
    setNewTask('')
  }

  const done = tasks.filter(t => t.done).length
  const net = finance?.net ?? 0
  const sprintWeek = sprint ? Math.floor((now - new Date(sprint.start_date)) / (7 * 86400000)) + 1 : null
  const sprintPct = sprint ? Math.min(100, (now - new Date(sprint.start_date)) / (new Date(sprint.end_date) - new Date(sprint.start_date)) * 100) : 0

  return (
    <div className="p-4 md:p-7 animate-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-black tracking-[-0.03em]">
          {now.getHours() < 12 ? 'Good morning.' : now.getHours() < 17 ? 'Good afternoon.' : 'Good evening.'}
        </h1>
        <p className="text-[13px] text-[var(--text-2)] mt-0.5">{date}</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Day Ring */}
        <Card className="col-span-2 md:col-span-1">
          <DayRing />
        </Card>

        {/* Finance Pulse */}
        <Card onClick={() => nav('/finance')} className="col-span-2 md:col-span-1 cursor-pointer hover:border-border-light transition-colors">
          <Label>Finance · {format(now, 'MMMM yyyy')}</Label>
          <div className={`font-mono text-[22px] md:text-[28px] font-bold tracking-tight ${net >= 0 ? 'text-success' : 'text-crimson'}`}>
            {net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--text-3)] mt-1 leading-relaxed">
            ${finance?.income?.toFixed(0) ?? '–'} income · ${finance?.expenses?.toFixed(0) ?? '–'} exp · ${finance?.subs?.toFixed(0) ?? '–'}/mo subs
          </div>
          <Bar value={Math.max(0, net)} max={finance?.income || 1} color={net >= 0 ? 'green' : 'crimson'} height={5} className="mt-3" />
          <div className="flex justify-between text-[10px] text-[var(--text-3)] mt-1.5">
            <span>{net >= 0 ? '✓ In the green' : '✕ In the red'}</span>
            <span className={net >= 0 ? 'text-success' : 'text-crimson'}>{net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(0)}</span>
          </div>
        </Card>

        {/* Today's Checklist */}
        <div className="col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="mb-0.5">Today's Checklist</Label>
                <div className="text-[16px] font-bold">
                  {done} <span className="text-[13px] font-normal text-[var(--text-2)]">/ {tasks.length} complete</span>
                </div>
              </div>
              <StreakBadge count={5} />
            </div>
            <Bar value={done} max={tasks.length || 1} height={4} className="mb-3.5" />

            {tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] transition-all ${task.done ? 'opacity-40' : 'hover:bg-surface2'}`}
              >
                <Checkbox checked={task.done} onChange={() => toggleTask(task)} />
                <span className={`text-[13px] flex-1 ${task.done ? 'line-through text-[var(--text-3)]' : ''}`}>{task.text}</span>
                <span className="text-[10px] text-[var(--text-3)] bg-surface2 px-2 py-0.5 rounded-full border border-border font-medium">{task.source}</span>
              </div>
            ))}

            {/* Add task */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add a task for today..."
                className="flex-1 px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] text-[var(--text)] focus:border-crimson outline-none transition-colors"
              />
              <button
                onClick={addTask}
                className="px-4 py-2 bg-surface2 border border-border rounded-[8px] text-[13px] font-semibold hover:border-border-light transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </Card>
        </div>

        {/* Module Tiles */}
        {/* Gym */}
        <Card onClick={() => nav('/gym')} className="cursor-pointer hover:border-[rgba(220,38,38,0.4)] transition-colors">
          <div className="w-9 h-9 bg-[var(--crimson-dim)] rounded-[9px] flex items-center justify-center mb-3">
            <Dumbbell size={17} className="text-crimson" />
          </div>
          <Label>Gym</Label>
          <div className="font-mono text-[20px] font-bold">{gymSession?.split_day?.toUpperCase() ?? '—'}</div>
          <div className="text-[11px] text-[var(--text-2)] mt-0.5">{gymSession ? 'Logged today' : 'Tap to log session'}</div>
        </Card>

        {/* Weekly Training Volume */}
        <Card onClick={() => nav('/gym')} className="cursor-pointer hover:border-[rgba(220,38,38,0.4)] transition-colors">
          <div className="w-9 h-9 bg-[var(--crimson-dim)] rounded-[9px] flex items-center justify-center mb-3">
            <TrendingUp size={17} className="text-crimson" />
          </div>
          <Label>Weight Pushed · This Week</Label>
          <div className="font-mono text-[20px] font-bold">
            {Math.round(volume.thisWeek).toLocaleString()} <span className="text-[12px] font-normal text-[var(--text-2)]">lb</span>
          </div>
          {(() => {
            const { thisWeek, lastWeek } = volume
            if (lastWeek <= 0) {
              return <div className="text-[11px] text-[var(--text-2)] mt-0.5">{thisWeek > 0 ? 'First week of volume' : 'No sets logged yet'}</div>
            }
            const pct = ((thisWeek - lastWeek) / lastWeek) * 100
            const up = pct >= 0
            return (
              <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${up ? 'text-success' : 'text-crimson'}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {up ? '+' : ''}{pct.toFixed(0)}% vs last week
              </div>
            )
          })()}
        </Card>

        {/* Supplements */}
        <Card onClick={() => nav('/supplements')} className="cursor-pointer hover:border-[rgba(220,38,38,0.4)] transition-colors">
          <div className="w-9 h-9 bg-[var(--crimson-dim)] rounded-[9px] flex items-center justify-center mb-3">
            <PillIcon size={17} className="text-crimson" />
          </div>
          <Label>Supplements</Label>
          <div className="font-mono text-[20px] font-bold">
            {suppCount.done} <span className="text-[12px] font-normal text-[var(--text-2)]">/ {suppCount.total}</span>
          </div>
          <div className="text-[11px] text-[var(--text-2)] mt-0.5">Taken today</div>
          <Bar value={suppCount.done} max={suppCount.total || 1} height={3} className="mt-2" />
        </Card>

        {/* Reading */}
        <Card onClick={() => nav('/reading')} className="cursor-pointer hover:border-[rgba(220,38,38,0.4)] transition-colors">
          <div className="w-9 h-9 bg-[var(--crimson-dim)] rounded-[9px] flex items-center justify-center mb-3">
            <BookOpen size={17} className="text-crimson" />
          </div>
          <Label>Reading</Label>
          {book ? (
            <>
              <div className="font-mono text-[16px] font-bold">pg {book.current_page}</div>
              <div className="text-[11px] text-[var(--text-2)] mt-0.5 truncate">{book.title}</div>
              <Bar value={book.current_page} max={book.total_pages || 1} height={3} className="mt-2" />
            </>
          ) : (
            <div className="text-[12px] text-[var(--text-3)]">No book started</div>
          )}
        </Card>

        {/* Sprint */}
        <Card onClick={() => nav('/goals')} className="cursor-pointer hover:border-[rgba(220,38,38,0.4)] transition-colors">
          <div className="w-9 h-9 bg-[var(--crimson-dim)] rounded-[9px] flex items-center justify-center mb-3">
            <Target size={17} className="text-crimson" />
          </div>
          <Label>Sprint</Label>
          {sprint ? (
            <>
              <div className="font-mono text-[20px] font-bold">
                W{sprintWeek}<span className="text-[12px] font-normal text-[var(--text-2)]">/12</span>
              </div>
              <div className="text-[11px] text-[var(--text-2)] mt-0.5">{sprint.name}</div>
              <Bar value={sprintPct} max={100} height={3} className="mt-2" />
            </>
          ) : (
            <div className="text-[12px] text-[var(--text-3)]">No active sprint</div>
          )}
        </Card>

        {/* Bevel */}
        <div className="col-span-2">
          <Card onClick={() => nav('/bevel')} className="cursor-pointer hover:border-border-light transition-colors">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Bevel · Today</Label>
              <Activity size={14} className="text-[var(--text-3)]" />
            </div>
            {bevel ? (
              <div className="grid grid-cols-3 gap-4 mt-3 text-center">
                <div>
                  <div className={`font-mono text-[28px] font-bold ${bevel.sleep_score >= 80 ? 'text-success' : bevel.sleep_score >= 60 ? 'text-warn' : 'text-crimson'}`}>
                    {bevel.sleep_score}
                  </div>
                  <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--text-3)] mt-1">Sleep</div>
                </div>
                <div>
                  <div className={`font-mono text-[28px] font-bold ${bevel.recovery >= 66 ? 'text-success' : bevel.recovery >= 34 ? 'text-warn' : 'text-crimson'}`}>
                    {bevel.recovery}
                  </div>
                  <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--text-3)] mt-1">Recovery</div>
                </div>
                <div>
                  <div className="font-mono text-[28px] font-bold">
                    {bevel.hrv}<span className="text-[14px] font-normal">%</span>
                  </div>
                  <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--text-3)] mt-1">Strain</div>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-[var(--text-3)] mt-2">No entry today — tap to log</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
