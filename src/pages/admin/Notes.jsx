import { useState, useEffect, useRef } from 'react'
import { 
  FileText, 
  UploadCloud, 
  Search, 
  Trash2, 
  Download, 
  ExternalLink, 
  Plus, 
  X, 
  Loader2, 
  FolderOpen,
  Filter,
  CheckCircle2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Notes() {
  const { profile } = useAuth()

  const [notes, setNotes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL')

  // Upload modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject_id: ''
  })

  // Fetch all notes and subjects
  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesRes, subjectsRes] = await Promise.all([
        supabase
          .from('notes')
          .select(`
            *,
            subjects (
              id,
              name
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('subjects')
          .select('id, name')
          .order('name', { ascending: true })
      ])

      if (notesRes.error) throw notesRes.error
      if (subjectsRes.error) throw subjectsRes.error

      setNotes(notesRes.data || [])
      setSubjects(subjectsRes.data || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
      toast.error('Failed to load study notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenModal = () => {
    setSelectedFile(null)
    setFormData({
      title: '',
      description: '',
      subject_id: subjects.length > 0 ? subjects[0].id : ''
    })
    setFileInputKey(Date.now())
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (uploading) return
    setIsModalOpen(false)
    setSelectedFile(null)
    setFormData({ title: '', description: '', subject_id: '' })
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // 50 MB limit
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size cannot exceed 50 MB')
        e.target.value = ''
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      // Auto fill title if empty
      if (!formData.title) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        setFormData((prev) => ({ ...prev, title: nameWithoutExt }))
      }
    }
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Please enter a note title')
      return
    }

    if (!formData.subject_id) {
      toast.error('Please select a subject')
      return
    }

    if (!selectedFile) {
      toast.error('Please select a document to upload')
      return
    }

    try {
      setUploading(true)

      // 1. Sanitize filename and create storage path
      const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `notes/${Date.now()}_${sanitizedFileName}`

      // 2. Upload file to Supabase storage bucket 'notes'
      const { error: uploadError } = await supabase.storage
        .from('notes')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`File upload failed: ${uploadError.message}`)
      }

      // 3. Get public URL
      const { data: urlData } = supabase.storage
        .from('notes')
        .getPublicUrl(storagePath)

      const publicUrl = urlData?.publicUrl || ''

      // 4. Insert note record in DB
      const { data: insertedData, error: dbError } = await supabase
        .from('notes')
        .insert([
          {
            title: formData.title.trim(),
            description: formData.description.trim(),
            subject_id: formData.subject_id,
            file_url: publicUrl,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            uploaded_by: profile?.id || null
          }
        ])
        .select(`
          *,
          subjects (
            id,
            name
          )
        `)
        .single()

      if (dbError) throw dbError

      toast.success('Note uploaded successfully!')
      setNotes((prev) => [insertedData, ...prev])
      handleCloseModal()
    } catch (err) {
      console.error('Error uploading note:', err)
      toast.error(err.message || 'Failed to upload note')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (note) => {
    if (!window.confirm(`Are you sure you want to delete note "${note.title}"?`)) {
      return
    }

    try {
      // Try to extract storage path and delete from storage
      if (note.file_url) {
        try {
          const parts = note.file_url.split('/notes/')
          if (parts.length > 1) {
            const rawStoragePath = 'notes/' + parts[1].split('?')[0]
            await supabase.storage.from('notes').remove([rawStoragePath])
          }
        } catch (storageErr) {
          console.warn('Could not delete file from storage bucket:', storageErr)
        }
      }

      // Delete from DB
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', note.id)

      if (error) throw error

      toast.success('Note deleted successfully')
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    } catch (err) {
      console.error('Error deleting note:', err)
      toast.error(err.message || 'Failed to delete note')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.file_name && n.file_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (n.subjects?.name && n.subjects.name.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesSubject =
      selectedSubjectFilter === 'ALL' || n.subject_id === selectedSubjectFilter

    return matchesSearch && matchesSubject
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Study Notes
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload and manage course handouts, PDFs, and revision materials for students
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Note
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes by title, filename, or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-100">
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-slate-200 rounded"></div>
                    <div className="h-3 w-32 bg-slate-100 rounded"></div>
                  </div>
                  <div className="h-4 w-24 bg-slate-200 rounded"></div>
                  <div className="h-6 w-16 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {searchQuery || selectedSubjectFilter !== 'ALL'
                  ? 'No matching notes found'
                  : 'No study notes uploaded yet'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery || selectedSubjectFilter !== 'ALL'
                  ? 'Try adjusting your filters or search terms.'
                  : 'Upload reference materials, syllabus guides, or lecture slides for students to download.'}
              </p>
              {(!searchQuery && selectedSubjectFilter === 'ALL') && (
                <button
                  onClick={handleOpenModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload First Note
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Title & Details</th>
                    <th className="px-4 py-4">Subject</th>
                    <th className="px-4 py-4">File Name</th>
                    <th className="px-4 py-4">Size</th>
                    <th className="px-4 py-4">Uploaded</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredNotes.map((note) => (
                    <tr key={note.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{note.title}</p>
                        {note.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {note.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {note.subjects?.name || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-slate-600 max-w-xs truncate" title={note.file_name}>
                        {note.file_name || 'document.pdf'}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-slate-500">
                        {formatFileSize(note.file_size)}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatDate(note.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {note.file_url ? (
                            <a
                              href={note.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center"
                              title="Download / View"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : null}
                          <button
                            onClick={() => handleDelete(note)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Note"
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

        {/* Upload Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">Upload Study Note</h3>
                <button
                  onClick={handleCloseModal}
                  disabled={uploading}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
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
                  {subjects.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No subjects available. Please add a subject first before uploading notes.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Unit 1: Operating System Fundamentals"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide a summary or key topics covered in this document..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 resize-none"
                  />
                </div>

                {/* File Upload Drop Area */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    File Document <span className="text-red-500">*</span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors cursor-pointer bg-slate-50 hover:bg-slate-50/50"
                  >
                    <div className="space-y-1 text-center">
                      {selectedFile ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
                          <p className="text-sm font-medium text-slate-800 mt-2">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(selectedFile.size)} - Click to change
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="mx-auto h-9 w-9 text-slate-400" />
                          <div className="flex text-sm text-slate-600 mt-2">
                            <span className="font-medium text-indigo-600 hover:text-indigo-500">
                              Upload a file
                            </span>
                            <span className="pl-1">or drag and drop</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            PDF, DOC, DOCX, PPT, PPTX up to 50MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={uploading}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {uploading ? 'Uploading...' : 'Upload & Publish Note'}
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
