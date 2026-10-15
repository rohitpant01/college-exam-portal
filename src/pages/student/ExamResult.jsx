import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  HelpCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Share2,
  RotateCcw
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ExamResult() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(null)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [responsesMap, setResponsesMap] = useState({}) // { [question_id]: responseRecord }

  useEffect(() => {
    if (!attemptId || !user) return

    async function fetchResultDetails() {
      try {
        setLoading(true)

        // 1. Fetch Attempt
        const { data: attemptData, error: attemptErr } = await supabase
          .from('exam_attempts')
          .select(`
            *,
            exams (
              id,
              title,
              description,
              duration_minutes,
              total_marks,
              pass_marks,
              subjects (
                id,
                name
              )
            )
          `)
          .eq('id', attemptId)
          .single()

        if (attemptErr || !attemptData) {
          throw new Error('Attempt not found')
        }

        setAttempt(attemptData)
        setExam(attemptData.exams)

        // 2. Fetch all questions for this exam
        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', attemptData.exam_id)
          .order('order_num', { ascending: true })

        if (qErr) throw qErr
        setQuestions(questionsData || [])

        // 3. Fetch all student responses for this attempt
        const { data: respData, error: respErr } = await supabase
          .from('exam_responses')
          .select('*')
          .eq('attempt_id', attemptId)

        if (respErr) throw respErr

        const map = {}
        ;(respData || []).forEach((r) => {
          map[r.question_id] = r
        })
        setResponsesMap(map)
      } catch (err) {
        console.error('Error fetching result details:', err)
        navigate('/student/results', { replace: true })
      } finally {
        setLoading(false)
      }
    }

    fetchResultDetails()
  }, [attemptId, user, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading your exam assessment...</p>
      </div>
    )
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Result not found</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
          The requested exam attempt could not be retrieved.
        </p>
        <Link
          to="/student/results"
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Back to Results
        </Link>
      </div>
    )
  }

  // Calculate metrics
  const maxMarks = attempt.total_marks || exam.total_marks || 1
  const studentScore = attempt.score || 0
  const percentage = Math.round((studentScore / maxMarks) * 100)
  const passMarks = exam.pass_marks ?? Math.round(maxMarks * 0.4)
  const isPassed = studentScore >= passMarks

  // Tally counts
  let correctCount = 0
  let wrongCount = 0
  let unansweredCount = 0

  questions.forEach((q) => {
    const resp = responsesMap[q.id]
    const selected = resp?.selected_option?.toLowerCase()
    const correct = q.correct_option?.toLowerCase()

    if (!selected) {
      unansweredCount += 1
    } else if (selected === correct) {
      correctCount += 1
    } else {
      wrongCount += 1
    }
  })

  // Format time taken
  const formatTimeDifference = (startIso, endIso) => {
    if (!startIso || !endIso) return 'N/A'
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()
    const totalSec = Math.max(0, Math.floor((end - start) / 1000))
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    if (mins === 0) return `${secs} seconds`
    return `${mins} min ${secs} sec`
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              to="/student/results"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Results
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {exam.subjects?.name || 'General Subject'}
              </span>
              <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
            </div>
          </div>
          <div className="text-xs text-slate-400 sm:text-right">
            Submitted on:{' '}
            <strong className="text-slate-700">
              {attempt.submitted_at
                ? new Date(attempt.submitted_at).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : 'Just now'}
            </strong>
          </div>
        </div>

        {/* Big Centered Score Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-3">
            {/* Pass / Fail Badge */}
            <div>
              {isPassed ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  PASSED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold bg-red-50 text-red-700 border border-red-200 shadow-xs">
                  <XCircle className="w-4 h-4" />
                  FAILED
                </span>
              )}
            </div>

            {/* Big Score Display */}
            <div className="pt-2">
              <div className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight">
                {studentScore}{' '}
                <span className="text-2xl sm:text-3xl font-medium text-slate-400">
                  / {maxMarks}
                </span>
              </div>
              <p className="text-base font-semibold text-slate-600 mt-2">
                Overall Score: {percentage}%
              </p>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mt-4">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isPassed ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>0%</span>
              <span>Pass mark: {passMarks} pts</span>
              <span>100%</span>
            </div>
          </div>

          {/* Time & Attempt Specs */}
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                Time Taken:{' '}
                <strong className="text-slate-800">
                  {formatTimeDifference(attempt.started_at, attempt.submitted_at)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-slate-400" />
              <span>
                Passing Score:{' '}
                <strong className="text-slate-800">
                  {passMarks} / {maxMarks}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* 3-Column Stats Row: Correct, Wrong, Unanswered */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Correct Answers
              </p>
              <h4 className="text-2xl font-bold text-emerald-700 mt-1">
                {correctCount}{' '}
                <span className="text-xs font-normal text-emerald-600">
                  / {questions.length}
                </span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-200 bg-red-50/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                Wrong Answers
              </p>
              <h4 className="text-2xl font-bold text-red-700 mt-1">
                {wrongCount}{' '}
                <span className="text-xs font-normal text-red-600">
                  / {questions.length}
                </span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unanswered
              </p>
              <h4 className="text-2xl font-bold text-slate-700 mt-1">
                {unansweredCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {questions.length}
                </span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Detailed Question-by-Question Review */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Detailed Answer Review
              </h2>
              <p className="text-xs text-slate-500">
                Check each question and compare your selection against the correct response
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {questions.length} Questions
            </span>
          </div>

          <div className="space-y-6">
            {questions.map((q, index) => {
              const resp = responsesMap[q.id]
              const studentOpt = resp?.selected_option?.toLowerCase()
              const correctOpt = q.correct_option?.toLowerCase()
              const isCorrect = studentOpt && studentOpt === correctOpt
              const isUnanswered = !studentOpt

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4"
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">
                        Q{index + 1}.
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {q.marks || 1} {q.marks === 1 ? 'Mark' : 'Marks'}
                      </span>
                    </div>

                    <div>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          +{q.marks || 1} Marks
                        </span>
                      ) : isUnanswered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Not Answered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3.5 h-3.5" />
                          0 Marks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question text */}
                  <p className="text-slate-900 font-medium text-base leading-relaxed whitespace-pre-wrap">
                    {q.question_text}
                  </p>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2.5 pt-2">
                    {[
                      { key: 'a', text: q.option_a },
                      { key: 'b', text: q.option_b },
                      { key: 'c', text: q.option_c },
                      { key: 'd', text: q.option_d }
                    ]
                      .filter((opt) => opt.text !== undefined && opt.text !== null)
                      .map((opt) => {
                        const optKey = opt.key.toLowerCase()
                        const wasSelected = studentOpt === optKey
                        const wasCorrect = correctOpt === optKey

                        let cardStyle =
                          'border-slate-200 bg-white text-slate-700'
                        let badge = null

                        if (wasSelected && wasCorrect) {
                          cardStyle =
                            'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 font-medium'
                          badge = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 ml-auto">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Your Answer (Correct)
                            </span>
                          )
                        } else if (wasSelected && !wasCorrect) {
                          cardStyle =
                            'border-red-500 bg-red-50 text-red-950 ring-1 ring-red-500 font-medium'
                          badge = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 ml-auto">
                              <XCircle className="w-4 h-4 text-red-600" />
                              Your Answer (Incorrect)
                            </span>
                          )
                        } else if (!wasSelected && wasCorrect) {
                          cardStyle =
                            'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-medium'
                          badge = (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 ml-auto">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Correct Answer
                            </span>
                          )
                        }

                        return (
                          <div
                            key={opt.key}
                            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${cardStyle}`}
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                                wasSelected && wasCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : wasSelected && !wasCorrect
                                  ? 'bg-red-600 text-white'
                                  : wasCorrect
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.key}
                            </div>
                            <span className="text-sm leading-snug flex-1">
                              {opt.text}
                            </span>
                            {badge}
                          </div>
                        )
                      })}
                  </div>

                  {/* Explanation / Solution Details (if admin uploaded it) */}
                  {q.explanation && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 shadow-2xs">
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        <span>Explanation & Solution</span>
                      </div>
                      <p className="text-sm text-amber-950 whitespace-pre-wrap leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
          <Link
            to="/student/results"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Results
          </Link>
          <Link
            to="/student/exams"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Take Another Exam
          </Link>
        </div>
      </div>
    </div>
  )
}
