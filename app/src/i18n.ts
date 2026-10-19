// Every user-facing string is a key (PRD v4 §5). Hausa strings are a first pass and need review by a native speaker.
export type Lang = 'en' | 'ha' | 'ar';
type Dict = Record<string, string>;
const en: Dict = {
  title: "Ma'had Miftah al-'Ilm", student: "I'm a student", staff: "I'm staff", back: 'Back', signIn: 'Sign in', signOut: 'Sign out',
  email: 'Email', password: 'Password', code: 'Login code', pin: 'PIN', newPin: 'New PIN (4–6 digits)', oldPin: 'Current PIN', savePin: 'Save new PIN',
  welcome: 'Welcome', mustChange: 'Please choose your own PIN before you continue.', myCourses: 'My courses', marks: 'Lesson marks', noCourses: 'You are not enrolled in a course yet.',
  access: 'Student access', search: 'Search students', issue: 'Issue PIN', issued: 'Give these to the student. The PIN is shown only once.', done: 'Done',
  eAuth: 'Wrong details. Please check and try again.', eLocked: 'Too many tries. Please wait a few minutes.', eNet: 'No connection. Please try again.',
  eConfig: 'This app is not configured yet.', eValidation: 'Please check what you typed.', eGeneric: 'Something went wrong. Please try again.', loading: 'Loading…',
};
const ha: Dict = {
  ...en, student: 'Ni ɗalibi ne', staff: 'Ni ma’aikaci ne', back: 'Baya', signIn: 'Shiga', signOut: 'Fita', email: 'Imel', password: 'Kalmar sirri',
  code: 'Lambar shiga', welcome: 'Barka da zuwa', myCourses: 'Darussana', marks: 'Maki', loading: 'Ana lodawa…',
};
const ar: Dict = {
  title: 'معهد مفتاح العلم', student: 'أنا طالب', staff: 'أنا من الهيئة', back: 'رجوع', signIn: 'دخول', signOut: 'خروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
  code: 'رمز الدخول', pin: 'الرقم السري', newPin: 'رقم سري جديد (٤–٦ أرقام)', oldPin: 'الرقم السري الحالي', savePin: 'حفظ الرقم السري',
  welcome: 'مرحبًا', mustChange: 'يرجى اختيار رقمك السري قبل المتابعة.', myCourses: 'مقرراتي', marks: 'درجات الدروس', noCourses: 'لم تُسجَّل في أي مقرر بعد.',
  access: 'دخول الطلاب', search: 'ابحث عن طالب', issue: 'إصدار رقم سري', issued: 'سلّم هذه البيانات للطالب. يظهر الرقم السري مرة واحدة فقط.', done: 'تم',
  eAuth: 'البيانات غير صحيحة. حاول مرة أخرى.', eLocked: 'محاولات كثيرة. انتظر بضع دقائق.', eNet: 'لا يوجد اتصال. حاول مرة أخرى.',
  eConfig: 'لم يتم إعداد التطبيق بعد.', eValidation: 'تحقق مما كتبته.', eGeneric: 'حدث خطأ. حاول مرة أخرى.', loading: '…جارٍ التحميل',
};
export const dicts: Record<Lang, Dict> = { en, ha, ar };
export const isRtl = (l: Lang) => l === 'ar';
export function errKey(code: string): string {
  if (code === 'E_AUTH') return 'eAuth'; if (code === 'E_LOCKED') return 'eLocked'; if (code === 'E_NETWORK') return 'eNet';
  if (code === 'E_CONFIG') return 'eConfig'; if (code === 'E_VALIDATION') return 'eValidation'; return 'eGeneric';
}
