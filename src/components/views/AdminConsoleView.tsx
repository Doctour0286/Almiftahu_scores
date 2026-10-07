import React, { useState } from 'react';
import {
  Shield,
  Building,
  BookOpen,
  Users,
  Plus,
  Save,
  Check,
  Trash2,
  Mic,
  KeyRound,
  Copy,
  Printer,
  CheckCircle2,
  Search,
  Download,
  ExternalLink,
  X
} from 'lucide-react';
import { Course, InstitutionSettings, UserAccount } from '../../types/lms';
import { store } from '../../services/storage';
import { ImageUpload } from '../common/ImageUpload';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminConsoleViewProps {
  currentUser: UserAccount;
  courses: Course[];
  institutionSettings: InstitutionSettings;
  onRefreshCourses: () => void;
  onRefreshSettings: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUser,
  courses,
  institutionSettings,
  onRefreshCourses,
  onRefreshSettings
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'institution' | 'courses' | 'teachers' | 'student_codes'>('student_codes');

  // Institution settings state
  const [settingsForm, setSettingsForm] = useState<InstitutionSettings>({
    ...institutionSettings
  });
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

  // Student Codes state
  const [studentCodeSearch, setStudentCodeSearch] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedSlipStudent, setSelectedSlipStudent] = useState<any | null>(null);

  // New Course modal state
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseNameAr, setCourseNameAr] = useState('');
  const [courseNameEn, setCourseNameEn] = useState('');
  const [courseInstructorAr, setCourseInstructorAr] = useState('');
  const [coursePassMark, setCoursePassMark] = useState(70);
  const [courseDescAr, setCourseDescAr] = useState('');
  const [courseBanner, setCourseBanner] = useState('');
  const [courseHasAudioMemo, setCourseHasAudioMemo] = useState(true);

  // Teacher accounts state
  const [teachers, setTeachers] = useState<UserAccount[]>(
    store.getUsers().filter((u) => u.role === 'teacher' || u.role === 'admin')
  );
  const [isNewTeacherOpen, setIsNewTeacherOpen] = useState(false);
  const [tNameAr, setTNameAr] = useState('');
  const [tNameEn, setTNameEn] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tPassword, setTPassword] = useState('');
  const [tTitleAr, setTTitleAr] = useState('Malami Mai Bada Horon');
  const [tAssignedCode, setTAssignedCode] = useState('ALL');
  const [teacherMsg, setTeacherMsg] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    store.saveInstitutionSettings(settingsForm);
    onRefreshSettings();
    setSettingsSaveMsg(
      language === 'ha'
        ? 'An ajiye sabbin saitunan makaranta da hoton tambari da sa hannu cikin nasara!'
        : language === 'en'
        ? 'Institution settings, logo, and signatory images successfully saved!'
        : 'تم حفظ وتحديث إعدادات المعهد وصور الشعار والتوقيع بنجاح!'
    );
    setTimeout(() => setSettingsSaveMsg(null), 3000);
  };

  const handleToggleCourseAudio = (courseId: string) => {
    const allCourses = store.getCourses();
    const target = allCourses.find((c) => c.id === courseId);
    if (target) {
      target.has_audio_memorization = !target.has_audio_memorization;
      store.saveCourses(allCourses);
      onRefreshCourses();
    }
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseNameAr || !courseCode) return;

    store.createCourse({
      code: courseCode,
      name: courseNameEn || courseNameAr,
      name_ar: courseNameAr,
      instructor_name_ar: courseInstructorAr || currentUser.name_ar,
      pass_mark: coursePassMark,
      description_ar: courseDescAr,
      banner_image: courseBanner,
      has_audio_memorization: courseHasAudioMemo
    });

    onRefreshCourses();
    setIsNewCourseOpen(false);
    setCourseCode('');
    setCourseNameAr('');
    setCourseNameEn('');
    setCourseInstructorAr('');
    setCourseDescAr('');
    setCourseBanner('');
    setCourseHasAudioMemo(true);
  };

  const handleCreateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherMsg(null);
    try {
      store.createTeacher({
        name: tNameEn || tNameAr,
        name_ar: tNameAr,
        email: tEmail,
        title: 'Instructor',
        title_ar: tTitleAr,
        assigned_courses: [tAssignedCode]
      });

      setTeachers(store.getUsers().filter((u) => u.role === 'teacher' || u.role === 'admin'));
      setIsNewTeacherOpen(false);
      setTNameAr('');
      setTNameEn('');
      setTEmail('');
      setTPassword('');
      setTeacherMsg(
        language === 'ha'
          ? 'An bude sabon asusun malami cikin nasara.'
          : language === 'en'
          ? 'New instructor account created successfully.'
          : 'تم إنشاء حساب المعلم بنجاح.'
      );
      setTimeout(() => setTeacherMsg(null), 3000);
    } catch (err: any) {
      setTeacherMsg(err.message);
    }
  };

  const handleDeleteTeacher = (id: string) => {
    if (confirm(language === 'ha' ? 'Kana son goge wannan asusun malami?' : 'Are you sure you want to delete this teacher account?')) {
      store.deleteTeacher(id);
      setTeachers(store.getUsers().filter((u) => u.role === 'teacher' || u.role === 'admin'));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Console Header */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xl shadow-xs">
              <Shield className="w-7 h-7 text-stone-950" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                {t.adminConsoleTitle}
              </span>
              <h2 className="font-arabic-heading text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
                {t.adminConsoleHeading}
              </h2>
              <p className="text-xs text-stone-500">
                {currentUser.name_ar} &bull; {t.adminConsoleSubtitle}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('student_codes')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'student_codes'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>{language === 'ha' ? 'Lambobin Dalibai' : 'Student Codes'}</span>
            </button>

            <button
              onClick={() => setActiveTab('institution')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'institution'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>{t.tabInstitutionIdentity}</span>
            </button>

            <button
              onClick={() => setActiveTab('courses')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'courses'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.tabCoursesManagement}</span>
            </button>

            <button
              onClick={() => setActiveTab('teachers')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === 'teachers'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t.tabFacultyStaff}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Institution & Certificate Settings (UPLOAD WIDGETS!) */}
      {activeTab === 'institution' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="font-arabic-heading text-lg font-bold text-stone-900">
                  {t.institutionSettingsTitle}
                </h3>
                <p className="text-xs text-stone-500">
                  {t.institutionSettingsDesc}
                </p>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{t.saveChangesBtn}</span>
              </button>
            </div>

            {settingsSaveMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4" /> {settingsSaveMsg}
              </div>
            )}

            {/* Institution Image Uploads: LOGO & SIGNATURE (STRICTLY UPLOADS, NO URL LINKS!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80">
              {/* Institution Logo Upload */}
              <div>
                <ImageUpload
                  label={t.logoUploadLabel}
                  description={t.logoUploadDesc}
                  value={settingsForm.logo_data_url}
                  onChange={(dataUrl) =>
                    setSettingsForm({ ...settingsForm, logo_data_url: dataUrl })
                  }
                  aspectRatioHint="PNG, SVG, JPG (Max 5MB)"
                  previewHeightClass="h-20"
                />
              </div>

              {/* Signatory Signature Image Upload */}
              <div>
                <ImageUpload
                  label={t.signatureUploadLabel}
                  description={t.signatureUploadDesc}
                  value={settingsForm.signature_data_url}
                  onChange={(dataUrl) =>
                    setSettingsForm({ ...settingsForm, signature_data_url: dataUrl })
                  }
                  aspectRatioHint="PNG, SVG, JPG (Max 5MB)"
                  previewHeightClass="h-16"
                />
              </div>
            </div>

            {/* Text Configuration Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.instNameEnLabel}
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.name_en}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, name_en: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.instNameArLabel}
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.name_ar}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, name_ar: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden font-arabic-heading"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.signatoryNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.signatory_name_ar}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      signatory_name_ar: e.target.value
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.signatoryTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.signatory_title_ar}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      signatory_title_ar: e.target.value
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.certPrefixLabel}
                </label>
                <input
                  type="text"
                  required
                  value={settingsForm.certificate_prefix}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      certificate_prefix: e.target.value
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {t.defaultWordingLabel}
              </label>
              <textarea
                rows={3}
                required
                value={settingsForm.default_wording_ar}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    default_wording_ar: e.target.value
                  })
                }
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden leading-relaxed"
              />
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Course Management & Course Creator */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-arabic-heading text-lg font-bold text-stone-900">
                  {t.coursesListTitle}
                </h3>
                <p className="text-xs text-stone-500">
                  {t.coursesListDesc}
                </p>
              </div>

              <button
                onClick={() => setIsNewCourseOpen(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNewCourseBtn}</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                        {course.code}
                      </span>
                      <h4 className="font-arabic-heading text-base font-bold text-stone-900">
                        {course.name_ar}
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
                      <span>Instructor: {course.instructor_name_ar}</span>
                      <span>&bull;</span>
                      <span>{course.units.length} {t.unitsCount}</span>
                      <span>&bull;</span>
                      <span>{t.coursePassMarkLabel}: {course.pass_mark}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleCourseAudio(course.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        course.has_audio_memorization !== false
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                      }`}
                      title="Toggle Audio Memorization Option"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>
                        {course.has_audio_memorization !== false
                          ? language === 'ha'
                            ? 'Hadda: Akwai'
                            : language === 'en'
                            ? 'Audio: On'
                            : 'تسميع: مفعّل'
                          : language === 'ha'
                          ? 'Hadda: Babu'
                          : language === 'en'
                          ? 'Audio: Off'
                          : 'تسميع: معطّل'}
                      </span>
                    </button>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      {t.activeCourseBadge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Course Modal */}
          {isNewCourseOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
            >
              <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
                  <h3 className="font-arabic-heading text-lg font-bold">
                    {t.createCourseModalTitle}
                  </h3>
                  <button
                    onClick={() => setIsNewCourseOpen(false)}
                    className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                  >
                    {t.cancelBtn}
                  </button>
                </div>

                <form onSubmit={handleCreateCourse} className="p-6 space-y-4 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.courseCodeLabel}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="TAFSEER_101"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs uppercase font-mono outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.coursePassMarkLabel}
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={100}
                        value={coursePassMark}
                        onChange={(e) => setCoursePassMark(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.courseNameArLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tafsirin Alkur'ani (تفسير القرآن الكريم)"
                      value={courseNameAr}
                      onChange={(e) => setCourseNameAr(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.courseNameEnLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="Quranic Exegesis and Tafseer"
                      value={courseNameEn}
                      onChange={(e) => setCourseNameEn(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.courseInstructorLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. Ibrahim Al-Madani"
                      value={courseInstructorAr}
                      onChange={(e) => setCourseInstructorAr(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.courseDescLabel}
                    </label>
                    <textarea
                      rows={3}
                      value={courseDescAr}
                      onChange={(e) => setCourseDescAr(e.target.value)}
                      placeholder="Bayanin makasudin darasi da abubuwan da za a koya..."
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden leading-relaxed"
                    />
                  </div>

                  {/* Banner Image Upload widget */}
                  <div>
                    <ImageUpload
                      label={t.courseBannerUploadLabel}
                      value={courseBanner}
                      onChange={(url) => setCourseBanner(url)}
                      aspectRatioHint="16:9 Image (PNG, JPG)"
                    />
                  </div>

                  {/* Audio Memorization Option Toggle */}
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={courseHasAudioMemo}
                        onChange={(e) => setCourseHasAudioMemo(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-emerald-700 accent-emerald-700 rounded cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">
                          {t.courseToggleAudioMemoLabel}
                        </span>
                        <span className="text-[11px] text-stone-500 block mt-0.5 leading-relaxed">
                          {t.courseToggleAudioMemoDesc}
                        </span>
                      </div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    {t.publishCourseBtn}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Teacher Staff Accounts */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-arabic-heading text-lg font-bold text-stone-900">
                  {t.facultyListTitle}
                </h3>
                <p className="text-xs text-stone-500">
                  {t.facultyListDesc}
                </p>
              </div>

              <button
                onClick={() => setIsNewTeacherOpen(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNewTeacherBtn}</span>
              </button>
            </div>

            {teacherMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900">
                {teacherMsg}
              </div>
            )}

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {teacher.name_ar?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                          {teacher.name_ar}
                        </h4>
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded font-medium">
                          {teacher.title_ar || 'Instructor'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
                        <span>{teacher.email}</span>
                        <span>&bull;</span>
                        <span>
                          {teacher.assigned_courses?.includes('ALL')
                            ? t.allCoursesOption
                            : teacher.assigned_courses?.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {teacher.id !== currentUser.id && teacher.email !== 'admin@almiftahu.edu' && (
                    <button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors self-end sm:self-auto"
                      title="Delete Teacher Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* New Teacher Modal */}
          {isNewTeacherOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
            >
              <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
                  <h3 className="font-arabic-heading text-lg font-bold">
                    {t.createTeacherModalTitle}
                  </h3>
                  <button
                    onClick={() => setIsNewTeacherOpen(false)}
                    className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                  >
                    {t.cancelBtn}
                  </button>
                </div>

                <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.teacherNameArLabel}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Sheikh Usman Saleh"
                        value={tNameAr}
                        onChange={(e) => setTNameAr(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.teacherNameEnLabel}
                      </label>
                      <input
                        type="text"
                        placeholder="Sheikh Usman Saleh"
                        value={tNameEn}
                        onChange={(e) => setTNameEn(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.teacherLoginEmailLabel}
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="teacher2@almiftahu.edu"
                        value={tEmail}
                        onChange={(e) => setTEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t.teacherPasswordLabel}
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={tPassword}
                        onChange={(e) => setTPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.teacherTitleLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="Malamin Fikihu da Hadisi"
                      value={tTitleAr}
                      onChange={(e) => setTTitleAr(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.assignCourseSelectLabel}
                    </label>
                    <select
                      value={tAssignedCode}
                      onChange={(e) => setTAssignedCode(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden font-bold"
                    >
                      <option value="ALL">{t.allCoursesOption}</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name_ar} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    {t.saveTeacherAccountBtn}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Student Institution Codes & Access Slips (PRD Requirement) */}
      {activeTab === 'student_codes' && (
        <div className="space-y-6">
          {/* Institutional Overview & Notice Card */}
          <div className="p-5 rounded-3xl bg-linear-to-r from-amber-900 via-amber-800 to-amber-700 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">
                <KeyRound className="w-4 h-4" />
                <span>{language === 'ha' ? 'Hukumar Lambobin Shiga ta Makaranta' : 'Institution Access Registry'}</span>
              </div>
              <h3 className="font-arabic-heading text-xl sm:text-2xl font-bold mb-2">
                {language === 'ha'
                  ? 'Lambobin Rijistar Dalibai 31 (Official Institution Codes)'
                  : '31 Student Institution Access Codes'}
              </h3>
              <p className="text-xs sm:text-sm text-amber-100 max-w-3xl leading-relaxed">
                {language === 'ha'
                  ? 'Domin saukaka wa dalibai shiga manhaja ba tare da jiran sai kowa ya mallaki adireshin imel ba, makarantar ta samar da wadannan lambobin sirri na musamman (MIF-2026-XXX). Dalibai na iya shiga kai tsaye su fara karatu da tura karatun murya (audio recitation). Daga baya za a nemi kowane dalibi ya bayar da imel domin mayar da asusunsa zuwa ingantaccen tsaro mai kalmar sirri.'
                  : 'To ensure seamless onboarding without requiring emails upfront, students log in with their unique institution codes (MIF-2026-XXX). They can access lessons and submit vocal recitations immediately, pending when email-secured logins are issued.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-amber-600/60 text-xs">
                <div className="px-3 py-1 bg-amber-950/40 rounded-xl border border-amber-500/40 font-mono font-bold">
                  {language === 'ha' ? 'Dalibai Masu Aiki: 31' : 'Active Students: 31'}
                </div>
                <div className="px-3 py-1 bg-amber-950/40 rounded-xl border border-amber-500/40 font-mono font-bold text-amber-200">
                  {language === 'ha' ? 'Lambobi: MIF-2026-002 zuwa 049' : 'Format: MIF-2026-XXX'}
                </div>
                <div className="px-3 py-1 bg-emerald-900/60 rounded-xl border border-emerald-400/40 font-bold text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'ha' ? 'An Hada da Live DB' : 'Synced with DB'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Roster Table Card */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-arabic-heading text-lg font-bold text-stone-900">
                  {language === 'ha' ? 'Jerin Lambobin Rijista na Dalibai' : 'Student Access Codes Roster'}
                </h4>
                <p className="text-xs text-stone-500">
                  {language === 'ha'
                    ? 'Kwafi lambar kowane dalibi ko buga katunan shiga (access slip) don raba musu.'
                    : 'Copy individual student codes or print login slips for distribution.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const csvRows = [
                      ['SN', 'ID', 'Student Name', 'Arabic Name', 'Institution Code', 'Course'].join(','),
                      ...store.getStudentCodes().map((s) =>
                        [s.sn, s.id, `"${s.name}"`, `"${s.name_ar}"`, s.institution_code, 'ADAB'].join(',')
                      )
                    ].join('\n');
                    const blob = new Blob([csvRows], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Almiftahu_Student_Codes_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                  }}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{language === 'ha' ? 'Fitar da CSV' : 'Export CSV'}</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder={
                  language === 'ha'
                    ? 'Nemi dalibi da suna, SN, ko lambar MIF-2026-XXX...'
                    : 'Search by student name, SN, or code...'
                }
                value={studentCodeSearch}
                onChange={(e) => setStudentCodeSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-hidden focus:bg-white focus:border-emerald-700"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>

            {/* Students Table */}
            <div className="border border-stone-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                    <tr>
                      <th className="py-3 px-4">S/N</th>
                      <th className="py-3 px-4">{language === 'ha' ? 'Sunan Dalibi' : 'Student Name'}</th>
                      <th className="py-3 px-4 font-arabic">{language === 'ha' ? 'Sunan Larabci' : 'Arabic Name'}</th>
                      <th className="py-3 px-4">{language === 'ha' ? 'Lambar Makaranta (Code)' : 'Institution Code'}</th>
                      <th className="py-3 px-4">{language === 'ha' ? 'Manhaja' : 'Enrolled Course'}</th>
                      <th className="py-3 px-4 text-center">{language === 'ha' ? 'Ayyuka' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {store
                      .getStudentCodes()
                      .filter((s) => {
                        const q = studentCodeSearch.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) ||
                          (s.name_ar && s.name_ar.includes(q)) ||
                          s.institution_code.toLowerCase().includes(q) ||
                          String(s.sn).includes(q)
                        );
                      })
                      .map((stu) => {
                        const isCopied = copiedCodeId === stu.id;
                        return (
                          <tr key={stu.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-stone-500">#{stu.sn}</td>
                            <td className="py-3 px-4 font-bold text-stone-900">{stu.name}</td>
                            <td className="py-3 px-4 font-arabic text-stone-700">{stu.name_ar}</td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg inline-block">
                                {stu.institution_code}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-emerald-800">Al-Aadaab Al-Asharah</td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(stu.institution_code);
                                    setCopiedCodeId(stu.id);
                                    setTimeout(() => setCopiedCodeId(null), 2000);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    isCopied
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                  }`}
                                  title="Copy Code"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>An kwafe!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Kwafi</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => setSelectedSlipStudent(stu)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                  title="View Access Slip"
                                >
                                  <Printer className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Katin Shiga</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Student Access Slip Modal */}
          {selectedSlipStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-emerald-950 text-white p-5 relative border-b border-amber-400">
                  <button
                    onClick={() => setSelectedSlipStudent(null)}
                    className="absolute right-4 top-4 p-1.5 rounded-full text-emerald-300 hover:text-white hover:bg-emerald-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3">
                    {institutionSettings.logo_data_url ? (
                      <img
                        src={institutionSettings.logo_data_url}
                        alt="Logo"
                        className="w-12 h-12 rounded-2xl object-contain border border-amber-300 bg-white p-0.5"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold text-xl">
                        M
                      </div>
                    )}
                    <div>
                      <h4 className="font-arabic-heading text-base font-bold text-white">
                        {institutionSettings.name_ar}
                      </h4>
                      <p className="text-[11px] text-amber-300">
                        Takardar Lambar Shiga ta Dalibi (Access Slip)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center space-y-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Sunan Dalibi & Lambar Rajista
                    </span>
                    <h3 className="text-base font-bold text-stone-900">
                      {selectedSlipStudent.name}
                    </h3>
                    <div className="text-sm font-arabic font-bold text-emerald-800">
                      {selectedSlipStudent.name_ar}
                    </div>

                    <div className="pt-3 border-t border-stone-200">
                      <span className="text-[10px] font-bold text-amber-800 block mb-1">
                        LAMBAR SHIGA TA MUSAMMAN (INSTITUTION CODE):
                      </span>
                      <div className="inline-block px-5 py-2 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 font-mono font-bold text-lg tracking-widest shadow-2xs">
                        {selectedSlipStudent.institution_code}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80">
                    <div className="font-bold text-emerald-950 text-xs">Yadda Dalibi Zai Shiga Manhaja:</div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-900 leading-relaxed">
                      <li>Bude manhajar makaranta a waya ko kwamfuta.</li>
                      <li>Danna 'Shiga Asusu' sannan ka zabi 'Dalibi (Code)'.</li>
                      <li>Shigar da lambar nan: <strong className="font-mono">{selectedSlipStudent.institution_code}</strong></li>
                      <li>Fara karanta darussa da tura karatun murya (audio recitation)!</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500">
                    <div>
                      <div className="text-[10px] text-stone-400">Sa Hannun Shugaba:</div>
                      <div className="font-arabic font-bold text-stone-800 text-xs">
                        {institutionSettings.signatory_name_ar}
                      </div>
                    </div>
                    {institutionSettings.signature_data_url && (
                      <img
                        src={institutionSettings.signature_data_url}
                        alt="Signature"
                        className="h-8 object-contain"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Buga Katin (Print)</span>
                    </button>
                    <button
                      onClick={() => setSelectedSlipStudent(null)}
                      className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
                    >
                      Rufe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
