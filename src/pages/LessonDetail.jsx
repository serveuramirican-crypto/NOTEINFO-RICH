import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, StarOff, Highlighter, X, MessageSquare,
  Trash2, ChevronRight, Save, Edit3, Download, Folder
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import HighlightToolbar from '../components/HighlightToolbar'
import HighlightsPanel from '../components/HighlightsPanel'
import { applyHighlightsToContent, parseMarkdownToHtml, getRangeOffsets } from '../lib/highlightUtils'

export default function LessonDetail() {
  const { id } = useParams()
  const { user } = useAuth()
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

  // Toolbar state
  const [toolbar, setToolbar] = useState(null) // { x, y, selectionText, startOffset, endOffset }
  const [notePopover, setNotePopover] = useState(null) // { x, y, highlightId }

  const contentRef = useRef(null)
  const lessonContentRef = useRef('') // always holds latest lesson.content for offset calc

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

  // Listen to mouseup and touchend globally
  useEffect(() => {
    const handleMouseUpGlobal = (e) => {
      // Don't process if click was inside the toolbar (let toolbar handle it)
      if (e?.target?.closest('.highlight-toolbar')) return
      setTimeout(() => handleSelection(e), 10)
    }
    const handleTouchEndGlobal = (e) => {
      setTimeout(() => handleSelection(e), 10)
    }
    const handleKeyUpGlobal = (e) => {
      handleSelection(e)
    }
    document.addEventListener('mouseup', handleMouseUpGlobal)
    document.addEventListener('touchend', handleTouchEndGlobal)
    document.addEventListener('keyup', handleKeyUpGlobal)
    return () => {
      document.removeEventListener('mouseup', handleMouseUpGlobal)
      document.removeEventListener('touchend', handleTouchEndGlobal)
      document.removeEventListener('keyup', handleKeyUpGlobal)
    }
  }, [handleSelection])

  // Save highlight to DB
  const saveHighlight = async (color, selectionText, rangeInfo) => {
    if (!selectionText || !color) return

    const payload = {
      lesson_id: id,
      text_snippet: selectionText,
      start_offset: rangeInfo?.start ?? 0,
      end_offset: rangeInfo?.end ?? selectionText.length,
      color,
      note: '',
    }

    const { data, error } = await supabase
      .from('highlights')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Highlight save error:', error)
      showToast(error.message || 'Failed to save highlight', 'error')
    } else if (data) {
      setHighlights(prev => [...prev, data].sort((a, b) => (a.start_offset || 0) - (b.start_offset || 0)))
      showToast('Highlight saved!', 'success')
    }
    window.getSelection()?.removeAllRanges()
    setToolbar(null)
  }

  // Handle color pick from toolbar
  const onPickColor = async (color) => {
    // Use toolbar state; fall back to savedSelectionRef if toolbar was cleared
    const data = toolbar || savedSelectionRef.current
    if (!data) return
    const snippet = data.selectionText
    if (!snippet) return

    await saveHighlight(color, snippet, {
      start: data.startOffset ?? data.start ?? 0,
      end: data.endOffset ?? data.end ?? snippet.length,
    })
    savedSelectionRef.current = null
  }

  // Add/update note on highlight
  const updateHighlightNote = async (highlightId, note) => {
    await supabase.from('highlights').update({ note }).eq('id', highlightId)
    setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, note } : h))
    setNotePopover(null)
  }

  const deleteHighlight = async (highlightId) => {
    await supabase.from('highlights').delete().eq('id', highlightId)
    setHighlights(prev => prev.filter(h => h.id !== highlightId))
    showToast('Highlight removed', 'info')
  }

  // Change highlight color
  const changeHighlightColor = async (highlightId, newColor) => {
    const { error } = await supabase.from('highlights').update({ color: newColor }).eq('id', highlightId)
    if (!error) {
      setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, color: newColor } : h))
      showToast('Color updated!', 'success')
    }
  }

  // Scroll to a highlight
  const scrollToHighlight = (highlightId) => {
    const el = contentRef.current?.querySelector(`[data-hl="${highlightId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '2px solid #6366f1'
      setTimeout(() => { el.style.outline = '' }, 1500)
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
      `\n---\n## Highlights\n`,
      ...highlights.map(h => `- **[${h.color}]** "${h.text_snippet}"${h.note ? `\n  > ${h.note}` : ''}`)
    ].join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${lesson.title}.md`
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

  // Dismiss toolbar on click outside — use mousedown with a small delay
  // to avoid killing the toolbar before its own click handlers fire
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.highlight-toolbar') && !e.target.closest('.note-popover')) {
        // Small delay so color-dot onClick fires first
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

  const renderedContent = editing ? null : applyHighlightsToContent(lesson.content || '', highlights)

  return (
    <div className="flex min-h-screen">
      {/* Main lesson area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-surface-950/80 backdrop-blur border-b border-surface-200 dark:border-surface-800 px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn btn-ghost p-1.5">
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
            <h1 dir="auto" className="flex-1 font-bold text-base truncate">{lesson.title}</h1>
          )}

          {lesson.folders?.name && (
            <button
              onClick={() => navigate(`/folder/${lesson.folders.id}`)}
              className="tag-chip hidden sm:inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{
                background: (lesson.folders.color || '#6366f1') + '22',
                color: lesson.folders.color || '#6366f1',
                borderColor: (lesson.folders.color || '#6366f1') + '44'
              }}
            >
              <Folder size={11} />
              {lesson.folders.name}
            </button>
          )}

          {lesson.subjects?.name && (
            <span
              className="tag-chip hidden sm:flex"
              style={{ background: (lesson.subjects.color || '#6366f1') + '22', color: lesson.subjects.color || '#6366f1', borderColor: (lesson.subjects.color || '#6366f1') + '44' }}
            >
              {lesson.subjects.name}
            </span>
          )}

          <button onClick={toggleFavorite} className="btn btn-ghost p-1.5">
            {lesson.is_favorite
              ? <Star size={18} className="text-amber-400 fill-amber-400" />
              : <StarOff size={18} />}
          </button>

          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-secondary h-8 text-sm">Cancel</button>
              <button onClick={saveEdits} disabled={saving} className="btn btn-primary h-8 text-sm">
                {saving ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <><Save size={14} /> Save</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn btn-secondary h-8 text-sm hidden sm:flex">
                <Edit3 size={14} /> Edit
              </button>
              <button onClick={exportMarkdown} className="btn btn-ghost p-1.5" title="Export Markdown">
                <Download size={18} />
              </button>
              <button
                onClick={() => setShowPanel(v => !v)}
                className="btn btn-ghost p-1.5"
                title="Toggle highlights panel"
              >
                <Highlighter size={18} />
                {highlights.length > 0 && (
                  <span className="ml-1 text-xs bg-brand-500 text-white rounded-full w-4 h-4 flex items-center justify-center">{highlights.length}</span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 md:px-12 py-8 max-w-3xl mx-auto w-full">
          {editing ? (
            <textarea
              dir="auto"
              className="input-field w-full min-h-[70vh] text-base leading-relaxed resize-none font-sans"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Write your lesson content here…"
            />
          ) : (
            <div
              ref={contentRef}
              className="lesson-prose select-text"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          )}
        </div>
      </div>

      {/* Highlights Panel */}
      {showPanel && !editing && (
        <div className="hidden lg:block highlights-panel">
          <HighlightsPanel
            highlights={highlights}
            onScroll={scrollToHighlight}
            onDelete={deleteHighlight}
            onUpdateNote={updateHighlightNote}
            onChangeColor={changeHighlightColor}
          />
        </div>
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
