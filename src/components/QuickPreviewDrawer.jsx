import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ExternalLink, Star, StarOff, Highlighter, Folder,
  Clock, Download, Copy, Check, MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { applyHighlightsToContent } from '../lib/highlightUtils'

const HL_COLORS = {
  yellow: '#facc15',
  pink: '#ec4899',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7'
}

export default function QuickPreviewDrawer({ lessonId, onClose, onLessonUpdated }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [lesson, setLesson] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!lessonId) return
    setLoading(true)
    Promise.all([
      supabase
        .from('lessons')
        .select('*, subjects(name,color), folders(id,name,color)')
        .eq('id', lessonId)
        .single(),
      supabase
        .from('highlights')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('start_offset'),
    ]).then(([lRes, hRes]) => {
      setLesson(lRes.data || null)
      setHighlights(hRes.data || [])
      setLoading(false)
    })
  }, [lessonId])

  const copyContent = () => {
    if (!lesson?.content) return
    navigator.clipboard.writeText(lesson.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Copied lesson text to clipboard!', 'info')
  }

  const toggleFavorite = async () => {
    if (!lesson) return
    const next = !lesson.is_favorite
    await supabase.from('lessons').update({ is_favorite: next }).eq('id', lesson.id)
    setLesson(prev => ({ ...prev, is_favorite: next }))
    if (onLessonUpdated) onLessonUpdated()
  }

  if (!lessonId) return null

  const renderedContent = lesson ? applyHighlightsToContent(lesson.content || '', highlights) : null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-surface-900 shadow-2xl h-full flex flex-col z-10 border-l border-surface-200 dark:border-surface-800 animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-surface-200 dark:border-surface-800 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {lesson?.folders && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded text-white"
                  style={{ background: lesson.folders.color || '#6366f1' }}
                >
                  <Folder size={10} />
                  {lesson.folders.name}
                </span>
              )}
              {lesson?.subjects?.name && (
                <span className="text-xs text-surface-400">{lesson.subjects.name}</span>
              )}
            </div>
            <h2 className="font-bold text-lg leading-snug line-clamp-2">{lesson?.title || 'Loading…'}</h2>
          </div>

          <div className="flex items-center gap-1">
            {lesson && (
              <button onClick={toggleFavorite} className="btn btn-ghost p-1.5">
                {lesson.is_favorite ? (
                  <Star size={17} className="text-amber-400 fill-amber-400" />
                ) : (
                  <StarOff size={17} />
                )}
              </button>
            )}
            <button onClick={onClose} className="btn btn-ghost p-1.5">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : !lesson ? (
          <div className="p-8 text-center text-surface-400">Lesson not found.</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Highlights overview if any */}
            {highlights.length > 0 && (
              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Highlighter size={13} className="text-brand-500" />
                    {highlights.length} Highlights
                  </span>
                  <div className="flex items-center gap-1">
                    {[...new Set(highlights.map(h => h.color))].map(c => (
                      <span
                        key={c}
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: HL_COLORS[c] || '#ccc' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Highlights snippets */}
                <div className="space-y-1.5 pt-1">
                  {highlights.slice(0, 3).map(h => (
                    <div
                      key={h.id}
                      className="text-xs p-2 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5"
                        style={{ background: HL_COLORS[h.color] }}
                      />
                      <span className="italic line-clamp-2">"{h.text_snippet}"</span>
                      {h.note && (
                        <p className="text-[11px] text-surface-400 mt-1 flex items-center gap-1">
                          <MessageSquare size={10} /> {h.note}
                        </p>
                      )}
                    </div>
                  ))}
                  {highlights.length > 3 && (
                    <p className="text-[11px] text-brand-500 text-center pt-1 font-medium">
                      +{highlights.length - 3} more highlights in full view
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lesson Body */}
            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {renderedContent}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between gap-2 bg-surface-50 dark:bg-surface-950">
          <button onClick={copyContent} className="btn btn-secondary text-xs">
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
          <button
            onClick={() => {
              onClose()
              navigate(`/lesson/${lessonId}`)
            }}
            className="btn btn-primary text-xs"
          >
            <ExternalLink size={14} /> Open Full Lesson
          </button>
        </div>
      </div>
    </div>
  )
}
