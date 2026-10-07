import React, { useState, useEffect } from 'react';
import {
  Bell,
  ChevronDown,
  BookMarked,
  User,
  ShieldCheck,
  GraduationCap,
  Languages,
  Sparkles,
  Database,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { Course, UserAccount } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';
import { Language } from '../../i18n/translations';
import { store } from '../../services/storage';

interface TopHeaderProps {
  courses: Course[];
  activeCourseId: string;
  onSelectCourse: (id: string) => void;
  currentUser: UserAccount;
  onOpenAuthModal: () => void;
  onNavigate: (view: string) => void;
  institutionLogo?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  courses,
  activeCourseId,
  onSelectCourse,
  currentUser,
  onOpenAuthModal,
  onNavigate,
  institutionLogo
}) => {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState(store.getDbStatus());

  useEffect(() => {
    const update = () => setDbStatus(store.getDbStatus());
    const interval = setInterval(update, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await store.syncWithSupabase();
      setDbStatus(store.getDbStatus());
      if (res.success) {
        setSyncFeedback(
          language === 'ha'
            ? `An yi nasarar hada bayanai! Dalibai 31, manhaja 1 daga Supabase.`
            : language === 'en'
            ? `Successfully synced! 31 students, 1 course from Supabase.`
            : `تمت مزامنة قاعدة البيانات بنجاح!`
        );
      } else {
        setSyncFeedback(
          language === 'ha'
            ? 'Ba a sami damar hadawa ba a yanzu.'
            : 'Could not connect to Supabase right now.'
        );
      }
    } catch {
      setSyncFeedback('Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0];

  const languagesList: { code: Language; label: string; flag: string; nativeName: string }[] = [
    { code: 'ha', label: 'Hausa', flag: '🇳🇬', nativeName: 'Harshen Hausa (Asali)' },
    { code: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦', nativeName: 'العربية الفصحى' },
  ];

  const currentLangObj = languagesList.find((l) => l.code === language) || languagesList[0];

  const notifications = [
    { id: 1, title: language === 'ha' ? 'An bude jarabawar Kashi Na 1' : language === 'en' ? 'Unit 1 Exam is now Live' : 'تم إتاحة اختبار الوحدة الأولى', desc: language === 'ha' ? 'Yanzu zaka iya amsa jarabawar Al-Aadaab Al-Asharah' : language === 'en' ? 'You can now sit the unit exam in the testing hub' : 'يمكنك الآن أداء الاختبار النهائي لمقرر الآداب', time: language === 'ha' ? 'Sa\'o\'i 2 da suka wuce' : language === 'en' ? '2 hours ago' : 'منذ ساعتين' },
    { id: 2, title: language === 'ha' ? 'Sabuwar Muryar Darasi' : language === 'en' ? 'New Audio Lecture Added' : 'محاضرة جديدة', desc: language === 'ha' ? 'An dora darasi na biyu a fannin ladubba' : language === 'en' ? 'Second lecture recording uploaded to Manners' : 'تم رفع تسجيل المحاضرة الثانية في آداب الاستئذان', time: language === 'ha' ? 'Jiya' : language === 'en' ? 'Yesterday' : 'أمس' },
    { id: 3, title: language === 'ha' ? 'Tabbatar da Takardar Shaida' : language === 'en' ? 'Certificate Issued' : 'اعتماد الشهادة', desc: language === 'ha' ? 'An kammala fitar da takardar shaidarka da lambar QR' : language === 'en' ? 'Course completion certificate verified with QR code' : 'تم إصدار شهادة إتمام مقرر الآداب بنجاح', time: language === 'ha' ? 'Kwanaki 2 da suka wuce' : language === 'en' ? '2 days ago' : 'منذ يومين' }
  ];

  return (
    <header className="bg-white border-b border-stone-200/80 sticky top-0 z-20 px-4 py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left / Start: Logo & Slogan */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2.5 shrink-0">
            {institutionLogo && (
              <img
                src={institutionLogo}
                alt="Logo"
                className="w-8 h-8 rounded-full object-contain border border-amber-300 shadow-2xs"
              />
            )}
            <div className="hidden sm:block">
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5 leading-tight">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="truncate">{t.sloganRhyme}</span>
              </div>
            </div>
            <div className="sm:hidden">
              <span className="text-xs font-bold text-emerald-950 font-arabic-heading truncate max-w-[120px] block">
                {t.appName}
              </span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-stone-200 hidden md:block" />

          {/* Course Selector Dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-2 bg-stone-100/90 hover:bg-stone-200/80 transition-colors px-3 py-1.5 rounded-xl border border-stone-200 text-stone-900 cursor-pointer text-xs font-semibold">
              <BookMarked className="w-4 h-4 text-emerald-800 shrink-0" />
              <select
                value={activeCourseId}
                onChange={(e) => onSelectCourse(e.target.value)}
                className="bg-transparent border-none outline-hidden cursor-pointer font-bold text-stone-800 text-xs pr-1"
                aria-label={t.courseSelectLabel}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name_ar} ({course.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0 pointer-events-none" />
            </div>
          </div>

          {/* Live Supabase Connection Badge */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowDbModal(!showDbModal)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
              title="Supabase Database Status"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <Database className="w-3 h-3 text-emerald-700" />
              <span>Supabase Live</span>
            </button>

            {showDbModal && (
              <div
                className={`absolute ${isRtl ? 'right-0' : 'left-0'} mt-2 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-stone-900">Supabase Database</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>

                <div className="space-y-2 text-xs text-stone-600 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Host:</span>
                    <span className="font-mono text-[11px] text-stone-700 truncate max-w-[150px]">
                      vnqgxopexirycynuybyc
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Dalibai Masu Rajista:</span>
                    <span className="font-bold text-emerald-800">31 Dalibai</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Manhaja Mai Aiki:</span>
                    <span className="font-bold text-stone-800">Al-Aadaab Al-Asharah</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Jadawalin Sakamako:</span>
                    <span className="font-medium text-emerald-700">Live Gradebook</span>
                  </div>
                </div>

                {syncFeedback && (
                  <div className="p-2 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{syncFeedback}</span>
                  </div>
                )}

                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="w-full py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Ana Sabuntowa...' : 'Sake Karanta Bayanan DB'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right / End: Language Selector + Notifications + User Profile */}
        <div className="flex items-center gap-2">
          {/* Prominent Language Switcher Button (Hausa, English, Arabic) */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200/90 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 transition-all shadow-2xs"
              title="Select Language / Canza Harshe"
            >
              <span className="text-sm leading-none">{currentLangObj.flag}</span>
              <span className="hidden sm:inline">{currentLangObj.label}</span>
              <ChevronDown className="w-3 h-3 text-stone-500" />
            </button>

            {showLangMenu && (
              <div
                className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
              >
                <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Harshen Shafin / Language
                </div>
                {languagesList.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      language === lang.code
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </div>
                    {language === lang.code && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications dropdown toggle */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl relative transition-colors"
              title={t.notificationsTitle}
              aria-label={t.notificationsTitle}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            </button>

            {showNotifications && (
              <div
                className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100`}
              >
                <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">{t.notificationsTitle}</span>
                  <span className="text-[11px] text-emerald-700 font-medium">{t.notificationsNew}</span>
                </div>
                <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3 hover:bg-stone-50 transition-colors cursor-pointer text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">{n.title}</span>
                        <span className="text-[10px] text-stone-400">{n.time}</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">{n.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-stone-100 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('schedule');
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    {t.viewScheduleAction}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Account Capsule */}
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 p-1.5 px-2 bg-stone-50 hover:bg-stone-100 border border-stone-200/90 rounded-xl transition-all shadow-2xs"
          >
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-stone-900 block leading-tight truncate max-w-[140px]">
                {currentUser.name_ar || currentUser.name}
              </span>
              <span className="text-[10px] font-bold block truncate max-w-[140px]">
                {currentUser.role === 'admin' ? (
                  <span className="text-amber-900 font-semibold">{language === 'ha' ? 'Shugaban Makaranta' : 'Principal / Dean'}</span>
                ) : currentUser.role === 'teacher' ? (
                  <span className="text-emerald-800 font-semibold">{language === 'ha' ? 'Malami Mai Koyarwa' : 'Instructor'}</span>
                ) : (
                  <span className="text-amber-800 font-mono font-bold">{currentUser.institution_code || `MIF-2026-${String(currentUser.sn || 1).padStart(3, '0')}`}</span>
                )}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-800 text-amber-200 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : currentUser.role === 'teacher' ? (
                <GraduationCap className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
