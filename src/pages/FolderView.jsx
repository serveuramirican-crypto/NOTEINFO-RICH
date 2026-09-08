import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Folder, Plus, Grid, List, Star, StarOff, Trash2, Edit3,
  ChevronRight, ArrowLeft, BookOpen, FolderPlus, FolderOpen, MoreVertical
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import LessonModal from '../components/LessonModal'
import FolderModal from '../components/FolderModal'

export default function FolderView() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [folder, setFolder] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [subfolders, setSubfolders] = useState([])
  const [lessons, setLessons] = useState([])
  const [allFolders, setAllFolders] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')

  const [showLessonModal, setShowLessonModal] = useState(false)
  const [showSubfolderModal, setShowSubfolderModal] = useState(false)
  const [showEditFolderModal, setShowEditFolderModal] = useState(false)

  // Fetch all necessary data
  const fetchData = async () => {
    if (!user || !id) return
    setLoading(true)

    // 1. Fetch current folder
    const { data: currentFolder, error: folderErr } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (folderErr || !currentFolder) {
      showToast('Folder not found', 'error')
      navigate('/library')
      return
    }
    setFolder(currentFolder)

    // 2. Fetch all folders (for breadcrumbs and modals)
    const { data: foldersList } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setAllFolders(foldersList || [])

    // Compute breadcrumbs
    const crumbs = []
    let curr = currentFolder
    while (curr) {
      crumbs.unshift(curr)
      if (curr.parent_id) {
        curr = (foldersList || []).find(f => f.id === curr.parent_id)
      } else {
        curr = null
      }
    }
    setBreadcrumbs(crumbs)

    // 3. Subfolders of current folder
    const sub = (foldersList || []).filter(f => f.parent_id === id)
    setSubfolders(sub)

    // 4. Lessons inside this folder
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*, subjects(name,color), highlights(id,color)')
      .eq('user_id', user.id)
      .eq('folder_id', id)
      .order('created_at', { ascending: false })
    setLessons(lessonsData || [])

    // 5. Subjects for lesson modal
    const { data: subjs } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setSubjects(subjs || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id, user])

  const handleDeleteFolder = async () => {
    if (!confirm(`Are you sure you want to delete folder "${folder.name}"? Lessons inside will be moved to unorganized.`)) {
      return
    }
    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Folder deleted', 'info')
    if (folder.parent_id) {
      navigate(`/folder/${folder.parent_id}`)
    } else {
      navigate('/library')
    }
  }

  const toggleFavorite = async (e, lesson) => {
    e.stopPropagation()
    await supabase.from('lessons').update({ is_favorite: !lesson.is_favorite }).eq('id', lesson.id)
    fetchData()
  }

  const deleteLesson = async (e, lessonId) => {
    e.stopPropagation()
    if (!confirm('Delete this lesson? This will also delete all its highlights.')) return
    await supabase.from('lessons').delete().eq('id', lessonId)
    showToast('Lesson deleted', 'info')
    fetchData()
  }

  const HL_COLORS = { yellow: '#facc15', pink: '#ec4899', blue: '#3b82f6', green: '#22c55e', purple: '#a855f7' }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium overflow-x-auto pb-1">
        <Link to="/library" className="hover:text-surface-600 dark:hover:text-surface-200 transition-colors">
          Library
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} className="text-surface-300" />
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-surface-900 dark:text-surface-50 font-semibold">{crumb.name}</span>
            ) : (
              <Link to={`/folder/${crumb.id}`} className="hover:text-surface-600 dark:hover:text-surface-200 transition-colors">
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
            style={{ background: folder.color || '#6366f1' }}
          >
            <Folder size={24} />
          </div>
          <div>
            <h1 className="page-title leading-tight">{folder.name}</h1>
            <p className="text-surface-400 text-xs mt-0.5">
              {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
              {subfolders.length > 0 && ` • ${subfolders.length} subfolders`}
            </p>
          </div>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowSubfolderModal(true)} className="btn btn-secondary text-xs sm:text-sm">
            <FolderPlus size={15} /> New Subfolder
          </button>
          <button onClick={() => setShowLessonModal(true)} className="btn btn-primary text-xs sm:text-sm">
            <Plus size={15} /> New Lesson
          </button>
          <button
            onClick={() => setShowEditFolderModal(true)}
            className="btn btn-secondary p-2"
            title="Edit Folder"
          >
            <Edit3 size={15} />
          </button>
          <button
            onClick={handleDeleteFolder}
            className="btn btn-secondary p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
            title="Delete Folder"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Subfolders Section */}
      {subfolders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Subfolders</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {subfolders.map(sub => (
              <div
                key={sub.id}
                onClick={() => navigate(`/folder/${sub.id}`)}
                className="lesson-card group cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition-all flex items-center gap-3 p-3.5"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: sub.color || '#6366f1' }}
                >
                  <Folder size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{sub.name}</p>
                </div>
                <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-500 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lessons Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-800 pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Lessons in this folder</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn h-8 w-8 p-0 justify-center ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn h-8 w-8 p-0 justify-center ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {lessons.length === 0 ? (
          <div className="empty-state py-12">
            <FolderOpen size={44} className="text-surface-300" />
            <p className="font-semibold text-base mt-2">No lessons in this folder</p>
            <p className="text-xs text-surface-400 mt-1 mb-4">Add your first lesson to start organizing</p>
            <button onClick={() => setShowLessonModal(true)} className="btn btn-primary text-sm">
              <Plus size={15} /> Create Lesson in Folder
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map(lesson => (
              <div
                key={lesson.id}
                className="lesson-card group relative"
                onClick={() => navigate(`/lesson/${lesson.id}`)}
              >
                <div className="h-1.5 rounded-full mb-3" style={{ background: lesson.subjects?.color || folder.color || '#6366f1' }} />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{lesson.title}</h3>
                  <button
                    onClick={e => toggleFavorite(e, lesson)}
                    className="flex-shrink-0 text-surface-300 hover:text-amber-400 transition-colors"
                  >
                    {lesson.is_favorite ? (
                      <Star size={15} className="text-amber-400 fill-amber-400" />
                    ) : (
                      <StarOff size={15} />
                    )}
                  </button>
                </div>
                {lesson.subjects?.name && (
                  <p className="text-xs text-surface-400 mt-1">{lesson.subjects.name}</p>
                )}
                {lesson.highlights?.length > 0 && (
                  <div className="flex items-center gap-1 mt-3">
                    {[...new Set(lesson.highlights.map(h => h.color))].map(c => (
                      <span key={c} className="w-3 h-3 rounded-full" style={{ background: HL_COLORS[c] || '#ccc' }} />
                    ))}
                    <span className="text-xs text-surface-400 ml-1">{lesson.highlights.length} highlights</span>
                  </div>
                )}
                <p className="text-xs text-surface-400 mt-3">
                  {new Date(lesson.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <button
                  onClick={e => deleteLesson(e, lesson.id)}
                  className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 text-surface-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {lessons.map(lesson => (
              <div
                key={lesson.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors group"
                onClick={() => navigate(`/lesson/${lesson.id}`)}
              >
                <div
                  className="w-2 h-8 rounded-full flex-shrink-0"
                  style={{ background: lesson.subjects?.color || folder.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{lesson.title}</p>
                  <p className="text-xs text-surface-400">{lesson.subjects?.name || folder.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  {lesson.highlights?.length > 0 && (
                    <>
                      {[...new Set(lesson.highlights.map(h => h.color))].map(c => (
                        <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: HL_COLORS[c] }} />
                      ))}
                      <span className="text-xs text-surface-400 ml-1">{lesson.highlights.length}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-surface-400 w-24 text-right">
                  {new Date(lesson.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={e => toggleFavorite(e, lesson)} className="btn btn-ghost p-1">
                    {lesson.is_favorite ? <Star size={14} className="text-amber-400 fill-amber-400" /> : <StarOff size={14} />}
                  </button>
                  <button onClick={e => deleteLesson(e, lesson.id)} className="btn btn-ghost p-1 text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {showLessonModal && (
        <LessonModal
          subjects={subjects}
          folders={allFolders}
          defaultFolderId={id}
          onClose={() => setShowLessonModal(false)}
          onSaved={() => {
            setShowLessonModal(false)
            fetchData()
          }}
        />
      )}

      {showSubfolderModal && (
        <FolderModal
          parentId={id}
          allFolders={allFolders}
          onClose={() => setShowSubfolderModal(false)}
          onSaved={() => {
            setShowSubfolderModal(false)
            fetchData()
          }}
        />
      )}

      {showEditFolderModal && (
        <FolderModal
          folder={folder}
          allFolders={allFolders}
          onClose={() => setShowEditFolderModal(false)}
          onSaved={() => {
            setShowEditFolderModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
