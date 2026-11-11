import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Save, X, Palette, Tag, User,
  Sun, Moon, BookOpen, Download, Type, Lock, Check,
  Shield, FileText, Database, Sparkles, RefreshCw, Key
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

const SUBJECT_ICONS = ['📚', '🔬', '💻', '📐', '🎨', '🌍', '💼', '🧠', '📖', '🏛️', '💡', '⚖️', '🩺', '📝', '🎯']
const SUBJECT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6',
  '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6',
  '#06b6d4', '#84cc16'
]

export default function Settings() {
  const { user, signOut } = useAuth()
  const { dark, toggleDark } = useTheme()
  const { showToast } = useToast()

  const [tab, setTab] = useState('subjects') // 'subjects' | 'colors' | 'reader' | 'backup' | 'account'

  // Subjects states
  const [subjects, setSubjects] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')
  const [editingSubject, setEditingSubject] = useState(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState('#6366f1')
  const [newSubjectIcon, setNewSubjectIcon] = useState('📚')
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [loadingSubjects, setLoadingSubjects] = useState(true)

  // Color Labels states
  const [colorLabels, setColorLabels] = useState({})

  // Reader Preferences states
  const [readerFontSize, setReaderFontSize] = useState(() => localStorage.getItem('maktaba_font_size') || '17px')
  const [readerFontFamily, setReaderFontFamily] = useState(() => localStorage.getItem('maktaba_font_family') || 'sans')
  const [readerLineHeight, setReaderLineHeight] = useState(() => localStorage.getItem('maktaba_line_height') || 'relaxed')
  const [autoRTL, setAutoRTL] = useState(() => localStorage.getItem('maktaba_auto_rtl') !== 'false')

  // Password change states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Backup & Export states
  const [exporting, setExporting] = useState(false)
  const [backupStats, setBackupStats] = useState({ lessons: 0, highlights: 0, folders: 0, subjects: 0 })

  const fetchSubjects = async () => {
    if (!user) return
    setLoadingSubjects(true)
    const { data } = await supabase
      .from('subjects')
      .select('*, lessons(id)')
      .eq('user_id', user.id)
      .order('name')
    setSubjects(data || [])
    setLoadingSubjects(false)
  }

  const fetchColorLabels = async () => {
    if (!user) return
    const { data } = await supabase.from('color_labels').select('*').eq('user_id', user.id)
    const map = {}
    for (const row of (data || [])) map[row.color] = row.label
    setColorLabels(map)
  }

  const fetchBackupStats = async () => {
    if (!user) return
    const [l, h, f, s] = await Promise.all([
      supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('highlights').select('id, lessons!inner(user_id)', { count: 'exact', head: true }).eq('lessons.user_id', user.id),
      supabase.from('folders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    setBackupStats({
      lessons: l.count || 0,
      highlights: h.count || 0,
      folders: f.count || 0,
      subjects: s.count || 0
    })
  }

  useEffect(() => {
    if (user) {
      fetchSubjects()
      fetchColorLabels()
      fetchBackupStats()
    }
  }, [user])

  // Save Reader Preferences
  const handleSaveReaderPrefs = (key, value) => {
    localStorage.setItem(key, value)
    if (key === 'maktaba_font_size') setReaderFontSize(value)
    if (key === 'maktaba_font_family') setReaderFontFamily(value)
    if (key === 'maktaba_line_height') setReaderLineHeight(value)
    if (key === 'maktaba_auto_rtl') setAutoRTL(value)
    showToast('Reading preferences updated!', 'success')
  }

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
    showToast('Subject updated!', 'success')
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
    const defaultVal = HIGHLIGHT_COLORS.find(c => c.id === colorId)?.defaultLabel || 'Highlight'
    const val = label.trim() || defaultVal
    await supabase.from('color_labels').upsert({ user_id: user.id, color: colorId, label: val }, { onConflict: 'user_id,color' })
    setColorLabels(prev => ({ ...prev, [colorId]: val }))
    showToast(`Label for ${colorId} saved!`, 'success')
  }

  const resetColorLabels = async () => {
    for (const c of HIGHLIGHT_COLORS) {
      await supabase.from('color_labels').upsert({ user_id: user.id, color: c.id, label: c.defaultLabel }, { onConflict: 'user_id,color' })
    }
    const map = {}
    for (const c of HIGHLIGHT_COLORS) map[c.id] = c.defaultLabel
    setColorLabels(map)
    showToast('Reset highlight labels to default!', 'info')
  }

  // Password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    setUpdatingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setUpdatingPassword(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Password successfully changed!', 'success')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  // Export Data JSON
  const handleExportJSON = async () => {
    setExporting(true)
    try {
      const [lRes, hRes, sRes, fRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('user_id', user.id),
        supabase.from('highlights').select('*, lessons!inner(user_id)').eq('lessons.user_id', user.id),
        supabase.from('subjects').select('*').eq('user_id', user.id),
        supabase.from('folders').select('*').eq('user_id', user.id),
      ])

      const backupData = {
        app: 'Maktaba',
        version: '2.0',
        exported_at: new Date().toISOString(),
        user_email: user.email,
        counts: {
          lessons: (lRes.data || []).length,
          highlights: (hRes.data || []).length,
          subjects: (sRes.data || []).length,
          folders: (fRes.data || []).length,
        },
        subjects: sRes.data || [],
        folders: fRes.data || [],
        lessons: lRes.data || [],
        highlights: hRes.data || [],
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maktaba_backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Knowledge base exported successfully!', 'success')
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  // Filtered subjects
  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase())
  )

  const tabs = [
    { id: 'subjects', label: 'Subjects', icon: Tag },
    { id: 'colors',   label: 'Highlight Labels', icon: Palette },
    { id: 'reader',   label: 'Reader Display', icon: Type },
    { id: 'backup',   label: 'Backup & Export', icon: Database },
    { id: 'account',  label: 'Account & Security', icon: User },
  ]

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
          Customize your study space, colors, reader preferences, and manage your data.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800 overflow-x-auto pb-px scrollbar-none">
        {tabs.map(t => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap -mb-px ${
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20'
                  : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-900'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── TAB 1: SUBJECTS ─── */}
      {tab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-surface-900 dark:text-white">Subjects taxonomy</h2>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Categorize your lessons and organize your study material.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search subjects…"
                value={subjectSearch}
                onChange={e => setSubjectSearch(e.target.value)}
                className="input-field text-xs h-9 w-40 sm:w-48"
              />
              <button
                onClick={() => setShowAddSubject(true)}
                className="btn btn-primary text-xs h-9 px-3 flex-shrink-0"
              >
                <Plus size={14} /> Add Subject
              </button>
            </div>
          </div>

          {/* Add Subject Modal / Form */}
          {showAddSubject && (
            <div className="stat-card p-4 sm:p-5 border-2 border-brand-200 dark:border-brand-800 bg-brand-50/20 dark:bg-brand-950/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Create New Subject</h3>
                <button onClick={() => setShowAddSubject(false)} className="text-surface-400 hover:text-surface-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <select
                  className="input-field h-10 w-20 text-xl text-center cursor-pointer"
                  value={newSubjectIcon}
                  onChange={e => setNewSubjectIcon(e.target.value)}
                >
                  {SUBJECT_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  className="input-field h-10 flex-1 text-sm"
                  placeholder="Subject name (e.g. History, Mathematics, Law)"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addSubject()}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-surface-500 mb-1.5">Subject Color Theme</p>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSubjectColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        newSubjectColor === c ? 'scale-110 shadow-md border-surface-900 dark:border-white' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={addSubject} className="btn btn-primary text-xs h-9">
                  <Plus size={14} /> Create Subject
                </button>
                <button onClick={() => setShowAddSubject(false)} className="btn btn-ghost text-xs h-9">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Subjects List */}
          {loadingSubjects ? (
            <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
          ) : filteredSubjects.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
              <Tag size={32} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
              <p className="text-sm font-semibold text-surface-600 dark:text-surface-300">No subjects found</p>
              <p className="text-xs text-surface-400 mt-0.5">Click "Add Subject" to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredSubjects.map(s => (
                <div
                  key={s.id}
                  className="stat-card p-4 flex items-center justify-between gap-3 border border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 transition-all"
                >
                  {editingSubject?.id === s.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 items-center">
                        <select
                          className="input-field h-8 w-14 text-center p-0"
                          value={editingSubject.icon}
                          onChange={e => setEditingSubject(p => ({ ...p, icon: e.target.value }))}
                        >
                          {SUBJECT_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                        <input
                          className="input-field h-8 flex-1 text-xs"
                          value={editingSubject.name}
                          onChange={e => setEditingSubject(p => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {SUBJECT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditingSubject(p => ({ ...p, color: c }))}
                            className={`w-5 h-5 rounded-full border transition-all ${
                              editingSubject.color === c ? 'scale-110 border-surface-900 dark:border-white shadow-xs' : 'border-transparent'
                            }`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button onClick={() => updateSubject(editingSubject)} className="btn btn-primary h-7 text-xs px-2.5">
                          <Save size={12} /> Save
                        </button>
                        <button onClick={() => setEditingSubject(null)} className="btn btn-ghost h-7 text-xs px-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-xs"
                          style={{ background: s.color + '22' }}
                        >
                          {s.icon || '📚'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-surface-900 dark:text-white truncate">{s.name}</p>
                          <p className="text-xs text-surface-400">
                            {s.lessons?.length || 0} {s.lessons?.length === 1 ? 'lesson' : 'lessons'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ background: s.color }} />
                        <button
                          onClick={() => setEditingSubject({ ...s })}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                          title="Edit subject"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteSubject(s.id)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Delete subject"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: COLOR LABELS ─── */}
      {tab === 'colors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-surface-900 dark:text-white">Highlight Semantic Labels</h2>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Define what each highlighter color represents during your reading and study sessions.
              </p>
            </div>
            <button
              onClick={resetColorLabels}
              className="btn btn-secondary text-xs h-8 px-2.5 flex items-center gap-1 text-surface-500"
              title="Reset all labels to defaults"
            >
              <RefreshCw size={12} /> Reset Defaults
            </button>
          </div>

          <div className="space-y-3">
            {HIGHLIGHT_COLORS.map(c => {
              const currentLabel = colorLabels[c.id] || c.defaultLabel
              return (
                <div
                  key={c.id}
                  className="stat-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-surface-200 dark:border-surface-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex-shrink-0 shadow-sm" style={{ background: c.hex }} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 capitalize">{c.id}</p>
                      <p className="text-sm font-bold text-surface-900 dark:text-white">{currentLabel}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                      className="input-field h-9 text-xs flex-1"
                      placeholder={c.defaultLabel}
                      defaultValue={currentLabel}
                      onBlur={e => saveColorLabel(c.id, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveColorLabel(c.id, e.target.value)}
                    />
                    <div
                      className="text-xs px-2.5 py-1.5 rounded-lg border font-medium hidden sm:block whitespace-nowrap"
                      style={{ background: c.hex + '18', borderColor: c.hex + '40', color: c.hex }}
                    >
                      Sample Highlight
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: READER DISPLAY PREFERENCES ─── */}
      {tab === 'reader' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-surface-900 dark:text-white">Reading & Typography Settings</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Personalize your default reading comfort, typography family, and text sizing.
            </p>
          </div>

          <div className="stat-card p-5 space-y-5 border border-surface-200 dark:border-surface-800">
            {/* Font Size */}
            <div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">Default Reader Font Size</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '15px', label: 'Small (15px)' },
                  { id: '17px', label: 'Medium (17px - Default)' },
                  { id: '19px', label: 'Large (19px)' },
                  { id: '21px', label: 'Extra Large (21px)' },
                ].map(size => (
                  <button
                    key={size.id}
                    onClick={() => handleSaveReaderPrefs('maktaba_font_size', size.id)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      readerFontSize === size.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div className="pt-3 border-t border-surface-100 dark:border-surface-800">
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">Font Family Style</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'sans', label: 'Modern Sans (Inter)', desc: 'Clean, versatile, legible' },
                  { id: 'serif', label: 'Editorial Serif (Playfair)', desc: 'Classic book typography' },
                  { id: 'arabic', label: 'Noto Sans Arabic', desc: 'Optimized for Arabic texts' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSaveReaderPrefs('maktaba_font_family', f.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      readerFontFamily === f.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900'
                    }`}
                  >
                    <p className="text-xs font-bold">{f.label}</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Line Spacing */}
            <div className="pt-3 border-t border-surface-100 dark:border-surface-800">
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">Paragraph Line Height</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'snug', label: 'Compact' },
                  { id: 'relaxed', label: 'Comfortable' },
                  { id: 'loose', label: 'Spacious' },
                ].map(lh => (
                  <button
                    key={lh.id}
                    onClick={() => handleSaveReaderPrefs('maktaba_line_height', lh.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      readerLineHeight === lh.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900'
                    }`}
                  >
                    {lh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RTL Auto-detection */}
            <div className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Auto Right-To-Left (RTL) Detection</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  Automatically align paragraphs in Arabic or Hebrew to the right.
                </p>
              </div>
              <button
                onClick={() => handleSaveReaderPrefs('maktaba_auto_rtl', !autoRTL)}
                className={`w-12 h-6 rounded-full transition-colors relative ${autoRTL ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-700'}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${autoRTL ? 'translate-x-7' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: BACKUP & EXPORT ─── */}
      {tab === 'backup' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-surface-900 dark:text-white">Data Management & Export</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Download your notes, highlights, and taxonomy archive anytime. You own 100% of your data.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card p-4 border border-surface-200 dark:border-surface-800 text-center">
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{backupStats.lessons}</p>
              <p className="text-xs text-surface-400 mt-0.5">Lessons Saved</p>
            </div>
            <div className="stat-card p-4 border border-surface-200 dark:border-surface-800 text-center">
              <p className="text-2xl font-bold text-amber-500">{backupStats.highlights}</p>
              <p className="text-xs text-surface-400 mt-0.5">Highlights Made</p>
            </div>
            <div className="stat-card p-4 border border-surface-200 dark:border-surface-800 text-center">
              <p className="text-2xl font-bold text-emerald-500">{backupStats.folders}</p>
              <p className="text-xs text-surface-400 mt-0.5">Folders</p>
            </div>
            <div className="stat-card p-4 border border-surface-200 dark:border-surface-800 text-center">
              <p className="text-2xl font-bold text-pink-500">{backupStats.subjects}</p>
              <p className="text-xs text-surface-400 mt-0.5">Subjects</p>
            </div>
          </div>

          <div className="stat-card p-5 border border-surface-200 dark:border-surface-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-surface-900 dark:text-white">Export Full Knowledge Base (JSON)</p>
                <p className="text-xs text-surface-400 mt-0.5">
                  Download a complete backup containing all lessons, highlight ranges, notes, folders, and subjects.
                </p>
              </div>
              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="btn btn-primary text-xs h-9 px-4 flex items-center gap-1.5 flex-shrink-0"
              >
                <Download size={14} />
                <span>{exporting ? 'Exporting…' : 'Download JSON Backup'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: ACCOUNT & SECURITY ─── */}
      {tab === 'account' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-surface-900 dark:text-white">Account & Preferences</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Manage your credentials, authentication session, and active visual theme.
            </p>
          </div>

          {/* User Card */}
          <div className="stat-card p-5 border border-surface-200 dark:border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">Active Account</p>
                <p className="font-bold text-base text-surface-900 dark:text-white">{user?.email}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Check size={12} /> Connected to Supabase Cloud
                </p>
              </div>
            </div>
          </div>

          {/* Visual Theme Selector */}
          <div className="stat-card p-5 border border-surface-200 dark:border-surface-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-surface-900 dark:text-white">App Appearance</p>
              <p className="text-xs text-surface-400 mt-0.5">
                Current theme: <span className="font-medium text-brand-600 dark:text-brand-400">{dark ? 'Dark Mode' : 'Light Mode'}</span>
              </p>
            </div>
            <button
              onClick={toggleDark}
              className="btn btn-secondary text-xs h-9 px-3.5 flex items-center gap-1.5"
            >
              {dark ? <><Sun size={15} className="text-amber-400" /> Switch to Light</> : <><Moon size={15} className="text-brand-500" /> Switch to Dark</>}
            </button>
          </div>

          {/* Password Change Form */}
          <div className="stat-card p-5 border border-surface-200 dark:border-surface-800 space-y-4">
            <div>
              <p className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-1.5">
                <Lock size={15} className="text-brand-500" /> Change Password
              </p>
              <p className="text-xs text-surface-400 mt-0.5">
                Update your account password securely in Supabase auth.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3 max-w-md">
              <input
                type="password"
                placeholder="New password (min. 6 characters)"
                className="input-field text-xs h-9"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                className="input-field text-xs h-9"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <button
                type="submit"
                disabled={updatingPassword || !newPassword}
                className="btn btn-primary text-xs h-9 px-4 flex items-center gap-1.5"
              >
                <Key size={14} />
                <span>{updatingPassword ? 'Updating…' : 'Update Password'}</span>
              </button>
            </form>
          </div>

          {/* Sign Out Card */}
          <div className="stat-card p-5 border border-red-200 dark:border-red-950/60 bg-red-50/20 dark:bg-red-950/10 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-red-600 dark:text-red-400">Sign Out</p>
              <p className="text-xs text-surface-400 mt-0.5">Terminate this device's active session.</p>
            </div>
            <button
              onClick={() => signOut()}
              className="btn btn-danger text-xs h-9 px-4"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
