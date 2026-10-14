import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute({ requiredRole, children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Checking authorization...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    if (profile?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    } else if (profile?.role === 'student') {
      return <Navigate to="/student/dashboard" replace />
    } else {
      return <Navigate to="/login" replace />
    }
  }

  return children ? children : <Outlet />
}
