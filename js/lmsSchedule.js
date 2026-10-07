// Study Dashboard & Academic Schedule (PRD LMS Overhaul)
// Matches Madrasat al-Arqam Screenshots 085820 & 085843

import { getAllLessons, getLessonById, isLessonCompleted, getRecentLesson } from './curriculum.js';
import { escapeHtml } from './ui.js';

let activeCalendarView = 'week'; // 'week' | 'month'
let selectedDay = 15; // default 15 September as in screenshot

export function renderLmsSchedule(container, onNavigate) {
  const allLessons = getAllLessons();
  const recent = getRecentLesson();
  
  // Week days matching Screenshot 085820
  const weekDays = [
    { dayName: 'السبت', date: 12, month: 'سبتمبر' },
    { dayName: 'الأحد', date: 13, month: 'سبتمبر' },
    { dayName: 'الاثنين', date: 14, month: 'سبتمبر' },
    { dayName: 'الثلاثاء', date: 15, month: 'سبتمبر' },
    { dayName: 'الأربعاء', date: 16, month: 'سبتمبر' },
    { dayName: 'الخميس', date: 17, month: 'سبتمبر' },
    { dayName: 'الجمعة', date: 18, month: 'سبتمبر' },
  ];

  // Selected day's lecture
  const dayLesson = allLessons[(selectedDay % allLessons.length)] || allLessons[2];
  const isDone = isLessonCompleted(dayLesson.id);

  container.innerHTML = `
    <div class="lms-schedule-wrap" dir="rtl" style="max-width:880px; margin:0 auto; padding-bottom:40px;">
      
      <!-- Top Title -->
      <div style="margin-bottom:20px;">
        <h2 style="font-family:'Amiri', serif; font-size:2rem; font-weight:700; color:var(--text-dark); margin:0 0 4px;">لوحتي التعليمية</h2>
        <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">تابع جدول المحاضرات الأسبوعي، ومواعيد الاستماع والمدارسة</p>
      </div>

      <!-- MAIN CALENDAR CONTAINER CARD -->
      <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:16px; padding:22px 20px; margin-bottom:24px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        
        <!-- Toggle: أسبوع / شهر -->
        <div style="display:flex; justify-content:flex-end; margin-bottom:18px;">
          <div style="display:inline-flex; background:var(--bg-warm); border:1px solid var(--border-color); border-radius:30px; padding:3px;">
            <button type="button" class="cal-toggle-btn ${activeCalendarView === 'week' ? 'active' : ''}" data-view="week" style="border:none; border-radius:24px; padding:6px 20px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; ${activeCalendarView === 'week' ? 'background:#292524; color:#fff;' : 'background:transparent; color:var(--text-muted);'}">
              أسبوع
            </button>
            <button type="button" class="cal-toggle-btn ${activeCalendarView === 'month' ? 'active' : ''}" data-view="month" style="border:none; border-radius:24px; padding:6px 20px; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.2s; ${activeCalendarView === 'month' ? 'background:#292524; color:#fff;' : 'background:transparent; color:var(--text-muted);'}">
              شهر
            </button>
          </div>
        </div>

        <!-- Month Navigation Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:0 8px;">
          <button type="button" class="ghost-btn sm" id="prevPeriodBtn" style="border-radius:50%; width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; font-weight:700;">
            &rarr;
          </button>
          <div style="font-weight:700; font-size:1.15rem; color:var(--text-dark);">
            ${activeCalendarView === 'week' ? 'سبتمبر (12–18) 2026' : 'سبتمبر 2026'}
          </div>
          <button type="button" class="ghost-btn sm" id="nextPeriodBtn" style="border-radius:50%; width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; font-weight:700;">
            &larr;
          </button>
        </div>

        <!-- WEEK VIEW: Horizontal 7-Day Carousel -->
        ${activeCalendarView === 'week' ? `
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; text-align:center; margin-bottom:8px;">
            ${weekDays.map(d => {
              const isSelected = d.date === selectedDay;
              const hasActivity = d.date <= 15;
              return `
                <div class="day-col" data-date="${d.date}" style="cursor:pointer;">
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">${d.dayName}</div>
                  <div style="width:38px; height:38px; margin:0 auto; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem; transition:all 0.15s; ${
                    isSelected 
                      ? 'background:#292524; color:#fff; box-shadow:0 3px 8px rgba(0,0,0,0.25);' 
                      : (hasActivity 
                          ? 'border:2px solid #b45309; color:#b45309; background:#fff;' 
                          : 'border:1.5px solid var(--border-color); color:var(--text-dark); background:#fff;')
                  }">
                    ${d.date}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- MONTH VIEW: Full 30-Day Grid (Screenshot 085843) -->
          <div>
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">
              <span>السبت</span><span>الأحد</span><span>الاثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; text-align:center;">
              ${Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                const isSelected = day === selectedDay;
                const hasActivity = day <= 15;
                return `
                  <div class="day-col" data-date="${day}" style="width:36px; height:36px; margin:0 auto; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem; cursor:pointer; transition:all 0.15s; ${
                    isSelected 
                      ? 'background:#292524; color:#fff;' 
                      : (hasActivity 
                          ? 'border:1.5px solid #dc2626; color:#dc2626;' 
                          : 'border:1px solid var(--border-color); color:var(--text-dark);')
                  }">
                    ${day}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `}
      </div>

      <!-- TODAY'S SCHEDULE CARD (جدول اليوم) -->
      <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:16px; padding:20px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
          <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-dark);">جدول اليوم</h3>
          <span style="font-size:0.8rem; color:var(--text-muted);">الثلاثاء، ${selectedDay} سبتمبر 2026</span>
        </div>

        <!-- Schedule Item (Click opens Classroom) -->
        <div id="scheduleLectureCard" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-warm); border:1px solid var(--border-color); border-radius:12px; padding:16px; cursor:pointer; transition:border-color 0.2s;">
          <div style="flex:1;">
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
              المرحلة الأولى • ${escapeHtml(dayLesson.type.toUpperCase())}
            </div>
            <h4 style="margin:0 0 6px; font-size:1.05rem; font-weight:700; color:var(--emerald-dark);">
              ${escapeHtml(dayLesson.title)}
            </h4>
            <div style="font-size:0.78rem; color:var(--text-muted);">
              المحاضر: ${escapeHtml(dayLesson.instructor)} • المدة: ${dayLesson.duration}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; margin-right:12px;">
            <span style="width:12px; height:12px; border-radius:50%; background:${isDone ? '#059669' : '#6b7280'};"></span>
            <span style="font-size:1.2rem; color:var(--text-muted);">&larr;</span>
          </div>
        </div>
      </div>

      <!-- CONTINUE WATCHING SECTION (تابع المشاهدة) -->
      <div style="background:var(--card-bg); border:1.5px solid var(--border-color); border-radius:16px; padding:20px;">
        <h3 style="margin:0 0 12px; font-size:1.15rem; font-weight:700; color:var(--text-dark);">تابع المشاهدة</h3>
        
        <div id="continueWatchingCard" style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid var(--border-color); border-radius:12px; padding:14px; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:48px; height:48px; border-radius:8px; background:#292524; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
              ▶
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:2px;">الدرس الحالي المستأنف</div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-dark);">${escapeHtml(recent.title)}</div>
              <div style="font-size:0.75rem; color:var(--emerald-dark); margin-top:2px;">المحاضرة ${recent.num} من 76</div>
            </div>
          </div>
          <button type="button" class="save-btn sm" style="background:#292524; color:#fff; border-radius:6px; white-space:nowrap;">
            متابعة &larr;
          </button>
        </div>
      </div>
    </div>
  `;

  // Segmented control toggling
  container.querySelectorAll('.cal-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCalendarView = btn.dataset.view;
      renderLmsSchedule(container, onNavigate);
    });
  });

  // Day selection in carousel or grid
  container.querySelectorAll('.day-col').forEach(col => {
    col.addEventListener('click', () => {
      selectedDay = parseInt(col.dataset.date, 10);
      renderLmsSchedule(container, onNavigate);
    });
  });

  // Open Classroom on click
  document.getElementById('scheduleLectureCard')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('classroom', dayLesson.id);
  });
  document.getElementById('continueWatchingCard')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('classroom', recent.id);
  });
}
