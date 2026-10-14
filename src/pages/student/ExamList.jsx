import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  Award,
  HelpCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RotateCw,
  ArrowRight,
  Loader2,
  FileQuestion,
  History
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ExamList() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [availableExams, setAvailableExams] = useState([])
  const [completedAttempts, setCompletedAttempts] = useState([])
  const [inProgressMap, setInProgressMap] = useState({})

  useEffect(() => {
    if (!user) return

    async function loadExamsData() {
      try {
        setLoading(true)

        // 1. Fetch published exams with subject and questions count
        const { data: examsData, error: examsErr } = await supabase
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
            is_published,
            subjects (
              id,
              name
            ),
            questions (
              id
            )
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (examsErr) throw examsErr

        // 2. Fetch all student attempts
        const { data: attemptsData, error: attemptsErr } = await supabase
          .from('exam_attempts')
          .select(`
            id,
            exam_id,
            student_id,
            started_at,
            submitted_at,
            score,
            total_marks,
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
          .order('started_at', { ascending: false })

        if (attemptsErr) throw attemptsErr

        const attempts = attemptsData || []

        // Map in-progress attempts by exam_id
        const inProgress = {}
        const completedIds = new Set()
        const completedList = []

        attempts.forEach((att) => {
          if (att.status === 'in_progress') {
            inProgress[att.exam_id] = att
          } else if (att.status === 'completed') {
            completedIds.add(att.exam_id)
            completedList.push(att)
          }
        })

        setInProgressMap(inProgress)
        setCompletedAttempts(completedList)

        // Filter available exams to those not completed yet
        const available = (examsData || []).filter(
          (ex) => !completedIds.has(ex.id)
        )
        setAvailableExams(available)
      } catch (err) {
        console.error('Error fetching exams list:', err)
      } finally {
        setLoading(false)
      }
    }

    loadExamsData()
  }, [user])

  // Helper to check window status
  const getTimingStatus = (startsAt, endsAt) => {
    const now = new Date()
    if (startsAt && new Date(startsAt) > now) {
      return {
        allowed: false,
        badge: 'Upcoming',
        message: `Available from ${new Date(startsAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short'
        })}`
      }
    }
    if (endsAt && new Date(endsAt) < now) {
      return {
        allowed: false,
        badge: 'Expired',
        message: `Deadline ended on ${new Date(endsAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short'
        })}`
      }
    }
    return {
      allowed: true,
      badge: 'Active',
      message: endsAt
        ? `Closes ${new Date(endsAt).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short'
          })}`
        : 'Open for submissions'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading exam center...</p>
      </div>
    )
  }

  return (
    <div className="py-4 px-0">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
            Exam Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse active online examinations and review your past assessment performance
          </p>
        </div>

        {/* Section 1: Available Exams */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-indigo-600" />
              Available Exams
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
              {availableExams.length} Available
            </span>
          </div>

          {availableExams.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileQuestion className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                No exams available at the moment
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                You have completed all published exams, or no active exams are currently scheduled.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableExams.map((exam) => {
                const questionCount = exam.questions?.length || 0
                const inProgressAttempt = inProgressMap[exam.id]
                const timing = getTimingStatus(exam.starts_at, exam.ends_at)

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 text-xs truncate max-w-[160px]">
                          {exam.subjects?.name || 'General'}
                        </span>
                        {inProgressAttempt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <RotateCw className="w-3 h-3" />
                            In Progress
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              timing.badge === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : timing.badge === 'Upcoming'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {timing.badge}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-slate-800 text-lg leading-snug">
                        {exam.title}
                      </h3>

                      {/* Description */}
                      {exam.description ? (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {exam.description}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No specific instructions or description.
                        </p>
                      )}

                      {/* Info Row: Duration, Total Marks, Questions */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-slate-600 text-xs">
                        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 text-center">
                          <Clock className="w-4 h-4 text-slate-400 mb-1" />
                          <span className="font-semibold text-slate-700">
                            {exam.duration_minutes}m
                          </span>
                          <span className="text-[10px] text-slate-400">Duration</span>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 text-center">
                          <Award className="w-4 h-4 text-slate-400 mb-1" />
                          <span className="font-semibold text-slate-700">
                            {exam.total_marks}
                          </span>
                          <span className="text-[10px] text-slate-400">Total Marks</span>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 text-center">
                          <HelpCircle className="w-4 h-4 text-slate-400 mb-1" />
                          <span className="font-semibold text-slate-700">
                            {questionCount}
                          </span>
                          <span className="text-[10px] text-slate-400">Questions</span>
                        </div>
                      </div>

                      {/* Schedule info if set */}
                      {(exam.starts_at || exam.ends_at) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{timing.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                      {inProgressAttempt ? (
                        <Link
                          to={`/student/exams/${exam.id}`}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 text-white px-4 py-2.5 font-medium hover:bg-amber-700 transition-colors shadow-sm"
                        >
                          <RotateCw className="w-4 h-4 animate-spin-reverse" />
                          Continue Exam
                        </Link>
                      ) : timing.allowed ? (
                        <Link
                          to={`/student/exams/${exam.id}`}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Start Exam
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 text-slate-400 px-4 py-2.5 font-medium cursor-not-allowed border border-slate-200"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {timing.badge === 'Upcoming'
                            ? 'Not Started Yet'
                            : 'Exam Expired'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Section 2: Completed Exams */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Completed Exams
            </h2>
            <Link
              to="/student/results"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
            >
              Full results history
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {completedAttempts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
              <p className="text-sm">You haven't completed any exams yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Exam Title</th>
                      <th className="py-3.5 px-6">Subject</th>
                      <th className="py-3.5 px-6">Score</th>
                      <th className="py-3.5 px-6">Percentage</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6">Completed Date</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {completedAttempts.map((attempt) => {
                      const maxScore =
                        attempt.total_marks || attempt.exams?.total_marks || 1
                      const percentage = Math.round(
                        ((attempt.score || 0) / maxScore) * 100
                      )
                      const passThreshold =
                        attempt.exams?.pass_marks ?? maxScore * 0.4
                      const isPassed = (attempt.score || 0) >= passThreshold

                      return (
                        <tr
                          key={attempt.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-slate-800">
                            {attempt.exams?.title || 'Exam'}
                          </td>
                          <td className="py-4 px-6 text-slate-600">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {attempt.exams?.subjects?.name || 'General'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-700">
                            {attempt.score} / {maxScore}
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800">
                              {percentage}%
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {isPassed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-3.5 h-3.5" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-500 text-xs">
                            {attempt.submitted_at
                              ? new Date(
                                  attempt.submitted_at
                                ).toLocaleDateString([], {
                                  dateStyle: 'medium'
                                })
                              : '-'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <Link
                              to={`/student/results/${attempt.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              View Result
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
