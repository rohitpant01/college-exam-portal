import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  HelpCircle, 
  Clock, 
  Award, 
  X, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Filter,
  Eye,
  BookOpen
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Exams() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, PUBLISHED, DRAFT

  // Create/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingExam, setEditingExam] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject_id: '',
    duration_minutes: 60,
    total_marks: 100,
    per_question_marks: '',
    starts_at: '',
    ends_at: ''
  })

  // Format date for datetime-local input
  const toDatetimeLocal = (isoStr) => {
    if (!isoStr) return ''
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return ''
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const fetchExamsAndSubjects = async () => {
    try {
      setLoading(true)
      const [examsRes, subjectsRes] = await Promise.all([
        supabase
          .from('exams')
          .select(`
            *,
            subjects (
              id,
              name
            ),
            questions (
              id,
              marks
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('subjects')
          .select('id, name')
          .order('name', { ascending: true })
      ])

      if (examsRes.error) throw examsRes.error
      if (subjectsRes.error) throw subjectsRes.error

      const formatted = (examsRes.data || []).map((exam) => {
        const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0
        const calculatedMarks = Array.isArray(exam.questions)
          ? exam.questions.reduce((acc, q) => acc + (q.marks || 1), 0)
          : (exam.total_marks || 0)

        return {
          ...exam,
          questionCount,
          total_marks: calculatedMarks > 0 ? calculatedMarks : (exam.total_marks || 0)
        }
      })

      setExams(formatted)
      setSubjects(subjectsRes.data || [])
    } catch (err) {
      console.error('Error fetching exams:', err)
      toast.error('Failed to load exams list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExamsAndSubjects()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingExam(null)
    setFormData({
      title: '',
      description: '',
      subject_id: subjects.length > 0 ? subjects[0].id : '',
      duration_minutes: 60,
      total_marks: 100,
      per_question_marks: '',
      starts_at: '',
      ends_at: ''
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (exam) => {
    setEditingExam(exam)
    // Check if questions have marks
    let initialPerQuestionMarks = ''
    if (Array.isArray(exam.questions) && exam.questions.length > 0) {
      initialPerQuestionMarks = exam.questions[0].marks || 1
    } else if (exam.questionCount > 0 && exam.total_marks > 0) {
      initialPerQuestionMarks = Math.round(exam.total_marks / exam.questionCount)
    }

    setFormData({
      title: exam.title || '',
      description: exam.description || '',
      subject_id: exam.subject_id || (subjects[0]?.id || ''),
      duration_minutes: exam.duration_minutes || 60,
      total_marks: exam.total_marks || 100,
      per_question_marks: initialPerQuestionMarks,
      starts_at: toDatetimeLocal(exam.starts_at),
      ends_at: toDatetimeLocal(exam.ends_at)
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (submitting) return
    setIsModalOpen(false)
    setEditingExam(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Exam title is required')
      return
    }

    if (!formData.subject_id) {
      toast.error('Please select a subject')
      return
    }

    if (Number(formData.duration_minutes) <= 0) {
      toast.error('Duration must be greater than 0 minutes')
      return
    }

    if (Number(formData.total_marks) <= 0) {
      toast.error('Maximum marks must be greater than 0')
      return
    }

    // Optional date validation
    if (formData.starts_at && formData.ends_at) {
      if (new Date(formData.starts_at) >= new Date(formData.ends_at)) {
        toast.error('Starts At time must be before Ends At time')
        return
      }
    }

    try {
      setSubmitting(true)

      const parsedMaxMarks = parseInt(formData.total_marks, 10) || 100
      // Calculate a sensible pass mark (default 40% of maximum marks)
      const calculatedPassMarks = Math.round(parsedMaxMarks * 0.4)

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        subject_id: formData.subject_id,
        duration_minutes: parseInt(formData.duration_minutes, 10),
        total_marks: parsedMaxMarks,
        pass_marks: calculatedPassMarks,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null
      }

      if (editingExam) {
        const { error } = await supabase
          .from('exams')
          .update(payload)
          .eq('id', editingExam.id)

        if (error) throw error

        // If admin specified or changed per-question marks, update all questions of this exam
        const targetPerQMark = parseInt(formData.per_question_marks, 10)
        if (!isNaN(targetPerQMark) && targetPerQMark > 0 && editingExam.questionCount > 0) {
          const { error: qUpdateErr } = await supabase
            .from('questions')
            .update({ marks: targetPerQMark })
            .eq('exam_id', editingExam.id)

          if (!qUpdateErr) {
            // Also sync total marks of exam with questions count * targetPerQMark
            const newTotal = editingExam.questionCount * targetPerQMark
            await supabase
              .from('exams')
              .update({ total_marks: newTotal, pass_marks: Math.round(newTotal * 0.4) })
              .eq('id', editingExam.id)
          }
        }

        toast.success('Exam updated successfully')
      } else {
        payload.created_by = profile?.id || null
        payload.is_published = false

        const { data: newExam, error } = await supabase
          .from('exams')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        toast.success('Exam created! Now add questions.')
        handleCloseModal()
        // Offer quick navigation to add questions
        if (newExam?.id) {
          navigate(`/admin/exams/${newExam.id}/questions`)
          return
        }
      }

      handleCloseModal()
      fetchExamsAndSubjects()
    } catch (err) {
      console.error('Error saving exam:', err)
      toast.error(err.message || 'Failed to save exam')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle publish status with validation
  const handleTogglePublish = async (exam) => {
    const nextState = !exam.is_published

    // Validate that exam has at least 1 question before publishing
    if (nextState && exam.questionCount === 0) {
      toast.error('Cannot publish an exam with 0 questions! Please add questions first.')
      return
    }

    try {
      const { error } = await supabase
        .from('exams')
        .update({ is_published: nextState })
        .eq('id', exam.id)

      if (error) throw error

      toast.success(nextState ? 'Exam published to students!' : 'Exam unpublished (draft mode)')
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, is_published: nextState } : e))
      )
    } catch (err) {
      console.error('Error updating exam status:', err)
      toast.error('Failed to change publish status')
    }
  }

  const handleDelete = async (exam) => {
    const confirmMessage = `Are you sure you want to delete "${exam.title}"? All associated questions and student exam attempts will be permanently deleted.`
    if (!window.confirm(confirmMessage)) return

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', exam.id)

      if (error) throw error

      toast.success('Exam deleted successfully')
      setExams((prev) => prev.filter((e) => e.id !== exam.id))
    } catch (err) {
      console.error('Error deleting exam:', err)
      toast.error(err.message || 'Failed to delete exam')
    }
  }

  const filteredExams = exams.filter((exam) => {
    const matchesQuery =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.subjects?.name && exam.subjects.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesSubject =
      subjectFilter === 'ALL' || exam.subject_id === subjectFilter

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PUBLISHED' && exam.is_published) ||
      (statusFilter === 'DRAFT' && !exam.is_published)

    return matchesQuery && matchesSubject && matchesStatus
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Exam Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create, configure, publish examinations, and manage question banks
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Exam
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exams by title or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="DRAFT">Drafts Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Exams Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-4 border-b border-slate-100">
                  <div className="space-y-2">
                    <div className="h-4 w-52 bg-slate-200 rounded"></div>
                    <div className="h-3 w-32 bg-slate-100 rounded"></div>
                  </div>
                  <div className="h-5 w-20 bg-slate-200 rounded"></div>
                  <div className="h-8 w-24 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {searchQuery || subjectFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No matching exams found'
                  : 'No examinations created yet'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery || subjectFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Try modifying your search or filter options.'
                  : 'Get started by creating your first exam. You can add questions, set time limits, and publish when ready.'}
              </p>
              {(!searchQuery && subjectFilter === 'ALL' && statusFilter === 'ALL') && (
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Exam
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Exam & Subject</th>
                    <th className="px-4 py-4">Duration</th>
                    <th className="px-4 py-4">Marks</th>
                    <th className="px-4 py-4">Questions</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span>{exam.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {exam.subjects?.name || 'Unassigned'}
                          </span>
                          {exam.description && (
                            <span className="text-xs text-slate-400 truncate max-w-xs">
                              • {exam.description}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-600 text-xs font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {exam.duration_minutes} mins
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600 text-xs font-medium">
                        <div className="flex flex-col">
                          <span>Max Marks: <strong className="text-slate-800">{exam.total_marks}</strong></span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            exam.questionCount === 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleTogglePublish(exam)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                            exam.is_published
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                          }`}
                          title={exam.is_published ? 'Click to unpublish' : 'Click to publish'}
                        >
                          {exam.is_published ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Published
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              Draft
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/exams/${exam.id}/questions`)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Manage Questions"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            Questions
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(exam)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Edit Exam Info"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(exam)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Exam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingExam ? 'Edit Exam Details' : 'Create New Exam'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Exam Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Midterm Assessment: Computer Networks"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.subject_id}
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="" disabled>Select Subject</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Duration (Minutes) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Maximum Marks <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 100"
                      value={formData.total_marks}
                      onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Marks Per Question
                      </label>
                      {editingExam && editingExam.questionCount > 0 && (
                        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {editingExam.questionCount} {editingExam.questionCount === 1 ? 'question' : 'questions'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="e.g. 1, 2, 3"
                        value={formData.per_question_marks}
                        onChange={(e) => {
                          const val = e.target.value
                          const num = parseInt(val, 10)
                          const qCount = editingExam?.questionCount || 0
                          setFormData((prev) => ({
                            ...prev,
                            per_question_marks: val,
                            // Auto calculate total marks if there are questions
                            total_marks: !isNaN(num) && num > 0 && qCount > 0 ? num * qCount : prev.total_marks
                          }))
                        }}
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      {/* Quick 1, 2, 3, 4, 5 number chips */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              const qCount = editingExam?.questionCount || 0
                              setFormData((prev) => ({
                                ...prev,
                                per_question_marks: m,
                                total_marks: qCount > 0 ? m * qCount : prev.total_marks
                              }))
                            }}
                            className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                              parseInt(formData.per_question_marks, 10) === m
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title={`Set to ${m} mark${m > 1 ? 's' : ''} per question`}
                          >
                            {m}pt
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Set each question to 1, 2, or 3 marks. Auto-updates all questions & total marks.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Starts At <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.starts_at}
                      onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Ends At <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.ends_at}
                      onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Instructions / Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Exam instructions, marking scheme, rules and guidelines for students..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 resize-none"
                  />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingExam ? 'Save Changes' : 'Create & Proceed to Questions'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
