import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, BookOpen, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const HL_COLORS = { yellow: '#facc15', pink: '#ec4899', blue: '#3b82f6', green: '#22c55e', purple: '#a855f7' }

export default function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [filterSubject, setFilterSubject] = useState('')

  useEffect(() => {
    supabase.from('subjects').select('*').eq('user_id', user.id).then(({ data }) => setSubjects(data || []))
  }, [user])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      let q = supabase
        .from('lessons')
        .select('id, title, content, created_at, subjects(name,color), highlights(id,color,text_snippet)')
        .eq('user_id', user.id)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)

      if (filterSubject) q = q.eq('subject_id', filterSubject)

      const { data } = await q.limit(20)
      setResults(data || [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, filterSubject, user])

  const highlight = (text, q) => {
    if (!q || !text) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text.slice(0, 120)
    const start = Math.max(0, idx - 40)
    const end = Math.min(text.length, idx + q.length + 80)
    const snippet = text.slice(start, end)
    return snippet.replace(new RegExp(`(${q})`, 'gi'), '<mark class="hl-yellow">$1</mark>')
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="page-title mb-6">Search</h1>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input-field pl-11 h-12 text-base"
          placeholder="Search lessons, content, highlights…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          className="input-field h-9 text-sm w-auto"
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
        >
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Results */}
      {loading && <div className="flex justify-center py-12"><div className="spinner" style={{ width: 28, height: 28 }} /></div>}

      {!loading && query && results.length === 0 && (
        <div className="empty-state">
          <Search size={42} />
          <p className="font-medium mt-2">No results for "{query}"</p>
          <p className="text-sm mt-1">Try a different keyword</p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center text-surface-400 py-16">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p>Start typing to search your library</p>
          <p className="text-xs mt-1">Pro tip: use <kbd className="bg-surface-100 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd> from anywhere</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map(r => (
          <div
            key={r.id}
            className="lesson-card cursor-pointer"
            onClick={() => navigate(`/lesson/${r.id}`)}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: (r.subjects?.color || '#6366f1') + '22' }}
              >
                <BookOpen size={16} style={{ color: r.subjects?.color || '#6366f1' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p dir="auto" className="font-semibold">{r.title}</p>
                {r.subjects?.name && (
                  <span className="text-xs text-surface-400">{r.subjects.name}</span>
                )}
                {r.content && (
                  <p
                    dir="auto"
                    className="text-xs text-surface-500 mt-1.5 leading-relaxed line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: '…' + highlight(r.content, query) + '…' }}
                  />
                )}
                {r.highlights?.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {[...new Set(r.highlights.map(h => h.color))].map(c => (
                      <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: HL_COLORS[c] }} />
                    ))}
                    <span className="text-xs text-surface-400">{r.highlights.length} highlights</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-surface-400 flex-shrink-0">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
