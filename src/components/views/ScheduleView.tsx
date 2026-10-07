import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Play,
  Headphones,
  CheckCircle,
  Clock,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Flame,
  Award
} from 'lucide-react';
import { Course, StudentProgress } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface ScheduleViewProps {
  courses: Course[];
  progress: StudentProgress;
  onNavigate: (view: string, lessonId?: string) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  courses,
  progress,
  onNavigate
}) => {
  const { t, isRtl, language } = useLanguage();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedDayIndex, setSelectedDayIndex] = useState(2); // Mid-week selection

  const daysHa = [
    { dayName: 'Lahadi', date: '12 Shawwal', gDate: '12', isToday: false },
    { dayName: 'Litinin', date: '13 Shawwal', gDate: '13', isToday: false },
    { dayName: 'Talata', date: '14 Shawwal', gDate: '14', isToday: true },
    { dayName: 'Laraba', date: '15 Shawwal', gDate: '15', isToday: false },
    { dayName: 'Alhamis', date: '16 Shawwal', gDate: '16', isToday: false },
    { dayName: 'Juma\'a', date: '17 Shawwal', gDate: '17', isToday: false },
    { dayName: 'Asabar', date: '18 Shawwal', gDate: '18', isToday: false },
  ];

  const daysEn = [
    { dayName: 'Sun', date: '12 Shawwal', gDate: '12', isToday: false },
    { dayName: 'Mon', date: '13 Shawwal', gDate: '13', isToday: false },
    { dayName: 'Tue', date: '14 Shawwal', gDate: '14', isToday: true },
    { dayName: 'Wed', date: '15 Shawwal', gDate: '15', isToday: false },
    { dayName: 'Thu', date: '16 Shawwal', gDate: '16', isToday: false },
    { dayName: 'Fri', date: '17 Shawwal', gDate: '17', isToday: false },
    { dayName: 'Sat', date: '18 Shawwal', gDate: '18', isToday: false },
  ];

  const daysAr = [
    { dayName: 'الأحد', date: '١٢ شوال', gDate: '12', isToday: false },
    { dayName: 'الإثنين', date: '١٣ شوال', gDate: '13', isToday: false },
    { dayName: 'الثلاثاء', date: '١٤ شوال', gDate: '14', isToday: true },
    { dayName: 'الأربعاء', date: '١٥ شوال', gDate: '15', isToday: false },
    { dayName: 'الخميس', date: '١٦ شوال', gDate: '16', isToday: false },
    { dayName: 'الجمعة', date: '١٧ شوال', gDate: '17', isToday: false },
    { dayName: 'السبت', date: '١٨ شوال', gDate: '18', isToday: false },
  ];

  const days = language === 'ha' ? daysHa : language === 'en' ? daysEn : daysAr;

  const todayLectures = [
    {
      id: 'les_aq_1',
      courseName: language === 'ha' ? 'Tauhid da Akida' : language === 'en' ? 'Tawheed & Creed' : 'العقيدة والتوحيد',
      title: language === 'ha' ? 'Darasi Na 1: Ma\'anar Tauhidi da Rabe-rabensa' : language === 'en' ? 'Lecture 1: Definition of Tawheed & Categories' : 'المحاضرة ١: تعريف التوحيد لغة واصطلاحاً وأقسامه',
      instructor: 'Dr. Ibrahim Al-Madani',
      time: '09:00 AM - 09:45 AM',
      duration: language === 'ha' ? 'Minti 24' : language === 'en' ? '24 mins' : '24 دقيقة',
      type: 'video',
      completed: progress.completed_lessons.includes('les_aq_1')
    },
    {
      id: 'les_hd_1',
      courseName: language === 'ha' ? 'Ilimin Hadisi' : language === 'en' ? 'Hadith Terminology' : 'علوم الحديث ومصطلح الأثر',
      title: language === 'ha' ? 'Darasi Na 1: Sharuddan Hadisi Sahih Guda Biyar' : language === 'en' ? 'Lecture 1: The Five Conditions of Sahih Hadith' : 'المحاضرة ١: شروط الحديث الصحيح لذاته',
      instructor: 'Dr. Ibrahim Al-Madani',
      time: '01:30 PM - 02:15 PM',
      duration: language === 'ha' ? 'Minti 35' : language === 'en' ? '35 mins' : '35 دقيقة',
      type: 'audio',
      completed: progress.completed_lessons.includes('les_hd_1')
    },
    {
      id: 'les_fq_1',
      courseName: language === 'ha' ? 'Fikihun Tsarki da Sallah' : language === 'en' ? 'Fiqh of Purification' : 'فقه العبادات والطهارة',
      title: language === 'ha' ? 'Darasi Na 1: Rabe-raben Ruwa da Farillan Alwala' : language === 'en' ? 'Lecture 1: Categories of Water & Ablution' : 'المحاضرة ١: أقسام المياه وفرائض الوضوء الستة',
      instructor: 'Sheikh Abdullah Al-Qasim',
      time: '04:30 PM - 05:15 PM',
      duration: language === 'ha' ? 'Minti 26' : language === 'en' ? '26 mins' : '26 دقيقة',
      type: 'video',
      completed: progress.completed_lessons.includes('les_fq_1')
    }
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-arabic-heading text-2xl font-bold text-stone-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-800" />
            <span>{t.scheduleTitle}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {t.scheduleDesc}
          </p>
        </div>

        {/* Week / Month Toggle */}
        <div className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'week'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.viewWeek}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'month'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.viewMonth}
          </button>
        </div>
      </div>

      {/* Habit & Streak Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 fill-amber-500 text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">{t.streakDays}</div>
            <div className="text-sm font-bold text-stone-900">
              {language === 'ha' ? 'Kwanaki 14 a Jere' : language === 'en' ? '14 Days Streak' : '١٤ يوماً متتالياً'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">{t.studyHours}</div>
            <div className="text-sm font-bold text-stone-900">
              {language === 'ha' ? 'Awanni 18 da Minti 45' : language === 'en' ? '18 Hours 45 Mins' : '١٨ ساعة و٤٥ دقيقة'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">{t.completedLessonsMetric}</div>
            <div className="text-sm font-bold text-stone-900">
              {progress.completed_lessons.length} {t.lessonsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Date Picker Strip Carousel */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-3 shadow-2xs">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-stone-700 font-arabic-heading">
            {t.currentWeekLabel} &bull; Shawwal 1447H
          </span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d, idx) => {
            const isSelected = selectedDayIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayIndex(idx)}
                className={`flex flex-col items-center py-2.5 px-1 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-emerald-800 text-white shadow-xs font-bold'
                    : d.isToday
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span className="text-[11px] mb-0.5">{d.dayName}</span>
                <span className="text-sm sm:text-base font-bold leading-tight">{d.gDate}</span>
                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-amber-300' : 'text-stone-400'}`}>
                  {d.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Scheduled Lectures */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-arabic-heading text-lg font-bold text-stone-900">
              {t.todaysClassesTitle} ({days[selectedDayIndex].dayName}, {days[selectedDayIndex].date})
            </h3>
            <p className="text-xs text-stone-500">
              {t.todaysClassesDesc}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {todayLectures.map((lec) => (
            <div
              key={lec.id}
              className="p-4 rounded-2xl border border-stone-200/90 hover:border-emerald-700/50 bg-stone-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    lec.completed
                      ? 'bg-emerald-100 text-emerald-800'
                      : lec.type === 'video'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {lec.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : lec.type === 'video' ? (
                    <Play className="w-5 h-5" />
                  ) : (
                    <Headphones className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-emerald-800">
                    {lec.courseName}
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 mt-0.5 font-arabic-heading">
                    {lec.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
                    <span>{lec.instructor}</span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {lec.time}
                    </span>
                    <span>&bull;</span>
                    <span>{lec.duration}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigate('classroom', lec.id)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    lec.completed
                      ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                  }`}
                >
                  {lec.completed ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t.reviewLectureBtn}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t.startLectureBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
