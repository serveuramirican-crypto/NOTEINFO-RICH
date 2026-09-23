import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, MessageSquare, ExternalLink } from 'lucide-react'

const COLOR_MAP = {
  yellow: { hex: '#facc15', label: 'Important', bg: '#fef08a22' },
  pink:   { hex: '#ec4899', label: 'Definition', bg: '#fbcfe822' },
  blue:   { hex: '#3b82f6', label: 'Example', bg: '#bfdbfe22' },
  green:  { hex: '#22c55e', label: 'To Review', bg: '#bbf7d022' },
  purple: { hex: '#a855f7', label: 'Concept', bg: '#e9d5ff22' },
}

export default function HighlightReviewModal({ highlights = [], onClose, onJumpToHighlight }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const current = highlights[currentIndex]
  const colorInfo = current ? (COLOR_MAP[current.color] || { hex: '#6366f1', label: 'Highlight', bg: '#e0e7ff22' }) : null

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentIndex(prev => (prev + 1) % highlights.length)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentIndex(prev => (prev - 1 + highlights.length) % highlights.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [highlights.length, onClose])

  if (!current) return null

  const handleNext = () => setCurrentIndex(prev => (prev + 1) % highlights.length)
  const handlePrev = () => setCurrentIndex(prev => (prev - 1 + highlights.length) % highlights.length)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: colorInfo.hex }}
            />
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: colorInfo.bg, color: colorInfo.hex }}
            >
              {colorInfo.label}
            </span>
            <span className="text-xs text-surface-400 font-medium">
              {currentIndex + 1} of {highlights.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onJumpToHighlight) onJumpToHighlight(current.id)
                onClose()
              }}
              className="btn btn-ghost p-1.5 text-xs flex items-center gap-1 text-surface-500 hover:text-brand-500"
              title="Jump to highlight in text"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Go to text</span>
            </button>
            <button onClick={onClose} className="btn btn-ghost p-1.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Card Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-center">
          <div
            className="p-5 rounded-xl border relative"
            style={{
              borderColor: colorInfo.hex + '33',
              background: colorInfo.hex + '0a'
            }}
          >
            <div
              dir="auto"
              className="text-base sm:text-lg leading-relaxed text-surface-800 dark:text-surface-100 font-medium whitespace-pre-wrap select-text"
            >
              “{current.text_snippet}”
            </div>

            {current.note && (
              <div className="mt-4 pt-3 border-t border-surface-200/60 dark:border-surface-700/60 flex items-start gap-2 text-sm text-surface-600 dark:text-surface-300">
                <MessageSquare size={16} className="text-brand-500 mt-0.5 flex-shrink-0" />
                <div dir="auto" className="flex-1 italic">
                  {current.note}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 bg-surface-50 dark:bg-surface-950/50 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div className="text-xs text-surface-400 hidden sm:block">
            Use <kbd className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-800 rounded font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-800 rounded font-mono">→</kbd> keys to navigate
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <button
              onClick={handlePrev}
              className="btn btn-secondary h-8 px-3 text-xs flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={handleNext}
              className="btn btn-primary h-8 px-3 text-xs flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
