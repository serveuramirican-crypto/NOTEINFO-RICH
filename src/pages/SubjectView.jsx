import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ArrowLeft, Star, Trash2, Edit3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import LessonModal from '../components/LessonModal'

export default function SubjectView() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [subject, setSubject] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchData = async () => {
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', id).single(),
      supabase.from('lessons').select('*, highlights(id,color)').eq('subject_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setSubject(s)
    setLessons(l || [])
    setLoading(false)
  }

  useEffect(() => { if (user) fetchData() }, [user, id])

  const deleteLesson = async (lessonId) => {
    if (!confirm('Delete this lesson?')) return
    await supabase.from('lessons').delete().eq('id', lessonId)
    showToast('Deleted', 'info')
    fetchData()
  }

  const HL_COLORS = { yellow: '#facc15', pink: '#ec4899', blue: '#3b82f6', green: '#22c55e', purple: '#a855f7' }

  if (loading) return (
    <div className="flex justify-center items-center h-screen"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
  )

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="btn btn-ghost p-1.5"><ArrowLeft size={18} /></button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: (subject?.color || '#6366f1') + '22' }}
        >
          <BookOpen size={18} style={{ color: subject?.color || '#6366f1' }} />
        </div>
        <div>
          <h1 className="page-title" style={{ color: subject?.color || undefined }}>{subject?.name}</h1>
          <p className="text-surface-400 text-sm">{lessons.length} lessons</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary ml-auto">
          <Plus size={16} /> New Lesson
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="empty-state mt-12">
          <BookOpen size={48} />
          <p className="font-semibold text-lg mt-2">No lessons in this subject</p>
          <p className="text-sm mt-1 mb-4">Add your first lesson for {subject?.name}</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus size={16} /> Add Lesson</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {lessons.map(lesson => (
            <div
              key={lesson.id}
              className="lesson-card group relative cursor-pointer"
              onClick={() => navigate(`/lesson/${lesson.id}`)}
            >
              <div className="h-1.5 rounded-full mb-3" style={{ background: subject?.color || '#6366f1' }} />
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{lesson.title}</h3>
                {lesson.is_favorite && <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0 ml-1" />}
              </div>
              {lesson.highlights?.length > 0 && (
                <div className="flex items-center gap-1 mt-3">
                  {[...new Set(lesson.highlights.map(h => h.color))].map(c => (
                    <span key={c} className="w-3 h-3 rounded-full" style={{ background: HL_COLORS[c] }} />
                  ))}
                  <span className="text-xs text-surface-400 ml-1">{lesson.highlights.length} highlights</span>
                </div>
              )}
              <p className="text-xs text-surface-400 mt-3">
                {new Date(lesson.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <button
                onClick={e => { e.stopPropagation(); deleteLesson(lesson.id) }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 btn btn-ghost p-1 text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <LessonModal
          subjects={subject ? [subject] : []}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData() }}
          lesson={{ subject_id: id }}
        />
      )}
    </div>
  )
}
