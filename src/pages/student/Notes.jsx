import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Search,
  Download,
  BookOpen,
  Filter,
  Calendar,
  HardDrive,
  ExternalLink,
  RotateCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('ALL')

  const fetchData = async () => {
    try {
      setLoading(true)

      // 1. Fetch subjects
      let subList = []
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name', { ascending: true })

      if (!subjectsError && subjectsData) {
        subList = subjectsData
        setSubjects(subjectsData)
      }

      // 2. Fetch notes with subject join
      let { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          *,
          subjects (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })

      // Fallback if joined query encountered an issue
      if (notesError) {
        console.warn('Joined notes query error, trying flat query:', notesError.message)
        const flatRes = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false })

        if (flatRes.error) {
          throw flatRes.error
        }

        const subjectMap = new Map(subList.map((s) => [s.id, s]))
        notesData = (flatRes.data || []).map((n) => ({
          ...n,
          subjects: subjectMap.get(n.subject_id) || null
        }))
      }

      setNotes(notesData || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
      toast.error(err.message || 'Failed to load study notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filter notes by search query and selected subject
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSubject =
        selectedSubject === 'ALL' || note.subject_id === selectedSubject

      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        note.title?.toLowerCase().includes(query) ||
        note.description?.toLowerCase().includes(query) ||
        note.subjects?.name?.toLowerCase().includes(query)

      return matchesSubject && matchesSearch
    })
  }, [notes, selectedSubject, searchQuery])

  // Helper to format file sizes nicely
  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return 'Unknown size'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="py-4 px-0">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Study Notes</h1>
            <p className="text-slate-500 text-sm mt-1">
              Access lecture materials, reference guides, and subject notes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh notes list"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {filteredNotes.length}
              </span>{' '}
              of {notes.length} notes
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-card rounded-2xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes by title or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Subject Dropdown */}
            <div className="relative">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full pl-10 pr-8 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Notes Grid */}
        {loading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                  <div className="w-20 h-5 bg-slate-200 rounded-full" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded w-full" />
                  <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="w-24 h-4 bg-slate-100 rounded" />
                  <div className="w-20 h-8 bg-slate-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {notes.length === 0
                ? 'No notes available yet'
                : 'No notes match your filter'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {notes.length === 0
                ? 'Study materials and revision notes uploaded by your instructors will appear here.'
                : 'Try adjusting your search keyword or selected subject filter.'}
            </p>
            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedSubject('ALL')
                }}
                className="mt-4 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          /* Real Notes Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map((note) => {
              const isPdf = note.file_name?.toLowerCase().endsWith('.pdf')

              return (
                <div
                  key={note.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon & Subject Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isPdf
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="rounded-full bg-indigo-100 text-indigo-700 font-medium px-2.5 py-0.5 text-xs truncate max-w-[150px]">
                        {note.subjects?.name || 'General'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-slate-800 text-base group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {note.title}
                    </h3>

                    {/* Description */}
                    {note.description ? (
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {note.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No description provided.
                      </p>
                    )}
                  </div>

                  {/* Metadata and Download Button */}
                  <div className="pt-5 mt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {formatFileSize(note.file_size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {note.file_url ? (
                      <a
                        href={note.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Note</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 text-slate-400 px-4 py-2 text-sm font-medium cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        File Unavailable
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
