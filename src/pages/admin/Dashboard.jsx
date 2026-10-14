import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, 
  FileText, 
  ClipboardList, 
  CheckCircle, 
  Plus, 
  ArrowRight, 
  Clock, 
  BookOpen, 
  Calendar,
  AlertCircle,
  HelpCircle,
  Download
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalNotes: 0,
    totalExams: 0,
    publishedExams: 0
  })
  const [recentExams, setRecentExams] = useState([])
  const [recentNotes, setRecentNotes] = useState([])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch stats counts in parallel
      const [studentsRes, notesRes, examsRes, publishedExamsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }).eq('is_published', true)
      ])

      setStats({
        totalStudents: studentsRes.count || 0,
        totalNotes: notesRes.count || 0,
        totalExams: examsRes.count || 0,
        publishedExams: publishedExamsRes.count || 0
      })

      // Fetch recent 5 exams with subject info and question count
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          id,
          title,
          duration_minutes,
          total_marks,
          is_published,
          created_at,
          subjects (
            id,
            name
          ),
          questions (
            id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (examsError) throw examsError

      const formattedExams = (examsData || []).map(exam => ({
        ...exam,
        questionCount: Array.isArray(exam.questions) ? exam.questions.length : 0,
        subjectName: exam.subjects?.name || 'Unassigned'
      }))
      setRecentExams(formattedExams)

      // Fetch recent 5 notes with subject info
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          id,
          title,
          description,
          file_name,
          file_size,
          file_url,
          created_at,
          subjects (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (notesError) throw notesError

      const formattedNotes = (notesData || []).map(note => ({
        ...note,
        subjectName: note.subjects?.name || 'General'
      }))
      setRecentNotes(formattedNotes)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      toast.error('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="py-4 px-0">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header Banner */}
        <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
              Welcome back, <span className="text-indigo-600 font-semibold">{profile?.full_name || 'Admin'}</span>! Here is an overview of the exam portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/admin/exams')}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Exam
            </button>
            <button
              onClick={() => navigate('/admin/notes')}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              Upload Note
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 rounded"></div>
                    <div className="h-8 w-16 bg-slate-300 rounded"></div>
                  </div>
                  <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Students */}
            <div className="glass-card stat-card-indigo rounded-2xl p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Students</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalStudents}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Registered learners</span>
                <Link to="/admin/students" className="text-indigo-600 font-medium hover:underline inline-flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Total Notes */}
            <div className="glass-card stat-card-emerald rounded-2xl p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Notes</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalNotes}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Study materials</span>
                <Link to="/admin/notes" className="text-emerald-600 font-medium hover:underline inline-flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Total Exams */}
            <div className="glass-card stat-card-violet rounded-2xl p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Exams</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalExams}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Created assessments</span>
                <Link to="/admin/exams" className="text-violet-600 font-medium hover:underline inline-flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Published Exams */}
            <div className="glass-card stat-card-amber rounded-2xl p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Published Exams</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{stats.publishedExams}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {stats.totalExams > 0
                    ? `${Math.round((stats.publishedExams / stats.totalExams) * 100)}% live`
                    : 'No exams yet'}
                </span>
                <Link to="/admin/exams" className="text-amber-600 font-medium hover:underline inline-flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tables Section: Recent Exams & Recent Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Exams */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Recent Exams</h2>
                <p className="text-xs text-slate-500 mt-0.5">Latest test configurations</p>
              </div>
              <Link
                to="/admin/exams"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-slate-200 rounded"></div>
                      <div className="h-3 w-24 bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : recentExams.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No exams created yet</p>
                <Link
                  to="/admin/exams"
                  className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Create your first exam &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3">Title & Subject</th>
                      <th className="px-4 py-3">Questions</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {recentExams.map((exam) => (
                      <tr
                        key={exam.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => navigate(`/admin/exams/${exam.id}/questions`)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors">
                            {exam.title}
                          </p>
                          <span className="inline-block mt-0.5 text-xs text-slate-500">
                            {exam.subjectName}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 font-medium">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                            {exam.questionCount} {exam.questionCount === 1 ? 'Q' : 'Qs'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {exam.is_published ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-500">
                          {formatDate(exam.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Recent Notes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Study materials uploaded recently</p>
              </div>
              <Link
                to="/admin/notes"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-slate-200 rounded"></div>
                      <div className="h-3 w-24 bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-4 w-16 bg-slate-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : recentNotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No notes uploaded yet</p>
                <Link
                  to="/admin/notes"
                  className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Upload your first note &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3">Title & Subject</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-6 py-3 text-right">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {recentNotes.map((note) => (
                      <tr key={note.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 line-clamp-1">{note.title}</p>
                          <span className="inline-block mt-0.5 text-xs text-slate-500">
                            {note.subjectName}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500 font-mono">
                          {formatFileSize(note.file_size)}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {formatDate(note.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {note.file_url ? (
                            <a
                              href={note.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Portal Quick Links */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Quick Management Navigation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/admin/subjects"
              className="quick-link-card p-4 rounded-xl flex items-center gap-3"
            >
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Subjects</p>
                <p className="text-xs text-slate-500">Manage courses & modules</p>
              </div>
            </Link>

            <Link
              to="/admin/exams"
              className="p-4 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 transition-all flex items-center gap-3"
            >
              <div className="p-2.5 rounded-lg bg-violet-50 text-violet-600">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Exam Manager</p>
                <p className="text-xs text-slate-500">Create & publish tests</p>
              </div>
            </Link>

            <Link
              to="/admin/results"
              className="p-4 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 transition-all flex items-center gap-3"
            >
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Test Results</p>
                <p className="text-xs text-slate-500">Student scores & pass rates</p>
              </div>
            </Link>

            <Link
              to="/admin/students"
              className="p-4 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all flex items-center gap-3"
            >
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">Students List</p>
                <p className="text-xs text-slate-500">Learner directory & records</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
