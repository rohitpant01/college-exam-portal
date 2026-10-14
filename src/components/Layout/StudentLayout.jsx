import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  GraduationCap,
  LayoutDashboard,
  FileText,
  ClipboardList,
  BarChart3,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { name: 'Notes', path: '/student/notes', icon: FileText },
  { name: 'Exams', path: '/student/exams', icon: ClipboardList },
  { name: 'My Results', path: '/student/results', icon: BarChart3 },
]

export default function StudentLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch (err) {
      toast.error(err?.message || 'Failed to sign out')
    }
  }

  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/student/dashboard')) return 'Student Dashboard'
    if (pathname.startsWith('/student/notes')) return 'Study Notes'
    if (pathname.startsWith('/student/exams')) return 'Available Exams'
    if (pathname.startsWith('/student/results')) return 'My Results'
    return 'Student Portal'
  }

  const getInitials = (name) => {
    if (!name) return 'ST'
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="portal-root flex">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Frosted Dark Glass */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-glass sidebar-pattern flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0 sidebar-slide-in' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Brand Header & Nav List */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-white font-bold text-lg tracking-tight">
                  PGI Student
                </span>
                <span className="block text-[10px] text-emerald-300/60 font-medium uppercase tracking-widest">
                  Learning Portal
                </span>
              </div>
            </div>
            {/* Close button on mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/student/dashboard' &&
                  location.pathname.startsWith(item.path))

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'nav-item-active'
                      : 'nav-item-inactive'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] transition-colors duration-200 ${
                      isActive
                        ? 'text-indigo-400'
                        : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom: User Info & Sign Out */}
        <div className="p-4 border-t border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 avatar-ring">
              {getInitials(profile?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || 'Student User'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  Student
                </span>
                {profile?.enrollment_no && (
                  <span className="text-[11px] text-slate-400 font-mono truncate">
                    #{profile.enrollment_no}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 font-medium focus:outline-none cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 portal-content">
        {/* Top Header Bar - Frosted White Glass */}
        <header className="h-16 header-glass px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100/80 transition-colors focus:outline-none cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          {/* User Info / Avatar */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {profile?.full_name || 'Student'}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                {profile?.enrollment_no
                  ? `Enrollment: ${profile.enrollment_no}`
                  : profile?.email || 'student@pgi.edu'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-xs flex items-center justify-center shadow-md shadow-emerald-500/20 avatar-ring select-none">
              {getInitials(profile?.full_name)}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
