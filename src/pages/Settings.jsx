import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Save, X, Palette, Tag, User,
  Sun, Moon, BookOpen
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'

const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#facc15', defaultLabel: 'Important' },
  { id: 'pink',   hex: '#ec4899', defaultLabel: 'Definition' },
  { id: 'blue',   hex: '#3b82f6', defaultLabel: 'Example' },
  { id: 'green',  hex: '#22c55e', defaultLabel: 'To Review' },
  { id: 'purple', hex: '#a855f7', defaultLabel: 'Concept' },
]

const SUBJECT_ICONS = ['📚', '🔬', '💻', '📐', '🎨', '🌍', '💼', '🧠', '📖', '🏛️']
const SUBJECT_COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#3b82f6','#a855f7','#ef4444','#14b8a6','#f97316','#8b5cf6']

export default function Settings() {
  const { user, signOut } = useAuth()
  const { dark, toggleDark } = useTheme()
  const { showToast } = useToast()

  const [subjects, setSubjects] = useState([])
  const [colorLabels, setColorLabels] = useState({})
  const [editingSubject, setEditingSubject] = useState(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState('#6366f1')
  const [newSubjectIcon, setNewSubjectIcon] = useState('📚')
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [tab, setTab] = useState('subjects') // 'subjects' | 'colors' | 'account'

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('user_id', user.id).order('name')
    setSubjects(data || [])
  }

  const fetchColorLabels = async () => {
    const { data } = await supabase.from('color_labels').select('*').eq('user_id', user.id)
    const map = {}
    for (const row of (data || [])) map[row.color] = row.label
    setColorLabels(map)
  }

  useEffect(() => {
    if (user) { fetchSubjects(); fetchColorLabels() }
  }, [user])

  // Subjects CRUD
  const addSubject = async () => {
    if (!newSubjectName.trim()) return
    const { error } = await supabase.from('subjects').insert({
      user_id: user.id,
      name: newSubjectName.trim(),
      color: newSubjectColor,
      icon: newSubjectIcon,
    })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Subject created!', 'success')
    setNewSubjectName('')
    setShowAddSubject(false)
    fetchSubjects()
  }

  const updateSubject = async (s) => {
    await supabase.from('subjects').update({ name: s.name, color: s.color, icon: s.icon }).eq('id', s.id)
    showToast('Saved!', 'success')
    setEditingSubject(null)
    fetchSubjects()
  }

  const deleteSubject = async (id) => {
    if (!confirm('Delete this subject? Lessons will be unlinked.')) return
    await supabase.from('subjects').delete().eq('id', id)
    showToast('Subject deleted', 'info')
    fetchSubjects()
  }

  // Color labels
  const saveColorLabel = async (colorId, label) => {
    await supabase.from('color_labels').upsert({ user_id: user.id, color: colorId, label }, { onConflict: 'user_id,color' })
    setColorLabels(prev => ({ ...prev, [colorId]: label }))
    showToast('Label updated', 'success')
  }

  const tabs = [
    { id: 'subjects', label: '📁 Subjects' },
    { id: 'colors',   label: '🎨 Color Labels' },
    { id: 'account',  label: '👤 Account' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="page-title mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 border-b border-surface-200 dark:border-surface-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── SUBJECTS ─── */}
      {tab === 'subjects' && (
        <div className="space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="stat-card flex items-center gap-4">
              {editingSubject?.id === s.id ? (
                <div className="flex-1 flex flex-wrap gap-2 items-center">
                  <span className="text-xl">{editingSubject.icon}</span>
                  <input
                    className="input-field h-9 flex-1 text-sm"
                    value={editingSubject.name}
                    onChange={e => setEditingSubject(p => ({ ...p, name: e.target.value }))}
                  />
                  <div className="flex gap-1">
                    {SUBJECT_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditingSubject(p => ({ ...p, color: c }))}
                        className="w-5 h-5 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: editingSubject.color === c ? '#18181b' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button onClick={() => updateSubject(editingSubject)} className="btn btn-primary h-8 text-xs">
                    <Save size={13} /> Save
                  </button>
                  <button onClick={() => setEditingSubject(null)} className="btn btn-ghost h-8 text-xs">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: s.color + '22' }}>
                    {s.icon || '📚'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{s.name}</p>
                  </div>
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <button onClick={() => setEditingSubject({ ...s })} className="btn btn-ghost p-1.5">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => deleteSubject(s.id)} className="btn btn-ghost p-1.5 text-red-400">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add subject form */}
          {showAddSubject ? (
            <div className="stat-card space-y-3">
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  className="input-field h-9 w-16 text-xl text-center"
                  value={newSubjectIcon}
                  onChange={e => setNewSubjectIcon(e.target.value)}
                >
                  {SUBJECT_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  className="input-field h-9 flex-1 text-sm"
                  placeholder="Subject name"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addSubject()}
                />
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewSubjectColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ background: c, borderColor: newSubjectColor === c ? '#18181b' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addSubject} className="btn btn-primary text-sm h-9">
                  <Plus size={15} /> Create Subject
                </button>
                <button onClick={() => setShowAddSubject(false)} className="btn btn-ghost text-sm h-9">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddSubject(true)} className="btn btn-secondary w-full justify-center">
              <Plus size={16} /> Add Subject
            </button>
          )}
        </div>
      )}

      {/* ─── COLOR LABELS ─── */}
      {tab === 'colors' && (
        <div className="space-y-3">
          <p className="text-sm text-surface-400 mb-4">Customize what each highlight color means to you.</p>
          {HIGHLIGHT_COLORS.map(c => (
            <div key={c.id} className="stat-card flex items-center gap-4">
              <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: c.hex }} />
              <span className="text-sm capitalize w-16">{c.id}</span>
              <input
                className="input-field flex-1 h-9 text-sm"
                defaultValue={colorLabels[c.id] || c.defaultLabel}
                onBlur={e => saveColorLabel(c.id, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveColorLabel(c.id, e.target.value)}
                placeholder={c.defaultLabel}
              />
            </div>
          ))}
        </div>
      )}

      {/* ─── ACCOUNT ─── */}
      {tab === 'account' && (
        <div className="space-y-4">
          <div className="stat-card">
            <p className="text-xs text-surface-400 mb-1">Signed in as</p>
            <p className="font-semibold">{user?.email}</p>
          </div>

          <div className="stat-card flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Theme</p>
              <p className="text-xs text-surface-400 mt-0.5">{dark ? 'Dark mode' : 'Light mode'}</p>
            </div>
            <button
              onClick={toggleDark}
              className="btn btn-secondary h-9"
            >
              {dark ? <><Sun size={15} /> Light</> : <><Moon size={15} /> Dark</>}
            </button>
          </div>

          <button
            onClick={() => signOut()}
            className="btn btn-danger w-full justify-center"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
