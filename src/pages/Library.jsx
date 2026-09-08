import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Grid, List, Star, StarOff, Trash2, BookOpen,
  Filter, Tag, SortAsc, Search, FolderOpen, Folder, FolderPlus,
  ChevronRight, Upload, CheckSquare, Square, MoreVertical,
  Copy, Download, Eye, FolderInput, Sparkles, Clock, Check, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import LessonModal from '../components/LessonModal'
import FolderModal from '../components/FolderModal'
import ImportModal from '../components/ImportModal'
import MoveFolderModal from '../components/MoveFolderModal'
import QuickPreviewDrawer from '../components/QuickPreviewDrawer'

const HL_COLORS = {
  yellow: { label: 'Yellow', hex: '#facc15' },
  pink:   { label: 'Pink',   hex: '#ec4899' },
  blue:   { label: 'Blue',   hex: '#3b82f6' },
  green:  { label: 'Green',  hex: '#22c55e' },
  purple: { label: 'Purple', hex: '#a855f7' },
}

export default function Library() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [lessons, setLessons] = useState([])
  const [subjects, setSubjects] = useState([])
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  // View & Filter States
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'favorites' | 'highlighted' | 'unfiled'
  const [selectedColor, setSelectedColor] = useState('') // '' | 'yellow' | 'pink' | etc.
  const [filterSubject, setFilterSubject] = useState('')
  const [filterFolder, setFilterFolder] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [localSearch, setLocalSearch] = useState('')

  // Multi-Select States
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modal / Drawer States
  const [showLessonModal, setShowLessonModal] = useState(searchParams.get('new') === '1')
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [moveModalLessonIds, setMoveModalLessonIds] = useState(null) // array of IDs or null
  const [previewLessonId, setPreviewLessonId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)

  // Fetch Meta (Subjects, Folders, Tags)
  const fetchMeta = () => {
    if (!user) return
    Promise.all([
      supabase.from('subjects').select('*').eq('user_id', user.id).order('name'),
      supabase.from('folders').select('*, lessons(id)').eq('user_id', user.id).order('name'),
      supabase.from('tags').select('*').eq('user_id', user.id).order('name'),
    ]).then(([s, f, t]) => {
      setSubjects(s.data || [])
      setFolders(f.data || [])
      setTags(t.data || [])
    })
  }

  useEffect(() => {
    fetchMeta()
  }, [user])

  // Fetch Lessons
  const fetchLessons = async () => {
    if (!user) return
    setLoading(true)
    let q = supabase
      .from('lessons')
      .select('*, subjects(name,color), folders(id,name,color), highlights(id,color,text_snippet,note)')
      .eq('user_id', user.id)

    if (filterSubject) q = q.eq('subject_id', filterSubject)
    if (filterFolder) q = q.eq('folder_id', filterFolder)
    if (localSearch) q = q.ilike('title', `%${localSearch}%`)

    switch (sortBy) {
      case 'date_desc': q = q.order('created_at', { ascending: false }); break
      case 'date_asc':  q = q.order('created_at', { ascending: true });  break
      case 'title':     q = q.order('title');                             break
    }

    const { data } = await q
    setLessons(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) fetchLessons()
  }, [user, filterSubject, filterFolder, sortBy, localSearch])

  // Client-side filtering for Tabs & Highlight Colors
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      // Tab filter
      if (activeTab === 'favorites' && !l.is_favorite) return false
      if (activeTab === 'highlighted' && (!l.highlights || l.highlights.length === 0)) return false
      if (activeTab === 'unfiled' && l.folder_id) return false

      // Highlight color filter
      if (selectedColor) {
        const hasColor = l.highlights?.some(h => h.color === selectedColor)
        if (!hasColor) return false
      }

      return true
    })
  }, [lessons, activeTab, selectedColor])

  // Favorites
  const toggleFavorite = async (e, lesson) => {
    e.stopPropagation()
    const next = !lesson.is_favorite
    await supabase.from('lessons').update({ is_favorite: next }).eq('id', lesson.id)
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_favorite: next } : l))
  }

  // Delete Single Lesson
  const deleteLesson = async (e, id) => {
    if (e) e.stopPropagation()
    if (!confirm('Delete this lesson? This will also delete all its highlights.')) return
    await supabase.from('lessons').delete().eq('id', id)
    showToast('Lesson deleted', 'info')
    setLessons(prev => prev.filter(l => l.id !== id))
    fetchMeta()
  }

  // Duplicate / Clone Lesson
  const duplicateLesson = async (e, lesson) => {
    if (e) e.stopPropagation()
    setOpenMenuId(null)

    const payload = {
      user_id: user.id,
      title: `${lesson.title} (Copy)`,
      content: lesson.content,
      folder_id: lesson.folder_id || null,
      subject_id: lesson.subject_id || null,
      is_favorite: lesson.is_favorite || false,
    }

    const { data: newLesson, error } = await supabase
      .from('lessons')
      .insert(payload)
      .select()
      .single()

    if (error || !newLesson) {
      showToast('Failed to duplicate lesson', 'error')
      return
    }

    // Duplicate highlights if any
    if (lesson.highlights && lesson.highlights.length > 0) {
      const hlPayload = lesson.highlights.map(h => ({
        lesson_id: newLesson.id,
        text_snippet: h.text_snippet,
        start_offset: h.start_offset,
        end_offset: h.end_offset,
        color: h.color,
        note: h.note || '',
      }))
      await supabase.from('highlights').insert(hlPayload)
    }

    showToast('Lesson duplicated!', 'success')
    fetchLessons()
    fetchMeta()
  }

  // Export single lesson as Markdown
  const exportLessonMarkdown = (e, lesson) => {
    if (e) e.stopPropagation()
    setOpenMenuId(null)

    const md = [
      `# ${lesson.title}\n`,
      lesson.content,
      lesson.highlights?.length ? `\n---\n## Highlights\n` : '',
      ...(lesson.highlights || []).map(
        h => `- **[${h.color}]** "${h.text_snippet}"${h.note ? `\n  > Note: ${h.note}` : ''}`
      )
    ].filter(Boolean).join('\n')

    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${lesson.title.replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    showToast('Downloaded Markdown file', 'info')
  }

  // Multi-Select Helpers
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredLessons.map(l => l.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  // Batch Delete
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected lessons? This cannot be undone.`)) return

    const { error } = await supabase.from('lessons').delete().in('id', Array.from(selectedIds))
    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast(`Deleted ${selectedIds.size} lessons`, 'info')
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchLessons()
    fetchMeta()
  }

  // Batch Export as Combined Markdown
  const handleBatchExport = () => {
    if (selectedIds.size === 0) return
    const targetLessons = lessons.filter(l => selectedIds.has(l.id))

    const fullMd = targetLessons.map(l => {
      return [
        `# ${l.title}\n`,
        `*Folder: ${l.folders?.name || 'Unorganized'} | Subject: ${l.subjects?.name || 'None'}*\n`,
        l.content,
        l.highlights?.length ? `\n### Highlights\n` : '',
        ...(l.highlights || []).map(
          h => `- **[${h.color}]** "${h.text_snippet}"${h.note ? `\n  > Note: ${h.note}` : ''}`
        )
      ].filter(Boolean).join('\n')
    }).join('\n\n---\n\n')

    const blob = new Blob([fullMd], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Maktaba_Export_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    showToast(`Exported ${selectedIds.size} lessons!`, 'success')
  }

  // Batch Favorite
  const handleBatchFavorite = async (makeFavorite = true) => {
    if (selectedIds.size === 0) return
    await supabase.from('lessons').update({ is_favorite: makeFavorite }).in('id', Array.from(selectedIds))
    showToast(`Updated ${selectedIds.size} lessons`, 'success')
    setSelectedIds(new Set())
    fetchLessons()
  }

  // Top-level folders for folders grid
  const topLevelFolders = folders.filter(f => !f.parent_id)

  // Reading time & word count helper
  const getReadTime = (text = '') => {
    const words = text.trim().split(/\s+/).filter(Boolean).length
    const min = Math.max(1, Math.round(words / 200))
    return { words, min }
  }

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.card-menu-trigger') && !e.target.closest('.card-menu-dropdown')) {
        setOpenMenuId(null)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="text-surface-400 text-sm mt-1">
            {filteredLessons.length} of {lessons.length} lessons
            {folders.length > 0 && ` • ${folders.length} folders`}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setSelectMode(!selectMode)
              setSelectedIds(new Set())
            }}
            className={`btn text-xs sm:text-sm ${selectMode ? 'btn-primary' : 'btn-secondary'}`}
          >
            <CheckSquare size={15} />
            {selectMode ? 'Exit Select' : 'Select'}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary text-xs sm:text-sm"
          >
            <Upload size={15} /> Import
          </button>

          <button
            onClick={() => setShowFolderModal(true)}
            className="btn btn-secondary text-xs sm:text-sm"
          >
            <FolderPlus size={15} /> New Folder
          </button>

          <button
            onClick={() => setShowLessonModal(true)}
            className="btn btn-primary text-xs sm:text-sm"
          >
            <Plus size={15} /> New Lesson
          </button>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectMode && (
        <div className="sticky top-4 z-40 p-3.5 bg-surface-900 text-white dark:bg-surface-800 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-fade-in flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 bg-brand-500 rounded-lg">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={selectedIds.size === filteredLessons.length ? deselectAll : selectAll}
              className="text-xs text-surface-300 hover:text-white underline transition-colors"
            >
              {selectedIds.size === filteredLessons.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={selectedIds.size === 0}
              onClick={() => setMoveModalLessonIds(Array.from(selectedIds))}
              className="btn btn-secondary text-xs bg-surface-800 text-white hover:bg-surface-700 border-none disabled:opacity-50"
            >
              <FolderInput size={14} /> Move to Folder
            </button>

            <button
              disabled={selectedIds.size === 0}
              onClick={handleBatchExport}
              className="btn btn-secondary text-xs bg-surface-800 text-white hover:bg-surface-700 border-none disabled:opacity-50"
            >
              <Download size={14} /> Export
            </button>

            <button
              disabled={selectedIds.size === 0}
              onClick={() => handleBatchFavorite(true)}
              className="btn btn-secondary text-xs bg-surface-800 text-white hover:bg-surface-700 border-none disabled:opacity-50"
            >
              <Star size={14} /> Favorite
            </button>

            <button
              disabled={selectedIds.size === 0}
              onClick={handleBatchDelete}
              className="btn text-xs bg-red-600 hover:bg-red-700 text-white border-none disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>

            <button
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
              className="btn btn-ghost p-1.5 text-surface-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Folders Overview Grid (Top of Library) */}
      {topLevelFolders.length > 0 && !filterFolder && activeTab === 'all' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Folders</h2>
            <button
              onClick={() => setShowFolderModal(true)}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
            >
              <Plus size={13} /> Add Folder
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {topLevelFolders.map(folder => (
              <div
                key={folder.id}
                onClick={() => navigate(`/folder/${folder.id}`)}
                className="lesson-card group cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition-all p-3.5 flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                  style={{ background: folder.color || '#6366f1' }}
                >
                  <Folder size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate group-hover:text-brand-500 transition-colors">
                    {folder.name}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {folder.lessons?.length || 0} {folder.lessons?.length === 1 ? 'lesson' : 'lessons'}
                  </p>
                </div>
                <ChevronRight size={15} className="text-surface-300 group-hover:text-brand-500 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Smart Filter Tabs & Highlight Color Filter Bar */}
      <div className="space-y-3.5 border-b border-surface-200 dark:border-surface-800 pb-4">
        {/* Preset Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all',         label: 'All Lessons' },
            { id: 'favorites',   label: '⭐ Favorites' },
            { id: 'highlighted', label: '🖍️ Highlighted' },
            { id: 'unfiled',     label: '📂 Unfiled' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Highlight Color Filter Pills */}
          <div className="ml-auto flex items-center gap-1.5 pl-3 border-l border-surface-200 dark:border-surface-800">
            <span className="text-[11px] font-medium text-surface-400 hidden sm:inline">Highlight Color:</span>
            {selectedColor && (
              <button
                onClick={() => setSelectedColor('')}
                className="text-[11px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 underline mr-1"
              >
                Clear
              </button>
            )}
            {Object.entries(HL_COLORS).map(([cKey, { label, hex }]) => (
              <button
                key={cKey}
                onClick={() => setSelectedColor(selectedColor === cKey ? '' : cKey)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  selectedColor === cKey
                    ? 'ring-2 ring-offset-2 ring-brand-500 scale-110'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
                style={{ background: hex }}
                title={`Filter by ${label} highlights`}
              >
                {selectedColor === cKey && <Check size={12} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="input-field pl-8 h-9 text-xs"
              placeholder="Search lessons…"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field h-9 text-xs w-auto"
            value={filterFolder}
            onChange={e => setFilterFolder(e.target.value)}
          >
            <option value="">All Folders</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>

          <select
            className="input-field h-9 text-xs w-auto"
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            className="input-field h-9 text-xs w-auto"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="title">Title A–Z</option>
          </select>

          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn h-9 w-9 p-0 justify-center ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn h-9 w-9 p-0 justify-center ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Lessons Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="empty-state py-16">
          <FolderOpen size={48} className="text-surface-300" />
          <p className="font-semibold text-base mt-3">No lessons match your filter</p>
          <p className="text-xs text-surface-400 mt-1 mb-4">
            Try adjusting your search, filters, or create a new lesson.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('all')
                setSelectedColor('')
                setFilterSubject('')
                setFilterFolder('')
                setLocalSearch('')
              }}
              className="btn btn-secondary text-xs"
            >
              Reset Filters
            </button>
            <button onClick={() => setShowLessonModal(true)} className="btn btn-primary text-xs">
              <Plus size={14} /> New Lesson
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map(lesson => {
            const isSelected = selectedIds.has(lesson.id)
            const { words, min } = getReadTime(lesson.content)

            return (
              <div
                key={lesson.id}
                onClick={() => {
                  if (selectMode) toggleSelectId(lesson.id)
                  else navigate(`/lesson/${lesson.id}`)
                }}
                className={`lesson-card group relative transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 ring-brand-500 bg-brand-50/20 dark:bg-brand-950/20'
                    : ''
                }`}
              >
                <div>
                  {/* Top Bar Indicator */}
                  <div
                    className="h-1.5 rounded-full mb-3"
                    style={{
                      background: lesson.subjects?.color || lesson.folders?.color || '#6366f1'
                    }}
                  />

                  {/* Header & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    {selectMode ? (
                      <div className="p-1">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-brand-500" />
                        ) : (
                          <Square size={18} className="text-surface-400" />
                        )}
                      </div>
                    ) : null}

                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1 group-hover:text-brand-500 transition-colors">
                      {lesson.title}
                    </h3>

                    {/* Favorite Button */}
                    {!selectMode && (
                      <button
                        onClick={e => toggleFavorite(e, lesson)}
                        className="flex-shrink-0 text-surface-300 hover:text-amber-400 transition-colors p-1"
                      >
                        {lesson.is_favorite ? (
                          <Star size={15} className="text-amber-400 fill-amber-400" />
                        ) : (
                          <StarOff size={15} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Badges (Folder & Subject) */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {lesson.folders && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md text-white"
                        style={{ background: lesson.folders.color || '#6366f1' }}
                      >
                        <Folder size={9} />
                        {lesson.folders.name}
                      </span>
                    )}
                    {lesson.subjects?.name && (
                      <span className="text-[11px] text-surface-400 font-medium">
                        {lesson.subjects.name}
                      </span>
                    )}
                  </div>

                  {/* Snippet Preview */}
                  {lesson.content && (
                    <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mt-2.5 leading-relaxed">
                      {lesson.content}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-xs text-surface-400">
                  <div className="flex items-center gap-2">
                    {lesson.highlights?.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {[...new Set(lesson.highlights.map(h => h.color))].map(c => (
                          <span
                            key={c}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: HL_COLORS[c]?.hex || '#ccc' }}
                          />
                        ))}
                        <span className="text-[11px] text-surface-400 ml-0.5">
                          {lesson.highlights.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-surface-400">{min} min read</span>
                    )}
                  </div>

                  <span className="text-[11px]">
                    {new Date(lesson.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>

                  {/* Hover Actions Bar */}
                  {!selectMode && (
                    <div
                      className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-surface-900/95 p-1 rounded-xl shadow-md border border-surface-200 dark:border-surface-700"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setPreviewLessonId(lesson.id)}
                        className="btn btn-ghost p-1 text-surface-500 hover:text-brand-500"
                        title="Quick Preview"
                      >
                        <Eye size={14} />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === lesson.id ? null : lesson.id)}
                          className="btn btn-ghost p-1 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 card-menu-trigger"
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === lesson.id && (
                          <div className="card-menu-dropdown absolute right-0 bottom-8 z-50 w-40 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 py-1 text-xs animate-fade-in">
                            <button
                              onClick={e => duplicateLesson(e, lesson)}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center gap-2"
                            >
                              <Copy size={13} /> Duplicate
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                setMoveModalLessonIds([lesson.id])
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center gap-2"
                            >
                              <FolderInput size={13} /> Move to…
                            </button>
                            <button
                              onClick={e => exportLessonMarkdown(e, lesson)}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center gap-2"
                            >
                              <Download size={13} /> Export .md
                            </button>
                            <div className="border-t border-surface-100 dark:border-surface-700 my-1" />
                            <button
                              onClick={e => {
                                setOpenMenuId(null)
                                deleteLesson(e, lesson.id)
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 flex items-center gap-2"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-1.5">
          {filteredLessons.map(lesson => {
            const isSelected = selectedIds.has(lesson.id)
            const { min } = getReadTime(lesson.content)

            return (
              <div
                key={lesson.id}
                onClick={() => {
                  if (selectMode) toggleSelectId(lesson.id)
                  else navigate(`/lesson/${lesson.id}`)
                }}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors group relative ${
                  isSelected ? 'bg-brand-50/30 dark:bg-brand-950/30' : ''
                }`}
              >
                {selectMode && (
                  <div onClick={e => { e.stopPropagation(); toggleSelectId(lesson.id) }}>
                    {isSelected ? (
                      <CheckSquare size={16} className="text-brand-500" />
                    ) : (
                      <Square size={16} className="text-surface-400" />
                    )}
                  </div>
                )}

                <div
                  className="w-2 h-9 rounded-full flex-shrink-0"
                  style={{
                    background: lesson.subjects?.color || lesson.folders?.color || '#6366f1'
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{lesson.title}</p>
                    {lesson.folders && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                        style={{ background: lesson.folders.color || '#6366f1' }}
                      >
                        <Folder size={9} />
                        {lesson.folders.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5 truncate">
                    {lesson.subjects?.name ? `${lesson.subjects.name} • ` : ''}
                    {min} min read
                  </p>
                </div>

                {/* Highlights Counter */}
                <div className="flex items-center gap-1">
                  {lesson.highlights?.length > 0 && (
                    <>
                      {[...new Set(lesson.highlights.map(h => h.color))].map(c => (
                        <span
                          key={c}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: HL_COLORS[c]?.hex || '#ccc' }}
                        />
                      ))}
                      <span className="text-xs text-surface-400 ml-1">
                        {lesson.highlights.length}
                      </span>
                    </>
                  )}
                </div>

                <p className="text-xs text-surface-400 w-24 text-right">
                  {new Date(lesson.created_at).toLocaleDateString()}
                </p>

                {/* Actions on hover */}
                {!selectMode && (
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setPreviewLessonId(lesson.id)}
                      className="btn btn-ghost p-1 text-surface-400 hover:text-brand-500"
                      title="Quick Preview"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={e => toggleFavorite(e, lesson)}
                      className="btn btn-ghost p-1"
                    >
                      {lesson.is_favorite ? (
                        <Star size={15} className="text-amber-400 fill-amber-400" />
                      ) : (
                        <StarOff size={15} />
                      )}
                    </button>
                    <button
                      onClick={e => duplicateLesson(e, lesson)}
                      className="btn btn-ghost p-1 text-surface-400 hover:text-brand-500"
                      title="Duplicate"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={e => deleteLesson(e, lesson.id)}
                      className="btn btn-ghost p-1 text-red-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals & Drawers */}
      {showLessonModal && (
        <LessonModal
          subjects={subjects}
          folders={folders}
          defaultFolderId={filterFolder}
          onClose={() => setShowLessonModal(false)}
          onSaved={() => {
            setShowLessonModal(false)
            fetchLessons()
            fetchMeta()
          }}
        />
      )}

      {showFolderModal && (
        <FolderModal
          allFolders={folders}
          onClose={() => setShowFolderModal(false)}
          onSaved={() => {
            setShowFolderModal(false)
            fetchMeta()
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          folders={folders}
          subjects={subjects}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false)
            fetchLessons()
            fetchMeta()
          }}
        />
      )}

      {moveModalLessonIds && (
        <MoveFolderModal
          lessonIds={moveModalLessonIds}
          folders={folders}
          onClose={() => setMoveModalLessonIds(null)}
          onMoved={() => {
            setMoveModalLessonIds(null)
            setSelectedIds(new Set())
            setSelectMode(false)
            fetchLessons()
            fetchMeta()
          }}
        />
      )}

      {previewLessonId && (
        <QuickPreviewDrawer
          lessonId={previewLessonId}
          onClose={() => setPreviewLessonId(null)}
          onLessonUpdated={() => fetchLessons()}
        />
      )}
    </div>
  )
}
