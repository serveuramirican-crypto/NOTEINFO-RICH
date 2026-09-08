import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import SearchModal from './SearchModal'
import { useAuth } from '../contexts/AuthContext'

export default function AppLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  // Cmd/Ctrl + K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="main-content flex-1">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950">
          <button onClick={() => setMobileOpen(true)} className="btn btn-ghost p-1.5">
            <Menu size={20} />
          </button>
          <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Maktaba</span>
        </div>

        <Outlet context={{ setSearchOpen }} />
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
