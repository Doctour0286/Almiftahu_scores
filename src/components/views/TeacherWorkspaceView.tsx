import React, { useState } from 'react';
import {
  GraduationCap,
  Clock,
  Edit3,
  BookOpen,
  Check,
  Send,
  Mic,
  Award,
  Search,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Filter,
  Database,
  RefreshCw
} from 'lucide-react';
import { Course, ExamAttempt, UserAccount, AudioSubmission, GradebookRow } from '../../types/lms';
import { store } from '../../services/storage';
import { useLanguage } from '../../i18n/LanguageContext';

interface TeacherWorkspaceViewProps {
  currentUser: UserAccount;
  courses: Course[];
  onCourseSelect: (id: string) => void;
}

export const TeacherWorkspaceView: React.FC<TeacherWorkspaceViewProps> = ({
  currentUser,
  courses,
  onCourseSelect
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'marking' | 'audio' | 'gradebook'>('audio');

  // Exam Essay attempts
  const [attempts, setAttempts] = useState<ExamAttempt[]>(store.getAttempts());
  const exams = store.getExams();
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
  const [inputGrades, setInputGrades] = useState<
    Record<string, { points: number; feedback: string }>
  >({});

  // Audio Submissions state
  const [audioSubs, setAudioSubs] = useState<AudioSubmission[]>(() => store.getAudioSubmissions());
  const [selectedAudioSub, setSelectedAudioSub] = useState<AudioSubmission | null>(null);
  const [audioScoreInput, setAudioScoreInput] = useState<number>(18);
  const [audioFeedbackInput, setAudioFeedbackInput] = useState<string>('');
  const [audioFilterStatus, setAudioFilterStatus] = useState<string>('all');

  // Gradebook state
  const [gradebookCourseId, setGradebookCourseId] = useState<string>(courses[0]?.id || 'e7e08a6f-2d32-4d45-8720-c1f98e58563b');
  const [gradebookSearch, setGradebookSearch] = useState<string>('');

  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Filter assigned courses for this teacher
  const assigned = courses.filter((c) => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.assigned_courses?.includes('ALL')) return true;
    return currentUser.assigned_courses?.includes(c.code) || currentUser.assigned_courses?.includes(c.id);
  });

  const pendingAttempts = attempts.filter((a) => a.status === 'needs_marking');
  const pendingAudio = audioSubs.filter((s) => s.status === 'pending');

  const openGradingModal = (attempt: ExamAttempt) => {
    setSelectedAttempt(attempt);
    const initial: Record<string, { points: number; feedback: string }> = {};
    const exam = exams.find((e) => e.id === attempt.exam_id);

    exam?.questions.forEach((q) => {
      initial[q.id] = {
        points: attempt.grades[q.id]?.points ?? (q.format === 'essay' ? 30 : 20),
        feedback:
          attempt.grades[q.id]?.feedback ||
          (language === 'ha'
            ? 'Kyakkyawar amsa kuma an fahimci darasi.'
            : language === 'en'
            ? 'Well articulated response.'
            : 'إجابة طيبة وموفقة.')
      };
    });

    setInputGrades(initial);
    setSuccessFeedback(null);
  };

  const handleSaveGrades = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttempt) return;

    store.gradeStudentSubmission(
      selectedAttempt.id,
      inputGrades,
      currentUser.name_ar || currentUser.name
    );

    const updated = store.getAttempts();
    setAttempts(updated);
    setSuccessFeedback(
      language === 'ha'
        ? 'An tabbatar da makin dalibi tare da sa hannunka cikin nasara!'
        : language === 'en'
        ? 'Grades officially certified and credited to the student!'
        : 'تم اعتماد وحفظ الدرجات بنجاح، وتحديث درجات وسجل الطالب!'
    );

    setTimeout(() => {
      setSelectedAttempt(null);
      setSuccessFeedback(null);
    }, 1200);
  };

  // Audio grading actions
  const openAudioGradingModal = (sub: AudioSubmission) => {
    setSelectedAudioSub(sub);
    setAudioScoreInput(sub.score ?? 18);
    setAudioFeedbackInput(
      sub.teacher_feedback ||
        (language === 'ha'
          ? 'Masha Allah! Karatun yana da kyau kuma an kiyaye haruffa.'
          : language === 'en'
          ? 'Excellent recitation with clear articulation and tajweed.'
          : 'ما شاء الله تلاوة طيبة مع مراعاة أحكام التجويد والضبط.')
    );
  };

  const handleGradeAudio = (approved: boolean) => {
    if (!selectedAudioSub) return;

    store.gradeAudioSubmission(selectedAudioSub.id, {
      approved,
      score: approved ? audioScoreInput : 0,
      feedback: audioFeedbackInput,
      teacherName: currentUser.name_ar || currentUser.name
    });

    const updated = store.getAudioSubmissions();
    setAudioSubs(updated);
    setSelectedAudioSub(null);
  };

  // Gradebook rows
  const gradebookRows: GradebookRow[] = store.getGradebookRows(gradebookCourseId);
  const filteredGradebook = gradebookRows.filter((r) => {
    if (!gradebookSearch) return true;
    const q = gradebookSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.name_ar.includes(q) ||
      String(r.sn).includes(q)
    );
  });

  const topStudents = [...gradebookRows].sort((a, b) => b.total_score - a.total_score).slice(0, 3);

  const handleExportCsv = () => {
    const headers = ['S/N', 'Student Name', 'Completed Lessons', 'Quiz Score', 'Audio Score', 'Exam Score', 'Total Score', 'Rank', 'Status'];
    const rows = filteredGradebook.map((r) => [
      r.sn,
      r.name,
      `${r.completed_lessons_count}/${r.total_lessons_count}`,
      r.quizzes_score,
      r.audio_score,
      r.exam_score,
      r.total_score,
      r.rank,
      r.passed ? 'PASSED' : 'NEEDS_REVIEW'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gradebook_${gradebookCourseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAudioList = audioSubs.filter((s) => {
    if (audioFilterStatus === 'all') return true;
    return s.status === audioFilterStatus;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-xl shadow-xs">
              <GraduationCap className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                {t.teacherWorkspaceTitle}
              </span>
              <h2 className="font-arabic-heading text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
                {t.teacherWelcomeGreeting}, {currentUser.name_ar || currentUser.name}
              </h2>
              <p className="text-xs text-stone-500">
                {currentUser.title_ar || 'Instructor'} &bull; {t.teacherWorkspaceSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>
                {pendingAttempts.length} {t.pendingMarkingCountText}
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-700" />
              <span>
                {pendingAudio.length} {language === 'ha' ? 'Hadda na Jiran Sauraro' : language === 'en' ? 'Audio Pending' : 'تسميع في الانتظار'}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Tab Switcher */}
        <div className="flex items-center gap-2 pt-6 mt-6 border-t border-stone-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('marking')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'marking'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{t.tabExamMarking}</span>
            {pendingAttempts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center text-[10px] font-mono">
                {pendingAttempts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audio'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{t.tabAudioGrading}</span>
            {pendingAudio.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center text-[10px] font-mono">
                {pendingAudio.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'gradebook'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{t.tabGradebook}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXAM ESSAY MARKING QUEUE */}
      {/* ============================================================== */}
      {activeTab === 'marking' && (
        <div className="space-y-6">
          {/* Assigned Courses Grid */}
          <div className="space-y-3">
            <h3 className="font-arabic-heading text-base font-bold text-stone-900">
              {t.assignedCoursesTitle} ({assigned.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assigned.map((course) => (
                <div
                  key={course.id}
                  className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-2xs hover:border-emerald-700/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                        {course.code}
                      </span>
                      <span className="text-xs text-stone-400">
                        {course.units.length} {t.unitsCount}
                      </span>
                    </div>

                    <h4 className="font-arabic-heading text-base font-bold text-stone-900">
                      {course.name_ar}
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      {course.description_ar}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                    <button
                      onClick={() => onCourseSelect(course.id)}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t.openClassroomLectureBtn}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Marking Queue Section */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-arabic-heading text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-800" />
                  <span>{t.markingQueueTitle}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">{t.markingQueueDesc}</p>
              </div>

              <span className="text-xs font-bold text-stone-400">{pendingAttempts.length}</span>
            </div>

            {pendingAttempts.length === 0 ? (
              <div className="p-8 bg-stone-50 rounded-2xl border border-stone-100 text-center text-xs text-stone-500">
                {t.noPendingGrading}
              </div>
            ) : (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
                {pendingAttempts.map((att) => {
                  const exam = exams.find((e) => e.id === att.exam_id);
                  return (
                    <div
                      key={att.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50 transition-colors bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {att.student_name_ar.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900">
                              {att.student_name_ar}
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                              {t.needsEssayMarkingBadge}
                            </span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5 font-arabic-heading">
                            {exam?.title_ar || 'Unit Exam'}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-1 font-mono">
                            {new Date(att.started_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openGradingModal(att)}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t.startGradingBtn}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: AUDIO MEMORIZATION RECITATION REVIEW */}
      {/* ============================================================== */}
      {activeTab === 'audio' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-arabic-heading text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-emerald-800" />
                  <span>{t.tabAudioGrading}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {language === 'ha'
                    ? 'Saurari karatun hadda na dalibai tare da amincewa ko bukatarsu su sake cikin sauki.'
                    : language === 'en'
                    ? 'Listen to student voice recitations, score approved attempts or request repeats.'
                    : 'الاستماع لتسميع الطلاب الصوتي واعتماده بالدرجة أو طلب الإعادة.'}
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl self-start sm:self-auto overflow-x-auto">
                <button
                  onClick={() => setAudioFilterStatus('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    audioFilterStatus === 'all'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {t.allStatusFilter} ({audioSubs.length})
                </button>
                <button
                  onClick={() => setAudioFilterStatus('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    audioFilterStatus === 'pending'
                      ? 'bg-amber-100 text-amber-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {t.pendingStatusFilter} ({pendingAudio.length})
                </button>
                <button
                  onClick={() => setAudioFilterStatus('approved')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    audioFilterStatus === 'approved'
                      ? 'bg-emerald-100 text-emerald-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {t.approvedStatusFilter}
                </button>
                <button
                  onClick={() => setAudioFilterStatus('rejected')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    audioFilterStatus === 'rejected'
                      ? 'bg-rose-100 text-rose-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {t.rejectedStatusFilter}
                </button>
              </div>
            </div>

            {filteredAudioList.length === 0 ? (
              <div className="p-8 bg-stone-50 rounded-2xl border border-stone-100 text-center text-xs text-stone-500">
                {t.noAudioSubmissions}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAudioList.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-emerald-700/50 shadow-2xs space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-xs">
                            {sub.student_name_ar || sub.student_name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sub.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sub.status === 'approved'
                              ? t.approvedStatusFilter
                              : sub.status === 'rejected'
                              ? t.rejectedStatusFilter
                              : t.pendingStatusFilter}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 font-arabic-heading line-clamp-1">
                          {sub.lesson_title_ar}
                        </p>
                      </div>

                      {sub.score !== undefined && sub.status === 'approved' && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg font-mono">
                          {sub.score}/{sub.max_score}
                        </span>
                      )}
                    </div>

                    {/* Inbuilt Audio Player */}
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                      <audio controls src={sub.audio_data_url} className="w-full h-8" />
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1 font-mono">
                        <span>{sub.duration_seconds}s</span>
                        <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {sub.teacher_feedback && (
                      <p className="text-xs text-stone-600 italic bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        "{sub.teacher_feedback}"
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => openAudioGradingModal(sub)}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>
                          {sub.status === 'pending'
                            ? language === 'ha'
                              ? 'Tantance & Saka Maki'
                              : language === 'en'
                              ? 'Evaluate & Score'
                              : 'تقييم ورصد'
                            : language === 'ha'
                            ? 'Sake Tantancewa'
                            : language === 'en'
                            ? 'Edit Grade'
                            : 'تعديل التقييم'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: LEGACY GRADEBOOK & LEADERBOARD (FULL SHEET) */}
      {/* ============================================================== */}
      {activeTab === 'gradebook' && (
        <div className="space-y-6">
          {/* Top Leaderboard Honor Roll Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-stone-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-md">
                  <Trophy className="w-7 h-7 text-stone-950" />
                </div>
                <div>
                  <h3 className="font-arabic-heading text-lg font-bold text-amber-200">
                    {t.topRankStudentsTitle}
                  </h3>
                  <p className="text-xs text-stone-300">
                    {language === 'ha'
                      ? 'Zakaran dalibai da suka fi kowa maki a wannan manhaja'
                      : language === 'en'
                      ? 'Leading students ranked by comprehensive exam, quiz, and recitation scores'
                      : 'لوحة الشرف لأعلى الطلاب تحصيلاً وتفوقاً في المقرر'}
                  </p>
                </div>
              </div>

              {/* Course Selector for Gradebook */}
              <div className="bg-white/10 backdrop-blur-xs p-1.5 rounded-2xl border border-white/20 self-start sm:self-auto">
                <select
                  value={gradebookCourseId}
                  onChange={(e) => setGradebookCourseId(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs px-2 py-1 outline-hidden cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} className="text-stone-900 font-bold">
                      {c.name_ar} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {topStudents.map((st, i) => (
                <div
                  key={st.student_id}
                  className={`p-4 rounded-2xl border flex items-center gap-3 ${
                    i === 0
                      ? 'bg-amber-500/20 border-amber-400/50'
                      : i === 1
                      ? 'bg-stone-300/20 border-stone-300/40'
                      : 'bg-amber-700/20 border-amber-600/40'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base font-mono shrink-0 shadow-md ${
                      i === 0
                        ? 'bg-amber-400 text-stone-950'
                        : i === 1
                        ? 'bg-stone-200 text-stone-900'
                        : 'bg-amber-700 text-amber-100'
                    }`}
                  >
                    #{st.rank}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate font-arabic-heading">
                      {st.name_ar}
                    </div>
                    <div className="text-[11px] text-stone-300 font-mono mt-0.5">
                      {st.total_score}% &bull; S/N: {st.sn}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Sheet Table Container */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={t.gradebookSearchPlaceholder}
                  value={gradebookSearch}
                  onChange={(e) => setGradebookSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={async () => {
                    await store.syncWithSupabase();
                    setAudioSubs(store.getAudioSubmissions());
                  }}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Sake Karanta Bayanai Daga Supabase DB"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Sabunta DB</span>
                </button>
                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-800" />
                  <span>{t.exportGradebookCsv}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4 text-stone-600" />
                  <span>{t.printGradebook}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 text-center">{t.colRank}</th>
                    <th className="py-3 px-4">{t.colSn}</th>
                    <th className="py-3 px-4">{t.colStudent}</th>
                    <th className="py-3 px-4 text-center">{t.colLessons}</th>
                    <th className="py-3 px-4 text-center">{t.colQuizzes}</th>
                    <th className="py-3 px-4 text-center">{t.colAudio}</th>
                    <th className="py-3 px-4 text-center">{t.colExam}</th>
                    <th className="py-3 px-4 text-center font-bold text-stone-900">
                      {t.colTotalScore}
                    </th>
                    <th className="py-3 px-4 text-center">{t.colStatus}</th>
                    <th className="py-3 px-4 text-center">{t.colCert}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredGradebook.map((row) => (
                    <tr key={row.student_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {row.rank <= 3 ? (
                          <span
                            className={`inline-block w-6 h-6 rounded-full text-center leading-6 text-xs font-bold ${
                              row.rank === 1
                                ? 'bg-amber-400 text-stone-950'
                                : row.rank === 2
                                ? 'bg-stone-300 text-stone-900'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            {row.rank}
                          </span>
                        ) : (
                          `#${row.rank}`
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500">{row.sn}</td>
                      <td className="py-3 px-4 font-bold text-stone-900 font-arabic-heading">
                        {row.name_ar}
                        <span className="block text-[11px] font-normal text-stone-400 font-sans">
                          {row.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {row.completed_lessons_count}/{row.total_lessons_count}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{row.quizzes_score}</td>
                      <td className="py-3 px-4 text-center font-mono">{row.audio_score}</td>
                      <td className="py-3 px-4 text-center font-mono">{row.exam_score}%</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-800 text-sm">
                        {row.total_score}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.passed ? t.passedStatus : t.failedStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.has_certificate ? (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{language === 'ha' ? 'Akwai' : language === 'en' ? 'Issued' : 'صادرة'}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: EXAM ESSAY GRADING MODAL */}
      {/* ============================================================== */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-300 font-bold block">
                  {t.gradingModalTitle}
                </span>
                <h3 className="font-arabic-heading text-lg font-bold text-white mt-0.5">
                  {t.studentNamePrefix} {selectedAttempt.student_name_ar}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAttempt(null)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {t.cancelBtn}
              </button>
            </div>

            <form onSubmit={handleSaveGrades} className="p-6 overflow-y-auto flex-1 space-y-5">
              {successFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4" /> {successFeedback}
                </div>
              )}

              {Object.entries(selectedAttempt.responses).map(([qId, ans], idx) => {
                const exam = exams.find((e) => e.id === selectedAttempt.exam_id);
                const question = exam?.questions.find((q) => q.id === qId);

                let formattedAnswer = 'Babu amsa';
                if (ans?.selected && ans.selected[0]) {
                  const opt = question?.options?.find((o) => o.id === ans.selected[0]);
                  formattedAnswer = opt?.text_ar || ans.selected[0];
                } else if (ans?.text) {
                  formattedAnswer = ans.text;
                }

                return (
                  <div
                    key={qId}
                    className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-stone-900 font-arabic-heading">
                        Tambaya {idx + 1}: {question?.prompt_ar}
                      </span>
                      <span className="text-xs text-stone-500 font-semibold shrink-0">
                        Max: {question?.max_points || 20} {t.pointsLabel}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-stone-200 rounded-xl text-xs">
                      <span className="font-semibold text-stone-500 block mb-1">
                        {t.studentAnswerLabel}
                      </span>
                      <p className="text-stone-800 leading-relaxed font-serif whitespace-pre-line">
                        {formattedAnswer}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {t.awardedScoreLabel} (/{question?.max_points || 20}):
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={question?.max_points || 100}
                          value={inputGrades[qId]?.points ?? 0}
                          onChange={(e) =>
                            setInputGrades({
                              ...inputGrades,
                              [qId]: {
                                ...inputGrades[qId],
                                points: Number(e.target.value)
                              }
                            })
                          }
                          className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-emerald-950 focus:border-emerald-700 outline-hidden"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {t.teacherFeedbackInputLabel}
                        </label>
                        <input
                          type="text"
                          value={inputGrades[qId]?.feedback ?? ''}
                          onChange={(e) =>
                            setInputGrades({
                              ...inputGrades,
                              [qId]: {
                                ...inputGrades[qId],
                                feedback: e.target.value
                              }
                            })
                          }
                          placeholder={t.teacherFeedbackPlaceholder}
                          className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs focus:border-emerald-700 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                <span className="text-xs text-stone-500">
                  {t.teacherSignatureStampPrefix}{' '}
                  <strong>{currentUser.name_ar || currentUser.name}</strong>
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{t.signAndIssueBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: AUDIO RECITATION EVALUATION MODAL */}
      {/* ============================================================== */}
      {selectedAudioSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-300 font-bold block">
                  {t.gradeAudioModalTitle}
                </span>
                <h3 className="font-arabic-heading text-lg font-bold text-white mt-0.5">
                  {selectedAudioSub.student_name_ar || selectedAudioSub.student_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAudioSub(null)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {t.cancelBtn}
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <span className="text-[11px] text-stone-400 block font-mono">
                  {selectedAudioSub.lesson_title_ar}
                </span>
                <p className="text-xs text-stone-600 mt-1">
                  {language === 'ha'
                    ? 'Saurari sautin karatun da dalibi ya aiko:'
                    : language === 'en'
                    ? 'Play student recitation recording:'
                    : 'استمع للتسجيل الصوتي المرسل:'}
                </p>
              </div>

              {/* Audio playback in modal */}
              <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200">
                <audio controls src={selectedAudioSub.audio_data_url} className="w-full" />
              </div>

              {/* Score Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.awardedScoreLabel} (/{selectedAudioSub.max_score}):
                </label>
                <input
                  type="number"
                  min={0}
                  max={selectedAudioSub.max_score}
                  value={audioScoreInput}
                  onChange={(e) => setAudioScoreInput(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-emerald-950 focus:border-emerald-700 outline-hidden font-mono"
                />
              </div>

              {/* Feedback Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.audioTeacherFeedback} (Maganar Gyara / Yabo):
                </label>
                <textarea
                  rows={3}
                  value={audioFeedbackInput}
                  onChange={(e) => setAudioFeedbackInput(e.target.value)}
                  placeholder={language === 'ha' ? 'Misali: Madallah da kyau ko kuma ka gyara kaza...' : 'Instructor feedback...'}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:border-emerald-700 outline-hidden leading-relaxed"
                />
              </div>

              {/* Dual Action Buttons: Approve with score OR Reject to repeat */}
              <div className="pt-3 border-t border-stone-200 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleGradeAudio(false)}
                  className="w-full sm:flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.rejectAndRepeatBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGradeAudio(true)}
                  className="w-full sm:flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.approveWithScoreBtn} ({audioScoreInput}p)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
