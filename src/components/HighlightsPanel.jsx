import { useState } from 'react'
import { Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

const COLOR_MAP = {
  yellow: { hex: '#facc15', label: 'Important' },
  pink:   { hex: '#ec4899', label: 'Definition' },
  blue:   { hex: '#3b82f6', label: 'Example' },
  green:  { hex: '#22c55e', label: 'To Review' },
  purple: { hex: '#a855f7', label: 'Concept' },
}

export default function HighlightsPanel({ highlights, onScroll, onDelete, onUpdateNote }) {
  const [editingNote, setEditingNote] = useState(null) // highlight id
  const [noteText, setNoteText] = useState('')

  const startEdit = (hl) => {
    setEditingNote(hl.id)
    setNoteText(hl.note || '')
  }

  const saveNote = (id) => {
    onUpdateNote(id, noteText)
    setEditingNote(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Highlights
          <span className="ml-2 text-xs bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full">
            {highlights.length}
          </span>
        </h3>
      </div>

      {highlights.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-surface-400 text-center px-4">
          <div className="text-4xl mb-3">🖊️</div>
          <p className="text-sm font-medium">No highlights yet</p>
          <p className="text-xs mt-1">Select text in the lesson to highlight it</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2">
          {highlights.map(hl => {
            const colorInfo = COLOR_MAP[hl.color] || { hex: '#ccc', label: hl.color }
            return (
              <div
                key={hl.id}
                className="highlight-card"
                style={{ borderLeftColor: colorInfo.hex }}
                onClick={() => onScroll(hl.id)}
              >
                {/* Color badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: colorInfo.hex + '25', color: colorInfo.hex }}
                  >
                    {colorInfo.label}
                  </span>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => startEdit(hl)}
                      className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-500 transition-colors"
                      title="Add note"
                    >
                      <MessageSquare size={13} />
                    </button>
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
                <p dir="auto" className="text-xs leading-relaxed text-surface-700 dark:text-surface-300 line-clamp-3 italic">
                  "{hl.text_snippet}"
                </p>

                {/* Note */}
                {editingNote === hl.id ? (
                  <div className="mt-2" onClick={e => e.stopPropagation()}>
                    <textarea
                      dir="auto"
                      autoFocus
                      className="input-field text-xs w-full resize-none"
                      rows={2}
                      placeholder="Add a note…"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(hl.id) } }}
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => saveNote(hl.id)} className="btn btn-primary h-6 text-xs px-2">Save</button>
                      <button onClick={() => setEditingNote(null)} className="btn btn-ghost h-6 text-xs px-2">Cancel</button>
                    </div>
                  </div>
                ) : hl.note ? (
                  <div className="mt-2 px-2 py-1.5 bg-surface-50 dark:bg-surface-800 rounded-md">
                    <p dir="auto" className="text-xs text-surface-500">{hl.note}</p>
                  </div>
                ) : null}

                <p className="text-xs text-surface-300 mt-1.5">
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
