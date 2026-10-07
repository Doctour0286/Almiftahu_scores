import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  GraduationCap,
  User,
  KeyRound,
  Search,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Database
} from 'lucide-react';
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
  // Role-oriented clean login tabs
  const [actorRole, setActorRole] = useState<'student' | 'teacher' | 'admin'>('student');

  // Student Code State
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [showRosterLookup, setShowRosterLookup] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // Staff Credentials State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const allStudents = store.getUsers().filter((u) => u.role === 'student');
  const filteredStudents = allStudents.filter((s) => {
    const q = rosterSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.name_ar && s.name_ar.includes(q)) ||
      (s.institution_code && s.institution_code.toLowerCase().includes(q)) ||
      String(s.sn).includes(q)
    );
  });

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const user = store.loginStudentWithCode(studentCodeInput);
      setSuccessMsg(
        language === 'ha'
          ? `Barka da zuwa ${user.name_ar || user.name}! An shiga dandalin dalibi.`
          : `Welcome ${user.name}! Logged in successfully.`
      );
      setTimeout(() => {
        onLoginSuccess(user);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lambar ba daidai ba ce. Tabbatar da lambar rajistarka.');
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const user = await store.loginStaff(email, password);
      setSuccessMsg(
        language === 'ha'
          ? `Barka da zuwa ${user.name_ar || user.name}! An tabbatar da asusunka daga DB.`
          : `Authenticated successfully as ${user.name}!`
      );
      setTimeout(() => {
        onLoginSuccess(user);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Imel ko kalmar sirri ba daidai ba ne.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectStudentFromRoster = (student: UserAccount) => {
    const code = student.institution_code || `MIF-2026-${String(student.sn || 1).padStart(3, '0')}`;
    setStudentCodeInput(code);
    setShowRosterLookup(false);
    setErrorMsg(null);
  };

  const autofillStaff = (staffEmail: string, staffPass: string, role: 'teacher' | 'admin') => {
    setActorRole(role);
    setEmail(staffEmail);
    setPassword(staffPass);
    setErrorMsg(null);
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white p-5 relative border-b border-emerald-900">
          <button
            onClick={onClose}
            className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-4 p-1.5 rounded-full text-emerald-300 hover:text-white hover:bg-emerald-900 transition-colors`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold text-xl shadow-md border border-amber-300">
              M
            </div>
            <div>
              <h3 className="font-arabic-heading text-lg sm:text-xl font-bold text-white">
                {language === 'ha'
                  ? 'Kofar Shiga Makarantar Miftahul Ilmi'
                  : language === 'en'
                  ? 'Almiftahu Access Portal'
                  : 'بوابة تسجيل الدخول إلى المعهد'}
              </h3>
              <p className="text-xs text-emerald-200">
                {language === 'ha'
                  ? 'Bayanai na asali kai tsaye daga rumbun adana bayanai (Live DB)'
                  : language === 'en'
                  ? 'Direct authentication connected to live database'
                  : 'بيانات أصلية وموثقة من قاعدة البيانات'}
              </p>
            </div>
          </div>

          {/* Actor Selector (Personalised 3-Way Selector) */}
          <div className="grid grid-cols-3 gap-1.5 mt-5 bg-emerald-900/70 p-1.5 rounded-2xl">
            <button
              onClick={() => {
                setActorRole('student');
                setErrorMsg(null);
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
                actorRole === 'student'
                  ? 'bg-white text-emerald-950 shadow-md font-bold'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{language === 'ha' ? 'Dalibi (Code)' : 'Student'}</span>
            </button>

            <button
              onClick={() => {
                setActorRole('teacher');
                setErrorMsg(null);
                if (!email) {
                  setEmail('ibrahim@almiftahu.edu');
                  setPassword('teacher123');
                }
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
                actorRole === 'teacher'
                  ? 'bg-white text-emerald-950 shadow-md font-bold'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>{language === 'ha' ? 'Malami' : 'Teacher'}</span>
            </button>

            <button
              onClick={() => {
                setActorRole('admin');
                setErrorMsg(null);
                if (!email || email.includes('ibrahim') || email.includes('usman')) {
                  setEmail('admin@almiftahu.edu');
                  setPassword('admin123');
                }
              }}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
                actorRole === 'admin'
                  ? 'bg-white text-emerald-950 shadow-md font-bold'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'ha' ? 'Shugaba' : 'Principal'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACTOR 1: STUDENT LOGIN VIA INSTITUTION CODE */}
          {/* ======================================================== */}
          {actorRole === 'student' && (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {language === 'ha'
                      ? 'Shiga da Lambar Rijista ta Musamman (Institution Code)'
                      : 'Log in with Unique Institution Code'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  {language === 'ha'
                    ? 'Kowanne dalibi an ba shi lambar makaranta ta musamman (Misali: MIF-2026-002 ko MIF-002). A halin yanzu ana shiga ne da wannan lambar kafin a mayar da asusunka zuwa ingantaccen imel da kalmar sirri.'
                    : 'Each student has a unique institution code (e.g. MIF-2026-002 or MIF-002). Use this code to log in pending your upcoming email security upgrade.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  {language === 'ha'
                    ? 'Lambar Rijistarka (Institution Code):'
                    : 'Your Institution Registration Code:'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={studentCodeInput}
                    onChange={(e) => setStudentCodeInput(e.target.value)}
                    placeholder="MIF-2026-002 ko MIF-002"
                    className="w-full pl-10 pr-3 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-xs font-mono font-bold tracking-wider focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all uppercase"
                  />
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">
                  {language === 'ha'
                    ? 'Zaka iya rubuta MIF-2026-002, MIF-002, s2, ko lambar 2'
                    : 'Accepts MIF-2026-002, MIF-002, s2, or student number'}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>{language === 'ha' ? 'Shiga Dandalin Dalibi' : 'Enter Student Portal'}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>

              {/* Roster Quick-Pick Helper for convenience */}
              <div className="pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRosterLookup(!showRosterLookup)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-stone-500" />
                    <span className="text-xs font-bold text-stone-700">
                      {language === 'ha'
                        ? 'Manta lambarka? Duba sunanka a jerin dalibai 31'
                        : 'Forgot code? Find your name on the class roster'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </button>

                {showRosterLookup && (
                  <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 animate-in fade-in duration-100">
                    <input
                      type="text"
                      placeholder={language === 'ha' ? 'Nemi sunanka a nan...' : 'Search student name...'}
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs outline-hidden"
                    />

                    <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 rounded-xl bg-white border border-stone-200">
                      {filteredStudents.map((stu) => {
                        const code = stu.institution_code || `MIF-2026-${String(stu.sn || 1).padStart(3, '0')}`;
                        return (
                          <div
                            key={stu.id}
                            onClick={() => selectStudentFromRoster(stu)}
                            className="p-2.5 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center justify-between text-left"
                          >
                            <div>
                              <div className="text-xs font-bold text-stone-900">
                                #{stu.sn} &bull; {stu.name}
                              </div>
                              <div className="text-[11px] text-stone-500 font-arabic">
                                {stu.name_ar}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                              {code}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* ACTOR 2: TEACHER LOGIN */}
          {/* ======================================================== */}
          {actorRole === 'teacher' && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                  <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    {language === 'ha'
                      ? 'Zauren Malami (Teacher Workspace Login)'
                      : 'Teacher Academic Login'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  {language === 'ha'
                    ? 'Shiga don duba karatun haddar dalibai (audio recitation queue), saka maki da bayanin gyaran karatu da duba jadawalin maki na dalibai 31.'
                    : 'Access audio memorization grading queue, provide voice feedback, and manage the 31-student gradebook.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {language === 'ha' ? 'Adireshin Imel ko PIN na Malami' : 'Teacher Email or PIN'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ibrahim@almiftahu.edu"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {language === 'ha' ? 'Kalmar Sirri (Password)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Ana Tabbatarwa...' : (language === 'ha' ? 'Shiga Zauren Malami' : 'Enter Teacher Workspace')}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>

              {/* Verified Teacher Account Shortcuts */}
              <div className="pt-3 border-t border-stone-100">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2 text-center">
                  {language === 'ha' ? 'Asusun Malamai na Makaranta:' : 'Faculty Accounts:'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => autofillStaff('ibrahim@almiftahu.edu', 'teacher123', 'teacher')}
                    className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-colors"
                  >
                    <div className="text-xs font-bold text-stone-900 truncate">Dr. Ibrahim</div>
                    <div className="text-[10px] text-emerald-800">Hadith & Creed</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => autofillStaff('usman@almiftahu.edu', 'teacher123', 'teacher')}
                    className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-colors"
                  >
                    <div className="text-xs font-bold text-stone-900 truncate">Ustadh Usman</div>
                    <div className="text-[10px] text-emerald-800">Fiqh & Seerah</div>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* ACTOR 3: PRINCIPAL / DEAN LOGIN */}
          {/* ======================================================== */}
          {actorRole === 'admin' && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {language === 'ha'
                      ? 'Ofishin Shugaba & Babban Darakta (Principal Console)'
                      : 'Principal & Dean Console'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  {language === 'ha'
                    ? 'Babban jami\'in gudanarwa: fitar da lambobin dalibai, sa hannu a shahadodi, saita ka\'idojin makin cin jarabawa da kula da dukkan harkokin makaranta.'
                    : 'Institutional governance: issue student codes, certificate authority, pass marks, and school-wide oversight.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {language === 'ha' ? 'Adireshin Imel na Shugaba' : 'Principal Email'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@almiftahu.edu"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {language === 'ha' ? 'Kalmar Sirri (Password)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-hidden transition-all"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Ana Tabbatarwa...' : (language === 'ha' ? 'Shiga Ofishin Shugaba' : 'Enter Principal Console')}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>

              <div className="pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => autofillStaff('admin@almiftahu.edu', 'admin123', 'admin')}
                  className="w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-900">
                      Sheikh Musa Aminu Muhammad
                    </div>
                    <div className="text-[10px] text-amber-800">
                      Babban Darakta & Mushrif Al-Aam (Dean)
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-900 underline">
                    {language === 'ha' ? 'Cika Bayani' : 'Autofill'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
