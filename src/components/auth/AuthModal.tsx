import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ArrowLeft, UserPlus, Check, ShieldCheck, GraduationCap, User } from 'lucide-react';
import { UserAccount } from '../../types/lms';
import { store } from '../../services/storage';
import { useLanguage } from '../../i18n/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess
}) => {
  const { t, isRtl, language } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration state
  const [regNameAr, setRegNameAr] = useState('');
  const [regNameEn, setRegNameEn] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNationality, setRegNationality] = useState('Hausa / Nigerian');
  const [regCountry, setRegCountry] = useState('Nigeria');
  const [regEducation, setRegEducation] = useState('Secondary School / College');
  const [regGender, setRegGender] = useState<'male' | 'female'>('male');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const user = store.login(email, password);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Kuskure wajen shiga. Duba imel da kalmar sirri.');
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setErrorMsg(null);
    try {
      const user = store.login(demoEmail, demoPass);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const newStudent = store.registerStudent({
        email: regEmail,
        password: regPassword,
        name: regNameEn || regNameAr,
        name_ar: regNameAr,
        nationality: regNationality,
        country: regCountry,
        education_level: regEducation,
        gender: regGender
      });
      setSuccessMsg(
        language === 'ha'
          ? 'An yi nasarar bude asusun dalibi! An shigar da kai kai tsaye.'
          : language === 'en'
          ? 'Student account registered successfully! Logged in.'
          : 'تم إنشاء الحساب بنجاح وتم تسجيل دخولك!'
      );
      setTimeout(() => {
        onLoginSuccess(newStudent);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'An sami matsala wajen bude asusu.');
    }
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-emerald-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-4 p-1.5 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold text-xl shadow-md">
              M
            </div>
            <div>
              <h3 className="font-arabic-heading text-xl font-bold text-white">
                {t.unifiedAccessPortal}
              </h3>
              <p className="text-xs text-emerald-200">
                {t.appName} &bull; {t.sloganRhyme}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 mt-5 bg-emerald-950/50 p-1 rounded-xl">
            <button
              onClick={() => {
                setTab('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              {t.existingAccountTab}
            </button>
            <button
              onClick={() => {
                setTab('register');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === 'register'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              {t.newStudentRegTab}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {t.emailLabel}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={language === 'ha' ? 'Imel ko kuma PIN na Malami' : language === 'en' ? 'Email or Teacher PIN' : 'البريد أو رقم المعلم السري'}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {t.passwordLabel}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <span>{t.enterPlatformBtn}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>

              {/* Quick Demo Accounts */}
              <div className="pt-4 border-t border-stone-100 mt-4">
                <span className="text-[10px] font-bold text-stone-400 block mb-2 text-center uppercase tracking-wider">
                  {t.quickDemoAccountsHeading}
                </span>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin@almiftahu.edu', 'admin')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900">
                          Musa Aminu Muhammad
                        </div>
                        <div className="text-[10px] text-amber-800">
                          {t.adminDemoDesc}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 underline">
                      {t.quickLoginLink}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('teacher@almiftahu.edu', 'teacher')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900">
                          Dr. Ibrahim Al-Madani
                        </div>
                        <div className="text-[10px] text-emerald-800">
                          {t.teacherDemoDesc}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 underline">
                      {t.quickLoginLink}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('student@almiftahu.edu', 'student')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-stone-700 text-white flex items-center justify-center text-xs font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900">
                          Ahmad Bello Abubakar
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {t.studentDemoDesc}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 underline">
                      {t.quickLoginLink}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.fullNameArLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={regNameAr}
                    onChange={(e) => setRegNameAr(e.target.value)}
                    placeholder="Ahmad Bello Abubakar"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.fullNameEnLabel}
                  </label>
                  <input
                    type="text"
                    value={regNameEn}
                    onChange={(e) => setRegNameEn(e.target.value)}
                    placeholder="Ahmad Bello"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.emailLabel} *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.passwordLabel} *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.nationalityLabel}
                  </label>
                  <input
                    type="text"
                    value={regNationality}
                    onChange={(e) => setRegNationality(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.countryResidenceLabel}
                  </label>
                  <input
                    type="text"
                    value={regCountry}
                    onChange={(e) => setRegCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.educationLevelLabel}
                  </label>
                  <input
                    type="text"
                    value={regEducation}
                    onChange={(e) => setRegEducation(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:border-emerald-700 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-3"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t.createAccountAndStudyBtn}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
