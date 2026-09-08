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
      style={{ left: x, top: y - 58 }}
      onMouseDown={e => e.stopPropagation()}
    >
      {COLORS.map(c => (
        <button
          key={c.id}
          className="color-dot"
          style={{ background: c.hex }}
          title={`${c.label} (Press ${COLORS.indexOf(c) + 1})`}
          onClick={() => onPickColor(c.id)}
        />
      ))}
      <div className="w-px h-5 bg-surface-200 mx-1" />
      <button
        className="w-6 h-6 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors"
        onClick={onClose}
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}
