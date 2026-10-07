export type Language = 'ha' | 'en' | 'ar';

export interface TranslationDictionary {
  // Brand & Slogan
  appName: string;
  appSubtitle: string;
  sloganRhyme: string;
  bismillah: string;
  
  // Navigation
  navHome: string;
  navSchedule: string;
  navPrograms: string;
  navClassroom: string;
  navExams: string;
  navCertificates: string;
  navTeacher: string;
  navAdmin: string;
  navMore: string;
  learningPortals: string;
  staffTools: string;
  adminGovernance: string;

  // Roles & User
  roleStudent: string;
  roleTeacher: string;
  roleAdmin: string;
  quickPersonaSwitch: string;
  loginBtn: string;
  logoutBtn: string;
  registerBtn: string;
  studentNumberPrefix: string;

  // Header & Notifications
  courseSelectLabel: string;
  notificationsTitle: string;
  notificationsNew: string;
  viewScheduleAction: string;

  // Home View
  welcomeBack: string;
  welcomeDesc: string;
  continueLessonAction: string;
  viewSyllabusAction: string;
  activeCourseProgress: string;
  lessonsCompletedOf: string;
  todaysLecturesTitle: string;
  certificatesHonorTitle: string;
  certificatesHonorDesc: string;
  curriculumRoadmapTitle: string;
  curriculumRoadmapDesc: string;
  viewAllCurricula: string;
  unitsCount: string;
  lessonsCount: string;
  unitExamLabel: string;
  enterExamAction: string;

  // Schedule View
  scheduleTitle: string;
  scheduleDesc: string;
  viewWeek: string;
  viewMonth: string;
  streakDays: string;
  studyHours: string;
  completedLessonsMetric: string;
  currentWeekLabel: string;
  todaysClassesTitle: string;
  todaysClassesDesc: string;
  startLectureBtn: string;
  reviewLectureBtn: string;
  timeLabel: string;
  durationLabel: string;

  // Programs View
  programsTitle: string;
  programsDesc: string;
  courseSwitchLabel: string;
  courseCompletionGauge: string;
  completedBadge: string;
  enterClassroomBtn: string;
  unitExamCardTitle: string;
  unitExamCardDesc: string;
  startExamBtn: string;

  // Lesson Classroom View
  lectureNo: string;
  playlistBtn: string;
  markCompletedBtn: string;
  alreadyCompletedBtn: string;
  videoModeTab: string;
  audioPodcastTab: string;
  audioStudioTitle: string;
  audioStudioDesc: string;
  playbackSpeedLabel: string;
  hiFiAudioBadge: string;
  tabSummaryReading: string;
  tabStudentNotes: string;
  tabDiscussionForum: string;
  summaryKicker: string;
  referencesTitle: string;
  notesTitle: string;
  notesSubtitle: string;
  autoSavedStatus: string;
  savingStatus: string;
  notesPlaceholder: string;
  discussionInstructorRole: string;
  askQuestionPlaceholder: string;
  sendQuestionBtn: string;
  playlistDrawerTitle: string;
  nowPlayingBadge: string;

  // Exams View
  examsHubTitle: string;
  examsHubDesc: string;
  viewCertificatesBtn: string;
  courseExamsTitle: string;
  noExamsPublished: string;
  questionsCountSuffix: string;
  passedBadge: string;
  failedBadge: string;
  pendingMarkingBadge: string;
  availableToTakeBadge: string;
  examDurationLabel: string;
  passMarkLabel: string;
  reviewAnswersBtn: string;
  startExamNowBtn: string;
  timeRemainingLabel: string;
  submitAnswersBtn: string;
  integrityWarning: string;
  pointsLabel: string;
  multipleChoiceLabel: string;
  trueFalseLabel: string;
  fillBlankLabel: string;
  essayQuestionLabel: string;
  gradingCriteriaLabel: string;
  essayPlaceholder: string;
  fillPlaceholder: string;
  confirmSubmissionNotice: string;
  confirmSubmitExamBtn: string;
  reviewModalTitle: string;
  studentResultStatus: string;
  markedAndCertified: string;
  waitingTeacherGrade: string;
  totalEarnedScore: string;
  studentAnswerLabel: string;
  teacherFeedbackLabel: string;
  integrityActivityLog: string;
  closeReviewBtn: string;

  // Certificates View
  certificatesHubTitle: string;
  certificatesHubDesc: string;
  searchCertificatePlaceholder: string;
  generalGradeLabel: string;
  previewCertificateBtn: string;
  officialCertTitle: string;
  printOrSavePdfBtn: string;
  certificatePassHeading: string;
  studentNamePrefix: string;
  certNumberLabel: string;
  issueDateLabel: string;
  verifiedOfficialBadge: string;

  // Teacher Workspace View
  teacherWorkspaceTitle: string;
  teacherWelcomeGreeting: string;
  teacherWorkspaceSubtitle: string;
  pendingMarkingCountText: string;
  assignedCoursesTitle: string;
  openClassroomLectureBtn: string;
  markingQueueTitle: string;
  markingQueueDesc: string;
  noPendingGrading: string;
  needsEssayMarkingBadge: string;
  startGradingBtn: string;
  gradingModalTitle: string;
  cancelBtn: string;
  awardedScoreLabel: string;
  teacherFeedbackInputLabel: string;
  teacherFeedbackPlaceholder: string;
  signAndIssueBtn: string;
  teacherSignatureStampPrefix: string;

  // Admin Console View
  adminConsoleTitle: string;
  adminConsoleHeading: string;
  adminConsoleSubtitle: string;
  tabInstitutionIdentity: string;
  tabCoursesManagement: string;
  tabFacultyStaff: string;
  institutionSettingsTitle: string;
  institutionSettingsDesc: string;
  saveChangesBtn: string;
  logoUploadLabel: string;
  logoUploadDesc: string;
  signatureUploadLabel: string;
  signatureUploadDesc: string;
  instNameArLabel: string;
  instNameEnLabel: string;
  signatoryNameLabel: string;
  signatoryTitleLabel: string;
  certPrefixLabel: string;
  defaultWordingLabel: string;
  coursesListTitle: string;
  coursesListDesc: string;
  addNewCourseBtn: string;
  activeCourseBadge: string;
  createCourseModalTitle: string;
  courseCodeLabel: string;
  coursePassMarkLabel: string;
  courseNameArLabel: string;
  courseNameEnLabel: string;
  courseInstructorLabel: string;
  courseDescLabel: string;
  courseBannerUploadLabel: string;
  publishCourseBtn: string;
  facultyListTitle: string;
  facultyListDesc: string;
  addNewTeacherBtn: string;
  createTeacherModalTitle: string;
  teacherNameArLabel: string;
  teacherNameEnLabel: string;
  teacherLoginEmailLabel: string;
  teacherPasswordLabel: string;
  teacherTitleLabel: string;
  assignCourseSelectLabel: string;
  allCoursesOption: string;
  saveTeacherAccountBtn: string;

  // Auth Modal
  unifiedAccessPortal: string;
  existingAccountTab: string;
  newStudentRegTab: string;
  emailLabel: string;
  passwordLabel: string;
  enterPlatformBtn: string;
  quickDemoAccountsHeading: string;
  adminDemoDesc: string;
  teacherDemoDesc: string;
  studentDemoDesc: string;
  fullNameArLabel: string;
  fullNameEnLabel: string;
  nationalityLabel: string;
  countryResidenceLabel: string;
  educationLevelLabel: string;
  createAccountAndStudyBtn: string;
  quickLoginLink: string;
  loginWithOtherAccount: string;
  closeBtn: string;
  // Voice Memorization
  audioRecitationSectionTitle: string;
  audioRecitationSubtitle: string;
  audioSubmissionPending: string;
  audioSubmissionApproved: string;
  audioSubmissionRejected: string;
  audioRepeatInstruction: string;
  audioTeacherScore: string;
  audioTeacherFeedback: string;
  reRecordAudioBtn: string;
  audioNotRequiredForCourse: string;
  audioRecitationVoiceHint: string;

  // Lesson Quiz (Per-Lesson Test)
  lessonQuizSectionTitle: string;
  lessonQuizNotice: string;
  lessonQuizTakeBtn: string;
  lessonQuizSubmittedScore: string;
  lessonQuizCompletedBadge: string;
  submitQuizBtn: string;
  lessonQuizQuestion: string;

  // Teacher Workspace Audio & Gradebook Tabs
  tabExamMarking: string;
  tabAudioGrading: string;
  tabGradebook: string;
  approveWithScoreBtn: string;
  rejectAndRepeatBtn: string;
  audioSubmissionsCount: string;
  noAudioSubmissions: string;
  allStatusFilter: string;
  pendingStatusFilter: string;
  approvedStatusFilter: string;
  rejectedStatusFilter: string;
  gradeAudioModalTitle: string;
  gradebookSearchPlaceholder: string;
  colSn: string;
  colStudent: string;
  colLessons: string;
  colQuizzes: string;
  colAudio: string;
  colExam: string;
  colTotalScore: string;
  colRank: string;
  colStatus: string;
  colCert: string;
  passedStatus: string;
  failedStatus: string;
  exportGradebookCsv: string;
  printGradebook: string;
  topRankStudentsTitle: string;
  courseToggleAudioMemoLabel: string;
  courseToggleAudioMemoDesc: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  ha: {
    // Brand & Slogan (Rhyme in Hausa)
    appName: 'Makarantar Miftahul Ilmi',
    appSubtitle: 'Cibiyar Koyar da Addinin Musulunci da Ilmin Shari\'a',
    sloganRhyme: 'Neman Ilimi Mabudin Nasara da Albarka — Daga Miftahu zuwa Hasken Rayuwa',
    bismillah: 'Da Sunan Allah Mai Rahama Mai Jin Kai',

    // Navigation
    navHome: 'Babban Shafin',
    navSchedule: 'Jadawalin Karatu',
    navPrograms: 'Tsarin Karatu',
    navClassroom: 'Zauren Karatu',
    navExams: 'Dakin Jarabawa',
    navCertificates: 'Takardun Shaida',
    navTeacher: 'Sashen Malamai',
    navAdmin: 'Hukumar Makaranta',
    navMore: 'Karin Wurare',
    learningPortals: 'Hanyoyin Karatu',
    staffTools: 'Kayan Aikin Malamai',
    adminGovernance: 'Hukumar Gudanarwa',

    // Roles & User
    roleStudent: 'Dalibin Ilimi',
    roleTeacher: 'Malami Mai Bada Horon',
    roleAdmin: 'Babban Darakta / Shugaba',
    quickPersonaSwitch: 'Sauya Matsayin Shiga',
    loginBtn: 'Shiga Shafin',
    logoutBtn: 'Fita Daga Shafin',
    registerBtn: 'Yi Sabon Rajista',
    studentNumberPrefix: 'Lambar Dalibi',

    // Header & Notifications
    courseSelectLabel: 'Zabi Darasi:',
    notificationsTitle: 'Sakonni da Sanarwa',
    notificationsNew: 'Sababbi',
    viewScheduleAction: 'Duba Jadawalin Kwanaki',

    // Home View
    welcomeBack: 'Barka da Zuwa,',
    welcomeDesc: 'Muna maraba da kai a babban dandalin koyon ilmin addini na Makarantar Miftahul Ilmi. Ka ci gaba da neman ilimi mai amfani a kowane lokaci.',
    continueLessonAction: 'Ci Gaba da Karatun:',
    viewSyllabusAction: 'Tsarin Darasi da Manhaja',
    activeCourseProgress: 'Ci Gaban Karatun Yanzu',
    lessonsCompletedOf: 'Ka kammala darussa',
    todaysLecturesTitle: 'Darussan Yau a Jadawali',
    certificatesHonorTitle: 'Takardun Shaida da Digiri',
    certificatesHonorDesc: 'Takardar shaidar kammala karatu tare da lambar QR na bincike',
    curriculumRoadmapTitle: 'Rabe-raben Tsarin Karatu',
    curriculumRoadmapDesc: 'An tsara su kashi-kashi cike da bidiyoyi, karatun sauti, takardun bita, da jarabawa',
    viewAllCurricula: 'Duba Dukkan Manhajoji',
    unitsCount: 'Kason Darussa',
    lessonsCount: 'Darussa',
    unitExamLabel: 'Jarabawar Kammala Wannan Bangare',
    enterExamAction: 'Shiga Jarabawa',

    // Schedule View
    scheduleTitle: 'Jadawalina da Tsarin Karatun Rana',
    scheduleDesc: 'Shirya lokutan darussa, bibiyar halartar karatu, da lokutan saurare na yau da kullum',
    viewWeek: 'Kwanakin Mako',
    viewMonth: 'Kwanakin Wata',
    streakDays: 'Kwanaki a Jere Kuna Karatu',
    studyHours: 'Awannin Saurare da Nazari',
    completedLessonsMetric: 'Darussan da Aka Kammala',
    currentWeekLabel: 'Kwanakin Wannan Mako',
    todaysClassesTitle: 'Jadawalin Darussan Yau',
    todaysClassesDesc: 'Darussa 3 da aka tsara za a koya a yau a cikin jadawalinka',
    startLectureBtn: 'Fara Sauraron Darasi',
    reviewLectureBtn: 'Sake Nazarin Darasi',
    timeLabel: 'Lokaci:',
    durationLabel: 'Tsawon Lokaci:',

    // Programs View
    programsTitle: 'Manhajoji da Tsarin Karatun Ilimi',
    programsDesc: 'Cikakken bayani kan darussan kowace manhaja da kason karatu da maki',
    courseSwitchLabel: 'Sauya Darasi:',
    courseCompletionGauge: 'Ci Gaban Darasi',
    completedBadge: 'An Kammala',
    enterClassroomBtn: 'Shiga Karatun',
    unitExamCardTitle: 'Jarabawar Karshen Wannan Kashi',
    unitExamCardDesc: 'Tana auna fahimtar dalibi tare da bashi damar samun maki na takardar shaida',
    startExamBtn: 'Fara Jarabawa',

    // Lesson Classroom View
    lectureNo: 'Darasi Mai Lamba',
    playlistBtn: 'Jerin Darussa',
    markCompletedBtn: 'Sanya Alamar An Kammala',
    alreadyCompletedBtn: 'An Kammala Wannan Darasi',
    videoModeTab: 'Bidiyon Darasi',
    audioPodcastTab: 'Muryar Saurare (Podcast)',
    audioStudioTitle: 'Sauraren Murya Mai Tsabta',
    audioStudioDesc: 'Saurari darasi a cikin mota ko yayin tafiya tare da rubuta muhimman fa\'idoji a kasa',
    playbackSpeedLabel: 'Gudun Murya:',
    hiFiAudioBadge: 'Muryar Sitidiyo Mai Inganci',
    tabSummaryReading: 'Bayanin Darasi da Littattafai',
    tabStudentNotes: 'Littafin Rubuta Fa\'idoji',
    tabDiscussionForum: 'Tambayoyi da Amsoshi',
    summaryKicker: 'Takaitaccen Makasudin Wannan Darasi:',
    referencesTitle: 'Littattafan Da Ake Koma Zuwa Gare Su:',
    notesTitle: 'Wurin Rubuta Muhimman Fa\'idoji',
    notesSubtitle: 'Ana ajiye dukkan rubutunku kai tsaye a cikin asusunku ba tare da batawa ba',
    autoSavedStatus: 'An Ajiye Kai Tsaye',
    savingStatus: 'Ana Kan Ajiye...',
    notesPlaceholder: 'Rubuta abubuwan da ka fahimta da fa\'idojin da ka tsinta daga wannan darasi a nan...',
    discussionInstructorRole: 'Malamin Wannan Darasi',
    askQuestionPlaceholder: 'Rubuta tambayarka ko neman karin bayani a nan...',
    sendQuestionBtn: 'Aika Tambaya',
    playlistDrawerTitle: 'Jerin Dukkan Darussan Wannan Fanni',
    nowPlayingBadge: 'Ana Saurare',

    // Exams View
    examsHubTitle: 'Dakin Jarabawa da Auna Fahimta',
    examsHubDesc: 'Jarabawowi na auna ilimin da aka koya domin samun takardar shaidar kammalawa',
    viewCertificatesBtn: 'Duba Takardun Shaidata',
    courseExamsTitle: 'Jarabawowin Da Aka Tsara a Wannan Fanni',
    noExamsPublished: 'Ba a bude wata jarabawa a wannan fanni a yanzu ba.',
    questionsCountSuffix: 'Tambayoyi',
    passedBadge: 'Ya Ci da Maki',
    failedBadge: 'Bai Kai Maki Ba',
    pendingMarkingBadge: 'Ana Kan Dubawa da Tantancewa',
    availableToTakeBadge: 'A Bude Take don Amsawa',
    examDurationLabel: 'Lokacin Jarabawa:',
    passMarkLabel: 'Makin Cin Nasara:',
    reviewAnswersBtn: 'Duba Amsoshi da Maki',
    startExamNowBtn: 'Fara Jarabawa Yanzu',
    timeRemainingLabel: 'Ragowar Lokaci:',
    submitAnswersBtn: 'Mika Dukkan Amsoshi',
    integrityWarning: 'Gargadi: An lura ka fita daga shafin jarabawar. Don Allah ka maida hankali a kan tambayoyin.',
    pointsLabel: 'Maki',
    multipleChoiceLabel: 'Zabi Amsar Da Ta Dace',
    trueFalseLabel: 'Gaskiya ko Kuskure',
    fillBlankLabel: 'Cike Gurbi da Kalma',
    essayQuestionLabel: 'Bayanin Rubutu (Insha\'i)',
    gradingCriteriaLabel: 'Ka\'idojin Bayar da Maki:',
    essayPlaceholder: 'Rubuta cikakkiyar amsarka tare da hujjoji da bayanan da aka bukata...',
    fillPlaceholder: 'Rubuta kalma ko jumlar da ta dace a nan...',
    confirmSubmissionNotice: 'Ka tabbata ka duba dukkan amsoshinka kafin mika jarabawar.',
    confirmSubmitExamBtn: 'Tabbatar da Mika Jarabawa',
    reviewModalTitle: 'Takardar Duba Sakamakon Dalibi',
    studentResultStatus: 'Halin Sakamako:',
    markedAndCertified: 'An Kammala Tantancewa da Amincewa',
    waitingTeacherGrade: 'Ana Jira Malami Ya Tantance Bangaren Rubutu',
    totalEarnedScore: 'Jimillar Makin Da Aka Samu',
    studentAnswerLabel: 'Amsar Da Dalibi Ya Bayar:',
    teacherFeedbackLabel: 'Karin Bayani da Shawarar Malami:',
    integrityActivityLog: 'Rikodin Bibiyar Halartar Jarabawa:',
    closeReviewBtn: 'Rufe Wannan Shafin',

    // Certificates View
    certificatesHubTitle: 'Rijistar Takardun Shaida da Shaidun Ilimi',
    certificatesHubDesc: 'Takardun shaidar da makarantar ta bayar tare da lambar QR na tantance ingancinsu',
    searchCertificatePlaceholder: 'Bincika da lambar takarda ko sunan dalibi...',
    generalGradeLabel: 'Matsayin Nasara:',
    previewCertificateBtn: 'Duba Takardar Shaida',
    officialCertTitle: 'Takardar Shaidar Makaranta Mai Daraja',
    printOrSavePdfBtn: 'Buga ko Ajiye a PDF',
    certificatePassHeading: 'Takardar Shaidar Kammala Darasin Addini',
    studentNamePrefix: 'Sunan Dalibi:',
    certNumberLabel: 'Lambar Takarda:',
    issueDateLabel: 'Ranar Bayarwa:',
    verifiedOfficialBadge: 'Ingantacciya kuma An Yi Rajistarta a Makaranta',

    // Teacher Workspace View
    teacherWorkspaceTitle: 'Sashen Aikin Malamai da Masu Kula',
    teacherWelcomeGreeting: 'Barka da Zuwa, Malami',
    teacherWorkspaceSubtitle: 'Kula da darussa, duba dalibai, da tantance jarabawowin da dalibai suka mika',
    pendingMarkingCountText: 'Jarabawowin da ke jiran a duba',
    assignedCoursesTitle: 'Darussan da Aka Dora Maka',
    openClassroomLectureBtn: 'Bude a Zauren Karatu',
    markingQueueTitle: 'Layukan Tantancewa da Saka Maki',
    markingQueueDesc: 'Duba amsoshin dalibai da sanya maki da rubuta shawarwari na gyara',
    noPendingGrading: 'Babu wata jarabawa da ke jiran a duba a yanzu. Dukkan aiyuka an kammala su!',
    needsEssayMarkingBadge: 'Yana Bukatar Tantance Rubutu',
    startGradingBtn: 'Fara Tantancewa da Bada Maki',
    gradingModalTitle: 'Tagar Bada Maki da Tantance Dalibi',
    cancelBtn: 'Soke',
    awardedScoreLabel: 'Makin Da Dalibi Ya Cancanta:',
    teacherFeedbackInputLabel: 'Shawarwari da Nasiha Daga Malami:',
    teacherFeedbackPlaceholder: 'Rubuta kalaman karfafa gwiwa ko gyara ga dalibi...',
    signAndIssueBtn: 'Sa Hannu da Tabbatar da Sakamako ga Dalibi',
    teacherSignatureStampPrefix: 'Za a tabbatar da wannan sakamako da sa hannun:',

    // Admin Console View
    adminConsoleTitle: 'Hukumar Gudanarwa da Ofishin Darakta',
    adminConsoleHeading: 'Gudanar da Makarantar Miftahul Ilmi',
    adminConsoleSubtitle: 'Sanya tambarin makaranta, sa hannun darakta, darussa, da asusun malamai',
    tabInstitutionIdentity: 'Tambari da Bayanan Makaranta',
    tabCoursesManagement: 'Kula da Darussa',
    tabFacultyStaff: 'Malamai Masu Koyarwa',
    institutionSettingsTitle: 'Saitunan Tambari da Takardun Shaida',
    institutionSettingsDesc: 'Dora tambarin makaranta, hoton sa hannun shugaba, da tsarin takardar shaida',
    saveChangesBtn: 'Ajiye Canje-canje',
    logoUploadLabel: 'Tambarin Makaranta (Logo)',
    logoUploadDesc: 'Dora fayil din hoton tambari don fitowa a saman shafi da kan takardun shaida',
    signatureUploadLabel: 'Hoton Sa Hannun Shugaba (Signature)',
    signatureUploadDesc: 'Dora hoton sa hannu don fitowa kai tsaye a kasan takardun shaida',
    instNameArLabel: 'Sunan Makaranta da Larabci',
    instNameEnLabel: 'Sunan Makaranta da Turanci',
    signatoryNameLabel: 'Sunan Shugaba Mai Sa Hannu',
    signatoryTitleLabel: 'Matsayin Shugaba Mai Sa Hannu',
    certPrefixLabel: 'Haruffan Fara Lambar Takarda (Prefix)',
    defaultWordingLabel: 'Bayanin Da Ke Cikin Takardar Shaida',
    coursesListTitle: 'Darussan Makaranta',
    coursesListDesc: 'Kirkirar sabon darasi, tsara makin kowace jarabawa, da sanya malamin da zai koyar',
    addNewCourseBtn: 'Kara Sabon Darasi',
    activeCourseBadge: 'Darasi Mai Aiki',
    createCourseModalTitle: 'Kirkirar Sabon Darasin Addini',
    courseCodeLabel: 'Lambar Darasi (Code) *',
    coursePassMarkLabel: 'Makin Cin Nasara (%)',
    courseNameArLabel: 'Sunan Darasi da Larabci *',
    courseNameEnLabel: 'Sunan Darasi da Turanci',
    courseInstructorLabel: 'Malamin Da Aka Dora Masa',
    courseDescLabel: 'Bayanin Darasi da Abubuwan Ciki',
    courseBannerUploadLabel: 'Hoton Murfin Darasi (Banner)',
    publishCourseBtn: 'Buga da Kaddamar da Darasi',
    facultyListTitle: 'Malamai Masu Koyarwa',
    facultyListDesc: 'Bude asusun musamman ga kowane malami da adireshin imel da kalmar sirri',
    addNewTeacherBtn: 'Kara Sabon Malami',
    createTeacherModalTitle: 'Bude Sabon Asusun Malami',
    teacherNameArLabel: 'Sunan Malami da Larabci *',
    teacherNameEnLabel: 'Sunan Malami da Turanci',
    teacherLoginEmailLabel: 'Adireshin Imel na Shiga *',
    teacherPasswordLabel: 'Kalmar Sirri *',
    teacherTitleLabel: 'Matsayi da Lakabi',
    assignCourseSelectLabel: 'Darasin da Za A Dora Masa',
    allCoursesOption: 'Dukkan Darussan Makaranta',
    saveTeacherAccountBtn: 'Ajiye da Bude Asusun Malami',

    // Auth Modal
    unifiedAccessPortal: 'Kofar Shiga Makarantar Miftahul Ilmi',
    existingAccountTab: 'Shiga Asusu (Wanda Ke Da Shi)',
    newStudentRegTab: 'Bude Sabon Asusun Dalibi',
    emailLabel: 'Adireshin Imel',
    passwordLabel: 'Kalmar Sirri',
    enterPlatformBtn: 'Shiga Dandalin Makaranta',
    quickDemoAccountsHeading: 'Shiga Cikin Sauri da Asusun Gwaji',
    adminDemoDesc: 'Shugaba / Darakta (Cikakken ikon makaranta da tambari)',
    teacherDemoDesc: 'Malami Mai Bada Horon (Tantance jarabawa da saka maki)',
    studentDemoDesc: 'Dalibi Mai Karatu (Karatun bidiyo, saurare, da takardar shaida)',
    fullNameArLabel: 'Cikakken Suna da Larabci (Kamar Yadda Zai Fito a Takarda) *',
    fullNameEnLabel: 'Suna da Turanci (Idan Akwai)',
    nationalityLabel: 'Kabila / Kasa',
    countryResidenceLabel: 'Kasar Da Ake Zama',
    educationLevelLabel: 'Matakin Karatu',
    createAccountAndStudyBtn: 'Bude Asusu da Fara Karatu Yanzu',
    quickLoginLink: 'Shiga',
    loginWithOtherAccount: 'Shiga da Wani Asusu',
    closeBtn: 'Rufe',

    // Voice Memorization
    audioRecitationSectionTitle: 'Karatun Hadda ta Murya (Audio Memorization)',
    audioRecitationSubtitle: 'Yi rikodin karatunka na hadda cikin sauti mai kyau domin malaminka ya saurara ya tantance.',
    audioSubmissionPending: 'Karatun yana jiran tantancewar malami',
    audioSubmissionApproved: 'Malami ya amince da karatunka!',
    audioSubmissionRejected: 'Malami ya bukaci ka sake karantawa',
    audioRepeatInstruction: 'Don Allah ka sake yin sabon rikodin bisa ka\'idojin da malami ya bayyana a kasa.',
    audioTeacherScore: 'Makin da aka bayar',
    audioTeacherFeedback: 'Bayanin Shawarar Malami',
    reRecordAudioBtn: 'Sake Rikodin Karatu',
    audioNotRequiredForCourse: 'Wannan fannin ba ya bukatar hadda ta murya.',
    audioRecitationVoiceHint: 'Sakon murya mai inganci da sauri',

    // Lesson Quiz (Per-Lesson Test)
    lessonQuizSectionTitle: 'Gwajin Gwano na Darasi (Quick Lesson Test)',
    lessonQuizNotice: 'Jarabawar bita: Ba ta hana wucewa ba, kuma tana taimakawa kadan wajen tara maki.',
    lessonQuizTakeBtn: 'Amsa Jarabawar Darasi',
    lessonQuizSubmittedScore: 'Makin Jarabawar Darasi',
    lessonQuizCompletedBadge: 'An Kammala Gwajin Darasi',
    submitQuizBtn: 'Mika Amsoshin Gwaji',
    lessonQuizQuestion: 'Tambayar Gwaji',

    // Teacher Workspace Audio & Gradebook Tabs
    tabExamMarking: 'Jarabawowin Karshe & Rubutu',
    tabAudioGrading: 'Karatun Hadda ta Murya',
    tabGradebook: 'Babban Rajistar Maki & Gwajin Gwano',
    approveWithScoreBtn: 'Amince da Bada Maki',
    rejectAndRepeatBtn: 'Bukaci Dalibi Ya Sake',
    audioSubmissionsCount: 'Adadin Karatuttukan Hadda',
    noAudioSubmissions: 'Babu karatun hadda da ke jiran tantancewa a halin yanzu.',
    allStatusFilter: 'Duka',
    pendingStatusFilter: 'Jiran Tantancewa',
    approvedStatusFilter: 'Wadanda Aka Amince',
    rejectedStatusFilter: 'Wadanda Aka Bukaci Maimaitawa',
    gradeAudioModalTitle: 'Tantance Karatun Hadda na Dalibi',
    gradebookSearchPlaceholder: 'Nemi dalibi da suna ko lambar dalibi...',
    colSn: 'Lamba',
    colStudent: 'Dalibi',
    colLessons: 'Darussa da aka Kammala',
    colQuizzes: 'Makin Quizzes',
    colAudio: 'Makin Hadda',
    colExam: 'Jarabawar Karshe',
    colTotalScore: 'Jimillar Maki',
    colRank: 'Matsayi',
    colStatus: 'Sakamako',
    colCert: 'Takardar Shaida',
    passedStatus: 'Ya Ci Jarabawa',
    failedStatus: 'Yana Bukatar Bita',
    exportGradebookCsv: 'Fitar da Takardar Maki (CSV)',
    printGradebook: 'Buga Takardar Maki (Print)',
    topRankStudentsTitle: 'Gwajin Gwano: Dalibai Masu Zakarun Maki',
    courseToggleAudioMemoLabel: 'Zaɓin Karatun Hadda ta Murya (Audio Recitation)',
    courseToggleAudioMemoDesc: 'Kunna ko kashe damar ɗora karatun hadda na murya ga wannan fannin darasi.'
  },

  en: {
    // Brand & Slogan
    appName: "Ma'had Miftah al-'Ilm",
    appSubtitle: 'Center for Classical Islamic Studies & Sacred Knowledge',
    sloganRhyme: 'Seeking Knowledge is the Key to Grace — Guiding Every Heart and Space',
    bismillah: 'In the Name of Allah, the Most Gracious, the Most Merciful',

    // Navigation
    navHome: 'Home',
    navSchedule: 'Study Schedule',
    navPrograms: 'Programs & Curriculum',
    navClassroom: 'Classroom & Media',
    navExams: 'Exams & Testing',
    navCertificates: 'Certificates Registry',
    navTeacher: 'Teacher Workspace',
    navAdmin: 'Admin Console',
    navMore: 'More Menu',
    learningPortals: 'Learning Portals',
    staffTools: 'Faculty Tools',
    adminGovernance: 'Institutional Governance',

    // Roles & User
    roleStudent: 'Student of Knowledge',
    roleTeacher: 'Certified Instructor',
    roleAdmin: 'General Supervisor / Dean',
    quickPersonaSwitch: 'Quick Persona Switch',
    loginBtn: 'Sign In',
    logoutBtn: 'Sign Out',
    registerBtn: 'Enroll as Student',
    studentNumberPrefix: 'Student S/N',

    // Header & Notifications
    courseSelectLabel: 'Course:',
    notificationsTitle: 'Notification Center',
    notificationsNew: 'New',
    viewScheduleAction: 'View Schedule Calendar',

    // Home View
    welcomeBack: 'Welcome back,',
    welcomeDesc: 'Welcome to the academic digital campus of Ma\'had Miftah al-\'Ilm. Continue pursuing beneficial knowledge with authentic, accredited curricula.',
    continueLessonAction: 'Continue Lecture:',
    viewSyllabusAction: 'Course Syllabus & Units',
    activeCourseProgress: 'Active Course Progress',
    lessonsCompletedOf: 'Completed lessons',
    todaysLecturesTitle: 'Today\'s Scheduled Lectures',
    certificatesHonorTitle: 'Certified Credentials & Diplomas',
    certificatesHonorDesc: 'Verified graduation certificates with QR authentication code',
    curriculumRoadmapTitle: 'Curriculum Unit Roadmap',
    curriculumRoadmapDesc: 'Structured into modular units with video lectures, audio podcasts, and exams',
    viewAllCurricula: 'Explore All Curricula',
    unitsCount: 'Units',
    lessonsCount: 'Lectures',
    unitExamLabel: 'Unit Assessment Exam',
    enterExamAction: 'Take Exam',

    // Schedule View
    scheduleTitle: 'My Study Schedule & Daily Planner',
    scheduleDesc: 'Organize daily lectures, track attendance streaks, and follow live broadcast timings',
    viewWeek: 'Week View',
    viewMonth: 'Month View',
    streakDays: 'Consecutive Study Days',
    studyHours: 'Listening & Study Hours',
    completedLessonsMetric: 'Completed Lectures',
    currentWeekLabel: 'Current Academic Week',
    todaysClassesTitle: 'Today\'s Lecture Timetable',
    todaysClassesDesc: '3 scheduled lectures for today on your personalized academic track',
    startLectureBtn: 'Start Lecture',
    reviewLectureBtn: 'Review Lecture',
    timeLabel: 'Time:',
    durationLabel: 'Duration:',

    // Programs View
    programsTitle: 'Programs & Accredited Curriculum',
    programsDesc: 'Full breakdown of subjects, course modules, unit hours, and grade weights',
    courseSwitchLabel: 'Select Course:',
    courseCompletionGauge: 'Course Progress',
    completedBadge: 'Completed',
    enterClassroomBtn: 'Enter Classroom',
    unitExamCardTitle: 'End-of-Unit Final Assessment',
    unitExamCardDesc: 'Evaluates lesson retention and awards credits towards your verified certificate',
    startExamBtn: 'Begin Assessment',

    // Lesson Classroom View
    lectureNo: 'Lecture No.',
    playlistBtn: 'Lecture Playlist',
    markCompletedBtn: 'Mark as Completed',
    alreadyCompletedBtn: 'Lecture Completed',
    videoModeTab: 'Video Lecture',
    audioPodcastTab: 'Audio Podcast',
    audioStudioTitle: 'Studio High-Fidelity Audio',
    audioStudioDesc: 'Listen on the go with variable playback speeds while taking notes below',
    playbackSpeedLabel: 'Playback Speed:',
    hiFiAudioBadge: 'Studio HD Audio',
    tabSummaryReading: 'Lesson Text & Sources',
    tabStudentNotes: 'Personal Study Notebook',
    tabDiscussionForum: 'Q&A & Discussion',
    summaryKicker: 'Core Pedagogical Objective:',
    referencesTitle: 'Recommended References & Classical Sources:',
    notesTitle: 'Personal Lecture Notebook',
    notesSubtitle: 'Your personal notes are automatically and instantaneously synchronized',
    autoSavedStatus: 'Auto-saved',
    savingStatus: 'Saving...',
    notesPlaceholder: 'Write down key principles, benefits, and reflections from this lecture...',
    discussionInstructorRole: 'Course Instructor',
    askQuestionPlaceholder: 'Type your academic inquiry or question here...',
    sendQuestionBtn: 'Post Question',
    playlistDrawerTitle: 'Complete Course Lecture Playlist',
    nowPlayingBadge: 'Now Playing',

    // Exams View
    examsHubTitle: 'Assessments & Academic Examination Portal',
    examsHubDesc: 'Periodic and comprehensive exams measuring subject mastery for certificate issuance',
    viewCertificatesBtn: 'View My Certificates',
    courseExamsTitle: 'Prescribed Course Assessments',
    noExamsPublished: 'No examinations are currently active for this course.',
    questionsCountSuffix: 'Questions',
    passedBadge: 'Passed with',
    failedBadge: 'Did Not Pass',
    pendingMarkingBadge: 'Pending Grading & Review',
    availableToTakeBadge: 'Available to Take',
    examDurationLabel: 'Exam Duration:',
    passMarkLabel: 'Passing Threshold:',
    reviewAnswersBtn: 'Review Answers & Scores',
    startExamNowBtn: 'Take Exam Now',
    timeRemainingLabel: 'Time Remaining:',
    submitAnswersBtn: 'Submit All Answers',
    integrityWarning: 'Integrity Warning: You have switched away from the exam tab. Please stay focused on the assessment.',
    pointsLabel: 'Points',
    multipleChoiceLabel: 'Multiple Choice Question',
    trueFalseLabel: 'True or False',
    fillBlankLabel: 'Fill in the Blank',
    essayQuestionLabel: 'Written Essay Question',
    gradingCriteriaLabel: 'Grading Rubric:',
    essayPlaceholder: 'Provide your detailed essay answer supported by evidence and citations...',
    fillPlaceholder: 'Type the exact missing word or phrase here...',
    confirmSubmissionNotice: 'Please review all your answers before final submission.',
    confirmSubmitExamBtn: 'Confirm Final Submission',
    reviewModalTitle: 'Student Examination Review Sheet',
    studentResultStatus: 'Result Status:',
    markedAndCertified: 'Graded & Approved',
    waitingTeacherGrade: 'Awaiting Instructor Essay Evaluation',
    totalEarnedScore: 'Total Earned Score',
    studentAnswerLabel: 'Submitted Student Answer:',
    teacherFeedbackLabel: 'Instructor Feedback & Notes:',
    integrityActivityLog: 'Academic Integrity & Activity Log:',
    closeReviewBtn: 'Close Review',

    // Certificates View
    certificatesHubTitle: 'Official Certificates & Academic Records',
    certificatesHubDesc: 'Official diplomas granted with instant cryptographic QR verification code',
    searchCertificatePlaceholder: 'Search by certificate number or student name...',
    generalGradeLabel: 'Overall Grade Band:',
    previewCertificateBtn: 'View Certificate Document',
    officialCertTitle: 'Official Certified Document',
    printOrSavePdfBtn: 'Print / Save as PDF',
    certificatePassHeading: 'Certificate of Successful Course Completion',
    studentNamePrefix: 'Awarded to Student:',
    certNumberLabel: 'Certificate No:',
    issueDateLabel: 'Date of Issue:',
    verifiedOfficialBadge: 'Verified & Registered in Institutional Ledger',

    // Teacher Workspace View
    teacherWorkspaceTitle: 'Faculty & Instructor Workspace',
    teacherWelcomeGreeting: 'Welcome, Instructor',
    teacherWorkspaceSubtitle: 'Manage courses, review student roster, and evaluate pending essay submissions',
    pendingMarkingCountText: 'Submissions awaiting grading',
    assignedCoursesTitle: 'Assigned Teaching Courses',
    openClassroomLectureBtn: 'Open in Classroom',
    markingQueueTitle: 'Evaluation & Grading Queue',
    markingQueueDesc: 'Inspect student essay responses, award points, and provide constructive pedagogical guidance',
    noPendingGrading: 'No submissions are pending grading. All student attempts are evaluated!',
    needsEssayMarkingBadge: 'Essay Evaluation Required',
    startGradingBtn: 'Grade Submission & Award Marks',
    gradingModalTitle: 'Student Assessment Evaluation Dialog',
    cancelBtn: 'Cancel',
    awardedScoreLabel: 'Awarded Score:',
    teacherFeedbackInputLabel: 'Instructor Pedagogical Feedback:',
    teacherFeedbackPlaceholder: 'Provide encouraging remarks or correction for the student...',
    signAndIssueBtn: 'Sign & Issue Official Grade to Student',
    teacherSignatureStampPrefix: 'This grade will be officially certified and attributed to:',

    // Admin Console View
    adminConsoleTitle: 'Institutional Governance & Dean\'s Console',
    adminConsoleHeading: 'Ma\'had Miftah al-\'Ilm Governance',
    adminConsoleSubtitle: 'Customize branding logo, dean signature, courses, and faculty accounts',
    tabInstitutionIdentity: 'Branding & Identity',
    tabCoursesManagement: 'Course Catalog',
    tabFacultyStaff: 'Faculty & Teachers',
    institutionSettingsTitle: 'Institution Profile & Certificate Defaults',
    institutionSettingsDesc: 'Upload official logo image, dean signature image, and certificate wording',
    saveChangesBtn: 'Save Settings',
    logoUploadLabel: 'Official Institutional Logo (Image Upload)',
    logoUploadDesc: 'Upload an image file for the official crest on headers and certificates',
    signatureUploadLabel: 'Dean / Signatory Signature (Image Upload)',
    signatureUploadDesc: 'Upload an image file of the dean signature for automated certificate sign-off',
    instNameArLabel: 'Institution Name (Arabic)',
    instNameEnLabel: 'Institution Name (English)',
    signatoryNameLabel: 'Signatory Full Name',
    signatoryTitleLabel: 'Signatory Official Title',
    certPrefixLabel: 'Certificate Serial Prefix',
    defaultWordingLabel: 'Default Certificate Body Text',
    coursesListTitle: 'Institution Courses Catalog',
    coursesListDesc: 'Create new courses, allocate grade weights, and assign lead instructors',
    addNewCourseBtn: 'Add New Course',
    activeCourseBadge: 'Active Course',
    createCourseModalTitle: 'Create New Academic Course',
    courseCodeLabel: 'Course Code *',
    coursePassMarkLabel: 'Passing Threshold (%)',
    courseNameArLabel: 'Course Title (Arabic) *',
    courseNameEnLabel: 'Course Title (English)',
    courseInstructorLabel: 'Lead Instructor Name',
    courseDescLabel: 'Course Description & Scope',
    courseBannerUploadLabel: 'Course Banner Image (Upload)',
    publishCourseBtn: 'Publish & Add to Catalog',
    facultyListTitle: 'Faculty & Teaching Staff',
    facultyListDesc: 'Provision unique instructor credentials with email and password accounts',
    addNewTeacherBtn: 'Add New Instructor',
    createTeacherModalTitle: 'Provision Instructor Account',
    teacherNameArLabel: 'Instructor Name (Arabic) *',
    teacherNameEnLabel: 'Instructor Name (English)',
    teacherLoginEmailLabel: 'Login Email Address *',
    teacherPasswordLabel: 'Account Password *',
    teacherTitleLabel: 'Academic Rank / Title',
    assignCourseSelectLabel: 'Assigned Course',
    allCoursesOption: 'All Institutional Courses',
    saveTeacherAccountBtn: 'Create & Provision Account',

    // Auth Modal
    unifiedAccessPortal: 'Ma\'had Miftah al-\'Ilm Unified Portal',
    existingAccountTab: 'Sign In (Existing Account)',
    newStudentRegTab: 'New Student Registration',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    enterPlatformBtn: 'Sign In to Campus',
    quickDemoAccountsHeading: 'Instant One-Click Demo Personas',
    adminDemoDesc: 'Dean / Admin (Full governance, logo & signature settings)',
    teacherDemoDesc: 'Lead Instructor (Grade essays & inspect submissions)',
    studentDemoDesc: 'Enrolled Student (Classroom, audio podcast & certificates)',
    fullNameArLabel: 'Full Name in Arabic (As Appears on Certificate) *',
    fullNameEnLabel: 'Full Name in English',
    nationalityLabel: 'Nationality',
    countryResidenceLabel: 'Country of Residence',
    educationLevelLabel: 'Educational Background',
    createAccountAndStudyBtn: 'Create Account & Begin Studies',
    quickLoginLink: 'Sign In',
    loginWithOtherAccount: 'Sign in with Another Account',
    closeBtn: 'Close',

    // Voice Memorization
    audioRecitationSectionTitle: 'Audio Memorization Recitation',
    audioRecitationSubtitle: 'Record your audio recitation note clearly for your instructor to review.',
    audioSubmissionPending: 'Pending Teacher Review',
    audioSubmissionApproved: 'Approved by Teacher!',
    audioSubmissionRejected: 'Teacher Requested Repeat',
    audioRepeatInstruction: 'Please re-record your recitation carefully following the instructor feedback below.',
    audioTeacherScore: 'Awarded Score',
    audioTeacherFeedback: 'Instructor Guidance & Feedback',
    reRecordAudioBtn: 'Record New Recitation',
    audioNotRequiredForCourse: 'Audio recitation is not required for this course.',
    audioRecitationVoiceHint: 'Direct audio voice recording',

    // Lesson Quiz (Per-Lesson Test)
    lessonQuizSectionTitle: 'Lesson Quiz & Practice Test',
    lessonQuizNotice: 'Practice quiz: Optional, does not block progression, minimally contributes to final grade.',
    lessonQuizTakeBtn: 'Take Lesson Quiz',
    lessonQuizSubmittedScore: 'Lesson Quiz Score',
    lessonQuizCompletedBadge: 'Quiz Completed',
    submitQuizBtn: 'Submit Quiz Answers',
    lessonQuizQuestion: 'Quiz Question',

    // Teacher Workspace Audio & Gradebook Tabs
    tabExamMarking: 'Final Exams & Essays',
    tabAudioGrading: 'Audio Memorization Review',
    tabGradebook: 'Gradebook & Leaderboard',
    approveWithScoreBtn: 'Approve & Score',
    rejectAndRepeatBtn: 'Reject & Request Repeat',
    audioSubmissionsCount: 'Audio Recitations',
    noAudioSubmissions: 'No audio recitation submissions found.',
    allStatusFilter: 'All Submissions',
    pendingStatusFilter: 'Pending Review',
    approvedStatusFilter: 'Approved',
    rejectedStatusFilter: 'Needs Repeat',
    gradeAudioModalTitle: 'Grade Student Audio Recitation',
    gradebookSearchPlaceholder: 'Search student by name or S/N...',
    colSn: 'S/N',
    colStudent: 'Student',
    colLessons: 'Completed Lessons',
    colQuizzes: 'Quiz Scores',
    colAudio: 'Audio Recitation',
    colExam: 'Final Exam',
    colTotalScore: 'Total Score',
    colRank: 'Rank',
    colStatus: 'Result',
    colCert: 'Certificate',
    passedStatus: 'Passed',
    failedStatus: 'Needs Review',
    exportGradebookCsv: 'Export Gradebook (CSV)',
    printGradebook: 'Print Gradebook',
    topRankStudentsTitle: 'Honor Roll: Top Performing Students',
    courseToggleAudioMemoLabel: 'Audio Memorization Option (Voice Recitations)',
    courseToggleAudioMemoDesc: 'Enable or disable student audio memorization voice submissions for this course.'
  },

  ar: {
    // Brand & Slogan (Rhyme in Arabic)
    appName: 'معهد مفتاح العلم',
    appSubtitle: 'الصرح الأكاديمي الرائد لتعليم العلوم الشرعية وتأصيل المعرفة',
    sloganRhyme: 'طلب العلم مفتاح الفلاح ونور الألباب — إلى قمم المعرفة نفتح كل باب',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',

    // Navigation
    navHome: 'الرئيسية',
    navSchedule: 'لوحتي التعليمية',
    navPrograms: 'برامجي والمناهج',
    navClassroom: 'قاعة المحاضرات',
    navExams: 'الاختبارات والتقييم',
    navCertificates: 'سجل الشهادات',
    navTeacher: 'بوابة المعلم',
    navAdmin: 'إدارة المعهد',
    navMore: 'المزيد',
    learningPortals: 'بوابات التعلم',
    staffTools: 'أدوات هيئة التدريس',
    adminGovernance: 'الإدارة والعمادة',

    // Roles & User
    roleStudent: 'طالب علم',
    roleTeacher: 'معلم معتمد',
    roleAdmin: 'المشرف العام والعميد',
    quickPersonaSwitch: 'تبديل الصلاحية السريع',
    loginBtn: 'تسجيل الدخول',
    logoutBtn: 'تسجيل الخروج',
    registerBtn: 'تسجيل طالب جديد',
    studentNumberPrefix: 'رقم الطالب',

    // Header & Notifications
    courseSelectLabel: 'المقرر:',
    notificationsTitle: 'مركز الإشعارات',
    notificationsNew: 'جديدة',
    viewScheduleAction: 'عرض جدول المواعيد',

    // Home View
    welcomeBack: 'مرحباً بك،',
    welcomeDesc: 'أهلاً بك في المنصة الأكاديمية لمعهد مفتاح العلم. استمر في طلب العلم النافع ومتابعة مقرراتك الشرعية المعتمدة.',
    continueLessonAction: 'متابعة الدرس:',
    viewSyllabusAction: 'خطة المقرر والوحدات',
    activeCourseProgress: 'إنجاز المقرر الحالي',
    lessonsCompletedOf: 'أنجزت محاضرات',
    todaysLecturesTitle: 'جدول المحاضرات اليوم',
    certificatesHonorTitle: 'سجل الإجازات والشهادات',
    certificatesHonorDesc: 'شهادة معتمدة مع رمز الاستجابة السريع للتحقق الفوري',
    curriculumRoadmapTitle: 'خطة الوحدات الدراسية',
    curriculumRoadmapDesc: 'مقسمة إلى وحدات منهجية متكاملة تشمل الدروس المرئية والصوتية والمذكرات والاختبارات',
    viewAllCurricula: 'عرض كافة المناهج',
    unitsCount: 'وحدات',
    lessonsCount: 'محاضرات',
    unitExamLabel: 'اختبار الوحدة التقييمي',
    enterExamAction: 'دخول الاختبار',

    // Schedule View
    scheduleTitle: 'لوحتي التعليمية وجدول المحاضرات',
    scheduleDesc: 'تنظيم الدروس اليومية، متابعة الحضور والالتزام، ومواعيد البث الصوتي والمرئي',
    viewWeek: 'عرض الأسبوع',
    viewMonth: 'عرض الشهر',
    streakDays: 'أيام الالتزام المتواصل',
    studyHours: 'ساعات الاستماع والمدارسة',
    completedLessonsMetric: 'المحاضرات المكتملة',
    currentWeekLabel: 'الأسبوع الدراسي الحالي',
    todaysClassesTitle: 'جدول المحاضرات اليوم',
    todaysClassesDesc: '٣ محاضرات مقررة ضمن خطتك الدراسية لهذا اليوم',
    startLectureBtn: 'بدء المحاضرة',
    reviewLectureBtn: 'مراجعة الدرس',
    timeLabel: 'الوقت:',
    durationLabel: 'المدة:',

    // Programs View
    programsTitle: 'الخطة الأكاديمية والمناهج المعتمدة',
    programsDesc: 'تفصيل الوحدات الدراسية، المحاضرات، وساعات التقدير ونسب التقييم',
    courseSwitchLabel: 'تبديل المقرر:',
    courseCompletionGauge: 'إنجاز المقرر',
    completedBadge: 'مكتمل',
    enterClassroomBtn: 'دخول المحاضرة',
    unitExamCardTitle: 'اختبار نهاية الوحدة المقررة',
    unitExamCardDesc: 'يقيس استيعاب الدروس ومفاهيم الوحدة ويمنحك نقاط الاعتماد الأكاديمي',
    startExamBtn: 'بدء الاختبار',

    // Lesson Classroom View
    lectureNo: 'المحاضرة رقم',
    playlistBtn: 'قائمة المحاضرات',
    markCompletedBtn: 'تحديد كمكتمل',
    alreadyCompletedBtn: 'تم إتمام الدرس بنجاح',
    videoModeTab: 'فيديو مرئي',
    audioPodcastTab: 'بودكاست صوتي',
    audioStudioTitle: 'البث الصوتي عالي النقاء',
    audioStudioDesc: 'استمع إلى الدرس مع إمكانية تسريع الصوت وتدوين الفوائد أثناء الاستماع',
    playbackSpeedLabel: 'سرعة التشغيل:',
    hiFiAudioBadge: 'صوت استوديو مجسم',
    tabSummaryReading: 'نص المحاضرة والمراجع',
    tabStudentNotes: 'دفتر الفوائد والملاحظات',
    tabDiscussionForum: 'الأسئلة والمناقشة',
    summaryKicker: 'خلاصة المحاضرة والهدف التربوي:',
    referencesTitle: 'المصادر والمراجع المقترحة للتوسع:',
    notesTitle: 'مفكرتي الخاصة لهذا الدرس',
    notesSubtitle: 'تُحفظ ملاحظاتك بشكل تلقائي وفوري في حسابك',
    autoSavedStatus: 'محفوظ تلقائياً',
    savingStatus: 'جاري الحفظ...',
    notesPlaceholder: 'اكتب هنا الفوائد والشوارد والمسائل المستفادة من المحاضرة...',
    discussionInstructorRole: 'مدرس المقرر',
    askQuestionPlaceholder: 'اكتب استفسارك أو سؤالك الشرعي هنا...',
    sendQuestionBtn: 'إرسال السؤال',
    playlistDrawerTitle: 'قائمة محاضرات المقرر',
    nowPlayingBadge: 'يعمل الآن',

    // Exams View
    examsHubTitle: 'بوابة الاختبارات والتقييم الأكاديمي',
    examsHubDesc: 'اختبارات مرحلية وشاملة لقياس التحصيل العلمي وإصدار شهادات الإتقان',
    viewCertificatesBtn: 'سجل الشهادات المعتمدة',
    courseExamsTitle: 'الاختبارات المقررة لهذا المقرر',
    noExamsPublished: 'لا توجد اختبارات منشورة لهذا المقرر حالياً.',
    questionsCountSuffix: 'أسئلة',
    passedBadge: 'ناجح بمعدل',
    failedBadge: 'راسب بمعدل',
    pendingMarkingBadge: 'قيد التصحيح والاعتماد',
    availableToTakeBadge: 'متاح للتقديم الآن',
    examDurationLabel: 'المدة:',
    passMarkLabel: 'النجاح:',
    reviewAnswersBtn: 'مراجعة الإجابات والدرجات',
    startExamNowBtn: 'دخول الاختبار الآن',
    timeRemainingLabel: 'الوقت المتبقي:',
    submitAnswersBtn: 'تسليم الإجابات',
    integrityWarning: 'تنبيه النزاهة الأكاديمية: تم رصد مغادرة نافذة الاختبار. يرجى التركيز في صفحة الأسئلة.',
    pointsLabel: 'درجات',
    multipleChoiceLabel: 'اختيار من متعدد',
    trueFalseLabel: 'صواب أو خطأ',
    fillBlankLabel: 'إكمال الفراغ',
    essayQuestionLabel: 'سؤال مقالي تحريري',
    gradingCriteriaLabel: 'معايير التقييم:',
    essayPlaceholder: 'اكتب إجابتك المقالية المسهبة هنا مع الشواهد والأدلة...',
    fillPlaceholder: 'اكتب الكلمة أو العبارة الصحيحة هنا...',
    confirmSubmissionNotice: 'تأكد من مراجعة كافة الإجابات قبل التسليم النهائي.',
    confirmSubmitExamBtn: 'تأكيد تسليم الاختبار',
    reviewModalTitle: 'كشف مراجعة نتيجة الطالب',
    studentResultStatus: 'حالة النتيجة:',
    markedAndCertified: 'معتمد ومصحح',
    waitingTeacherGrade: 'بانتظار اعتماد تصحيح المقالي',
    totalEarnedScore: 'الدرجة الإجمالية المحصلة',
    studentAnswerLabel: 'إجابة الطالب:',
    teacherFeedbackLabel: 'ملاحظة وتوجيه المدرس:',
    integrityActivityLog: 'سجل النزاهة وحركة المتصفح:',
    closeReviewBtn: 'إغلاق المراجعة',

    // Certificates View
    certificatesHubTitle: 'سجل الإجازات والشهادات الأكاديمية المعتمدة',
    certificatesHubDesc: 'الشهادات الممنوحة لطلاب المعهد مع رمز الاستجابة السريع للتحقق الفوري من الصلاحية',
    searchCertificatePlaceholder: 'بحث برقم الشهادة أو اسم الطالب...',
    generalGradeLabel: 'التقدير العام:',
    previewCertificateBtn: 'معاينة الشهادة',
    officialCertTitle: 'معاينة الشهادة الرسمية المعتمدة',
    printOrSavePdfBtn: 'طباعة أو حفظ PDF',
    certificatePassHeading: 'شهادة إتمام واجتياز مقرر شرعي',
    studentNamePrefix: 'اسم الطالب:',
    certNumberLabel: 'رقم الوثيقة:',
    issueDateLabel: 'تاريخ الإصدار:',
    verifiedOfficialBadge: 'معتمدة ومسجلة في النظام الأكاديمي',

    // Teacher Workspace View
    teacherWorkspaceTitle: 'بوابة هيئة التدريس والمشرفين',
    teacherWelcomeGreeting: 'أهلاً بك، فضيلة المعلم',
    teacherWorkspaceSubtitle: 'إدارة المقررات، متابعة الطلاب، وتصحيح الاختبارات المقالية',
    pendingMarkingCountText: 'اختبارات بانتظار التصحيح',
    assignedCoursesTitle: 'المقررات المسندة إليك',
    openClassroomLectureBtn: 'فتح في قاعة الشرح',
    markingQueueTitle: 'قائمة التصحيح والتقييم الأكاديمي',
    markingQueueDesc: 'تصحيح إجابات الطلاب المقالية وتثبيت الدرجات والتغذية الراجعة',
    noPendingGrading: 'لا توجد إجابات بانتظار التصحيح حالياً. جميع إجابات الطلاب مقيمة ومعتمدة!',
    needsEssayMarkingBadge: 'بحاجة لتصحيح المقالي',
    startGradingBtn: 'مباشرة التصحيح ورصد الدرجة',
    gradingModalTitle: 'نافذة تقييم ورصد درجات الطالب',
    cancelBtn: 'إلغاء',
    awardedScoreLabel: 'الدرجة المستحقة:',
    teacherFeedbackInputLabel: 'التغذية الراجعة وتوجيه المعلم:',
    teacherFeedbackPlaceholder: 'اكتب ملاحظة تشجيعية أو تصحيحية...',
    signAndIssueBtn: 'اعتماد وإصدار النتيجة للطالب',
    teacherSignatureStampPrefix: 'سيتم توقيع واعتماد النتيجة باسم:',

    // Admin Console View
    adminConsoleTitle: 'لوحة التحكم الإدارية والعمادة',
    adminConsoleHeading: 'إدارة معهد مفتاح العلم',
    adminConsoleSubtitle: 'تخصيص الهوية، الشعار، التوقيع، المقررات، وحسابات المدرسين',
    tabInstitutionIdentity: 'بيانات وهوية المعهد',
    tabCoursesManagement: 'المقررات والمناهج',
    tabFacultyStaff: 'هيئة التدريس',
    institutionSettingsTitle: 'إعدادات الهوية المؤسسية والشهادات',
    institutionSettingsDesc: 'تحميل شعار المعهد، صورة توقيع المشرف، وصيغ الشهادات المعتمدة',
    saveChangesBtn: 'حفظ التعديلات',
    logoUploadLabel: 'شعار المعهد الرسمي (رفع ملف صورة)',
    logoUploadDesc: 'قم برفع ملف صورة الشعار لعرضها في ترويسة الموقع ووثائق الشهادات',
    signatureUploadLabel: 'صورة توقيع المشرف المعتمد (رفع ملف صورة)',
    signatureUploadDesc: 'قم برفع ملف صورة التوقيع أو الخاتم لاعتماده تلقائياً في الشهادات',
    instNameArLabel: 'اسم المعهد باللغة العربية',
    instNameEnLabel: 'اسم المعهد باللغة الإنجليزية',
    signatoryNameLabel: 'اسم المشرف العام / الموقّع',
    signatoryTitleLabel: 'صفة المشرف والموقّع الرسمية',
    certPrefixLabel: 'بادئة ترقيم الشهادات (Prefix)',
    defaultWordingLabel: 'الصيغة الديباجية الافتراضية للشهادة',
    coursesListTitle: 'إدارة المقررات والمناهج الدراسية',
    coursesListDesc: 'إنشاء المقررات الجديدة، تخصيص نسب الدرجات، وتحديد مدرس كل مادة',
    addNewCourseBtn: 'إضافة مقرر دراسي جديد',
    activeCourseBadge: 'مقرر نشط',
    createCourseModalTitle: 'إضافة مقرر دراسي جديد',
    courseCodeLabel: 'رمز المقرر (Code) *',
    coursePassMarkLabel: 'درجة النجاح (%)',
    courseNameArLabel: 'اسم المقرر باللغة العربية *',
    courseNameEnLabel: 'اسم المقرر بالإنجليزية',
    courseInstructorLabel: 'اسم المدرس المكلف',
    courseDescLabel: 'وصف المقرر والمنهج',
    courseBannerUploadLabel: 'صورة غلاف المقرر (رفع صورة)',
    publishCourseBtn: 'حفظ ونشر المقرر في المنصة',
    facultyListTitle: 'إدارة حسابات هيئة التدريس',
    facultyListDesc: 'إنشاء حسابات فريدة للمدرسين ببريد وكلمة مرور وإسناد المقررات لهم',
    addNewTeacherBtn: 'إضافة مدرس جديد',
    createTeacherModalTitle: 'إضافة حساب مدرس معتمد جديد',
    teacherNameArLabel: 'الاسم بالعربية *',
    teacherNameEnLabel: 'الاسم بالإنجليزية',
    teacherLoginEmailLabel: 'البريد الإلكتروني للدخول *',
    teacherPasswordLabel: 'كلمة المرور *',
    teacherTitleLabel: 'اللقب والصفة الأكاديمية',
    assignCourseSelectLabel: 'إسناد المقرر',
    allCoursesOption: 'كافة مقررات المعهد',
    saveTeacherAccountBtn: 'حفظ وإنشاء حساب المدرس',

    // Auth Modal
    unifiedAccessPortal: 'بوابة الوصول الموحدة للمعهد',
    existingAccountTab: 'تسجيل الدخول (حساب موجود)',
    newStudentRegTab: 'تسجيل طالب جديد',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    enterPlatformBtn: 'دخول إلى المنصة',
    quickDemoAccountsHeading: 'الدخول السريع بحسابات تجريبية مسبقة',
    adminDemoDesc: 'المشرف العام (صلاحيات الإدارة والشعار كاملة)',
    teacherDemoDesc: 'أستاذ الحديث والسيرة (بوابة المعلم وتصحيح المقالي)',
    studentDemoDesc: 'طالب مسجل (لوحة الطالب والشهادات والمحاضرات)',
    fullNameArLabel: 'الاسم باللغة العربية (كما يظهر بالشهادة) *',
    fullNameEnLabel: 'الاسم بالإنجليزية (اختياري)',
    nationalityLabel: 'الجنسية',
    countryResidenceLabel: 'بلد الإقامة',
    educationLevelLabel: 'المؤهل العلمي',
    createAccountAndStudyBtn: 'إنشاء الحساب وبدء الدراسة',
    quickLoginLink: 'دخول',
    loginWithOtherAccount: 'دخول بحساب آخر',
    closeBtn: 'إغلاق',

    // Voice Memorization
    audioRecitationSectionTitle: 'التسميع الصوتي لمقرر الحفظ',
    audioRecitationSubtitle: 'سجل تلاوتك وتسميعك الصوتي المباشر لمراجعة المعلم واعتماده.',
    audioSubmissionPending: 'قيد مراجعة واعتماد المعلم',
    audioSubmissionApproved: 'تم اعتماد التسميع بنجاح!',
    audioSubmissionRejected: 'طلب المعلم إعادة التسميع',
    audioRepeatInstruction: 'يرجى إعادة تسجيل التسميع الصوتي مجدداً وفق ملاحظات المعلم الموضحة أدناه.',
    audioTeacherScore: 'الدرجة المرصودة',
    audioTeacherFeedback: 'ملاحظات وتوجيهات المعلم',
    reRecordAudioBtn: 'إعادة تسجيل التسميع',
    audioNotRequiredForCourse: 'هذا المقرر لا يتطلب تسميعاً صوتياً للحفظ.',
    audioRecitationVoiceHint: 'تسجيل صوتي مباشر عالي الجودة',

    // Lesson Quiz (Per-Lesson Test)
    lessonQuizSectionTitle: 'اختبار تقييم الدرس السريع',
    lessonQuizNotice: 'اختبار تقييم قصير: اختياري لا يمنع المتابعة ويسهم في المجموع الكلي النهائي.',
    lessonQuizTakeBtn: 'بدء اختبار الدرس',
    lessonQuizSubmittedScore: 'درجة اختبار الدرس',
    lessonQuizCompletedBadge: 'تم إكمال اختبار الدرس',
    submitQuizBtn: 'إرسال إجابات الاختبار',
    lessonQuizQuestion: 'سؤال الاختبار',

    // Teacher Workspace Audio & Gradebook Tabs
    tabExamMarking: 'تصحيح مقالات الاختبارات',
    tabAudioGrading: 'تقييم التسميع الصوتي',
    tabGradebook: 'سجل الدرجات ولوحة المتصدرين',
    approveWithScoreBtn: 'اعتماد التسميع ورصد الدرجة',
    rejectAndRepeatBtn: 'طلب إعادة التسميع من الطالب',
    audioSubmissionsCount: 'تسجيلات التسميع الصوتي',
    noAudioSubmissions: 'لا توجد تسجيلات تسميع صوتي في الانتظار حالياً.',
    allStatusFilter: 'كافة التسجيلات',
    pendingStatusFilter: 'في انتظار التقييم',
    approvedStatusFilter: 'المعتمدة',
    rejectedStatusFilter: 'المطلوب إعادتها',
    gradeAudioModalTitle: 'تقييم تسميع الطالب الصوتي',
    gradebookSearchPlaceholder: 'بحث عن طالب بالاسم أو الرقم الأكاديمي...',
    colSn: 'م',
    colStudent: 'الطالب',
    colLessons: 'الدروس المكتملة',
    colQuizzes: 'درجات الاختبارات القصيرة',
    colAudio: 'درجة التسميع',
    colExam: 'الاختبار النهائي',
    colTotalScore: 'المجموع الكلي',
    colRank: 'الترتيب',
    colStatus: 'الحالة',
    colCert: 'الشهادة',
    passedStatus: 'ناجح ومجتاز',
    failedStatus: 'يحتاج مراجعة',
    exportGradebookCsv: 'تصدير كشف الدرجات (CSV)',
    printGradebook: 'طباعة كشف الدرجات',
    topRankStudentsTitle: 'لوحة الشرف: الطلاب الأوائل والمتصدرون',
    courseToggleAudioMemoLabel: 'تفعيل التسميع الصوتي للحفظ',
    courseToggleAudioMemoDesc: 'تمكين أو تعطيل خاصية إرسال التسميع الصوتي للطلاب في هذا المقرر.'
  }
};
