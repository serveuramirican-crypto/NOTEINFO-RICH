import { useState } from 'react'
import { X, Folder, FolderInput } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

export default function MoveFolderModal({ lessonIds = [], folders = [], onClose, onMoved }) {
  const { showToast } = useToast()
  const [targetFolderId, setTargetFolderId] = useState('')
  const [moving, setMoving] = useState(false)

  const submitMove = async (e) => {
    e.preventDefault()
    if (lessonIds.length === 0) return
    setMoving(true)

    const { error } = await supabase
      .from('lessons')
      .update({ folder_id: targetFolderId || null })
      .in('id', lessonIds)

    setMoving(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast(
      `Moved ${lessonIds.length} ${lessonIds.length === 1 ? 'lesson' : 'lessons'}!`,
      'success'
    )
    onMoved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <FolderInput size={18} />
            </div>
            <h2 className="font-bold text-lg">Move to Folder</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-surface-400 mb-4">
          Choose a destination folder for {lessonIds.length} {lessonIds.length === 1 ? 'lesson' : 'lessons'}.
        </p>

        <form onSubmit={submitMove} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Select Folder</label>
            <select
              className="input-field text-sm"
              value={targetFolderId}
              onChange={e => setTargetFolderId(e.target.value)}
              autoFocus
            >
              <option value="">📁 No Folder (Root Library)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={moving} className="btn btn-primary flex-1 justify-center">
              {moving ? (
                <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ) : (
                'Move'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
