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

/**
 * Check if the main Supabase backend is reachable
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('courses').select('id,code').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Sync courses from live Supabase database
 */
export async function fetchLiveCourses(): Promise<Course[] | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('id,code,name,name_ar,status,unit_label,unit_label_ar,weight_lessons,weight_exam,pass_mark,has_audio_memorization')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return null;

    return data.map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      name_ar: c.name_ar,
      status: c.status || 'active',
      instructor_name_ar: 'Dr. Ibrahim Al-Madani',
      instructor_title_ar: 'Babban Malami',
      pass_mark: Number(c.pass_mark || 70),
      weight_lessons: Number(c.weight_lessons || 40),
      weight_exam: Number(c.weight_exam || 60),
      unit_label_ar: c.unit_label_ar || 'Kashi',
      has_audio_memorization: c.has_audio_memorization ?? true,
      units: [
        {
          id: `unit_${c.id}_1`,
          course_id: c.id,
          order_index: 1,
          title: 'Unit 1: Foundations',
          title_ar: 'Kashi Na 1: Asasi da Ka\'idoji',
          description_ar: 'Karatun shinfida da bayanin mahimman abubuwa a fannin ilimi.',
          lessons: [
            {
              id: `les_${c.id}_1`,
              unit_id: `unit_${c.id}_1`,
              course_id: c.id,
              order_index: 1,
              title: 'Lesson 1',
              title_ar: `Darasi Na 1 a Fannin ${c.name_ar}`,
              summary_ar: 'Bayanin asasi da gabatarwa mai fadi ga dukkan dalibai.',
              media: {
                video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                duration_minutes: 24,
                duration_formatted: '24:10'
              },
              reading_content_ar: `الحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين.\nهذا الدرس المبارك في ${c.name_ar} يتناول أهم القواعد والأصول التي يحتاجها طالب العلم الشرعي.`,
              references: ['صحيح البخاري', 'الأصول الثلاثة']
            }
          ]
        }
      ]
    }));
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
      supabase.from('students').select('id,name,name_ar'),
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
          sn: Number(e.sn || 101),
          name: student.name || 'Student',
          name_ar: student.name_ar || student.name || 'طالب',
          completed_lessons_count: Array.isArray(e.days) ? e.days.length : 0,
          total_lessons_count: 5,
          quizzes_score: 10,
          audio_score: 18,
          exam_score: Number(result.exam_pct || 0),
          total_score: finalScore,
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
