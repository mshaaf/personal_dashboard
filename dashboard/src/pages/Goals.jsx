import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Select, Bar, Pill, Checkbox, Empty, Divider } from '../components/ui'
import { Target, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { format, differenceInDays, differenceInWeeks } from 'date-fns'

export default function Goals() {
  const { now } = useToday()
  const [sprint, setSprint] = useState(null)
  const [projects, setProjects] = useState([])
  const [expanded, setExpanded] = useState({})
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [uid, setUid] = useState(null)
  const [err, setErr] = useState(null)
  const today = format(now, 'yyyy-MM-dd')

  useEffect(() => { init() }, [today])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const { data: sprintData } = await supabase.from('sprints').select('*').eq('user_id', user.id).eq('active', true).maybeSingle()
    setSprint(sprintData)
    if (sprintData) await loadProjects(user.id, sprintData.id)
  }

  async function loadProjects(userId, sprintId) {
    const { data } = await supabase.from('goal_projects')
      .select(`*, lead_measures(*, lead_measure_logs(log_date, completed)), lag_measures(*, lag_measure_logs(log_date, value))`)
      .eq('sprint_id', sprintId).order('created_at')
    setProjects(data || [])
  }

  async function createSprint() {
    if (!form.name) { setErr('Give your sprint a name.'); return }
    // Resolve the user id directly so a not-yet-loaded `uid` state can't silently block the insert
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Still loading your account — please try again in a moment.'); return }
    // Dates default to today → +12 weeks if the user didn't touch the (pre-filled) inputs
    const start_date = form.start_date || today
    const end = new Date(now); end.setDate(end.getDate() + 83)
    const end_date = form.end_date || format(end, 'yyyy-MM-dd')

    await supabase.from('sprints').update({ active: false }).eq('user_id', user.id)
    const { data, error } = await supabase.from('sprints').insert({
      user_id: user.id, name: form.name, start_date, end_date, active: true,
    }).select().single()
    if (error) { console.error('createSprint failed:', error); setErr('Could not start sprint: ' + error.message); return }
    setErr(null)
    setUid(user.id)
    setSprint(data)
    setModal(null); setForm({})
    await loadProjects(user.id, data.id)
  }

  async function addProject() {
    if (!form.name || !sprint) return
    await supabase.from('goal_projects').insert({ user_id: uid, sprint_id: sprint.id, name: form.name, description: form.desc || null })
    setModal(null); setForm({})
    await loadProjects(uid, sprint.id)
  }

  async function addLeadMeasure(projectId) {
    if (!form.lead_name) return
    await supabase.from('lead_measures').insert({
      goal_project_id: projectId, name: form.lead_name,
      cadence: form.cadence || 'daily', target_per_period: form.target ? +form.target : 1, active: true,
    })
    setForm(p => ({ ...p, lead_name: '', cadence: 'daily', target: '' }))
    await loadProjects(uid, sprint.id)
  }

  async function addLagMeasure(projectId) {
    if (!form.lag_name) return
    await supabase.from('lag_measures').insert({
      goal_project_id: projectId, name: form.lag_name,
      target_value: form.lag_target ? +form.lag_target : null,
      unit: form.lag_unit || null, is_boolean: form.lag_bool === 'true',
    })
    setForm(p => ({ ...p, lag_name: '', lag_target: '', lag_unit: '', lag_bool: '' }))
    await loadProjects(uid, sprint.id)
  }

  async function toggleLead(leadId, done) {
    if (done) {
      await supabase.from('lead_measure_logs').delete().eq('lead_measure_id', leadId).eq('log_date', today)
    } else {
      await supabase.from('lead_measure_logs').upsert({ lead_measure_id: leadId, log_date: today, completed: true })
    }
    await loadProjects(uid, sprint.id)
  }

  async function updateLag(lagId, value) {
    await supabase.from('lag_measure_logs').upsert({ lag_measure_id: lagId, log_date: today, value: +value })
    await loadProjects(uid, sprint.id)
  }

  // Sprint progress
  const sprintWeek = sprint ? differenceInWeeks(now, new Date(sprint.start_date)) + 1 : 0
  const sprintDaysLeft = sprint ? differenceInDays(new Date(sprint.end_date), now) : 0
  const sprintPct = sprint ? Math.min(100, (differenceInDays(now, new Date(sprint.start_date)) / 84) * 100) : 0

  // Weekly scorecard (last 8 weeks)
  function getWeeklyScores(project) {
    const scores = []
    for (let w = 1; w <= Math.min(sprintWeek, 12); w++) {
      const weekStart = new Date(sprint.start_date)
      weekStart.setDate(weekStart.getDate() + (w - 1) * 7)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
      const ws = format(weekStart, 'yyyy-MM-dd')
      const we = format(weekEnd, 'yyyy-MM-dd')

      let scheduled = 0, completed = 0
      project.lead_measures?.forEach(lm => {
        if (lm.cadence === 'daily') { scheduled += 7; completed += (lm.lead_measure_logs || []).filter(l => l.log_date >= ws && l.log_date <= we && l.completed).length }
        if (lm.cadence === 'weekly') { scheduled += 1; completed += (lm.lead_measure_logs || []).some(l => l.log_date >= ws && l.log_date <= we && l.completed) ? 1 : 0 }
      })
      scores.push({ week: w, pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : null, current: w === sprintWeek })
    }
    return scores
  }

  if (!sprint) {
    return (
      <div className="p-7 animate-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.03em]">12 Week Year</h1>
            <p className="text-[13px] text-[var(--text-2)] mt-0.5">Set up your sprint to begin</p>
          </div>
          <Btn onClick={() => { setErr(null); setModal('sprint') }}><Plus size={13} /> New Sprint</Btn>
        </div>
        <Card><Empty icon={Target} title="No active sprint" sub="A sprint is a 12-week focused period with specific goals" action={<Btn onClick={() => { setErr(null); setModal('sprint') }}>Start Sprint</Btn>} /></Card>
        <SprintModal open={modal === 'sprint'} form={form} setForm={setForm} err={err} onClose={() => setModal(null)} onSave={createSprint} />
      </div>
    )
  }

  return (
    <div className="p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">12 Week Year</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Sprint · Week {sprintWeek} of 12</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={() => { setErr(null); setForm({}); setModal('sprint') }}>New Sprint</Btn>
          <Btn size="sm" onClick={() => { setForm({}); setModal('project') }}><Plus size={12} /> Add Goal</Btn>
        </div>
      </div>

      {/* Sprint overview */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[16px] font-bold">{sprint.name}</div>
          <div className="font-mono text-[11px] text-[var(--text-3)]">{sprint.start_date} → {sprint.end_date}</div>
        </div>
        <Bar value={sprintPct} max={100} height={6} className="mb-1.5" />
        <div className="flex justify-between text-[10px] text-[var(--text-3)]">
          <span>Week {sprintWeek} / 12</span>
          <span>{sprintDaysLeft} days remaining</span>
        </div>
      </Card>

      {/* Projects */}
      {projects.length === 0 && (
        <Card><Empty icon={Target} title="No goals added" sub="Add your 12-week goals below" action={<Btn onClick={() => setModal('project')}>+ Add Goal</Btn>} /></Card>
      )}

      {projects.map(proj => {
        const isOpen = expanded[proj.id] !== false
        const weekScores = getWeeklyScores(proj)
        const thisWeekScore = weekScores.find(w => w.current)?.pct

        return (
          <Card key={proj.id} className="mb-3">
            {/* Project header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="text-[15px] font-bold">🎯 {proj.name}</div>
                {thisWeekScore !== null && thisWeekScore !== undefined && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${thisWeekScore >= 85 ? 'bg-[var(--green-dim)] text-success' : thisWeekScore >= 70 ? 'bg-[var(--yellow-dim)] text-warn' : 'bg-[var(--crimson-dim)] text-crimson'}`}>
                    {thisWeekScore}% this week
                  </span>
                )}
              </div>
              <button onClick={() => setExpanded(p => ({ ...p, [proj.id]: !isOpen }))} className="text-[var(--text-3)] hover:text-[var(--text)]">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {isOpen && (
              <>
                {/* Weekly scorecard */}
                {weekScores.length > 0 && (
                  <div className="mb-4">
                    <Label className="mb-1.5">Weekly Lead % — Target ≥ 85%</Label>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => {
                        const ws = weekScores[i]
                        const color = !ws ? 'bg-border' : ws.pct >= 85 ? 'bg-success' : ws.pct >= 70 ? 'bg-warn' : 'bg-crimson'
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className={`w-full h-7 rounded-[4px] ${ws?.current ? 'ring-1 ring-crimson' : ''} overflow-hidden ${!ws ? 'bg-border opacity-25' : 'bg-border'}`}>
                              {ws && <div className={`h-full ${color} opacity-80`} style={{ height: `${ws.pct || 0}%` }} />}
                            </div>
                            <div className={`text-[8px] ${ws?.current ? 'text-crimson font-bold' : 'text-[var(--text-3)]'}`}>W{i + 1}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Divider className="mb-3" />

                {/* Lead measures */}
                <div className="mb-3">
                  <Label>Lead Measures (Actions)</Label>
                  {(proj.lead_measures || []).map(lm => {
                    const doneTodayOrThisWeek = (lm.lead_measure_logs || []).some(l => l.log_date === today && l.completed)
                    const weekCount = (lm.lead_measure_logs || []).filter(l => {
                      const d = new Date(l.log_date)
                      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
                      return d >= weekAgo && l.completed
                    }).length
                    return (
                      <div key={lm.id} className="flex items-center gap-2.5 p-2.5 bg-surface2 rounded-[8px] mb-1.5">
                        <Checkbox checked={doneTodayOrThisWeek} onChange={() => toggleLead(lm.id, doneTodayOrThisWeek)} size={16} />
                        <span className="text-[13px] flex-1">{lm.name}</span>
                        <span className="text-[10px] text-[var(--text-3)]">{lm.cadence}</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="font-mono text-[10px] text-[var(--text-3)]">{weekCount}/{lm.target_per_period * (lm.cadence === 'daily' ? 7 : 1)}</span>
                          <div className="w-12 bg-border rounded-full" style={{ height: 3 }}>
                            <div className="bg-crimson rounded-full" style={{ height: 3, width: `${Math.min(100, (weekCount / (lm.target_per_period * (lm.cadence === 'daily' ? 7 : 1))) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Add lead measure inline */}
                  <div className="flex gap-2 mt-2">
                    <input value={form[`lead_${proj.id}`] || ''} onChange={e => setForm(p => ({ ...p, [`lead_${proj.id}`]: e.target.value }))}
                      placeholder="+ Add lead measure"
                      className="flex-1 px-3 py-1.5 text-[12px] bg-surface2 border border-dashed border-border rounded-[8px] focus:border-crimson outline-none text-[var(--text)]"
                    />
                    <select className="px-2 py-1.5 text-[11px] bg-surface2 border border-border rounded-[8px] text-[var(--text-2)] focus:border-crimson outline-none"
                      value={form[`cad_${proj.id}`] || 'daily'} onChange={e => setForm(p => ({ ...p, [`cad_${proj.id}`]: e.target.value }))}>
                      <option value="daily">daily</option><option value="weekly">weekly</option>
                    </select>
                    <button onClick={() => {
                      if (!form[`lead_${proj.id}`]) return
                      addLeadMeasure(proj.id).then(() => setForm(p => ({ ...p, [`lead_${proj.id}`]: '', [`cad_${proj.id}`]: 'daily' })))
                      setForm(p => ({ ...p, lead_name: form[`lead_${proj.id}`], cadence: form[`cad_${proj.id}`] || 'daily' }))
                    }} className="px-3 py-1.5 bg-crimson text-white text-[12px] font-semibold rounded-[8px] hover:bg-crimson-h transition-colors">Add</button>
                  </div>
                </div>

                <Divider className="mb-3" />

                {/* Lag measures */}
                <div>
                  <Label>Lag Measures (Outcomes)</Label>
                  {(proj.lag_measures || []).map(lm => {
                    const lastLog = [...(lm.lag_measure_logs || [])].sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
                    return (
                      <div key={lm.id} className="flex items-center justify-between p-3 bg-[var(--crimson-dim)] border border-[rgba(220,38,38,0.15)] rounded-[8px] mb-1.5">
                        <div>
                          <div className="text-[13px] font-medium">{lm.name}</div>
                          {lm.target_value && <div className="text-[11px] text-[var(--text-3)]">Target: {lm.target_value} {lm.unit || ''}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {lm.is_boolean ? (
                            <button onClick={() => updateLag(lm.id, lastLog?.value ? 0 : 1)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-[6px] ${lastLog?.value ? 'bg-success text-white' : 'bg-border text-[var(--text-3)]'}`}>
                              {lastLog?.value ? '✓ Done' : 'Mark done'}
                            </button>
                          ) : (
                            <input
                              defaultValue={lastLog?.value || ''}
                              onBlur={e => e.target.value && updateLag(lm.id, e.target.value)}
                              className="w-20 px-2 py-1 text-[12px] font-mono bg-surface border border-border rounded-[6px] focus:border-crimson outline-none text-crimson font-bold text-right"
                              placeholder="—"
                            />
                          )}
                          <span className="text-[10px] text-[var(--text-3)]">{lm.unit || ''}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-2 mt-2">
                    <input value={form[`lag_${proj.id}`] || ''} onChange={e => setForm(p => ({ ...p, [`lag_${proj.id}`]: e.target.value }))}
                      placeholder="+ Add outcome measure"
                      className="flex-1 px-3 py-1.5 text-[12px] bg-surface2 border border-dashed border-border rounded-[8px] focus:border-crimson outline-none text-[var(--text)]"
                    />
                    <input value={form[`lagtarget_${proj.id}`] || ''} onChange={e => setForm(p => ({ ...p, [`lagtarget_${proj.id}`]: e.target.value }))}
                      placeholder="target" className="w-20 px-2 py-1.5 text-[12px] bg-surface2 border border-border rounded-[8px] focus:border-crimson outline-none text-[var(--text)]"
                    />
                    <button onClick={() => {
                      if (!form[`lag_${proj.id}`]) return
                      setForm(p => ({ ...p, lag_name: form[`lag_${proj.id}`], lag_target: form[`lagtarget_${proj.id}`] }))
                      addLagMeasure(proj.id)
                      setForm(p => ({ ...p, [`lag_${proj.id}`]: '', [`lagtarget_${proj.id}`]: '' }))
                    }} className="px-3 py-1.5 bg-surface2 border border-border text-[12px] font-semibold rounded-[8px] hover:border-border-light transition-colors">Add</button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )
      })}

      {/* Modals */}
      <SprintModal open={modal === 'sprint'} form={form} setForm={setForm} err={err} onClose={() => setModal(null)} onSave={createSprint} />

      <Modal open={modal === 'project'} onClose={() => setModal(null)} title="Add Goal">
        <div className="flex flex-col gap-3">
          <Input label="Goal name" placeholder="Get CCNA Certified" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Description (optional)" placeholder="Pass the exam by week 10" value={form.desc || ''} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
          <Btn size="full" onClick={addProject}>Add Goal</Btn>
        </div>
      </Modal>
    </div>
  )
}

function SprintModal({ open, form, setForm, err, onClose, onSave }) {
  const now = new Date()
  const end = new Date(now); end.setDate(end.getDate() + 83)
  return (
    <Modal open={open} onClose={onClose} title="New 12-Week Sprint">
      <div className="flex flex-col gap-3">
        <Input label="Sprint name" placeholder="Spring Sprint 2026" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="Start date" type="date" value={form.start_date || format(now, 'yyyy-MM-dd')} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
        <Input label="End date" type="date" value={form.end_date || format(end, 'yyyy-MM-dd')} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
        {err && <div className="text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">{err}</div>}
        <Btn size="full" onClick={onSave}>Start Sprint</Btn>
      </div>
    </Modal>
  )
}
