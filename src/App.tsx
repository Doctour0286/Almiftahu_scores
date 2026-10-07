import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TopHeader } from './components/layout/TopHeader';
import { AuthModal } from './components/auth/AuthModal';
import { MobileMoreModal } from './components/layout/MobileMoreModal';
import { HomeView } from './components/views/HomeView';
import { ScheduleView } from './components/views/ScheduleView';
import { ProgramsView } from './components/views/ProgramsView';
import { LessonPlayerView } from './components/views/LessonPlayerView';
import { ExamsView } from './components/views/ExamsView';
import { CertificatesView } from './components/views/CertificatesView';
import { TeacherWorkspaceView } from './components/views/TeacherWorkspaceView';
import { AdminConsoleView } from './components/views/AdminConsoleView';
import { store, subscribeToStore } from './services/storage';
import { UserRole } from './types/lms';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

function LmsContent() {
  const { dir, isRtl } = useLanguage();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [courses, setCourses] = useState(store.getCourses());
  const [activeCourseId, setActiveCourseId] = useState(store.getActiveCourseId());
  const [institutionSettings, setInstitutionSettings] = useState(store.getInstitutionSettings());
  const [progress, setProgress] = useState(store.getStudentProgress());
  const [certificates, setCertificates] = useState(store.getCertificates());

  const [currentView, setCurrentView] = useState<string>(() => {
    const user = store.getCurrentUser();
    if (user.role === 'admin') return 'admin_console';
    if (user.role === 'teacher') return 'teacher_workspace';
    return 'home';
  });
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMoreModalOpen, setIsMoreModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      setCurrentUser(store.getCurrentUser());
      setCourses(store.getCourses());
      setActiveCourseId(store.getActiveCourseId());
      setInstitutionSettings(store.getInstitutionSettings());
      setProgress(store.getStudentProgress());
      setCertificates(store.getCertificates());
    });
    return unsubscribe;
  }, []);

  const handleSelectCourse = (id: string) => {
    setActiveCourseId(id);
    store.setActiveCourseId(id);
  };

  const handleNavigate = (view: string, lessonId?: string) => {
    if (currentUser.role === 'student' && (view === 'admin_console' || view === 'teacher_workspace')) {
      setCurrentView('home');
      return;
    }
    setCurrentView(view);
    if (lessonId) {
      setSelectedLessonId(lessonId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLessonCompleted = (lessonId: string) => {
    store.markLessonCompleted(lessonId);
    setProgress(store.getStudentProgress());
  };

  const handleSwitchPersona = (role: UserRole) => {
    store.switchPersona(role);
    const updated = store.getCurrentUser();
    setCurrentUser(updated);

    if (role === 'admin') {
      setCurrentView('admin_console');
    } else if (role === 'teacher') {
      setCurrentView('teacher_workspace');
    } else {
      setCurrentView('home');
    }
  };

  const handleLogout = () => {
    store.logout();
    setIsAuthModalOpen(true);
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0];

  return (
    <div dir={dir} className="min-h-screen bg-[#fbf9f5] flex flex-col font-sans transition-all">
      <div className="flex-1 flex w-full">
        {/* Responsive Desktop Collapsible Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => handleNavigate(view)}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onSwitchPersona={handleSwitchPersona}
          onLogout={handleLogout}
          collapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          institutionLogo={institutionSettings.logo_data_url}
        />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopHeader
            courses={courses}
            activeCourseId={activeCourseId}
            onSelectCourse={handleSelectCourse}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onNavigate={(view) => handleNavigate(view)}
            institutionLogo={institutionSettings.logo_data_url}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {currentView === 'home' && (
              <HomeView
                activeCourse={activeCourse}
                currentUser={currentUser}
                progress={progress}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'schedule' && (
              <ScheduleView
                courses={courses}
                progress={progress}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'programs' && (
              <ProgramsView
                courses={courses}
                activeCourse={activeCourse}
                progress={progress}
                onSelectCourse={handleSelectCourse}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'classroom' && (
              <LessonPlayerView
                course={activeCourse}
                initialLessonId={selectedLessonId}
                progress={progress}
                onLessonCompleted={handleLessonCompleted}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'exams' && (
              <ExamsView
                course={activeCourse}
                currentUser={currentUser}
                onNavigateToCertificates={() => handleNavigate('certificates')}
              />
            )}

            {currentView === 'certificates' && (
              <CertificatesView
                certificates={certificates}
                institutionSettings={institutionSettings}
              />
            )}

            {currentView === 'teacher_workspace' && (
              <TeacherWorkspaceView
                currentUser={currentUser}
                courses={courses}
                onCourseSelect={(id) => {
                  handleSelectCourse(id);
                  handleNavigate('classroom');
                }}
              />
            )}

            {currentView === 'admin_console' && (
              <AdminConsoleView
                currentUser={currentUser}
                courses={courses}
                institutionSettings={institutionSettings}
                onRefreshCourses={() => setCourses(store.getCourses())}
                onRefreshSettings={() => setInstitutionSettings(store.getInstitutionSettings())}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed 4-Tab Navigation Anchor) */}
      <BottomNav
        currentView={currentView}
        onNavigate={(view) => handleNavigate(view)}
        onOpenMoreMenu={() => setIsMoreModalOpen(true)}
        currentUser={currentUser}
      />

      {/* Mobile More Sheet */}
      <MobileMoreModal
        isOpen={isMoreModalOpen}
        onClose={() => setIsMoreModalOpen(false)}
        currentUser={currentUser}
        onNavigate={(view) => handleNavigate(view)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSwitchPersona={handleSwitchPersona}
        onLogout={handleLogout}
      />

      {/* Unified Login & Student Registration Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          if (user.role === 'admin') {
            setCurrentView('admin_console');
          } else if (user.role === 'teacher') {
            setCurrentView('teacher_workspace');
          } else {
            setCurrentView('home');
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LmsContent />
    </LanguageProvider>
  );
}
