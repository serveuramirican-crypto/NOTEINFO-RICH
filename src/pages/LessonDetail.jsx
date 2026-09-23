import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, StarOff, Highlighter,
  Save, Edit3, Download, Folder,
  Sparkles, Maximize2, Minimize2, Clock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import HighlightToolbar from '../components/HighlightToolbar'
import HighlightsPanel from '../components/HighlightsPanel'
import HighlightReviewModal from '../components/HighlightReviewModal'
import { applyHighlightsToContent, getRangeOffsets } from '../lib/highlightUtils'

export default function LessonDetail() {
  const { id } = useParams()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  // Persistent Font Size: '15px' | '17px' | '19px' | '21px'
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('maktaba_font_size') || '17px'
  })

  const changeFontSize = (delta) => {
    const SIZES = ['15px', '17px', '19px', '21px', '23px']
    const currentIndex = SIZES.indexOf(fontSize) !== -1 ? SIZES.indexOf(fontSize) : 1
    const nextIndex = Math.max(0, Math.min(SIZES.length - 1, currentIndex + delta))
    const newSize = SIZES[nextIndex]
    setFontSize(newSize)
    localStorage.setItem('maktaba_font_size', newSize)
  }

  // Toolbar state
  const [toolbar, setToolbar] = useState(null) // { x, y, selectionText, startOffset, endOffset }

  const contentRef = useRef(null)
  const lessonContentRef = useRef('') // always holds latest lesson.content for offset calc

  // Reading progress tracker
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100))
        setScrollProgress(progress)
      } else {
        setScrollProgress(0)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Focus mode exit on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusMode])

  // Estimated reading time and word count
  const readingStats = useMemo(() => {
    if (!lesson?.content) return { words: 0, minutes: 1 }
    const clean = lesson.content.replace(/[#*`_>[\]()]/g, ' ').trim()
    const words = clean ? clean.split(/\s+/).length : 0
    const minutes = Math.max(1, Math.ceil(words / 180))
    return { words, minutes }
  }, [lesson?.content])

  // Memoized rendered content with highlights
  const renderedContent = useMemo(() => {
    if (editing || !lesson) return null
    return applyHighlightsToContent(lesson.content || '', highlights)
  }, [editing, lesson, highlights])

  // Fetch lesson and highlights
  const fetchData = useCallback(async () => {
    const [{ data: l }, { data: h }] = await Promise.all([
      supabase.from('lessons').select('*, subjects(name,color), folders(id,name,color)').eq('id', id).single(),
      supabase.from('highlights').select('*').eq('lesson_id', id).order('start_offset'),
    ])
    setLesson(l)
    setHighlights(h || [])
    setEditContent(l?.content || '')
    setEditTitle(l?.title || '')
    lessonContentRef.current = l?.content || ''
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Saved selection ref so we can restore it after toolbar appears
  const savedSelectionRef = useRef(null)

  // Text selection → show toolbar
  const handleSelection = useCallback((e) => {
    if (editing) return
    // Don't show toolbar if user clicked on highlight toolbar itself
    if (e?.target?.closest('.highlight-toolbar')) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return
    }
    // Check selection is inside content area
    const range = selection.getRangeAt(0)
    const container = contentRef.current
    if (!container || !container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return
    }
    const selectionText = selection.toString().trim()
    if (!selectionText) return

    const rect = range.getBoundingClientRect()
    // Fallback if rect is invalid
    if (rect.width === 0 && rect.height === 0) return

    // Compute offset accurately from the selection range inside the container
    let start = 0
    let end = selectionText.length
    try {
      const offsets = getRangeOffsets(range, container)
      if (offsets && typeof offsets.start === 'number') {
        start = offsets.start
        end = offsets.end
      }
    } catch {
      start = 0
      end = selectionText.length
    }

    // Save selection so toolbar button clicks can still find it
    savedSelectionRef.current = { selectionText, start, end }

    setToolbar({
      x: Math.max(100, Math.min(window.innerWidth - 100, rect.left + rect.width / 2)),
      y: rect.top,
      selectionText,
      startOffset: start,
      endOffset: end,
    })
  }, [editing])

  // Bind mouseup to contentRef
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.addEventListener('mouseup', handleSelection)
    el.addEventListener('touchend', handleSelection)
    return () => {
      el.removeEventListener('mouseup', handleSelection)
      el.removeEventListener('touchend', handleSelection)
    }
  }, [handleSelection, renderedContent])

  // Pick highlight color
  const onPickColor = async (color) => {
    let saved = toolbar
    if (!saved || !saved.selectionText) {
      saved = savedSelectionRef.current
    }
    if (!saved || !saved.selectionText) return

    const { selectionText, startOffset, endOffset } = saved
    setToolbar(null)
    savedSelectionRef.current = null
    window.getSelection()?.removeAllRanges()

    const newHl = {
      lesson_id: id,
      color,
      start_offset: startOffset,
      end_offset: endOffset,
      text_snippet: selectionText,
    }

    const { data, error } = await supabase.from('highlights').insert(newHl).select().single()
    if (error) {
      showToast('Failed to save highlight', 'error')
      return
    }

    setHighlights(prev => [...prev, data].sort((a, b) => a.start_offset - b.start_offset))
    showToast('Highlighted!', 'success')
  }

  // Delete highlight
  const deleteHighlight = async (highlightId) => {
    await supabase.from('highlights').delete().eq('id', highlightId)
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
    showToast('Highlight deleted')
  }

  // Update note
  const updateHighlightNote = async (highlightId, note) => {
    await supabase.from('highlights').update({ note }).eq('id', highlightId)
    setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, note } : h))
    showToast('Note saved!')
  }

  // Change highlight color
  const changeHighlightColor = async (highlightId, newColor) => {
    const { error } = await supabase.from('highlights').update({ color: newColor }).eq('id', highlightId)
    if (!error) {
      setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, color: newColor } : h))
      showToast('Color updated!', 'success')
    }
  }

  // Scroll to a highlight with pulse animation
  const scrollToHighlight = (highlightId) => {
    const el = contentRef.current?.querySelector(`[data-hl="${highlightId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-pulse-active')
      setTimeout(() => { el.classList.remove('highlight-pulse-active') }, 1200)
    }
  }

  // Save edits
  const saveEdits = async () => {
    setSaving(true)
    await supabase.from('lessons').update({
      title: editTitle,
      content: editContent,
    }).eq('id', id)
    setLesson(prev => ({ ...prev, title: editTitle, content: editContent }))
    setSaving(false)
    setEditing(false)
    showToast('Saved!', 'success')
  }

  // Toggle favorite
  const toggleFavorite = async () => {
    const next = !lesson.is_favorite
    await supabase.from('lessons').update({ is_favorite: next }).eq('id', id)
    setLesson(prev => ({ ...prev, is_favorite: next }))
  }

  // Export to Markdown
  const exportMarkdown = () => {
    const md = [`# ${lesson.title}\n`,
      lesson.content,
      `\n---\n## Highlights (${highlights.length})\n`,
      ...highlights.map((h, i) => `${i + 1}. **[${h.color.toUpperCase()}]** "${h.text_snippet}"${h.note ? `\n   > *Note:* ${h.note}` : ''}`)
    ].join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${lesson.title || 'lesson'}.md`
    a.click()
  }

  // Keyboard shortcuts: 1-5 to highlight
  useEffect(() => {
    if (!toolbar) return
    const KEYS = { '1': 'yellow', '2': 'pink', '3': 'blue', '4': 'green', '5': 'purple' }
    const handler = (e) => {
      if (KEYS[e.key]) onPickColor(KEYS[e.key])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toolbar])

  // Dismiss toolbar on click outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.highlight-toolbar') && !e.target.closest('.note-popover')) {
        setTimeout(() => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed || !sel.toString().trim()) {
            setToolbar(null)
          }
        }, 150)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  if (!lesson) return (
    <div className="p-8 text-center text-surface-400">
      Lesson not found. <button onClick={() => navigate(-1)} className="text-brand-500 underline">Go back</button>
    </div>
  )

  return (
    <div className={`flex min-h-screen ${focusMode ? 'fixed inset-0 z-50 bg-[#f8f8fc] dark:bg-[#0f0f14] overflow-y-auto' : ''}`}>
      {/* Reading Progress Bar */}
      {!editing && (
        <div
          className="reading-progress-bar"
          style={{ width: `${scrollProgress}%` }}
        />
      )}

      {/* Main lesson area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white/85 dark:bg-surface-950/85 backdrop-blur-md border-b border-surface-200 dark:border-surface-800 px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 shadow-xs">
          
          {/* Left section: back & title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => {
                if (focusMode) setFocusMode(false)
                else navigate(-1)
              }}
              className="btn btn-ghost p-1.5 flex-shrink-0 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            {editing ? (
              <input
                dir="auto"
                className="input-field flex-1 h-9 text-sm font-semibold"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1 dir="auto" className="font-bold text-sm sm:text-base truncate text-surface-900 dark:text-surface-100">
                  {lesson.title}
                </h1>
                {/* Word count & read time */}
                <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-surface-400 font-medium whitespace-nowrap bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                  <Clock size={11} /> {readingStats.minutes} min read
                </span>
              </div>
            )}
          </div>

          {/* Center/Right metadata tags */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {lesson.folders?.name && (
              <button
                onClick={() => navigate(`/folder/${lesson.folders.id}`)}
                className="tag-chip hidden md:inline-flex items-center gap-1 hover:opacity-80 transition-opacity text-xs"
                style={{
                  background: (lesson.folders.color || '#6366f1') + '1a',
                  color: lesson.folders.color || '#6366f1',
                  borderColor: (lesson.folders.color || '#6366f1') + '33'
                }}
              >
                <Folder size={11} />
                {lesson.folders.name}
              </button>
            )}

            {lesson.subjects?.name && (
              <span
                className="tag-chip hidden lg:flex text-xs"
                style={{
                  background: (lesson.subjects.color || '#6366f1') + '1a',
                  color: lesson.subjects.color || '#6366f1',
                  borderColor: (lesson.subjects.color || '#6366f1') + '33'
                }}
              >
                {lesson.subjects.name}
              </span>
            )}

            {/* Favorite toggle */}
            <button onClick={toggleFavorite} className="btn btn-ghost p-1.5" title="Favorite">
              {lesson.is_favorite
                ? <Star size={17} className="text-amber-400 fill-amber-400" />
                : <StarOff size={17} className="text-surface-400" />}
            </button>

            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-secondary h-8 text-xs px-3">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="btn btn-primary h-8 text-xs px-3">
                  {saving ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <><Save size={14} /> Save</>}
                </button>
              </>
            ) : (
              <>
                {/* Font Size controls */}
                <div className="hidden sm:flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 border border-surface-200 dark:border-surface-700">
                  <button
                    onClick={() => changeFontSize(-1)}
                    className="px-2 py-0.5 text-xs font-semibold text-surface-600 dark:text-surface-300 hover:text-brand-500 rounded transition-colors"
                    title="Smaller text"
                  >
                    A-
                  </button>
                  <span className="text-[10px] text-surface-400 px-1 font-mono">{fontSize}</span>
                  <button
                    onClick={() => changeFontSize(1)}
                    className="px-2 py-0.5 text-xs font-semibold text-surface-600 dark:text-surface-300 hover:text-brand-500 rounded transition-colors"
                    title="Larger text"
                  >
                    A+
                  </button>
                </div>

                {/* Focus / Zen mode toggle */}
                <button
                  onClick={() => setFocusMode(v => !v)}
                  className={`btn btn-ghost p-1.5 text-surface-500 hover:text-brand-500 transition-colors ${focusMode ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40' : ''}`}
                  title={focusMode ? 'Exit Zen Mode (Esc)' : 'Zen / Focus Mode'}
                >
                  {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>

                {/* Edit */}
                <button onClick={() => setEditing(true)} className="btn btn-secondary h-8 text-xs px-2.5 hidden md:flex items-center gap-1.5">
                  <Edit3 size={13} /> Edit
                </button>

                {/* Export Markdown */}
                <button onClick={exportMarkdown} className="btn btn-ghost p-1.5" title="Export Markdown">
                  <Download size={17} />
                </button>

                {/* Review Mode (flashcards) */}
                {highlights.length > 0 && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="btn btn-ghost p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    title="Review Highlights"
                  >
                    <Sparkles size={17} />
                  </button>
                )}

                {/* Highlights Panel toggle (desktop sidebar + mobile drawer) */}
                <button
                  onClick={() => {
                    if (window.innerWidth >= 1024) {
                      setShowPanel(v => !v)
                    } else {
                      setMobilePanelOpen(v => !v)
                    }
                  }}
                  className={`btn btn-ghost p-1.5 flex items-center ${showPanel ? 'text-brand-600 dark:text-brand-400' : 'text-surface-400'}`}
                  title="Toggle Highlights Panel"
                >
                  <Highlighter size={17} />
                  {highlights.length > 0 && (
                    <span className="ml-1 text-[11px] bg-brand-500 text-white font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                      {highlights.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Focus mode exit pill */}
        {focusMode && (
          <div className="sticky top-14 z-30 flex justify-center py-1 pointer-events-none">
            <div className="pointer-events-auto bg-surface-900/90 dark:bg-surface-100/90 backdrop-blur-md text-white dark:text-surface-900 text-xs px-3.5 py-1 rounded-full shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Zen Reading Mode</span>
              <button
                onClick={() => setFocusMode(false)}
                className="opacity-75 hover:opacity-100 ms-1 flex items-center gap-0.5 text-[11px] underline"
              >
                Exit (Esc)
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className={`flex-1 px-4 sm:px-8 md:px-10 py-8 ${focusMode ? 'max-w-4xl' : 'max-w-3xl'} mx-auto w-full transition-all duration-300`}>
          {editing ? (
            <textarea
              dir="auto"
              className="input-field w-full min-h-[75vh] text-base leading-relaxed resize-none font-sans p-4"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Write your lesson content here…"
            />
          ) : (
            <div
              ref={contentRef}
              style={{ '--lesson-font-size': fontSize }}
              className="lesson-prose select-text"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          )}
        </div>
      </div>

      {/* Desktop Highlights Panel */}
      {showPanel && !editing && !focusMode && (
        <div className="hidden lg:block highlights-panel">
          <HighlightsPanel
            highlights={highlights}
            onScroll={scrollToHighlight}
            onDelete={deleteHighlight}
            onUpdateNote={updateHighlightNote}
            onChangeColor={changeHighlightColor}
            onOpenReview={() => setShowReviewModal(true)}
          />
        </div>
      )}

      {/* Mobile Highlights Drawer */}
      {mobilePanelOpen && !editing && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobilePanelOpen(false)}
          />
          <div className="relative ml-auto w-84 max-w-[88vw] h-full shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            <HighlightsPanel
              highlights={highlights}
              onScroll={(hlId) => {
                setMobilePanelOpen(false)
                scrollToHighlight(hlId)
              }}
              onDelete={deleteHighlight}
              onUpdateNote={updateHighlightNote}
              onChangeColor={changeHighlightColor}
              onOpenReview={() => {
                setMobilePanelOpen(false)
                setShowReviewModal(true)
              }}
              onCloseMobile={() => setMobilePanelOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Flashcard / Study Review Modal */}
      {showReviewModal && (
        <HighlightReviewModal
          highlights={highlights}
          onClose={() => setShowReviewModal(false)}
          onJumpToHighlight={scrollToHighlight}
        />
      )}

      {/* Floating toolbar */}
      {toolbar && (
        <HighlightToolbar
          x={toolbar.x}
          y={toolbar.y}
          onPickColor={onPickColor}
          onClose={() => setToolbar(null)}
        />
      )}
    </div>
  )
}
