import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        showToast('Account created! Please check your email to confirm.', 'success')
        setMode('login')
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #312e81 0%, #6366f1 50%, #a78bfa 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 60% 40%, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 text-white text-center px-16">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <BookOpen size={36} color="white" />
          </div>
          <h1 className="text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            مكتبة
          </h1>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            Maktaba
          </h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-sm mx-auto">
            Your personal knowledge library. Capture, highlight, and learn — all in one calm, organized space.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            {[['📚', 'Organize', 'subjects & lessons'], ['🖊️', 'Highlight', 'Glasp-style'], ['🔍', 'Find', 'anything instantly']].map(([emoji, title, sub]) => (
              <div key={title} className="bg-white/10 backdrop-blur rounded-2xl p-4">
                <div className="text-3xl mb-2">{emoji}</div>
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-white/60 text-xs mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 bg-surface-50 dark:bg-surface-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <BookOpen size={20} color="white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-serif)' }}>Maktaba</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-surface-400 mb-8">
            {mode === 'login'
              ? 'Sign in to your personal library'
              : 'Start organizing your knowledge'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-surface-400 mt-6">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-brand-500 hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
