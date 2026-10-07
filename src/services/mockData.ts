import { Course, Exam, CertificateRecord, InstitutionSettings, UserAccount, ExamAttempt } from '../types/lms';

// Authentic high-fidelity crest for Makarantar Miftahul Ilmi (Key of Knowledge / Mabudin Ilimi)
export const DEFAULT_LOGO_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <defs>
    <linearGradient id="emGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23064e3b"/>
      <stop offset="100%" stop-color="%23022c22"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23fbbf24"/>
      <stop offset="100%" stop-color="%23b45309"/>
    </linearGradient>
  </defs>
  <!-- Outer Gold Ring -->
  <circle cx="100" cy="100" r="94" stroke="url(%23goldGrad)" stroke-width="4" fill="%23fdfbf7"/>
  <!-- Inner Emerald Seal -->
  <circle cx="100" cy="100" r="86" fill="url(%23emGrad)"/>
  <!-- Decorative Star Pattern -->
  <circle cx="100" cy="100" r="82" stroke="%23fbbf24" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- Open Book (Holy Quran) -->
  <path d="M60 126C74 122 88 123 100 128C112 123 126 122 140 126V98C126 94 112 95 100 100C88 95 74 94 60 98Z" fill="%23fef3c7" stroke="%23d97706" stroke-width="2"/>
  <path d="M100 100V128" stroke="%23b45309" stroke-width="2"/>
  <!-- Golden Key (Miftah / Mabudi) rising upward with teeth -->
  <g transform="translate(100,68)">
    <circle cx="0" cy="-22" r="14" stroke="url(%23goldGrad)" stroke-width="4.5" fill="none"/>
    <circle cx="0" cy="-22" r="6" fill="%23fbbf24"/>
    <rect x="-3" y="-8" width="6" height="34" rx="2" fill="url(%23goldGrad)"/>
    <path d="M3 14H12V20H3Z" fill="%23fbbf24"/>
    <path d="M3 4H9V9H3Z" fill="%23fbbf24"/>
  </g>
  <!-- Rays of Knowledge -->
  <path d="M100 24V14M72 28L65 19M128 28L135 19" stroke="%23fbbf24" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Text Ring in Hausa and Arabic -->
  <text x="100" y="152" text-anchor="middle" fill="%23fbbf24" font-size="10.5" font-family="Arial, sans-serif" font-weight="bold">MIFTAHUL ILMI</text>
  <text x="100" y="167" text-anchor="middle" fill="%23fde68a" font-size="8.5" font-family="Arial, sans-serif">معهد مفتاح العلم • 1447H</text>
  <text x="100" y="180" text-anchor="middle" fill="%23a7f3d0" font-size="7.5" font-family="Arial, sans-serif">MABUDIN ILIMI DA NASARA</text>
</svg>`;

export const DEFAULT_SIGNATURE_DATA_URL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" fill="none"><path d="M20 50C40 20 55 60 75 35C95 10 110 70 140 30C160 55 180 20 220 40" stroke="%23064e3b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 62C70 65 150 63 210 58" stroke="%23b4833e" stroke-width="1.8" stroke-linecap="round"/></svg>';

export const INITIAL_INSTITUTION_SETTINGS: InstitutionSettings = {
  name_ar: 'معهد مفتاح العلم للعلوم الشرعية',
  name_en: "Makarantar Miftahul Ilmi (Ma'had Miftah al-'Ilm)",
  signatory_name_ar: 'الشيخ موسى أمينو محمد (Sheikh Musa Aminu Muhammad)',
  signatory_title_ar: 'Babban Darakta kuma المشرف العام',
  certificate_prefix: 'MIFTAH-',
  default_wording_ar: 'Wannan takarda tana tabbatar da cewa dalibin da sunansa ke sama ya kammala dukkan darussa da jarabawowin wannan fanni cikin nasara da kwazo.',
  logo_data_url: DEFAULT_LOGO_DATA_URL,
  signature_data_url: DEFAULT_SIGNATURE_DATA_URL,
};

// Clean Real Users (Dean / Principal, Teachers, and all 31 verified students from Supabase DB)
export const INITIAL_USERS: UserAccount[] = [
  // 1. Principal & Dean (General Supervisor)
  {
    id: '45579ce2-271d-4e01-9a7a-2f7df1b30a26',
    email: 'admin@almiftahu.edu',
    role: 'admin',
    name: 'Musa Aminu Muhammad',
    name_ar: 'الشيخ موسى أمينو محمد',
    title: 'General Supervisor & Dean',
    title_ar: 'Babban Darakta kuma المشرف العام',
    assigned_courses: ['ALL'],
    created_at: '2026-01-10T08:00:00Z',
  },
  // 2. Head Teacher (Creed & Hadith)
  {
    id: '1177f810-3269-4394-81b3-3b8d29a60219',
    email: 'ibrahim@almiftahu.edu',
    role: 'teacher',
    name: 'Dr. Ibrahim Al-Madani',
    name_ar: 'د. إبراهيم المدني',
    title: 'Senior Instructor of Hadith & Creed',
    title_ar: 'Babban Malami a Hadisi da Akida',
    assigned_courses: ['ALL'],
    created_at: '2026-01-15T09:30:00Z',
  },
  // 3. Teacher (Fiqh & Adab)
  {
    id: 'b7f119c9-1fc6-4ef9-88ba-2c1ba198688b',
    email: 'usman@almiftahu.edu',
    role: 'teacher',
    name: 'Ustadh Usman Daura',
    name_ar: 'الأستاذ عثمان دورا',
    title: 'Instructor of Fiqh & Seerah',
    title_ar: 'Malami a Fikihu da Tarihin Annabi',
    assigned_courses: ['ALL'],
    created_at: '2026-01-20T10:00:00Z',
  },

  // 4. All 31 Real Students from the live Supabase Database with unique generated Institution Codes
  {
    id: 's2',
    sn: 2,
    institution_code: 'MIF-2026-002',
    email: 'student.s2@almiftahu.edu',
    role: 'student',
    name: 'Abdullahi Umar Abdullahi',
    name_ar: 'عبد الله عمر عبد الله',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's4',
    sn: 4,
    institution_code: 'MIF-2026-004',
    email: 'student.s4@almiftahu.edu',
    role: 'student',
    name: 'Aisha Iliyas Abubakar',
    name_ar: 'عائشة إلياس أبو بكر',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's5',
    sn: 5,
    institution_code: 'MIF-2026-005',
    email: 'student.s5@almiftahu.edu',
    role: 'student',
    name: 'Aisha khamis Muhammad',
    name_ar: 'عائشة خامس محمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's6',
    sn: 6,
    institution_code: 'MIF-2026-006',
    email: 'student.s6@almiftahu.edu',
    role: 'student',
    name: 'Aliyu haruna Yusuf',
    name_ar: 'علي هىٰرون يوسف',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's7',
    sn: 7,
    institution_code: 'MIF-2026-007',
    email: 'student.s7@almiftahu.edu',
    role: 'student',
    name: 'Ameena Ahmad Lawan',
    name_ar: 'آمنة أحمد لون',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's8',
    sn: 8,
    institution_code: 'MIF-2026-008',
    email: 'student.s8@almiftahu.edu',
    role: 'student',
    name: 'Amina Yakubu Ibrahim',
    name_ar: 'آمنة يعقوب ابراهيم',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's10',
    sn: 10,
    institution_code: 'MIF-2026-010',
    email: 'student.s10@almiftahu.edu',
    role: 'student',
    name: "Asma'u Ibrahim Aliyu",
    name_ar: 'أسماء ابراهيم علي',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's11',
    sn: 11,
    institution_code: 'MIF-2026-011',
    email: 'student.s11@almiftahu.edu',
    role: 'student',
    name: 'Asmau Musa Haruna',
    name_ar: 'أسماء موسى هىٰرون',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's12',
    sn: 12,
    institution_code: 'MIF-2026-012',
    email: 'student.s12@almiftahu.edu',
    role: 'student',
    name: 'Balkisu yahaya',
    name_ar: 'بلقيس يحيى',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's13',
    sn: 13,
    institution_code: 'MIF-2026-013',
    email: 'student.s13@almiftahu.edu',
    role: 'student',
    name: 'Fatima Adam Musa',
    name_ar: 'فاطمة أحمد موسى',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's14',
    sn: 14,
    institution_code: 'MIF-2026-014',
    email: 'student.s14@almiftahu.edu',
    role: 'student',
    name: 'Fatima Ahmad Ahmad',
    name_ar: 'فاطمة أحمد أحمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's15',
    sn: 15,
    institution_code: 'MIF-2026-015',
    email: 'student.s15@almiftahu.edu',
    role: 'student',
    name: 'Fatima Shuaibu Usman',
    name_ar: 'فاطمة شعيب عثمان',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's18',
    sn: 18,
    institution_code: 'MIF-2026-018',
    email: 'student.s18@almiftahu.edu',
    role: 'student',
    name: 'Habiba Aminu Muhammed',
    name_ar: 'حبيبة الأمين محمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's24',
    sn: 24,
    institution_code: 'MIF-2026-024',
    email: 'student.s24@almiftahu.edu',
    role: 'student',
    name: 'Hauwau Ibrahim Muazu',
    name_ar: 'حوّاء ابراهيم معاذ',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's25',
    sn: 25,
    institution_code: 'MIF-2026-025',
    email: 'student.s25@almiftahu.edu',
    role: 'student',
    name: 'Idris Bilyaminu',
    name_ar: 'إدريس بليامن',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's26',
    sn: 26,
    institution_code: 'MIF-2026-026',
    email: 'student.s26@almiftahu.edu',
    role: 'student',
    name: 'Khadija Abdullah Aliyu',
    name_ar: 'خديجة عبد الله علي',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's27',
    sn: 27,
    institution_code: 'MIF-2026-027',
    email: 'student.s27@almiftahu.edu',
    role: 'student',
    name: 'Maimunatu Alhassan Muhammad',
    name_ar: 'ميمونة الحسن محمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's28',
    sn: 28,
    institution_code: 'MIF-2026-028',
    email: 'student.s28@almiftahu.edu',
    role: 'student',
    name: 'Maimunatu Halliru',
    name_ar: 'ميمونة هلّر',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's31',
    sn: 31,
    institution_code: 'MIF-2026-031',
    email: 'student.s31@almiftahu.edu',
    role: 'student',
    name: 'Rabiatu Yusuf Falke',
    name_ar: 'رابعة يوسف فلكي',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's33',
    sn: 33,
    institution_code: 'MIF-2026-033',
    email: 'student.s33@almiftahu.edu',
    role: 'student',
    name: 'Rukayya Musa Haruna',
    name_ar: 'رقيّة موسى هىٰرون',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's35',
    sn: 35,
    institution_code: 'MIF-2026-035',
    email: 'student.s35@almiftahu.edu',
    role: 'student',
    name: 'Saudat Yahuza Abdullahi',
    name_ar: 'سودة يهوزى عبد الله',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's37',
    sn: 37,
    institution_code: 'MIF-2026-037',
    email: 'student.s37@almiftahu.edu',
    role: 'student',
    name: 'Ummukursum Abubakar',
    name_ar: 'أم كلثوم أبو بكر',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's38',
    sn: 38,
    institution_code: 'MIF-2026-038',
    email: 'student.s38@almiftahu.edu',
    role: 'student',
    name: 'Usaina Bilyamini',
    name_ar: 'حُسَينة بليامن',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's39',
    sn: 39,
    institution_code: 'MIF-2026-039',
    email: 'student.s39@almiftahu.edu',
    role: 'student',
    name: 'Yahaya bilyaminu',
    name_ar: 'يحيى بليامن',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's42',
    sn: 42,
    institution_code: 'MIF-2026-042',
    email: 'student.s42@almiftahu.edu',
    role: 'student',
    name: 'Zainab Sulaiman Falke',
    name_ar: 'زينب سليمان فلكي',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's43',
    sn: 43,
    institution_code: 'MIF-2026-043',
    email: 'student.s43@almiftahu.edu',
    role: 'student',
    name: 'Rahama Dauda Muhammad',
    name_ar: 'رحمة داود محمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-18T11:05:12Z'
  },
  {
    id: 's45',
    sn: 45,
    institution_code: 'MIF-2026-045',
    email: 'student.s45@almiftahu.edu',
    role: 'student',
    name: 'Aisha Adam Abdullahi',
    name_ar: 'عائشة آدم عبد الله',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-19T10:10:38Z'
  },
  {
    id: 's46',
    sn: 46,
    institution_code: 'MIF-2026-046',
    email: 'student.s46@almiftahu.edu',
    role: 'student',
    name: 'Khadija Abdullah Ahmad',
    name_ar: 'خديجة عبد الله أحمد',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-09-21T12:15:48Z'
  },
  {
    id: 's47',
    sn: 47,
    institution_code: 'MIF-2026-047',
    email: 'student.s47@almiftahu.edu',
    role: 'student',
    name: 'Isa Musa',
    name_ar: 'عيسى موسى',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-10-05T20:06:18Z'
  },
  {
    id: 's48',
    sn: 48,
    institution_code: 'MIF-2026-048',
    email: 'student.s48@almiftahu.edu',
    role: 'student',
    name: 'Isa mudi',
    name_ar: 'عيسى مودي',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-10-05T21:04:47Z'
  },
  {
    id: 's49',
    sn: 49,
    institution_code: 'MIF-2026-049',
    email: 'student.s49@almiftahu.edu',
    role: 'student',
    name: 'Atika isa',
    name_ar: 'عاتكة عيسى',
    assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
    created_at: '2026-10-05T21:22:43Z'
  }
];

// 10 Authentic Lessons of Al-Aadaab Al-Asharah
const ADAB_LESSONS = [
  {
    num: 1,
    titleEn: 'Lesson 1: Manners of Greeting (As-Salam)',
    titleHa: 'Darasi Na 1: Sallama da Gaisuwa',
    titleAr: 'الدرس الأول: آداب السلام والتحية',
    summaryHa: 'Bayanin cikakken lafazin sallama, falalarta da ka\'idojin mayar da martani a musulunci.',
    readingAr: 'قال النبي ﷺ: «لا تدخلون الجنة حتى تؤمنوا، ولا تؤمنوا حتى تحابوا، أولا أدلكم على شيء إذا فعلتموه تحاببتم؟ أفشوا السلام بينكم». ومن الأدب أن يسلم الصغير على الكبير، والمار على القاعد، والقليل على الكثير.',
    promptHa: 'Karanta cikakkiyar Sallama da lafazin amsawa: "Assalamu alaykum wa rahmatullahi wa barakatuh - Wa alaykumus salam wa rahmatullahi wa barakatuh".',
    quizQ: 'Wane ne ya kamata ya fara yin sallama a bisa sunnah?',
    quizOpts: ['Wanda yake tafiya a kan mai zama', 'Babban mutum a kan yaro', 'Mai yawa a kan kadan'],
    quizCorrect: 'opt0'
  },
  {
    num: 2,
    titleEn: 'Lesson 2: Seeking Permission (Al-Isti\'dhan)',
    titleHa: 'Darasi Na 2: Neman Izinin Shiga Wuri',
    titleAr: 'الدرس الثاني: آداب الاستئذان',
    summaryHa: 'Hukuncin neman izini sau uku kafin shiga gida ko daki, da kin tsayawa kai tsaye a gaban kofa.',
    readingAr: 'الاستئذان ثلاث، فإن أذن لك وإلا فارجع. ومن الأدب ألا يقف المستأذن تلقاء الباب بوجهه، بل يجعله عن يمينه أو شماله صيانة لحرمات البيوت.',
    promptHa: 'Karanta hadisi mai daraja: "الاستئذان ثلاث، فإن أذن لك وإلا فارجع" da ma\'anarsa a takaice.',
    quizQ: 'Sau nawa ne ake neman izini kafin a koma idan ba a amsa ba?',
    quizOpts: ['Sau biyar', 'Sau uku', 'Sau daya kawai'],
    quizCorrect: 'opt1'
  },
  {
    num: 3,
    titleEn: 'Lesson 3: Eating and Drinking (At-Ta\'am)',
    titleHa: 'Darasi Na 3: Cin Abinci da Shan Ruwa',
    titleAr: 'الدرس الثالث: آداب الطعام والشراب',
    summaryHa: 'Bismillah a farko, cin abinci da hannun dama, da cin abin da yake gabanka ba tare da barna ba.',
    readingAr: 'قال النبي ﷺ لعمر بن أبي سلمة: «يا غلام، سمّ الله، وكل بيمينك، وكل مما يليك». ويستحب حمد الله تعالى بعد الفراغ من الأكل والشرب.',
    promptHa: 'Karanta hadisin Umar bin Abi Salama: "يا غلام سمّ الله وكل بيمينك وكل مما يليك".',
    quizQ: 'Da wane hannu ne sunnah ta koyar a ci abinci kuma a sha ruwa?',
    quizOpts: ['Hannun hagu', 'Hannun dama', 'Duk wanda ya zo da sauki'],
    quizCorrect: 'opt1'
  },
  {
    num: 4,
    titleEn: 'Lesson 4: Sneezing and Yawning (Al-Utas)',
    titleHa: 'Darasi Na 4: Atishawa da Hamma',
    titleAr: 'الدرس الرابع: آداب العطاس والتثاؤب',
    summaryHa: 'Godiya ga Allah yayin atishawa, addu\'ar "Yarhamukallah", da toshe baki yayin hamma.',
    readingAr: 'إذا عطس أحدكم فليقل: «الحمد لله»، وليقل له أخوه: «يرحمك الله»، فإذا قال له: يرحمك الله، فليقل: «يهديكم الله ويصلح بالكم». وإذا تثاءب فليرده ما استطاع ويكتم فمه.',
    promptHa: 'Karanta addu\'ar atishawa da amsarta: "الحمد لله - يرحمك الله - يهديكم الله ويصلح بالكم".',
    quizQ: 'Menene mai atishawa yake cewa da zaran ya yi atishawa?',
    quizOpts: ['Astaghfirullah', 'Alhamdu lillah', 'Subhanallah'],
    quizCorrect: 'opt1'
  },
  {
    num: 5,
    titleEn: 'Lesson 5: Speech and the Tongue (Al-Kalam)',
    titleHa: 'Darasi Na 5: Magana da Kiyaye Harshe',
    titleAr: 'الدرس الخامس: آداب الكلام وحفظ اللسان',
    summaryHa: 'Fadin alheri ko yin shiru, nisantar giba da karya, da magana a natse.',
    readingAr: 'قال النبي ﷺ: «من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت». وحفظ اللسان من أعظم أسباب النجاة ودخول الجنة.',
    promptHa: 'Karanta hadisi: "من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت".',
    quizQ: 'Idan mutum ba zai fadi alheri ba, menene shari\'a ta umarce shi?',
    quizOpts: ['Ya yi ta gardama', 'Ya yi shiru', 'Ya canza murya'],
    quizCorrect: 'opt1'
  },
  {
    num: 6,
    titleEn: 'Lesson 6: Walking and the Road (At-Tariq)',
    titleHa: 'Darasi Na 6: Tafiya a Hanya',
    titleAr: 'الدرس السادس: آداب المشي والطريق',
    summaryHa: 'Tafiya cikin saukin kai, rage kaifin gani, da cire abin cutarwa daga hanya.',
    readingAr: 'قال الله تعالى: ﴿وَعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ هَوْنًا﴾. ومن حق الطريق غض البصر، وكف الأذى، ورد السلام، والأمر بالمعروف والنهي عن المنكر.',
    promptHa: 'Karanta ayar Suratul Furqan: "وعباد الرحمن الذين يمشون على الأرض هونا وإذا خاطبهم الجاهلون قالوا سلاما".',
    quizQ: 'Daga cikin hakkin hanya a musulunci akwai:',
    quizOpts: ['Kauce wa cire kaya', 'Gusar da abin cutarwa da amsa sallama', 'Zama a kowane kusurwa'],
    quizCorrect: 'opt1'
  },
  {
    num: 7,
    titleEn: 'Lesson 7: Sleeping and Waking (An-Nawm)',
    titleHa: 'Darasi Na 7: Barci da Farkawa',
    titleAr: 'الدرس السابع: آداب النوم والاستيقاظ',
    summaryHa: 'Alwala kafin kwanciya, kwanciya ta bangaren dama, da addu\'o\'in kwanciya da farkawa.',
    readingAr: 'من السنة النوم على وضوء وعلى الشق الأيمن وقراءة أذكار النوم. وإذا استيقظ قال: «الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور».',
    promptHa: 'Karanta addu\'ar farkawa daga barci: "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور".',
    quizQ: 'A kan wane gefe ne sunnah ta fi so a kwanta barci a farko?',
    quizOpts: ['Gefen dama', 'Gefen hagu', 'Kashingida'],
    quizCorrect: 'opt0'
  },
  {
    num: 8,
    titleEn: 'Lesson 8: The Mosque (Al-Masjid)',
    titleHa: 'Darasi Na 8: Shiga Masallaci da Zama a Ciki',
    titleAr: 'الدرس الثامن: آداب المسجد',
    summaryHa: 'Shiga da kafar dama, addu\'ar shiga, sallar gaisuwar masallaci, da nisantar hayaniya.',
    readingAr: 'إذا دخل المسجد قدّم رجله اليمنى وقال: «اللهم افتح لي أبواب رحمتك»، وإذا خرج قدّم اليسرى وقال: «اللهم إني أسألك من فضلك». ولا يجلس حتى يصلي ركعتين تحية المسجد.',
    promptHa: 'Karanta addu\'ar shiga masallaci da fita: "اللهم افتح لي أبواب رحمتك... اللهم إني أسألك من فضلك".',
    quizQ: 'Wace kafa ake fara shigarwa masallaci?',
    quizOpts: ['Kafar hagu', 'Kafar dama', 'Kowace kafa'],
    quizCorrect: 'opt1'
  },
  {
    num: 9,
    titleEn: 'Lesson 9: Gathering and Assemblies (Al-Majlis)',
    titleHa: 'Darasi Na 9: Zama a Majalisa',
    titleAr: 'الدرس التاسع: آداب المجلس',
    summaryHa: 'Zama a inda majalisa ta kare, kada a tashi mutum don a zauna, da karanta Kaffaratul Majlis kafin tashi.',
    readingAr: 'من جلس في مجلس فكثر فيه لغطه فقال قبل أن يقوم: «سبحانك اللهم وبحمدك، أشهد أن لا إله إلا أنت، أستغفرك وأتوب إليك» كُفّر له ما كان في مجلسه ذلك.',
    promptHa: 'Karanta Kaffaratul Majlis: "سبحانك اللهم وبحمدك، أشهد أن لا إله إلا أنت، أستغفرك وأتوب إليك".',
    quizQ: 'Menene Kaffaratul Majlis take yi ga kurakuran da mutum ya yi a wurin zama?',
    quizOpts: ['Kankare kurakurai', 'Kara nauyin zunubi', 'Bata lada'],
    quizCorrect: 'opt0'
  },
  {
    num: 10,
    titleEn: 'Lesson 10: Parents and Elders (Birrul Walidayn)',
    titleHa: 'Darasi Na 10: Biyayya ga Iyaye da Manyan Mutane',
    titleAr: 'الدرس العاشر: بر الوالدين وتوقير الكبار',
    summaryHa: 'Girmama iyaye, yi musu addu\'a, sauraren shawararsu, da girmama malamai da manyan al\'umma.',
    readingAr: 'قال الله تعالى: ﴿وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا﴾. وقال النبي ﷺ: «ليس منا من لم يرحم صغيرنا ويوقر كبيرنا ويصرف لعالمنا حقه».',
    promptHa: 'Karanta hadisi: "ليس منا من لم يرحم صغيرنا، ويوقر كبيرنا، ويعرف لعالمنا حقه".',
    quizQ: 'Menene matsayin biyayya ga iyaye a musulunci bayan tauhidi?',
    quizOpts: ['Aikin son rai', 'Babban wajibi mai girma', 'Wani abu da ba shi da muhimmanci'],
    quizCorrect: 'opt1'
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
    code: 'ADAB',
    name: 'Al-Aadaab Al-Asharah',
    name_ar: 'الآداب العشرة',
    status: 'active',
    has_audio_memorization: true,
    banner_image: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80',
    instructor_name_ar: 'الشيخ موسى أمينو محمد (Sheikh Musa Aminu Muhammad)',
    instructor_title_ar: 'Babban Malami kuma Daraktan Makaranta',
    pass_mark: 60,
    weight_lessons: 50,
    weight_exam: 50,
    unit_label_ar: 'Darasi / Rana',
    description_ar: 'Karatun matanin Al-Aadaab Al-Asharah tare da haddar muryar kowane darasi, ma\'anarsa a Hausa da amsa tambayoyi.',
    units: ADAB_LESSONS.map((item) => ({
      id: `unit_adab_${item.num}`,
      course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
      order_index: item.num,
      title: item.titleEn,
      title_ar: item.titleAr,
      description_ar: item.summaryHa,
      exam_id: 'exam_adab_final',
      lessons: [
        {
          id: `les_adab_${item.num}`,
          unit_id: `unit_adab_${item.num}`,
          course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
          order_index: item.num,
          title: item.titleHa,
          title_ar: item.titleAr,
          summary_ar: item.summaryHa,
          has_memorization: true,
          memorization_prompt: item.promptHa,
          media: {
            video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            duration_minutes: 18,
            duration_formatted: '18:30'
          },
          reading_content_ar: item.readingAr,
          references: ['Matnu Al-Aadaab Al-Asharah', 'Makarantar Miftahul Ilmi - Sashen Ladubba'],
          quiz: {
            id: `quiz_adab_${item.num}`,
            lesson_id: `les_adab_${item.num}`,
            title_ar: `اختبار قصير: ${item.titleAr}`,
            max_points: 10,
            questions: [
              {
                id: `q_adab_${item.num}`,
                format: 'mcq',
                prompt_ar: item.quizQ,
                max_points: 10,
                options: item.quizOpts.map((opt, oIdx) => ({
                  id: `opt${oIdx}`,
                  text_ar: opt,
                  is_correct: `opt${oIdx}` === item.quizCorrect
                }))
              }
            ]
          }
        }
      ]
    }))
  }
];

export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam_adab_final',
    course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
    title_ar: 'Babban Jarabawar Karshe: Al-Aadaab Al-Asharah (الآداب العشرة)',
    duration_minutes: 45,
    pass_mark: 60,
    is_published: true,
    questions: [
      {
        id: 'q_adab_f1',
        exam_id: 'exam_adab_final',
        format: 'mcq',
        prompt_ar: 'A bisa sunnar Manzon Allah ﷺ, wane ne ya kamata ya fara yin sallama?',
        max_points: 25,
        options: [
          { id: 'opt1', text_ar: 'Wanda yake tafiya a kan mai zama (المار على القاعد)', is_correct: true },
          { id: 'opt2', text_ar: 'Babban mutum a kan karami a ko da yaushe', is_correct: false },
          { id: 'opt3', text_ar: 'Mai yawa a kan kadan', is_correct: false }
        ]
      },
      {
        id: 'q_adab_f2',
        exam_id: 'exam_adab_final',
        format: 'tf',
        prompt_ar: 'Idan ka nemi izinin shiga gida sau uku ba a amsa maka ba, ya kamata ka tsaya ka jira a kofa har sai an bude.',
        max_points: 25,
        options: [
          { id: 'opt_true', text_ar: 'Gaskiya ne (True / صواب)', is_correct: false },
          { id: 'opt_false', text_ar: 'Kuskure ne, sunnah ita ce ka koma (False / خطأ)', is_correct: true }
        ]
      },
      {
        id: 'q_adab_f3',
        exam_id: 'exam_adab_final',
        format: 'fill',
        prompt_ar: 'Lafazin addu\'ar da ake yi wa wanda ya yi atishawa ya ce Alhamdu lillah shi ne: ________ .',
        expected_answer: 'Yarhamukallah',
        max_points: 25
      },
      {
        id: 'q_adab_f4',
        exam_id: 'exam_adab_final',
        format: 'essay',
        prompt_ar: 'Kawo hadisi guda daya a kan ladubban cin abinci da shan ruwa tare da bayyana darussan da aka koya a ciki.',
        rubric_ar: 'Kawo hadisin "Ya ghulam, sammillah..." da ma\'anarsa a Hausa da ladubban cin abinci.',
        max_points: 25
      }
    ]
  }
];

export const INITIAL_ATTEMPTS: ExamAttempt[] = [
  {
    id: 'att_live_s42',
    exam_id: 'exam_adab_final',
    course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
    student_id: 's42',
    student_name_ar: 'Zainab Sulaiman Falke (زينب سليمان فلكي)',
    started_at: '2026-10-06T00:15:00Z',
    submitted_at: '2026-10-06T00:38:00Z',
    status: 'marked',
    score_pct: 76.67,
    total_points: 76.67,
    max_points: 100,
    responses: {
      q_adab_f1: { selected: ['opt1'] },
      q_adab_f2: { selected: ['opt_false'] },
      q_adab_f3: { text: 'Yarhamukallah' },
      q_adab_f4: { text: 'Hadisin Umar bin Abi Salama: Manzon Allah ﷺ ya ce masa: Ya yaro, ka ambaci sunan Allah, ka ci da damanka, kuma ka ci daga abin da ke gabanka.' }
    },
    grades: {
      q_adab_f1: { points: 25, feedback: 'Amsa ce daidai.' },
      q_adab_f2: { points: 25, feedback: 'Daidai ne, komawa ake yi bayan sau uku.' },
      q_adab_f3: { points: 25, feedback: 'Masha Allah, daidai.' },
      q_adab_f4: { points: 1.67, feedback: 'Kyakkyawan bayani da hadisi ingantacce.' }
    },
    security_events: []
  }
];

export const INITIAL_CERTIFICATES: CertificateRecord[] = [
  {
    id: 'cert_live_s42',
    certificate_no: 'MIFTAH-2026-0042',
    student_id: 's42',
    student_name: 'Zainab Sulaiman Falke',
    student_name_ar: 'زينب سليمان فلكي',
    course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
    course_name_ar: 'Al-Aadaab Al-Asharah (الآداب العشرة)',
    grade_band_ar: 'Jinjina Mai Girma (Very Good / جيد جداً)',
    final_score: 86.83,
    issued_at: '2026-10-06',
    status: 'valid',
    qr_payload: 'https://almiftahu.edu/verify?cert=MIFTAH-2026-0042&sn=42'
  }
];
