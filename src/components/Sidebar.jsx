import { NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen, LayoutDashboard, Library, Search,
  Settings, LogOut, Moon, Sun, Folder, Plus, X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import FolderModal from './FolderModal'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library',   icon: Library,         label: 'Library' },
  { to: '/search',    icon: Search,          label: 'Search' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { signOut, user } = useAuth()
  const { dark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [folders, setFolders] = useState([])
  const [showFolderModal, setShowFolderModal] = useState(false)

  const fetchNavData = () => {
    if (!user) return
    Promise.all([
      supabase.from('subjects').select('*').eq('user_id', user.id).order('name'),
      supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
    ]).then(([sRes, fRes]) => {
      setSubjects(sRes.data || [])
      setFolders(fRes.data || [])
    })
  }

  useEffect(() => {
    fetchNavData()
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-90 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
              <BookOpen size={18} color="white" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              Maktaba
            </span>
          </div>
          <button className="md:hidden btn btn-ghost p-1" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 pt-3 overflow-y-auto space-y-4">
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Folders section */}
          <div className="px-3">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">Folders</p>
              <button
                onClick={() => setShowFolderModal(true)}
                className="text-surface-400 hover:text-brand-500 transition-colors p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                title="Create new folder"
              >
                <Plus size={14} />
              </button>
            </div>
            {folders.length === 0 ? (
              <p className="text-xs text-surface-400 px-2 py-1 italic">No folders yet</p>
            ) : (
              <div className="space-y-0.5">
                {folders.map(f => (
                  <NavLink
                    key={f.id}
                    to={`/folder/${f.id}`}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Folder
                      size={16}
                      className="flex-shrink-0"
                      style={{ color: f.color || '#6366f1' }}
                    />
                    <span className="truncate">{f.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Subjects section */}
          {subjects.length > 0 && (
            <div className="px-3">
              <div className="px-2 mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">Subjects</p>
              </div>
              <div className="space-y-0.5">
                {subjects.map(s => (
                  <NavLink
                    key={s.id}
                    to={`/subject/${s.id}`}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: s.color || '#6366f1' }}
                    />
                    <span className="truncate">{s.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-surface-200 dark:border-surface-800 p-3 space-y-1">
          <button
            onClick={toggleDark}
            className="nav-item w-full text-left"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleSignOut} className="nav-item w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
            <LogOut size={18} />
            Sign Out
          </button>
          {user && (
            <div className="px-3 py-2 mt-2 rounded-lg bg-surface-50 dark:bg-surface-900">
              <p className="text-xs text-surface-400 truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* New Folder Modal */}
      {showFolderModal && (
        <FolderModal
          allFolders={folders}
          onClose={() => setShowFolderModal(false)}
          onSaved={() => {
            setShowFolderModal(false)
            fetchNavData()
          }}
        />
      )}
    </>
  )
}
