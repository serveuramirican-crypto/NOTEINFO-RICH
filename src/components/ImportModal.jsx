import { useState, useRef } from 'react'
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function ImportModal({ folders = [], subjects = [], onClose, onImported }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)

  const [files, setFiles] = useState([])
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = async (fileList) => {
    const valid = []
    for (const f of fileList) {
      if (f.name.endsWith('.md') || f.name.endsWith('.txt') || f.type.includes('text')) {
        const text = await f.text()
        // Determine title: first markdown heading # Title or filename
        let title = f.name.replace(/\.[^/.]+$/, '')
        const headingMatch = text.match(/^#\s+(.+)$/m)
        if (headingMatch && headingMatch[1]) {
          title = headingMatch[1].trim()
        }
        valid.push({
          name: f.name,
          title,
          content: text,
          size: f.size,
        })
      }
    }
    if (valid.length === 0) {
      showToast('Please select valid .md or .txt files', 'error')
      return
    }
    setFiles(prev => [...prev, ...valid])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const submitImport = async () => {
    if (files.length === 0) {
      showToast('Add at least one file to import', 'error')
      return
    }
    setImporting(true)

    const payload = files.map(f => ({
      user_id: user.id,
      title: f.title,
      content: f.content,
      folder_id: selectedFolderId || null,
      subject_id: selectedSubjectId || null,
    }))

    const { error } = await supabase.from('lessons').insert(payload)
    setImporting(false)

    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast(`Successfully imported ${files.length} ${files.length === 1 ? 'lesson' : 'lessons'}!`, 'success')
    onImported()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Upload size={18} />
            </div>
            <h2 className="font-bold text-xl">Import Lessons</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Drag and drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20'
                : 'border-surface-200 dark:border-surface-800 hover:border-brand-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.txt,text/plain,text/markdown"
              className="hidden"
              onChange={e => handleFiles(Array.from(e.target.files || []))}
            />
            <FileText size={32} className="mx-auto text-surface-400 mb-2" />
            <p className="font-medium text-sm">
              Click to select or drag and drop <span className="text-brand-500">.md</span> or <span className="text-brand-500">.txt</span> files
            </p>
            <p className="text-xs text-surface-400 mt-1">
              File titles will be extracted automatically from headings or filenames
            </p>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                Ready to import ({files.length})
              </p>
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText size={14} className="text-brand-500 flex-shrink-0" />
                    <input
                      className="input-field py-1 px-2 h-7 text-xs flex-1"
                      value={file.title}
                      onChange={e => {
                        const val = e.target.value
                        setFiles(prev => prev.map((item, i) => i === idx ? { ...item, title: val } : item))
                      }}
                      placeholder="Lesson title"
                    />
                  </div>
                  <span className="text-surface-400 text-[10px] flex-shrink-0">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-surface-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Destination options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-surface-500">Destination Folder</label>
              <select
                className="input-field text-xs h-9"
                value={selectedFolderId}
                onChange={e => setSelectedFolderId(e.target.value)}
              >
                <option value="">No Folder (Root Library)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-surface-500">Subject Tag</label>
              <select
                className="input-field text-xs h-9"
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
              >
                <option value="">No Subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitImport}
              disabled={importing || files.length === 0}
              className="btn btn-primary flex-1 justify-center"
            >
              {importing ? (
                <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ) : (
                `Import ${files.length > 0 ? `(${files.length})` : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
