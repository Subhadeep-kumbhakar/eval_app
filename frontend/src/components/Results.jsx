import React, { useMemo, useState } from 'react';
import { Download, Sparkles, ClipboardCheck, AlertCircle, CheckCircle, XCircle, Clock, User, Award } from 'lucide-react';
import { Card, Badge, Button, TypeBadge, EmptyState, SectionTitle } from './ui';
import { Donut } from './charts';

export default function Results({ exams, submissions, role }) {
  const [selected, setSelected] = useState(null);
  const subList = submissions || [];

  const grouped = useMemo(() => {
    const map = {};
    (exams || []).forEach((e) => { 
      map[String(e.id)] = { exam: e, subs: [] }; 
    });
    subList.forEach((s) => {
      const key = String(s.exam_id);
      if (map[key]) {
        map[key].subs.push(s);
      } else {
        map[key] = {
          exam: { id: s.exam_id, title: `Examination #${s.exam_id}`, total_marks: 50, questions: [] },
          subs: [s],
        };
      }
    });
    return map;
  }, [exams, subList]);

  const current = selected || (subList.length ? subList[0] : null);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#969E99] font-medium font-sans">
            Semantic Assessment
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1C2421] mt-1">
            {role === 'teacher' ? 'Evaluation Reports & Submissions' : 'Your Assessment Results'}
          </h1>
          <p className="text-xs sm:text-sm text-[#616B66] mt-1 font-sans">
            {role === 'teacher' 
              ? 'Review AI-evaluated student answer scripts, rubric scores, and semantic feedback.' 
              : 'Detailed score breakdown, itemized rubrics, and personalized AI guidance.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} icon={Download}>
            Print Report
          </Button>
        </div>
      </div>

      {subList.length === 0 ? (
        <Card>
          <EmptyState 
            icon={ClipboardCheck} 
            title="No submissions found" 
            description={role === 'student' ? 'Complete an exam to see your AI-evaluated results here.' : 'Student submissions will appear here once they complete assigned exams.'} 
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Submissions List Sidebar */}
          <div className="bg-white border border-[#E7E4DC] rounded-3xl p-5 shadow-xs">
            <div className="px-2 pt-1 pb-3 text-xs uppercase tracking-wider text-[#969E99] font-bold font-sans border-b border-[#F5F2EA] flex items-center justify-between">
              <span>Submissions List</span>
              <span className="font-mono text-[11px] text-[#16382C]">{subList.length} items</span>
            </div>
            <div className="mt-3 space-y-1.5 overflow-y-auto max-h-[620px]">
              {subList.map((s, i) => {
                const isCurrent = current?.id === s.id;
                const exam = grouped[String(s.exam_id)]?.exam;
                return (
                  <button 
                    key={s.id || i} 
                    onClick={() => setSelected(s)} 
                    className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                      isCurrent 
                        ? 'bg-[#E8EFE9] border-emerald-300 text-[#16382C] font-semibold shadow-xs' 
                        : 'bg-[#FAF8F5] border-[#E7E4DC] hover:bg-white text-[#616B66]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#1C2421] truncate">
                      {exam?.title || `Exam #${s.exam_id}`}
                    </div>
                    <div className="text-[11px] text-[#969E99] mt-1 flex items-center justify-between font-sans">
                      <span>{s.student?.name || (role === 'teacher' ? 'Student' : 'You')}</span>
                      <span className="font-mono font-bold text-[#16382C]">{s.total_score} pts</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submission Detail View */}
          <div className="xl:col-span-2 space-y-6">
            {current ? (
              <ResultDetail 
                sub={current} 
                exam={grouped[String(current.exam_id)]?.exam} 
                role={role}
              />
            ) : (
              <Card><EmptyState icon={AlertCircle} title="Select a submission" /></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultDetail({ sub, exam, role }) {
  const total = exam?.total_marks || 50;
  const score = Number(sub.total_score || 0);
  const pct = total > 0 ? Math.min(100, Math.round((score / total) * 100)) : 0;
  const grade = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 50 ? 'C' : 'D';

  const evals = sub.evaluations || {};
  const questions = exam?.questions || [];

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white border border-[#E7E4DC] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
        <div className="relative shrink-0">
          <Donut
            segments={[
              { value: pct, color: pct >= 70 ? '#16382C' : pct >= 45 ? '#E05D38' : '#DC2626' },
              { value: 100 - pct, color: '#FAF8F5' }
            ]}
            size={120}
            centerLabel={`${score}/${total}`}
            centerSub={`${pct}%`}
          />
        </div>

        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#969E99] font-bold">
              {sub.status === 'evaluated' ? 'Evaluated by AI' : 'Submitted'}
            </span>
            <span className="text-xs text-[#969E99]">
              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Recent'}
            </span>
          </div>

          <h2 className="font-serif text-2xl font-normal text-[#1C2421]">
            {exam?.title || 'Examination'}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <ScoreTile label="Total Score" value={`${score} / ${total}`} tone="#16382C" />
            <ScoreTile label="Percentage" value={`${pct}%`} tone="#16382C" />
            <ScoreTile label="Performance Grade" value={grade} tone="#E05D38" />
            <ScoreTile label="Student" value={sub.student?.name || 'Enrolled'} tone="#616B66" />
          </div>
        </div>
      </div>

      {/* Question-Wise Evaluation Breakdown */}
      <div className="bg-white border border-[#E7E4DC] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#969E99] font-medium font-sans">
            Item Analysis
          </span>
          <h3 className="font-serif text-2xl font-normal text-[#1C2421] mt-0.5">
            Question-Wise Evaluation & Feedback
          </h3>
          <p className="text-xs text-[#616B66] mt-0.5">
            Detailed rubric breakdown, marks awarded, and semantic critique for each item.
          </p>
        </div>

        <div className="space-y-4">
          {questions.length === 0 && Object.keys(evals).length === 0 ? (
            <div className="text-center py-8 text-xs text-[#969E99]">
              No question breakdown available for this paper.
            </div>
          ) : (
            (questions.length > 0 ? questions : Object.values(evals)).map((item, idx) => {
              const qId = item.id || item.question_id || idx + 1;
              const ev = evals[String(qId)] || evals[qId] || evals[String(item.question_number)] || {};
              const marksAwarded = ev.marks_awarded != null ? ev.marks_awarded : 0;
              const maxMarks = ev.max_marks || item.marks || 2;
              const isFull = marksAwarded >= maxMarks;
              const isPartial = marksAwarded > 0 && marksAwarded < maxMarks;

              return (
                <div 
                  key={qId} 
                  className="p-5 rounded-2xl border border-[#E7E4DC] bg-[#FAF8F5] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-[#16382C] text-sm">
                        Q{item.question_number || idx + 1}
                      </span>
                      <TypeBadge type={item.question_type || ev.question_type} />
                    </div>
                    <Badge tone={isFull ? 'sage' : isPartial ? 'terracotta' : 'neutral'}>
                      {marksAwarded} / {maxMarks} marks
                    </Badge>
                  </div>

                  <p className="font-serif text-base text-[#1C2421]">
                    {item.question_text || ev.question_text}
                  </p>

                  {/* Student Answer */}
                  <div className="p-3 rounded-xl bg-white border border-[#E7E4DC] text-xs space-y-1">
                    <div className="text-[#969E99] font-medium">Student Answer:</div>
                    <div className="font-mono text-[#1C2421]">
                      {ev.student_answer || sub.answers?.[String(qId)] || sub.answers?.[qId] || '<No response provided>'}
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className="p-3.5 rounded-xl bg-[#E8EFE9]/60 border border-emerald-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[#16382C] font-semibold">
                      <Sparkles size={14} />
                      <span>AI Semantic Evaluation Feedback</span>
                    </div>
                    <p className="text-[#16382C] leading-relaxed">
                      {ev.feedback || (isFull ? 'Correct response matching model answer key.' : 'Evaluation completed.')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreTile({ label, value, tone }) {
  return (
    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E4DC] text-center">
      <div className="font-serif text-lg font-bold truncate" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[#969E99] mt-0.5 font-sans">
        {label}
      </div>
    </div>
  );
}