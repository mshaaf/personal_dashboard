import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, TabBar, StatBox, Modal, Input, Select, Bar } from '../components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, subMonths, parseISO } from 'date-fns'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'

export default function Finance() {
  const { now } = useToday()
  const [tab, setTab] = useState('income')
  const [income, setIncome] = useState([])
  const [subs, setSubs] = useState([])
  const [expenses, setExpenses] = useState([])
  const [chartData, setChartData] = useState([])
  const [modal, setModal] = useState(null) // 'income' | 'sub' | 'expense'
  const [uid, setUid] = useState(null)

  // Form state
  const [form, setForm] = useState({})

  const today = format(now, 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    await loadAll(user.id)
  }

  async function loadAll(id) {
    const [incRes, subRes, expRes] = await Promise.all([
      supabase.from('income_checks').select('*').eq('user_id', id).order('check_date', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', id).order('name'),
      supabase.from('expenses').select('*').eq('user_id', id).order('expense_date', { ascending: false }),
    ])
    setIncome(incRes.data || [])
    setSubs(subRes.data || [])
    setExpenses(expRes.data || [])
    buildChart(incRes.data || [], expRes.data || [], subRes.data || [])
  }

  function buildChart(inc, exp, subs) {
    const weeks = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const wStart = format(weekStart, 'yyyy-MM-dd')
      const wEnd = format(weekEnd, 'yyyy-MM-dd')

      const wIncome = inc.filter(r => r.check_date >= wStart && r.check_date < wEnd).reduce((s, r) => s + +r.amount, 0)
      const wExp = exp.filter(r => r.expense_date >= wStart && r.expense_date < wEnd).reduce((s, r) => s + +r.amount, 0)
      const wSubs = subs.filter(s => s.active).reduce((s, r) => s + (+r.amount / 4), 0)
      weeks.push({
        label: format(weekStart, 'MMM d'),
        income: wIncome,
        expenses: wExp + wSubs,
        net: wIncome - wExp - wSubs,
      })
    }
    setChartData(weeks)
  }

  // Month totals
  const monthIncome = income.filter(r => r.check_date >= monthStart).reduce((s, r) => s + +r.amount, 0)
  const monthExp = expenses.filter(r => r.expense_date >= monthStart).reduce((s, r) => s + +r.amount, 0)
  const monthSubs = subs.filter(s => s.active).reduce((s, r) => s + +r.amount, 0)
  const net = monthIncome - monthExp - monthSubs
  const inGreen = net >= 0

  async function saveIncome() {
    if (!form.amount) return
    await supabase.from('income_checks').insert({
      user_id: uid,
      check_date: form.date || today,
      amount: +form.amount,
      hours: form.hours ? +form.hours : null,
      tips: form.tips ? +form.tips : null,
      notes: form.notes || null,
    })
    setModal(null)
    setForm({})
    await loadAll(uid)
  }

  async function saveSub() {
    if (!form.name || !form.amount) return
    await supabase.from('subscriptions').insert({
      user_id: uid,
      name: form.name,
      amount: +form.amount,
      billing_day: form.billing_day ? +form.billing_day : null,
      category: form.category || 'other',
      active: true,
    })
    setModal(null)
    setForm({})
    await loadAll(uid)
  }

  async function saveExpense() {
    if (!form.amount || !form.note) return
    await supabase.from('expenses').insert({
      user_id: uid,
      expense_date: form.date || today,
      amount: +form.amount,
      category: form.category || 'other',
      note: form.note,
    })
    setModal(null)
    setForm({})
    await loadAll(uid)
  }

  async function toggleSub(id, active) {
    await supabase.from('subscriptions').update({ active: !active }).eq('id', id)
    await loadAll(uid)
  }

  async function deleteRecord(table, id) {
    await supabase.from(table).delete().eq('id', id)
    await loadAll(uid)
  }

  const CAT_COLORS = {
    groceries: '#10b981', dining: '#f59e0b', transport: '#6366f1',
    entertainment: '#ec4899', shopping: '#8b5cf6', bills: '#64748b',
    health: '#ef4444', other: '#a3a3a3',
  }

  return (
    <div className="p-7 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Label className="mb-1">{format(now, 'MMMM yyyy')}</Label>
          <div className={`font-mono text-[42px] font-black tracking-[-0.03em] leading-none ${inGreen ? 'text-success' : 'text-crimson'}`}>
            {inGreen ? '+' : '−'}${Math.abs(net).toFixed(2)}
          </div>
          <div className="text-[12px] text-[var(--text-2)] mt-1.5">
            ${monthIncome.toFixed(0)} income · ${monthSubs.toFixed(0)}/mo subs · ${monthExp.toFixed(0)} expenses
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full mt-2 ${inGreen ? 'bg-[var(--green-dim)] text-success' : 'bg-[var(--crimson-dim)] text-crimson'}`}>
          {inGreen ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {inGreen ? 'In the green' : 'In the red'}
        </div>
      </div>

      {/* Chart */}
      <Card className="mb-4">
        <Label>12-Week Cash Flow</Label>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={inGreen ? '#16a34a' : '#dc2626'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={inGreen ? '#16a34a' : '#dc2626'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={v => [`$${Math.abs(v).toFixed(0)}`, v >= 0 ? 'Net' : 'Deficit']}
              />
              <Area type="monotone" dataKey="net" stroke={inGreen ? '#16a34a' : '#dc2626'} fill="url(#netGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabs */}
      <TabBar
        tabs={[{ key: 'income', label: 'Income' }, { key: 'subs', label: 'Subscriptions' }, { key: 'expenses', label: 'Expenses' }]}
        active={tab}
        onChange={setTab}
      />

      {/* Income tab */}
      {tab === 'income' && (
        <div className="animate-in">
          <div className="flex gap-3 mb-4">
            <StatBox label="This check" value={`$${income[0] ? (+income[0].amount).toFixed(0) : '—'}`} color="green" />
            <StatBox label="4-wk avg" value={`$${income.slice(0, 4).length ? (income.slice(0, 4).reduce((s, r) => s + +r.amount, 0) / income.slice(0, 4).length).toFixed(0) : '—'}`} />
            <StatBox label="Month total" value={`$${monthIncome.toFixed(0)}`} />
          </div>
          <div className="flex justify-between items-center mb-3">
            <Label className="mb-0">Recent Checks</Label>
            <Btn size="sm" onClick={() => { setForm({ date: today }); setModal('income') }}>
              <Plus size={12} /> Log Check
            </Btn>
          </div>
          <Card>
            {income.length === 0 && <div className="text-[13px] text-[var(--text-3)] py-4 text-center">No income logged yet</div>}
            {income.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">Weekly paycheck</div>
                  <div className="text-[11px] text-[var(--text-3)]">
                    {r.check_date} {r.hours && `· ${r.hours}h`} {r.tips && `· $${r.tips} tips`}
                  </div>
                </div>
                <div className="font-mono text-[13px] font-semibold text-success">+${(+r.amount).toFixed(2)}</div>
                <button onClick={() => deleteRecord('income_checks', r.id)} className="text-[var(--text-3)] hover:text-crimson text-[11px] ml-1">×</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Subscriptions tab */}
      {tab === 'subs' && (
        <div className="animate-in">
          <div className="flex gap-3 mb-4">
            <StatBox label="Monthly" value={`$${monthSubs.toFixed(0)}`} color="red" />
            <StatBox label="Annual" value={`$${(monthSubs * 12).toFixed(0)}`} />
            <StatBox label="Active" value={`${subs.filter(s => s.active).length}`} />
          </div>
          <div className="flex justify-between items-center mb-3">
            <Label className="mb-0">Subscriptions</Label>
            <Btn size="sm" onClick={() => { setForm({}); setModal('sub') }}>
              <Plus size={12} /> Add Sub
            </Btn>
          </div>
          <Card>
            {subs.length === 0 && <div className="text-[13px] text-[var(--text-3)] py-4 text-center">No subscriptions added</div>}
            {subs.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.active ? '#dc2626' : '#525252' }} />
                <div className="flex-1">
                  <div className={`text-[13px] font-medium ${!s.active ? 'line-through text-[var(--text-3)]' : ''}`}>{s.name}</div>
                  <div className="text-[11px] text-[var(--text-3)]">{s.category} {s.billing_day && `· due ${s.billing_day}th`}</div>
                </div>
                <div className="font-mono text-[13px] font-semibold text-crimson">${(+s.amount).toFixed(0)}/mo</div>
                <button onClick={() => toggleSub(s.id, s.active)} className="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] ml-1 border border-border rounded px-1.5 py-0.5">
                  {s.active ? 'Pause' : 'Enable'}
                </button>
                <button onClick={() => deleteRecord('subscriptions', s.id)} className="text-[var(--text-3)] hover:text-crimson text-[11px]">×</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <div className="animate-in">
          <div className="flex gap-3 mb-4">
            <StatBox label="This week" value={`$${expenses.filter(e => {
              const d = new Date(e.expense_date)
              const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
              return d >= weekAgo
            }).reduce((s, r) => s + +r.amount, 0).toFixed(0)}`} color="red" />
            <StatBox label="Month total" value={`$${monthExp.toFixed(0)}`} color="red" />
            <StatBox label="Transactions" value={`${expenses.filter(e => e.expense_date >= monthStart).length}`} />
          </div>
          <div className="flex justify-between items-center mb-3">
            <Label className="mb-0">Transactions</Label>
            <Btn size="sm" onClick={() => { setForm({ date: today }); setModal('expense') }}>
              <Plus size={12} /> Add Expense
            </Btn>
          </div>
          <Card>
            {expenses.length === 0 && <div className="text-[13px] text-[var(--text-3)] py-4 text-center">No expenses logged</div>}
            {expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[e.category] || '#a3a3a3' }} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{e.note}</div>
                  <div className="text-[11px] text-[var(--text-3)]">{e.category} · {e.expense_date}</div>
                </div>
                <div className="font-mono text-[13px] font-semibold text-crimson">−${(+e.amount).toFixed(2)}</div>
                <button onClick={() => deleteRecord('expenses', e.id)} className="text-[var(--text-3)] hover:text-crimson text-[11px] ml-1">×</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === 'income'} onClose={() => setModal(null)} title="Log Paycheck">
        <div className="flex flex-col gap-3">
          <Input label="Amount ($)" type="number" placeholder="412.00" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Input label="Date" type="date" value={form.date || today} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Input label="Hours worked (optional)" type="number" placeholder="38" value={form.hours || ''} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
          <Input label="Tips (optional, $)" type="number" placeholder="45.00" value={form.tips || ''} onChange={e => setForm(p => ({ ...p, tips: e.target.value }))} />
          <Input label="Notes (optional)" placeholder="e.g. holiday pay" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <Btn size="full" onClick={saveIncome}>Save Check</Btn>
        </div>
      </Modal>

      <Modal open={modal === 'sub'} onClose={() => setModal(null)} title="Add Subscription">
        <div className="flex flex-col gap-3">
          <Input label="Name" placeholder="Spotify" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Monthly amount ($)" type="number" placeholder="11.00" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Input label="Billing day of month" type="number" placeholder="3" value={form.billing_day || ''} onChange={e => setForm(p => ({ ...p, billing_day: e.target.value }))} />
          <Select label="Category" value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            options={['entertainment','bills','health','shopping','other'].map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
          <Btn size="full" onClick={saveSub}>Add Subscription</Btn>
        </div>
      </Modal>

      <Modal open={modal === 'expense'} onClose={() => setModal(null)} title="Log Expense">
        <div className="flex flex-col gap-3">
          <Input label="Amount ($)" type="number" placeholder="14.50" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Input label="Description" placeholder="Chipotle" value={form.note || ''} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
          <Input label="Date" type="date" value={form.date || today} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Select label="Category" value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            options={['groceries','dining','transport','entertainment','shopping','bills','health','other'].map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
          <Btn size="full" onClick={saveExpense}>Log Expense</Btn>
        </div>
      </Modal>
    </div>
  )
}
