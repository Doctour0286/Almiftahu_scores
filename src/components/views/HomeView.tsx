import React from 'react';
import {
  Play,
  Calendar,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { Course, UserAccount, StudentProgress } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface HomeViewProps {
  activeCourse: Course;
  currentUser: UserAccount;
  progress: StudentProgress;
  onNavigate: (view: string, lessonId?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  activeCourse,
  currentUser,
  progress,
  onNavigate
}) => {
  const { t, isRtl, language } = useLanguage();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  // Calculate completion percentage
  const allLessons = activeCourse.units.flatMap((u) => u.lessons);
  const totalLessonsCount = allLessons.length;
  const completedCount = allLessons.filter((l) =>
    progress.completed_lessons.includes(l.id)
  ).length;
  const percentage = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

  // Find next lesson to study
  const nextLesson = allLessons.find((l) => !progress.completed_lessons.includes(l.id)) || allLessons[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Welcome Banner with Rhyming Cadence */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white p-6 sm:p-8 shadow-md">
        {/* Subtle decorative Islamic pattern watermark */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fde68a_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 max-w-2xl">
          <div className="text-amber-300 font-arabic-heading text-xs sm:text-sm mb-1.5 flex items-center gap-2">
            <span>{t.bismillah}</span>
          </div>

          <h2 className="font-arabic-heading text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            {t.welcomeBack} {currentUser.name_ar || currentUser.name}
          </h2>

          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed mb-4 font-normal">
            {t.welcomeDesc}
          </p>

          {/* Rhyming Educational Motto */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-800/80 border border-amber-300/40 text-amber-200 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>{t.sloganRhyme}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {nextLesson && (
              <button
                onClick={() => onNavigate('classroom', nextLesson.id)}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-emerald-950" />
                <span>{t.continueLessonAction} {nextLesson.title_ar}</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('programs')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.viewSyllabusAction}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Metric Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Course Progress Card with Circular Indicator */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-stone-500 mb-1">{t.activeCourseProgress}</div>
            <div className="text-sm font-bold text-stone-900">{activeCourse.name_ar}</div>
            <div className="text-xs text-emerald-800 mt-1 font-medium">
              {t.lessonsCompletedOf} {completedCount} / {totalLessonsCount}
            </div>
          </div>

          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-stone-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-700 transition-all duration-500"
                strokeDasharray={`${percentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold text-stone-900">{percentage}%</span>
          </div>
        </div>

        {/* Study Schedule Quick Card */}
        <div
          onClick={() => onNavigate('schedule')}
          className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-600/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs text-stone-400 group-hover:text-emerald-800 flex items-center gap-1 font-semibold">
              <span>{t.navSchedule}</span> <ArrowIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xs font-semibold text-stone-500">{t.todaysLecturesTitle}</div>
          <div className="text-sm font-bold text-stone-900 mt-0.5">
            {activeCourse.units[0]?.lessons[0]?.title_ar || 'Darasi Na 1'}
          </div>
          <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>04:30 PM &bull; {activeCourse.instructor_name_ar}</span>
          </div>
        </div>

        {/* Certificates & Honors Card */}
        <div
          onClick={() => onNavigate('certificates')}
          className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-600/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs text-stone-400 group-hover:text-emerald-800 flex items-center gap-1 font-semibold">
              <span>{t.navCertificates}</span> <ArrowIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xs font-semibold text-stone-500">{t.certificatesHonorTitle}</div>
          <div className="text-sm font-bold text-stone-900 mt-0.5">{t.certificatesHonorDesc}</div>
          <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {language === 'ha'
                ? 'A shirye take don gani da bugawa a takarda'
                : language === 'en'
                ? 'Ready for instant preview and print'
                : 'جاهزة للمعاينة والطباعة الفورية'}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Unit Curriculum Roadmap */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-arabic-heading text-lg font-bold text-stone-900">
              {t.curriculumRoadmapTitle} ({activeCourse.name_ar})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {t.curriculumRoadmapDesc}
            </p>
          </div>
          <button
            onClick={() => onNavigate('programs')}
            className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
          >
            <span>{t.viewAllCurricula}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-4">
          {activeCourse.units.map((unit, uIdx) => (
            <div
              key={unit.id}
              className="border border-stone-200 rounded-2xl p-4 hover:border-emerald-700/40 transition-all bg-stone-50/40"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-800 text-amber-200 text-xs font-bold flex items-center justify-center">
                    {uIdx + 1}
                  </span>
                  <span className="text-sm font-bold text-stone-900 font-arabic-heading">
                    {unit.title_ar}
                  </span>
                </div>
                <span className="text-xs text-stone-500 font-medium">
                  {unit.lessons.length} {t.lessonsCount}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {unit.lessons.map((lesson) => {
                  const isDone = progress.completed_lessons.includes(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => onNavigate('classroom', lesson.id)}
                      className="p-3 bg-white border border-stone-200/80 rounded-xl hover:border-emerald-700/60 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-stone-800 truncate">
                          {lesson.title_ar}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0 font-mono">
                        {lesson.media.duration_formatted}
                      </span>
                    </div>
                  );
                })}
              </div>

              {unit.exam_id && (
                <div className="mt-3 pt-3 border-t border-stone-200/70 flex items-center justify-between">
                  <span className="text-xs text-stone-600 font-medium flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-800" />
                    <span>{t.unitExamLabel}</span>
                  </span>
                  <button
                    onClick={() => onNavigate('exams')}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                  >
                    <span>{t.enterExamAction}</span>
                    <ArrowIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
