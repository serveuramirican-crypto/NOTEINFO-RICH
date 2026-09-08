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
import { applyHighlightsToContent } from '../lib/highlightUtils'

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
  const [toolbar, setToolbar] = useState(null) // { x, y, range, selection }
  const [pendingColor, setPendingColor] = useState(null)
  const [notePopover, setNotePopover] = useState(null) // { x, y, highlightId }

  const contentRef = useRef(null)

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
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Text selection → show toolbar
  const handleMouseUp = useCallback((e) => {
    if (editing) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setToolbar(null)
      return
    }
    // Check selection is inside content area
    const range = selection.getRangeAt(0)
    const container = contentRef.current
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setToolbar(null)
      return
    }
    const rect = range.getBoundingClientRect()
    setToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 10,
      selectionText: selection.toString(),
      range: range.cloneRange(),
    })
  }, [editing])

  // Save highlight to DB
  const saveHighlight = async (color, selectionText, rangeInfo) => {
    if (!selectionText || !color) return
    const { data, error } = await supabase
      .from('highlights')
      .insert({
        lesson_id: id,
        text_snippet: selectionText,
        start_offset: rangeInfo.start,
        end_offset: rangeInfo.end,
        color,
        note: '',
      })
      .select()
      .single()

    if (!error && data) {
      setHighlights(prev => [...prev, data].sort((a, b) => a.start_offset - b.start_offset))
      showToast('Highlight saved!', 'success')
    }
    window.getSelection()?.removeAllRanges()
    setToolbar(null)
  }

  // Handle color pick from toolbar
  const onPickColor = async (color) => {
    if (!toolbar) return
    const plainText = lesson?.content || ''
    const snippet = toolbar.selectionText?.trim()
    if (!snippet) return

    // 1. Exact match in raw content
    let startOffset = plainText.indexOf(snippet)

    // 2. If snippet not found directly (e.g. text was inside **bold** or has slight whitespace differences)
    if (startOffset === -1) {
      const cleanSnippet = snippet.replace(/[\*\_\`\#]/g, '').trim()
      const escaped = cleanSnippet.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const match = plainText.match(new RegExp(escaped, 'i'))
      if (match) {
        startOffset = match.index
      }
    }

    if (startOffset === -1) startOffset = 0
    const endOffset = startOffset + snippet.length

    await saveHighlight(color, snippet, { start: startOffset, end: endOffset })
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

  // Dismiss toolbar on click outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.highlight-toolbar') && !e.target.closest('.note-popover')) {
        setToolbar(null)
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
              onMouseUp={handleMouseUp}
              onTouchEnd={handleMouseUp}
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
