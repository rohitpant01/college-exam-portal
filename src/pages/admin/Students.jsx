import { useState, useEffect } from 'react'
import { 
  Users, 
  Search, 
  GraduationCap, 
  Calendar, 
  Mail, 
  Hash, 
  CheckCircle, 
  ClipboardCheck, 
  ArrowUpDown,
  Filter
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date') // 'name' or 'date' or 'exams'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' or 'desc'

  const fetchStudents = async () => {
    try {
      setLoading(true)

      // Fetch all profiles where role = 'student' with exam_attempts count
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          enrollment_no,
          created_at,
          exam_attempts (
            id
          )
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((s) => ({
        ...s,
        examsTaken: Array.isArray(s.exam_attempts) ? s.exam_attempts.length : 0
      }))

      setStudents(formatted)
    } catch (err) {
      console.error('Error fetching students:', err)
      toast.error('Failed to load students directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // Filter & Sort
  const filteredStudents = students
    .filter((s) => {
      const q = searchQuery.toLowerCase()
      const name = (s.full_name || '').toLowerCase()
      const email = (s.email || '').toLowerCase()
      const enroll = (s.enrollment_no || '').toLowerCase()
      return name.includes(q) || email.includes(q) || enroll.includes(q)
    })
    .sort((a, b) => {
      let comp = 0
      if (sortBy === 'name') {
        comp = (a.full_name || '').localeCompare(b.full_name || '')
      } else if (sortBy === 'exams') {
        comp = a.examsTaken - b.examsTaken
      } else {
        // 'date'
        comp = new Date(a.created_at) - new Date(b.created_at)
      }
      return sortOrder === 'desc' ? -comp : comp
    })

  const totalExamsAttempted = students.reduce((acc, curr) => acc + curr.examsTaken, 0)
  const activeStudents = students.filter((s) => s.examsTaken > 0).length

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Students Directory
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Registered student accounts, enrollment IDs, and testing activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
              <Users className="w-4 h-4 text-indigo-600" />
              {students.length} Registered Learners
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Enrolled</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{students.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Test Takers</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{activeStudents}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Tests Taken</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{totalExamsAttempted}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Search & Sorting Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, enrollment no, or email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Sort by:</span>
            <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden text-xs">
              <button
                onClick={() => handleSortToggle('name')}
                className={`px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                  sortBy === 'name' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSortToggle('date')}
                className={`px-3 py-1.5 font-medium border-l border-slate-200 transition-colors cursor-pointer ${
                  sortBy === 'date' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSortToggle('exams')}
                className={`px-3 py-1.5 font-medium border-l border-slate-200 transition-colors cursor-pointer ${
                  sortBy === 'exams' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Exams {sortBy === 'exams' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-100">
                  <div className="space-y-2">
                    <div className="h-4 w-44 bg-slate-200 rounded"></div>
                    <div className="h-3 w-32 bg-slate-100 rounded"></div>
                  </div>
                  <div className="h-4 w-28 bg-slate-200 rounded"></div>
                  <div className="h-4 w-16 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {searchQuery ? 'No matching students found' : 'No students registered yet'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery
                  ? 'Try searching with a different name or enrollment number.'
                  : 'When students sign up on the portal, their records and activity will appear here automatically.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Enrollment No</th>
                    <th className="px-4 py-4">Registered Date</th>
                    <th className="px-6 py-4 text-right">Exams Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {(student.full_name || 'S')
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {student.full_name || 'Unnamed Student'}
                            </p>
                            <span className="text-xs text-slate-400">Student Account</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{student.email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs font-mono font-medium text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {student.enrollment_no || 'NOT ASSIGNED'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(student.created_at)}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            student.examsTaken > 0
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {student.examsTaken} {student.examsTaken === 1 ? 'Exam' : 'Exams'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
