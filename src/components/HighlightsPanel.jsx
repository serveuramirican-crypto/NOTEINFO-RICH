import { useState, useMemo } from 'react'
import {
  Trash2, MessageSquare, ChevronDown, ChevronUp, Palette,
  Search, Copy, Check, Sparkles, X, Filter
} from 'lucide-react'

const COLOR_MAP = {
  yellow: { hex: '#facc15', label: 'Important', bg: '#fef08a' },
  pink:   { hex: '#ec4899', label: 'Definition', bg: '#fbcfe8' },
  blue:   { hex: '#3b82f6', label: 'Example', bg: '#bfdbfe' },
  green:  { hex: '#22c55e', label: 'To Review', bg: '#bbf7d0' },
  purple: { hex: '#a855f7', label: 'Concept', bg: '#e9d5ff' },
}

const COLOR_KEYS = Object.keys(COLOR_MAP)

export default function HighlightsPanel({
  highlights = [],
  onScroll,
  onDelete,
  onUpdateNote,
  onChangeColor,
  onOpenReview,
  onCloseMobile
}) {
  const [editingNote, setEditingNote]     = useState(null)
  const [noteText, setNoteText]           = useState('')
  const [expanded, setExpanded]           = useState({})
  const [changingColor, setChangingColor] = useState(null)
  const [filterColor, setFilterColor]     = useState(null)
  const [searchQuery, setSearchQuery]     = useState('')
  const [copied, setCopied]               = useState(false)

  const startEdit = (hl) => {
    setEditingNote(hl.id)
    setNoteText(hl.note || '')
  }

  const saveNote = (id) => {
    onUpdateNote(id, noteText)
    setEditingNote(null)
  }

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleColorChange = (hl, newColor) => {
    setChangingColor(null)
    if (newColor !== hl.color && onChangeColor) {
      onChangeColor(hl.id, newColor)
    }
  }

  // Filtered highlights based on color & search query
  const visibleHighlights = useMemo(() => {
    return highlights.filter(h => {
      const matchesColor = !filterColor || h.color === filterColor
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch = !query ||
        (h.text_snippet && h.text_snippet.toLowerCase().includes(query)) ||
        (h.note && h.note.toLowerCase().includes(query))
      return matchesColor && matchesSearch
    })
  }, [highlights, filterColor, searchQuery])

  // Copy all highlights to clipboard
  const handleCopyAll = async () => {
    if (highlights.length === 0) return
    const text = highlights.map((h, i) => {
      const label = COLOR_MAP[h.color]?.label || h.color
      return `### Highlight ${i + 1} [${label}]\n> ${h.text_snippet}\n${h.note ? `\n*Note:* ${h.note}\n` : ''}`
    }).join('\n---\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800 bg-white/60 dark:bg-surface-900/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
              Highlights
            </h3>
            <span className="text-xs bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold px-2 py-0.5 rounded-full">
              {highlights.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Review button */}
            {highlights.length > 0 && onOpenReview && (
              <button
                onClick={onOpenReview}
                className="btn btn-ghost p-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg flex items-center gap-1"
                title="Review Highlights as Flashcards"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline font-medium text-xs">Review</span>
              </button>
            )}

            {/* Copy All */}
            {highlights.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="btn btn-ghost p-1.5 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 rounded-lg"
                title="Copy all highlights as Markdown"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            )}

            {/* Mobile close button */}
            {onCloseMobile && (
              <button onClick={onCloseMobile} className="btn btn-ghost p-1.5 text-surface-400 lg:hidden">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Search input */}
        {highlights.length > 1 && (
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-2.5 top-2.5 text-surface-400" />
            <input
              type="text"
              placeholder="Search highlights & notes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/80 text-surface-800 dark:text-surface-200 placeholder-surface-400 focus:outline-none focus:border-brand-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Color filter dots */}
        {highlights.length > 0 && (
          <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLOR_KEYS.filter(k => highlights.some(h => h.color === k)).map(colorKey => {
                const { hex, label } = COLOR_MAP[colorKey]
                const active = filterColor === colorKey
                const count = highlights.filter(h => h.color === colorKey).length
                return (
                  <button
                    key={colorKey}
                    onClick={() => setFilterColor(active ? null : colorKey)}
                    title={`Filter by ${label} (${count})`}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                      active
                        ? 'bg-surface-200 dark:bg-surface-700 shadow-xs'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: hex,
                        boxShadow: active ? `0 0 6px ${hex}` : 'none'
                      }}
                    />
                    <span className="text-surface-600 dark:text-surface-300">{count}</span>
                  </button>
                )
              })}
            </div>

            {(filterColor || searchQuery) && (
              <button
                onClick={() => { setFilterColor(null); setSearchQuery('') }}
                className="text-[11px] text-surface-400 hover:text-brand-500 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      {visibleHighlights.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-surface-400 text-center px-4 py-8">
          {highlights.length === 0 ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-500 flex items-center justify-center mb-3">
                <Sparkles size={22} />
              </div>
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">No highlights yet</p>
              <p className="text-xs text-surface-400 mt-1 max-w-[200px] leading-relaxed">
                Select any text inside the lesson to highlight and take notes.
              </p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-2 text-surface-400">
                <Filter size={18} />
              </div>
              <p className="text-xs font-medium text-surface-600 dark:text-surface-300">No matching highlights</p>
              <button
                onClick={() => { setFilterColor(null); setSearchQuery('') }}
                className="text-xs text-brand-500 mt-1.5 hover:underline font-medium"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {visibleHighlights.map(hl => {
            const colorInfo = COLOR_MAP[hl.color] || { hex: '#6366f1', label: hl.color, bg: '#e0e7ff' }
            const isExpanded = expanded[hl.id]
            const isLong = hl.text_snippet && hl.text_snippet.length > 110
            const isChanging = changingColor === hl.id

            return (
              <div
                key={hl.id}
                className="highlight-card group"
                style={{ borderLeftColor: colorInfo.hex }}
                onClick={() => { if (!isChanging) onScroll(hl.id) }}
              >
                {/* Top row: badge + actions */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: colorInfo.hex + '20', color: colorInfo.hex }}
                  >
                    {colorInfo.label}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {/* Change color */}
                    <div className="relative">
                      <button
                        onClick={() => setChangingColor(isChanging ? null : hl.id)}
                        className="p-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-500 transition-colors"
                        title="Change color"
                      >
                        <Palette size={13} />
                      </button>
                      {isChanging && (
                        <div className="absolute right-0 top-7 z-50 flex gap-1.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-full px-2.5 py-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                          {COLOR_KEYS.map(k => (
                            <button
                              key={k}
                              onClick={() => handleColorChange(hl, k)}
                              title={COLOR_MAP[k].label}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: COLOR_MAP[k].hex,
                                border: hl.color === k ? '2.5px solid #18181b' : '2px solid transparent',
                                transition: 'transform 0.1s',
                              }}
                              className="hover:scale-125"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    <button
                      onClick={() => startEdit(hl)}
                      className="p-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-500 transition-colors"
                      title={hl.note ? 'Edit note' : 'Add note'}
                    >
                      <MessageSquare size={13} className={hl.note ? 'text-brand-500' : ''} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(hl.id)}
                      className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-surface-400 hover:text-red-500 transition-colors"
                      title="Delete highlight"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Snippet */}
                <p
                  dir="auto"
                  className="text-xs leading-relaxed text-surface-700 dark:text-surface-300 font-normal select-text"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: isExpanded ? 'unset' : 3,
                    overflow: 'hidden',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  “{hl.text_snippet}”
                </p>

                {/* Expand/Collapse toggle */}
                {isLong && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(hl.id) }}
                    className="mt-1 flex items-center gap-0.5 text-[11px] text-brand-500 hover:text-brand-600 font-medium transition-colors"
                  >
                    {isExpanded
                      ? <><ChevronUp size={11} /> Show less</>
                      : <><ChevronDown size={11} /> Show more</>
                    }
                  </button>
                )}

                {/* Note editing */}
                {editingNote === hl.id ? (
                  <div className="mt-2.5" onClick={e => e.stopPropagation()}>
                    <textarea
                      dir="auto"
                      autoFocus
                      className="input-field text-xs w-full resize-none leading-relaxed"
                      rows={2}
                      placeholder="Write your note…"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(hl.id) }
                        if (e.key === 'Escape') setEditingNote(null)
                      }}
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button onClick={() => saveNote(hl.id)} className="btn btn-primary h-6 text-xs px-2.5">Save</button>
                      <button onClick={() => setEditingNote(null)} className="btn btn-ghost h-6 text-xs px-2">Cancel</button>
                    </div>
                  </div>
                ) : hl.note ? (
                  <div
                    className="mt-2 px-2.5 py-1.5 rounded-lg cursor-text border"
                    style={{
                      background: colorInfo.hex + '10',
                      borderColor: colorInfo.hex + '30'
                    }}
                    onClick={e => { e.stopPropagation(); startEdit(hl) }}
                  >
                    <p dir="auto" className="text-xs text-surface-700 dark:text-surface-200" style={{ unicodeBidi: 'plaintext' }}>
                      {hl.note}
                    </p>
                  </div>
                ) : null}

                {/* Date */}
                <div className="mt-2 pt-1 border-t border-surface-100 dark:border-surface-800/60 flex items-center justify-between text-[11px] text-surface-400">
                  <span>{new Date(hl.created_at).toLocaleDateString()}</span>
                  <span className="text-[10px] text-brand-500/70 group-hover:text-brand-500 font-medium">Click to jump</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
