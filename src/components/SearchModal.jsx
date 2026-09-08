import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, FileText, X, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function SearchModal({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('lessons')
        .select('id, title, content, subject_id, subjects(name,color)')
        .eq('user_id', user.id)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(10)
      setResults(data || [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, user])

  const go = (id) => {
    navigate(`/lesson/${id}`)
    onClose()
  }

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#e4e4e7' }}>
          <Search size={20} className="text-surface-400" />
          <input
            ref={inputRef}
            className="flex-1 text-base outline-none bg-transparent"
            placeholder="Search lessons, notes, highlights…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="btn btn-ghost p-1">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs px-2 py-1 rounded bg-surface-100 text-surface-500 font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="py-12 text-center text-surface-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              <p>No lessons found for "<strong>{query}</strong>"</p>
            </div>
          )}
          {!loading && !query && (
            <div className="py-6 px-5 text-surface-400 text-sm">
              <p className="flex items-center gap-2"><Clock size={15} /> Start typing to search across all your lessons…</p>
            </div>
          )}
          {results.map(r => (
            <button
              key={r.id}
              className="w-full text-left px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-start gap-3 border-b last:border-b-0"
              style={{ borderColor: '#e4e4e7' }}
              onClick={() => go(r.id)}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: r.subjects?.color ? r.subjects.color + '22' : '#6366f122' }}
              >
                <BookOpen size={15} style={{ color: r.subjects?.color || '#6366f1' }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{r.title}</p>
                {r.subjects?.name && (
                  <span className="text-xs text-surface-400">{r.subjects.name}</span>
                )}
                {r.content && (
                  <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">
                    {r.content.slice(0, 100)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t text-xs text-surface-400 flex gap-4" style={{ borderColor: '#e4e4e7' }}>
          <span><kbd className="font-mono bg-surface-100 px-1.5 py-0.5 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-surface-100 px-1.5 py-0.5 rounded">↵</kbd> open</span>
          <span><kbd className="font-mono bg-surface-100 px-1.5 py-0.5 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
