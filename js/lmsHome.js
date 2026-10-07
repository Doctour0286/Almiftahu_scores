// Home View (PRD LMS Overhaul)
// Matches Madrasat al-Arqam Screenshot 085712

import { PROGRAM_INFO, getProgressStats, getRecentLesson } from './curriculum.js';
import { getCurrentUser } from './auth.js';
import { showAuthModal } from './authModal.js';
import { escapeHtml } from './ui.js';

export function renderLmsHome(container, onNavigate) {
  const stats = getProgressStats();
  const recent = getRecentLesson();
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="lms-home-wrap" dir="rtl" style="max-width:880px; margin:0 auto; padding-bottom:40px;">
      
      <!-- HERO BANNER SECTION -->
      <div class="home-hero-card" style="text-align:center; margin-bottom:28px; padding:10px 4px;">
        <div style="font-family:'Amiri', serif; font-size:1.6rem; color:var(--gold-ochre); margin-bottom:6px;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <h1 style="font-family:'Amiri', serif; font-size:2.4rem; color:var(--text-dark); margin:0 0 10px; font-weight:700;">
          ${escapeHtml(PROGRAM_INFO.title)}
        </h1>
        <p style="font-family:'Amiri', serif; font-size:1.15rem; line-height:1.8; color:var(--text-dark); max-width:680px; margin:0 auto 20px;">
          ${escapeHtml(PROGRAM_INFO.subtitle)}
        </p>

        <!-- Media Hero Card with Play Action -->
        <div id="homeHeroPlayCard" style="position:relative; width:100%; aspect-ratio:16/9; max-height:360px; border-radius:18px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.12); cursor:pointer; background:#1c1917; margin-bottom:24px;">
          <img src="${escapeHtml(PROGRAM_INFO.banner_image)}" alt="Almiftahu Academy" style="width:100%; height:100%; object-fit:cover; opacity:0.9; transition:transform 0.3s;">
          <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, transparent 100%); display:flex; flex-direction:column; justify-content:center; align-items:center;">
            <div style="width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,0.92); display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,0.25); margin-bottom:12px; transition:transform 0.2s;">
              <span style="font-size:2rem; margin-right:-4px; color:#292524;">▶</span>
            </div>
            <span style="color:#fff; font-weight:700; font-size:1.1rem; text-shadow:0 2px 4px rgba(0,0,0,0.6);">مشاهدة اللقاء التعريفي والمنهج</span>
          </div>
        </div>
      </div>

      <!-- PROGRAM BATCH CARD (الدفعة الأولى) -->
      <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:16px; padding:24px; margin-bottom:24px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:4px; font-weight:600;">برنامج مدرسة مفتاح العلم</div>
        <h3 style="margin:0 0 16px; font-size:1.5rem; font-weight:700; color:var(--text-dark);">${escapeHtml(PROGRAM_INFO.batch)}</h3>
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:14px; margin-bottom:20px;">
          <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:10px; padding:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">المدة المقررة</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--text-dark); margin-top:2px;">سنة واحدة</div>
          </div>
          <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:10px; padding:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">تاريخ البدء</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--text-dark); margin-top:2px;">9 يونيو 2026</div>
          </div>
          <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:10px; padding:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">إجمالي الدروس</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--emerald-dark); margin-top:2px;">76 محاضرة</div>
          </div>
          <div style="background:var(--bg-warm); border:1px solid var(--border-color); border-radius:10px; padding:12px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">نسبة إنجازك</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--emerald-dark); margin-top:2px;">${stats.percentage}%</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button type="button" class="save-btn" id="homeViewProgramBtn" style="flex:1; min-width:180px; justify-content:center; background:#292524; color:#fff; border-radius:8px; padding:12px; font-weight:700;">
            عرض البرنامج والمقررات &larr;
          </button>
          <button type="button" class="ghost-btn" id="homeResumeBtn" style="flex:1; min-width:180px; justify-content:center; border-radius:8px; padding:12px; font-weight:700; border-color:var(--emerald-dark); color:var(--emerald-dark);">
            متابعة الدرس (${escapeHtml(recent.title.slice(0, 24))}…)
          </button>
        </div>
      </div>

      <!-- QUICK SHORTCUT TILES -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:28px;">
        
        <div class="shortcut-tile" id="tileSchedule" style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:12px; padding:18px; cursor:pointer; transition:transform 0.15s, border-color 0.15s;">
          <div style="font-size:1.8rem; margin-bottom:8px;">📅</div>
          <h4 style="margin:0 0 4px; font-size:1rem; font-weight:700; color:var(--text-dark);">لوحتي التعليمية</h4>
          <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">الجدول اليومي ومواعيد المحاضرات والتقويم الأسبوعي.</p>
        </div>

        <div class="shortcut-tile" id="tileExams" style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:12px; padding:18px; cursor:pointer; transition:transform 0.15s, border-color 0.15s;">
          <div style="font-size:1.8rem; margin-bottom:8px;">📝</div>
          <h4 style="margin:0 0 4px; font-size:1rem; font-weight:700; color:var(--text-dark);">الاختبارات والتقييم</h4>
          <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">دخول الاختبارات الإلكترونية ومراجعة الإجابات والدرجات.</p>
        </div>

        <div class="shortcut-tile" id="tileCerts" style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:12px; padding:18px; cursor:pointer; transition:transform 0.15s, border-color 0.15s;">
          <div style="font-size:1.8rem; margin-bottom:8px;">🎓</div>
          <h4 style="margin:0 0 4px; font-size:1rem; font-weight:700; color:var(--text-dark);">الشهادات والتحقق</h4>
          <p style="margin:0; font-size:0.78rem; color:var(--text-muted);">عرض الشهادات الصادرة والتحقق الفوري برمز QR الرسمي.</p>
        </div>

      </div>

      <!-- ACADEMY NOTICE -->
      <div style="background:rgba(6,95,70,0.06); border:1px solid rgba(6,95,70,0.2); border-radius:12px; padding:16px 20px; display:flex; align-items:center; gap:16px;">
        <span style="font-size:1.6rem;">📢</span>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.95rem; color:var(--emerald-dark); margin-bottom:2px;">تنبيه أكاديمي</div>
          <div style="font-size:0.82rem; color:var(--text-dark);">
            بدأ فتح باب التسجيل للاختبار الفصلي للمرحلة الأولى. يرجى إتمام جميع المحاضرات المطلوبة لتفعيل خانة الاختبار.
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire actions
  document.getElementById('homeHeroPlayCard')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('classroom', 'les_01');
  });

  document.getElementById('homeViewProgramBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('programs');
  });

  document.getElementById('homeResumeBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('classroom', recent.id);
  });

  document.getElementById('tileSchedule')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('schedule');
  });

  document.getElementById('tileExams')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('exams');
  });

  document.getElementById('tileCerts')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('certificates');
  });
}
