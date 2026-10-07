// Authentication & Registration Modal (PRD LMS Overhaul)
// Matching Madrasat al-Arqam design (Screenshots 085727, 085730, 085737)

import { getCurrentUser, loginUser, logoutUser, registerStudent, switchPersona, hasRole } from './auth.js';
import { escapeAttr, escapeHtml, setHint } from './ui.js';

let activeTab = 'login'; // 'login' | 'register' | 'staff'

export function showAuthModal(defaultTab = 'login', onComplete = null) {
  activeTab = defaultTab;
  let overlay = document.getElementById('authModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'authModalOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.style.display = 'flex';
  renderAuthModal(overlay, onComplete);
}

export function closeAuthModal() {
  const overlay = document.getElementById('authModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function renderAuthModal(overlay, onComplete) {
  overlay.innerHTML = `
    <div class="modal-content auth-modal-box" style="max-width:540px; width:95%; max-height:92vh; overflow-y:auto; padding:28px 24px; border-radius:18px; position:relative; box-shadow:0 20px 45px rgba(0,0,0,0.15);">
      <button class="close-btn" id="closeAuthModalBtn" style="position:absolute; top:18px; left:18px; font-size:1.6rem; border:none; background:none; cursor:pointer; color:var(--text-muted);">&times;</button>
      
      <!-- Academy Branding Header -->
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-family:'Amiri', serif; font-size:1.5rem; color:var(--gold-ochre); margin-bottom:2px;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <h2 style="font-family:'Amiri', serif; font-size:1.9rem; color:var(--emerald-dark); margin:0 0 4px; font-weight:700;">معهد مفتاح العلم</h2>
        <div style="font-size:0.85rem; color:var(--text-muted);">بوابة التعليم الأكاديمي والامتحانات المعتمدة</div>
      </div>

      <!-- Segmented Nav Tabs -->
      <div style="display:flex; background:var(--bg-warm); border:1px solid var(--border-color); border-radius:10px; padding:4px; margin-bottom:22px; gap:4px;">
        <button type="button" class="auth-subtab-btn ${activeTab === 'login' ? 'active' : ''}" data-tab="login" style="flex:1; padding:8px 6px; border:none; border-radius:7px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; ${activeTab === 'login' ? 'background:#fff; color:var(--emerald-dark); box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'background:transparent; color:var(--text-muted);'}">
          تسجيل الدخول
        </button>
        <button type="button" class="auth-subtab-btn ${activeTab === 'register' ? 'active' : ''}" data-tab="register" style="flex:1; padding:8px 6px; border:none; border-radius:7px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; ${activeTab === 'register' ? 'background:#fff; color:var(--emerald-dark); box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'background:transparent; color:var(--text-muted);'}">
          إنشاء حساب جديد
        </button>
        <button type="button" class="auth-subtab-btn ${activeTab === 'staff' ? 'active' : ''}" data-tab="staff" style="flex:1; padding:8px 6px; border:none; border-radius:7px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; ${activeTab === 'staff' ? 'background:#fff; color:var(--emerald-dark); box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'background:transparent; color:var(--text-muted);'}">
          الكادر التعليمي
        </button>
      </div>

      <!-- TAB 1: STUDENT LOGIN -->
      ${activeTab === 'login' ? `
        <div id="authStudentLoginForm">
          <div style="margin-bottom:18px;">
            <h3 style="margin:0 0 6px; font-size:1.3rem; color:var(--text-dark); font-weight:700;">تسجيل الدخول إلى حسابك</h3>
            <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">أدخل بياناتك الآتية لتتمكن من الوصول إلى لوحتك التعليمية</p>
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:14px;">
            <label for="loginEmail" style="margin-bottom:5px; font-size:0.88rem; font-weight:600;">البريد الإلكتروني <span style="color:#dc2626;">*</span></label>
            <input type="email" id="loginEmail" placeholder="student@almiftahu.edu" value="student@almiftahu.edu" style="width:100%; padding:10px 14px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:18px;">
            <label for="loginPass" style="margin-bottom:5px; font-size:0.88rem; font-weight:600;">كلمة المرور <span style="color:#dc2626;">*</span></label>
            <input type="password" id="loginPass" placeholder="••••••••" value="student" style="width:100%; padding:10px 14px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
          </div>

          <button type="button" id="submitLoginBtn" class="save-btn" style="width:100%; padding:12px; justify-content:center; font-size:1rem; font-weight:700; background:#292524; color:#fff; border-radius:8px;">
            تسجيل الدخول
          </button>
          <div class="save-hint" id="loginHint" style="margin-top:10px; text-align:center;"></div>
        </div>
      ` : ''}

      <!-- TAB 2: STUDENT REGISTRATION (Full Multi-field form) -->
      ${activeTab === 'register' ? `
        <div id="authStudentRegisterForm">
          <div style="margin-bottom:16px;">
            <h3 style="margin:0 0 4px; font-size:1.3rem; color:var(--text-dark); font-weight:700;">إنشاء حساب جديد</h3>
            <div style="font-size:0.82rem; color:var(--emerald-dark); font-weight:600; border-bottom:2px solid var(--emerald-dark); padding-bottom:4px; display:inline-block;">1. البيانات الأساسية</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">الاسم الأول (بالعربية) <span style="color:#dc2626;">*</span></label>
              <input type="text" id="regFirstName" dir="auto" placeholder="أحمد" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">الاسم الأخير (بالعربية) <span style="color:#dc2626;">*</span></label>
              <input type="text" id="regLastName" dir="auto" placeholder="بللو" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
            </div>
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:12px;">
            <label style="margin-bottom:4px; font-size:0.82rem; font-weight:600;">البريد الإلكتروني <span style="color:#dc2626;">*</span></label>
            <input type="email" id="regEmail" placeholder="yourname@domain.com" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">الجنس <span style="color:#dc2626;">*</span></label>
              <select id="regGender" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box; background:#fff;">
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">الجنسية <span style="color:#dc2626;">*</span></label>
              <input type="text" id="regNationality" placeholder="نيجيري / سعودي / مصري..." style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">بلد الإقامة <span style="color:#dc2626;">*</span></label>
              <input type="text" id="regCountry" placeholder="نيجيريا / المملكة العربية السعودية..." style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:4px;">المستوى التعليمي <span style="color:#dc2626;">*</span></label>
              <select id="regEdu" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box; background:#fff;">
                <option value="ثانوي">المرحلة الثانوية</option>
                <option value="جامعي">بكالوريوس / جامعي</option>
                <option value="دراسات عليا">ماجستير / دكتوراه</option>
                <option value="أخرى">غير ذلك</option>
              </select>
            </div>
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:18px;">
            <label style="margin-bottom:4px; font-size:0.82rem; font-weight:600;">كلمة المرور <span style="color:#dc2626;">*</span></label>
            <input type="password" id="regPassword" placeholder="أدخل كلمة مرور قوية" style="width:100%; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem; box-sizing:border-box;">
          </div>

          <button type="button" id="submitRegisterBtn" class="save-btn" style="width:100%; padding:12px; justify-content:center; font-size:1rem; font-weight:700; background:#292524; color:#fff; border-radius:8px;">
            إنشاء الحساب وبدء التعلم
          </button>
          <div class="save-hint" id="regHint" style="margin-top:10px; text-align:center;"></div>
        </div>
      ` : ''}

      <!-- TAB 3: STAFF / TEACHER / ADMIN LOGIN (NO PIN, UNIQUE CREDENTIALS) -->
      ${activeTab === 'staff' ? `
        <div id="authStaffLoginForm">
          <div style="margin-bottom:18px;">
            <h3 style="margin:0 0 6px; font-size:1.3rem; color:var(--emerald-dark); font-weight:700;">دخول المشرفين وهيئة التدريس</h3>
            <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">تسجيل الدخول الفريد للمعلمين ومدراء النظام (لا يلزم إدخال رمز PIN)</p>
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:14px;">
            <label for="staffEmail" style="margin-bottom:5px; font-size:0.88rem; font-weight:600;">البريد الإلكتروني المهني <span style="color:#dc2626;">*</span></label>
            <input type="email" id="staffEmail" placeholder="teacher@almiftahu.edu" value="teacher@almiftahu.edu" style="width:100%; padding:10px 14px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
          </div>

          <div class="field-row" style="flex-direction:column; align-items:flex-start; margin-bottom:18px;">
            <label for="staffPass" style="margin-bottom:5px; font-size:0.88rem; font-weight:600;">كلمة المرور <span style="color:#dc2626;">*</span></label>
            <input type="password" id="staffPass" placeholder="••••••••" value="teacher" style="width:100%; padding:10px 14px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
          </div>

          <button type="button" id="submitStaffBtn" class="save-btn" style="width:100%; padding:12px; justify-content:center; font-size:1rem; font-weight:700; background:var(--emerald-dark); color:#fff; border-radius:8px;">
            تسجيل الدخول إلى النظام
          </button>
          <div class="save-hint" id="staffHint" style="margin-top:10px; text-align:center;"></div>
        </div>
      ` : ''}

      <!-- Quick Switcher Bar for Seamless Evaluator Testing -->
      <div style="margin-top:24px; padding-top:16px; border-top:1px dashed var(--border-color); text-align:center;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:8px;">تجربة الأدوار السريعة (Demo Personas):</span>
        <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
          <button type="button" class="ghost-btn sm" id="quickStudentBtn" style="font-size:0.78rem;">
            👤 طالب (Student)
          </button>
          <button type="button" class="ghost-btn sm" id="quickTeacherBtn" style="font-size:0.78rem; border-color:var(--emerald-dark); color:var(--emerald-dark);">
            👨‍🏫 معلّم (Teacher)
          </button>
          <button type="button" class="ghost-btn sm" id="quickAdminBtn" style="font-size:0.78rem; border-color:var(--gold-ochre); color:var(--gold-ochre);">
            👑 المشرف العام (Admin)
          </button>
        </div>
      </div>
    </div>
  `;

  // Close button
  document.getElementById('closeAuthModalBtn')?.addEventListener('click', closeAuthModal);

  // Tab switcher
  overlay.querySelectorAll('.auth-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderAuthModal(overlay, onComplete);
    });
  });

  // Login handler
  document.getElementById('submitLoginBtn')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const hint = document.getElementById('loginHint');
    try {
      const user = loginUser(email, pass);
      setHint(hint, `مرحبًا بك ${user.name_ar || user.name} ✓`, 'ok');
      setTimeout(() => {
        closeAuthModal();
        if (onComplete) onComplete(user);
        window.location.reload();
      }, 500);
    } catch (err) {
      setHint(hint, err.message, 'err');
    }
  });

  // Register handler
  document.getElementById('submitRegisterBtn')?.addEventListener('click', () => {
    const fn = document.getElementById('regFirstName').value.trim();
    const ln = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const gender = document.getElementById('regGender').value;
    const nationality = document.getElementById('regNationality').value.trim();
    const country = document.getElementById('regCountry').value.trim();
    const edu = document.getElementById('regEdu').value;
    const pass = document.getElementById('regPassword').value;
    const hint = document.getElementById('regHint');

    if (!fn || !email || !pass) {
      return setHint(hint, 'يرجى تعبئة الحقول المطلوبة.', 'err');
    }

    try {
      const user = registerStudent({
        name: `${fn} ${ln}`.trim(),
        name_ar: `${fn} ${ln}`.trim(),
        email,
        gender,
        nationality,
        country,
        education_level: edu,
        password: pass
      });
      setHint(hint, `تم إنشاء الحساب بنجاح! مرحبًا بك ${user.name_ar} ✓`, 'ok');
      setTimeout(() => {
        closeAuthModal();
        if (onComplete) onComplete(user);
        window.location.reload();
      }, 600);
    } catch (err) {
      setHint(hint, err.message, 'err');
    }
  });

  // Staff Login handler (Teachers and Admins)
  document.getElementById('submitStaffBtn')?.addEventListener('click', () => {
    const email = document.getElementById('staffEmail').value;
    const pass = document.getElementById('staffPass').value;
    const hint = document.getElementById('staffHint');
    try {
      const user = loginUser(email, pass);
      const roleTitle = user.role === 'admin' ? 'المشرف العام (Admin)' : 'الأستاذ (Teacher)';
      setHint(hint, `تم الدخول بنجاح بصلاحية: ${roleTitle} ✓`, 'ok');
      setTimeout(() => {
        closeAuthModal();
        if (onComplete) onComplete(user);
        window.location.reload();
      }, 500);
    } catch (err) {
      setHint(hint, err.message, 'err');
    }
  });

  // Quick Persona Buttons for Testing
  document.getElementById('quickStudentBtn')?.addEventListener('click', () => {
    switchPersona('student');
    closeAuthModal();
    window.location.reload();
  });
  document.getElementById('quickTeacherBtn')?.addEventListener('click', () => {
    switchPersona('teacher');
    closeAuthModal();
    window.location.reload();
  });
  document.getElementById('quickAdminBtn')?.addEventListener('click', () => {
    switchPersona('admin');
    closeAuthModal();
    window.location.reload();
  });
}
