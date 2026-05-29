import { useState, useEffect } from 'react'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Bar, Pill, Empty, StatBox } from '../components/ui'
import { BookOpen, Plus, Search } from 'lucide-react'
import { format } from 'date-fns'

export default function Reading() {
  const { now } = useToday()
  const [books, setBooks] = useState([])
  const [sessions, setSessions] = useState([])
  const [modal, setModal] = useState(null) // 'add' | 'log' | 'search'
  const [form, setForm] = useState({})
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [uid, setUid] = useState(null)
  const today = format(now, 'yyyy-MM-dd')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const [booksRes, sessRes] = await Promise.all([
      supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('reading_sessions').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(30),
    ])
    setBooks(booksRes.data || [])
    setSessions(sessRes.data || [])
  }

  async function searchBooks(query) {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&fields=items(id,volumeInfo(title,authors,pageCount,imageLinks,industryIdentifiers))`)
      const json = await res.json()
      setSearchResults(json.items || [])
    } catch (e) {
      console.error(e)
    }
    setSearching(false)
  }

  async function addBook(bookData) {
    const info = bookData?.volumeInfo || {}
    await supabase.from('books').insert({
      user_id: uid,
      title: info.title || form.title || 'Unknown',
      author: info.authors?.[0] || form.author || null,
      total_pages: info.pageCount || (form.pages ? +form.pages : null),
      current_page: 0,
      cover_url: info.imageLinks?.thumbnail || null,
      isbn: info.industryIdentifiers?.[0]?.identifier || null,
      google_books_id: bookData?.id || null,
      status: 'reading',
      started_at: today,
    })
    setModal(null); setForm({}); setSearchResults([])
    await init()
  }

  async function addManualBook() {
    if (!form.title) return
    await supabase.from('books').insert({
      user_id: uid, title: form.title, author: form.author || null,
      total_pages: form.pages ? +form.pages : null,
      current_page: 0, status: 'reading', started_at: today,
    })
    setModal(null); setForm({})
    await init()
  }

  async function logReading() {
    if (!form.book_id || !form.pages) return
    const book = books.find(b => b.id === form.book_id)
    if (!book) return
    const newPage = Math.min(book.total_pages || 99999, book.current_page + +form.pages)
    await Promise.all([
      supabase.from('reading_sessions').insert({
        user_id: uid, book_id: form.book_id, session_date: today,
        pages_read: +form.pages, minutes_read: form.minutes ? +form.minutes : null,
      }),
      supabase.from('books').update({
        current_page: newPage,
        status: newPage >= (book.total_pages || 99999) ? 'finished' : 'reading',
        finished_at: newPage >= (book.total_pages || 99999) ? today : null,
      }).eq('id', form.book_id),
    ])
    setModal(null); setForm({})
    await init()
  }

  async function updateStatus(id, status) {
    await supabase.from('books').update({ status }).eq('id', id)
    await init()
  }

  const reading = books.filter(b => b.status === 'reading')
  const finished = books.filter(b => b.status === 'finished')
  const todaySessions = sessions.filter(s => s.session_date === today)
  const todayPages = todaySessions.reduce((s, r) => s + r.pages_read, 0)
  const todayMins = todaySessions.reduce((s, r) => s + (r.minutes_read || 0), 0)
  const weekPages = sessions.filter(s => {
    const d = new Date(s.session_date)
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }).reduce((s, r) => s + r.pages_read, 0)
  const avgPerDay = sessions.length > 0 ? weekPages / 7 : 0

  return (
    <div className="p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Reading</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Learning tracker</p>
        </div>
        <div className="flex gap-2">
          {reading.length > 0 && (
            <Btn variant="ghost" size="sm" onClick={() => { setForm({ book_id: reading[0].id, date: today }); setModal('log') }}>
              <Plus size={12} /> Log Pages
            </Btn>
          )}
          <Btn size="sm" onClick={() => { setForm({}); setModal('search') }}>
            <Search size={12} /> Add Book
          </Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-4">
        <StatBox label="Today" value={`${todayPages} pg`} color={todayPages > 0 ? 'white' : ''} />
        <StatBox label="This week" value={`${weekPages} pg`} />
        <StatBox label="7-day avg" value={`${Math.round(avgPerDay)} pg`} />
        {reading[0] && (
          <StatBox
            label="ETA"
            value={avgPerDay > 0 ? `${Math.ceil(((reading[0].total_pages || 0) - reading[0].current_page) / avgPerDay)}d` : '—'}
          />
        )}
      </div>

      {/* Current books */}
      {reading.map(b => (
        <Card key={b.id} className="mb-3">
          <div className="flex gap-4 items-start">
            {b.cover_url ? (
              <img src={b.cover_url} alt={b.title} className="w-14 h-20 object-cover rounded-[4px] shadow-lg flex-shrink-0" />
            ) : (
              <div className="w-14 h-20 bg-surface2 border border-border rounded-[4px] flex items-center justify-center flex-shrink-0 text-[20px]">📚</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold truncate">{b.title}</div>
              {b.author && <div className="text-[12px] text-[var(--text-3)]">{b.author}</div>}
              <div className="mt-2.5 mb-1.5">
                <div className="flex justify-between text-[11px] text-[var(--text-3)] mb-1.5">
                  <span>Page {b.current_page} of {b.total_pages || '?'}</span>
                  <span className="font-semibold text-[var(--text)]">
                    {b.total_pages ? `${Math.round((b.current_page / b.total_pages) * 100)}%` : '—'}
                  </span>
                </div>
                <Bar value={b.current_page} max={b.total_pages || 1} height={5} />
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                <Pill color="red">Reading</Pill>
                {todayPages > 0 && <Pill color="muted">{todayPages} pg today</Pill>}
                {todayMins > 0 && <Pill color="muted">{todayMins} min today</Pill>}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {reading.length === 0 && (
        <Card className="mb-4">
          <Empty icon={BookOpen} title="No books in progress" sub="Search to add your current read" action={<Btn onClick={() => setModal('search')}>Search Books</Btn>} />
        </Card>
      )}

      {/* Finished books */}
      {finished.length > 0 && (
        <Card>
          <Label>Finished</Label>
          {finished.map(b => (
            <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              {b.cover_url && <img src={b.cover_url} alt={b.title} className="w-8 h-11 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{b.title}</div>
                <div className="text-[11px] text-[var(--text-3)]">{b.author} · {b.finished_at || '—'}</div>
              </div>
              <Pill color="green">✓</Pill>
            </div>
          ))}
        </Card>
      )}

      {/* Search modal */}
      <Modal open={modal === 'search'} onClose={() => { setModal(null); setSearchResults([]) }} title="Add Book">
        <div className="flex gap-2 mb-4">
          <input
            placeholder="Search by title..."
            value={form.query || ''}
            onChange={e => setForm(p => ({ ...p, query: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && searchBooks(form.query)}
            className="flex-1 px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] focus:border-crimson outline-none"
          />
          <Btn onClick={() => searchBooks(form.query)} disabled={searching}>
            {searching ? '...' : 'Search'}
          </Btn>
        </div>

        {searchResults.map(item => {
          const info = item.volumeInfo
          return (
            <button key={item.id} onClick={() => addBook(item)}
              className="w-full flex items-center gap-3 p-3 hover:bg-surface2 rounded-[8px] text-left transition-colors border-b border-border last:border-0">
              {info.imageLinks?.thumbnail && <img src={info.imageLinks.thumbnail} alt={info.title} className="w-10 h-14 object-cover rounded" />}
              <div>
                <div className="text-[13px] font-semibold">{info.title}</div>
                <div className="text-[11px] text-[var(--text-3)]">{info.authors?.[0]} · {info.pageCount ? `${info.pageCount} pages` : 'pages unknown'}</div>
              </div>
            </button>
          )
        })}

        <div className="border-t border-border mt-3 pt-3">
          <Label className="mb-2">Or add manually</Label>
          <div className="flex flex-col gap-2">
            <Input label="Title" value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Input label="Author" value={form.author || ''} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} />
            <Input label="Total pages" type="number" value={form.pages || ''} onChange={e => setForm(p => ({ ...p, pages: e.target.value }))} />
            <Btn size="full" onClick={addManualBook}>Add Book</Btn>
          </div>
        </div>
      </Modal>

      {/* Log modal */}
      <Modal open={modal === 'log'} onClose={() => setModal(null)} title="Log Reading Session">
        <div className="flex flex-col gap-3">
          <Select label="Book" value={form.book_id || ''} onChange={e => setForm(p => ({ ...p, book_id: e.target.value }))}
            options={reading.map(b => ({ value: b.id, label: b.title }))} />
          <Input label="Pages read today" type="number" placeholder="20" value={form.pages || ''} onChange={e => setForm(p => ({ ...p, pages: e.target.value }))} />
          <Input label="Minutes read (optional)" type="number" placeholder="35" value={form.minutes || ''} onChange={e => setForm(p => ({ ...p, minutes: e.target.value }))} />
          <Btn size="full" onClick={logReading}>Log Session</Btn>
        </div>
      </Modal>
    </div>
  )
}

function Select({ label, options = [], ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-[var(--text-3)]">{label}</label>}
      <select className="px-3 py-2 text-[13px] bg-surface2 border border-border rounded-[8px] text-[var(--text)] focus:border-crimson outline-none" {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
