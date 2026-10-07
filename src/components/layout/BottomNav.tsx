import { Home, Calendar, Headphones, FileCheck, Award, GraduationCap, Shield, Menu } from 'lucide-react';
import { UserAccount } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenMoreMenu: () => void;
  currentUser?: UserAccount;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenMoreMenu,
  currentUser
}) => {
  const { t, language } = useLanguage();

  const getRoleTabs = () => {
    if (currentUser?.role === 'admin') {
      return [
        { id: 'admin_console', label: language === 'ha' ? 'Shugaba' : 'Console', icon: Shield },
        { id: 'teacher_workspace', label: language === 'ha' ? 'Maki' : 'Grading', icon: GraduationCap },
        { id: 'classroom', label: language === 'ha' ? 'Darussa' : 'Lessons', icon: Headphones },
      ];
    }
    if (currentUser?.role === 'teacher') {
      return [
        { id: 'teacher_workspace', label: language === 'ha' ? 'Zaure' : 'Review', icon: GraduationCap },
        { id: 'classroom', label: language === 'ha' ? 'Darussa' : 'Lessons', icon: Headphones },
        { id: 'certificates', label: language === 'ha' ? 'Shahada' : 'Certs', icon: Award },
      ];
    }
    return [
      { id: 'home', label: language === 'ha' ? 'Shafi' : 'Home', icon: Home },
      { id: 'classroom', label: language === 'ha' ? 'Darussa' : 'Lessons', icon: Headphones },
      { id: 'exams', label: language === 'ha' ? 'Jarabawa' : 'Exams', icon: FileCheck },
    ];
  };

  const tabs = getRoleTabs();
  const isMoreActive = !tabs.map(t => t.id).includes(currentView);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-stone-200/90 z-40 px-2 py-1 shadow-lg">
      <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[52px] ${
                isActive
                  ? 'text-emerald-800 font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4px] text-emerald-800' : 'stroke-[1.8px]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-700 rounded-full" />
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight truncate max-w-full ${isActive ? 'font-bold text-emerald-900' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={onOpenMoreMenu}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[52px] ${
            isMoreActive
              ? 'text-emerald-800 font-bold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <Menu className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.4px] text-emerald-800' : 'stroke-[1.8px]'}`} />
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-700 rounded-full" />
            )}
          </div>
          <span className={`text-[11px] mt-1 tracking-tight truncate max-w-full ${isMoreActive ? 'font-bold text-emerald-900' : 'font-medium'}`}>
            {t.navMore}
          </span>
        </button>
      </div>
    </nav>
  );
};
