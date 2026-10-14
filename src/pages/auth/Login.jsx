import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { GraduationCap, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { signIn, user, profile } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (user && profile?.role) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/student/dashboard', { replace: true })
      }
    }
  }, [user, profile, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      toast.error('Please enter both email and password')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      let res
      if (typeof signIn === 'function') {
        if (signIn.length === 1) {
          res = await signIn({ email: trimmedEmail, password })
        } else {
          res = await signIn(trimmedEmail, password)
        }
      }

      if (res?.error) {
        toast.error(res.error.message || 'Invalid email or password')
        setLoading(false)
        return
      }

      toast.success('Signed in successfully!')

      // Determine user role for redirection
      let role = res?.profile?.role || res?.user?.role || profile?.role

      if (!role) {
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          if (currentUser) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', currentUser.id)
              .maybeSingle()
            role = profileData?.role
          }
        } catch {
          // Fallback to default student if profile query fails
          role = 'student'
        }
      }

      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/student/dashboard', { replace: true })
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to sign in. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen auth-bg-campus flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Decorative floating blobs */}
      <div className="floating-blob w-72 h-72 bg-indigo-500 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }}></div>
      <div className="floating-blob w-96 h-96 bg-violet-600 bottom-[-15%] right-[-10%]" style={{ animationDelay: '3s' }}></div>
      <div className="floating-blob w-64 h-64 bg-cyan-500 top-[50%] right-[10%]" style={{ animationDelay: '6s', opacity: 0.15 }}></div>

      <div className="w-full max-w-md bg-white/[0.92] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 border border-white/30 p-8 sm:p-10 transition-all animate-fade-slide-up relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            PGI Exam Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-normal">
            Welcome Back! Please enter your details to sign in
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm pl-11 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm pl-11 pr-11 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-8 pt-6 border-t border-slate-200/60 text-center">
          <p className="text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline transition-colors"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
