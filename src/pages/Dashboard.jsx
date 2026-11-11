import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  BookOpen, Highlighter, Star, Clock, Plus, ArrowRight,
  Calendar, Folder, FolderPlus, Eye, Sparkles, Search,
  ChevronRight, BookMarked, Layers, CheckCircle2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import LessonModal from '../components/LessonModal'
import FolderModal from '../components/FolderModal'
import QuickPreviewDrawer from '../components/QuickPreviewDrawer'
import HighlightReviewModal from '../components/HighlightReviewModal'

const HIGHLIGHT_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple']
const COLOR_MAP = {
  yellow: { hex: '#facc15', defaultLabel: 'Important', bgLight: '#fef08a40', borderLight: '#facc1560' },
  pink:   { hex: '#ec4899', defaultLabel: 'Definition', bgLight: '#fbcfe840', borderLight: '#ec489960' },
  blue:   { hex: '#3b82f6', defaultLabel: 'Example', bgLight: '#bfdbfe40', borderLight: '#3b82f660' },
  green:  { hex: '#22c55e', defaultLabel: 'To Review', bgLight: '#bbf7d040', borderLight: '#22c55e60' },
  purple: { hex: '#a855f7', defaultLabel: 'Concept', bgLight: '#e9d5ff40', borderLight: '#a855f760' },
}

let dashboardCache = null

// Helper to format reading time
function estimateReadingTime(text = '') {
  const words = text ? text.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min read`
}

// Relative date formatter
function formatRelativeDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffHours = (now - date) / (1000 * 60 * 60)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffHours < 48) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const setSearchOpen = outletContext.setSearchOpen

  // Data states
  const [stats, setStats] = useState(dashboardCache?.stats || { lessons: 0, highlights: 0, distinctLessons: 0, thisWeek: 0, subjects: 0, folders: 0 })
  const [recentLessons, setRecentLessons] = useState(dashboardCache?.recentLessons || [])
  const [favoriteLessons, setFavoriteLessons] = useState(dashboardCache?.favoriteLessons || [])
  const [allHighlights, setAllHighlights] = useState(dashboardCache?.allHighlights || [])
  const [highlightBreakdown, setHighlightBreakdown] = useState(dashboardCache?.highlightBreakdown || {})
  const [colorLabels, setColorLabels] = useState(dashboardCache?.colorLabels || {})
  const [folders, setFolders] = useState(dashboardCache?.folders || [])
  const [subjects, setSubjects] = useState(dashboardCache?.subjects || [])
  const [loading, setLoading] = useState(!dashboardCache)

  // Interactive UI states
  const [activeTab, setActiveTab] = useState('recent') // 'recent' | 'favorites'
  const [previewLessonId, setPreviewLessonId] = useState(null)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  const fetchDashboardData = async () => {
    if (!user) return
    if (!dashboardCache) setLoading(true)

    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        lessonsRes,
        thisWeekRes,
        hlRes,
        subRes,
        folderRes,
        labelsRes
      ] = await Promise.all([
        // Recent lessons (with folders, subjects, and highlight count)
        supabase
          .from('lessons')
          .select('id, title, content, subject_id, folder_id, created_at, is_favorite, subjects(id, name, color, icon), folders(id, name, color), highlights(id, color)', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        // Accurate count of lessons added this week
        supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', weekAgo),
        // Highlights of user
        supabase
          .from('highlights')
          .select('id, color, lesson_id, text_snippet, note, lessons!inner(user_id, title)', { count: 'exact' })
          .eq('lessons.user_id', user.id),
        // Subjects count and list
        supabase
          .from('subjects')
          .select('id, name, color, icon', { count: 'exact' })
          .eq('user_id', user.id)
          .order('name'),
        // Folders
        supabase
          .from('folders')
          .select('id, name, color', { count: 'exact' })
          .eq('user_id', user.id)
          .order('name'),
        // User color labels
        supabase
          .from('color_labels')
          .select('color, label')
          .eq('user_id', user.id),
      ])

      const lessons = lessonsRes.data || []
      const highlights = hlRes.data || []
      const subs = subRes.data || []
      const flds = folderRes.data || []

      // Color labels map
      const labelMap = {}
      for (const row of (labelsRes.data || [])) {
        labelMap[row.color] = row.label
      }
      setColorLabels(labelMap)

      // Breakdown & distinct lessons
      const breakdown = {}
      const lessonsWithHl = new Set()
      for (const hl of highlights) {
        breakdown[hl.color] = (breakdown[hl.color] || 0) + 1
        if (hl.lesson_id) lessonsWithHl.add(hl.lesson_id)
      }

      const favorites = lessons.filter(l => l.is_favorite)

      const computedStats = {
        lessons: lessonsRes.count || 0,
        highlights: hlRes.count || 0,
        distinctLessons: lessonsWithHl.size,
        thisWeek: thisWeekRes.count || 0,
        subjects: subRes.count || 0,
        folders: folderRes.count || 0,
      }

      setStats(computedStats)
      setRecentLessons(lessons)
      setFavoriteLessons(favorites)
      setAllHighlights(highlights)
      setHighlightBreakdown(breakdown)
      setSubjects(subs)
      setFolders(flds)
      setLoading(false)

      dashboardCache = {
        stats: computedStats,
        recentLessons: lessons,
        favoriteLessons: favorites,
        allHighlights: highlights,
        highlightBreakdown: breakdown,
        colorLabels: labelMap,
        subjects: subs,
        folders: flds
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const totalHl = useMemo(() => {
    return Object.values(highlightBreakdown).reduce((a, b) => a + b, 0)
  }, [highlightBreakdown])

  // Toggle favorite on card
  const toggleFavorite = async (e, lesson) => {
    e.stopPropagation()
    const next = !lesson.is_favorite
    const { error } = await supabase.from('lessons').update({ is_favorite: next }).eq('id', lesson.id)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(next ? 'Added to favorites' : 'Removed from favorites', 'info')
    setRecentLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_favorite: next } : l))
    setFavoriteLessons(prev => next ? [...prev, { ...lesson, is_favorite: true }] : prev.filter(l => l.id !== lesson.id))
  }

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // User display name from email
  const userDisplayName = useMemo(() => {
    if (!user?.email) return 'Reader'
    const namePart = user.email.split('@')[0]
    return namePart.charAt(0).toUpperCase() + namePart.slice(1)
  }, [user])

  // Most recent lesson for "Continue Reading"
  const latestLesson = recentLessons[0] || null

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* ─── HEADER SECTION ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title text-2xl sm:text-3xl font-bold tracking-tight">
              {greeting}, {userDisplayName} 👋
            </h1>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1 flex items-center gap-2">
            <Calendar size={14} className="text-brand-500" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setSearchOpen ? setSearchOpen(true) : navigate('/search')}
            className="btn btn-secondary text-xs sm:text-sm h-10 px-3.5"
            title="Search notes (Ctrl + K)"
          >
            <Search size={15} />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-surface-200 dark:bg-surface-700 rounded text-surface-500 dark:text-surface-300">
              Ctrl K
            </kbd>
          </button>

          {allHighlights.length > 0 && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="btn btn-secondary text-xs sm:text-sm h-10 px-3.5"
              title="Review highlights as flashcards"
            >
              <Sparkles size={15} className="text-amber-500" />
              <span>Review</span>
            </button>
          )}

          <button
            onClick={() => setShowFolderModal(true)}
            className="btn btn-secondary text-xs sm:text-sm h-10 px-3.5"
            title="Create a new folder"
          >
            <FolderPlus size={15} />
            <span className="hidden sm:inline">Folder</span>
          </button>

          <button
            onClick={() => setShowLessonModal(true)}
            className="btn btn-primary text-xs sm:text-sm h-10 px-4 shadow-sm"
          >
            <Plus size={16} />
            <span>New Lesson</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p className="text-sm text-surface-400">Loading your knowledge base…</p>
        </div>
      ) : (
        <>
          {/* ─── STATS METRICS GRID ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Lessons */}
            <div
              onClick={() => navigate('/library')}
              className="stat-card cursor-pointer group hover:border-brand-300 dark:hover:border-brand-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BookOpen size={22} />
                </div>
                <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-full border border-brand-200/60 dark:border-brand-800/60 flex items-center gap-0.5">
                  View <ChevronRight size={12} />
                </span>
              </div>
              <p className="text-3xl font-extrabold mt-3 tracking-tight">{stats.lessons}</p>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-0.5">Total Lessons</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                {stats.thisWeek > 0 ? `+${stats.thisWeek} added this week` : 'In your library'}
              </p>
            </div>

            {/* Highlights */}
            <div
              onClick={() => allHighlights.length > 0 ? setShowReviewModal(true) : navigate('/library?tab=highlighted')}
              className="stat-card cursor-pointer group hover:border-amber-300 dark:hover:border-amber-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Highlighter size={22} />
                </div>
                {allHighlights.length > 0 && (
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-0.5">
                    Review <Sparkles size={11} />
                  </span>
                )}
              </div>
              <p className="text-3xl font-extrabold mt-3 tracking-tight">{stats.highlights}</p>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-0.5">Highlights</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                across {stats.distinctLessons} {stats.distinctLessons === 1 ? 'lesson' : 'lessons'}
              </p>
            </div>

            {/* Added This Week */}
            <div
              onClick={() => navigate('/library')}
              className="stat-card cursor-pointer group hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar size={22} />
                </div>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                  Last 7 days
                </span>
              </div>
              <p className="text-3xl font-extrabold mt-3 tracking-tight">{stats.thisWeek}</p>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-0.5">Added This Week</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Recent study pace</p>
            </div>

            {/* Subjects & Folders */}
            <div
              onClick={() => navigate('/settings')}
              className="stat-card cursor-pointer group hover:border-pink-300 dark:hover:border-pink-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers size={22} />
                </div>
                <span className="text-[11px] font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-200/60 dark:border-pink-800/60 flex items-center gap-0.5">
                  Manage <ChevronRight size={12} />
                </span>
              </div>
              <p className="text-3xl font-extrabold mt-3 tracking-tight">
                {stats.subjects} <span className="text-lg font-normal text-surface-400">/ {stats.folders}</span>
              </p>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-0.5">Subjects & Folders</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Organized taxonomy</p>
            </div>
          </div>

          {/* ─── QUICK FOLDER NAVIGATION CHIPS ─── */}
          {folders.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 flex-shrink-0 flex items-center gap-1 mr-1">
                <Folder size={13} /> Quick Folders:
              </span>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/folder/${f.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 hover:bg-surface-200 dark:bg-surface-800/80 dark:hover:bg-surface-700 transition-colors flex-shrink-0 border border-surface-200/80 dark:border-surface-700/80"
                >
                  <Folder size={12} style={{ color: f.color || '#6366f1' }} />
                  <span>{f.name}</span>
                </button>
              ))}
              <button
                onClick={() => setShowFolderModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-surface-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-dashed border-surface-300 dark:border-surface-700 transition-colors flex-shrink-0"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          )}

          {/* ─── CONTINUE READING FEATURE CARD ─── */}
          {latestLesson && (
            <div className="relative overflow-hidden rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-gradient-to-r from-brand-50/70 via-white to-brand-50/30 dark:from-surface-900 dark:via-surface-900 dark:to-brand-950/30 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-brand-500 text-white">
                      <Sparkles size={11} /> Continue Reading
                    </span>
                    {latestLesson.folders?.name && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-surface-200/60 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-medium">
                        <Folder size={11} style={{ color: latestLesson.folders.color || '#6366f1' }} />
                        {latestLesson.folders.name}
                      </span>
                    )}
                    {latestLesson.subjects?.name && (
                      <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                        • {latestLesson.subjects.name}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white truncate">
                    {latestLesson.title}
                  </h2>
                  {latestLesson.content && (
                    <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 line-clamp-2 leading-relaxed">
                      {latestLesson.content.slice(0, 180)}…
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-surface-400 dark:text-surface-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {estimateReadingTime(latestLesson.content)}
                    </span>
                    {latestLesson.highlights?.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <Highlighter size={12} /> {latestLesson.highlights.length} {latestLesson.highlights.length === 1 ? 'highlight' : 'highlights'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center flex-shrink-0">
                  <button
                    onClick={() => setPreviewLessonId(latestLesson.id)}
                    className="btn btn-secondary text-xs sm:text-sm h-10 px-3.5"
                    title="Quick preview without leaving dashboard"
                  >
                    <Eye size={15} /> Preview
                  </button>
                  <button
                    onClick={() => navigate(`/lesson/${latestLesson.id}`)}
                    className="btn btn-primary text-xs sm:text-sm h-10 px-4 shadow-sm"
                  >
                    <span>Read Lesson</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── HIGHLIGHTS BREAKDOWN SECTION (FIXED LIGHT/DARK DESIGN) ─── */}
          {totalHl > 0 && (
            <div className="stat-card p-5 sm:p-6 border border-surface-200 dark:border-surface-800">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Highlighter size={16} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-surface-900 dark:text-surface-100">
                      Highlights by Color
                    </h2>
                    <p className="text-xs text-surface-400">
                      {totalHl} {totalHl === 1 ? 'total highlight' : 'total highlights'} across your library
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowReviewModal(true)}
                  className="btn btn-secondary text-xs h-8 px-3 flex items-center gap-1.5"
                >
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Review Flashcards</span>
                </button>
              </div>

              {/* Color badges chips (fixed styling in light and dark) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mb-5">
                {HIGHLIGHT_COLORS.map(c => {
                  const count = highlightBreakdown[c] || 0
                  const label = colorLabels[c] || COLOR_MAP[c].defaultLabel
                  const hex = COLOR_MAP[c].hex
                  return (
                    <div
                      key={c}
                      onClick={() => navigate(`/library?tab=highlighted&color=${c}`)}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/80 dark:bg-surface-800/60 hover:border-brand-300 dark:hover:border-surface-700 transition-all cursor-pointer group"
                      title={`Filter by ${label} in Library`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-xs" style={{ background: hex }} />
                        <span className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700 shadow-xs">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Progress bars with percentages */}
              <div className="space-y-3 pt-1 border-t border-surface-100 dark:border-surface-800/80">
                {HIGHLIGHT_COLORS.filter(c => (highlightBreakdown[c] || 0) > 0).map(c => {
                  const count = highlightBreakdown[c] || 0
                  const pct = Math.round((count / totalHl) * 100)
                  const label = colorLabels[c] || COLOR_MAP[c].defaultLabel
                  const hex = COLOR_MAP[c].hex

                  return (
                    <div key={c} className="flex items-center gap-3 text-xs">
                      <div className="w-24 sm:w-28 flex items-center gap-1.5 flex-shrink-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hex }} />
                        <span className="text-surface-600 dark:text-surface-300 font-medium truncate capitalize">
                          {label}
                        </span>
                      </div>
                      {/* Fixed progress bar track with subtle background */}
                      <div className="flex-1 bg-surface-200/70 dark:bg-surface-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: hex
                          }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-[11px] font-semibold text-surface-600 dark:text-surface-400 flex-shrink-0">
                        {count} ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── RECENT & FAVORITES SECTION ─── */}
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'recent'
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  <Clock size={15} />
                  <span>Recently Added</span>
                  <span className={`text-xs px-1.5 py-0.2 rounded-full ${activeTab === 'recent' ? 'bg-white/20' : 'bg-surface-200 dark:bg-surface-700'}`}>
                    {recentLessons.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'favorites'
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  <Star size={14} className={activeTab === 'favorites' ? 'fill-white text-white' : 'text-amber-500'} />
                  <span>Favorites</span>
                  <span className={`text-xs px-1.5 py-0.2 rounded-full ${activeTab === 'favorites' ? 'bg-white/20' : 'bg-surface-200 dark:bg-surface-700'}`}>
                    {favoriteLessons.length}
                  </span>
                </button>
              </div>

              <button
                onClick={() => navigate('/library')}
                className="btn btn-ghost text-xs sm:text-sm flex items-center gap-1 text-surface-500 hover:text-brand-500"
              >
                <span>View all in Library</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* List / Cards */}
            {activeTab === 'recent' && recentLessons.length === 0 ? (
              <div className="empty-state p-12 text-center border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-white dark:bg-surface-900/50">
                <BookOpen size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                <p className="font-semibold text-lg text-surface-800 dark:text-surface-200">Your library is empty</p>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 mb-5">
                  Start building your knowledge by creating your first lesson or note.
                </p>
                <button
                  onClick={() => setShowLessonModal(true)}
                  className="btn btn-primary inline-flex items-center gap-1.5"
                >
                  <Plus size={16} /> Add First Lesson
                </button>
              </div>
            ) : activeTab === 'favorites' && favoriteLessons.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-white dark:bg-surface-900/50">
                <Star size={40} className="mx-auto text-amber-400 mb-2" />
                <p className="font-semibold text-base text-surface-800 dark:text-surface-200">No favorite lessons yet</p>
                <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1">
                  Click the star icon on any lesson card to pin your most important notes here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeTab === 'recent' ? recentLessons : favoriteLessons).map(lesson => (
                  <div
                    key={lesson.id}
                    onClick={() => navigate(`/lesson/${lesson.id}`)}
                    className="lesson-card group flex flex-col justify-between p-5 border border-surface-200 dark:border-surface-800 rounded-xl bg-white dark:bg-surface-900 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all cursor-pointer relative"
                  >
                    <div>
                      {/* Card Top: Badges & Favorite */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lesson.folders?.name ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded text-white"
                              style={{ background: lesson.folders.color || '#6366f1' }}
                            >
                              <Folder size={11} />
                              {lesson.folders.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">
                              <BookOpen size={11} /> Lesson
                            </span>
                          )}

                          {lesson.subjects?.name && (
                            <span className="text-[11px] font-medium text-surface-500 dark:text-surface-400">
                              {lesson.subjects.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewLessonId(lesson.id)
                            }}
                            className="p-1 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            title="Quick preview"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => toggleFavorite(e, lesson)}
                            className="p-1 rounded text-surface-400 hover:text-amber-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            title={lesson.is_favorite ? 'Remove favorite' : 'Mark favorite'}
                          >
                            <Star
                              size={15}
                              className={lesson.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-surface-400'}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-base text-surface-900 dark:text-white line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {lesson.title}
                      </h3>

                      {/* Excerpt */}
                      {lesson.content && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-2 line-clamp-2 leading-relaxed">
                          {lesson.content}
                        </p>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-xs text-surface-400 dark:text-surface-500">
                      <div className="flex items-center gap-2">
                        <span>{formatRelativeDate(lesson.created_at)}</span>
                        <span>•</span>
                        <span>{estimateReadingTime(lesson.content)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {lesson.highlights?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                            <Highlighter size={10} />
                            {lesson.highlights.length}
                          </span>
                        ) : (
                          <span className="text-[11px] text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            Open <ArrowRight size={11} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MODALS & DRAWERS ─── */}
      {showLessonModal && (
        <LessonModal
          subjects={subjects}
          folders={folders}
          onClose={() => setShowLessonModal(false)}
          onSaved={() => {
            setShowLessonModal(false)
            fetchDashboardData()
          }}
        />
      )}

      {showFolderModal && (
        <FolderModal
          allFolders={folders}
          onClose={() => setShowFolderModal(false)}
          onSaved={() => {
            setShowFolderModal(false)
            fetchDashboardData()
          }}
        />
      )}

      {showReviewModal && allHighlights.length > 0 && (
        <HighlightReviewModal
          highlights={allHighlights}
          onClose={() => setShowReviewModal(false)}
          onJumpToHighlight={(hlId) => {
            const found = allHighlights.find(h => h.id === hlId)
            if (found?.lesson_id) navigate(`/lesson/${found.lesson_id}`)
          }}
        />
      )}

      {previewLessonId && (
        <QuickPreviewDrawer
          lessonId={previewLessonId}
          onClose={() => setPreviewLessonId(null)}
          onLessonUpdated={() => fetchDashboardData()}
        />
      )}
    </div>
  )
}
