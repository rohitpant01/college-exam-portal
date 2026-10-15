import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  ClipboardList,
  BarChart3,
  Clock,
  Award,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  BookOpen,
  Calendar,
  Bell,
  Sparkles,
  X,
  Megaphone
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const { user, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [notesCount, setNotesCount] = useState(0)
  const [completedAttempts, setCompletedAttempts] = useState([])
  const [upcomingExams, setUpcomingExams] = useState([])
  const [averageScore, setAverageScore] = useState(0)

  // Notification Popup State
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [newAnnouncements, setNewAnnouncements] = useState({
    newExams: [],
    newNotes: []
  })

  useEffect(() => {
    if (!user) return

    async function fetchDashboardData() {
      try {
        setLoading(true)

        // 1. Fetch count of available notes & recent notes
        const [notesCountRes, recentNotesRes] = await Promise.all([
          supabase.from('notes').select('*', { count: 'exact', head: true }),
          supabase
            .from('notes')
            .select(`
              id,
              title,
              created_at,
              subjects (
                name
              )
            `)
            .order('created_at', { ascending: false })
            .limit(3)
        ])

        if (notesCountRes.error) throw notesCountRes.error
        setNotesCount(notesCountRes.count || 0)

        // 2. Fetch student's completed exam attempts
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('exam_attempts')
          .select(`
            id,
            exam_id,
            score,
            total_marks,
            started_at,
            submitted_at,
            status,
            exams (
              id,
              title,
              total_marks,
              pass_marks,
              duration_minutes,
              subjects (
                name
              )
            )
          `)
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('submitted_at', { ascending: false })

        if (attemptsError) throw attemptsError
        const attempts = attemptsData || []
        setCompletedAttempts(attempts)

        // Calculate average score percentage
        if (attempts.length > 0) {
          const totalPercentages = attempts.reduce((acc, attempt) => {
            const maxScore = attempt.total_marks || attempt.exams?.total_marks || 1
            const percentage = ((attempt.score || 0) / maxScore) * 100
            return acc + percentage
          }, 0)
          setAverageScore(Math.round(totalPercentages / attempts.length))
        } else {
          setAverageScore(0)
        }

        // 3. Fetch published exams
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select(`
            id,
            title,
            description,
            duration_minutes,
            total_marks,
            pass_marks,
            starts_at,
            ends_at,
            created_at,
            subjects (
              name
            )
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (examsError) throw examsError

        // Filter out exams already completed by the student
        const completedExamIds = new Set(attempts.map((a) => a.exam_id))
        const uncompletedExams = (examsData || []).filter(
          (exam) => !completedExamIds.has(exam.id)
        )

        setUpcomingExams(uncompletedExams.slice(0, 5))

        // Get persistent timestamp of when the user last acknowledged announcements
        const lastSeenKey = `pgi_last_seen_announcements_${user.id}`
        const lastSeenTimeStr = localStorage.getItem(lastSeenKey)
        const lastSeenTime = lastSeenTimeStr ? new Date(lastSeenTimeStr).getTime() : 0

        // Only show items that were created AFTER the user's last acknowledgment
        const brandNewExams = uncompletedExams.filter((e) => {
          if (!e.created_at) return false
          return new Date(e.created_at).getTime() > lastSeenTime
        })

        const brandNewNotes = (recentNotesRes.data || []).filter((n) => {
          if (!n.created_at) return false
          return new Date(n.created_at).getTime() > lastSeenTime
        })

        if (brandNewExams.length > 0 || brandNewNotes.length > 0) {
          setNewAnnouncements({
            newExams: brandNewExams.slice(0, 4),
            newNotes: brandNewNotes.slice(0, 4)
          })
          setShowNotificationModal(true)
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user])

  const handleDismissNotification = () => {
    if (user?.id) {
      // Mark current timestamp so the modal won't show again across logins
      // until the admin uploads newer exams or notes.
      localStorage.setItem(
        `pgi_last_seen_announcements_${user.id}`,
        new Date().toISOString()
      )
    }
    setShowNotificationModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-700 font-medium">Loading your dashboard...</p>
      </div>
    )
  }

  const recentAttempts = completedAttempts.slice(0, 5)

  return (
    <div className="py-4 px-0">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header Banner */}
        <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {profile?.full_name || 'Student'}!
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
              {profile?.enrollment_no ? (
                <span>
                  Enrollment No:{' '}
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {profile.enrollment_no}
                  </span>{' '}
                  &bull;{' '}
                </span>
              ) : null}
              Track your exam progress, revise study notes, and evaluate your knowledge.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/student/exams"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 transition-all cursor-pointer"
            >
              Take Exam
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Stat 1: Available Notes */}
          <div className="glass-card stat-card-indigo rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Available Notes</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">{notesCount}</h3>
              <Link
                to="/student/notes"
                className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-3 group"
              >
                Browse materials
                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Stat 2: Exams Taken */}
          <div className="glass-card stat-card-emerald rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Exams Taken</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">
                {completedAttempts.length}
              </h3>
              <Link
                to="/student/results"
                className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-3 group"
              >
                View full history
                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ClipboardList className="w-6 h-6" />
            </div>
          </div>

          {/* Stat 3: Average Score */}
          <div className="glass-card stat-card-violet rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Average Score</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">
                {averageScore}%
              </h3>
              <p className="text-xs text-slate-400 mt-3">
                {completedAttempts.length > 0
                  ? `Across ${completedAttempts.length} completed ${
                      completedAttempts.length === 1 ? 'exam' : 'exams'
                    }`
                  : 'No completed exams yet'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Content Grid: Recent/Upcoming Exams & Recent Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: Recent / Upcoming Exams */}
          <div className="glass-card rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Available Exams
                </h2>
                <p className="text-xs text-slate-500">
                  Published tests ready for you to take
                </p>
              </div>
              <Link
                to="/student/exams"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingExams.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">
                  No upcoming exams
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  You are all caught up! New exams published by instructors will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {exam.subjects?.name || 'General'}
                        </span>
                        {exam.starts_at && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(exam.starts_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        {exam.title}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {exam.duration_minutes} mins
                        </span>
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          {exam.total_marks} Marks
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/student/exams/${exam.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shrink-0"
                    >
                      Take Exam
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Recent Results */}
          <div className="glass-card rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Recent Results
                </h2>
                <p className="text-xs text-slate-500">
                  Performance on your last 5 completed attempts
                </p>
              </div>
              <Link
                to="/student/results"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentAttempts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">
                  No completed exams yet
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Once you complete an exam, your scores, percentage, and detailed answer sheet will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {recentAttempts.map((attempt) => {
                  const maxMarks =
                    attempt.total_marks || attempt.exams?.total_marks || 1
                  const percentage = Math.round(
                    ((attempt.score || 0) / maxMarks) * 100
                  )
                  const passMarks = attempt.exams?.pass_marks ?? maxMarks * 0.4
                  const isPassed = (attempt.score || 0) >= passMarks

                  return (
                    <div
                      key={attempt.id}
                      className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {attempt.exams?.subjects?.name || 'General'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {attempt.submitted_at
                              ? new Date(
                                  attempt.submitted_at
                                ).toLocaleDateString()
                              : 'Recent'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-sm">
                          {attempt.exams?.title || 'Exam'}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>
                            Score:{' '}
                            <strong className="text-slate-700 font-semibold">
                              {attempt.score}/{maxMarks}
                            </strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Percentage:{' '}
                            <strong className="text-slate-700 font-semibold">
                              {percentage}%
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0">
                        {isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                        <Link
                          to={`/student/results/${attempt.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                        >
                          Review
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* New Updates & Announcements Modal Popup on Login */}
        {showNotificationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 max-w-lg w-full p-6 relative overflow-hidden">
              {/* Decorative top gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 pt-1 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span>New Updates Available</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Instructors recently added new study materials or exams for you.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismissNotification}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* New Exams Section */}
                {newAnnouncements.newExams.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Newly Scheduled Exams</span>
                    </div>
                    <div className="space-y-2">
                      {newAnnouncements.newExams.map((exam) => (
                        <div
                          key={exam.id}
                          className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100/80 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {exam.title}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{exam.subjects?.name || 'General'}</span>
                              <span>&bull;</span>
                              <span>{exam.duration_minutes} mins</span>
                              <span>&bull;</span>
                              <span className="font-semibold text-slate-700">{exam.total_marks} marks</span>
                            </p>
                          </div>
                          <Link
                            to={`/student/exams/${exam.id}`}
                            onClick={handleDismissNotification}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors shrink-0"
                          >
                            Take Exam
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Notes Section */}
                {newAnnouncements.newNotes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
                      <FileText className="w-3.5 h-3.5" />
                      <span>New Study Materials & Notes</span>
                    </div>
                    <div className="space-y-2">
                      {newAnnouncements.newNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100/80 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {note.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {note.subjects?.name || 'Study Material'}
                            </p>
                          </div>
                          <Link
                            to="/student/notes"
                            onClick={handleDismissNotification}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors shrink-0"
                          >
                            View Notes
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Tip: Check the sidebar anytime to explore all notes & tests.
                </span>
                <button
                  type="button"
                  onClick={handleDismissNotification}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
