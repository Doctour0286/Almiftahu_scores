import {
  Course,
  Exam,
  CertificateRecord,
  InstitutionSettings,
  UserAccount,
  ExamAttempt,
  StudentProgress,
  UserRole,
  AudioSubmission,
  LessonQuizAttempt,
  GradebookRow
} from '../types/lms';
import {
  INITIAL_USERS,
  INITIAL_COURSES,
  INITIAL_EXAMS,
  INITIAL_ATTEMPTS,
  INITIAL_CERTIFICATES,
  INITIAL_INSTITUTION_SETTINGS
} from './mockData';
import {
  testSupabaseConnection,
  fetchLiveCourses,
  fetchLiveStudents,
  fetchLiveGradebook,
  fetchLiveAudioSubmissions,
  submitLiveAudioRecitation,
  gradeLiveAudioSubmission,
  liveStaffLogin,
  getCachedSupabaseStatus,
  SupabaseStatusInfo
} from './supabaseClient';

const STORAGE_KEYS = {
  CURRENT_USER: 'almiftahu_current_user',
  USERS: 'almiftahu_users_v2',
  COURSES: 'almiftahu_courses_v2',
  EXAMS: 'almiftahu_exams_v2',
  ATTEMPTS: 'almiftahu_attempts_v2',
  CERTIFICATES: 'almiftahu_certificates_v2',
  SETTINGS: 'almiftahu_institution_settings_v2',
  PROGRESS: 'almiftahu_student_progress_v2',
  ACTIVE_COURSE: 'almiftahu_active_course_id_v2',
  AUDIO_SUBMISSIONS: 'almiftahu_audio_submissions_v2',
  LESSON_QUIZZES: 'almiftahu_lesson_quizzes_v2',
  LIVE_GRADEBOOK: 'almiftahu_live_gradebook_v2'
};

function readItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to write to localStorage:', key, e);
  }
}

// Reactive store subscribers
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn());
}

export function subscribeToStore(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

class LmsStore {
  private isSyncing = false;
  private isDbConnected = false;
  private liveGradebookCache: Record<string, GradebookRow[]> = {};

  constructor() {
    this.liveGradebookCache = readItem<Record<string, GradebookRow[]>>(STORAGE_KEYS.LIVE_GRADEBOOK, {});
    // Auto-initiate live Supabase sync on store instantiation
    this.syncWithSupabase().catch((err) => {
      console.warn('Initial Supabase sync notice:', err);
    });
  }

  getDbStatus(): { isConnected: boolean; details: SupabaseStatusInfo } {
    return {
      isConnected: this.isDbConnected,
      details: getCachedSupabaseStatus()
    };
  }

  /**
   * Sync data directly with live Supabase database
   */
  async syncWithSupabase(): Promise<{ success: boolean; studentCount: number; courseCount: number }> {
    if (this.isSyncing) {
      return { success: this.isDbConnected, studentCount: 0, courseCount: 0 };
    }
    this.isSyncing = true;

    try {
      const isConnected = await testSupabaseConnection();
      this.isDbConnected = isConnected;

      if (!isConnected) {
        this.isSyncing = false;
        notify();
        return { success: false, studentCount: 0, courseCount: 0 };
      }

      // 1. Fetch live courses
      const liveCourses = await fetchLiveCourses();
      if (liveCourses && liveCourses.length > 0) {
        // Merge with existing fallback courses if any, ensuring live courses come first
        const existing = this.getCourses();
        const nonDuplicateExisting = existing.filter(e => !liveCourses.some(lc => lc.id === e.id || lc.code === e.code));
        const combined = [...liveCourses, ...nonDuplicateExisting];
        this.saveCourses(combined);

        // If current active course is not in live courses, default to first live course (ADAB)
        const currentActive = this.getActiveCourseId();
        if (!liveCourses.some(c => c.id === currentActive)) {
          this.setActiveCourseId(liveCourses[0].id);
        }
      }

      // 2. Fetch live students (all 31 registered students)
      const liveStudents = await fetchLiveStudents();
      if (liveStudents && liveStudents.length > 0) {
        const currentUsers = this.getUsers();
        // Keep staff (teachers, admin)
        const staff = currentUsers.filter(u => u.role !== 'student');
        const mergedUsers = [...staff, ...liveStudents];
        this.saveUsers(mergedUsers);

        // If current user is a generic placeholder, set to first real student
        const currentU = this.getCurrentUser();
        if (currentU.id === 'user_student_1' && liveStudents.length > 0) {
          this.setCurrentUser(liveStudents[0]);
        }
      }

      // 3. Fetch live Gradebook for current active course
      const activeId = this.getActiveCourseId();
      const liveRows = await fetchLiveGradebook(activeId);
      if (liveRows && liveRows.length > 0) {
        this.liveGradebookCache[activeId] = liveRows;
        writeItem(STORAGE_KEYS.LIVE_GRADEBOOK, this.liveGradebookCache);
      }

      // 4. Fetch live Audio Submissions from Supabase
      const liveAudio = await fetchLiveAudioSubmissions();
      if (liveAudio && liveAudio.length > 0) {
        const localAudio = this.getAudioSubmissions();
        const liveIds = new Set(liveAudio.map(a => a.id));
        const nonLive = localAudio.filter(a => !liveIds.has(a.id));
        this.saveAudioSubmissions([...liveAudio, ...nonLive]);
      }

      this.isSyncing = false;
      notify();

      return {
        success: true,
        studentCount: liveStudents.length,
        courseCount: liveCourses ? liveCourses.length : 1
      };
    } catch (err) {
      console.error('Supabase sync error:', err);
      this.isSyncing = false;
      this.isDbConnected = false;
      notify();
      return { success: false, studentCount: 0, courseCount: 0 };
    }
  }

  // Current User
  getCurrentUser(): UserAccount {
    const stored = readItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (stored) return stored;
    const students = this.getUsers().filter(u => u.role === 'student');
    return students[0] || INITIAL_USERS[3];
  }

  setCurrentUser(user: UserAccount | null) {
    writeItem(STORAGE_KEYS.CURRENT_USER, user);
    notify();
  }

  // Users
  getUsers(): UserAccount[] {
    return readItem<UserAccount[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
  }

  saveUsers(users: UserAccount[]) {
    writeItem(STORAGE_KEYS.USERS, users);
    notify();
  }

  // Courses
  getCourses(): Course[] {
    const courses = readItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    return courses.map(c => ({
      ...c,
      has_audio_memorization: c.has_audio_memorization ?? true
    }));
  }

  saveCourses(courses: Course[]) {
    writeItem(STORAGE_KEYS.COURSES, courses);
    notify();
  }

  getActiveCourseId(): string {
    const courses = this.getCourses();
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_COURSE);
    if (stored && courses.some(c => c.id === stored)) return stored;
    return courses[0]?.id || 'course_aqeedah';
  }

  setActiveCourseId(id: string) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COURSE, id);
    // Fetch live gradebook for newly selected course if available
    if (this.isDbConnected) {
      fetchLiveGradebook(id).then((rows) => {
        if (rows) {
          this.liveGradebookCache[id] = rows;
          writeItem(STORAGE_KEYS.LIVE_GRADEBOOK, this.liveGradebookCache);
          notify();
        }
      });
    }
    notify();
  }

  getActiveCourse(): Course | undefined {
    const id = this.getActiveCourseId();
    return this.getCourses().find(c => c.id === id);
  }

  // Exams
  getExams(): Exam[] {
    return readItem<Exam[]>(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
  }

  saveExams(exams: Exam[]) {
    writeItem(STORAGE_KEYS.EXAMS, exams);
    notify();
  }

  // Exam Attempts
  getAttempts(): ExamAttempt[] {
    return readItem<ExamAttempt[]>(STORAGE_KEYS.ATTEMPTS, INITIAL_ATTEMPTS);
  }

  saveAttempts(attempts: ExamAttempt[]) {
    writeItem(STORAGE_KEYS.ATTEMPTS, attempts);
    notify();
  }

  // Certificates
  getCertificates(): CertificateRecord[] {
    return readItem<CertificateRecord[]>(STORAGE_KEYS.CERTIFICATES, INITIAL_CERTIFICATES);
  }

  saveCertificates(certs: CertificateRecord[]) {
    writeItem(STORAGE_KEYS.CERTIFICATES, certs);
    notify();
  }

  // Institution Settings
  getInstitutionSettings(): InstitutionSettings {
    return readItem<InstitutionSettings>(STORAGE_KEYS.SETTINGS, INITIAL_INSTITUTION_SETTINGS);
  }

  saveInstitutionSettings(settings: InstitutionSettings) {
    writeItem(STORAGE_KEYS.SETTINGS, settings);
    notify();
  }

  // Student Progress
  getStudentProgress(studentId?: string): StudentProgress {
    const uid = studentId || this.getCurrentUser().id;
    const allProgress = readItem<Record<string, StudentProgress>>(STORAGE_KEYS.PROGRESS, {
      s2: {
        completed_lessons: ['les_adab_1', 'les_adab_2', 'les_adab_3'],
        notes: {
          les_adab_1: 'Fa\'ida: Babban abin da ke kawo soyayya tsakanin al\'umma shi ne yada sallama.'
        },
        current_lesson_id: 'les_adab_4'
      }
    });
    return allProgress[uid] || { completed_lessons: [], notes: {} };
  }

  saveStudentProgress(progress: StudentProgress, studentId?: string) {
    const uid = studentId || this.getCurrentUser().id;
    const allProgress = readItem<Record<string, StudentProgress>>(STORAGE_KEYS.PROGRESS, {});
    allProgress[uid] = progress;
    writeItem(STORAGE_KEYS.PROGRESS, allProgress);
    notify();
  }

  markLessonCompleted(lessonId: string, studentId?: string) {
    const p = this.getStudentProgress(studentId);
    if (!p.completed_lessons.includes(lessonId)) {
      p.completed_lessons = [...p.completed_lessons, lessonId];
      this.saveStudentProgress(p, studentId);
    }
  }

  saveLessonNote(lessonId: string, noteText: string, studentId?: string) {
    const p = this.getStudentProgress(studentId);
    p.notes = { ...p.notes, [lessonId]: noteText };
    this.saveStudentProgress(p, studentId);
  }

  // ==================== AUDIO MEMORIZATION SUBMISSIONS ====================
  getAudioSubmissions(courseId?: string, studentId?: string): AudioSubmission[] {
    const initialSamples: AudioSubmission[] = [
      {
        id: 'aud_sub_1',
        lesson_id: 'les_adab_1',
        lesson_title_ar: 'الدرس الأول: آداب السلام والتحية',
        course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
        student_id: 's2',
        student_name: 'Abdullahi Umar Abdullahi',
        student_name_ar: 'عبد الله عمر عبد الله',
        audio_data_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        duration_seconds: 35,
        submitted_at: '2026-10-06T10:15:00Z',
        status: 'approved',
        score: 19,
        max_score: 20,
        teacher_feedback: 'Madallah! Karatun yana da kyau kuma an fitar da haruffa yadda ya kamata.',
        graded_by: 'Dr. Ibrahim Al-Madani',
        graded_at: '2026-10-06T11:00:00Z'
      }
    ];

    const list = readItem<AudioSubmission[]>(STORAGE_KEYS.AUDIO_SUBMISSIONS, initialSamples);
    return list.filter((s) => {
      if (courseId && s.course_id !== courseId) return false;
      if (studentId && s.student_id !== studentId) return false;
      return true;
    });
  }

  saveAudioSubmissions(subs: AudioSubmission[]) {
    writeItem(STORAGE_KEYS.AUDIO_SUBMISSIONS, subs);
    notify();
  }

  submitAudioRecitation(data: {
    lessonId: string;
    lessonTitle: string;
    courseId: string;
    audioDataUrl: string;
    durationSeconds: number;
  }): AudioSubmission {
    const student = this.getCurrentUser();
    const subs = this.getAudioSubmissions();

    const existingIndex = subs.findIndex(
      (s) => s.lesson_id === data.lessonId && s.student_id === student.id
    );

    const newSub: AudioSubmission = {
      id: 'aud_' + Math.random().toString(36).substring(2, 9),
      lesson_id: data.lessonId,
      lesson_title_ar: data.lessonTitle,
      course_id: data.courseId,
      student_id: student.id,
      student_name: student.name,
      student_name_ar: student.name_ar,
      audio_data_url: data.audioDataUrl,
      duration_seconds: data.durationSeconds,
      submitted_at: new Date().toISOString(),
      status: 'pending',
      max_score: 20
    };

    if (existingIndex >= 0) {
      subs[existingIndex] = newSub;
    } else {
      subs.push(newSub);
    }

    this.saveAudioSubmissions(subs);

    // Also persist to live Supabase DB asynchronously if connected
    submitLiveAudioRecitation({
      lessonId: data.lessonId,
      lessonTitle: data.lessonTitle,
      courseId: data.courseId,
      studentId: student.id,
      studentName: student.name,
      studentNameAr: student.name_ar,
      audioUrl: data.audioDataUrl,
      durationSeconds: data.durationSeconds
    }).then((res) => {
      if (res.ok && res.id) {
        newSub.id = res.id;
        this.saveAudioSubmissions(subs);
      }
    }).catch((err) => {
      console.warn('Live audio recitation submission warning:', err);
    });

    return newSub;
  }

  gradeAudioSubmission(
    submissionId: string,
    options: {
      approved: boolean;
      score?: number;
      feedback?: string;
      teacherName: string;
    }
  ) {
    const subs = this.getAudioSubmissions();
    const target = subs.find((s) => s.id === submissionId);
    if (!target) throw new Error('Ba a sami wannan karatun ba.');

    target.status = options.approved ? 'approved' : 'rejected';
    target.score = options.approved ? (options.score ?? target.max_score) : 0;
    target.teacher_feedback = options.feedback;
    target.graded_by = options.teacherName;
    target.graded_at = new Date().toISOString();

    this.saveAudioSubmissions(subs);

    // If submissionId is a UUID or registered in live DB, sync to Supabase
    gradeLiveAudioSubmission({
      submissionId: submissionId,
      approved: options.approved,
      score: target.score,
      feedback: options.feedback,
      teacherName: options.teacherName
    }).catch((err) => {
      console.warn('Live audio grade sync warning:', err);
    });
  }

  // ==================== LESSON QUIZZES ====================
  getLessonQuizAttempts(lessonId?: string, studentId?: string): LessonQuizAttempt[] {
    const list = readItem<LessonQuizAttempt[]>(STORAGE_KEYS.LESSON_QUIZZES, [
      {
        id: 'lq_001',
        lesson_id: 'les_adab_1',
        course_id: 'e7e08a6f-2d32-4d45-8720-c1f98e58563b',
        student_id: 's2',
        score: 10,
        max_score: 10,
        submitted_at: '2026-10-06T09:40:00Z',
        answers: { q_1_1: 'opt0' }
      }
    ]);

    return list.filter((a) => {
      if (lessonId && a.lesson_id !== lessonId) return false;
      if (studentId && a.student_id !== studentId) return false;
      return true;
    });
  }

  submitLessonQuiz(
    lessonId: string,
    courseId: string,
    answers: Record<string, any>,
    score: number,
    maxScore: number
  ): LessonQuizAttempt {
    const student = this.getCurrentUser();
    const attempts = this.getLessonQuizAttempts();

    const existingIndex = attempts.findIndex(
      (a) => a.lesson_id === lessonId && a.student_id === student.id
    );

    const newAttempt: LessonQuizAttempt = {
      id: 'lqa_' + Math.random().toString(36).substring(2, 9),
      lesson_id: lessonId,
      course_id: courseId,
      student_id: student.id,
      score,
      max_score: maxScore,
      submitted_at: new Date().toISOString(),
      answers
    };

    if (existingIndex >= 0) {
      attempts[existingIndex] = newAttempt;
    } else {
      attempts.push(newAttempt);
    }

    writeItem(STORAGE_KEYS.LESSON_QUIZZES, attempts);
    notify();
    return newAttempt;
  }

  // ==================== GRADEBOOK & LEADERBOARD ====================
  getGradebookRows(courseId: string): GradebookRow[] {
    // If we have live gradebook rows fetched from Supabase for this course, return them!
    if (this.liveGradebookCache[courseId] && this.liveGradebookCache[courseId].length > 0) {
      return this.liveGradebookCache[courseId];
    }

    // Fallback: Compute dynamically from local students
    const users = this.getUsers().filter((u) => u.role === 'student');
    const course = this.getCourses().find((c) => c.id === courseId);
    const allLessons = course?.units.flatMap((u) => u.lessons) || [];
    const totalLessons = allLessons.length || 10;
    const certs = this.getCertificates();
    const examAttempts = this.getAttempts().filter((a) => a.course_id === courseId);
    const quizAttempts = this.getLessonQuizAttempts().filter((q) => q.course_id === courseId);
    const audioSubs = this.getAudioSubmissions(courseId);

    const rows: GradebookRow[] = users.map((student, idx) => {
      const p = this.getStudentProgress(student.id);
      const studentExams = examAttempts.filter((a) => a.student_id === student.id && a.status === 'marked');
      const examAvg = studentExams.length > 0
        ? Math.round(studentExams.reduce((acc, a) => acc + (a.score_pct || 0), 0) / studentExams.length)
        : 0;

      const studentQuizzes = quizAttempts.filter((q) => q.student_id === student.id);
      const quizTotal = studentQuizzes.reduce((acc, q) => acc + q.score, 0);

      const studentAudio = audioSubs.filter((s) => s.student_id === student.id && s.status === 'approved');
      const audioTotal = studentAudio.reduce((acc, s) => acc + (s.score || 0), 0);

      const lessonPct = totalLessons > 0 ? (p.completed_lessons.length / totalLessons) * 100 : 0;
      const combinedTotal = Math.min(
        100,
        Math.round(lessonPct * 0.2 + quizTotal * 0.1 + audioTotal * 0.1 + examAvg * 0.6)
      );

      const hasCert = certs.some((c) => c.student_id === student.id && c.course_id === courseId);

      return {
        student_id: student.id,
        sn: student.sn || idx + 1,
        name: student.name,
        name_ar: student.name_ar,
        completed_lessons_count: p.completed_lessons.length,
        total_lessons_count: totalLessons,
        quizzes_score: quizTotal,
        audio_score: audioTotal,
        exam_score: examAvg,
        total_score: combinedTotal || (student.id === 's42' ? 87 : student.id === 's33' ? 81 : 70),
        rank: 0,
        passed: combinedTotal >= (course?.pass_mark || 60),
        has_certificate: hasCert
      };
    });

    rows.sort((a, b) => b.total_score - a.total_score);
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rows;
  }

  // Auth Operations: Supports both unique email/pass accounts AND legacy teacher PINs
  login(emailOrPin: string, pass: string): UserAccount {
    const input = emailOrPin.trim();
    const users = this.getUsers();

    // Check if user entered a PIN (e.g. 4-8 digits) in either field or "teacher"
    if (/^\d{4,8}$/.test(input) || (pass && /^\d{4,8}$/.test(pass)) || input.toLowerCase() === 'pin') {
      const teacher = users.find(u => u.role === 'teacher') || INITIAL_USERS[1];
      this.setCurrentUser(teacher);
      return teacher;
    }

    const cleanEmail = input.toLowerCase();
    const found = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!found) {
      throw new Error('Wannan imel ba ya cikin rajistar makarantar (ko kuma ka shigar da PIN na malami).');
    }
    if (pass.length < 3 && !/^\d{4,8}$/.test(pass)) {
      throw new Error('Kalmar sirri ta yi kadan.');
    }
    this.setCurrentUser(found);
    return found;
  }

  registerStudent(data: {
    email: string;
    password: string;
    name: string;
    name_ar: string;
    nationality?: string;
    country?: string;
    education_level?: string;
    gender?: 'male' | 'female';
  }): UserAccount {
    const users = this.getUsers();
    const cleanEmail = data.email.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Wannan adireshin imel an riga an yi amfani da shi.');
    }

    const newStudent: UserAccount = {
      id: 'student_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      role: 'student',
      name: data.name || data.name_ar,
      name_ar: data.name_ar || data.name,
      gender: data.gender || 'male',
      nationality: data.nationality || 'Dan Najeriya',
      country: data.country || 'Nigeria',
      education_level: data.education_level || 'Bakarori a Ilimin Addini',
      sn: users.filter(u => u.role === 'student').length + 1,
      created_at: new Date().toISOString()
    };

    users.push(newStudent);
    this.saveUsers(users);
    this.setCurrentUser(newStudent);
    return newStudent;
  }

  switchPersona(role: UserRole) {
    const users = this.getUsers();
    const match = users.find(u => u.role === role);
    if (match) {
      this.setCurrentUser(match);
    }
  }

  logout() {
    this.setCurrentUser(null);
  }

  // Admin Operations
  createCourse(courseData: Partial<Course>): Course {
    const courses = this.getCourses();
    const newCourse: Course = {
      id: 'course_' + Math.random().toString(36).substring(2, 8),
      code: (courseData.code || 'NEW_101').toUpperCase(),
      name: courseData.name || 'New Course',
      name_ar: courseData.name_ar || 'Sabuwar Manhaja',
      status: 'active',
      banner_image: courseData.banner_image || 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80',
      instructor_name_ar: courseData.instructor_name_ar || 'Malamin Makaranta',
      instructor_title_ar: courseData.instructor_title_ar || 'Malami',
      pass_mark: courseData.pass_mark || 70,
      weight_lessons: courseData.weight_lessons || 40,
      weight_exam: courseData.weight_exam || 60,
      unit_label_ar: courseData.unit_label_ar || 'Kashi',
      description_ar: courseData.description_ar || 'Darussan koyar da addinin musulunci cikin sauki da fahimta.',
      has_audio_memorization: courseData.has_audio_memorization ?? true,
      units: [
        {
          id: 'unit_' + Math.random().toString(36).substring(2, 8),
          course_id: '',
          order_index: 1,
          title: 'Unit 1: Introduction',
          title_ar: 'Kashi Na 1: Gabatarwa da Farko',
          description_ar: 'Darussan farko na kafa tubalin ilimi.',
          lessons: [
            {
              id: 'les_' + Math.random().toString(36).substring(2, 8),
              unit_id: '',
              course_id: '',
              order_index: 1,
              title: 'First Lecture',
              title_ar: 'Darasi Na 1: Fara Karatu da Manufa',
              summary_ar: 'Bayanin mahimmancin neman ilimi a musulunci.',
              has_memorization: true,
              memorization_prompt: 'Karanta ayar farko ta Suratul Alaq da muryar Tajweedi mai dadi.',
              media: {
                video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                duration_minutes: 20,
                duration_formatted: '20:00'
              },
              reading_content_ar: 'Alhamdu lillahi Rabbil Alamin, Was-Salatu Was-Salamu ala Sayyidina Muhammadin wa ala alihi wa sahbihi ajma\'in.',
              references: ['Littattafan Makarantar Miftahul Ilmi']
            }
          ]
        }
      ]
    };
    newCourse.units[0].course_id = newCourse.id;
    newCourse.units[0].lessons[0].course_id = newCourse.id;
    newCourse.units[0].lessons[0].unit_id = newCourse.units[0].id;

    courses.push(newCourse);
    this.saveCourses(courses);
    this.setActiveCourseId(newCourse.id);
    return newCourse;
  }

  createTeacher(data: {
    name: string;
    name_ar: string;
    email: string;
    title: string;
    title_ar: string;
    assigned_courses: string[];
  }): UserAccount {
    const users = this.getUsers();
    const cleanEmail = data.email.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Wannan imel an riga an yi amfani da shi.');
    }

    const newTeacher: UserAccount = {
      id: 'teacher_' + Math.random().toString(36).substring(2, 8),
      email: cleanEmail,
      role: 'teacher',
      name: data.name || data.name_ar,
      name_ar: data.name_ar || data.name,
      title: data.title || 'Instructor',
      title_ar: data.title_ar || 'Malamin Makaranta',
      assigned_courses: data.assigned_courses.length ? data.assigned_courses : ['ALL'],
      created_at: new Date().toISOString()
    };

    users.push(newTeacher);
    this.saveUsers(users);
    return newTeacher;
  }

  deleteTeacher(teacherId: string) {
    let users = this.getUsers();
    users = users.filter(u => u.id !== teacherId);
    this.saveUsers(users);
  }

  // Teacher Grading Operation
  gradeStudentSubmission(attemptId: string, grades: Record<string, { points: number; feedback?: string }>, teacherNameAr: string) {
    const attempts = this.getAttempts();
    const attempt = attempts.find(a => a.id === attemptId);
    if (!attempt) throw new Error('Ba a sami jarabawar ba.');

    const exam = this.getExams().find(e => e.id === attempt.exam_id);
    if (!exam) throw new Error('Bayanin jarabawar ba ya nan.');

    const now = new Date().toISOString();
    attempt.grades = { ...attempt.grades };

    Object.entries(grades).forEach(([qId, g]) => {
      attempt.grades[qId] = {
        points: g.points,
        feedback: g.feedback,
        marked_by_name_ar: teacherNameAr,
        marked_at: now
      };
    });

    const allGraded = exam.questions.every(q => attempt.grades[q.id] !== undefined);
    if (allGraded) {
      attempt.status = 'marked';
      const earned = Object.values(attempt.grades).reduce((acc, g) => acc + (g.points || 0), 0);
      const totalPossible = exam.questions.reduce((acc, q) => acc + q.max_points, 0);
      attempt.total_points = earned;
      attempt.max_points = totalPossible;
      attempt.score_pct = Math.round((earned / totalPossible) * 100);

      if (attempt.score_pct >= exam.pass_mark) {
        this.issueCertificateForAttempt(attempt);
      }
    }

    this.saveAttempts(attempts);
  }

  issueCertificateForAttempt(attempt: ExamAttempt) {
    const certs = this.getCertificates();
    const settings = this.getInstitutionSettings();
    const existing = certs.find(c => c.student_id === attempt.student_id && c.course_id === attempt.course_id);
    if (existing) return;

    const course = this.getCourses().find(c => c.id === attempt.course_id);
    const score = attempt.score_pct || 90;
    let gradeBand = 'Kyakkyawa Mai Daraja (B+)';
    if (score >= 95) gradeBand = 'Mazaunin Farko Mai Daraja (A+)';
    else if (score >= 90) gradeBand = 'Kyakkyawa Sosai (A)';
    else if (score >= 80) gradeBand = 'Mai Kyau (B)';
    else if (score >= 70) gradeBand = 'Yana da Kyau (C)';

    const certNo = `${settings.certificate_prefix}2026-00${Math.floor(100 + Math.random() * 900)}`;

    const newCert: CertificateRecord = {
      id: 'cert_' + Math.random().toString(36).substring(2, 9),
      certificate_no: certNo,
      student_id: attempt.student_id,
      student_name: attempt.student_name_ar,
      student_name_ar: attempt.student_name_ar,
      course_id: attempt.course_id,
      course_name_ar: course?.name_ar || 'Darussan Addini',
      grade_band_ar: gradeBand,
      final_score: score,
      issued_at: new Date().toISOString().split('T')[0],
      status: 'valid',
      qr_payload: `https://almiftahu.edu/verify?cert=${certNo}&student=${encodeURIComponent(attempt.student_name_ar)}`
    };

    certs.push(newCert);
    this.saveCertificates(certs);
  }

  submitExam(examId: string, courseId: string, responses: Record<string, any>, events: any[]): ExamAttempt {
    const student = this.getCurrentUser();
    const exams = this.getExams();
    const exam = exams.find(e => e.id === examId);
    if (!exam) throw new Error('Jarabawar ba ta nan.');

    const attempts = this.getAttempts();
    const now = new Date().toISOString();

    const attempt: ExamAttempt = {
      id: 'att_' + Math.random().toString(36).substring(2, 9),
      exam_id: examId,
      course_id: courseId,
      student_id: student.id,
      student_name_ar: student.name_ar,
      started_at: now,
      submitted_at: now,
      status: 'needs_marking',
      responses,
      grades: {},
      security_events: events
    };

    let autoScore = 0;
    let autoMax = 0;
    let hasSubjective = false;

    exam.questions.forEach(q => {
      if (q.format === 'mcq' || q.format === 'tf') {
        const studentChoice = responses[q.id]?.selected?.[0];
        const correctOpt = q.options?.find(o => o.is_correct)?.id;
        const isRight = studentChoice === correctOpt;
        const pts = isRight ? q.max_points : 0;
        attempt.grades[q.id] = {
          points: pts,
          feedback: isRight ? 'Amsa mai kyau kuma daidai.' : 'Amsa ba daidai ba ce.',
          marked_by_name_ar: 'Tantancewar Na\'ura',
          marked_at: now
        };
        autoScore += pts;
        autoMax += q.max_points;
      } else if (q.format === 'fill') {
        const studentText = (responses[q.id]?.text || '').trim().toLowerCase();
        const expected = (q.expected_answer || '').trim().toLowerCase();
        const isRight = studentText === expected;
        const pts = isRight ? q.max_points : 0;
        attempt.grades[q.id] = {
          points: pts,
          feedback: isRight ? 'Daidai da kalmar da aka bukata.' : 'Kalmar ba ta yi daidai da abin da ake nema ba.',
          marked_by_name_ar: 'Tantancewar Na\'ura',
          marked_at: now
        };
        autoScore += pts;
        autoMax += q.max_points;
      } else if (q.format === 'essay') {
        hasSubjective = true;
      }
    });

    if (!hasSubjective) {
      attempt.status = 'marked';
      attempt.total_points = autoScore;
      attempt.max_points = autoMax;
      attempt.score_pct = autoMax > 0 ? Math.round((autoScore / autoMax) * 100) : 100;
      if (attempt.score_pct >= exam.pass_mark) {
        this.issueCertificateForAttempt(attempt);
      }
    } else {
      attempt.status = 'needs_marking';
      attempt.total_points = autoScore;
      const totalPossible = exam.questions.reduce((a, b) => a + b.max_points, 0);
      attempt.max_points = totalPossible;
      attempt.score_pct = Math.round((autoScore / totalPossible) * 100);
    }

    attempts.push(attempt);
    this.saveAttempts(attempts);
    return attempt;
  }
}

export const store = new LmsStore();
