import React, { useState, useEffect } from 'react';
import API from './api';
import { 
  GraduationCap, BookOpen, CheckCircle, Clock, 
  Upload, FileText, Award, LogOut, ArrowRight, User, Sparkles, Plus, Check, Eye, Trash2, ChevronRight, HelpCircle
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('eval_token'));
  const [role, setRole] = useState(localStorage.getItem('eval_role') || 'teacher');
  const [authMode, setAuthMode] = useState('login');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rollOrSubject, setRollOrSubject] = useState('');
  const [error, setError] = useState('');

  // Dashboard State
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams', 'create'
  const [selectedExam, setSelectedExam] = useState(null);
  const [previewExam, setPreviewExam] = useState(null); // Teacher Question Paper Preview
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Exam Form State
  const [examTitle, setExamTitle] = useState('Atomic Habits Midterm Examination');
  const [totalMarks, setTotalMarks] = useState(50);
  const [strictness, setStrictness] = useState('medium');
  const [numMcq, setNumMcq] = useState(3);
  const [numFill, setNumFill] = useState(2);
  const [numSub, setNumSub] = useState(2);
  const [uploadedPdfName, setUploadedPdfName] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (token) {
      fetchExams();
    }
  }, [token]);

  const fetchExams = async () => {
    try {
      const res = await API.get('/exams/');
      setExams(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackToExams = () => {
    setPreviewExam(null);
    setSelectedExam(null);
    setActiveTab('exams');
    fetchExams();
  };

  const handleViewPaper = async (examId) => {
    try {
      const res = await API.get(`/exams/${examId}`);
      setPreviewExam(res.data);
    } catch (err) {
      alert("Could not load exam details from database");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (authMode === 'login') {
        const res = await API.post('/auth/login', { email, password, role });
        localStorage.setItem('eval_token', res.data.access_token);
        localStorage.setItem('eval_role', res.data.role);
        setToken(res.data.access_token);
        setRole(res.data.role);
      } else {
        const endpoint = role === 'teacher' ? '/auth/register/teacher' : '/auth/register/student';
        const payload = role === 'teacher' 
          ? { name, email, password, subject: rollOrSubject }
          : { name, email, password, roll_number: rollOrSubject };
        
        await API.post(endpoint, payload);
        setAuthMode('login');
        alert('Account created! Please log in.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('eval_token');
    localStorage.removeItem('eval_role');
    setToken(null);
    setSelectedExam(null);
    setPreviewExam(null);
  };

  const handleGenerateExam = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-upload');
    if (!fileInput?.files[0]) {
      alert('Please select a PDF file first!');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('title', examTitle);
      formData.append('total_marks', totalMarks);
      formData.append('num_mcq', numMcq);
      formData.append('num_fill_blanks', numFill);
      formData.append('num_subjective', numSub);
      formData.append('strictness', strictness);
      formData.append('pdf_file', fileInput.files[0]);

      const res = await API.post('/exams/generate-ai', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('✨ Real exam paper auto-generated from your PDF using Gemini!');
      await fetchExams();
      setActiveTab('exams');
      setPreviewExam(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate exam');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExamSubmit = async () => {
    setIsSubmitting(true);
    try {
      await API.post('/submissions/', {
        exam_id: selectedExam.id,
        answers: answers
      });
      alert('🎉 Exam submitted successfully! AI evaluation recorded.');
      setSelectedExam(null);
      setAnswers({});
      fetchExams();
    } catch (err) {
      alert(err.response?.data?.detail || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Auth Screen
  // ----------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 text-white">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">EvalAI Portal</h1>
          </div>

          <div className="flex bg-slate-800/80 p-1.5 rounded-2xl mb-6 border border-slate-700/50">
            <button 
              onClick={() => setRole('teacher')}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${role === 'teacher' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Teacher
            </button>
            <button 
              onClick={() => setRole('student')}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${role === 'student' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Student
            </button>
          </div>

          {error && <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl">{error}</div>}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. Subhadeep Kumbhakar" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{role === 'teacher' ? 'Subject Specialization' : 'Roll Number'}</label>
                  <input required value={rollOrSubject} onChange={e => setRollOrSubject(e.target.value)} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder={role === 'teacher' ? 'Computer Science' : '24CS8065'} />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="kumbhakars669@gmail.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
              {authMode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-400 hover:underline font-semibold">
              {authMode === 'login' ? 'Register here' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Authenticated View
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">EvalAI</span>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {role}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <nav className="flex gap-2">
              <button 
                onClick={handleBackToExams}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition ${activeTab === 'exams' && !selectedExam && !previewExam ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Exams List
              </button>
              {role === 'teacher' && (
                <button 
                  onClick={() => { setSelectedExam(null); setPreviewExam(null); setActiveTab('create'); }} 
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-2 ${activeTab === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Sparkles className="w-4 h-4" /> AI Exam Builder
                </button>
              )}
            </nav>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-red-400 transition">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-8 text-white shadow-2xl mb-8 flex items-center justify-between border border-indigo-500/20">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-2">
              {role === 'teacher' ? 'AI Examination & Evaluation Studio' : 'Student Examination Hub'}
            </h2>
            <p className="text-indigo-100 text-sm max-w-xl">
              {role === 'teacher' 
                ? 'Upload syllabus PDFs, auto-synthesize structured questions with Gemini RAG, and review answer keys.' 
                : 'Attempt your assigned exams with automated AI scoring & personalized feedback.'}
            </p>
          </div>
          <Sparkles className="w-16 h-16 text-indigo-300/30 hidden md:block" />
        </div>

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: Teacher Question Paper Inspector             */}
        {/* ---------------------------------------------------- */}
        {previewExam && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
            <div className="flex justify-between items-center pb-6 border-b border-slate-800 mb-6">
              <div>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">
                  Question Paper Inspector
                </span>
                <h3 className="text-2xl font-bold text-white mt-2">{previewExam.title}</h3>
                <p className="text-xs text-slate-400 mt-1">Total Marks: {previewExam.total_marks} &nbsp;|&nbsp; Questions: {previewExam.questions?.length || 0}</p>
              </div>
              <button onClick={handleBackToExams} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 rounded-xl transition">
                &larr; Back to Exams
              </button>
            </div>

            <div className="space-y-6">
              {previewExam.questions?.map((q, idx) => (
                <div key={q.id || idx} className="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-slate-800 text-indigo-400 mr-3 border border-slate-700">
                        {q.question_type}
                      </span>
                      <span className="text-xs text-slate-400">Topic: {q.topic || 'General'}</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold whitespace-nowrap">
                      {q.marks} Marks
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base leading-relaxed">
                    Q{idx + 1}. {q.question_text}
                  </h4>

                  {q.question_type === 'mcq' && q.options?.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-sm text-slate-300">
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Model Answer Box */}
                  <div className="mt-3 p-4 bg-indigo-950/40 border border-indigo-900/40 rounded-xl text-xs text-indigo-200">
                    <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1">🔑 Model Answer Key:</span>
                    {q.correct_answer || 'Automated evaluation key'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 2: Teacher Exam Creation Studio                 */}
        {/* ---------------------------------------------------- */}
        {role === 'teacher' && activeTab === 'create' && !previewExam && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" /> AI Question Paper Generator
            </h3>

            <form onSubmit={handleGenerateExam} className="space-y-8">
              {/* PDF Upload */}
              <div className="p-6 bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl text-center">
                <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <h4 className="font-semibold text-white text-base mb-1">Upload Course Material / Textbook PDF</h4>
                <p className="text-xs text-slate-400 mb-4">PyMuPDF extracts text & Gemini 3.6 Flash auto-synthesizes the paper</p>
                <input 
                  type="file" 
                  accept=".pdf"
                  id="pdf-upload"
                  className="hidden"
                  onChange={e => setUploadedPdfName(e.target.files[0]?.name)}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-semibold rounded-xl inline-block transition">
                  {uploadedPdfName ? `📄 Selected: ${uploadedPdfName}` : 'Select PDF File'}
                </label>
              </div>

              {/* Configurations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exam Title</label>
                  <input value={examTitle} onChange={e => setExamTitle(e.target.value)} required className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Marks</label>
                  <input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} required className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              {/* Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
                  <span className="text-xs font-bold uppercase text-indigo-400 block mb-1">MCQ Questions</span>
                  <input type="number" min="0" value={numMcq} onChange={e => setNumMcq(Number(e.target.value))} className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
                  <span className="text-xs text-slate-400 block mt-2">2 Marks each</span>
                </div>
                <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
                  <span className="text-xs font-bold uppercase text-amber-400 block mb-1">Fill in the Blanks</span>
                  <input type="number" min="0" value={numFill} onChange={e => setNumFill(Number(e.target.value))} className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
                  <span className="text-xs text-slate-400 block mt-2">3 Marks each</span>
                </div>
                <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
                  <span className="text-xs font-bold uppercase text-purple-400 block mb-1">Subjective / Essay</span>
                  <input type="number" min="0" value={numSub} onChange={e => setNumSub(Number(e.target.value))} className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
                  <span className="text-xs text-slate-400 block mt-2">5 Marks each</span>
                </div>
              </div>

              {/* Strictness */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Grading Strictness</label>
                <div className="grid grid-cols-3 gap-4">
                  {['easy', 'medium', 'hard'].map(lvl => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setStrictness(lvl)}
                      className={`py-3 rounded-xl border text-sm font-semibold capitalize transition ${strictness === lvl ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-700 text-slate-400'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isGenerating} className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition flex items-center gap-2">
                  {isGenerating ? 'Gemini 3.6 Flash is synthesizing your paper...' : '🚀 Auto-Generate Exam Paper'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 3: Student Live Exam Taking                     */}
        {/* ---------------------------------------------------- */}
        {selectedExam && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
            <div className="flex justify-between items-center pb-6 border-b border-slate-800 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedExam.title}</h3>
                <p className="text-xs text-slate-400 mt-1">Total Marks: {selectedExam.total_marks} &nbsp;|&nbsp; Questions: {selectedExam.questions?.length || 0}</p>
              </div>
              <button onClick={handleBackToExams} className="text-sm font-medium text-slate-400 hover:text-white">
                Cancel
              </button>
            </div>

            <div className="space-y-6">
              {selectedExam.questions?.map((q, idx) => (
                <div key={q.id || idx} className="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-white text-base leading-relaxed">
                      Q{idx + 1}. {q.question_text}
                    </h4>
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold whitespace-nowrap">
                      {q.marks} Marks
                    </span>
                  </div>

                  {q.question_type === 'mcq' ? (
                    <div className="space-y-2.5 pt-2">
                      {q.options?.map((opt, oIdx) => (
                        <label key={oIdx} className="flex items-center gap-3.5 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/60 transition">
                          <input 
                            type="radio" 
                            name={`q_${q.id || idx}`} 
                            value={opt}
                            onChange={() => setAnswers({...answers, [q.id || idx]: opt})}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-300">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                      rows={4}
                      placeholder="Type your descriptive answer here..."
                      className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      onChange={e => setAnswers({...answers, [q.id || idx]: e.target.value})}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={handleExamSubmit}
                disabled={isSubmitting}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition"
              >
                {isSubmitting ? 'Evaluating with AI...' : 'Submit Final Answers'}
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 4: Available Exams Grid                         */}
        {/* ---------------------------------------------------- */}
        {!selectedExam && !previewExam && activeTab === 'exams' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Active Examinations</h3>
              {role === 'teacher' && (
                <button onClick={() => { setSelectedExam(null); setPreviewExam(null); setActiveTab('create'); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create New Exam
                </button>
              )}
            </div>

            {exams.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-400">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="font-semibold text-base text-slate-300">No exams available right now</p>
                <p className="text-xs text-slate-500 mt-1">{role === 'teacher' ? 'Click "AI Exam Builder" above to generate your first test paper!' : 'Check back when a teacher publishes an exam.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                        <span className="text-xs text-slate-500 font-medium">{exam.created_at?.slice(0, 10)}</span>
                      </div>
                      <h4 className="font-bold text-lg text-white mb-2">{exam.title}</h4>
                      <p className="text-xs text-slate-400 mb-4">{exam.questions?.length || 0} Questions Configured</p>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-300">{exam.total_marks} Marks</span>
                      {role === 'student' ? (
                        <button 
                          onClick={() => setSelectedExam(exam)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow"
                        >
                          Attempt Exam &rarr;
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleViewPaper(exam.id)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Paper
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}