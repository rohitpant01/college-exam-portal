import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Plus, 
  HelpCircle, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Award, 
  BookOpen, 
  X, 
  Loader2, 
  FileSpreadsheet, 
  Sparkles,
  Info,
  Check,
  AlertTriangle,
  Upload,
  Download,
  FileText,
  FileCode
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ExamQuestions() {
  const { examId } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  // Single Question Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [formData, setFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'a',
    marks: 1,
    explanation: ''
  })

  // Bulk Add Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [bulkParsingError, setBulkParsingError] = useState('')

  const fetchExamAndQuestions = async () => {
    try {
      setLoading(true)

      // Fetch exam details with subject
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

      // Fetch questions ordered by order_num, created_at
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_num', { ascending: true })

      if (questionsError) throw questionsError
      setQuestions(questionsData || [])
    } catch (err) {
      console.error('Error fetching exam questions:', err)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (examId) {
      fetchExamAndQuestions()
    }
  }, [examId])

  // Recalculate and sync exam total marks with questions sum
  const syncExamTotalMarks = async (currentQuestions) => {
    const total = currentQuestions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 1), 0)
    try {
      await supabase
        .from('exams')
        .update({ total_marks: total })
        .eq('id', examId)

      setExam((prev) => (prev ? { ...prev, total_marks: total } : null))
    } catch (err) {
      console.warn('Failed to sync total_marks with exam:', err)
    }
  }

  const handleOpenAddModal = () => {
    setEditingQuestion(null)
    setFormData({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'a',
      marks: 1,
      explanation: ''
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q)
    setFormData({
      question_text: q.question_text || '',
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_option: q.correct_option ? q.correct_option.toLowerCase() : 'a',
      marks: q.marks || 1,
      explanation: q.explanation || ''
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (submitting) return
    setIsModalOpen(false)
    setEditingQuestion(null)
  }

  const handleSaveQuestion = async (e) => {
    e.preventDefault()

    if (!formData.question_text.trim()) {
      toast.error('Question text is required')
      return
    }

    if (!formData.option_a.trim() || !formData.option_b.trim() || !formData.option_c.trim() || !formData.option_d.trim()) {
      toast.error('All 4 options (A, B, C, D) are required')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        exam_id: examId,
        question_text: formData.question_text.trim(),
        option_a: formData.option_a.trim(),
        option_b: formData.option_b.trim(),
        option_c: formData.option_c.trim(),
        option_d: formData.option_d.trim(),
        correct_option: formData.correct_option.toLowerCase(),
        marks: parseInt(formData.marks, 10) || 1,
        explanation: formData.explanation?.trim() || null
      }

      if (editingQuestion) {
        const { data, error } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', editingQuestion.id)
          .select()
          .single()

        if (error) throw error

        toast.success('Question updated successfully')
        const updatedList = questions.map((q) => (q.id === editingQuestion.id ? data : q))
        setQuestions(updatedList)
        await syncExamTotalMarks(updatedList)
      } else {
        payload.order_num = questions.length + 1

        const { data, error } = await supabase
          .from('questions')
          .insert([payload])
          .select()
          .single()

        if (error) throw error

        toast.success('Question added successfully')
        const updatedList = [...questions, data]
        setQuestions(updatedList)
        await syncExamTotalMarks(updatedList)
      }

      handleCloseModal()
    } catch (err) {
      console.error('Error saving question:', err)
      toast.error(err.message || 'Failed to save question')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickUpdateMarks = async (question, newMarks) => {
    const parsed = parseInt(newMarks, 10)
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Marks must be at least 1')
      return
    }
    if (parsed === question.marks) return

    try {
      const { error } = await supabase
        .from('questions')
        .update({ marks: parsed })
        .eq('id', question.id)

      if (error) throw error

      toast.success(`Updated Q#${question.order_num || ''} to ${parsed} ${parsed === 1 ? 'mark' : 'marks'}`)
      const updatedList = questions.map((q) => (q.id === question.id ? { ...q, marks: parsed } : q))
      setQuestions(updatedList)
      await syncExamTotalMarks(updatedList)
    } catch (err) {
      console.error('Error updating question marks:', err)
      toast.error('Failed to update marks')
    }
  }

  const handleDeleteQuestion = async (question) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', question.id)

      if (error) throw error

      toast.success('Question deleted')
      const updatedList = questions.filter((q) => q.id !== question.id)
      setQuestions(updatedList)
      await syncExamTotalMarks(updatedList)
    } catch (err) {
      console.error('Error deleting question:', err)
      toast.error(err.message || 'Failed to delete question')
    }
  }

  // Helper to parse CSV lines respecting quotes
  const parseCSVRows = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length === 0) return []

    const rows = []
    for (const line of lines) {
      const row = []
      let insideQuote = false
      let currentVal = ''
      // Detect delimiter: tab or comma or semicolon
      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') && !line.includes(',') ? ';' : ',')

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote
        } else if (char === delimiter && !insideQuote) {
          row.push(currentVal.trim().replace(/^["']|["']$/g, ''))
          currentVal = ''
        } else {
          currentVal += char
        }
      }
      row.push(currentVal.trim().replace(/^["']|["']$/g, ''))
      rows.push(row)
    }
    return rows
  }

  // Bulk question text parsing (Supports: Plain Text, CSV / Excel, JSON)
  const parseBulkText = (raw) => {
    setBulkParsingError('')
    if (!raw.trim()) {
      setParsedQuestions([])
      return
    }

    // Clean up input: remove UTF-8 BOM, trim whitespace, and strip markdown code block backticks (e.g. ```json ... ```)
    let cleaned = raw.replace(/^\uFEFF/, '').trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    // 1. Check if it's JSON format (or starts with [ or {)
    const jsonStartIdx = cleaned.indexOf('[') !== -1 && (cleaned.indexOf('{') === -1 || cleaned.indexOf('[') < cleaned.indexOf('{'))
      ? cleaned.indexOf('[')
      : cleaned.indexOf('{')
    const jsonEndIdx = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'))

    if (jsonStartIdx !== -1 && jsonEndIdx !== -1 && jsonEndIdx > jsonStartIdx) {
      try {
        const potentialJson = cleaned.substring(jsonStartIdx, jsonEndIdx + 1)
        const parsedJson = JSON.parse(potentialJson)
        const items = Array.isArray(parsedJson) ? parsedJson : [parsedJson]
        const validQuestions = []
        const jsonErrors = []

        items.forEach((item, idx) => {
          // Extract question text: title, question_text, question, prompt, or q
          let qText = item.title || item.question_text || item.question || item.prompt || item.q || ''
          // Clean question text if it has leading numbering like "Q1. " or "1. "
          qText = qText.replace(/^(Q\d+[:.]\s*|\d+[:.]\s*|Question\s*\d+[:.]\s*)/i, '').trim() || qText.trim()

          // Extract options: could be array item.options or item.choices or individual option_a/b/c/d
          let optA = ''
          let optB = ''
          let optC = ''
          let optD = ''

          if (Array.isArray(item.options) && item.options.length >= 2) {
            optA = String(item.options[0] ?? '').trim()
            optB = String(item.options[1] ?? '').trim()
            optC = String(item.options[2] ?? '').trim()
            optD = String(item.options[3] ?? '').trim()
          } else if (Array.isArray(item.choices) && item.choices.length >= 2) {
            optA = String(item.choices[0] ?? '').trim()
            optB = String(item.choices[1] ?? '').trim()
            optC = String(item.choices[2] ?? '').trim()
            optD = String(item.choices[3] ?? '').trim()
          } else {
            optA = String(item.option_a ?? item.optA ?? item.a ?? '').trim()
            optB = String(item.option_b ?? item.optB ?? item.b ?? '').trim()
            optC = String(item.option_c ?? item.optC ?? item.c ?? '').trim()
            optD = String(item.option_d ?? item.optD ?? item.d ?? '').trim()
          }

          // Extract answer: correctIndex (0=a, 1=b, 2=c, 3=d), correct_option, answer, answerIndex, etc.
          let ans = ''
          if (item.correctIndex !== undefined && item.correctIndex !== null) {
            const idxNum = parseInt(item.correctIndex, 10)
            if (idxNum === 0) ans = 'a'
            else if (idxNum === 1) ans = 'b'
            else if (idxNum === 2) ans = 'c'
            else if (idxNum === 3) ans = 'd'
          } else if (item.answerIndex !== undefined && item.answerIndex !== null) {
            const idxNum = parseInt(item.answerIndex, 10)
            if (idxNum === 0) ans = 'a'
            else if (idxNum === 1) ans = 'b'
            else if (idxNum === 2) ans = 'c'
            else if (idxNum === 3) ans = 'd'
          } else {
            const rawAns = String(item.correct_option ?? item.correctAnswer ?? item.answer ?? item.ans ?? '').toLowerCase().trim()
            if (['a', 'b', 'c', 'd'].includes(rawAns)) {
              ans = rawAns
            } else if (['0', '1', '2', '3'].includes(rawAns)) {
              ans = ['a', 'b', 'c', 'd'][parseInt(rawAns, 10)]
            } else if (['1', '2', '3', '4'].includes(rawAns)) {
              ans = ['a', 'b', 'c', 'd'][parseInt(rawAns, 10) - 1]
            } else {
              // Check if the answer matches one of the option texts exactly
              if (rawAns && rawAns === optA.toLowerCase()) ans = 'a'
              else if (rawAns && rawAns === optB.toLowerCase()) ans = 'b'
              else if (rawAns && rawAns === optC.toLowerCase()) ans = 'c'
              else if (rawAns && rawAns === optD.toLowerCase()) ans = 'd'
            }
          }

          const marks = parseInt(item.marks, 10) || 1
          const explanation = item.explanation || item.explain || item.solution || null

          if (qText && optA && optB && ['a', 'b', 'c', 'd'].includes(ans)) {
            validQuestions.push({
              question_text: qText,
              option_a: optA,
              option_b: optB,
              option_c: optC || 'None of the above',
              option_d: optD || 'All of the above',
              correct_option: ans,
              marks: marks,
              explanation: explanation ? String(explanation).trim() : null
            })
          } else {
            jsonErrors.push(`JSON Item #${idx + 1} (${qText ? qText.substring(0, 30) + '...' : 'untitled'}) is missing fields or valid answer.`)
          }
        })

        if (validQuestions.length > 0) {
          if (jsonErrors.length > 0) {
            setBulkParsingError(jsonErrors.slice(0, 3).join(' ' + (jsonErrors.length > 3 ? `(+${jsonErrors.length - 3} more)` : '')))
          }
          setParsedQuestions(validQuestions)
          return
        }
      } catch (e) {
        // Not valid JSON, continue to CSV and Plain Text
      }
    }

    // 2. Check if it's CSV format (e.g. Question, Option A, Option B...)
    const csvRows = parseCSVRows(cleaned)
    if (csvRows.length >= 1 && csvRows[0].length >= 5) {
      // Check if first line is a header
      const firstRowStr = csvRows[0].join(' ').toLowerCase()
      const isHeader = firstRowStr.includes('question') || firstRowStr.includes('option') || firstRowStr.includes('correct')
      const dataRows = isHeader ? csvRows.slice(1) : csvRows

      const csvQuestions = []
      dataRows.forEach((row) => {
        if (row.length >= 6) {
          const qText = row[0]
          const optA = row[1]
          const optB = row[2]
          const optC = row[3]
          const optD = row[4]
          let ans = (row[5] || '').toLowerCase().trim().replace(/[^abcd1234]/g, '')
          // Map 1,2,3,4 to a,b,c,d if needed
          if (ans === '1') ans = 'a'
          if (ans === '2') ans = 'b'
          if (ans === '3') ans = 'c'
          if (ans === '4') ans = 'd'

          const marks = parseInt(row[6], 10) || 1
          const explanation = row[7] ? row[7].trim() : null

          if (qText && optA && optB && optC && optD && ['a', 'b', 'c', 'd'].includes(ans)) {
            csvQuestions.push({
              question_text: qText,
              option_a: optA,
              option_b: optB,
              option_c: optC,
              option_d: optD,
              correct_option: ans,
              marks: marks,
              explanation: explanation || null
            })
          }
        }
      })

      if (csvQuestions.length > 0) {
        setParsedQuestions(csvQuestions)
        return
      }
    }

    // 3. Fallback: MNC Plain Text Format (Q: ... A) ... Answer: B ... Explanation: ...)
    const lines = raw.split('\n')
    const chunks = []
    let currentChunk = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      const isNewQuestionStart =
        /^Q(\d+)?[:.]/i.test(trimmedLine) ||
        /^Question(\s*\d+)?[:.]/i.test(trimmedLine) ||
        /^\d+\./.test(trimmedLine)

      if (isNewQuestionStart && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'))
        currentChunk = [line]
      } else {
        currentChunk.push(line)
      }
    }
    if (currentChunk.length > 0 && currentChunk.some((l) => l.trim().length > 0)) {
      chunks.push(currentChunk.join('\n'))
    }

    const parsed = []
    const errors = []

    chunks.forEach((chunk, index) => {
      const chunkLines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
      if (chunkLines.length === 0) return

      let qText = ''
      let optA = ''
      let optB = ''
      let optC = ''
      let optD = ''
      let answer = ''
      let marks = 1
      let explanation = ''

      chunkLines.forEach((l) => {
        if (/^Q(\d+)?[:.]/i.test(l) || /^Question(\s*\d+)?[:.]/i.test(l) || /^\d+\./.test(l)) {
          qText = l.replace(/^Q(\d+)?[:.]/i, '').replace(/^Question(\s*\d+)?[:.]/i, '').replace(/^\d+\./, '').trim()
        } else if (/^[Aa][).:]\s*/.test(l)) {
          optA = l.replace(/^[Aa][).:]\s*/, '').trim()
        } else if (/^[Bb][).:]\s*/.test(l)) {
          optB = l.replace(/^[Bb][).:]\s*/, '').trim()
        } else if (/^[Cc][).:]\s*/.test(l)) {
          optC = l.replace(/^[Cc][).:]\s*/, '').trim()
        } else if (/^[Dd][).:]\s*/.test(l)) {
          optD = l.replace(/^[Dd][).:]\s*/, '').trim()
        } else if (/^Answer[:.]\s*/i.test(l) || /^Ans[:.]\s*/i.test(l)) {
          const rawAns = l.replace(/^Answer[:.]\s*/i, '').replace(/^Ans[:.]\s*/i, '').trim().toLowerCase()
          answer = rawAns.charAt(0)
        } else if (/^Marks[:.]\s*/i.test(l)) {
          const m = parseInt(l.replace(/^Marks[:.]\s*/i, '').trim(), 10)
          if (!isNaN(m) && m > 0) marks = m
        } else if (/^(?:Explanation|Explain|Solution)[:.]\s*/i.test(l)) {
          explanation = l.replace(/^(?:Explanation|Explain|Solution)[:.]\s*/i, '').trim()
        } else if (explanation) {
          explanation += ' ' + l
        } else if (!qText && !optA) {
          qText += ' ' + l
        }
      })

      if (!qText || !optA || !optB || !optC || !optD || !['a', 'b', 'c', 'd'].includes(answer)) {
        errors.push(`Question #${index + 1} is missing fields or correct answer (found: "${answer || 'none'}").`)
      } else {
        parsed.push({
          question_text: qText,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          correct_option: answer,
          marks: marks,
          explanation: explanation.trim() || null
        })
      }
    })

    if (errors.length > 0) {
      setBulkParsingError(errors.slice(0, 3).join(' ' + (errors.length > 3 ? `(+${errors.length - 3} more)` : '')))
    }

    setParsedQuestions(parsed)
  }

  const handleBulkTextChange = (e) => {
    const val = e.target.value
    setBulkText(val)
    parseBulkText(val)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        setBulkText(content)
        parseBulkText(content)
        toast.success(`Loaded "${file.name}"`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleDownloadCSVTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      encodeURIComponent(
        'Question,Option A,Option B,Option C,Option D,Correct Option,Marks\n' +
          '"What is the primary function of an Operating System?","Compile code","Manage hardware and software resources","Design websites","Edit images",B,1\n' +
          '"Which of the following is NOT an OOP concept?","Inheritance","Polymorphism","Compilation","Encapsulation",C,1\n' +
          '"What is the time complexity of binary search on a sorted array?","O(n)","O(log n)","O(n^2)","O(1)",B,2\n'
      )
    const link = document.createElement('a')
    link.setAttribute('href', csvContent)
    link.setAttribute('download', `${(exam?.title || 'exam').replace(/\s+/g, '_')}_questions_template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded questions CSV template')
  }

  const handleLoadSampleFormat = () => {
    const sample = `Q: What is React?
A) A relational database system
B) A declarative frontend JavaScript library
C) A server-side Node.js framework
D) An operating system kernel
Answer: B
Marks: 1

Q: What is JSX?
A) JavaScript XML syntax extension
B) Java Standard Extension
C) JSON XML converter
D) JavaScript Execution Engine
Answer: A
Marks: 1

Q: Which hook is used for side effects in React?
A) useState
B) useContext
C) useEffect
D) useReducer
Answer: C
Marks: 2`
    setBulkText(sample)
    parseBulkText(sample)
  }

  const handleLoadSampleJSON = () => {
    const sampleJson = JSON.stringify(
      [
        {
          question_text: "What does HTML stand for?",
          option_a: "Hyper Text Markup Language",
          option_b: "High Tech Machine Language",
          option_c: "Hyperlink Textual Mechanism",
          option_d: "Home Tool Markup Language",
          correct_option: "a",
          marks: 1
        },
        {
          question_text: "Which protocol is used for secure web browsing?",
          option_a: "FTP",
          option_b: "HTTP",
          option_c: "HTTPS",
          option_d: "SMTP",
          correct_option: "c",
          marks: 1
        }
      ],
      null,
      2
    )
    setBulkText(sampleJson)
    parseBulkText(sampleJson)
  }

  const handleBulkSubmit = async () => {
    if (parsedQuestions.length === 0) {
      toast.error('No valid questions parsed. Please follow the format.')
      return
    }

    try {
      setSubmitting(true)

      const startOrder = questions.length + 1
      const payload = parsedQuestions.map((q, idx) => ({
        exam_id: examId,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        marks: q.marks || 1,
        order_num: startOrder + idx
      }))

      const { data, error } = await supabase
        .from('questions')
        .insert(payload)
        .select()

      if (error) throw error

      toast.success(`Successfully added ${payload.length} questions!`)
      const updatedList = [...questions, ...(data || [])]
      setQuestions(updatedList)
      await syncExamTotalMarks(updatedList)

      setIsBulkModalOpen(false)
      setBulkText('')
      setParsedQuestions([])
    } catch (err) {
      console.error('Error inserting bulk questions:', err)
      toast.error(err.message || 'Failed to bulk insert questions')
    } finally {
      setSubmitting(false)
    }
  }

  const calculatedTotalMarks = questions.reduce(
    (sum, q) => sum + (parseInt(q.marks, 10) || 1),
    0
  )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/admin/exams"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to All Exams
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
              <span>{exam ? exam.title : 'Manage Questions'}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setBulkText('')
                setParsedQuestions([])
                setBulkParsingError('')
                setIsBulkModalOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Bulk Add Questions
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        </div>

        {/* Exam Info Summary Bar */}
        {exam && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-slate-500">Subject:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {exam.subjects?.name || 'General'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-slate-500">Duration:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {exam.duration_minutes} minutes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-slate-500">Maximum Marks:</span>
                <span className="text-sm font-bold text-slate-800">
                  {exam.total_marks || calculatedTotalMarks} pts
                </span>
              </div>

              {calculatedTotalMarks !== (exam.total_marks || calculatedTotalMarks) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Questions Sum:</span>
                  <span className="text-sm font-medium text-slate-700">
                    {calculatedTotalMarks} pts
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  exam.is_published
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {exam.is_published ? 'Published' : 'Draft Mode'}
              </span>
            </div>
          </div>
        )}

        {/* Questions List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse space-y-4"
              >
                <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="h-10 bg-slate-100 rounded-lg"></div>
                  <div className="h-10 bg-slate-100 rounded-lg"></div>
                  <div className="h-10 bg-slate-100 rounded-lg"></div>
                  <div className="h-10 bg-slate-100 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No questions added yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Add multiple choice questions one by one or paste questions in bulk to quickly build your exam question paper.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Single Question
              </button>
              <button
                onClick={() => {
                  setBulkText('')
                  setParsedQuestions([])
                  setBulkParsingError('')
                  setIsBulkModalOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                Paste Bulk Questions
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, index) => {
              const correct = (q.correct_option || '').toLowerCase()

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                        {index + 1}
                      </span>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
                          {q.question_text}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      {/* Per-Question Marks Quick Control */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Marks:
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleQuickUpdateMarks(q, m)}
                              className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer transition-colors ${
                                (q.marks || 1) === m
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title={`Set to ${m} ${m === 1 ? 'mark' : 'marks'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          defaultValue={q.marks || 1}
                          key={`input-${q.id}-${q.marks}`}
                          onBlur={(e) => handleQuickUpdateMarks(q, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleQuickUpdateMarks(q, e.target.value)
                              e.target.blur()
                            }
                          }}
                          className="w-12 text-center text-xs font-bold py-0.5 px-1 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="Custom mark: type number and press Enter or click outside"
                        />
                      </div>

                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Edit Question"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                    {/* Option A */}
                    <div
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                        correct === 'a'
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          correct === 'a' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          A
                        </span>
                        <span>{q.option_a}</span>
                      </div>
                      {correct === 'a' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Option B */}
                    <div
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                        correct === 'b'
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          correct === 'b' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          B
                        </span>
                        <span>{q.option_b}</span>
                      </div>
                      {correct === 'b' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Option C */}
                    <div
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                        correct === 'c'
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          correct === 'c' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          C
                        </span>
                        <span>{q.option_c}</span>
                      </div>
                      {correct === 'c' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Option D */}
                    <div
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                        correct === 'd'
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          correct === 'd' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          D
                        </span>
                        <span>{q.option_d}</span>
                      </div>
                      {correct === 'd' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Explanation Preview (if available) */}
                  {q.explanation && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                      <span className="font-bold shrink-0 text-amber-800">💡 Solution Hint / Explanation:</span>
                      <p className="flex-1 whitespace-pre-line leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add/Edit Single Question Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingQuestion ? 'Edit Question' : 'Add New Question'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Question Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    placeholder="Enter question statement..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Option A <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.option_a}
                      onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                      placeholder="Choice A text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Option B <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.option_b}
                      onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                      placeholder="Choice B text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Option C <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.option_c}
                      onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                      placeholder="Choice C text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Option D <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.option_d}
                      onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                      placeholder="Choice D text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Correct Answer <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['a', 'b', 'c', 'd'].map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center justify-center p-2 rounded-lg border text-sm font-bold uppercase cursor-pointer transition-all ${
                            formData.correct_option === opt
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="correct_option"
                            value={opt}
                            checked={formData.correct_option === opt}
                            onChange={(e) => setFormData({ ...formData, correct_option: e.target.value })}
                            className="sr-only"
                          />
                          Option {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Marks Allocated <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        required
                        min="1"
                        max="100"
                        value={formData.marks}
                        onChange={(e) => setFormData({ ...formData, marks: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <div className="flex flex-wrap items-center gap-1">
                        {[1, 2, 3, 4, 5, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFormData({ ...formData, marks: num })}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${
                              parseInt(formData.marks, 10) === num
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {num} {num === 1 ? 'pt' : 'pts'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Assign different weightage (e.g. 1 mark for easy, 2 or 3 for medium/hard questions).
                    </p>
                  </div>
                </div>

                {/* Explanation Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Explanation / Solution Hint</span>
                    <span className="text-xs text-slate-400 font-normal">Optional — shown during detailed review</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    placeholder="Provide detailed reasoning, step-by-step solution, or reference formula for students..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
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
                    {editingQuestion ? 'Update Question' : 'Save Question'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Add Modal */}
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Bulk Add Questions</h3>
                    <p className="text-xs text-slate-500">
                      Upload or paste question papers in Text, CSV/Excel, or JSON format.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  disabled={submitting}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* Action Bar: File Upload & Templates */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Choose File (.csv, .txt, .json)</span>
                      <input
                        type="file"
                        accept=".txt,.csv,.json,.tsv"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs cursor-pointer transition-colors"
                      title="Download clean CSV template for Excel / Google Sheets"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Download Excel/CSV Template</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Samples:</span>
                    <button
                      type="button"
                      onClick={handleLoadSampleFormat}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Text Format
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleLoadSampleJSON}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      JSON Format
                    </button>
                  </div>
                </div>

                <textarea
                  rows={9}
                  value={bulkText}
                  onChange={handleBulkTextChange}
                  placeholder={`Paste your question paper here, upload a file above, or use the template...

Format 1: Plain Text
Q: What is the primary purpose of an Operating System?
A) Compiling user code
B) Managing hardware and software resources
C) Designing web pages
D) Playing media files
Answer: B
Marks: 1

Format 2: CSV / Excel (Comma or Tab separated)
Question,Option A,Option B,Option C,Option D,Correct Option,Marks
"What is React?","Database","Frontend library","Backend framework","Operating system",B,1`}
                  className="w-full font-mono text-xs rounded-lg border border-slate-300 p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />

                {/* Parsing Status Info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        parsedQuestions.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    ></span>
                    <span className="text-xs font-medium text-slate-700">
                      <strong>{parsedQuestions.length}</strong> questions detected & ready to import
                    </span>
                  </div>

                  {bulkParsingError && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{bulkParsingError}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    disabled={submitting}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={submitting || parsedQuestions.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Import {parsedQuestions.length} Questions
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
