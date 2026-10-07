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
  signatory_name_ar: 'الشيخ موسى أمينو محمد (Musa Aminu Muhammad)',
  signatory_title_ar: 'Babban Darakta kuma المشرف العام',
  certificate_prefix: 'MIFTAH-',
  default_wording_ar: 'Wannan takarda tana tabbatar da cewa dalibin da sunansa ke sama ya kammala dukkan darussa da jarabawowin wannan fanni cikin nasara da kwazo.',
  logo_data_url: DEFAULT_LOGO_DATA_URL,
  signature_data_url: DEFAULT_SIGNATURE_DATA_URL,
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user_admin',
    email: 'admin@almiftahu.edu',
    role: 'admin',
    name: 'Musa Aminu Muhammad',
    name_ar: 'الشيخ موسى أمينو محمد',
    title: 'General Supervisor & Dean',
    title_ar: 'Babban Darakta & المشرف العام',
    assigned_courses: ['ALL'],
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'user_teacher_1',
    email: 'teacher@almiftahu.edu',
    role: 'teacher',
    name: 'Dr. Ibrahim Al-Madani',
    name_ar: 'د. إبراهيم المدني',
    title: 'Head of Hadith & Prophetic Seerah',
    title_ar: 'Malamin Hadisi da Tarihin Manzo ﷺ',
    assigned_courses: ['HADITH_101', 'AQEEDAH_101'],
    created_at: '2026-01-15T09:30:00Z',
  },
  {
    id: 'user_teacher_2',
    email: 'sheikh@almiftahu.edu',
    role: 'teacher',
    name: 'Sheikh Abdullah Al-Qasim',
    name_ar: 'الشيخ عبد الله القاسم',
    title: 'Lecturer in Fiqh & Adab',
    title_ar: 'Malamin Fikihu da Ladubban Musulunci',
    assigned_courses: ['FIQH_101', 'ADAB_101'],
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'user_student_1',
    email: 'student@almiftahu.edu',
    role: 'student',
    name: 'Ahmad Bello Abubakar',
    name_ar: 'أحمد بللو أبو بكر',
    gender: 'male',
    nationality: 'Dan Najeriya (Nigerian)',
    country: 'Najeriya (Nigeria)',
    education_level: 'Digiri a Ilimin Addini (Bachelor)',
    sn: 101,
    created_at: '2026-02-01T11:00:00Z',
  },
  {
    id: 'user_student_2',
    email: 'maryam@almiftahu.edu',
    role: 'student',
    name: 'Maryam Al-Kano',
    name_ar: 'مريم الكانوية',
    gender: 'female',
    nationality: 'Yar Najeriya (Nigerian)',
    country: 'Kano, Najeriya',
    education_level: 'Diploma a Ilimin Musulunci',
    sn: 102,
    created_at: '2026-02-05T14:15:00Z',
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course_aqeedah',
    code: 'AQEEDAH_101',
    name: 'Islamic Creed and Tawheed',
    name_ar: 'Tauhid da Akidar Musulunci (العقيدة والتوحيد)',
    status: 'active',
    banner_image: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80',
    instructor_name_ar: 'Dr. Ibrahim Al-Madani (د. إبراهيم المدني)',
    instructor_title_ar: 'Babban Malami a Sashen Hadisi da Akida',
    pass_mark: 70,
    weight_lessons: 40,
    weight_exam: 60,
    unit_label_ar: 'Kason Darasi (Washi)',
    description_ar: 'Karatun Akidar Ahlus Sunnah wal Jama\'ah da rabe-raben Tauhidi guda uku da sharuddan kalmar La ilaha illallah.',
    units: [
      {
        id: 'unit_aqeedah_1',
        course_id: 'course_aqeedah',
        order_index: 1,
        title: 'Unit 1: Foundations of Tawheed',
        title_ar: 'Kashi Na 1: Asalin Tauhidi da Rabe-rabensa (أصول التوحيد)',
        description_ar: 'Fahimtar Tauhidin Rububiyya, Uluhiyya, da Asma\'u was Sifat da bambancinsu a addini.',
        exam_id: 'exam_aqeedah_u1',
        lessons: [
          {
            id: 'les_aq_1',
            unit_id: 'unit_aqeedah_1',
            course_id: 'course_aqeedah',
            order_index: 1,
            title: 'Definition of Tawheed & Categories',
            title_ar: 'Darasi Na 1: Ma\'anar Tauhidi a Harshe da Shari\'a da Rabe-rabensa',
            summary_ar: 'Bayanin hakikanin Tauhidi cewa shi ne kadaita Allah da abin da ya kebe da shi na Ubangiji, Bauta, da Sunaye da Siffofi.',
            media: {
              video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              duration_minutes: 24,
              duration_formatted: '24:15'
            },
            reading_content_ar: `BismiLlahi Ar-Rahmani Ar-Rahim.
Ilimin Tauhidi shi ne mafi daraja a dukkan ilimomin shari'a saboda yana da alaka da Ubangijin talikai Madaukaki.
Tauhidi ya kasu kashi uku:
1. Tauhidur Rububiyya: Kadaita Allah da ayyukansa kamar halitta, arzurtawa, da rayawa da kashewa.
2. Tauhidul Uluhiyya: Kadaita Allah da ayyukan bayi kamar addu'a, yanka, bakance, tsoro, da dogaro.
3. Tauhidul Asma'i was Sifat: Tabbatar da sunaye da siffofin da Allah ya tabbatar wa kansa a Alkur'ani ko ta bakin Manzonsa ﷺ ba tare da canzawa ko kwatanta su da na halitta ba.

Imam Ibn al-Qayyim (Rahimahullah) ya ce: "Tauhidi shi ne farkon addini da karshensa, kuma shi ne ginshikin kiran dukkan Annabawa."`,
            references: ['Littafin Kitab at-Tawheed na Sheikh Muhammad bin Abdulwahhab', 'Taysir al-Aziz al-Hamid', 'Sharhun Aqeedatil Wasitiyyah']
          },
          {
            id: 'les_aq_2',
            unit_id: 'unit_aqeedah_1',
            course_id: 'course_aqeedah',
            order_index: 2,
            title: 'Conditions of La Ilaha Illa Allah',
            title_ar: 'Darasi Na 2: Sharuddan Kalmar La Ilaha Illa Allah da Abubuwan Da Ke Rushe Musulunci',
            summary_ar: 'Bayanin sharuddan kalmar Tauhidi guda bakwai: Ilimi, Yakini, Karba, Mika wuya, Gaskiya, Ikhlasi, da So.',
            media: {
              video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
              duration_minutes: 32,
              duration_formatted: '32:40'
            },
            reading_content_ar: `Sharuddan kalmar La ilaha illallah ba ta cika har sai an hada wadannan sharudda guda 7:
1. Ilimi: Wanda ke korar jahilci (Ka sani cewa babu abin bautawa da gaskiya sai Allah).
2. Yakini: Wanda ke korar kokwanto da shakka.
3. Karba: Wanda ke korar kin karba.
4. Mika wuya: Wanda ke korar kaucewa.
5. Gaskiya: Wanda ke korar munafunci.
6. Ikhlasi: Wanda ke korar shirka da riya.
7. So: Ka so wannan kalma da dukkan abin da ta kunsa.`,
            references: ['Ma\'arijul Qubul na Sheikh Hafiz al-Hakami']
          }
        ]
      },
      {
        id: 'unit_aqeedah_2',
        course_id: 'course_aqeedah',
        order_index: 2,
        title: 'Unit 2: Pillars of Faith',
        title_ar: 'Kashi Na 2: Shika-shikan Imani Guda Shida (أركان الإيمان)',
        description_ar: 'Imani da Allah, Mala\'ikunsa, Littattafansa, Manzanninsa, Ranar Lahira, da Kaddara me kyau ko marar kyau.',
        exam_id: 'exam_aqeedah_u2',
        lessons: [
          {
            id: 'les_aq_3',
            unit_id: 'unit_aqeedah_2',
            course_id: 'course_aqeedah',
            order_index: 1,
            title: 'Belief in the Angels and Scriptures',
            title_ar: 'Darasi Na 3: Imani da Mala\'iku da Littattafan Da Aka Saukar',
            summary_ar: 'Sanin siffofin Mala\'iku da ayyukan da Allah ya dora musu da imani da Littattafan samaniya.',
            media: {
              video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
              duration_minutes: 28,
              duration_formatted: '28:10'
            },
            reading_content_ar: `Imani da Mala'iku ya kunshi abubuwa hudu:
Imani da samuwar su, imani da wadanda muka san sunayensu kamar Jibrilu, Mika'ilu, Israfilu, da Malik, imani da siffofinsu, da kuma imani da ayyukan da suke yi da umarnin Allah Madaukaki.`,
            references: ['Sharhin Aqeedatil Wasitiyyah na Sheikh Ibn Uthaymeen']
          }
        ]
      }
    ]
  },
  {
    id: 'course_hadith',
    code: 'HADITH_101',
    name: 'Prophetic Hadith & Terminology',
    name_ar: 'Ilimin Hadisi da Mustalahul Hadith (علوم الحديث)',
    status: 'active',
    banner_image: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?auto=format&fit=crop&w=1200&q=80',
    instructor_name_ar: 'Dr. Ibrahim Al-Madani (د. إبراهيم المدني)',
    instructor_title_ar: 'Shugaban Sashen Hadisi da Tarihi',
    pass_mark: 75,
    weight_lessons: 30,
    weight_exam: 70,
    unit_label_ar: 'Matakin Karatu',
    description_ar: 'Koyon ka\'idojin ingancin hadisai, rabe-raben hadisi zuwa Sahih, Hasan, da Da\'eef da ka\'idojin karba ko mayarwa.',
    units: [
      {
        id: 'unit_hadith_1',
        course_id: 'course_hadith',
        order_index: 1,
        title: 'Unit 1: Accepted Hadith Categories',
        title_ar: 'Kashi Na 1: Rabe-raben Hadisan Da Ake Karba (Sahih da Hasan)',
        description_ar: 'Sharuddan Hadisi Sahih li-dhatihi da Hadisi Hasan da yadda ake kafa hujja da su.',
        exam_id: 'exam_hadith_u1',
        lessons: [
          {
            id: 'les_hd_1',
            unit_id: 'unit_hadith_1',
            course_id: 'course_hadith',
            order_index: 1,
            title: 'Conditions of Sahih Hadith',
            title_ar: 'Darasi Na 1: Sharuddan Hadisi Sahih Guda Biyar',
            summary_ar: 'Sharuddan hadisi sahih guda 5: Haduwar Sanadi, Adalcin Masu Ba Da Labari, Cikar Hadda da Kula, Rashin Shadhdhi, da Rashin Ilallahi mai cutarwa.',
            media: {
              video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
              duration_minutes: 35,
              duration_formatted: '35:20'
            },
            reading_content_ar: `Imam al-Baiquni ya ce a cikin baitukan al-Manzumah al-Baiquniyyah:
Sharuddan hadisi sahih guda biyar ne:
1. Ittisalus Sanad: Kowane maruwaci ya ji kai tsaye daga malaminsa.
2. Adalat ar-Ruwat: Maruwata su kasance musulmi, masu tsoron Allah, da kamewa daga zunubai.
3. Tamamud Dabt: Cikar kiyayewa ta hanyar hadda a ka ko kiyaye littafi.
4. Rashin Shudhudh: Kada maruwaci amintacce ya saba wa wanda ya fi shi amana da yawa.
5. Rashin Illah: Rashin wata illa a boye mai raunana hadisi yayin da a bayyane yake da kyau.`,
            references: ['Muqaddimatu Ibn as-Salah', 'Nukhbatul Fikar na Ibn Hajar al-Asqalani']
          }
        ]
      }
    ]
  },
  {
    id: 'course_fiqh',
    code: 'FIQH_101',
    name: 'Fiqh of Worship & Purification',
    name_ar: 'Fikihun Bauta da Tsarki da Sallah (فقه العبادات)',
    status: 'active',
    banner_image: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1200&q=80',
    instructor_name_ar: 'Sheikh Abdullah Al-Qasim (الشيخ عبد الله القاسم)',
    instructor_title_ar: 'Malamin Fikihu da Ladubba',
    pass_mark: 70,
    weight_lessons: 50,
    weight_exam: 50,
    unit_label_ar: 'Kashi',
    description_ar: 'Koyon hukunce-hukuncen tsarki, rabe-raben ruwa, farillan alwala da yadda Annabi ﷺ ya yi sallah.',
    units: [
      {
        id: 'unit_fiqh_1',
        course_id: 'course_fiqh',
        order_index: 1,
        title: 'Purification and Ablution',
        title_ar: 'Kashi Na 1: Rabe-raben Ruwa da Farillan Alwala',
        description_ar: 'Hukuncin ruwa mai tsarki da najasa da farillan alwala guda shida da abubuwan da ke karya ta.',
        lessons: [
          {
            id: 'les_fq_1',
            unit_id: 'unit_fiqh_1',
            course_id: 'course_fiqh',
            order_index: 1,
            title: 'Categories of Water & Ablution',
            title_ar: 'Darasi Na 1: Rabe-raben Ruwa da Farillan Alwala Guda Shida',
            summary_ar: 'Bayanin ruwa mai tsarkakewa da ruwa mai najasa da farillan alwala kamar yadda suka zo a Ayar Suratul Ma\'idah.',
            media: {
              video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
              audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
              duration_minutes: 26,
              duration_formatted: '26:00'
            },
            reading_content_ar: `Allah Madaukaki ya ce a cikin Suratul Ma'idah: (Ya ku wadanda suka yi imani! Idan kun tashi zuwa sallah to ku wanke fuskokinku da hannayenku zuwa gwiwar hannu, kuma ku shafi kawunanku, ku wanke kafafunku zuwa idon kafa).
Farillan alwala guda shida ne:
1. Wanke fuska (ciki har da kuskure baki da shakar ruwa a hanci).
2. Wanke hannaye zuwa gwiwar hannu.
3. Shafar kai duka (ciki har da kunnuwa).
4. Wanke kafafu zuwa idon kafa.
5. Jerantawa tsakanin gabbai (Tartib).
6. Sadarwa ba tare da barin wani gaba ya bushe kafin wanke na gaba ba (Muwalat).`,
            references: ['Umdatul Fiqh na Ibn Qudamah', 'Al-Mulakhas al-Fiqhi na Sheikh Salih al-Fawzan']
          }
        ]
      }
    ]
  }
];

export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam_aqeedah_u1',
    course_id: 'course_aqeedah',
    unit_id: 'unit_aqeedah_1',
    title_ar: 'Jarabawar Kashi Na 1: Asalin Tauhidi da Rabe-rabensa',
    duration_minutes: 30,
    pass_mark: 70,
    is_published: true,
    questions: [
      {
        id: 'q_aq_1',
        exam_id: 'exam_aqeedah_u1',
        format: 'mcq',
        prompt_ar: 'Menene ma\'anar "Tauhidul Uluhiyya" a Shari\'ar Musulunci?',
        max_points: 20,
        options: [
          { id: 'opt1', text_ar: 'Kadaita Allah da ayyukansa kamar halitta da arzurtawa', is_correct: false },
          { id: 'opt2', text_ar: 'Kadaita Allah da ayyukan bauta na bayi kamar addu\'a, yanka, da dogaro', is_correct: true },
          { id: 'opt3', text_ar: 'Tabbatar da sunayen Allah a Alkur\'ani kawai', is_correct: false },
          { id: 'opt4', text_ar: 'Yarda da cewa Allah yana nan ba tare da bauta ba', is_correct: false }
        ]
      },
      {
        id: 'q_aq_2',
        exam_id: 'exam_aqeedah_u1',
        format: 'tf',
        prompt_ar: 'Kafirran Kuraishawa a zamanin Manzon Allah ﷺ sun kasance suna yarda da Tauhidur Rububiyya amma hakan bai shigar da su musulunci ba.',
        max_points: 15,
        options: [
          { id: 'opt_true', text_ar: 'Gaskiya ne (True / صواب)', is_correct: true },
          { id: 'opt_false', text_ar: 'Kuskure ne (False / خطأ)', is_correct: false }
        ]
      },
      {
        id: 'q_aq_3',
        exam_id: 'exam_aqeedah_u1',
        format: 'fill',
        prompt_ar: 'Farkon abin da ya wajaba a kan kowane bawa shi ne shaidawa cewa babu abin bautawa da gaskiya sai ________ .',
        expected_answer: 'Allah',
        max_points: 25,
      },
      {
        id: 'q_aq_4',
        exam_id: 'exam_aqeedah_u1',
        format: 'essay',
        prompt_ar: 'Bayyana sharuddan "La ilaha illa Allah" guda bakwai a takaice tare da kawo aya ko hadisi da ya nuna sharadin Ilimi da Yakini.',
        rubric_ar: 'Ana bayar da maki 15 don ambaton sharudda 7 da maki 25 don ingancin kawo aya ko hadisi da tsarin rubutu mai kyau.',
        max_points: 40
      }
    ]
  },
  {
    id: 'exam_hadith_u1',
    course_id: 'course_hadith',
    unit_id: 'unit_hadith_1',
    title_ar: 'Jarabawar Ilimin Hadisi: Ka\'idojin Ingancin Hadisi Sahih',
    duration_minutes: 25,
    pass_mark: 75,
    is_published: true,
    questions: [
      {
        id: 'q_hd_1',
        exam_id: 'exam_hadith_u1',
        format: 'mcq',
        prompt_ar: 'Sharudda guda nawa ne dole su cika a sanadi da matani domin hadisi ya zama Sahih li-dhatihi?',
        max_points: 30,
        options: [
          { id: 'hd_opt1', text_ar: 'Sharudda uku', is_correct: false },
          { id: 'hd_opt2', text_ar: 'Sharudda biyar (Sadarwar sanadi, adalci, hadda, rashin shudhudh, rashin illa)', is_correct: true },
          { id: 'hd_opt3', text_ar: 'Sharudda bakwai', is_correct: false },
          { id: 'hd_opt4', text_ar: 'Sharudda biyu kawai', is_correct: false }
        ]
      },
      {
        id: 'q_hd_2',
        exam_id: 'exam_hadith_u1',
        format: 'essay',
        prompt_ar: 'Yi bayanin bambanci tsakanin "Shudhudh" da "Illah" a cikin ilimin hadisi da sanadinsa.',
        rubric_ar: 'Bayyana sabawar mai amana ga wanda ya fi shi (Shudhudh) da bayanin matsala a boye mai raunana hadisi duk da kyawun zahirinsa (Illah).',
        max_points: 70
      }
    ]
  }
];

export const INITIAL_ATTEMPTS: ExamAttempt[] = [
  {
    id: 'att_001',
    exam_id: 'exam_aqeedah_u1',
    course_id: 'course_aqeedah',
    student_id: 'user_student_1',
    student_name_ar: 'Ahmad Bello Abubakar (أحمد بللو)',
    started_at: '2026-03-01T10:00:00Z',
    submitted_at: '2026-03-01T10:22:45Z',
    status: 'marked',
    score_pct: 95,
    total_points: 95,
    max_points: 100,
    responses: {
      q_aq_1: { selected: ['opt2'] },
      q_aq_2: { selected: ['opt_true'] },
      q_aq_3: { text: 'Allah' },
      q_aq_4: { text: 'Sharuddan La ilaha illallah guda bakwai ne: Ilimi, Yakini, Karba, Mika wuya, Gaskiya, Ikhlasi, da So. Hujjar ilimi ita ce fadin Allah Ta\'ala: (Fa\'lam annahu la ilaha illallah), kuma dalilin yakini shi ne hadisin Manzon Allah ﷺ: (Babu wani bawa da zai hadu da Allah ba tare da shakka a cikinsu ba face ya shiga Aljanna).' }
    },
    grades: {
      q_aq_1: { points: 20, feedback: 'Amsa ce ingantacciya kuma daidai da ma\'anar shari\'a.', marked_by_name_ar: 'Dr. Ibrahim Al-Madani' },
      q_aq_2: { points: 15, feedback: 'Kyakkyawar amsa, kamar yadda Allah ya fada a Alkur\'ani.', marked_by_name_ar: 'Dr. Ibrahim Al-Madani' },
      q_aq_3: { points: 25, feedback: 'Amsa ce daidai.', marked_by_name_ar: 'Dr. Ibrahim Al-Madani' },
      q_aq_4: { points: 35, feedback: 'Bayanin yana da matukar kyau da kawo ayoyi da hadisai masu ma\'ana. Allah ya albarkaci iliminka.', marked_by_name_ar: 'Dr. Ibrahim Al-Madani' }
    },
    security_events: [
      { timestamp: '2026-03-01T10:01:00Z', type: 'fullscreen_exit', label_ar: 'An fara jarabawa cikin aminci da bin ka\'ida' }
    ]
  },
  {
    id: 'att_002',
    exam_id: 'exam_aqeedah_u1',
    course_id: 'course_aqeedah',
    student_id: 'user_student_2',
    student_name_ar: 'Maryam Al-Kano (مريم الكانوية)',
    started_at: '2026-03-02T15:30:00Z',
    submitted_at: '2026-03-02T15:58:10Z',
    status: 'needs_marking',
    score_pct: 60,
    total_points: 60,
    max_points: 100,
    responses: {
      q_aq_1: { selected: ['opt2'] },
      q_aq_2: { selected: ['opt_true'] },
      q_aq_3: { text: 'Allah' },
      q_aq_4: { text: 'Sharuddan sune: Ilimi, Yakini, Karba, Mika wuya, Gaskiya, Ikhlasi, da So. Allah Madaukaki ya ce: (Ka sani cewa babu abin bautawa da gaskiya sai Allah).' }
    },
    grades: {
      q_aq_1: { points: 20 },
      q_aq_2: { points: 15 },
      q_aq_3: { points: 25 }
    },
    security_events: [
      { timestamp: '2026-03-02T15:45:12Z', type: 'window_blur', label_ar: 'Fita daga tagar jarabawa na dakika 8' }
    ]
  }
];

export const INITIAL_CERTIFICATES: CertificateRecord[] = [
  {
    id: 'cert_001',
    certificate_no: 'MIFTAH-2026-00101',
    student_id: 'user_student_1',
    student_name: 'Ahmad Bello Abubakar',
    student_name_ar: 'أحمد بللو أبو بكر (Ahmad Bello)',
    course_id: 'course_aqeedah',
    course_name_ar: 'Tauhid da Akidar Musulunci (العقيدة والتوحيد)',
    grade_band_ar: 'Mazaunin Farko Mai Daraja (A+ / ممتاز مرتفع)',
    final_score: 95,
    issued_at: '2026-03-05',
    status: 'valid',
    qr_payload: 'https://almiftahu.edu/verify?cert=MIFTAH-2026-00101&sn=101'
  }
];
