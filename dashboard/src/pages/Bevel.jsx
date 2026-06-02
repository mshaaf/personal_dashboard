import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Empty } from '../components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Activity, Plus, Pencil, Trash2 } from 'lucide-react'
import { format, subDays } from 'date-fns'

export default function Bevel() {
  const { now } = useToday()
  const [entries, setEntries] = useState([])
  const [today, setToday] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [uid, setUid] = useState(null)
  const todayStr = format(now, 'yyyy-MM-dd')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const { data } = await supabase.from('bevel_daily').select('*')
      .eq('user_id', user.id).order('entry_date', { ascending: false }).limit(60)
    setEntries(data || [])
    setToday((data || []).find(e => e.entry_date === todayStr) || null)
  }

  async function save() {
    if (!uid) return
    const payload = {
      user_id: uid,
      entry_date: form.date || todayStr,
      sleep_score: form.sleep ? +form.sleep : null,
      recovery: form.recovery ? +form.recovery : null,
      hrv: form.hrv ? +form.hrv : null,
      notes: form.notes || null,
    }
    await supabase.from('bevel_daily').upsert(payload, { onConflict: 'user_id,entry_date' })
    setModal(false); setForm({})
    await init()
  }

  function editEntry(e) {
    setForm({
      date: e.entry_date,
      sleep: e.sleep_score ?? '',
      recovery: e.recovery ?? '',
      hrv: e.hrv ?? '',
      notes: e.notes ?? '',
    })
    setModal(true)
  }

  async function deleteEntry(id) {
    if (!window.confirm('Delete this entry?')) return
    await supabase.from('bevel_daily').delete().eq('id', id)
    await init()
  }

  const chartData = [...entries].reverse().map(e => ({
    date: e.entry_date.slice(5),
    sleep: e.sleep_score,
    recovery: e.recovery,
    hrv: e.hrv,
  }))

  const scoreColor = (v, thresholds = [66, 34]) => {
    if (v === null || v === undefined) return 'text-[var(--text-3)]'
    if (v >= thresholds[0]) return 'text-success'
    if (v >= thresholds[1]) return 'text-warn'
    return 'text-crimson'
  }

  return (
    <div className="p-4 md:p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Bevel</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Sleep · Recovery · HRV — manual entry</p>
        </div>
        <Btn onClick={() => { setForm({ date: todayStr }); setModal(true) }}>
          <Plus size={13} /> Log Today
        </Btn>
      </div>

      {/* Today's scores */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { key: 'sleep_score', label: 'Sleep Score', unit: '' },
          { key: 'recovery', label: 'Recovery', unit: '' },
          { key: 'hrv', label: 'HRV', unit: 'ms' },
        ].map(({ key, label, unit }) => (
          <Card key={key} className="text-center py-6">
            <div className={`font-mono text-[28px] md:text-[38px] font-black leading-none ${scoreColor(today?.[key])}`}>
              {today?.[key] ?? '—'}{today?.[key] && unit ? <span className="text-[16px] font-normal">{unit}</span> : null}
            </div>
            <div className="text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--text-3)] mt-2">{label}</div>
          </Card>
        ))}
      </div>

      {/* Trend charts */}
      {chartData.length > 1 && (
        <Card className="mb-4">
          <Label>30-Day Trends</Label>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="sleep" stroke="#dc2626" strokeWidth={1.5} dot={false} name="Sleep" />
                <Line type="monotone" dataKey="recovery" stroke="#ca8a04" strokeWidth={1.5} dot={false} name="Recovery" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 80, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="hrv" stroke="#dc2626" strokeWidth={1.5} dot={{ r: 2, fill: '#dc2626' }} name="HRV (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-3 h-0.5 bg-crimson inline-block rounded" /> Sleep</span>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-3 h-0.5 bg-warn inline-block rounded" /> Recovery</span>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-2 h-2 rounded-full bg-crimson inline-block" /> HRV</span>
          </div>
        </Card>
      )}

      {/* Log history */}
      <Card>
        <Label>Log History</Label>
        {entries.length === 0 && <Empty icon={Activity} title="No entries yet" sub="Log your first Bevel metrics" />}
        {entries.slice(0, 14).map(e => (
          <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 group">
            <div className="font-mono text-[11px] text-[var(--text-3)] w-20 flex-shrink-0">{e.entry_date}</div>
            <div className="flex gap-4 flex-1 text-[12px] font-mono">
              {e.sleep_score !== null && <span className={scoreColor(e.sleep_score)}>S: {e.sleep_score}</span>}
              {e.recovery !== null && <span className={scoreColor(e.recovery)}>R: {e.recovery}</span>}
              {e.hrv !== null && <span>HRV: {e.hrv}ms</span>}
            </div>
            {e.notes && <div className="text-[11px] text-[var(--text-3)] truncate max-w-[120px]">{e.notes}</div>}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => editEntry(e)} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors" title="Edit"><Pencil size={13} /></button>
              <button onClick={() => deleteEntry(e.id)} className="text-[var(--text-3)] hover:text-crimson transition-colors" title="Delete"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Log Bevel Metrics">
        <div className="flex flex-col gap-3">
          <Input label="Date" type="date" value={form.date || todayStr} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Input label="Sleep Score (0–100)" type="number" min="0" max="100" placeholder="86" value={form.sleep || ''} onChange={e => setForm(p => ({ ...p, sleep: e.target.value }))} />
          <Input label="Recovery (0–100)" type="number" min="0" max="100" placeholder="72" value={form.recovery || ''} onChange={e => setForm(p => ({ ...p, recovery: e.target.value }))} />
          <Input label="HRV (ms)" type="number" placeholder="58" value={form.hrv || ''} onChange={e => setForm(p => ({ ...p, hrv: e.target.value }))} />
          <Input label="Notes (optional)" placeholder="e.g. bad sleep, stressed" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <Btn size="full" onClick={save}>Save Entry</Btn>
        </div>
      </Modal>
    </div>
  )
}
