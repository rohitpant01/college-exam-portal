import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  TrendingUp,
  Percent,
  Calendar,
  BookOpen
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function MyResults() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState([])

  useEffect(() => {
    if (!user) return

    async function fetchResults() {
      try {
        setLoading(true)

        const { data, error } = await supabase
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
                id,
                name
              )
            )
          `)
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('submitted_at', { ascending: false })

        if (error) throw error
        setAttempts(data || [])
      } catch (err) {
        console.error('Error fetching results:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading your exam results...</p>
      </div>
    )
  }

  // Calculate Summary Statistics
  const totalExams = attempts.length
  let averagePercentage = 0
  let bestPercentage = 0
  let passCount = 0

  if (totalExams > 0) {
    let totalScorePercentages = 0
    let highestPct = 0

    attempts.forEach((attempt) => {
      const maxScore = attempt.total_marks || attempt.exams?.total_marks || 1
      const pct = Math.round(((attempt.score || 0) / maxScore) * 100)
      totalScorePercentages += pct
      if (pct > highestPct) highestPct = pct

      const passThreshold = attempt.exams?.pass_marks ?? maxScore * 0.4
      if ((attempt.score || 0) >= passThreshold) {
        passCount += 1
      }
    })

    averagePercentage = Math.round(totalScorePercentages / totalExams)
    bestPercentage = highestPct
  }

  const passRate = totalExams > 0 ? Math.round((passCount / totalExams) * 100) : 0

  return (
    <div className="py-4 px-0">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
              My Results
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Review your overall examination scores, grading performance, and answer sheets
            </p>
          </div>
          <Link
            to="/student/exams"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            Exam Center
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {totalExams === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No exam results yet
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              You haven't completed any assessments yet. Head over to the Exam Center to take an active test.
            </p>
            <div className="mt-6">
              <Link
                to="/student/exams"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Go to Exam Center
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 4 Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Exams Taken
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">
                      {totalExams}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Average Score
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">
                      {averagePercentage}%
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Best Score
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">
                      {bestPercentage}%
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Pass Rate
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">
                      {passRate}%
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base">
                  Assessment History
                </h3>
                <p className="text-xs text-slate-400">
                  Sorted by most recently submitted
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Exam Title</th>
                      <th className="py-3.5 px-6">Subject</th>
                      <th className="py-3.5 px-6">Score</th>
                      <th className="py-3.5 px-6">Percentage</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {attempts.map((attempt) => {
                      const maxMarks =
                        attempt.total_marks || attempt.exams?.total_marks || 1
                      const percentage = Math.round(
                        ((attempt.score || 0) / maxMarks) * 100
                      )
                      const passThreshold =
                        attempt.exams?.pass_marks ?? maxMarks * 0.4
                      const isPassed = (attempt.score || 0) >= passThreshold

                      return (
                        <tr
                          key={attempt.id}
                          className={`transition-colors ${
                            isPassed
                              ? 'hover:bg-emerald-50/20'
                              : 'hover:bg-red-50/20'
                          }`}
                        >
                          <td className="py-4 px-6 font-semibold text-slate-800">
                            {attempt.exams?.title || 'Exam'}
                          </td>
                          <td className="py-4 px-6 text-slate-600">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {attempt.exams?.subjects?.name || 'General'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-700">
                            {attempt.score} / {maxMarks}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {percentage}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    isPassed ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(percentage, 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {isPassed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Pass
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-3.5 h-3.5" />
                                Fail
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                            {attempt.submitted_at
                              ? new Date(
                                  attempt.submitted_at
                                ).toLocaleDateString([], {
                                  dateStyle: 'medium'
                                })
                              : '-'}
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <Link
                              to={`/student/results/${attempt.id}`}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              View Details
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
          </>
        )}
      </div>
    </div>
  )
}
