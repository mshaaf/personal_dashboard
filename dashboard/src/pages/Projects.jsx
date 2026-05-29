// ——— PROJECTS PAGE ———
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Label, Btn, Modal, Input, Select, Pill, Checkbox, Empty } from '../components/ui'
import { FolderOpen, Plus, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

export function Projects() {
  const [projects, setProjects] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [expanded, setExpanded] = useState({})
  const [uid, setUid] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const { data } = await supabase.from('side_projects')
      .select('*, side_project_milestones(*)')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setProjects(data || [])
  }

  async function addProject() {
    if (!form.name) return
    await supabase.from('side_projects').insert({
      user_id: uid, name: form.name, description: form.desc || null,
      status: form.status || 'active', start_date: form.start_date || null,
      target_date: form.target_date || null, notes: form.notes || null,
      links: form.link ? [{ label: 'Link', url: form.link }] : [],
    })
    setModal(null); setForm({})
    await init()
  }

  async function addMilestone(projectId) {
    const text = form[`ms_${projectId}`]
    if (!text) return
    await supabase.from('side_project_milestones').insert({ side_project_id: projectId, name: text, done: false })
    setForm(p => ({ ...p, [`ms_${projectId}`]: '' }))
    await init()
  }

  async function toggleMilestone(id, done) {
    await supabase.from('side_project_milestones').update({ done: !done }).eq('id', id)
    await init()
  }

  async function updateStatus(id, status) {
    await supabase.from('side_projects').update({ status }).eq('id', id)
    await init()
  }

  const STATUS_COLORS = {
    active: 'green', paused: 'yellow', shipped: 'muted', abandoned: 'muted', building: 'red',
  }
  const STATUS_OPTIONS = ['active','paused','shipped','abandoned'].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))

  return (
    <div className="p-7 animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black tracking-[-0.03em]">Side Projects</h1>
          <p className="text-[13px] text-[var(--text-2)] mt-0.5">Code, builds, and creative work</p>
        </div>
        <Btn size="sm" onClick={() => { setForm({ status: 'active' }); setModal('add') }}>
          <Plus size={12} /> New Project
        </Btn>
      </div>

      {projects.length === 0 && (
        <Card><Empty icon={FolderOpen} title="No projects yet" sub="Add your first side project" action={<Btn onClick={() => setModal('add')}>+ New Project</Btn>} /></Card>
      )}

      {projects.map(proj => {
        const isOpen = expanded[proj.id] !== false
        const milestones = proj.side_project_milestones || []
        const done = milestones.filter(m => m.done).length
        const links = Array.isArray(proj.links) ? proj.links : []

        return (
          <Card key={proj.id} className="mb-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-bold">{proj.name}</div>
                  <Pill color={STATUS_COLORS[proj.status] || 'muted'}>{proj.status}</Pill>
                </div>
                {proj.description && <div className="text-[12px] text-[var(--text-3)] mt-0.5">{proj.description}</div>}
              </div>
              <button onClick={() => setExpanded(p => ({ ...p, [proj.id]: !isOpen }))} className="text-[var(--text-3)] hover:text-[var(--text)] ml-2">
                {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>

            {isOpen && (
              <>
                {/* Links */}
                {links.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {links.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-[var(--text-2)] bg-surface2 border border-border px-2 py-1 rounded-[6px] hover:text-[var(--text)] transition-colors">
                        <ExternalLink size={10} /> {l.label || l.url}
                      </a>
                    ))}
                  </div>
                )}

                {/* Milestones */}
                {milestones.length > 0 && (
                  <div className="mb-3">
                    <Label className="mb-1.5">Milestones ({done}/{milestones.length})</Label>
                    {milestones.map(m => (
                      <div key={m.id} className="flex items-center gap-2.5 py-1.5">
                        <Checkbox checked={m.done} onChange={() => toggleMilestone(m.id, m.done)} size={15} />
                        <span className={`text-[12px] ${m.done ? 'line-through text-[var(--text-3)]' : ''}`}>{m.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add milestone */}
                <div className="flex gap-2">
                  <input
                    value={form[`ms_${proj.id}`] || ''}
                    onChange={e => setForm(p => ({ ...p, [`ms_${proj.id}`]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addMilestone(proj.id)}
                    placeholder="+ Add milestone"
                    className="flex-1 px-3 py-1.5 text-[12px] bg-surface2 border border-dashed border-border rounded-[8px] focus:border-crimson outline-none text-[var(--text)]"
                  />
                  <Btn variant="ghost" size="sm" onClick={() => addMilestone(proj.id)}>Add</Btn>
                </div>

                {/* Status change */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value}
                      onClick={() => updateStatus(proj.id, s.value)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-[6px] border transition-colors
                        ${proj.status === s.value ? 'bg-crimson border-crimson text-white' : 'border-border text-[var(--text-3)] hover:border-border-light'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
        )
      })}

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="New Side Project">
        <div className="flex flex-col gap-3">
          <Input label="Project name" placeholder="Fossil Atlas" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Description" placeholder="What is it?" value={form.desc || ''} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
          <Select label="Status" value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} options={STATUS_OPTIONS} />
          <Input label="Link (optional)" placeholder="https://github.com/..." value={form.link || ''} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
          <Input label="Start date (optional)" type="date" value={form.start_date || ''} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          <Input label="Target date (optional)" type="date" value={form.target_date || ''} onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))} />
          <Btn size="full" onClick={addProject}>Add Project</Btn>
        </div>
      </Modal>
    </div>
  )
}

export default Projects
