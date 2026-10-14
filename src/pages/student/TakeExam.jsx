import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Clock,
  Award,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  HelpCircle,
  Menu,
  X,
  RotateCcw,
  BookOpen,
  ArrowLeft,
  ShieldAlert
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function TakeExam() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // High-level state
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [examStarted, setExamStarted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Exam runtime state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({}) // { [question_id]: 'a' | 'b' | 'c' | 'd' }
  const [markedForReview, setMarkedForReview] = useState(new Set()) // Set of question IDs
  const [visitedQuestions, setVisitedQuestions] = useState(new Set([0])) // Set of question indices
  const [timeRemaining, setTimeRemaining] = useState(0) // Seconds
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)

  // Anti-Cheat & Tab Switch Tracking
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [showViolationModal, setShowViolationModal] = useState(false)
  const tabSwitchCountRef = useRef(0)

  // Use refs to avoid stale closures in interval / listeners
  const timerRef = useRef(null)
  const isSubmittingRef = useRef(false)
  const responsesRef = useRef(responses)
  const questionsRef = useRef(questions)
  const attemptRef = useRef(attempt)
  const examRef = useRef(exam)

  useEffect(() => {
    tabSwitchCountRef.current = tabSwitchCount
  }, [tabSwitchCount])

  useEffect(() => {
    responsesRef.current = responses
  }, [responses])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    attemptRef.current = attempt
  }, [attempt])

  useEffect(() => {
    examRef.current = exam
  }, [exam])

  // 1. Initial Load: Check attempts & fetch exam details
  useEffect(() => {
    if (!user || !examId) return

    async function initializeExam() {
      try {
        setLoading(true)

        // Fetch Exam
        const { data: examData, error: examErr } = await supabase
          .from('exams')
          .select(`
            *,
            subjects (
              id,
              name
            )
          `)
          .eq('id', examId)
          .single()

        if (examErr || !examData) {
          toast.error('Exam not found or unavailable.')
          navigate('/student/exams')
          return
        }

        setExam(examData)

        // Check for completed attempt first
        const { data: completedAttempts, error: completedErr } = await supabase
          .from('exam_attempts')
          .select('id, status')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .eq('status', 'completed')
          .order('submitted_at', { ascending: false })

        if (completedErr) throw completedErr

        if (completedAttempts && completedAttempts.length > 0) {
          toast('You have already completed this exam.', { icon: 'ℹ️' })
          navigate(`/student/results/${completedAttempts[0].id}`, { replace: true })
          return
        }

        // Check for in_progress attempt
        const { data: activeAttempts, error: activeErr } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .eq('status', 'in_progress')
          .order('started_at', { ascending: false })

        if (activeErr) throw activeErr

        const currentActive = activeAttempts && activeAttempts.length > 0 ? activeAttempts[0] : null

        // Fetch all questions for this exam
        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', examId)
          .order('order_num', { ascending: true })

        if (qErr) {
          console.error('Questions fetch error:', qErr)
          toast.error(`Error loading questions: ${qErr.message}`)
          throw qErr
        }

        console.log(`Loaded ${questionsData?.length || 0} questions for exam ${examId}`)
        setQuestions(questionsData || [])

        if (currentActive) {
          // Resume existing in_progress attempt
          setAttempt(currentActive)

          // Fetch existing answers saved
          const { data: respData, error: respErr } = await supabase
            .from('exam_responses')
            .select('*')
            .eq('attempt_id', currentActive.id)

          if (respErr) throw respErr

          const respMap = {}
          const visitedIndices = new Set([0])

          if (respData && respData.length > 0) {
            respData.forEach((r) => {
              if (r.selected_option) {
                respMap[r.question_id] = r.selected_option
                // Mark index as visited
                const idx = (questionsData || []).findIndex((q) => q.id === r.question_id)
                if (idx >= 0) visitedIndices.add(idx)
              }
            })
          }

          setResponses(respMap)
          setVisitedQuestions(visitedIndices)

          // Calculate remaining time
          const startedAtMs = new Date(currentActive.started_at).getTime()
          const totalDurationSec = (examData.duration_minutes || 60) * 60
          const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000)
          const remainingSec = Math.max(0, totalDurationSec - elapsedSec)

          setTimeRemaining(remainingSec)
          setExamStarted(true)

          if (remainingSec <= 0) {
            // Already expired while away
            toast.error('Your exam time expired. Submitting your answers.')
            handleFinalSubmit(true, currentActive, questionsData, respMap, examData)
            return
          }
        }
      } catch (err) {
        console.error('Initialization error:', err)
        toast.error('Failed to load examination details.')
      } finally {
        setLoading(false)
      }
    }

    initializeExam()
  }, [examId, user, navigate])

  // 2. Start Exam button handler (from instructions screen)
  const handleStartExam = async () => {
    if (!exam || !user) return

    try {
      setLoading(true)

      // Insert new in_progress attempt
      const { data: newAttempt, error: attemptErr } = await supabase
        .from('exam_attempts')
        .insert({
          exam_id: exam.id,
          student_id: user.id,
          started_at: new Date().toISOString(),
          status: 'in_progress',
          score: 0,
          total_marks: exam.total_marks
        })
        .select()
        .single()

      if (attemptErr) throw attemptErr

      setAttempt(newAttempt)

      // Create initial empty responses for all questions
      if (questions.length > 0) {
        const initialRecords = questions.map((q) => ({
          attempt_id: newAttempt.id,
          question_id: q.id,
          selected_option: null,
          is_correct: false
        }))

        const { error: insertRespErr } = await supabase
          .from('exam_responses')
          .insert(initialRecords)

        if (insertRespErr) {
          console.warn('Initial response placeholders creation note:', insertRespErr)
        }
      }

      setTimeRemaining((exam.duration_minutes || 60) * 60)
      setExamStarted(true)
      setCurrentIndex(0)
      setVisitedQuestions(new Set([0]))
      toast.success('Exam started! Good luck.')
    } catch (err) {
      console.error('Failed to start exam:', err)
      toast.error('Could not start exam. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Final submission logic (used for both manual and auto-submit)
  const handleFinalSubmit = useCallback(
    async (
      isAuto = false,
      activeAttempt = attemptRef.current,
      activeQuestions = questionsRef.current,
      activeResponses = responsesRef.current,
      activeExam = examRef.current
    ) => {
      if (isSubmittingRef.current) return
      isSubmittingRef.current = true
      setIsSubmitting(true)

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      try {
        if (!activeAttempt || !activeAttempt.id) {
          throw new Error('No active attempt found.')
        }

        // Calculate score
        let totalCalculatedScore = 0

        const updatePromises = activeQuestions.map(async (q) => {
          const selected = activeResponses[q.id] || null
          const isCorrect = Boolean(
            selected && selected.toLowerCase() === q.correct_option?.toLowerCase()
          )
          const marks = isCorrect ? q.marks || 1 : 0
          if (isCorrect) {
            totalCalculatedScore += marks
          }

          // Upsert or update response record
          return supabase
            .from('exam_responses')
            .upsert(
              {
                attempt_id: activeAttempt.id,
                question_id: q.id,
                selected_option: selected,
                is_correct: isCorrect
              },
              { onConflict: 'attempt_id,question_id' }
            )
        })

        await Promise.all(updatePromises)

        // Update exam attempt to completed
        const { error: finalAttemptErr } = await supabase
          .from('exam_attempts')
          .update({
            submitted_at: new Date().toISOString(),
            score: totalCalculatedScore,
            total_marks: activeExam?.total_marks || activeAttempt.total_marks,
            status: 'completed'
          })
          .eq('id', activeAttempt.id)

        if (finalAttemptErr) throw finalAttemptErr

        if (isAuto) {
          toast.error('Time is up! Your exam has been auto-submitted.', {
            duration: 6000
          })
        } else {
          toast.success('Exam submitted successfully!')
        }

        navigate(`/student/results/${activeAttempt.id}`, { replace: true })
      } catch (err) {
        console.error('Submission failed:', err)
        toast.error('Error submitting exam. Please check your connection.')
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    },
    [navigate]
  )

  // 4. Countdown Timer Effect
  useEffect(() => {
    if (!examStarted || isSubmitting) return

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          handleFinalSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [examStarted, isSubmitting, handleFinalSubmit])

  // 5. Anti-Cheat: Tab-Switch & Blur Detection (Auto-submit after 2 attempts)
  useEffect(() => {
    if (!examStarted || isSubmitting) return

    let lastSwitchTime = 0

    const triggerSwitchViolation = () => {
      if (isSubmittingRef.current) return

      const now = Date.now()
      // Debounce events if visibilitychange and blur fire together within 1.5 seconds
      if (now - lastSwitchTime < 1500) return
      lastSwitchTime = now

      const nextCount = tabSwitchCountRef.current + 1
      tabSwitchCountRef.current = nextCount
      setTabSwitchCount(nextCount)

      if (nextCount === 1) {
        // Attempt 1: Show warning alert modal
        setShowViolationModal(true)
        toast.error('Warning 1/2: Tab switching is strictly prohibited! Another attempt will auto-submit your exam.', {
          duration: 7000,
          icon: '⚠️'
        })
      } else if (nextCount >= 2) {
        // Attempt 2: Auto-submit exam immediately
        setShowViolationModal(false)
        toast.error('Violation limit reached! You switched tabs twice. Your exam is being automatically submitted.', {
          duration: 8000,
          icon: '🛑'
        })
        handleFinalSubmit(true)
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSwitchViolation()
      }
    }

    const handleWindowBlur = () => {
      // Fires if student focuses outside browser (switching application or window)
      triggerSwitchViolation()
    }

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Your exam is currently in progress. Leaving will submit or forfeit your attempt.'
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [examStarted, isSubmitting, handleFinalSubmit])

  // Format seconds to MM:SS or HH:MM:SS
  const formatTimer = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (n) => String(n).padStart(2, '0')

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }
    return `${pad(minutes)}:${pad(seconds)}`
  }

  // Answer selection handler
  const handleSelectOption = async (optionKey) => {
    if (!currentQuestion || !attempt) return

    const questionId = currentQuestion.id

    // Update state immediately for zero-lag UI feedback
    setResponses((prev) => ({
      ...prev,
      [questionId]: optionKey
    }))

    // Mark as visited
    setVisitedQuestions((prev) => new Set([...prev, currentIndex]))

    // Persist to Supabase
    try {
      await supabase
        .from('exam_responses')
        .upsert(
          {
            attempt_id: attempt.id,
            question_id: questionId,
            selected_option: optionKey,
            is_correct: false
          },
          { onConflict: 'attempt_id,question_id' }
        )
    } catch (err) {
      console.error('Failed to sync response to database:', err)
    }
  }

  // Clear current question response
  const handleClearResponse = async () => {
    if (!currentQuestion || !attempt) return

    const questionId = currentQuestion.id

    setResponses((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })

    try {
      await supabase
        .from('exam_responses')
        .update({ selected_option: null })
        .eq('attempt_id', attempt.id)
        .eq('question_id', questionId)
    } catch (err) {
      console.error('Failed to clear response in database:', err)
    }
  }

  // Toggle mark for review
  const toggleMarkForReview = () => {
    if (!currentQuestion) return
    const qId = currentQuestion.id
    setMarkedForReview((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) {
        next.delete(qId)
      } else {
        next.add(qId)
      }
      return next
    })
  }

  // Navigation helpers
  const goToQuestion = (index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index)
      setVisitedQuestions((prev) => new Set([...prev, index]))
      setMobilePaletteOpen(false)
    }
  }

  const currentQuestion = questions[currentIndex]

  // Palette color categorization helper
  const getQuestionPaletteStyle = (index, qId) => {
    const isCurrent = index === currentIndex
    const isAnswered = Boolean(responses[qId])
    const isMarked = markedForReview.has(qId)
    const isVisited = visitedQuestions.has(index)

    let baseStyle = 'border text-xs font-semibold rounded-lg flex items-center justify-center h-10 w-full transition-all '

    if (isMarked) {
      baseStyle += 'bg-amber-100 text-amber-800 border-amber-300 '
    } else if (isAnswered) {
      baseStyle += 'bg-emerald-100 text-emerald-800 border-emerald-300 '
    } else if (isVisited) {
      baseStyle += 'bg-red-100 text-red-700 border-red-300 '
    } else {
      baseStyle += 'bg-slate-200 text-slate-600 border-slate-300 '
    }

    if (isCurrent) {
      baseStyle += 'ring-2 ring-indigo-600 ring-offset-2 scale-105 z-10 '
    }

    return baseStyle
  }

  // Calculate statistics for question palette and submit modal
  const answeredCount = questions.filter((q) => Boolean(responses[q.id])).length
  const unansweredCount = questions.length - answeredCount
  const markedCount = markedForReview.size

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Preparing examination session...</p>
      </div>
    )
  }

  // SCREEN 1: Pre-exam Instructions Screen
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Link
            to="/student/exams"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Exam Center
          </Link>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header Banner */}
            <div className="bg-indigo-600 text-white p-6 sm:p-8">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white mb-3">
                {exam?.subjects?.name || 'Subject Assessment'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold">{exam?.title}</h1>
              {exam?.description && (
                <p className="mt-2 text-indigo-100 text-sm max-w-2xl leading-relaxed">
                  {exam.description}
                </p>
              )}
            </div>

            {/* Quick Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200 text-center">
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Questions</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">
                  {questions.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Duration</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">
                  {exam?.duration_minutes} Mins
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Maximum Marks</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">
                  {exam?.total_marks || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Questions</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">
                  {questions.length || 'Ready'}
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-600" />
                  Examination Guidelines & Instructions
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-600 list-disc list-inside leading-relaxed">
                  <li>
                    This exam contains{' '}
                    <strong className="text-slate-800">
                      {questions.length} multiple-choice questions
                    </strong>
                    .
                  </li>
                  <li>
                    Total allowed duration is{' '}
                    <strong className="text-slate-800">
                      {exam?.duration_minutes} minutes
                    </strong>
                    .
                  </li>
                  <li>Each question carries marks as indicated on screen.</li>
                  <li>
                    You can freely navigate back and forth between questions using the question palette or navigation buttons.
                  </li>
                  <li>
                    You can mark questions for review if you wish to revisit them before final submission.
                  </li>
                  <li>
                    The exam will{' '}
                    <strong className="text-red-600">
                      automatically submit
                    </strong>{' '}
                    when the timer reaches 00:00.
                  </li>
                  <li>
                    <strong className="text-slate-800">
                      Once submitted, you cannot retake or modify your answers.
                    </strong>
                  </li>
                  <li>
                    Ensure a stable internet connection. Your selected responses are automatically saved in real time.
                  </li>
                  <li className="text-amber-700 bg-amber-50/70 p-2 rounded border border-amber-200">
                    <strong className="text-amber-900 font-bold">Strict Proctored Rule:</strong> Tab switching, opening other apps, or minimizing the exam window is strictly monitored. You will receive <strong>1 warning</strong>, and on the <strong>2nd attempt</strong>, the exam will be <strong>automatically submitted</strong>.
                  </li>
                </ul>
              </div>

              {questions.length === 0 ? (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>
                    No questions have been configured for this exam yet. Please contact the administrator.
                  </span>
                </div>
              ) : (
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    By clicking Start Exam, you confirm you have read and understood the rules.
                  </p>
                  <button
                    onClick={handleStartExam}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    Start Exam Now
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SCREEN 2: ACTIVE EXAM INTERFACE (SPLIT LAYOUT)
  const isTimeCritical = timeRemaining < 300 // Under 5 minutes

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Bar: Exam Title + Timer + Mobile Palette Toggle */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Open Question Palette"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
                {exam?.subjects?.name || 'Assessment'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                {exam?.title}
              </h2>
            </div>
          </div>

          {/* Center/Right: Timer & Action */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Timer badge */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${
                isTimeCritical
                  ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <Clock
                className={`w-4 h-4 ${
                  isTimeCritical ? 'text-red-600' : 'text-indigo-600'
                }`}
              />
              <span>{formatTimer(timeRemaining)}</span>
            </div>

            {/* Quick Submit */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body: Question Area (Left) + Question Palette (Right) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-6">
        {/* LEFT SIDE: Question Area */}
        <main className="flex-1 flex flex-col justify-between bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
          {currentQuestion ? (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {currentQuestion.marks || 1}{' '}
                    {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {markedForReview.has(currentQuestion.id) && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" />
                      Marked for review
                    </span>
                  )}
                  {responses[currentQuestion.id] && (
                    <button
                      type="button"
                      onClick={handleClearResponse}
                      className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Response
                    </button>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="py-2">
                <h3 className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.question_text}
                </h3>
              </div>

              {/* Options list: A, B, C, D */}
              <div className="space-y-3 pt-2">
                {[
                  { key: 'a', text: currentQuestion.option_a },
                  { key: 'b', text: currentQuestion.option_b },
                  { key: 'c', text: currentQuestion.option_c },
                  { key: 'd', text: currentQuestion.option_d }
                ]
                  .filter((opt) => opt.text !== undefined && opt.text !== null)
                  .map((opt) => {
                    const isSelected = responses[currentQuestion.id] === opt.key

                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleSelectOption(opt.key)}
                        className={`w-full p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600 text-indigo-950 font-medium'
                            : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {opt.key}
                        </div>
                        <span className="text-sm sm:text-base leading-snug">
                          {opt.text}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              No questions found.
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                type="button"
                onClick={() => goToQuestion(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  markedForReview.has(currentQuestion?.id)
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                {markedForReview.has(currentQuestion?.id)
                  ? 'Marked'
                  : 'Mark for Review'}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Submit Exam
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT SIDE: Question Palette (Desktop Sidebar) */}
        <aside className="hidden lg:block w-72 shrink-0">
          <PaletteContent
            questions={questions}
            currentIndex={currentIndex}
            responses={responses}
            markedForReview={markedForReview}
            visitedQuestions={visitedQuestions}
            onSelectQuestion={goToQuestion}
            answeredCount={answeredCount}
            unansweredCount={unansweredCount}
            markedCount={markedCount}
            getStyle={getQuestionPaletteStyle}
          />
        </aside>
      </div>

      {/* Mobile Offcanvas Drawer for Question Palette */}
      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobilePaletteOpen(false)}
          />
          <div className="relative ml-auto w-80 max-w-full bg-white h-full shadow-2xl p-6 flex flex-col z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Question Palette</h3>
              <button
                onClick={() => setMobilePaletteOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PaletteContent
              questions={questions}
              currentIndex={currentIndex}
              responses={responses}
              markedForReview={markedForReview}
              visitedQuestions={visitedQuestions}
              onSelectQuestion={goToQuestion}
              answeredCount={answeredCount}
              unansweredCount={unansweredCount}
              markedCount={markedCount}
              getStyle={getQuestionPaletteStyle}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal before Submit */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Submit Examination?
              </h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to finish and submit your exam? Once submitted,
              you cannot change any answers or retake this exam.
            </p>

            {/* Quick summary tally */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs">
              <div>
                <p className="text-slate-400">Total</p>
                <p className="text-base font-bold text-slate-800">
                  {questions.length}
                </p>
              </div>
              <div>
                <p className="text-emerald-600 font-medium">Answered</p>
                <p className="text-base font-bold text-emerald-700">
                  {answeredCount}
                </p>
              </div>
              <div>
                <p className="text-red-600 font-medium">Unanswered</p>
                <p className="text-base font-bold text-red-700">
                  {unansweredCount}
                </p>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                You have {unansweredCount} unanswered questions remaining.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Review Questions
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false)
                  handleFinalSubmit(false)
                }}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Yes, Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable Palette Component for both Desktop Sidebar and Mobile Drawer
function PaletteContent({
  questions,
  currentIndex,
  responses,
  markedForReview,
  visitedQuestions,
  onSelectQuestion,
  answeredCount,
  unansweredCount,
  markedCount,
  getStyle
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
      <div>
        <h4 className="text-sm font-bold text-slate-800 mb-1">
          Questions Palette
        </h4>
        <p className="text-xs text-slate-400">Click any number to jump</p>
      </div>

      {/* Grid of question buttons */}
      <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelectQuestion(idx)}
            className={getStyle(idx, q.id)}
            title={`Question ${idx + 1}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center text-xs">
        <div className="p-2 rounded bg-emerald-50 text-emerald-800">
          <div className="font-bold text-base">{answeredCount}</div>
          <div className="text-[10px]">Answered</div>
        </div>
        <div className="p-2 rounded bg-red-50 text-red-700">
          <div className="font-bold text-base">{unansweredCount}</div>
          <div className="text-[10px]">Unanswered</div>
        </div>
        <div className="p-2 rounded bg-amber-50 text-amber-800">
          <div className="font-bold text-base">{markedCount}</div>
          <div className="text-[10px]">Marked</div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="space-y-2 text-xs text-slate-600">
        <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
          Legend
        </p>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 shrink-0" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300 shrink-0" />
          <span>Not Answered (Visited)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 shrink-0" />
          <span>Marked for Review</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 shrink-0" />
          <span>Not Visited</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-white border-2 border-indigo-600 ring-1 ring-indigo-600 shrink-0" />
          <span>Current Question</span>
        </div>
      </div>
    </div>
  )
}
