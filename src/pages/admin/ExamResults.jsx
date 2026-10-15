import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Users, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock, 
  Download, 
  Search,
  Filter,
  BarChart3,
  ListOrdered,
  Eye,
  X,
  Loader2,
  FileText,
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ExamResults() {
  const { examId } = useParams()

  const [exam, setExam] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'chart'
  const [sortField, setSortField] = useState('score') // 'score', 'name', 'date'
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' or 'desc'

  // Detailed Modal inspection state
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [attemptQuestions, setAttemptQuestions] = useState([])
  const [attemptResponsesMap, setAttemptResponsesMap] = useState({})

  const fetchExamDetailsAndAttempts = async () => {
    try {
      setLoading(true)

      // Fetch exam details
      const { data: examData, error: examError } = await supabase
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

      if (examError) throw examError
      setExam(examData)

      // Fetch attempts with student profiles
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          profiles:student_id (
            id,
            full_name,
            email,
            enrollment_no
          )
        `)
        .eq('exam_id', examId)
        .order('score', { ascending: false })

      if (attemptsError) throw attemptsError

      const formatted = (attemptsData || []).map((att) => ({
        ...att,
        studentName: att.profiles?.full_name || 'Anonymous Student',
        studentEmail: att.profiles?.email || 'N/A',
        enrollmentNo: att.profiles?.enrollment_no || 'N/A',
        scoreVal: att.score || 0,
        totalMarksVal: att.total_marks || examData.total_marks || 1
      }))

      setAttempts(formatted)
    } catch (err) {
      console.error('Error fetching exam attempt records:', err)
      toast.error('Failed to load exam details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (examId) {
      fetchExamDetailsAndAttempts()
    }
  }, [examId])

  // Open detailed answer sheet modal
  const handleOpenAttemptDetail = async (att) => {
    setSelectedAttempt(att)
    setDetailModalOpen(true)
    setDetailLoading(true)

    try {
      // 1. Fetch questions for this exam
      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_num', { ascending: true })

      if (qErr) throw qErr
      setAttemptQuestions(qData || [])

      // 2. Fetch responses for this specific attempt
      const { data: respData, error: respErr } = await supabase
        .from('exam_responses')
        .select('*')
        .eq('attempt_id', att.id)

      if (respErr) throw respErr

      const map = {}
      ;(respData || []).forEach((r) => {
        map[r.question_id] = r
      })
      setAttemptResponsesMap(map)
    } catch (err) {
      console.error('Error loading attempt question details:', err)
      toast.error('Could not load student responses')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false)
    setSelectedAttempt(null)
    setAttemptQuestions([])
    setAttemptResponsesMap({})
  }

  // Calculation of aggregate stats
  const totalAttempts = attempts.length
  const totalScoreSum = attempts.reduce((acc, curr) => acc + curr.scoreVal, 0)
  const avgScore = totalAttempts > 0 ? (totalScoreSum / totalAttempts).toFixed(1) : 0
  const passCutoff = exam?.pass_marks || 0
  const passedCount = attempts.filter((a) => a.scoreVal >= passCutoff).length
  const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0
  const highestScore = totalAttempts > 0 ? Math.max(...attempts.map((a) => a.scoreVal)) : 0

  // Filter & Sorting
  const filteredAttempts = attempts
    .filter((a) => {
      const q = searchQuery.toLowerCase()
      return (
        a.studentName.toLowerCase().includes(q) ||
        a.enrollmentNo.toLowerCase().includes(q) ||
        a.studentEmail.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let comp = 0
      if (sortField === 'score') {
        comp = a.scoreVal - b.scoreVal
      } else if (sortField === 'name') {
        comp = a.studentName.localeCompare(b.studentName)
      } else if (sortField === 'date') {
        comp = new Date(a.submitted_at || a.started_at) - new Date(b.submitted_at || b.started_at)
      }
      return sortDirection === 'desc' ? -comp : comp
    })

  const exportCSV = () => {
    if (attempts.length === 0) {
      toast.error('No attempts available to export')
      return
    }

    const headers = ['Student Name', 'Enrollment No', 'Email', 'Score', 'Total Marks', 'Percentage', 'Status', 'Submitted At']
    const rows = attempts.map((a) => {
      const pct = Math.round((a.scoreVal / a.totalMarksVal) * 100)
      const passed = a.scoreVal >= passCutoff ? 'PASSED' : 'FAILED'
      const date = a.submitted_at ? new Date(a.submitted_at).toLocaleString() : 'In Progress'
      return [
        `"${a.studentName.replace(/"/g, '""')}"`,
        `"${a.enrollmentNo}"`,
        `"${a.studentEmail}"`,
        a.scoreVal,
        a.totalMarksVal,
        `${pct}%`,
        passed,
        `"${date}"`
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${(exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_')}_Results.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Results exported as CSV')
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'In Progress'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format time taken in minutes/seconds
  const formatTimeDifference = (startIso, endIso) => {
    if (!startIso || !endIso) return 'N/A'
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()
    const totalSec = Math.max(0, Math.floor((end - start) / 1000))
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    if (mins === 0) return `${secs} seconds`
    return `${mins}m ${secs}s`
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/admin/results"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Results Overview
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              {exam ? exam.title : 'Detailed Exam Results'}
            </h1>
            {exam && (
              <p className="text-sm text-slate-500">
                Subject: <span className="font-semibold text-slate-700">{exam.subjects?.name || 'General'}</span> • Max Marks: {exam.total_marks}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={attempts.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Attempts</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-2">{totalAttempts}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Average Score</span>
              <Award className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-2">
              {avgScore} <span className="text-xs text-slate-400 font-normal">/ {exam?.total_marks || 0}</span>
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Pass Rate</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-2">
              {passRate}%
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Highest Score</span>
              <CheckCircle2 className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {highestScore} <span className="text-xs text-slate-400 font-normal">pts</span>
            </p>
          </div>
        </div>

        {/* Toolbar: Search, Sort, View Toggle */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or enrollment no..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Sort by:</span>
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split('-')
                  setSortField(f)
                  setSortDirection(d)
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="score-desc">Score: High to Low</option>
                <option value="score-asc">Score: Low to High</option>
                <option value="name-asc">Student Name: A-Z</option>
                <option value="name-desc">Student Name: Z-A</option>
                <option value="date-desc">Submitted: Recent First</option>
              </select>
            </div>

            {/* Toggle Table vs Visual Bar Chart */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'chart' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Bar Chart
              </button>
            </div>
          </div>
        </div>

        {/* View Mode: Table or Horizontal Bars */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="h-4 w-44 bg-slate-200 rounded"></div>
                  <div className="h-3 w-28 bg-slate-100 rounded"></div>
                </div>
                <div className="h-5 w-20 bg-slate-200 rounded"></div>
                <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
              </div>
            ))}
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No attempts recorded</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? 'No students matching the current filter.'
                : 'No students have taken this examination yet. Check back once students complete their tests.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-4 py-4">Enrollment No</th>
                    <th className="px-4 py-4">Score Obtained</th>
                    <th className="px-4 py-4">Percentage</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Submitted At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAttempts.map((att, idx) => {
                    const percentage = Math.round((att.scoreVal / att.totalMarksVal) * 100)
                    const isPassed = att.scoreVal >= passCutoff

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{att.studentName}</p>
                          <p className="text-xs text-slate-400">{att.studentEmail}</p>
                        </td>
                        <td className="px-4 py-4 text-xs font-mono text-slate-600">
                          {att.enrollmentNo}
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-bold text-slate-800 text-base">
                            {att.scoreVal}
                          </span>
                          <span className="text-xs text-slate-400 font-normal"> / {att.totalMarksVal}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700 w-10">
                              {percentage}%
                            </span>
                            <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isPassed ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {formatDateTime(att.submitted_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenAttemptDetail(att)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-xs border border-indigo-200 shadow-xs cursor-pointer transition-colors"
                            title="View student's question-by-question response breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Horizontal Bar Chart View */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Student Score Distribution Comparison
            </h3>
            <div className="space-y-3">
              {filteredAttempts.map((att, index) => {
                const percentage = Math.round((att.scoreVal / att.totalMarksVal) * 100)
                const isPassed = att.scoreVal >= passCutoff

                return (
                  <div key={att.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 w-5">#{index + 1}</span>
                        <span className="font-semibold text-slate-800">{att.studentName}</span>
                        <span className="text-slate-400">({att.enrollmentNo})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700">
                          {att.scoreVal} / {att.totalMarksVal} pts
                        </span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {percentage}% ({isPassed ? 'Pass' : 'Fail'})
                        </span>
                        <button
                          onClick={() => handleOpenAttemptDetail(att)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold cursor-pointer border border-indigo-200"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isPassed ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Detailed Answer Sheet Modal */}
        {detailModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col relative animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                      Student Assessment Detail
                    </h3>
                    <p className="text-xs text-slate-500">
                      Candidate: <span className="font-semibold text-slate-700">{selectedAttempt?.studentName}</span> • Enrollment: <span className="font-mono text-slate-600">{selectedAttempt?.enrollmentNo}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCloseDetailModal}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {detailLoading ? (
                  <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="text-sm font-medium text-slate-600">Retrieving student answers and scoring sheet...</p>
                  </div>
                ) : (
                  <>
                    {/* Score Summary Box */}
                    {selectedAttempt && (
                      <div className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 rounded-xl p-5 border border-indigo-100 shadow-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-xs text-slate-500 block mb-1">Score Obtained</span>
                            <span className="text-2xl font-bold text-slate-800">
                              {selectedAttempt.scoreVal}
                              <span className="text-xs text-slate-400 font-normal"> / {selectedAttempt.totalMarksVal}</span>
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-xs text-slate-500 block mb-1">Percentage</span>
                            <span className="text-2xl font-bold text-indigo-600">
                              {Math.round((selectedAttempt.scoreVal / selectedAttempt.totalMarksVal) * 100)}%
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-xs text-slate-500 block mb-1">Result Status</span>
                            <span className="inline-flex items-center gap-1 text-sm font-bold mt-1 text-slate-800">
                              {selectedAttempt.scoreVal >= passCutoff ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4" /> Passed
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center gap-1">
                                  <XCircle className="w-4 h-4" /> Failed
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-xs text-slate-500 block mb-1">Time Taken</span>
                            <span className="text-sm font-bold text-slate-700 block mt-1.5">
                              {formatTimeDifference(selectedAttempt.started_at, selectedAttempt.submitted_at)}
                            </span>
                          </div>
                        </div>

                        {/* Breakdown Pills */}
                        {(() => {
                          let cCount = 0
                          let wCount = 0
                          let uCount = 0
                          attemptQuestions.forEach((q) => {
                            const resp = attemptResponsesMap[q.id]
                            const selected = resp?.selected_option?.toLowerCase()
                            const correct = q.correct_option?.toLowerCase()
                            if (!selected) uCount++
                            else if (selected === correct) cCount++
                            else wCount++
                          })

                          return (
                            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-indigo-100 text-xs font-semibold">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {cCount} Correct Questions
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800">
                                <XCircle className="w-3.5 h-3.5" />
                                {wCount} Wrong Questions
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700">
                                <HelpCircle className="w-3.5 h-3.5" />
                                {uCount} Not Answered / Skipped
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Question-by-Question Review */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Full Question Breakdown & Student Responses ({attemptQuestions.length})
                      </h4>

                      {attemptQuestions.map((q, idx) => {
                        const resp = attemptResponsesMap[q.id]
                        const studentAnswer = (resp?.selected_option || '').toLowerCase()
                        const correctAnswer = (q.correct_option || '').toLowerCase()
                        const isAnswered = Boolean(studentAnswer)
                        const isCorrect = isAnswered && studentAnswer === correctAnswer

                        const options = [
                          { key: 'a', text: q.option_a },
                          { key: 'b', text: q.option_b },
                          { key: 'c', text: q.option_c },
                          { key: 'd', text: q.option_d }
                        ]

                        return (
                          <div
                            key={q.id}
                            className={`rounded-xl border p-5 transition-colors ${
                              !isAnswered
                                ? 'border-slate-200 bg-slate-50/50'
                                : isCorrect
                                ? 'border-emerald-200 bg-emerald-50/20'
                                : 'border-red-200 bg-red-50/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-start gap-3">
                                <span
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    !isAnswered
                                      ? 'bg-slate-200 text-slate-700'
                                      : isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <p className="text-sm sm:text-base font-semibold text-slate-800 whitespace-pre-line leading-relaxed">
                                  {q.question_text}
                                </p>
                              </div>

                              <div className="flex-shrink-0">
                                {!isAnswered ? (
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    Skipped (0/{q.marks || 1} pts)
                                  </span>
                                ) : isCorrect ? (
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    +{q.marks || 1} Marks
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5" />
                                    0/{q.marks || 1} Marks (Wrong)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 4 Options Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                              {options.map((opt) => {
                                const isSelected = studentAnswer === opt.key
                                const isRightAnswer = correctAnswer === opt.key

                                let styleClass = 'bg-white border-slate-200 text-slate-700'
                                let badge = null

                                if (isSelected && isRightAnswer) {
                                  styleClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold ring-1 ring-emerald-400'
                                  badge = (
                                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Student's Correct Choice
                                    </span>
                                  )
                                } else if (isSelected && !isRightAnswer) {
                                  styleClass = 'bg-red-50 border-red-300 text-red-900 font-semibold ring-1 ring-red-300'
                                  badge = (
                                    <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                      <XCircle className="w-3.5 h-3.5" /> Student's Wrong Choice
                                    </span>
                                  )
                                } else if (!isSelected && isRightAnswer) {
                                  styleClass = 'bg-emerald-50/60 border-emerald-300 text-emerald-900 border-dashed font-medium'
                                  badge = (
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                                    </span>
                                  )
                                }

                                return (
                                  <div
                                    key={opt.key}
                                    className={`p-3 rounded-lg border text-xs sm:text-sm flex flex-col justify-between gap-1 transition-all ${styleClass}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold uppercase ${
                                          isSelected
                                            ? isRightAnswer
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-red-600 text-white'
                                            : isRightAnswer
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {opt.key}
                                      </span>
                                      <span className="flex-1">{opt.text}</span>
                                    </div>
                                    {badge && <div className="self-end mt-1">{badge}</div>}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Explanation preview if exists */}
                            {q.explanation && (
                              <div className="mt-3.5 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950">
                                <span className="font-bold text-amber-900 block mb-1">💡 Explanation / Solution:</span>
                                <p className="whitespace-pre-line leading-relaxed">{q.explanation}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Completed on {selectedAttempt?.submitted_at ? formatDateTime(selectedAttempt.submitted_at) : 'In Progress'}
                </p>
                <button
                  onClick={handleCloseDetailModal}
                  className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Close Answer Sheet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

