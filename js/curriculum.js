// Comprehensive Curriculum, Schedule, & Interactive Lesson Data
// Inspired by Madrasat al-Arqam (PRD LMS Overhaul)

const STORAGE_PROGRESS_KEY = 'almiftahu_lesson_progress';
const STORAGE_NOTES_KEY = 'almiftahu_lesson_notes';
const STORAGE_DISCUSSIONS_KEY = 'almiftahu_lesson_discussions';

export const PROGRAM_INFO = {
  id: 'seerah_program',
  title: 'مدرسة مفتاح العلم',
  title_en: 'Almiftahu Academy',
  subtitle: 'برنامج تعليمي إلكتروني يقدّم دراسة شمولية وموسعة للسيرة النبوية وأحوال النبي ﷺ وشمائله، بمنهج يجمع بين التفقه والاستنباط، والتأصيل العلمي وتوثيق الروايات.',
  batch: 'الدفعة الأولى',
  batch_en: 'First Batch (2026)',
  duration_years: 1,
  start_date: '2026-06-09',
  end_date: '2028-12-08',
  total_lessons: 76,
  total_projects: 1,
  banner_image: 'assets/hero.jpg',
  telegram_url: 'https://t.me/almiftahu_academy',
};

export const PROGRAM_LEVELS = [
  {
    id: 'level_1',
    number: 1,
    title: 'المرحلة الأولى',
    title_en: 'Level 1: The Prophetic Biography & Virtues',
    start_date: '2026-06-10',
    end_date: '2028-12-08',
    lesson_count: 76,
    project_count: 1,
    description: 'دراسة تأسيسية في السيرة النبوية من المولد الشريف حتى الهجرة النبوية المباركة وشرح الشمائل المحمدية للإمام الترمذي.',
  }
];

// 76 structured lessons with realistic Islamic educational curriculum
const SEED_LESSONS = [
  {
    id: 'les_01',
    num: 1,
    title: 'اللقاء التعريفي',
    title_en: 'Orientation & Introductory Meeting',
    date: '2026-06-14',
    type: 'video', // 'video' | 'audio' | 'reading'
    duration: '50:57',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    description: 'أهل دار مفتاح العلم 🤍🌿\n\nعلى أنوار التوفيق نبدأ الرحلة، وخيرُ ما يُعين على حسن المسير فيها معرفةُ معالمها وخطواتها؛ لذا نلتقي بكم في اللقاء التعريفي الذي تكتمل به معالم برنامجنا وخطته الدراسية والمنهجية المتبعة في التحصيل والاختبارات.',
    instructor: 'موسى أمينو محمد',
  },
  {
    id: 'les_02',
    num: 2,
    title: 'سيرة رسول الله ﷺ | 02 | أهمية معرفة الأنساب في السيرة النبوية',
    title_en: 'Importance of Prophetic Genealogy',
    date: '2026-06-20',
    type: 'video',
    duration: '42:15',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    description: 'مدخل إلى دراسة نسب النبي ﷺ الشريف، وبيان اصطفاء بني هاشم وقريش ومكانة العرب في الجزيرة قبل الإسلام، مع أهم الفوائد العقدية والتربوية.',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_03',
    num: 3,
    title: 'سيرة رسول الله ﷺ | 03 | مولد النبي ﷺ ونشأته الشريفة',
    title_en: 'The Blessed Birth and Upbringing',
    date: '2026-06-21',
    type: 'video',
    duration: '38:50',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    description: 'أحداث عام الفيل، مولد سيد ولد آدم ﷺ في مكة، رضاعه في بني سعد، وحفظ الله تعالى له في صباه وشبابه وتطهيره من أدران الجاهلية.',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_04',
    num: 4,
    title: 'سيرة رسول الله ﷺ | 04 | نظام الجاهلية وأخلاق العرب',
    title_en: 'Pre-Islamic Arab Society & Morals',
    date: '2026-06-22',
    type: 'audio',
    duration: '45:10',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    description: 'قراءة تحليلية في الجوانب الاجتماعية والدينية والسياسية في مكة والجزيرة العربية، وموقع الكعبة المشرفة وتجارة قريش وحلف الفضول.',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_05',
    num: 5,
    title: 'شرح الشمائل المحمدية - من ص 1 إلى ص 30',
    title_en: 'Shamā’il al-Muhammadiyyah (pp. 1-30)',
    date: '2026-06-24',
    type: 'reading',
    duration: '35:00',
    video_url: '',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    pdf_pages: '1 - 30',
    description: 'باب ما جاء في خلق رسول الله ﷺ وصفة وجهه الشريف ولونه وشعره، برواية الإمام أبي عيسى محمد بن عيسى الترمذي رحمه الله.',
    instructor: 'موسى أمينو محمد',
  },
  {
    id: 'les_06',
    num: 6,
    title: 'سيرة رسول الله ﷺ | 05 | تثبيت خديجة رضي الله عنها للنبي ﷺ',
    title_en: 'Role of Khadijah (ra) in Consoling the Prophet',
    date: '2026-06-30',
    type: 'video',
    duration: '48:20',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    description: 'نزول الوحي في غار حراء، فرجع بها رسول الله ﷺ ترجف بوادره، وموقف الصديقة الكبرى خديجة رضي الله عنها: «كلا والله ما يخزيك الله أبدًا».',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_07',
    num: 7,
    title: 'شرح الشمائل المحمدية - من ص 31 إلى ص 58',
    title_en: 'Shamā’il al-Muhammadiyyah (pp. 31-58)',
    date: '2026-07-02',
    type: 'reading',
    duration: '32:40',
    video_url: '',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    pdf_pages: '31 - 58',
    description: 'باب ما جاء في خاتم النبوة، وشيب رسول الله ﷺ، وكحله وخضابه، ومشيه ولباسه عليه أفضل الصلاة والسلام.',
    instructor: 'موسى أمينو محمد',
  },
  {
    id: 'les_08',
    num: 8,
    title: 'سيرة رسول الله ﷺ | 07 | العلم بالله أول دروس الوحي',
    title_en: 'Knowledge of Allah: First Divine Revelation',
    date: '2026-07-04',
    type: 'video',
    duration: '52:10',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    description: 'تأملات في فاتحة سورة العلق: ﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾، والربط المحكم بين العلم والعبودية والافتقار إلى الله.',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_09',
    num: 9,
    title: 'سيرة رسول الله ﷺ | 08 | "قم فأنذر" بداية الدعوة النبوية',
    title_en: 'Arise and Warn: The Launch of the Call',
    date: '2026-07-06',
    type: 'video',
    duration: '41:30',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    description: 'أمر الله تعالى لنبيه بالإنذار والدعوة، وانطلاق مرحلة الدعوة الفردية السرية واختيار دار الأرقم بن أبي الأرقم مقرًا للتربية.',
    instructor: 'د. إبراهيم المدني',
  },
  {
    id: 'les_10',
    num: 10,
    title: 'لقاء مفتوح ومناقشة علمية | مدرسة مفتاح العلم',
    title_en: 'Open Scholarly Discussion & Live Session',
    date: '2026-07-09',
    type: 'audio',
    duration: '58:00',
    video_url: '',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    description: 'جلسة إجابة عن أسئلة الطلاب المسجلة في لوحة النقاشات حول الأسابيع الأولى، مع توجيهات منهجية في استذكار كتب السنة.',
    instructor: 'موسى أمينو محمد',
  },
  {
    id: 'les_11',
    num: 11,
    title: 'سيرة رسول الله ﷺ | 09 | السابقون الأولون إلى الإسلام',
    title_en: 'The Vanguard: The First Muslims',
    date: '2026-07-15',
    type: 'video',
    duration: '46:30',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    description: 'إسلام أبي بكر الصديق، علي بن أبي طالب، زيد بن حارثة، وعثمان وطلحة والزبير رضي الله عنهم أجمعين وأثرهم في نشر التوحيد.',
    instructor: 'د. إبراهيم المدني',
  }
];

// Fill out remaining up to 76 lessons sequentially
for (let i = 12; i <= 76; i++) {
  const isReading = i % 4 === 0;
  const isAudio = i % 3 === 0 && !isReading;
  SEED_LESSONS.push({
    id: `les_${String(i).padStart(2, '0')}`,
    num: i,
    title: isReading 
      ? `شرح الشمائل المحمدية - الجزء ${Math.floor(i / 4) + 2}` 
      : (isAudio 
          ? `مدارسة صوتية وتأصيل فقهي | الدرس ${i}` 
          : `سيرة رسول الله ﷺ | الحلقة ${i} | محطات العهد المكي والمدني`),
    title_en: `Prophetic Biography & Texts - Lesson ${i}`,
    date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
    type: isReading ? 'reading' : (isAudio ? 'audio' : 'video'),
    duration: `${35 + (i % 20)}:00`,
    video_url: isReading ? '' : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    pdf_pages: isReading ? `ص ${i * 5} إلى ${i * 5 + 25}` : null,
    description: `متابعة المنهاج المقرر في السيرة العطرة ودراسة الفوائد التربوية والتطبيقات العملية للأمة المسلمة المعاصرة.`,
    instructor: i % 2 === 0 ? 'موسى أمينو محمد' : 'د. إبراهيم المدني',
  });
}

function getProgressMap() {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const initial = {
    'les_01': true,
    'les_02': true,
    'les_03': true,
    'les_04': true,
    'les_05': true,
    'les_06': true,
    'les_07': true,
    'les_08': true,
    'les_09': true,
    'les_10': true,
    'les_11': true,
  };
  localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(initial));
  return initial;
}

export function getAllLessons() {
  return SEED_LESSONS;
}

export function getLessonById(id) {
  return SEED_LESSONS.find(l => l.id === id) || SEED_LESSONS[0];
}

export function isLessonCompleted(lessonId) {
  const map = getProgressMap();
  return Boolean(map[lessonId]);
}

export function toggleLessonCompletion(lessonId) {
  const map = getProgressMap();
  map[lessonId] = !map[lessonId];
  try {
    localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(map));
  } catch (_) {}
  return map[lessonId];
}

export function getProgressStats() {
  const map = getProgressMap();
  const completed = Object.values(map).filter(Boolean).length;
  const total = SEED_LESSONS.length;
  const percentage = Math.round((completed / total) * 100);
  return { completed, total, percentage };
}

export function getLessonNotes(lessonId) {
  try {
    const raw = localStorage.getItem(STORAGE_NOTES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[lessonId] || '';
  } catch (_) {
    return '';
  }
}

export function saveLessonNotes(lessonId, text) {
  try {
    const raw = localStorage.getItem(STORAGE_NOTES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[lessonId] = text;
    localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function getLessonDiscussions(lessonId) {
  try {
    const raw = localStorage.getItem(STORAGE_DISCUSSIONS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[lessonId] || [
      {
        id: 'q_default_1',
        author: 'عبد الرحمن الصالح',
        date: 'منذ يومين',
        question: 'ما هو الراجح في سن النبي ﷺ عند خروجه مع عمه أبي طالب إلى الشام؟',
        answer: 'أحسن الله إليكم، الأصح والمشهور عند أهل السير أنه كان في الثانية عشرة من عمره الشريف، كما ذكر الحافظ ابن كثير وغيره.',
        answer_by: 'الشيخ موسى أمينو محمد'
      }
    ];
  } catch (_) {
    return [];
  }
}

export function addLessonDiscussion(lessonId, questionText, authorName = 'طالب') {
  try {
    const raw = localStorage.getItem(STORAGE_DISCUSSIONS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (!map[lessonId]) map[lessonId] = [];
    map[lessonId].unshift({
      id: 'q_' + Date.now(),
      author: authorName,
      date: 'الآن',
      question: questionText,
      answer: null,
      answer_by: null,
    });
    localStorage.setItem(STORAGE_DISCUSSIONS_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function getRecentLesson() {
  const map = getProgressMap();
  const nextIncomplete = SEED_LESSONS.find(l => !map[l.id]);
  return nextIncomplete || SEED_LESSONS[0];
}
