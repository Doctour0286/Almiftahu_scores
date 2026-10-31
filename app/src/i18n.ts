// Every user-facing string is a key (PRD v4 §5). Hausa strings are a first pass and need review by a native speaker.
export type Lang = 'en' | 'ha' | 'ar';
type Dict = Record<string, string>;
const en: Dict = {
  title: "Ma'had Miftah al-'Ilm", student: "I'm a student", staff: "I'm staff", back: 'Back', signIn: 'Sign in', signOut: 'Sign out',
  email: 'Email', password: 'Password', code: 'Login code', pin: 'PIN', newPin: 'New PIN (4–6 digits)', oldPin: 'Current PIN', savePin: 'Save new PIN',
  welcome: 'Welcome', mustChange: 'Please choose your own PIN before you continue.', myCourses: 'My courses', marks: 'Lesson marks', noCourses: 'You are not enrolled in a course yet.',
  access: 'Student access', search: 'Search students', issue: 'Issue PIN', issued: 'Give these to the student. The PIN is shown only once.', done: 'Done',
  scores: 'Scores', course: 'Course', unit: 'Day', outOf: 'out of', saved: 'Saved', blankHint: 'Leave blank if not marked', lessonPct: 'Lessons', noScored: 'No course with lesson scores yet.', noStudents: 'No active students in this course.', eRange: 'Enter a whole number in range.',
  roster: 'Roster', addStudent: 'Add a student', nameEn: 'Name (English)', nameAr: 'Name (Arabic, optional)', add: 'Add', dupName: 'A student with this name already exists. Check it is not a duplicate.', inactive: 'inactive', deactivate: 'Deactivate', reactivate: 'Reactivate', approve: 'Approve for exam', approved: 'Approved ✓', confirmOff: 'Deactivate this student? Their history is kept and they leave the public portal.',
  today: 'Today', coursesTab: 'My courses', sabqi: 'Recent revision', sabaq: 'New lesson', manzil: 'Older revision', startItems: 'Start questions', typeAnswer: 'Type your answer', check: 'Check', next: 'Next', correct: 'Correct ✓', incorrect: 'Not quite', answerWas: 'The answer', doneToday: 'Done for today. Well done!', nothingDue: 'Nothing is due today.', weekDays: 'days this week (Friday is a rest day)', keysLabel: 'keys earned', keyEarned: 'You earned a key!', pausedNew: 'New lessons are paused until your repairs are finished.', comeBack: 'See you tomorrow, in shā’ Allāh.',
  lessons: 'Lessons', newLesson: 'New lesson', lessonTitle: 'Lesson title', lessonBody: 'Lesson text (optional)', itemsHelp: 'Questions, one per line:\nprompt || answer || other accepted answers (separate with ;)', saveLesson: 'Save lesson', publish: 'Publish', unpublish: 'Unpublish', draft: 'draft', published: 'published', itemsLbl: 'items', learners: 'learners',
  edit: 'Edit', confirmDelete: 'Delete this lesson?', titleAr: 'Lesson title (Arabic, optional)', typeRecall: 'Typed answer', typeMcq: 'Multiple choice', promptLbl: 'Question', answerLbl: 'Correct answer', altsLbl: 'Other accepted answers (separate with ;)', optionLbl: 'Option', correctOpt: 'Correct option', addItem: 'Add question', lockedNote: 'Students have started this lesson, so its questions are locked. You can still change the title and text.', import: 'Import lessons', importRun: 'Import as drafts', lessonsLbl: 'lessons',
  importHelp: 'One lesson per "# Title | Arabic title" line.\n"> text" lines are the lesson text.\n"prompt || answer || other answers ; more" is a typed question.\n"? prompt || correct | wrong | wrong" is multiple choice (the first option is the correct one; they are shuffled).',
  offline: 'You are offline. Some things will not work until you reconnect.',
  greet: 'Assalamu alaykum', todaysWird: "Today's Wird", wirdBlurb: 'About 12 minutes. Revise, learn, review.', cont: 'Continue', startWird: 'Start', yourKeys: 'Your keys', thisWeek: 'This week', fridayRest: 'Friday is rest', keysTab: 'Keys', me: 'Me', noKeysYet: 'Finish a lesson and keep revising it to earn your first key.',
  inbox: 'Inbox', activeToday: 'students practised today', needsYou: 'Needs you', allGood: 'Everyone is on track.', notStarted: 'not started', daysAgo: 'days ago', copyNudge: 'Copy message', copied: 'Copied ✓', repairList: 'Needs repair', nudgeMsg: 'Assalamu alaykum {name}, we missed you. Your Wird is waiting. Just ten minutes today, in shā’ Allāh.',
  needsRevision: 'A key needs revision to stay bright.',
  navAccess: 'Access', stopped: 'Stopped practising', notStartedGroup: 'Not started yet', copyShort: 'Copy',
  eAuth: 'Wrong details. Please check and try again.', eLocked: 'Too many tries. Please wait a few minutes.', eNet: 'No connection. Please try again.',
  eConfig: 'This app is not configured yet.', eValidation: 'Please check what you typed.', eGeneric: 'Something went wrong. Please try again.', loading: 'Loading…',
};
const ha: Dict = {
  ...en, student: 'Ni ɗalibi ne', staff: 'Ni ma’aikaci ne', back: 'Baya', signIn: 'Shiga', signOut: 'Fita', email: 'Imel', password: 'Kalmar sirri',
  scores: 'Maki', course: 'Darasi', saved: 'An adana', code: 'Lambar shiga', welcome: 'Barka da zuwa', myCourses: 'Darussana', marks: 'Maki', loading: 'Ana lodawa…',
};
const ar: Dict = {
  title: 'معهد مفتاح العلم', student: 'أنا طالب', staff: 'أنا من الهيئة', back: 'رجوع', signIn: 'دخول', signOut: 'خروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
  code: 'رمز الدخول', pin: 'الرقم السري', newPin: 'رقم سري جديد (٤–٦ أرقام)', oldPin: 'الرقم السري الحالي', savePin: 'حفظ الرقم السري',
  welcome: 'مرحبًا', mustChange: 'يرجى اختيار رقمك السري قبل المتابعة.', myCourses: 'مقرراتي', marks: 'درجات الدروس', noCourses: 'لم تُسجَّل في أي مقرر بعد.',
  access: 'دخول الطلاب', search: 'ابحث عن طالب', issue: 'إصدار رقم سري', issued: 'سلّم هذه البيانات للطالب. يظهر الرقم السري مرة واحدة فقط.', done: 'تم',
  scores: 'الدرجات', course: 'المقرر', unit: 'اليوم', outOf: 'من', saved: 'تم الحفظ', blankHint: 'اتركه فارغًا إن لم يُصحَّح', lessonPct: 'الدروس', noScored: 'لا يوجد مقرر بدرجات دروس بعد.', noStudents: 'لا يوجد طلاب نشطون في هذا المقرر.', eRange: 'أدخل عددًا صحيحًا ضمن النطاق.',
  roster: 'القائمة', addStudent: 'إضافة طالب', nameEn: 'الاسم (بالإنجليزية)', nameAr: 'الاسم (بالعربية، اختياري)', add: 'إضافة', dupName: 'يوجد طالب بهذا الاسم. تأكد أنه ليس مكررًا.', inactive: 'غير نشط', deactivate: 'إيقاف', reactivate: 'إعادة تفعيل', approve: 'اعتماد للاختبار', approved: 'معتمد ✓', confirmOff: 'إيقاف هذا الطالب؟ يبقى سجله ويخرج من الواجهة العامة.',
  today: 'اليوم', coursesTab: 'مقرراتي', sabqi: 'مراجعة قريبة', sabaq: 'درس جديد', manzil: 'مراجعة بعيدة', startItems: 'ابدأ الأسئلة', typeAnswer: 'اكتب إجابتك', check: 'تحقق', next: 'التالي', correct: 'صحيح ✓', incorrect: 'ليس تمامًا', answerWas: 'الإجابة', doneToday: 'انتهيت لهذا اليوم. أحسنت!', nothingDue: 'لا شيء مستحق اليوم.', weekDays: 'أيام هذا الأسبوع (الجمعة راحة)', keysLabel: 'مفاتيح', keyEarned: 'حصلت على مفتاح!', pausedNew: 'الدروس الجديدة متوقفة حتى تنتهي من التصحيحات.', comeBack: 'نراك غدًا إن شاء الله.',
  lessons: 'الدروس', newLesson: 'درس جديد', lessonTitle: 'عنوان الدرس', lessonBody: 'نص الدرس (اختياري)', itemsHelp: 'الأسئلة، سؤال في كل سطر:\nالسؤال || الإجابة || إجابات أخرى مقبولة (افصل بـ ؛)', saveLesson: 'حفظ الدرس', publish: 'نشر', unpublish: 'إلغاء النشر', draft: 'مسودة', published: 'منشور', itemsLbl: 'أسئلة', learners: 'متعلمين',
  edit: 'تعديل', confirmDelete: 'حذف هذا الدرس؟', titleAr: 'عنوان الدرس بالعربية (اختياري)', typeRecall: 'إجابة مكتوبة', typeMcq: 'اختيار من متعدد', promptLbl: 'السؤال', answerLbl: 'الإجابة الصحيحة', altsLbl: 'إجابات أخرى مقبولة (افصل بـ ؛)', optionLbl: 'خيار', correctOpt: 'الخيار الصحيح', addItem: 'إضافة سؤال', lockedNote: 'بدأ الطلاب هذا الدرس، لذا أسئلته مقفلة. يمكنك تعديل العنوان والنص.', import: 'استيراد دروس', importRun: 'استيراد كمسودات', lessonsLbl: 'دروس',
  importHelp: 'درس لكل سطر "# العنوان | العنوان بالعربية".\nأسطر "> نص" هي نص الدرس.\n"السؤال || الإجابة || إجابات أخرى ؛ أخرى" سؤال كتابي.\n"? السؤال || الصحيح | خطأ | خطأ" اختيار من متعدد (الأول هو الصحيح ويُخلط الترتيب).',
  offline: 'أنت غير متصل. لن تعمل بعض الأشياء حتى تعود.',
  greet: 'السلام عليكم', todaysWird: 'ورد اليوم', wirdBlurb: 'نحو ١٢ دقيقة. راجع، تعلّم، ثم راجع.', cont: 'متابعة', startWird: 'ابدأ', yourKeys: 'مفاتيحك', thisWeek: 'هذا الأسبوع', fridayRest: 'الجمعة راحة', keysTab: 'المفاتيح', me: 'أنا', noKeysYet: 'أكمل درسًا وواصل مراجعته لتحصل على أول مفتاح.',
  inbox: 'الوارد', activeToday: 'طلاب راجعوا اليوم', needsYou: 'يحتاجون إليك', allGood: 'الجميع على ما يرام.', notStarted: 'لم يبدأ', daysAgo: 'أيام مضت', copyNudge: 'نسخ الرسالة', copied: 'تم النسخ ✓', repairList: 'يحتاجون تصحيحًا', nudgeMsg: 'السلام عليكم {name}، افتقدناك. وردك ينتظرك. عشر دقائق فقط اليوم إن شاء الله.',
  needsRevision: 'مفتاح يحتاج مراجعة ليبقى لامعًا.',
  navAccess: 'الدخول', stopped: 'توقفوا عن المراجعة', notStartedGroup: 'لم يبدؤوا بعد', copyShort: 'نسخ',
  eAuth: 'البيانات غير صحيحة. حاول مرة أخرى.', eLocked: 'محاولات كثيرة. انتظر بضع دقائق.', eNet: 'لا يوجد اتصال. حاول مرة أخرى.',
  eConfig: 'لم يتم إعداد التطبيق بعد.', eValidation: 'تحقق مما كتبته.', eGeneric: 'حدث خطأ. حاول مرة أخرى.', loading: '…جارٍ التحميل',
};
export const dicts: Record<Lang, Dict> = { en, ha, ar };
export const isRtl = (l: Lang) => l === 'ar';
export function errKey(code: string): string {
  if (code === 'E_AUTH') return 'eAuth'; if (code === 'E_LOCKED') return 'eLocked'; if (code === 'E_NETWORK') return 'eNet';
  if (code === 'E_CONFIG') return 'eConfig'; if (code === 'E_VALIDATION') return 'eValidation'; return 'eGeneric';
}
