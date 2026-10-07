import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Clock,
  CheckCircle2,
  Award,
  ShieldAlert,
  Eye,
  Check,
  Send
} from 'lucide-react';
import { Course, Exam, ExamAttempt, Question, UserAccount } from '../../types/lms';
import { store } from '../../services/storage';
import { useLanguage } from '../../i18n/LanguageContext';

interface ExamsViewProps {
  course: Course;
  currentUser: UserAccount;
  onNavigateToCertificates: () => void;
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  course,
  currentUser,
  onNavigateToCertificates
}) => {
  const { t, language } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [activeTakingExam, setActiveTakingExam] = useState<Exam | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);

  // Active exam state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(1800);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);

  useEffect(() => {
    const allExams = store.getExams().filter((e) => e.course_id === course.id);
    const allAttempts = store.getAttempts().filter(
      (a) => a.student_id === currentUser.id && a.course_id === course.id
    );
    setExams(allExams);
    setAttempts(allAttempts);
  }, [course.id, currentUser.id]);

  // Anti-cheat window blur listener during active test taking
  useEffect(() => {
    if (!activeTakingExam) return;

    const handleBlur = () => {
      const ev = {
        timestamp: new Date().toISOString(),
        type: 'window_blur',
        label_ar: language === 'ha'
          ? 'Fita daga tagar jarabawa zuwa wani shafin intanet ko manhaja'
          : language === 'en'
          ? 'Switched away from the exam tab to another application'
          : 'الخروج من نافذة الاختبار والانتقال لتطبيق أو تبويب آخر'
      };
      setSecurityEvents((prev) => [...prev, ev]);
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [activeTakingExam, language]);

  // Timer countdown
  useEffect(() => {
    if (!activeTakingExam) return;
    if (timeLeftSeconds <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTakingExam, timeLeftSeconds]);

  const startExam = (exam: Exam) => {
    setActiveTakingExam(exam);
    setTimeLeftSeconds(exam.duration_minutes * 60);
    setAnswers({});
    setSecurityEvents([
      {
        timestamp: new Date().toISOString(),
        type: 'tab_switch',
        label_ar: language === 'ha' ? 'An fara zaman jarabawa cikin aminci' : language === 'en' ? 'Exam session securely initiated' : 'بدء جلسة الاختبار المؤمّنة'
      }
    ]);
  };

  const handleFinalSubmit = () => {
    if (!activeTakingExam) return;
    const newAttempt = store.submitExam(
      activeTakingExam.id,
      course.id,
      answers,
      securityEvents
    );
    setActiveTakingExam(null);
    setAttempts((prev) => [...prev, newAttempt]);
    setReviewAttempt(newAttempt);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Render Taking Mode
  if (activeTakingExam) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-24">
        {/* Sticky Exam Taking Banner */}
        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-stone-200 shadow-md flex items-center justify-between gap-4">
          <div>
            <h3 className="font-arabic-heading text-base font-bold text-stone-900">
              {activeTakingExam.title_ar}
            </h3>
            <span className="text-xs text-stone-500 font-medium">
              {activeTakingExam.questions.length} {t.questionsCountSuffix} &bull; {t.passMarkLabel} {activeTakingExam.pass_mark}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold flex items-center gap-1.5 ${
              timeLeftSeconds < 300
                ? 'bg-rose-100 text-rose-800 animate-pulse'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>

            <button
              onClick={handleFinalSubmit}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              {t.submitAnswersBtn}
            </button>
          </div>
        </div>

        {/* Anti-cheat Alert Banner */}
        {securityEvents.length > 1 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{t.integrityWarning}</span>
          </div>
        )}

        {/* Question Cards */}
        <div className="space-y-5">
          {activeTakingExam.questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {q.format === 'mcq'
                      ? t.multipleChoiceLabel
                      : q.format === 'tf'
                      ? t.trueFalseLabel
                      : q.format === 'fill'
                      ? t.fillBlankLabel
                      : t.essayQuestionLabel}
                  </span>
                </div>
                <span className="text-xs text-stone-400 font-semibold">
                  {q.max_points} {t.pointsLabel}
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-bold text-stone-900 leading-relaxed font-arabic-heading">
                {q.prompt_ar}
              </h4>

              {/* Multiple Choice / True False Options */}
              {(q.format === 'mcq' || q.format === 'tf') && q.options && (
                <div className="space-y-2 pt-1">
                  {q.options.map((opt) => {
                    const isSelected = answers[q.id]?.selected?.[0] === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() =>
                          setAnswers({
                            ...answers,
                            [q.id]: { selected: [opt.id] }
                          })
                        }
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-50/80 font-bold text-emerald-950 shadow-2xs'
                            : 'border-stone-200/90 hover:bg-stone-50 text-stone-800'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                            isSelected
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs sm:text-sm">{opt.text_ar}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fill in the blank input */}
              {q.format === 'fill' && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={answers[q.id]?.text || ''}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [q.id]: { text: e.target.value }
                      })
                    }
                    placeholder={t.fillPlaceholder}
                    className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                </div>
              )}

              {/* Essay textarea */}
              {q.format === 'essay' && (
                <div className="space-y-2 pt-2">
                  {q.rubric_ar && (
                    <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl text-xs text-stone-600">
                      <span className="font-bold text-stone-800">{t.gradingCriteriaLabel} </span>
                      {q.rubric_ar}
                    </div>
                  )}
                  <textarea
                    rows={6}
                    value={answers[q.id]?.text || ''}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        [q.id]: { text: e.target.value }
                      })
                    }
                    placeholder={t.essayPlaceholder}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all leading-relaxed"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {t.confirmSubmissionNotice}
          </span>
          <button
            onClick={handleFinalSubmit}
            className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            {t.confirmSubmitExamBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Exams View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-arabic-heading text-2xl font-bold text-stone-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-emerald-800" />
            <span>{t.examsHubTitle}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {t.examsHubDesc}
          </p>
        </div>

        <button
          onClick={onNavigateToCertificates}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Award className="w-4 h-4 text-amber-300" />
          <span>{t.viewCertificatesBtn}</span>
        </button>
      </div>

      {/* Available Exams Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-stone-800 font-arabic-heading">
          {t.courseExamsTitle} ({course.name_ar})
        </h3>

        {exams.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-stone-200 text-center text-xs text-stone-500">
            {t.noExamsPublished}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => {
              const attempt = attempts.find((a) => a.exam_id === exam.id);
              const isPassed = attempt?.score_pct !== undefined && attempt.score_pct >= exam.pass_mark;

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-2xs hover:border-emerald-700/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {exam.questions.length} {t.questionsCountSuffix}
                      </span>
                      {attempt ? (
                        attempt.status === 'marked' ? (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isPassed
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {isPassed ? `${t.passedBadge} ` : `${t.failedBadge} `}
                            {attempt.score_pct}%
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                            {t.pendingMarkingBadge}
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-stone-400">
                          {t.availableToTakeBadge}
                        </span>
                      )}
                    </div>

                    <h4 className="font-arabic-heading text-base font-bold text-stone-900 mb-1">
                      {exam.title_ar}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        {t.examDurationLabel} {exam.duration_minutes} min
                      </span>
                      <span>&bull;</span>
                      <span>{t.passMarkLabel} {exam.pass_mark}%</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
                    {attempt ? (
                      <button
                        onClick={() => setReviewAttempt(attempt)}
                        className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4 text-emerald-800" />
                        <span>{t.reviewAnswersBtn}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => startExam(exam)}
                        className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span>{t.startExamNowBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal - FREE OF AWKWARD CODE TEXTS */}
      {reviewAttempt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-300 font-bold block">
                  {t.reviewModalTitle}
                </span>
                <h3 className="font-arabic-heading text-lg font-bold text-white mt-0.5">
                  {course.name_ar}
                </h3>
              </div>
              <button
                onClick={() => setReviewAttempt(null)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {t.closeReviewBtn}
              </button>
            </div>

            {/* Score Summary Box */}
            <div className="p-5 bg-stone-50 border-b border-stone-200/80 flex items-center justify-between">
              <div>
                <div className="text-xs text-stone-500 font-semibold">
                  {t.studentNamePrefix} {reviewAttempt.student_name_ar}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {t.studentResultStatus}{' '}
                  {reviewAttempt.status === 'marked' ? (
                    <span className="text-emerald-800 font-bold">{t.markedAndCertified}</span>
                  ) : (
                    <span className="text-amber-800 font-bold">{t.waitingTeacherGrade}</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-arabic-heading text-emerald-900">
                  {reviewAttempt.total_points ?? reviewAttempt.score_pct ?? 0} /{' '}
                  {reviewAttempt.max_points ?? 100}
                </div>
                <div className="text-[11px] text-stone-400">{t.totalEarnedScore}</div>
              </div>
            </div>

            {/* Questions Detailed Human-Readable Review List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {Object.entries(reviewAttempt.responses).map(([qId, ans], idx) => {
                const grade = reviewAttempt.grades[qId];
                const exam = exams.find((e) => e.id === reviewAttempt.exam_id);
                const question = exam?.questions.find((q) => q.id === qId);

                let formattedAnswer = language === 'ha' ? 'Ba a bayar da amsa ba' : language === 'en' ? 'No answer submitted' : 'لا توجد إجابة مسجلة';
                if (ans?.selected && ans.selected[0]) {
                  const opt = question?.options?.find((o) => o.id === ans.selected[0]);
                  formattedAnswer = opt?.text_ar || ans.selected[0];
                } else if (ans?.text) {
                  formattedAnswer = ans.text;
                }

                return (
                  <div
                    key={qId}
                    className="p-4 rounded-2xl border border-stone-200 bg-white space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800">
                        Tambaya {idx + 1}: {question?.prompt_ar}
                      </span>
                      {grade && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                          {grade.points} / {question?.max_points || 20} {t.pointsLabel}
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs">
                      <span className="font-bold text-stone-600 block mb-1">
                        {t.studentAnswerLabel}
                      </span>
                      <p className="text-stone-800 leading-relaxed font-serif whitespace-pre-line">
                        {formattedAnswer}
                      </p>
                    </div>

                    {grade?.feedback && (
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950">
                        <span className="font-bold block mb-0.5">
                          {t.teacherFeedbackLabel} ({grade.marked_by_name_ar || 'Instructor'}):
                        </span>
                        <p>{grade.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Security Events in Human Readable Form */}
              {reviewAttempt.security_events?.length > 0 && (
                <div className="pt-3 border-t border-stone-100">
                  <span className="text-xs font-bold text-stone-500 block mb-2">
                    {t.integrityActivityLog}
                  </span>
                  <div className="space-y-1">
                    {reviewAttempt.security_events.map((ev, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-stone-600 flex items-center gap-2 bg-stone-50 p-2 rounded-lg"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-stone-400" />
                        <span>{ev.label_ar}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
