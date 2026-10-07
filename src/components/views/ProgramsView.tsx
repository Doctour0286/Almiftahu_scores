import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Play,
  Headphones,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Clock,
  Layers,
  GraduationCap
} from 'lucide-react';
import { Course, StudentProgress } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface ProgramsViewProps {
  courses: Course[];
  activeCourse: Course;
  progress: StudentProgress;
  onSelectCourse: (id: string) => void;
  onNavigate: (view: string, lessonId?: string) => void;
}

export const ProgramsView: React.FC<ProgramsViewProps> = ({
  courses,
  activeCourse,
  progress,
  onSelectCourse,
  onNavigate
}) => {
  const { t } = useLanguage();
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(
    activeCourse.units[0]?.id || null
  );

  const allLessons = activeCourse.units.flatMap((u) => u.lessons);
  const completedLessons = allLessons.filter((l) =>
    progress.completed_lessons.includes(l.id)
  );
  const percentage = allLessons.length > 0
    ? Math.round((completedLessons.length / allLessons.length) * 100)
    : 0;

  const toggleUnit = (unitId: string) => {
    setExpandedUnitId(expandedUnitId === unitId ? null : unitId);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Program Header Banner */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              {t.programsTitle}
            </span>
            <h2 className="font-arabic-heading text-2xl font-bold text-stone-900">
              {activeCourse.name_ar}
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              {activeCourse.description_ar}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-stone-600">
              <span className="flex items-center gap-1 font-semibold text-stone-800">
                <GraduationCap className="w-4 h-4 text-emerald-800" />
                {activeCourse.instructor_name_ar}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Layers className="w-4 h-4 text-stone-400" />
                {activeCourse.units.length} {t.unitsCount}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4 text-stone-400" />
                {allLessons.length} {t.lessonsCount}
              </span>
            </div>
          </div>

          {/* Circular Progress Gauge */}
          <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200/70 shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-stone-200"
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
            <div>
              <div className="text-xs font-bold text-stone-900">{t.courseCompletionGauge}</div>
              <div className="text-[11px] text-stone-500">
                {completedLessons.length} / {allLessons.length} {t.completedBadge}
              </div>
            </div>
          </div>
        </div>

        {/* Course Pills Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-stone-100 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-stone-400 shrink-0 mr-1">
            {t.courseSwitchLabel}
          </span>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCourse(c.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                activeCourse.id === c.id
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {c.name_ar}
            </button>
          ))}
        </div>
      </div>

      {/* Units & Lessons Accordion */}
      <div className="space-y-4">
        {activeCourse.units.map((unit, uIdx) => {
          const isExpanded = expandedUnitId === unit.id;
          const unitCompleted = unit.lessons.every((l) =>
            progress.completed_lessons.includes(l.id)
          );

          return (
            <div
              key={unit.id}
              className="bg-white rounded-3xl border border-stone-200/80 shadow-2xs overflow-hidden transition-all"
            >
              {/* Unit Header Bar */}
              <div
                onClick={() => toggleUnit(unit.id)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-stone-50/60 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      unitCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-emerald-800 text-amber-200'
                    }`}
                  >
                    {unitCompleted ? <CheckCircle2 className="w-5 h-5" /> : uIdx + 1}
                  </div>
                  <div>
                    <h3 className="font-arabic-heading text-base font-bold text-stone-900">
                      {unit.title_ar}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {unit.description_ar}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 font-medium hidden sm:inline">
                    {unit.lessons.length} {t.lessonsCount}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-400" />
                  )}
                </div>
              </div>

              {/* Unit Body Content */}
              {isExpanded && (
                <div className="border-t border-stone-100 p-5 bg-stone-50/40 space-y-3">
                  <div className="divide-y divide-stone-100 rounded-2xl bg-white border border-stone-200/80 overflow-hidden">
                    {unit.lessons.map((lesson, lIdx) => {
                      const isDone = progress.completed_lessons.includes(lesson.id);
                      return (
                        <div
                          key={lesson.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold text-stone-400 mt-0.5 w-5 text-center">
                              {lIdx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-stone-900 font-arabic-heading">
                                  {lesson.title_ar}
                                </h4>
                                {isDone && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                    {t.completedBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                                {lesson.summary_ar}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3" />
                                  {lesson.media.duration_formatted}
                                </span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1">
                                  <Headphones className="w-3 h-3" />
                                  Video & Audio
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => onNavigate('classroom', lesson.id)}
                            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{t.enterClassroomBtn}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unit Exam Card */}
                  {unit.exam_id && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-950 font-arabic-heading">
                            {t.unitExamCardTitle}
                          </div>
                          <div className="text-[11px] text-emerald-800 mt-0.5">
                            {t.unitExamCardDesc}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigate('exams')}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                      >
                        {t.startExamBtn}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
