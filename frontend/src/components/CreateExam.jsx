import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Check, X, ChevronLeft, ChevronRight, 
  Sparkles, Layers, Database, FileUp, FileSearch, Grid3x3, 
  RefreshCw, Pencil, Trash2, Loader2, AlertCircle, BookOpen 
} from 'lucide-react';
import API from '../api';
import { Button, Card, Badge, TypeBadge, useToast } from './ui';

const STEPS = ['Study Material', 'Paper Blueprint', 'AI Generation & Preview'];

export default function CreateExam({ onGenerated, onRefreshExams }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskStatus, setTaskStatus] = useState('');
  const [taskMessage, setTaskMessage] = useState('');
  const [createdExam, setCreatedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  const isGeneratingRef = useRef(false);
  const pollTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Stop polling helper that resets timers and guards
  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isGeneratingRef.current = false;
    if (isMountedRef.current) {
      setGenerating(false);
    }
  };

  // Cleanup polling when component unmounts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const [config, setConfig] = useState({
    title: 'Computer Science Midterm Examination',
    subject: 'Computer Science',
    topic: 'Data Structures & Algorithms',
    total_marks: 50,
    duration: 60,
    difficulty: 'medium',
    num_mcq: 3,
    num_fill_blanks: 2,
    num_subjective: 2,
  });

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!dropped) {
      toast.push('Please upload a valid PDF document', 'error');
      return;
    }
    setFile(dropped);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        toast.push('Only PDF files are supported', 'error');
        return;
      }
      setFile(selected);
    }
  };

  // Poll GET /tasks/{task_id} every 2.5 seconds until COMPLETED or FAILED
  const pollTask = async (taskId) => {
    if (!isMountedRef.current) return;

    try {
      const res = await API.get(`/tasks/${taskId}`);
      const data = res.data;

      if (!isMountedRef.current) return;

      const rawStatus = (data?.status || '').toUpperCase();
      const progress = typeof data?.progress === 'number' ? data.progress : 0;
      const message = data?.message || '';

      setTaskStatus(rawStatus || 'PROCESSING');
      setTaskProgress(progress);
      if (message) {
        setTaskMessage(message);
      }

      // 1. Task Completed Successfully
      if (rawStatus === 'COMPLETED') {
        stopPolling();
        toast.push('Paper Generated Successfully! ✨', 'success');

        // Refresh exam list after successful completion
        if (onRefreshExams) {
          try {
            onRefreshExams();
          } catch (e) {
            console.error('Error refreshing exams list:', e);
          }
        }

        // Fetch the generated exam and its questions from backend
        const examId = data?.result_metadata?.exam_id;
        if (examId) {
          try {
            const examRes = await API.get(`/exams/${examId}`);
            if (isMountedRef.current) {
              setCreatedExam(examRes.data);
              setQuestions(examRes.data.questions || []);
              setStep(2);
            }
            return;
          } catch (fetchErr) {
            console.error('Failed to fetch full generated exam details:', fetchErr);
          }
        }

        if (isMountedRef.current) {
          setCreatedExam(data?.result_metadata || null);
          setQuestions([]);
          setStep(2);
        }
        return;
      }

      // 2. Task Failed
      if (rawStatus === 'FAILED') {
        stopPolling();
        const errMsg = data?.error || data?.message || 'AI Paper generation failed. Please try again.';
        toast.push(errMsg, 'error');
        return;
      }

      // 3. Task Still PENDING / QUEUED / PROCESSING -> Poll again after 2.5s (no fixed timeout)
      pollTimerRef.current = setTimeout(() => {
        pollTask(taskId);
      }, 2500);

    } catch (err) {
      console.warn('Transient error polling exam task:', err);
      // On network error, retry polling after 3 seconds as long as still generating and mounted
      if (isMountedRef.current && isGeneratingRef.current) {
        pollTimerRef.current = setTimeout(() => {
          pollTask(taskId);
        }, 3000);
      }
    }
  };

  const handleGenerate = async () => {
    // Prevent duplicate clicks & redundant Celery jobs
    if (generating || isGeneratingRef.current) {
      return;
    }

    if (!file) {
      toast.push('Please upload a course material PDF before generating', 'error');
      setStep(0);
      return;
    }

    isGeneratingRef.current = true;
    setGenerating(true);
    setTaskProgress(5);
    setTaskStatus('PENDING');
    setTaskMessage('Uploading course material and dispatching AI synthesis task…');

    try {
      const formData = new FormData();
      formData.append('title', config.title);
      formData.append('total_marks', config.total_marks);
      formData.append('num_mcq', config.num_mcq);
      formData.append('num_fill_blanks', config.num_fill_blanks);
      formData.append('num_subjective', config.num_subjective);
      formData.append('strictness', config.difficulty);
      formData.append('pdf_file', file);

      // POST /exams/generate-ai returns 202 with task_id
      const res = await API.post('/exams/generate-ai', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const taskId = res.data?.task_id || res.data?.id || res.data?.celery_task_id;
      if (!taskId) {
        throw new Error(res.data?.detail || 'No task ID returned by server.');
      }

      setTaskMessage(res.data?.message || 'Task queued. Synthesizing questions with AI…');
      setTaskProgress(res.data?.progress || 10);

      // Start polling every 2-3 seconds
      pollTimerRef.current = setTimeout(() => {
        pollTask(taskId);
      }, 2000);

    } catch (err) {
      stopPolling();
      const msg = err.response?.data?.detail || err.message || 'AI Generation failed to start. Please check your PDF and try again.';
      toast.push(msg, 'error');
    }
  };

  const handleQuestionChange = (idx, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handlePublish = () => {
    toast.push('Exam published successfully! Students can now attempt it.', 'success');
    if (onGenerated) {
      onGenerated(createdExam);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div>
        <span className="text-xs uppercase tracking-widest text-[#969E99] font-medium font-sans">
          Examination Studio
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1C2421] mt-1">
          Create Examination Paper
        </h1>
        <p className="text-xs sm:text-sm text-[#616B66] mt-1">
          Upload course syllabus or lecture notes, configure blueprint weightages, and let AI synthesize rigorous questions with model answers.
        </p>
      </div>

      {/* Stepper Navigation */}
      <div className="flex items-center gap-3 border-b border-[#E7E4DC] pb-4">
        {STEPS.map((label, i) => {
          const active = step === i;
          const done = step > i;
          return (
            <button
              key={label}
              onClick={() => {
                if (!generating && done) setStep(i);
              }}
              disabled={generating || (!done && !active)}
              className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                active 
                  ? 'text-[#16382C] font-semibold' 
                  : done && !generating 
                  ? 'text-[#616B66] hover:text-[#1C2421] cursor-pointer' 
                  : 'text-[#969E99] cursor-not-allowed'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  active
                    ? 'bg-[#16382C] text-white'
                    : done
                    ? 'bg-[#E8EFE9] text-[#16382C]'
                    : 'bg-[#FAF8F5] border border-[#E7E4DC] text-[#969E99]'
                }`}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span>{label}</span>
              {i < STEPS.length - 1 && <span className="text-[#E7E4DC] ml-2">→</span>}
            </button>
          );
        })}
      </div>

      {/* STEP 0: Upload Course Material */}
      {step === 0 && (
        <div className="bg-white border border-[#E7E4DC] rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm">
          <div>
            <h2 className="font-serif text-2xl font-normal text-[#1C2421]">
              1. Upload Course Material
            </h2>
            <p className="text-xs text-[#616B66] mt-1 font-sans">
              Provide textbook chapters, lecture slides, or syllabus notes in PDF format.
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
              dragOver ? 'border-[#16382C] bg-[#E8EFE9]/40' : 'border-[#E7E4DC] bg-[#FAF8F5] hover:border-[#969E99]'
            }`}
            onClick={() => document.getElementById('pdf-file-input')?.click()}
          >
            <input
              type="file"
              id="pdf-file-input"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7E4DC] flex items-center justify-center mx-auto text-[#16382C] shadow-sm mb-4">
              <Upload size={22} />
            </div>
            <h3 className="font-serif text-lg text-[#1C2421] font-medium">
              {file ? file.name : 'Click to select or drop your course PDF here'}
            </h3>
            <p className="text-xs text-[#969E99] mt-1 font-sans">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready for AI extraction` : 'PDF files up to 25MB supported'}
            </p>
          </div>

          {file && (
            <div className="p-4 rounded-xl bg-[#E8EFE9] text-[#16382C] flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <span>Selected: <strong>{file.name}</strong></span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-[#F5F2EA] flex justify-end">
            <button
              onClick={() => {
                if (!file) {
                  toast.push('Please upload a PDF file first', 'error');
                  return;
                }
                setStep(1);
              }}
              className="bg-[#16382C] hover:bg-[#112E24] text-white px-6 py-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Next: Configure Blueprint</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Configure Blueprint */}
      {step === 1 && (
        <div className="bg-white border border-[#E7E4DC] rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm">
          <div>
            <h2 className="font-serif text-2xl font-normal text-[#1C2421]">
              2. Examination Blueprint
            </h2>
            <p className="text-xs text-[#616B66] mt-1 font-sans">
              Define the title, weightage distribution, and evaluation strictness for Gemini AI synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Exam Title
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Subject
              </label>
              <input
                type="text"
                value={config.subject}
                onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Multiple Choice (MCQ)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.num_mcq}
                onChange={(e) => setConfig({ ...config, num_mcq: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
              <span className="text-[11px] text-[#969E99]">2 marks each</span>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Fill in the Blanks
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.num_fill_blanks}
                onChange={(e) => setConfig({ ...config, num_fill_blanks: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
              <span className="text-[11px] text-[#969E99]">3 marks each</span>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Subjective Questions
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.num_subjective}
                onChange={(e) => setConfig({ ...config, num_subjective: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
              <span className="text-[11px] text-[#969E99]">5 marks each</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Evaluation Strictness
              </label>
              <select
                value={config.difficulty}
                onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              >
                <option value="easy">Easy (Generous partial credit)</option>
                <option value="medium">Medium (Standard academic rubric)</option>
                <option value="hard">Hard (Strict terminology & proofs)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#969E99] font-medium mb-1 font-sans">
                Total Marks Target
              </label>
              <input
                type="number"
                value={config.total_marks}
                onChange={(e) => setConfig({ ...config, total_marks: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E4DC] text-sm bg-[#FAF8F5] focus:bg-white focus:border-[#16382C] outline-none"
              />
            </div>
          </div>

          {/* Live AI Progress Card */}
          {generating && (
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E4DC] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#16382C] font-semibold">
                  <Loader2 size={14} className="animate-spin text-[#E05D38]" />
                  <span>Generating Paper…</span>
                </div>
                <span className="font-mono text-xs text-[#616B66] font-medium">{taskProgress}%</span>
              </div>
              <div className="w-full bg-[#E7E4DC] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#E05D38] h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(5, taskProgress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#616B66]">
                <span>{taskMessage || 'Synthesizing examination questions with AI…'}</span>
                <span className="text-[#969E99] italic">Celery task active</span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#F5F2EA] flex items-center justify-between">
            <button
              onClick={() => {
                if (!generating) setStep(0);
              }}
              disabled={generating}
              className="text-xs font-medium text-[#616B66] hover:text-[#1C2421] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back to Material
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[#E05D38] hover:bg-[#C94B27] text-white px-7 py-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Generating Paper…</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Paper</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Review & Publish Exam */}
      {step === 2 && (
        <div className="bg-white border border-[#E7E4DC] rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm">
          {/* Live Progress Card in Review step if regenerating */}
          {generating && (
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E4DC] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#16382C] font-semibold">
                  <Loader2 size={14} className="animate-spin text-[#E05D38]" />
                  <span>Generating Paper…</span>
                </div>
                <span className="font-mono text-xs text-[#616B66] font-medium">{taskProgress}%</span>
              </div>
              <div className="w-full bg-[#E7E4DC] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#E05D38] h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(5, taskProgress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#616B66]">
                <span>{taskMessage || 'Synthesizing examination questions with AI…'}</span>
                <span className="text-[#969E99] italic">Celery task active</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F5F2EA] pb-6">
            <div>
              <Badge tone="sage">{questions.length} Items Synthesized</Badge>
              <h2 className="font-serif text-2xl font-normal text-[#1C2421] mt-2">
                {createdExam?.title || config.title}
              </h2>
              <p className="text-xs text-[#616B66] mt-0.5">
                Review synthesized questions and model answer keys before publishing.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl border border-[#E7E4DC] text-xs font-semibold text-[#16382C] hover:bg-[#FAF8F5] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Generating Paper…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>Regenerate Paper</span>
                  </>
                )}
              </button>
              <button
                onClick={handlePublish}
                disabled={generating}
                className="bg-[#16382C] hover:bg-[#112E24] text-white px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={15} />
                <span>Publish Exam</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div 
                key={q.id || idx} 
                className="p-5 rounded-2xl border border-[#E7E4DC] bg-[#FAF8F5] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-[#16382C] text-sm">
                      Q{idx + 1}
                    </span>
                    <TypeBadge type={q.question_type} />
                    <Badge tone="outline">{q.marks || 2} marks</Badge>
                  </div>
                  <span className="text-xs text-[#969E99]">
                    Topic: {q.topic || 'General'}
                  </span>
                </div>

                <p className="font-serif text-base text-[#1C2421]">
                  {q.question_text}
                </p>

                {q.question_type === 'mcq' && q.options?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, j) => {
                      const isCorrect = String(opt).trim().startsWith(String(q.correct_answer).trim().slice(0, 1));
                      return (
                        <div
                          key={j}
                          className={`p-2.5 rounded-xl text-xs border ${
                            isCorrect 
                              ? 'bg-[#E8EFE9] border-emerald-300 text-[#16382C] font-semibold' 
                              : 'bg-white border-[#E7E4DC] text-[#616B66]'
                          }`}
                        >
                          {opt} {isCorrect && '✓'}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-[#E7E4DC] text-xs text-[#616B66] flex items-start gap-2">
                  <span className="font-semibold text-[#16382C]">Answer Key:</span>
                  <span className="flex-1 text-[#1C2421]">{q.correct_answer}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-[#F5F2EA] flex items-center justify-between">
            <button
              onClick={() => {
                if (!generating) setStep(1);
              }}
              disabled={generating}
              className="text-xs font-medium text-[#616B66] hover:text-[#1C2421] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back to Blueprint
            </button>
            <button
              onClick={handlePublish}
              disabled={generating}
              className="bg-[#16382C] hover:bg-[#112E24] text-white px-7 py-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              <span>Publish & Finish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}