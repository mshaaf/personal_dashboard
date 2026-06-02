// ——— SUPPLEMENTS ———
import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Select, Bar, StreakBadge, Empty } from '../components/ui'
import { Pill, Plus } from 'lucide-react'
import { format } from 'date-fns'

export function Supplements() {
  const { now } = useToday()
  const [supps, setSupps] = useState([])
  const [logs, setLogs] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [uid, setUid] = useState(null)
  const today = format(now, 'yyyy-MM-dd')

  useEffect(() => { init() }, [today])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const [suppRes, logRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('user_id', user.id).eq('active', true).order('time_of_day'),
      supabase.from('supplement_logs').select('supplement_id').eq('user_id', user.id).eq('log_date', today),
    ])
    setSupps(suppRes.data || [])
    setLogs((logRes.data || []).map(l => l.supplement_id))
  }

  async function toggle(suppId) {
    const done = logs.includes(suppId)
    if (done) {
      await supabase.from('supplement_logs').delete().eq('supplement_id', suppId).eq('log_date', today)
      setLogs(p => p.filter(id => id !== suppId))
    } else {
      await supabase.from('supplement_logs').upsert({ user_id: uid, supplement_id: suppId, log_date: today })
      setLogs(p => [...p, suppId])
    }
  }

  async function addSupp() {
    if (!form.name) return
    await supabase.from('supplements').insert({
      user_id: uid, name: form.name, dose: form.dose ? +form.dose : null,
      unit: form.unit || null, time_of_day: form.time_of_day || 'am', active: true,
    })
    setModal(false); setForm({})
    await init()
  }

  const TIME_ORDER = ['am', 'midday', 'pm', 'pre-bed']
  const TIME_LABELS = { am: 'Morning', midday: 'Midday', pm: 'Evening', 'pre-bed': 'Pre-Bed' }
  const grouped = TIME_ORDER.reduce((acc, t) => {
    acc[t] = supps.filter(s => s.time_of_day === t)
    return acc
  }, {})

  const done = logs.length
  const total = supps.length

  return (
    <div className="p-4 md:p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Supplements</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Daily stack · resets at midnight</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => { setForm({}); setModal(true) }}>
          <Plus size={12} /> Add Supplement
        </Btn>
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[30px] font-bold">{done} <span className="text-[16px] font-normal text-[var(--text-2)]">/ {total}</span></div>
            <div className="text-[12px] text-[var(--text-2)]">taken today</div>
          </div>
          <StreakBadge count={12} />
        </div>
        <Bar value={done} max={total || 1} height={6} className="mt-4" />
      </Card>

      <Card>
        {supps.length === 0 && <Empty icon={Pill} title="No supplements added" sub="Build your stack" action={<Btn onClick={() => setModal(true)}>+ Add Supplement</Btn>} />}
        {TIME_ORDER.map(t => {
          const group = grouped[t]
          if (!group.length) return null
          return (
            <div key={t} className="mb-5">
              <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--text-3)] mb-2">{TIME_LABELS[t]}</div>
              {group.map(s => {
                const taken = logs.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] mb-1.5 text-left transition-all
                      ${taken ? 'opacity-40 bg-surface2' : 'bg-surface2 hover:bg-border'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all
                      ${taken ? 'bg-crimson border-crimson' : 'border-border-light'}`}>
                      {taken && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className={`text-[13px] flex-1 ${taken ? 'line-through text-[var(--text-3)]' : ''}`}>{s.name}</span>
                    {s.dose && <span className="font-mono text-[11px] text-[var(--text-3)]">{s.dose}{s.unit || ''}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Supplement">
        <div className="flex flex-col gap-3">
          <Input label="Name" placeholder="Creatine Monohydrate" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <div className="flex gap-2">
            <Input label="Dose" type="number" placeholder="5" value={form.dose || ''} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} />
            <Select label="Unit" value={form.unit || ''} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
              options={['mg','g','IU','mcg','ml','scoop'].map(u => ({ value: u, label: u }))} />
          </div>
          <Select label="Time of day" value={form.time_of_day || ''} onChange={e => setForm(p => ({ ...p, time_of_day: e.target.value }))}
            options={TIME_ORDER.map(t => ({ value: t, label: TIME_LABELS[t] }))} />
          <Btn size="full" onClick={addSupp}>Add to Stack</Btn>
        </div>
      </Modal>
    </div>
  )
}

export default Supplements
