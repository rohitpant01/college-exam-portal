import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  FileText, 
  ClipboardList, 
  X, 
  Loader2, 
  AlertCircle,
  FolderOpen
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Fetch subjects with note and exam counts
  const fetchSubjects = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subjects')
        .select(`
          id,
          name,
          description,
          created_at,
          notes ( id ),
          exams ( id )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((sub) => ({
        ...sub,
        notesCount: Array.isArray(sub.notes) ? sub.notes.length : 0,
        examsCount: Array.isArray(sub.exams) ? sub.exams.length : 0
      }))

      setSubjects(formatted)
    } catch (err) {
      console.error('Error fetching subjects:', err)
      toast.error('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubjects()
  }, [])

  const handleOpenAddModal = () => {
    setEditingSubject(null)
    setFormData({ name: '', description: '' })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name || '',
      description: subject.description || ''
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (submitting) return
    setIsModalOpen(false)
    setEditingSubject(null)
    setFormData({ name: '', description: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Subject name is required')
      return
    }

    try {
      setSubmitting(true)
      if (editingSubject) {
        // Update subject
        const { error } = await supabase
          .from('subjects')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim()
          })
          .eq('id', editingSubject.id)

        if (error) throw error
        toast.success('Subject updated successfully')
      } else {
        // Create subject
        const { error } = await supabase
          .from('subjects')
          .insert([
            {
              name: formData.name.trim(),
              description: formData.description.trim()
            }
          ])

        if (error) throw error
        toast.success('Subject created successfully')
      }

      handleCloseModal()
      fetchSubjects()
    } catch (err) {
      console.error('Error saving subject:', err)
      toast.error(err.message || 'Failed to save subject')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (subject) => {
    const message = `Are you sure you want to delete "${subject.name}"? If this subject has notes or exams associated with it, they might be affected.`
    if (!window.confirm(message)) return

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subject.id)

      if (error) throw error

      toast.success('Subject deleted successfully')
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id))
    } catch (err) {
      console.error('Error deleting subject:', err)
      toast.error(err.message || 'Failed to delete subject. It may have linked notes or exams.')
    }
  }

  const filteredSubjects = subjects.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Subjects
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Organize course categories, study notes, and exam modules
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects by name or description..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Subjects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse space-y-4"
              >
                <div className="h-6 w-3/4 bg-slate-200 rounded"></div>
                <div className="h-4 w-full bg-slate-100 rounded"></div>
                <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {searchQuery ? 'No matching subjects found' : 'No subjects created yet'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search query to find the subject you are looking for.'
                : 'Create subject categories to start uploading study notes and organizing online exams.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAddModal}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Subject
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.map((subject) => (
              <div
                key={subject.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">
                        {subject.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(subject)}
                        title="Edit Subject"
                        className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(subject)}
                        title="Delete Subject"
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 line-clamp-3">
                    {subject.description || 'No description provided for this subject.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span>{subject.notesCount} {subject.notesCount === 1 ? 'Note' : 'Notes'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-violet-500" />
                    <span>{subject.examsCount} {subject.examsCount === 1 ? 'Exam' : 'Exams'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingSubject ? 'Edit Subject' : 'Add New Subject'}
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
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Data Structures & Algorithms"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the subject curriculum and topics covered..."
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
                    {editingSubject ? 'Save Changes' : 'Create Subject'}
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
