import { useState } from 'react'
import { X, Folder } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function LessonModal({
  subjects = [],
  folders = [],
  defaultFolderId = '',
  onClose,
  onSaved,
  lesson = null,
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState(lesson?.title || '')
  const [content, setContent] = useState(lesson?.content || '')
  const [subjectId, setSubjectId] = useState(lesson?.subject_id || '')
  const [folderId, setFolderId] = useState(lesson?.folder_id || defaultFolderId || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast('Title is required', 'error')
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      content: content.trim(),
      subject_id: subjectId || null,
      folder_id: folderId || null,
      user_id: user.id,
    }
    let error
    if (lesson) {
      ({ error } = await supabase.from('lessons').update(payload).eq('id', lesson.id))
    } else {
      ({ error } = await supabase.from('lessons').insert(payload))
    }
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(lesson ? 'Lesson updated!' : 'Lesson created!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-xl">{lesson ? 'Edit Lesson' : 'New Lesson'}</h2>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <input
              dir="auto"
              className="input-field"
              placeholder="e.g. Chapter 3 — Sorting Algorithms"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Folder</label>
              <select
                className="input-field text-sm"
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
              >
                <option value="">No folder (General)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Subject</label>
              <select
                className="input-field text-sm"
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
              >
                <option value="">No subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Content</label>
            <textarea
              dir="auto"
              className="input-field resize-none leading-relaxed font-sans"
              rows={8}
              placeholder="Paste or type your lesson content here…"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center">
              {saving ? (
                <div
                  className="spinner"
                  style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                />
              ) : (
                lesson ? 'Save Changes' : 'Create Lesson'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
