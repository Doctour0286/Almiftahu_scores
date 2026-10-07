import React from 'react';
import {
  Home,
  Calendar,
  BookOpen,
  Headphones,
  FileCheck,
  Award,
  GraduationCap,
  Shield,
  LogOut,
  ChevronRight,
  ChevronLeft,
  UserCheck
} from 'lucide-react';
import { UserAccount, UserRole } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  currentUser: UserAccount;
  onOpenAuthModal: () => void;
  onSwitchPersona: (role: UserRole) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  institutionLogo?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onOpenAuthModal,
  onSwitchPersona,
  onLogout,
  collapsed,
  onToggleCollapsed,
  institutionLogo
}) => {
  const { t, isRtl, language } = useLanguage();
  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const navItems = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'schedule', label: t.navSchedule, icon: Calendar },
    { id: 'programs', label: t.navPrograms, icon: BookOpen },
    { id: 'classroom', label: t.navClassroom, icon: Headphones },
    { id: 'exams', label: t.navExams, icon: FileCheck },
    { id: 'certificates', label: t.navCertificates, icon: Award },
  ];

  const roleBadge = () => {
    switch (currentUser.role) {
      case 'admin':
        return { label: language === 'ha' ? 'Shugaba / Dean' : t.roleAdmin, bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'teacher':
        return { label: language === 'ha' ? 'Malami Mai Koyarwa' : t.roleTeacher, bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      default:
        return { label: language === 'ha' ? 'Dalibi Mai Rajista' : t.roleStudent, bg: 'bg-stone-100 text-stone-700 border-stone-300' };
    }
  };

  const badge = roleBadge();

  // Actor-specific navigation menu tailored to priorities
  const getRoleNavItems = () => {
    if (currentUser.role === 'admin') {
      return [
        { id: 'admin_console', label: language === 'ha' ? 'Ofishin Shugaba (Console)' : 'Principal Console', icon: Shield },
        { id: 'teacher_workspace', label: language === 'ha' ? 'Kula da Makin Dalibai' : 'Grading & Review', icon: GraduationCap },
        { id: 'classroom', label: language === 'ha' ? 'Manhajar Karatu (ADAB)' : 'Curriculum Viewer', icon: Headphones },
        { id: 'certificates', label: language === 'ha' ? 'Bada Shahadodi' : 'Certificates Authority', icon: Award },
        { id: 'home', label: language === 'ha' ? 'Babban Shafi' : t.navHome, icon: Home }
      ];
    }
    if (currentUser.role === 'teacher') {
      return [
        { id: 'teacher_workspace', label: language === 'ha' ? 'Zauren Malami (Audio & Grades)' : 'Teacher Workspace', icon: GraduationCap },
        { id: 'classroom', label: language === 'ha' ? 'Tsarin Darussa (ADAB)' : 'Lesson Lessons', icon: Headphones },
        { id: 'certificates', label: language === 'ha' ? 'Duba Shahadodi' : 'Certificates', icon: Award },
        { id: 'home', label: language === 'ha' ? 'Babban Shafi' : t.navHome, icon: Home }
      ];
    }
    // Student navigation (Focused purely on learning)
    return [
      { id: 'home', label: language === 'ha' ? 'Babban Shafi (My Studies)' : t.navHome, icon: Home },
      { id: 'classroom', label: language === 'ha' ? 'Karatun Darasi & Murya' : t.navClassroom, icon: Headphones },
      { id: 'exams', label: language === 'ha' ? 'Jarabawa' : t.navExams, icon: FileCheck },
      { id: 'certificates', label: language === 'ha' ? 'Takardar Shaida' : t.navCertificates, icon: Award },
      { id: 'schedule', label: language === 'ha' ? 'Jadawali' : t.navSchedule, icon: Calendar }
    ];
  };

  const currentNavItems = getRoleNavItems();

  return (
    <aside
      className={`hidden md:flex flex-col bg-white ${
        isRtl ? 'border-l' : 'border-r'
      } border-stone-200/80 transition-all duration-200 shrink-0 select-none z-30 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-emerald-900 text-white flex items-center justify-center p-1 shrink-0 shadow-xs border border-amber-300/80">
            {institutionLogo ? (
              <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            ) : (
              <GraduationCap className="w-7 h-7 text-amber-300" />
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-arabic-heading text-base font-bold text-stone-900 tracking-tight leading-tight truncate">
                {t.appName}
              </h1>
              <p className="text-[10px] text-emerald-800 font-semibold tracking-wide truncate">
                {language === 'ha'
                  ? 'Mabudin Ilimi da Nasara'
                  : language === 'en'
                  ? 'Key to Sacred Knowledge'
                  : 'مفتاح العلوم الشرعية'}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapsed}
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* User profile capsule */}
      <div className="p-3 border-b border-stone-100 bg-stone-50/50">
        {!collapsed ? (
          <div className="p-2.5 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-900 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-300/50">
                {currentUser.name_ar ? currentUser.name_ar.charAt(0) : 'M'}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-bold text-stone-900 truncate">
                  {currentUser.name_ar || currentUser.name}
                </div>
                <div className="text-[10px] text-stone-500 truncate">
                  {currentUser.title || currentUser.name}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-stone-100">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                {badge.label}
              </span>
              {currentUser.role === 'student' && (
                <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                  {currentUser.institution_code || `MIF-2026-${String(currentUser.sn || 1).padStart(3, '0')}`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className="w-10 h-10 rounded-xl bg-emerald-900 text-amber-300 flex items-center justify-center font-bold text-sm border border-amber-300/50"
              title={`${currentUser.name_ar} (${badge.label})`}
            >
              {currentUser.name_ar ? currentUser.name_ar.charAt(0) : 'M'}
            </div>
          </div>
        )}
      </div>

      {/* Main Role-Specific Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[10px] font-bold text-stone-400 px-3 mb-2 uppercase tracking-wider">
          {!collapsed && (
            currentUser.role === 'admin'
              ? (language === 'ha' ? 'Hukumar Gudanarwa' : 'Executive Console')
              : currentUser.role === 'teacher'
              ? (language === 'ha' ? 'Kula da Karatu' : 'Faculty Workspace')
              : (language === 'ha' ? 'Sashen Karatun Dalibi' : 'Student Learning')
          )}
        </div>

        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
              title={item.label}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-amber-300' : 'text-stone-500'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Bottom Switch Account & Logout */}
      <div className="p-3 border-t border-stone-200/80 space-y-2 bg-stone-50/40">
        {!collapsed ? (
          <div className="p-2.5 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-2">
            <div className="text-[10px] text-stone-500 leading-tight">
              {currentUser.role === 'student' ? (
                <span>Asusun dalibi mai lambar: <strong className="font-mono text-emerald-800">{currentUser.institution_code || `MIF-${currentUser.sn}`}</strong></span>
              ) : currentUser.role === 'teacher' ? (
                <span>Asusun malami mai koyarwa</span>
              ) : (
                <span>Ofishin shugaban makaranta</span>
              )}
            </div>

            <button
              onClick={onOpenAuthModal}
              className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-emerald-200"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{language === 'ha' ? 'Canza Asusu (Switch / Log in)' : 'Switch Account / Log in'}</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={onOpenAuthModal}
              className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
              title="Switch Account"
            >
              <UserCheck className="w-5 h-5" />
            </button>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-2 text-xs font-bold text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
          title={t.logoutBtn}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{t.logoutBtn}</span>}
        </button>
      </div>
    </aside>
  );
};
