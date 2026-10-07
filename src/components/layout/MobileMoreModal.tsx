import React from 'react';
import {
  X,
  Headphones,
  FileCheck,
  Award,
  GraduationCap,
  Shield,
  UserCheck,
  LogOut,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { UserAccount, UserRole } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface MobileMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onNavigate: (view: string) => void;
  onOpenAuthModal: () => void;
  onSwitchPersona: (role: UserRole) => void;
  onLogout: () => void;
}

export const MobileMoreModal: React.FC<MobileMoreModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onNavigate,
  onOpenAuthModal,
  onSwitchPersona,
  onLogout
}) => {
  const { t, isRtl, language } = useLanguage();

  if (!isOpen) return null;

  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const handleItemClick = (view: string) => {
    onNavigate(view);
    onClose();
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
              {currentUser.name_ar?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900">
                {currentUser.name_ar || currentUser.name}
              </div>
              <div className="text-[10px] text-emerald-800 font-semibold">
                {currentUser.role === 'admin'
                  ? t.roleAdmin
                  : currentUser.role === 'teacher'
                  ? t.roleTeacher
                  : t.roleStudent}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Learning Hub Links */}
        <div className="space-y-1">
          <button
            onClick={() => handleItemClick('classroom')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-50 hover:bg-stone-100 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">{t.navClassroom}</div>
                <div className="text-[10px] text-stone-500">
                  {language === 'ha' ? 'Kallon bidiyo da sauraren darussa' : language === 'en' ? 'Watch video lectures and listen to podcasts' : 'مشاهدة الفيديوهات والاستماع للدروس'}
                </div>
              </div>
            </div>
            <ChevronIcon className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={() => handleItemClick('exams')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-50 hover:bg-stone-100 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">{t.navExams}</div>
                <div className="text-[10px] text-stone-500">
                  {language === 'ha' ? 'Amsa jarabawa da duba maki' : language === 'en' ? 'Take assessments and view results' : 'أداء الاختبارات ومراجعة النتائج'}
                </div>
              </div>
            </div>
            <ChevronIcon className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={() => handleItemClick('certificates')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-stone-50 hover:bg-stone-100 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">{t.navCertificates}</div>
                <div className="text-[10px] text-stone-500">
                  {language === 'ha' ? 'Duba da buga takardun shaida da QR code' : language === 'en' ? 'Preview and print verified certificates' : 'معاينة وطباعة الشهادات والتحقق بالـ QR'}
                </div>
              </div>
            </div>
            <ChevronIcon className="w-4 h-4 text-stone-400" />
          </button>

          {isTeacherOrAdmin && (
            <button
              onClick={() => handleItemClick('teacher_workspace')}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950">{t.navTeacher}</div>
                  <div className="text-[10px] text-emerald-700">
                    {language === 'ha' ? 'Sanya maki da duba rubutun dalibai' : language === 'en' ? 'Evaluate essays and student submissions' : 'رصد درجات الطلاب ومراجعة المقالي'}
                  </div>
                </div>
              </div>
              <ChevronIcon className="w-4 h-4 text-emerald-700" />
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => handleItemClick('admin_console')}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-950">{t.navAdmin}</div>
                  <div className="text-[10px] text-amber-800">
                    {language === 'ha' ? 'Saitunan tambari, sa hannu, da malamai' : language === 'en' ? 'Upload logo, signature, and faculty management' : 'تخصيص الشعار، التوقيع، والمدرسين'}
                  </div>
                </div>
              </div>
              <ChevronIcon className="w-4 h-4 text-amber-700" />
            </button>
          )}
        </div>

        {/* Quick persona switcher */}
        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-700">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-800" /> {t.quickPersonaSwitch}:
            </span>
            <button
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              className="text-emerald-800 underline font-bold"
            >
              {t.loginWithOtherAccount}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => {
                onSwitchPersona('student');
                onClose();
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                currentUser.role === 'student'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white text-stone-700 border border-stone-200'
              }`}
            >
              {language === 'ha' ? 'Dalibi' : language === 'en' ? 'Student' : 'طالب'}
            </button>
            <button
              onClick={() => {
                onSwitchPersona('teacher');
                onClose();
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                currentUser.role === 'teacher'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white text-stone-700 border border-stone-200'
              }`}
            >
              {language === 'ha' ? 'Malami' : language === 'en' ? 'Teacher' : 'معلّم'}
            </button>
            <button
              onClick={() => {
                onSwitchPersona('admin');
                onClose();
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                currentUser.role === 'admin'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white text-stone-700 border border-stone-200'
              }`}
            >
              {language === 'ha' ? 'Darakta' : language === 'en' ? 'Admin' : 'مشرف'}
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-50"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.logoutBtn}</span>
        </button>
      </div>
    </div>
  );
};
