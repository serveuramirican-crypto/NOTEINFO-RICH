import { useState } from 'react'
import { Trash2, MessageSquare, ChevronDown, ChevronUp, Palette } from 'lucide-react'

const COLOR_MAP = {
  yellow: { hex: '#facc15', label: 'Important' },
  pink:   { hex: '#ec4899', label: 'Definition' },
  blue:   { hex: '#3b82f6', label: 'Example' },
  green:  { hex: '#22c55e', label: 'To Review' },
  purple: { hex: '#a855f7', label: 'Concept' },
}

const COLOR_KEYS = Object.keys(COLOR_MAP)

export default function HighlightsPanel({ highlights, onScroll, onDelete, onUpdateNote, onChangeColor }) {
  const [editingNote, setEditingNote]     = useState(null)
  const [noteText, setNoteText]           = useState('')
  const [expanded, setExpanded]           = useState({})
  const [changingColor, setChangingColor] = useState(null)
  const [filterColor, setFilterColor]     = useState(null)

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

  const visibleHighlights = filterColor
    ? highlights.filter(h => h.color === filterColor)
    : highlights

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Highlights
            <span className="text-xs bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full">
              {highlights.length}
            </span>
          </h3>
          {filterColor && (
            <button
              onClick={() => setFilterColor(null)}
              className="text-xs text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Color filter dots */}
        {highlights.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_KEYS.filter(k => highlights.some(h => h.color === k)).map(colorKey => {
              const { hex, label } = COLOR_MAP[colorKey]
              const active = filterColor === colorKey
              return (
                <button
                  key={colorKey}
                  onClick={() => setFilterColor(active ? null : colorKey)}
                  title={`Filter: ${label}`}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: hex,
                    border: active ? '2.5px solid #18181b' : '2px solid transparent',
                    outline: active ? `2px solid ${hex}55` : 'none',
                    transform: active ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* List */}
      {visibleHighlights.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-surface-400 text-center px-4">
          {highlights.length === 0 ? (
            <>
              <div className="text-4xl mb-3">ðŸ–Šï¸</div>
              <p className="text-sm font-medium">No highlights yet</p>
              <p className="text-xs mt-1">Select text in the lesson to highlight it</p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-3">ðŸŽ¨</div>
              <p className="text-sm font-medium">No highlights for this color</p>
              <button
                onClick={() => setFilterColor(null)}
                className="text-xs text-brand-500 mt-1 hover:underline"
              >
                Show all highlights
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2">
          {visibleHighlights.map(hl => {
            const colorInfo = COLOR_MAP[hl.color] || { hex: '#ccc', label: hl.color }
            const isExpanded = expanded[hl.id]
            const isLong = hl.text_snippet && hl.text_snippet.length > 120
            const isChanging = changingColor === hl.id

            return (
              <div
                key={hl.id}
                className="highlight-card"
                style={{ borderLeftColor: colorInfo.hex }}
                onClick={() => { if (!isChanging) onScroll(hl.id) }}
              >
                {/* Top row: badge + actions */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: colorInfo.hex + '25', color: colorInfo.hex }}
                  >
                    {colorInfo.label}
                  </span>

                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {/* Change color */}
                    <div className="relative">
                      <button
                        onClick={() => setChangingColor(isChanging ? null : hl.id)}
                        className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-500 transition-colors"
                        title="Change color"
                      >
                        <Palette size={13} />
                      </button>
                      {isChanging && (
                        <div className="absolute right-0 top-7 z-50 flex gap-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-full px-2 py-1 shadow-xl">
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
                      className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-500 transition-colors"
                      title="Add / edit note"
                    >
                      <MessageSquare size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(hl.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-surface-400 hover:text-red-500 transition-colors"
                      title="Delete highlight"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Snippet */}
                <p
                  dir="auto"
                  className="text-xs leading-relaxed text-surface-700 dark:text-surface-300 italic"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: isExpanded ? 'unset' : 4,
                    overflow: 'hidden',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  "{hl.text_snippet}"
                </p>

                {/* Expand/Collapse toggle */}
                {isLong && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(hl.id) }}
                    className="mt-0.5 flex items-center gap-0.5 text-xs text-brand-500 hover:text-brand-600 transition-colors"
                  >
                    {isExpanded
                      ? <><ChevronUp size={12} /> Show less</>
                      : <><ChevronDown size={12} /> Show more</>
                    }
                  </button>
                )}

                {/* Note editing */}
                {editingNote === hl.id ? (
                  <div className="mt-2" onClick={e => e.stopPropagation()}>
                    <textarea
                      dir="auto"
                      autoFocus
                      className="input-field text-xs w-full resize-none"
                      rows={2}
                      placeholder="Add a noteâ€¦"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(hl.id) }
                        if (e.key === 'Escape') setEditingNote(null)
                      }}
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => saveNote(hl.id)} className="btn btn-primary h-6 text-xs px-2">Save</button>
                      <button onClick={() => setEditingNote(null)} className="btn btn-ghost h-6 text-xs px-2">Cancel</button>
                    </div>
                  </div>
                ) : hl.note ? (
                  <div
                    className="mt-2 px-2 py-1.5 rounded-md cursor-text"
                    style={{ background: colorInfo.hex + '18' }}
                    onClick={e => { e.stopPropagation(); startEdit(hl) }}
                  >
                    <p dir="auto" className="text-xs text-surface-600 dark:text-surface-300" style={{ unicodeBidi: 'plaintext' }}>
                      {hl.note}
                    </p>
                  </div>
                ) : null}

                {/* Date */}
                <p className="text-xs text-surface-300 dark:text-surface-600 mt-1.5">
                  {new Date(hl.created_at).toLocaleDateString()}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


