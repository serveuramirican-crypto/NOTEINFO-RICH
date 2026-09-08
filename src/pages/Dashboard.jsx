import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Highlighter, Star, Clock, TrendingUp,
  Plus, ArrowRight, Calendar
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOutletContext } from 'react-router-dom'

const HIGHLIGHT_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple']
const COLOR_MAP = {
  yellow: '#facc15', pink: '#ec4899', blue: '#3b82f6',
  green: '#22c55e', purple: '#a855f7'
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setSearchOpen } = useOutletContext()
  const [stats, setStats] = useState({ lessons: 0, highlights: 0, subjects: 0, thisWeek: 0 })
  const [recent, setRecent] = useState([])
  const [highlightBreakdown, setHighlightBreakdown] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('lessons').select('id, title, subject_id, created_at, is_favorite, subjects(name,color)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
      supabase.from('highlights').select('id, color, lesson_id, lessons!inner(user_id)', { count: 'exact' }).eq('lessons.user_id', user.id),
      supabase.from('subjects').select('id', { count: 'exact' }).eq('user_id', user.id),
    ]).then(([lessonsRes, hlRes, subRes]) => {
      const allLessons = lessonsRes.data || []
      const now = new Date()
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
      const thisWeek = allLessons.filter(l => new Date(l.created_at) > weekAgo).length

      const breakdown = {}
      for (const hl of (hlRes.data || [])) {
        breakdown[hl.color] = (breakdown[hl.color] || 0) + 1
      }

      setStats({
        lessons: lessonsRes.count || 0,
        highlights: hlRes.count || 0,
        subjects: subRes.count || 0,
        thisWeek,
      })
      setRecent(allLessons.slice(0, 6))
      setHighlightBreakdown(breakdown)
      setLoading(false)
    })
  }, [user])

  const totalHl = Object.values(highlightBreakdown).reduce((a, b) => a + b, 0)

  const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="stat-card flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-surface-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-surface-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/library?new=1')}
          className="btn btn-primary"
        >
          <Plus size={16} /> New Lesson
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={BookOpen}    label="Total Lessons"    value={stats.lessons}    color="#6366f1" />
            <StatCard icon={Highlighter} label="Highlights"       value={stats.highlights} color="#f59e0b" sub={`across ${stats.lessons} lessons`} />
            <StatCard icon={Calendar}    label="Added This Week"  value={stats.thisWeek}   color="#22c55e" />
            <StatCard icon={Star}        label="Subjects"         value={stats.subjects}   color="#ec4899" />
          </div>

          {/* Highlight color breakdown */}
          {totalHl > 0 && (
            <div className="stat-card mb-8 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Highlighter size={17} className="text-brand-500" /> Highlights by Color
              </h2>
              <div className="flex gap-3 flex-wrap">
                {HIGHLIGHT_COLORS.map(c => (
                  <div key={c} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 px-3 py-2 rounded-lg">
                    <span className="w-3 h-3 rounded-full" style={{ background: COLOR_MAP[c] }} />
                    <span className="text-sm font-medium capitalize">{c}</span>
                    <span className="text-sm text-surface-400 font-bold">{highlightBreakdown[c] || 0}</span>
                  </div>
                ))}
              </div>
              {/* Progress bars */}
              <div className="mt-4 space-y-2">
                {HIGHLIGHT_COLORS.filter(c => highlightBreakdown[c]).map(c => (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-14 text-xs text-surface-400 capitalize">{c}</span>
                    <div className="flex-1 bg-surface-100 dark:bg-surface-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${((highlightBreakdown[c] || 0) / totalHl) * 100}%`,
                          background: COLOR_MAP[c]
                        }}
                      />
                    </div>
                    <span className="w-8 text-xs text-surface-400 text-right">{highlightBreakdown[c] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent lessons */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Clock size={17} className="text-brand-500" /> Recently Added
            </h2>
            <button onClick={() => navigate('/library')} className="btn btn-ghost text-sm">
              View all <ArrowRight size={14} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={48} />
              <p className="font-medium text-lg mt-2">Your library is empty</p>
              <p className="text-sm mt-1 mb-4">Start by adding your first lesson</p>
              <button onClick={() => navigate('/library?new=1')} className="btn btn-primary">
                <Plus size={16} /> Add First Lesson
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map(lesson => (
                <div
                  key={lesson.id}
                  className="lesson-card group"
                  onClick={() => navigate(`/lesson/${lesson.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: (lesson.subjects?.color || '#6366f1') + '22' }}
                    >
                      <BookOpen size={15} style={{ color: lesson.subjects?.color || '#6366f1' }} />
                    </div>
                    {lesson.is_favorite && <Star size={14} className="text-amber-400 fill-amber-400" />}
                  </div>
                  <h3 className="font-semibold text-sm mt-2 mb-1 line-clamp-2">{lesson.title}</h3>
                  {lesson.subjects?.name && (
                    <span className="text-xs text-surface-400">{lesson.subjects.name}</span>
                  )}
                  <p className="text-xs text-surface-400 mt-2">
                    {new Date(lesson.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-brand-500 font-medium">Open lesson</span>
                    <ArrowRight size={12} className="text-brand-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
