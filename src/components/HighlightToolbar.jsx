import { X } from 'lucide-react'

const COLORS = [
  { id: 'yellow', hex: '#facc15', label: 'Important' },
  { id: 'pink',   hex: '#ec4899', label: 'Definition' },
  { id: 'blue',   hex: '#3b82f6', label: 'Example' },
  { id: 'green',  hex: '#22c55e', label: 'To Review' },
  { id: 'purple', hex: '#a855f7', label: 'Concept' },
]

export default function HighlightToolbar({ x, y, onPickColor, onClose }) {
  return (
    <div
      className="highlight-toolbar"
      style={{
        left: `${x}px`,
        top: `${Math.max(12, y - 52)}px`,
      }}
      onMouseDown={e => {
        // Prevent selection collapse on mousedown
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          className="color-dot"
          style={{ background: c.hex }}
          title={`${c.label} (Press ${COLORS.indexOf(c) + 1})`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onPickColor(c.id)
          }}
        />
      ))}
      <div className="w-px h-5 bg-surface-200 dark:bg-surface-700 mx-1" />
      <button
        type="button"
        className="w-6 h-6 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

