import React, { useState, useEffect } from 'react';
import {
  Play,
  Video,
  Headphones,
  CheckCircle2,
  BookOpen,
  FileText,
  MessageSquare,
  ListVideo,
  X,
  Check,
  Send,
  Mic,
  HelpCircle,
  Clock,
  RotateCcw,
  AlertCircle,
  Award,
  Sparkles
} from 'lucide-react';
import { Course, Lesson, StudentProgress, AudioSubmission, LessonQuizAttempt } from '../../types/lms';
import { store } from '../../services/storage';
import { useLanguage } from '../../i18n/LanguageContext';
import { VoiceRecorder } from '../common/VoiceRecorder';

interface LessonPlayerViewProps {
  course: Course;
  initialLessonId?: string;
  progress: StudentProgress;
  onLessonCompleted: (lessonId: string) => void;
  onNavigate: (view: string) => void;
}

export const LessonPlayerView: React.FC<LessonPlayerViewProps> = ({
  course,
  initialLessonId,
  progress,
  onLessonCompleted,
  onNavigate
}) => {
  const { t, language } = useLanguage();
  const allLessons = course.units.flatMap((u) => u.lessons);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    initialLessonId || allLessons[0]?.id || ''
  );
  const [mediaMode, setMediaMode] = useState<'video' | 'audio'>('video');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'reading' | 'recitation' | 'quiz' | 'notes' | 'discussion'>('reading');

  const currentLesson: Lesson =
    allLessons.find((l) => l.id === selectedLessonId) || allLessons[0];

  // Notes state with autosave
  const [noteText, setNoteText] = useState<string>(
    progress.notes[currentLesson?.id] || ''
  );
  const [isSaved, setIsSaved] = useState(true);

  // Audio submissions state for the current student & lesson
  const [audioSubs, setAudioSubs] = useState<AudioSubmission[]>([]);
  const [isReRecording, setIsReRecording] = useState(false);

  // Quiz state for current lesson
  const [quizAttempt, setQuizAttempt] = useState<LessonQuizAttempt | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const currentUser = store.getCurrentUser();

  const loadLessonData = () => {
    if (!currentLesson) return;
    const subs = store.getAudioSubmissions(course.id, currentUser.id);
    const thisLessonSubs = subs.filter((s) => s.lesson_id === currentLesson.id);
    setAudioSubs(thisLessonSubs);

    const qAttempts = store.getLessonQuizAttempts(currentLesson.id, currentUser.id);
    if (qAttempts.length > 0) {
      setQuizAttempt(qAttempts[0]);
      setQuizSubmitted(true);
    } else {
      setQuizAttempt(null);
      setQuizSubmitted(false);
      setQuizAnswers({});
    }
  };

  useEffect(() => {
    if (currentLesson) {
      setNoteText(progress.notes[currentLesson.id] || '');
      setIsSaved(true);
      setIsReRecording(false);
      loadLessonData();
    }
  }, [currentLesson?.id, progress.notes, currentUser.id]);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setIsSaved(false);
    store.saveLessonNote(currentLesson.id, text);
    setTimeout(() => {
      setIsSaved(true);
    }, 600);
  };

  const handleToggleComplete = () => {
    onLessonCompleted(currentLesson.id);
  };

  const handleAudioRecorded = (audioDataUrl: string, durationSeconds: number) => {
    store.submitAudioRecitation({
      lessonId: currentLesson.id,
      lessonTitle: currentLesson.title_ar,
      courseId: course.id,
      audioDataUrl,
      durationSeconds
    });
    setIsReRecording(false);
    loadLessonData();
    // Also mark lesson completed as progression reward
    onLessonCompleted(currentLesson.id);
  };

  // Sample default quiz questions for this lesson if not explicitly structured in JSON
  const lessonQuestions = currentLesson?.quiz?.questions || [
    {
      id: 'q1',
      format: 'mcq' as const,
      prompt_ar:
        language === 'ha'
          ? `Tambaya ta 1: Menene babban makasudin wannan darasi na ${currentLesson.title_ar}?`
          : language === 'en'
          ? `Question 1: What is the primary takeaway of ${currentLesson.title_ar}?`
          : `سؤال 1: ما هو المقصد الأساسي من هذا الدرس المبارك؟`,
      options: [
        { id: 'opt1', text_ar: language === 'ha' ? 'Koyon ka\'idoji da fahimtar dalilan shari\'a' : language === 'en' ? 'Mastering foundational principles with textual evidence' : 'فهم الأصول وتأصيل المسائل بالدليل' },
        { id: 'opt2', text_ar: language === 'ha' ? 'Sanin sunayen mutane kawai' : language === 'en' ? 'Memorizing names without comprehension' : 'حفظ الأسماء المجردة فقط' },
        { id: 'opt3', text_ar: language === 'ha' ? 'Wucewa ba tare da aiki da ilimi ba' : language === 'en' ? 'Passing without implementation' : 'المرور العابر دون عمل' }
      ],
      max_points: 5
    },
    {
      id: 'q2',
      format: 'tf' as const,
      prompt_ar:
        language === 'ha'
          ? 'Tambaya ta 2: Nazarin wannan darasi yana taimakawa wajen gyara akida da ibada ta gaskiya?'
          : language === 'en'
          ? 'Question 2: Studying this lesson directly rectifies belief and devotional practice?'
          : 'سؤال 2: هل دراسة هذا الدرس تعين على تصحيح المعتقد والعبادة؟',
      options: [
        { id: 'opt_true', text_ar: language === 'ha' ? 'Haka ne (Gaskiya)' : language === 'en' ? 'True' : 'صحيح' },
        { id: 'opt_false', text_ar: language === 'ha' ? 'A\'a (Kuskure)' : language === 'en' ? 'False' : 'خطأ' }
      ],
      max_points: 5
    }
  ];

  const handleQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLesson) return;

    let score = 0;
    const maxScore = lessonQuestions.reduce((acc, q) => acc + q.max_points, 0);

    // Grade automatic answers: opt1 and opt_true are correct
    if (quizAnswers['q1'] === 'opt1') score += 5;
    if (quizAnswers['q2'] === 'opt_true') score += 5;

    const newAttempt = store.submitLessonQuiz(
      currentLesson.id,
      course.id,
      quizAnswers,
      score,
      maxScore
    );

    setQuizAttempt(newAttempt);
    setQuizSubmitted(true);
    // Lesson test minimally aids completion without blocking
    onLessonCompleted(currentLesson.id);
  };

  const isCompleted = progress.completed_lessons.includes(currentLesson?.id);
  const latestAudioSub = audioSubs[0];
  const hasAudioOption = course.has_audio_memorization ?? true;

  if (!currentLesson) {
    return (
      <div className="p-8 text-center text-stone-500">
        {language === 'ha'
          ? 'Ba a sami darasi a wannan fanni ba.'
          : language === 'en'
          ? 'No lectures found in this course.'
          : 'لم يتم العثور على محاضرات في هذا المقرر.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
            <span>{course.name_ar}</span>
            <span>&bull;</span>
            <span>
              {t.lectureNo} {currentLesson.order_index}
            </span>
          </div>
          <h2 className="font-arabic-heading text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
            {currentLesson.title_ar}
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Playlist drawer toggle button */}
          <button
            onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
            className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <ListVideo className="w-4 h-4 text-emerald-800" />
            <span>
              {t.playlistBtn} ({allLessons.length})
            </span>
          </button>

          {/* Mark completed button */}
          <button
            onClick={handleToggleComplete}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? t.alreadyCompletedBtn : t.markCompletedBtn}</span>
          </button>
        </div>
      </div>

      {/* Multimedia Classroom Container */}
      <div className="bg-stone-950 rounded-3xl overflow-hidden shadow-xl border border-stone-800">
        {/* Media Mode Switcher (Video vs Audio Podcast) */}
        <div className="px-5 py-3 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => setMediaMode('video')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mediaMode === 'video'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>{t.videoModeTab}</span>
            </button>
            <button
              onClick={() => setMediaMode('audio')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mediaMode === 'audio'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{t.audioPodcastTab}</span>
            </button>
          </div>

          <div className="text-xs text-stone-400 flex items-center gap-2">
            <span>
              {t.durationLabel} {currentLesson.media.duration_formatted}
            </span>
          </div>
        </div>

        {/* Media Display Area */}
        <div className="relative aspect-video max-h-[460px] w-full bg-black flex items-center justify-center overflow-hidden">
          {mediaMode === 'video' ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              <video
                controls
                src={currentLesson.media.video_url}
                className="w-full h-full object-contain"
                poster="https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80"
              />
            </div>
          ) : (
            /* Audio Podcast Studio Mode */
            <div className="w-full h-full p-6 sm:p-10 flex flex-col items-center justify-center bg-radial from-emerald-950 via-stone-950 to-black text-white text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-800/60 border border-emerald-500/30 flex items-center justify-center shadow-lg mb-4">
                <Headphones className="w-10 h-10 text-amber-300" />
              </div>
              <h3 className="font-arabic-heading text-lg font-bold text-white mb-1">
                {t.audioStudioTitle}
              </h3>
              <p className="text-xs text-stone-400 max-w-md mb-6">{t.audioStudioDesc}</p>

              {/* Audio Controls */}
              <div className="w-full max-w-md bg-stone-900/80 border border-stone-800 rounded-2xl p-4 space-y-4">
                <audio controls src={currentLesson.media.audio_url} className="w-full rounded-lg" />

                <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-800">
                  <div className="flex items-center gap-2">
                    <span>{t.playbackSpeedLabel}</span>
                    {[1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          playbackSpeed === s
                            ? 'bg-emerald-700 text-white'
                            : 'bg-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <span className="text-[11px] text-emerald-400">{t.hiFiAudioBadge}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Tab Study Deck */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-stone-200/80 px-6 pt-3 gap-6 bg-stone-50/50 overflow-x-auto">
          {/* Tab 1: Summary / Reading */}
          <button
            onClick={() => setActiveTab('reading')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reading'
                ? 'border-emerald-800 text-emerald-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.tabSummaryReading}</span>
          </button>

          {/* Tab 2: Audio Memorization (Shown if course has audio memorization) */}
          {hasAudioOption && (
            <button
              onClick={() => setActiveTab('recitation')}
              className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'recitation'
                  ? 'border-emerald-800 text-emerald-950 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Mic className="w-4 h-4 text-emerald-800" />
              <span>{t.audioRecitationSectionTitle}</span>
              {latestAudioSub && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    latestAudioSub.status === 'approved'
                      ? 'bg-emerald-500'
                      : latestAudioSub.status === 'rejected'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                />
              )}
            </button>
          )}

          {/* Tab 3: Per-Lesson Quiz / Quick Test */}
          <button
            onClick={() => setActiveTab('quiz')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'quiz'
                ? 'border-emerald-800 text-emerald-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{t.lessonQuizSectionTitle}</span>
            {quizAttempt && (
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-mono">
                {quizAttempt.score}/{quizAttempt.max_score}
              </span>
            )}
          </button>

          {/* Tab 4: Student Notes */}
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'notes'
                ? 'border-emerald-800 text-emerald-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t.tabStudentNotes}</span>
            {noteText && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
          </button>

          {/* Tab 5: Discussion Forum */}
          <button
            onClick={() => setActiveTab('discussion')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'discussion'
                ? 'border-emerald-800 text-emerald-950 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t.tabDiscussionForum}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* 1. Reading & Summary Content */}
          {activeTab === 'reading' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl">
                <h4 className="text-xs font-bold text-amber-950 mb-1">{t.summaryKicker}</h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {currentLesson.summary_ar}
                </p>
              </div>

              <div className="prose max-w-none text-stone-800 text-sm leading-relaxed whitespace-pre-line font-serif">
                {currentLesson.reading_content_ar}
              </div>

              {currentLesson.references?.length > 0 && (
                <div className="pt-4 border-t border-stone-100">
                  <h5 className="text-xs font-bold text-stone-500 mb-2">{t.referencesTitle}</h5>
                  <ul className="list-disc list-inside text-xs text-stone-600 space-y-1">
                    {currentLesson.references.map((ref, idx) => (
                      <li key={idx}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 2. Audio Recitation (Voice Note Recorder) */}
          {activeTab === 'recitation' && hasAudioOption && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                <div>
                  <h3 className="font-arabic-heading text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Mic className="w-5 h-5 text-emerald-800" />
                    <span>{t.audioRecitationSectionTitle}</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {t.audioRecitationSubtitle}
                  </p>
                </div>
                <span className="text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full self-start sm:self-auto flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.audioRecitationVoiceHint}</span>
                </span>
              </div>

              {/* Existing Submission Status Display */}
              {latestAudioSub && !isReRecording ? (
                <div className="space-y-4">
                  {latestAudioSub.status === 'approved' && (
                    <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>{t.audioSubmissionApproved}</span>
                        </div>
                        <div className="px-3 py-1 bg-emerald-200 text-emerald-950 font-bold text-xs rounded-full font-mono">
                          {t.audioTeacherScore}: {latestAudioSub.score} / {latestAudioSub.max_score}
                        </div>
                      </div>

                      {latestAudioSub.teacher_feedback && (
                        <div className="p-3 bg-white/80 rounded-2xl border border-emerald-200 text-xs text-emerald-950">
                          <span className="font-bold block mb-0.5">{t.audioTeacherFeedback}:</span>
                          <p className="leading-relaxed">{latestAudioSub.teacher_feedback}</p>
                          {latestAudioSub.graded_by && (
                            <span className="text-[10px] text-emerald-700 block mt-1 font-semibold">
                              &mdash; {latestAudioSub.graded_by}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <audio
                          controls
                          src={latestAudioSub.audio_data_url}
                          className="h-9 max-w-xs"
                        />
                        <button
                          onClick={() => setIsReRecording(true)}
                          className="text-xs text-emerald-800 hover:text-emerald-950 underline font-semibold"
                        >
                          {t.reRecordAudioBtn}
                        </button>
                      </div>
                    </div>
                  )}

                  {latestAudioSub.status === 'rejected' && (
                    <div className="p-5 bg-rose-50 border border-rose-300 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                          <span>{t.audioSubmissionRejected}</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 font-bold text-[11px] rounded-full">
                          {language === 'ha' ? 'Maimaitawa' : language === 'en' ? 'Repeat' : 'إعادة'}
                        </span>
                      </div>

                      <p className="text-xs text-rose-950 leading-relaxed font-medium">
                        {t.audioRepeatInstruction}
                      </p>

                      {latestAudioSub.teacher_feedback && (
                        <div className="p-3 bg-white/80 rounded-2xl border border-rose-200 text-xs text-rose-950">
                          <span className="font-bold block mb-0.5">{t.audioTeacherFeedback}:</span>
                          <p className="leading-relaxed">{latestAudioSub.teacher_feedback}</p>
                          {latestAudioSub.graded_by && (
                            <span className="text-[10px] text-rose-700 block mt-1 font-semibold">
                              &mdash; {latestAudioSub.graded_by}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <audio
                          controls
                          src={latestAudioSub.audio_data_url}
                          className="h-9 max-w-xs"
                        />
                        <button
                          onClick={() => setIsReRecording(true)}
                          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>{t.reRecordAudioBtn}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {latestAudioSub.status === 'pending' && (
                    <div className="p-5 bg-amber-50 border border-amber-300 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                          <Clock className="w-5 h-5 text-amber-700" />
                          <span>{t.audioSubmissionPending}</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-amber-200 text-amber-950 font-bold text-[11px] rounded-full">
                          {language === 'ha' ? 'A Layin Tantancewa' : language === 'en' ? 'In Review Queue' : 'قيد الانتظار'}
                        </span>
                      </div>

                      <p className="text-xs text-amber-900 leading-relaxed">
                        {language === 'ha'
                          ? 'An aike da karatunka zuwa dakin malamai. Malamin zai saurara sannan ya ba ka maki ko ya bukaci ka sake.'
                          : language === 'en'
                          ? 'Your voice recitation is sent to the faculty workspace. The instructor will listen, certify your score, or request a repeat.'
                          : 'تم إرسال تسجيلك الصوتي بنجاح. سيقوم المعلم بالاستماع إليه ورصد الدرجة أو طلب الإعادة.'}
                      </p>

                      <div className="pt-2 flex items-center justify-between">
                        <audio
                          controls
                          src={latestAudioSub.audio_data_url}
                          className="h-9 max-w-xs"
                        />
                        <button
                          onClick={() => setIsReRecording(true)}
                          className="text-xs text-stone-600 hover:text-stone-900 underline"
                        >
                          {t.reRecordAudioBtn}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Voice Recorder Widget */
                <div className="space-y-3">
                  <VoiceRecorder onAudioRecorded={handleAudioRecorded} />
                  {isReRecording && latestAudioSub && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => setIsReRecording(false)}
                        className="text-xs text-stone-500 hover:text-stone-800 underline"
                      >
                        {t.cancelBtn}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Lesson Quiz (Per-Lesson Test) */}
          {activeTab === 'quiz' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                <div>
                  <h3 className="font-arabic-heading text-lg font-bold text-stone-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-800" />
                    <span>{t.lessonQuizSectionTitle}</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">{t.lessonQuizNotice}</p>
                </div>

                {quizAttempt && (
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-950 font-bold text-xs rounded-xl flex items-center gap-1.5 self-start sm:self-auto font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      {t.lessonQuizSubmittedScore}: {quizAttempt.score} / {quizAttempt.max_score}
                    </span>
                  </div>
                )}
              </div>

              {quizSubmitted && quizAttempt ? (
                /* Completed State */
                <div className="p-6 bg-emerald-50/70 border border-emerald-300 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                      <Award className="w-5 h-5 text-emerald-700" />
                      <span>{t.lessonQuizCompletedBadge}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-900 font-mono">
                      {Math.round((quizAttempt.score / quizAttempt.max_score) * 100)}%
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900 leading-relaxed">
                    {language === 'ha'
                      ? 'Madallah! An adana amsoshinka kuma an saka makin a babban katin makinka. Wannan gwaji ba ya hana ka wucewa gaba.'
                      : language === 'en'
                      ? 'Well done! Your quiz responses have been recorded and contribute favorably to your overall course gradebook.'
                      : 'أحسنت! تم حفظ إجاباتك وإضافتها لسجل درجاتك في المقرر بنجاح دون أن يعيق ذلك تقدمك.'}
                  </p>

                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAttempt(null);
                    }}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{language === 'ha' ? 'Sake Yin Gwajin' : language === 'en' ? 'Retake Quiz' : 'إعادة الاختبار'}</span>
                  </button>
                </div>
              ) : (
                /* Active Quiz Form */
                <form onSubmit={handleQuizSubmit} className="space-y-5">
                  {lessonQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-bold text-stone-900 font-arabic-heading">
                          {t.lessonQuizQuestion} {qIdx + 1}: {q.prompt_ar}
                        </span>
                        <span className="text-[11px] text-stone-500 font-mono font-semibold shrink-0">
                          {q.max_points} {t.pointsLabel}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {q.options?.map((opt) => {
                          const isSelected = quizAnswers[q.id] === opt.id;
                          return (
                            <label
                              key={opt.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold'
                                  : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                value={opt.id}
                                checked={isSelected}
                                onChange={() =>
                                  setQuizAnswers({
                                    ...quizAnswers,
                                    [q.id]: opt.id
                                  })
                                }
                                className="accent-emerald-700 w-4 h-4"
                              />
                              <span>{opt.text_ar}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={Object.keys(quizAnswers).length === 0}
                      className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{t.submitQuizBtn}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 4. Student Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">{t.notesTitle}</h4>
                  <p className="text-[11px] text-stone-500">{t.notesSubtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  {isSaved ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {t.autoSavedStatus}
                    </span>
                  ) : (
                    <span>{t.savingStatus}</span>
                  )}
                </div>
              </div>

              <textarea
                value={noteText}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={t.notesPlaceholder}
                rows={8}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all leading-relaxed"
              />
            </div>
          )}

          {/* 5. Discussion Forum Tab */}
          {activeTab === 'discussion' && (
            <div className="space-y-4">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  M
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">
                      Dr. Ibrahim Al-Madani ({t.discussionInstructorRole})
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {language === 'ha'
                        ? 'Kwanaki 2 da suka wuce'
                        : language === 'en'
                        ? '2 days ago'
                        : 'منذ يومين'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {language === 'ha'
                      ? 'Barka da zuwa dukkan dalibanmu masu albarka. Muna horonku da kiyaye sharuddan kalmar La ilaha illallah kafin fara jarabawa. Duk wanda ke da tambaya ya aiko a nan.'
                      : language === 'en'
                      ? 'Welcome to all our esteemed students. Master the conditions of Creed and Tawheed before sitting the unit exam. Feel free to ask any question.'
                      : 'أهلاً بجميع طلابنا الكرام. نوصيكم بضبط أصول التوحيد وإتقان شروط الشهادتين قبل الشروع في اختبار الوحدة.'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white border border-stone-200 rounded-2xl flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t.askQuestionPlaceholder}
                  className="flex-1 px-3 py-2 text-xs bg-stone-50 rounded-xl outline-hidden focus:bg-white"
                />
                <button className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.sendQuestionBtn}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sliding Lesson Playlist Drawer */}
      {isPlaylistOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/50 backdrop-blur-2xs">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <ListVideo className="w-5 h-5 text-emerald-800" />
                <h3 className="font-arabic-heading text-base font-bold text-stone-900">
                  {t.playlistDrawerTitle}
                </h3>
              </div>
              <button
                onClick={() => setIsPlaylistOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {allLessons.map((l, idx) => {
                const isCurrent = l.id === currentLesson.id;
                const isDone = progress.completed_lessons.includes(l.id);

                return (
                  <div
                    key={l.id}
                    onClick={() => {
                      setSelectedLessonId(l.id);
                      setIsPlaylistOpen(false);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-emerald-700 bg-emerald-50/70 shadow-xs'
                        : 'border-stone-200/80 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCurrent
                            ? 'bg-emerald-800 text-white'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>

                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-stone-900 truncate font-arabic-heading">
                          {l.title_ar}
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                          {l.media.duration_formatted}
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                        {t.nowPlayingBadge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
