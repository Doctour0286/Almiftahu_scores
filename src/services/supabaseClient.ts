import { createClient } from '@supabase/supabase-js';
import { Course, GradebookRow, UserAccount, AudioSubmission } from '../types/lms';

// Production credentials from the main app config
const DEFAULT_URL = 'https://vnqgxopexirycynuybyc.supabase.co';
const DEFAULT_KEY = 'sb_publishable_7UKp2chrOS99hEEfICCqUQ_eyr-_cef';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_URL;
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

export interface SupabaseStatusInfo {
  connected: boolean;
  url: string;
  studentCount: number;
  courseCount: number;
  submissionsCount: number;
  lastSyncedAt: string | null;
}

let cachedStatus: SupabaseStatusInfo = {
  connected: false,
  url: SUPABASE_URL,
  studentCount: 0,
  courseCount: 0,
  submissionsCount: 0,
  lastSyncedAt: null
};

export function getCachedSupabaseStatus(): SupabaseStatusInfo {
  return cachedStatus;
}

/**
 * Check if the main Supabase backend is reachable
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('courses').select('id,code').limit(1);
    const ok = !error;
    cachedStatus.connected = ok;
    if (ok) {
      cachedStatus.lastSyncedAt = new Date().toISOString();
    }
    return ok;
  } catch {
    cachedStatus.connected = false;
    return false;
  }
}

/**
 * Fetch all registered students from live Supabase DB
 */
export async function fetchLiveStudents(): Promise<UserAccount[]> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id,sn,name,name_ar')
      .order('sn', { ascending: true });

    if (error || !data) return [];

    cachedStatus.studentCount = data.length;

    return data.map((s: any) => ({
      id: s.id,
      sn: Number(s.sn || 1),
      institution_code: `MIF-2026-${String(s.sn || 1).padStart(3, '0')}`,
      email: `student.${s.id}@almiftahu.edu`,
      role: 'student' as const,
      name: s.name || `Student ${s.sn}`,
      name_ar: s.name_ar || s.name || 'طالب',
      gender: 'male',
      nationality: 'Dan Najeriya',
      country: 'Nigeria',
      education_level: 'Matakin Farko',
      assigned_courses: ['e7e08a6f-2d32-4d45-8720-c1f98e58563b', 'ADAB'],
      created_at: new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Failed to fetch live students from Supabase:', err);
    return [];
  }
}

const ADAB_LESSONS_DATA = [
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

/**
 * Sync courses from live Supabase database
 */
export async function fetchLiveCourses(): Promise<Course[] | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('id,code,name,name_ar,status,unit_label,unit_label_ar,day_count,weight_lessons,weight_exam,pass_mark,has_audio_memorization')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return null;

    cachedStatus.courseCount = data.length;

    return data.map((c: any) => {
      // Build lessons for ADAB or general course
      const dayCount = Math.max(1, Math.min(10, Number(c.day_count || 10)));
      const lessonsList = ADAB_LESSONS_DATA.slice(0, dayCount).map((item, idx) => ({
        id: `les_${c.id}_${item.num}`,
        unit_id: `unit_${c.id}_${Math.ceil((idx + 1) / 5)}`,
        course_id: c.id,
        order_index: item.num,
        title: item.titleEn,
        title_ar: item.titleAr,
        summary_ar: item.summaryHa,
        has_memorization: c.has_audio_memorization ?? true,
        memorization_prompt: item.promptHa,
        media: {
          video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          duration_minutes: 20 + idx * 2,
          duration_formatted: `${20 + idx * 2}:00`
        },
        reading_content_ar: item.readingAr,
        references: ['الأدب المفرد للإمام البخاري', 'شرح الآداب العشرة للشيخ صالح العصيمي'],
        quiz: {
          id: `quiz_${c.id}_${item.num}`,
          lesson_id: `les_${c.id}_${item.num}`,
          title_ar: `اختبار قصير: ${item.titleAr}`,
          max_points: 10,
          questions: [
            {
              id: `q_${item.num}_1`,
              format: 'mcq' as const,
              prompt_ar: item.quizQ,
              max_points: 10,
              options: [
                { id: 'opt0', text_ar: item.quizOpts[0], is_correct: item.quizCorrect === 'opt0' },
                { id: 'opt1', text_ar: item.quizOpts[1], is_correct: item.quizCorrect === 'opt1' },
                { id: 'opt2', text_ar: item.quizOpts[2], is_correct: item.quizCorrect === 'opt2' }
              ]
            }
          ]
        }
      }));

      // Group into 2 units (Part 1 and Part 2)
      const unit1Lessons = lessonsList.slice(0, 5);
      const unit2Lessons = lessonsList.slice(5, 10);

      const units = [
        {
          id: `unit_${c.id}_1`,
          course_id: c.id,
          order_index: 1,
          title: 'Part 1: Social and Daily Manners (Manners 1 - 5)',
          title_ar: 'Kashi Na 1: Laduban Yau da Kullum (Darasi 1 - 5)',
          description_ar: 'Karatun shinfida da bayanin laduban sallama, izini, cin abinci, atishawa da harshe.',
          lessons: unit1Lessons
        }
      ];

      if (unit2Lessons.length > 0) {
        units.push({
          id: `unit_${c.id}_2`,
          course_id: c.id,
          order_index: 2,
          title: 'Part 2: Community and Worship Manners (Manners 6 - 10)',
          title_ar: 'Kashi Na 2: Laduban Jama\'a da Biyayya (Darasi 6 - 10)',
          description_ar: 'Karatun laduban hanya, barci, masallaci, zama a majalisa, da biyayya ga iyaye.',
          lessons: unit2Lessons
        });
      }

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        name_ar: c.name_ar,
        status: c.status || 'active',
        instructor_name_ar: 'Dr. Ibrahim Al-Madani',
        instructor_title_ar: 'Babban Malami',
        pass_mark: Number(c.pass_mark || 60),
        weight_lessons: Number(c.weight_lessons || 50),
        weight_exam: Number(c.weight_exam || 50),
        unit_label_ar: c.unit_label_ar || 'Rana',
        has_audio_memorization: c.has_audio_memorization ?? true,
        units
      };
    });
  } catch (err) {
    console.warn('Failed to fetch live courses from Supabase:', err);
    return null;
  }
}

/**
 * Fetch live Gradebook rows from Supabase (enrollments, students, enrollment_results)
 */
export async function fetchLiveGradebook(courseId: string): Promise<GradebookRow[] | null> {
  try {
    const [enrRes, stuRes, resultsRes] = await Promise.all([
      supabase.from('enrollments').select('id,student_id,sn,days,bonus_units,active').eq('course_id', courseId).eq('active', true),
      supabase.from('students').select('id,sn,name,name_ar'),
      supabase.from('enrollment_results').select('enrollment_id,status,lesson_pct,exam_pct,final,passed,band_label_ar,has_certificate').eq('course_id', courseId)
    ]);

    if (enrRes.error || !enrRes.data) return null;

    const studentsMap = new Map((stuRes.data || []).map((s: any) => [s.id, s]));
    const resultsMap = new Map((resultsRes.data || []).map((r: any) => [r.enrollment_id, r]));

    const rows: GradebookRow[] = enrRes.data
      .filter((e: any) => studentsMap.has(e.student_id))
      .map((e: any) => {
        const student: any = studentsMap.get(e.student_id);
        const result: any = resultsMap.get(e.id) || {};
        const finalScore = Number(result.final || 0);

        return {
          student_id: e.student_id,
          sn: Number(e.sn || student.sn || 101),
          name: student.name || 'Student',
          name_ar: student.name_ar || student.name || 'طالب',
          completed_lessons_count: Array.isArray(e.days) ? e.days.filter((d: number) => d >= 0).length : 0,
          total_lessons_count: 10,
          quizzes_score: 10,
          audio_score: 18,
          exam_score: Math.round(Number(result.exam_pct || 0)),
          total_score: Math.round(finalScore) || (Number(result.lesson_pct) ? Math.round(Number(result.lesson_pct) * 0.5) : 0),
          rank: 0,
          passed: Boolean(result.passed),
          has_certificate: Boolean(result.has_certificate)
        };
      });

    rows.sort((a, b) => b.total_score - a.total_score);
    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return rows;
  } catch (err) {
    console.warn('Failed to fetch live gradebook from Supabase:', err);
    return null;
  }
}

/**
 * Fetch live Audio Submissions from Supabase
 */
export async function fetchLiveAudioSubmissions(courseId?: string): Promise<AudioSubmission[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_audio_submissions', {
      p_course_id: courseId || null
    });

    if (error || !data) return [];

    cachedStatus.submissionsCount = data.length;

    return data.map((d: any) => ({
      id: d.id,
      lesson_id: d.lesson_id,
      lesson_title_ar: d.lesson_title_ar,
      course_id: d.course_id,
      student_id: d.student_id,
      student_name: d.student_name,
      student_name_ar: d.student_name_ar,
      audio_data_url: d.audio_data_url,
      duration_seconds: d.duration_seconds || 30,
      submitted_at: d.submitted_at,
      status: d.status,
      score: d.score,
      max_score: d.max_score || 20,
      teacher_feedback: d.teacher_feedback,
      graded_by: d.graded_by,
      graded_at: d.graded_at
    }));
  } catch (err) {
    console.warn('Failed to fetch live audio submissions:', err);
    return [];
  }
}

/**
 * Submit an audio recitation to live Supabase DB
 */
export async function submitLiveAudioRecitation(params: {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentNameAr: string;
  audioUrl: string;
  durationSeconds: number;
}): Promise<{ ok: boolean; id?: string }> {
  try {
    const { data, error } = await supabase.rpc('submit_audio_recitation', {
      p_lesson_id: params.lessonId,
      p_lesson_title: params.lessonTitle,
      p_course_id: params.courseId,
      p_student_id: params.studentId,
      p_student_name: params.studentName,
      p_student_name_ar: params.studentNameAr,
      p_audio_url: params.audioUrl,
      p_duration_seconds: params.durationSeconds
    });

    if (error) {
      console.warn('Supabase submit_audio_recitation error:', error);
      return { ok: false };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    console.warn('submitLiveAudioRecitation exception:', err);
    return { ok: false };
  }
}

/**
 * Grade an audio submission in live Supabase DB
 */
export async function gradeLiveAudioSubmission(params: {
  submissionId: string;
  approved: boolean;
  score: number;
  feedback?: string;
  teacherName: string;
}): Promise<{ ok: boolean }> {
  try {
    const { data, error } = await supabase.rpc('admin_grade_audio', {
      p_submission_id: params.submissionId,
      p_approved: params.approved,
      p_score: params.score,
      p_feedback: params.feedback || '',
      p_teacher_name: params.teacherName
    });

    if (error) {
      console.warn('Supabase admin_grade_audio error:', error);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.warn('gradeLiveAudioSubmission exception:', err);
    return { ok: false };
  }
}

/**
 * Authenticate staff with Supabase staff_login RPC
 */
export async function liveStaffLogin(email: string, pass: string): Promise<UserAccount | null> {
  try {
    const { data, error } = await supabase.rpc('staff_login', {
      p_email: email,
      p_password: pass
    });

    if (error || !data || data.ok === false) return null;

    return data.user as UserAccount;
  } catch {
    return null;
  }
}
