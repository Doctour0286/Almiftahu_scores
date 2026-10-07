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
        return { label: t.roleAdmin, bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'teacher':
        return { label: t.roleTeacher, bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      default:
        return { label: t.roleStudent, bg: 'bg-stone-100 text-stone-700 border-stone-300' };
    }
  };

  const badge = roleBadge();

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
          <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-stone-200/80 shadow-2xs">
            <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser.name_ar ? currentUser.name_ar.charAt(0) : 'M'}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-stone-900 truncate">
                {currentUser.name_ar || currentUser.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-sm border ${badge.bg}`}>
                  {badge.label}
                </span>
                {currentUser.sn && (
                  <span className="text-[10px] text-stone-400">
                    #{currentUser.sn}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className="w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-sm"
              title={`${currentUser.name_ar} (${badge.label})`}
            >
              {currentUser.name_ar ? currentUser.name_ar.charAt(0) : 'M'}
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[10px] font-bold text-stone-400 px-3 mb-2 uppercase tracking-wider">
          {!collapsed && t.learningPortals}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
              }`}
              title={item.label}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-amber-300' : 'text-stone-500'}`} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Role Workspace Navigation */}
        {isTeacherOrAdmin && (
          <>
            <div className="pt-4 pb-1 text-[10px] font-bold text-stone-400 px-3 uppercase tracking-wider">
              {!collapsed && t.staffTools}
            </div>

            <button
              onClick={() => onNavigate('teacher_workspace')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'teacher_workspace'
                  ? 'bg-emerald-800 text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-emerald-50 hover:text-emerald-950'
              }`}
              title={t.navTeacher}
            >
              <GraduationCap className={`w-5 h-5 shrink-0 ${currentView === 'teacher_workspace' ? 'text-amber-300' : 'text-emerald-700'}`} />
              {!collapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>{t.navTeacher}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    Marking
                  </span>
                </div>
              )}
            </button>
          </>
        )}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 text-[10px] font-bold text-stone-400 px-3 uppercase tracking-wider">
              {!collapsed && t.adminGovernance}
            </div>

            <button
              onClick={() => onNavigate('admin_console')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'admin_console'
                  ? 'bg-emerald-800 text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-amber-50 hover:text-amber-950'
              }`}
              title={t.navAdmin}
            >
              <Shield className={`w-5 h-5 shrink-0 ${currentView === 'admin_console' ? 'text-amber-300' : 'text-amber-700'}`} />
              {!collapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>{t.navAdmin}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                    Admin
                  </span>
                </div>
              )}
            </button>
          </>
        )}
      </div>

      {/* Bottom Switcher & Logout */}
      <div className="p-3 border-t border-stone-200/80 space-y-2 bg-stone-50/40">
        {!collapsed ? (
          <div className="p-2.5 bg-white border border-stone-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-stone-500 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-800" /> {t.quickPersonaSwitch}
              </span>
              <button
                onClick={onOpenAuthModal}
                className="text-[10px] text-emerald-800 hover:underline font-bold"
              >
                {t.loginBtn}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => onSwitchPersona('student')}
                className={`py-1 text-[10px] font-bold rounded transition-colors ${
                  currentUser.role === 'student'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {language === 'ha' ? 'Dalibi' : language === 'en' ? 'Student' : 'طالب'}
              </button>
              <button
                onClick={() => onSwitchPersona('teacher')}
                className={`py-1 text-[10px] font-bold rounded transition-colors ${
                  currentUser.role === 'teacher'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {language === 'ha' ? 'Malami' : language === 'en' ? 'Teacher' : 'معلّم'}
              </button>
              <button
                onClick={() => onSwitchPersona('admin')}
                className={`py-1 text-[10px] font-bold rounded transition-colors ${
                  currentUser.role === 'admin'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {language === 'ha' ? 'Darakta' : language === 'en' ? 'Admin' : 'مشرف'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={onOpenAuthModal}
              className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
              title={t.loginBtn}
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
