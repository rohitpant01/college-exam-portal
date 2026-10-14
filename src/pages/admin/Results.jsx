import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Award, 
  Search, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  BookOpen, 
  Clock, 
  FileCheck2,
  Filter
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Results() {
  const navigate = useNavigate()

  const [examResults, setExamResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSubject, setFilterSubject] = useState('ALL')
  const [subjects, setSubjects] = useState([])

  const fetchResultsData = async () => {
    try {
      setLoading(true)

      // Fetch exams with subject and all attempts
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          id,
          title,
          pass_marks,
          total_marks,
          created_at,
          subjects (
            id,
            name
          ),
          exam_attempts (
            id,
            score,
            total_marks,
            status,
            started_at,
            submitted_at
          )
        `)
        .order('created_at', { ascending: false })

      if (examsError) throw examsError

      const subjectMap = new Map()

      // Process and filter exams that have at least 1 attempt
      const computed = (examsData || []).map((exam) => {
        const attempts = Array.isArray(exam.exam_attempts) ? exam.exam_attempts : []
        const totalAttempts = attempts.length

        if (exam.subjects?.id && exam.subjects?.name) {
          subjectMap.set(exam.subjects.id, exam.subjects.name)
        }

        if (totalAttempts === 0) {
          return null
        }

        const scores = attempts.map((a) => a.score || 0)
        const highestScore = Math.max(...scores)
        const lowestScore = Math.min(...scores)
        const sumScore = scores.reduce((sum, s) => sum + s, 0)
        const averageScore = Math.round((sumScore / totalAttempts) * 10) / 10

        const passThreshold = exam.pass_marks || 0
        const passedCount = attempts.filter((a) => (a.score || 0) >= passThreshold).length
        const passRate = Math.round((passedCount / totalAttempts) * 100)

        // Percentage average
        const examTotal = exam.total_marks || 1
        const avgPercentage = Math.round((averageScore / examTotal) * 100)

        return {
          id: exam.id,
          title: exam.title,
          subjectName: exam.subjects?.name || 'General',
          subjectId: exam.subjects?.id || '',
          pass_marks: exam.pass_marks,
          total_marks: exam.total_marks,
          totalAttempts,
          averageScore,
          avgPercentage,
          highestScore,
          lowestScore,
          passRate,
          passedCount
        }
      }).filter(Boolean)

      setExamResults(computed)
      setSubjects(Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name })))
    } catch (err) {
      console.error('Error fetching exam results:', err)
      toast.error('Failed to load exam performance results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResultsData()
  }, [])

  const filtered = examResults.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subjectName.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesSubject =
      filterSubject === 'ALL' || item.subjectId === filterSubject

    return matchesSearch && matchesSubject
  })

  // Global aggregate summaries
  const totalSubmissions = examResults.reduce((sum, e) => sum + e.totalAttempts, 0)
  const averagePassRate =
    examResults.length > 0
      ? Math.round(
          examResults.reduce((sum, e) => sum + e.passRate, 0) / examResults.length
        )
      : 0

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Exam Results & Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Analyze student performance, passing percentages, and score distributions
            </p>
          </div>
        </div>

        {/* Aggregate KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Exams with Attempts</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{examResults.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Submissions</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{totalSubmissions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Average Pass Rate</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{averagePassRate}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exam title or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>

          {subjects.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Filter Subject:</span>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse space-y-4"
              >
                <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
                <div className="h-10 bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {searchQuery ? 'No matching exams found' : 'No exam submissions yet'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? 'Try searching with a different exam title or subject.'
                : 'As soon as students take and submit an exam, comprehensive performance statistics will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/admin/results/${item.id}`)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                      {item.subjectName}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Max: {item.total_marks} pts
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  {/* Pass Rate Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Pass Rate</span>
                      <span
                        className={
                          item.passRate >= 60
                            ? 'text-emerald-600'
                            : item.passRate >= 40
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }
                      >
                        {item.passRate}% ({item.passedCount}/{item.totalAttempts})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.passRate >= 60
                            ? 'bg-emerald-500'
                            : item.passRate >= 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${item.passRate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Score Metrics Grid */}
                  <div className="mt-5 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                        Average
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {item.averageScore}
                      </p>
                    </div>
                    <div className="border-x border-slate-200">
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                        Highest
                      </p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">
                        {item.highestScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                        Lowest
                      </p>
                      <p className="text-sm font-bold text-slate-600 mt-0.5">
                        {item.lowestScore}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    <span>{item.totalAttempts} {item.totalAttempts === 1 ? 'submission' : 'submissions'}</span>
                  </div>
                  <span className="font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
