import { useState } from 'react'
import { X, Folder, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Amber
  '#f97316', // Orange
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#64748b', // Slate
]

export default function FolderModal({ onClose, onSaved, folder = null, parentId = null, allFolders = [] }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(folder?.name || '')
  const [color, setColor] = useState(folder?.color || '#6366f1')
  const [selectedParentId, setSelectedParentId] = useState(folder?.parent_id || parentId || '')
  const [saving, setSaving] = useState(false)

  // Filter out self and descendants when picking parent folder to prevent circular nesting
  const eligibleParents = allFolders.filter(f => !folder || f.id !== folder.id)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast('Folder name is required', 'error')
      return
    }
    setSaving(true)

    const payload = {
      name: name.trim(),
      color,
      parent_id: selectedParentId || null,
      user_id: user.id,
    }

    let error
    if (folder) {
      ({ error } = await supabase.from('folders').update(payload).eq('id', folder.id))
    } else {
      ({ error } = await supabase.from('folders').insert(payload))
    }

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast(folder ? 'Folder updated!' : 'Folder created!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ background: color }}
            >
              <Folder size={18} />
            </div>
            <h2 className="font-bold text-xl">{folder ? 'Edit Folder' : 'New Folder'}</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Folder Name *</label>
            <input
              className="input-field"
              placeholder="e.g. Computer Science, Marketing 101…"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color Theme</label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                  style={{ background: c }}
                >
                  {color === c && <Check size={14} className="text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {eligibleParents.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Parent Folder (Optional)</label>
              <select
                className="input-field"
                value={selectedParentId}
                onChange={e => setSelectedParentId(e.target.value)}
              >
                <option value="">None (Top-Level Folder)</option>
                {eligibleParents.map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-3">
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
                folder ? 'Save Changes' : 'Create Folder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
