import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { Loader2 } from 'lucide-react'

// Layout components
const AdminLayout = lazy(() => import('./components/Layout/AdminLayout'))
const StudentLayout = lazy(() => import('./components/Layout/StudentLayout'))

// Public / Auth components
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))

// Admin components
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminNotes = lazy(() => import('./pages/admin/Notes'))
const AdminSubjects = lazy(() => import('./pages/admin/Subjects'))
const AdminExams = lazy(() => import('./pages/admin/Exams'))
const ExamQuestions = lazy(() => import('./pages/admin/ExamQuestions'))
const AdminResults = lazy(() => import('./pages/admin/Results'))
const AdminExamResults = lazy(() => import('./pages/admin/ExamResults'))
const AdminStudents = lazy(() => import('./pages/admin/Students'))

// Student components
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const StudentNotes = lazy(() => import('./pages/student/Notes'))
const StudentExams = lazy(() => import('./pages/student/ExamList'))
const TakeExam = lazy(() => import('./pages/student/TakeExam'))
const StudentResults = lazy(() => import('./pages/student/MyResults'))
const ExamResult = lazy(() => import('./pages/student/ExamResult'))

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500">Loading...</p>
      </div>
    </div>
  )
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <PageLoading />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Navigate to="/student/dashboard" replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Root Route */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin Routes */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="notes" element={<AdminNotes />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="exams/:examId/questions" element={<ExamQuestions />} />
            <Route path="results" element={<AdminResults />} />
            <Route path="results/:examId" element={<AdminExamResults />} />
            <Route path="students" element={<AdminStudents />} />
          </Route>
        </Route>

        {/* Student Routes */}
        <Route element={<ProtectedRoute requiredRole="student" />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="/student/dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="notes" element={<StudentNotes />} />
            <Route path="exams" element={<StudentExams />} />
            <Route path="exams/:examId" element={<TakeExam />} />
            <Route path="results" element={<StudentResults />} />
            <Route path="results/:attemptId" element={<ExamResult />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
