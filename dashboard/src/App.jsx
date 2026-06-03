import { useState } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useToday } from './hooks/useToday'
import { useUser } from './hooks/useUser'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Home from './pages/Home'
import Finance from './pages/Finance'
import Gym from './pages/Gym'
import Supplements from './pages/Supplements'
import Bevel from './pages/Bevel'
import Reading from './pages/Reading'
import Goals from './pages/Goals'
import Projects from './pages/Projects'
import CalendarPage from './pages/Calendar'

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Home', icon: GridIcon, exact: true },
      { to: '/calendar', label: 'Calendar', icon: CalIcon },
    ],
  },
  {
    section: 'Tracking',
    items: [
      { to: '/finance', label: 'Finance', icon: DollarIcon },
      { to: '/gym', label: 'Gym', icon: GymIcon },
      { to: '/supplements', label: 'Supplements', icon: PillIcon },
      { to: '/bevel', label: 'Bevel', icon: HeartIcon },
      { to: '/reading', label: 'Reading', icon: BookIcon },
    ],
  },
  {
    section: 'Goals',
    items: [
      { to: '/goals', label: '12 Week Year', icon: TargetIcon },
      { to: '/projects', label: 'Side Projects', icon: FolderIcon },
    ],
  },
]

export default function App() {
  const { dateShort } = useToday()
  const { user, loading, signOut } = useUser()
  const [navOpen, setNavOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <Spinner size={22} />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Sidebar — static on desktop, slide-out drawer on mobile */}
      <nav
        className={`fixed md:static inset-y-0 left-0 z-40 w-[216px] flex-shrink-0 flex flex-col border-r border-border
          transform transition-transform duration-200 md:translate-x-0
          ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--surface)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="text-[15px] font-black tracking-[-0.03em]">
            DASH<span className="text-crimson">.</span>
          </div>
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--text-3)] mt-0.5">Personal OS</div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2">
          {NAV.map(section => (
            <div key={section.section} className="mb-1">
              <div className="px-5 pt-3 pb-1 text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--text-3)]">
                {section.section}
              </div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-medium transition-all border-l-2
                    ${isActive
                      ? 'text-[var(--text)] bg-[var(--crimson-dim)] border-crimson'
                      : 'text-[var(--text-2)] border-transparent hover:text-[var(--text)] hover:bg-white/[0.02]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        className={isActive ? 'text-crimson' : 'opacity-70'}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="px-5 py-3.5 border-t border-border">
          <div className="font-mono text-[11px] text-[var(--text-3)]">{dateShort}</div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="text-[9px] text-[var(--text-3)] opacity-60">Built for one.</div>
            <button
              onClick={signOut}
              className="flex items-center gap-1 text-[10px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-bg min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: 'var(--surface)' }}>
          <button onClick={() => setNavOpen(true)} className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="text-[14px] font-black tracking-[-0.03em]">
            DASH<span className="text-crimson">.</span>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/gym" element={<Gym />} />
          <Route path="/supplements" element={<Supplements />} />
          <Route path="/bevel" element={<Bevel />} />
          <Route path="/reading" element={<Reading />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// ——— Icons ———
import { LayoutDashboard, DollarSign, Dumbbell, Pill, Activity, BookOpen, Target, FolderOpen, Calendar, LogOut, Menu } from 'lucide-react'

function GridIcon(p) { return <LayoutDashboard {...p} /> }
function CalIcon(p) { return <Calendar {...p} /> }
function DollarIcon(p) { return <DollarSign {...p} /> }
function GymIcon(p) { return <Dumbbell {...p} /> }
function PillIcon(p) { return <Pill {...p} /> }
function HeartIcon(p) { return <Activity {...p} /> }
function BookIcon(p) { return <BookOpen {...p} /> }
function TargetIcon(p) { return <Target {...p} /> }
function FolderIcon(p) { return <FolderOpen {...p} /> }
