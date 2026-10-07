export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserAccount {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  name_ar: string;
  title?: string;
  title_ar?: string;
  gender?: 'male' | 'female';
  nationality?: string;
  country?: string;
  education_level?: string;
  assigned_courses?: string[]; // course codes or IDs, or ['ALL']
  avatar?: string;
  sn?: number;
  created_at: string;
}

export interface LessonMedia {
  video_url: string;
  audio_url: string;
  duration_minutes: number;
  duration_formatted: string;
}

export interface QuestionOption {
  id: string;
  text_ar: string;
  is_correct?: boolean;
}

export interface Question {
  id: string;
  exam_id?: string;
  format: 'mcq' | 'tf' | 'fill' | 'essay';
  prompt_ar: string;
  options?: QuestionOption[];
  expected_answer?: string;
  rubric_ar?: string;
  max_points: number;
}

export interface LessonQuiz {
  id: string;
  lesson_id: string;
  title_ar: string;
  questions: Question[];
  max_points: number;
}

export interface Lesson {
  id: string;
  unit_id: string;
  course_id: string;
  order_index: number;
  title: string;
  title_ar: string;
  summary_ar: string;
  media: LessonMedia;
  reading_content_ar: string;
  references: string[];
  // Per-lesson features
  has_memorization?: boolean;
  memorization_prompt?: string;
  quiz?: LessonQuiz;
}

export interface Unit {
  id: string;
  course_id: string;
  order_index: number;
  title: string;
  title_ar: string;
  description_ar: string;
  lessons: Lesson[];
  exam_id?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  name_ar: string;
  status: 'active' | 'archived';
  banner_image?: string;
  instructor_id?: string;
  instructor_name_ar: string;
  instructor_title_ar: string;
  pass_mark: number;
  weight_lessons: number;
  weight_exam: number;
  unit_label_ar: string;
  units: Unit[];
  description_ar?: string;
  // Feature toggle: Audio memorization submission option for this course
  has_audio_memorization?: boolean;
}

export interface AudioSubmission {
  id: string;
  lesson_id: string;
  lesson_title_ar: string;
  course_id: string;
  student_id: string;
  student_name: string;
  student_name_ar: string;
  audio_data_url: string; // Base64 data URL
  duration_seconds: number;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  score?: number;
  max_score: number;
  teacher_feedback?: string;
  graded_by?: string;
  graded_at?: string;
}

export interface LessonQuizAttempt {
  id: string;
  lesson_id: string;
  course_id: string;
  student_id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  answers: Record<string, any>;
}

export interface Exam {
  id: string;
  course_id: string;
  unit_id?: string;
  title_ar: string;
  duration_minutes: number;
  pass_mark: number;
  questions: Question[];
  is_published: boolean;
}

export interface SecurityEvent {
  timestamp: string;
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'copy_attempt';
  label_ar: string;
}

export interface GradeAttribution {
  points: number;
  feedback?: string;
  marked_by_name_ar?: string;
  marked_at?: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  course_id: string;
  student_id: string;
  student_name_ar: string;
  started_at: string;
  submitted_at?: string;
  status: 'in_progress' | 'needs_marking' | 'marked';
  score_pct?: number;
  total_points?: number;
  max_points?: number;
  responses: Record<string, any>;
  grades: Record<string, GradeAttribution>;
  security_events: SecurityEvent[];
}

export interface CertificateRecord {
  id: string;
  certificate_no: string;
  student_id: string;
  student_name: string;
  student_name_ar: string;
  course_id: string;
  course_name_ar: string;
  grade_band_ar: string;
  final_score: number;
  issued_at: string;
  status: 'valid' | 'revoked';
  qr_payload: string;
}

export interface InstitutionSettings {
  name_ar: string;
  name_en: string;
  signatory_name_ar: string;
  signatory_title_ar: string;
  certificate_prefix: string;
  default_wording_ar: string;
  logo_data_url: string;
  signature_data_url: string;
}

export interface StudentProgress {
  completed_lessons: string[];
  notes: Record<string, string>;
  current_lesson_id?: string;
}

export interface GradebookRow {
  student_id: string;
  sn: number;
  name: string;
  name_ar: string;
  completed_lessons_count: number;
  total_lessons_count: number;
  quizzes_score: number;
  audio_score: number;
  exam_score: number;
  total_score: number;
  rank: number;
  passed: boolean;
  has_certificate: boolean;
}
