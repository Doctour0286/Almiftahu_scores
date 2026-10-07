// Programs Hub & Multi-Phase Curriculum View (PRD LMS Overhaul)
// Matches Madrasat al-Arqam Screenshots 085922, 085930, 090001

import { PROGRAM_INFO, PROGRAM_LEVELS, getAllLessons, isLessonCompleted, getProgressStats } from './curriculum.js';
import { escapeHtml } from './ui.js';

let activeSubTab = 'years'; // 'years' | 'certificate' | 'notes'
let levelSubTab = 'lessons'; // 'lessons' | 'exercises' | 'questions'

export function renderLmsPrograms(container, onNavigate) {
  const stats = getProgressStats();
  const allLessons = getAllLessons();
  const level = PROGRAM_LEVELS[0];

  container.innerHTML = `
    <div class="lms-programs-wrap" dir="rtl" style="max-width:880px; margin:0 auto; padding-bottom:40px;">
      
      <!-- TOP PROGRESS HEADER (Screenshot 085922) -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding:0 4px;">
        <span style="font-weight:700; font-size:1.15rem; color:var(--text-dark);">${escapeHtml(PROGRAM_INFO.title)}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; font-size:0.85rem; color:var(--text-muted);">${stats.percentage}%</span>
          <div style="width:90px; height:8px; background:var(--border-color); border-radius:4px; overflow:hidden;">
            <div style="width:${stats.percentage}%; height:100%; background:#292524;"></div>
          </div>
        </div>
      </div>

      <!-- TELEGRAM CHANNEL BANNER CARD (Screenshot 085922) -->
      <div style="background:var(--bg-warm); border:1.5px solid var(--border-color); border-radius:14px; padding:18px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <span style="font-size:1.6rem; color:var(--text-muted);">ℹ️</span>
          <div>
            <h4 style="margin:0 0 2px; font-size:1.05rem; font-weight:700; color:var(--text-dark);">
              يرجى الانضمام إلى قناة التليجرام الخاصة بالبرنامج
            </h4>
            <div style="font-size:0.78rem; color:var(--text-muted);">لتلقي إشعارات الدروس والمذكرات الدورية ومواعيد الاختبارات</div>
          </div>
        </div>
        <a href="${escapeHtml(PROGRAM_INFO.telegram_url)}" target="_blank" rel="noopener noreferrer" class="save-btn sm" style="background:#292524; color:#fff; border-radius:8px; text-decoration:none; padding:8px 18px; font-weight:700;">
          قناة التليجرام
        </a>
      </div>

      <!-- PROGRAM HERO CARD (Screenshot 085922) -->
      <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:18px; overflow:hidden; margin-bottom:24px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <div style="position:relative; width:100%; aspect-ratio:16/9; max-height:260px; background:#1c1917; overflow:hidden;">
          <img src="${escapeHtml(PROGRAM_INFO.banner_image)}" alt="Program Hero" style="width:100%; height:100%; object-fit:cover; opacity:0.9;">
        </div>

        <div style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="margin:0; font-family:'Amiri', serif; font-size:1.8rem; font-weight:700; color:var(--emerald-dark);">
              ${escapeHtml(PROGRAM_INFO.title)}
            </h3>
            
            <!-- Circular Progress Ring (Screenshot 085922) -->
            <div style="position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform:rotate(-90deg);">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-color)" stroke-width="3.5"/>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#292524" stroke-dasharray="${stats.percentage}, 100" stroke-width="3.5"/>
              </svg>
              <span style="position:absolute; font-size:0.75rem; font-weight:700; color:var(--text-dark);">${stats.percentage}%</span>
            </div>
          </div>

          <!-- Metadata Rows -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem; color:var(--text-dark); margin-bottom:18px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>📚</span>
              <span>السنوات: <b>${PROGRAM_INFO.duration_years}</b></span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>🕒</span>
              <span>تاريخ البدء: <b>9 يونيو 2026</b></span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>⏳</span>
              <span>تاريخ الانتهاء: <b>8 ديسمبر 2028</b></span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>📝</span>
              <span>المشاريع والامتحانات: <b>${level.project_count}</b></span>
            </div>
          </div>

          <!-- Tabs: السنوات / الشهادة / ملاحظات (Screenshot 085930) -->
          <div style="display:flex; border-bottom:1.5px solid var(--border-color); gap:8px;">
            <button type="button" class="prog-subtab-btn ${activeSubTab === 'years' ? 'active' : ''}" data-tab="years" style="padding:10px 18px; border:none; background:none; font-weight:700; font-size:0.9rem; cursor:pointer; border-bottom:3px solid ${activeSubTab === 'years' ? '#292524' : 'transparent'}; color:${activeSubTab === 'years' ? '#292524' : 'var(--text-muted)'};">
              السنوات والمراحل
            </button>
            <button type="button" class="prog-subtab-btn ${activeSubTab === 'certificate' ? 'active' : ''}" data-tab="certificate" style="padding:10px 18px; border:none; background:none; font-weight:700; font-size:0.9rem; cursor:pointer; border-bottom:3px solid ${activeSubTab === 'certificate' ? '#292524' : 'transparent'}; color:${activeSubTab === 'certificate' ? '#292524' : 'var(--text-muted)'};">
              الشهادة الرسمية
            </button>
            <button type="button" class="prog-subtab-btn ${activeSubTab === 'notes' ? 'active' : ''}" data-tab="notes" style="padding:10px 18px; border:none; background:none; font-weight:700; font-size:0.9rem; cursor:pointer; border-bottom:3px solid ${activeSubTab === 'notes' ? '#292524' : 'transparent'}; color:${activeSubTab === 'notes' ? '#292524' : 'var(--text-muted)'};">
              ملاحظات وتوجيهات
            </button>
          </div>
        </div>
      </div>

      <!-- TAB CONTENT: YEARS & PHASES (Screenshot 090001) -->
      ${activeSubTab === 'years' ? `
        <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:18px; padding:22px; margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="margin:0 0 4px; font-size:1.35rem; font-weight:700; color:var(--text-dark);">
                ${escapeHtml(level.title)}
              </h3>
              <div style="font-size:0.8rem; color:var(--text-muted);">
                الدروس: <b>${level.lesson_count}</b> • المشاريع: <b>${level.project_count}</b>
              </div>
            </div>
            
            <button type="button" class="save-btn" id="startFirstLessonBtn" style="background:#292524; color:#fff; border-radius:8px; font-weight:700;">
              دخول قاعة الدرس &rarr;
            </button>
          </div>

          <!-- Sub-tabs: الدروس / التمارين / الأسئلة (Screenshot 090001) -->
          <div style="display:flex; gap:8px; margin-bottom:18px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
            <button type="button" class="level-subtab-btn ${levelSubTab === 'lessons' ? 'active' : ''}" data-tab="lessons" style="padding:6px 16px; border:none; border-radius:6px; font-weight:700; font-size:0.85rem; cursor:pointer; ${levelSubTab === 'lessons' ? 'background:#292524; color:#fff;' : 'background:var(--bg-warm); color:var(--text-muted);'}">
              الدروس (${allLessons.length})
            </button>
            <button type="button" class="level-subtab-btn ${levelSubTab === 'exercises' ? 'active' : ''}" data-tab="exercises" style="padding:6px 16px; border:none; border-radius:6px; font-weight:700; font-size:0.85rem; cursor:pointer; ${levelSubTab === 'exercises' ? 'background:#292524; color:#fff;' : 'background:var(--bg-warm); color:var(--text-muted);'}">
              التمارين والاختبار
            </button>
            <button type="button" class="level-subtab-btn ${levelSubTab === 'questions' ? 'active' : ''}" data-tab="questions" style="padding:6px 16px; border:none; border-radius:6px; font-weight:700; font-size:0.85rem; cursor:pointer; ${levelSubTab === 'questions' ? 'background:#292524; color:#fff;' : 'background:var(--bg-warm); color:var(--text-muted);'}">
              الأسئلة العلمية
            </button>
          </div>

          <!-- LESSONS LIST -->
          ${levelSubTab === 'lessons' ? `
            <div class="lessons-list">
              ${allLessons.slice(0, 25).map(l => {
                const done = isLessonCompleted(l.id);
                return `
                  <div class="lesson-list-item" data-id="${escapeAttr(l.id)}" style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid var(--border-color); border-radius:10px; padding:14px 16px; margin-bottom:8px; cursor:pointer; transition:all 0.15s;">
                    <div style="display:flex; align-items:center; gap:14px; flex:1;">
                      <span style="font-weight:700; font-size:0.85rem; color:var(--text-muted); font-family:monospace; min-width:20px;">
                        ${l.num}
                      </span>
                      <span style="width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.9rem; ${done ? 'background:#059669; color:#fff;' : 'background:var(--bg-warm); color:var(--text-muted);'}">
                        ${done ? '✓' : '•'}
                      </span>
                      <div>
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text-dark);">${escapeHtml(l.title)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                          ${l.type === 'reading' ? 'مذكرة قراءة' : 'درس مسجل'} • ${escapeHtml(l.date)}
                        </div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="font-size:1.1rem;">${l.type === 'reading' ? '📄' : '▶️'}</span>
                      <span style="color:var(--text-muted); font-size:1.1rem;">&larr;</span>
                    </div>
                  </div>
                `;
              }).join('')}
              <div style="text-align:center; padding:12px; color:var(--text-muted); font-size:0.85rem;">
                عرض 25 من إجمالي 76 محاضرة في المرحلة الأولى.
              </div>
            </div>
          ` : ''}

          <!-- EXERCISES TAB -->
          ${levelSubTab === 'exercises' ? `
            <div style="text-align:center; padding:28px 16px;">
              <div style="font-size:2rem; margin-bottom:10px;">📝</div>
              <h4 style="margin:0 0 6px; font-size:1.15rem; font-weight:700;">الاختبار النهائي للمرحلة الأولى</h4>
              <p style="margin:0 auto 18px; max-width:480px; font-size:0.85rem; color:var(--text-muted);">
                يتضمن الاختبار أسئلة اختيار من متعدد، وأسئلة إكمال الفراغ، وأسئلة مقالية تصحح يدويًا من المشرفين.
              </p>
              <button type="button" class="save-btn" id="gotoExamTabBtn" style="background:var(--emerald-dark); color:#fff; border-radius:8px; padding:10px 24px; font-weight:700;">
                الانتقال إلى منصة الاختبارات &rarr;
              </button>
            </div>
          ` : ''}

          <!-- QUESTIONS TAB -->
          ${levelSubTab === 'questions' ? `
            <div style="padding:16px;">
              <h4 style="margin:0 0 10px; font-size:1.05rem; font-weight:700;">المناقشات العلمية والفوائد المستنبطة</h4>
              <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.6;">
                يمكن للطلاب طرح الأسئلة الفقهية والتاريخية المباشرة داخل كل درس ليجيب عنها المشرف العلمي المختص وتظهر في لوحة النقاش.
              </p>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- TAB CONTENT: CERTIFICATE -->
      ${activeSubTab === 'certificate' ? `
        <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:18px; padding:28px; text-align:center;">
          <div style="font-size:2.8rem; margin-bottom:10px;">🎓</div>
          <h3 style="margin:0 0 8px; font-size:1.35rem; font-weight:700;">الشهادة المعتمدة لإتمام المرحلة</h3>
          <p style="margin:0 auto 18px; max-width:520px; font-size:0.85rem; color:var(--text-muted); line-height:1.6;">
            تصدر الشهادة الرسمية برقم تحقق معتمد ورمز استجابة سريعة (QR Code) بعد إتمام جميع المحاضرات واجتياز الاختبار بنجاح.
          </p>
          <button type="button" class="save-btn" id="gotoCertsBtn" style="background:var(--emerald-dark); color:#fff; border-radius:8px; padding:10px 24px; font-weight:700;">
            عرض الشهادات والتحقق &rarr;
          </button>
        </div>
      ` : ''}

      <!-- TAB CONTENT: NOTES -->
      ${activeSubTab === 'notes' ? `
        <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:18px; padding:22px;">
          <h4 style="margin:0 0 12px; font-size:1.15rem; font-weight:700;">توجيهات منهجية في دراسة السيرة</h4>
          <ul style="padding-right:20px; font-size:0.9rem; line-height:1.8; color:var(--text-dark);">
            <li>استحضار النية الصالحة في مدارسة سيرة الحبيب المصطفى ﷺ للاقتداء والاتباع.</li>
            <li>تدوين الفوائد والاستنباطات في خانة الملاحظات المخصصة لكل درس أولاً بأول.</li>
            <li>الاستعانة بالله ومراجعة المتون والشمائل المحمدية قبل خوض الاختبار التقييمي.</li>
          </ul>
        </div>
      ` : ''}
    </div>
  `;

  // Sub-tabs switching
  container.querySelectorAll('.prog-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.tab;
      renderLmsPrograms(container, onNavigate);
    });
  });

  container.querySelectorAll('.level-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      levelSubTab = btn.dataset.tab;
      renderLmsPrograms(container, onNavigate);
    });
  });

  // Lesson list item click -> open Classroom
  container.querySelectorAll('.lesson-list-item').forEach(item => {
    item.addEventListener('click', () => {
      if (onNavigate) onNavigate('classroom', item.dataset.id);
    });
  });

  // Action buttons
  document.getElementById('startFirstLessonBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('classroom', 'les_01');
  });

  document.getElementById('gotoExamTabBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('exams');
  });

  document.getElementById('gotoCertsBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('certificates');
  });
}
