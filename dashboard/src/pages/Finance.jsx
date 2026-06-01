import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, TabBar, StatBox, Modal, Input, Select, Bar } from '../components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns'
import { Plus, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'

// Count how many times a monthly billing day falls within [fromISO, toISO]
function billingOccurrences(billingDay, fromISO, toISO) {
  if (!billingDay || !fromISO || !toISO) return 0
  const from = parseISO(fromISO)
  const to = parseISO(toISO)
  if (to < from) return 0
  let count = 0
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  while (cursor <= to) {
    const y = cursor.getFullYear(), m = cursor.getMonth()
    const lastDay = new Date(y, m + 1, 0).getDate()
    const charge = new Date(y, m, Math.min(billingDay, lastDay))
    if (charge >= from && charge <= to) count++
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return count
}

export default function Finance() {
  const { now } = useToday()
  const [tab, setTab] = useState('balance')
  const [income, setIncome] = useState([])
  const [subs, setSubs] = useState([])
  const [expenses, setExpenses] = useState([])
  const [chartData, setChartData] = useState([])
  const [modal, setModal] = useState(null) // 'income' | 'sub' | 'expense' | 'balance'
  const [uid, setUid] = useState(null)
  const [err, setErr] = useState(null)
  const [bal, setBal] = useState({ starting_balance: null, balance_as_of: null })

  // Form state
  const [form, setForm] = useState({})

  // Which month the Income/Expenses/headline views show (navigable)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))

  // Derive dates once per calendar day (not every second the clock ticks)
  const today = format(now, 'yyyy-MM-dd')
  const monthStart = format(viewMonth, 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')
  const monthLabel = format(viewMonth, 'MMMM yyyy')
  const isCurrentMonth = isSameMonth(viewMonth, now)

  useEffect(() => { init() }, [])

  // Resolve the user id reliably even if `uid` state hasn't populated yet
  async function ensureUid() {
    if (uid) return uid
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUid(user.id)
    return user?.id || null
  }

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const { data: profile } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle()
    const s = profile?.settings || {}
    if (s.starting_balance != null) setBal({ starting_balance: s.starting_balance, balance_as_of: s.balance_as_of || null })
    await loadAll(user.id)
  }

  async function saveBalance() {
    if (form.starting_balance === undefined || form.starting_balance === '') { setErr('Enter your current balance.'); return }
    const id = await ensureUid()
    if (!id) { setErr('Still loading your account — please try again in a moment.'); return }
    const next = { starting_balance: +form.starting_balance, balance_as_of: form.balance_as_of || today }
    const { data: profile } = await supabase.from('profiles').select('settings').eq('id', id).maybeSingle()
    const { error } = await supabase.from('profiles')
      .update({ settings: { ...(profile?.settings || {}), ...next } }).eq('id', id)
    if (error) { console.error('saveBalance failed:', error); setErr('Could not save balance: ' + error.message); return }
    setErr(null)
    setBal(next)
    setModal(null)
    setForm({})
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

  // Records within the viewed month
  const incomeInMonth = income.filter(r => r.check_date >= monthStart && r.check_date <= monthEnd)
  const expensesInMonth = expenses.filter(r => r.expense_date >= monthStart && r.expense_date <= monthEnd)

  // Month totals
  const monthIncome = incomeInMonth.reduce((s, r) => s + +r.amount, 0)
  const monthExp = expensesInMonth.reduce((s, r) => s + +r.amount, 0)
  const monthSubs = subs.filter(s => s.active).reduce((s, r) => s + +r.amount, 0)
  const net = monthIncome - monthExp - monthSubs
  const inGreen = net >= 0

  // Live cash balance: starting balance + income − expenses − subscription charges
  // since the as-of date (each active sub deducted per billing-day occurrence)
  const hasBalance = bal.starting_balance != null
  const asOf = bal.balance_as_of || null
  const sinceIncome = income.filter(r => !asOf || r.check_date >= asOf).reduce((s, r) => s + +r.amount, 0)
  const sinceExp = expenses.filter(r => !asOf || r.expense_date >= asOf).reduce((s, r) => s + +r.amount, 0)
  const sinceSubs = asOf ? subs.filter(s => s.active).reduce((s, r) => s + +r.amount * billingOccurrences(r.billing_day, asOf, today), 0) : 0
  const currentBalance = (+bal.starting_balance || 0) + sinceIncome - sinceExp - sinceSubs

  async function saveIncome() {
    if (!form.amount) { setErr('Enter an amount.'); return }
    const id = await ensureUid()
    if (!id) { setErr('Still loading your account — please try again in a moment.'); return }
    const date = form.date || today
    const { error } = await supabase.from('income_checks').insert({
      user_id: id,
      check_date: date,
      amount: +form.amount,
      hours: form.hours ? +form.hours : null,
      tips: form.tips ? +form.tips : null,
      notes: form.notes || null,
    })
    if (error) { console.error('saveIncome failed:', error); setErr('Could not save check: ' + error.message); return }
    setErr(null)
    setModal(null)
    setForm({})
    setViewMonth(startOfMonth(parseISO(date)))
    await loadAll(id)
  }

  async function saveSub() {
    if (!form.name || !form.amount) { setErr('Enter a name and amount.'); return }
    const id = await ensureUid()
    if (!id) { setErr('Still loading your account — please try again in a moment.'); return }
    const { error } = await supabase.from('subscriptions').insert({
      user_id: id,
      name: form.name,
      amount: +form.amount,
      billing_day: form.billing_day ? +form.billing_day : null,
      category: form.category || 'other',
      active: true,
    })
    if (error) { console.error('saveSub failed:', error); setErr('Could not save subscription: ' + error.message); return }
    setErr(null)
    setModal(null)
    setForm({})
    await loadAll(id)
  }

  async function saveExpense() {
    if (!form.amount || !form.note) { setErr('Enter an amount and description.'); return }
    const id = await ensureUid()
    if (!id) { setErr('Still loading your account — please try again in a moment.'); return }
    const date = form.date || today
    const { error } = await supabase.from('expenses').insert({
      user_id: id,
      expense_date: date,
      amount: +form.amount,
      category: form.category || 'other',
      note: form.note,
    })
    if (error) { console.error('saveExpense failed:', error); setErr('Could not save expense: ' + error.message); return }
    setErr(null)
    setModal(null)
    setForm({})
    setViewMonth(startOfMonth(parseISO(date)))
    await loadAll(id)
  }

  async function toggleSub(id, active) {
    const { error } = await supabase.from('subscriptions').update({ active: !active }).eq('id', id)
    if (error) { console.error('toggleSub failed:', error); setErr('Could not update subscription: ' + error.message); return }
    await loadAll(uid)
  }

  async function deleteRecord(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { console.error('delete failed:', error); setErr('Could not delete: ' + error.message); return }
    await loadAll(uid)
  }

  const CAT_COLORS = {
    groceries: '#10b981', dining: '#f59e0b', transport: '#6366f1',
    entertainment: '#ec4899', shopping: '#8b5cf6', bills: '#64748b',
    health: '#ef4444', other: '#a3a3a3',
  }

  return (
    <div className="p-7 animate-in">
      {err && (
        <div className="mb-4 text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">
          {err}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setViewMonth(m => subMonths(m, 1))} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              <ChevronLeft size={15} />
            </button>
            <Label className="mb-0 min-w-[110px] text-center">{monthLabel}</Label>
            <button onClick={() => !isCurrentMonth && setViewMonth(m => addMonths(m, 1))} disabled={isCurrentMonth}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={15} />
            </button>
          </div>
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
        tabs={[{ key: 'balance', label: 'Balance' }, { key: 'income', label: 'Income' }, { key: 'subs', label: 'Subscriptions' }, { key: 'expenses', label: 'Expenses' }]}
        active={tab}
        onChange={setTab}
      />

      {/* Balance tab */}
      {tab === 'balance' && (
        <div className="animate-in">
          <Card className="mb-4">
            <div className="flex items-start justify-between">
              <div>
                <Label className="mb-1">Current Balance</Label>
                {hasBalance ? (
                  <div className={`font-mono text-[36px] font-black tracking-[-0.03em] leading-none ${currentBalance >= 0 ? 'text-success' : 'text-crimson'}`}>
                    ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="text-[13px] text-[var(--text-2)]">Set your current cash to start tracking your live balance.</div>
                )}
                {hasBalance && asOf && <div className="text-[11px] text-[var(--text-3)] mt-1.5">Since {asOf}</div>}
              </div>
              <Btn size="sm" variant={hasBalance ? 'ghost' : 'primary'} onClick={() => { setErr(null); setForm({ starting_balance: bal.starting_balance ?? '', balance_as_of: bal.balance_as_of || today }); setModal('balance') }}>
                <Wallet size={12} /> {hasBalance ? 'Update' : 'Set Balance'}
              </Btn>
            </div>
          </Card>

          {hasBalance && (
            <div className="flex gap-3 mb-4">
              <StatBox label="Income in" value={`+$${sinceIncome.toFixed(0)}`} color="green" />
              <StatBox label="Expenses out" value={`−$${sinceExp.toFixed(0)}`} color="red" />
              <StatBox label="Subs out" value={`−$${sinceSubs.toFixed(0)}`} color="red" />
            </div>
          )}
          <div className="text-[11px] text-[var(--text-3)]">
            Starting balance ${(+bal.starting_balance || 0).toFixed(2)} + income − expenses − subscription charges since {asOf || 'the start date'}.
          </div>
        </div>
      )}

      {/* Income tab */}
      {tab === 'income' && (
        <div className="animate-in">
          <div className="flex gap-3 mb-4">
            <StatBox label="Checks" value={`${incomeInMonth.length}`} color="green" />
            <StatBox label="Avg check" value={`$${incomeInMonth.length ? (monthIncome / incomeInMonth.length).toFixed(0) : '—'}`} />
            <StatBox label="Month total" value={`$${monthIncome.toFixed(0)}`} />
          </div>
          <div className="flex justify-between items-center mb-3">
            <Label className="mb-0">{monthLabel} Checks</Label>
            <Btn size="sm" onClick={() => { setErr(null); setForm({ date: today }); setModal('income') }}>
              <Plus size={12} /> Log Check
            </Btn>
          </div>
          <Card>
            {incomeInMonth.length === 0 && <div className="text-[13px] text-[var(--text-3)] py-4 text-center">No income logged for {monthLabel}</div>}
            {incomeInMonth.map(r => (
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
            <Btn size="sm" onClick={() => { setErr(null); setForm({}); setModal('sub') }}>
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
            <StatBox label="Month total" value={`$${monthExp.toFixed(0)}`} color="red" />
            <StatBox label="Transactions" value={`${expensesInMonth.length}`} />
            <StatBox label="Avg/txn" value={`$${expensesInMonth.length ? (monthExp / expensesInMonth.length).toFixed(0) : '—'}`} />
          </div>
          <div className="flex justify-between items-center mb-3">
            <Label className="mb-0">{monthLabel} Transactions</Label>
            <Btn size="sm" onClick={() => { setErr(null); setForm({ date: today }); setModal('expense') }}>
              <Plus size={12} /> Add Expense
            </Btn>
          </div>
          <Card>
            {expensesInMonth.length === 0 && <div className="text-[13px] text-[var(--text-3)] py-4 text-center">No expenses logged for {monthLabel}</div>}
            {expensesInMonth.map(e => (
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
      <Modal open={modal === 'balance'} onClose={() => setModal(null)} title="Set Current Balance">
        <div className="flex flex-col gap-3">
          <Input label="Current cash ($)" type="number" placeholder="2500.00" value={form.starting_balance ?? ''} onChange={e => setForm(p => ({ ...p, starting_balance: e.target.value }))} />
          <Input label="As of date" type="date" value={form.balance_as_of || today} onChange={e => setForm(p => ({ ...p, balance_as_of: e.target.value }))} />
          <div className="text-[11px] text-[var(--text-3)]">Income and expenses logged on or after this date adjust your balance; active subscriptions are deducted each billing day.</div>
          {err && <div className="text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">{err}</div>}
          <Btn size="full" onClick={saveBalance}>Save Balance</Btn>
        </div>
      </Modal>

      <Modal open={modal === 'income'} onClose={() => setModal(null)} title="Log Paycheck">
        <div className="flex flex-col gap-3">
          <Input label="Amount ($)" type="number" placeholder="412.00" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Input label="Date" type="date" value={form.date || today} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Input label="Hours worked (optional)" type="number" placeholder="38" value={form.hours || ''} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
          <Input label="Tips (optional, $)" type="number" placeholder="45.00" value={form.tips || ''} onChange={e => setForm(p => ({ ...p, tips: e.target.value }))} />
          <Input label="Notes (optional)" placeholder="e.g. holiday pay" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          {err && <div className="text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">{err}</div>}
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
          {err && <div className="text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">{err}</div>}
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
          {err && <div className="text-[12px] text-crimson bg-[var(--crimson-dim)] border border-crimson/30 rounded-[8px] px-3 py-2">{err}</div>}
          <Btn size="full" onClick={saveExpense}>Log Expense</Btn>
        </div>
      </Modal>
    </div>
  )
}
