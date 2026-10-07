// Interactive Lesson Classroom & Multimedia Player (PRD LMS Overhaul)
// Matches Madrasat al-Arqam Screenshots 090052, 090109, 090119, 090123

import {
  getAllLessons,
  getLessonById,
  isLessonCompleted,
  toggleLessonCompletion,
  getProgressStats,
  getLessonNotes,
  saveLessonNotes,
  getLessonDiscussions,
  addLessonDiscussion
} from './curriculum.js';
import { getCurrentUser } from './auth.js';
import { escapeHtml, escapeAttr } from './ui.js';

let activeMediaMode = 'video'; // 'video' | 'audio'
let activeContentTab = 'about'; // 'about' | 'notes' | 'qa'
let drawerOpen = false;

export function renderClassroom(container, lessonId, onNavigate) {
  const lesson = getLessonById(lessonId);
  const allLessons = getAllLessons();
  const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const stats = getProgressStats();
  const isDone = isLessonCompleted(lesson.id);
  const notes = getLessonNotes(lesson.id);
  const discussions = getLessonDiscussions(lesson.id);
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="lms-classroom-wrap" dir="rtl" style="max-width:880px; margin:0 auto; padding-bottom:90px;">
      
      <!-- Top Navigation Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding:0 4px;">
        <button type="button" class="ghost-btn sm" id="classroomBackBtn" style="display:inline-flex; align-items:center; gap:8px; font-weight:700; color:var(--text-dark); border-radius:8px;">
          <span>&rarr;</span>
          <span>المرحلة الأولى</span>
        </button>
        <div style="text-align:left; font-size:0.82rem; color:var(--text-muted); font-weight:600;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${stats.percentage}%</span>
            <div style="width:70px; height:8px; background:var(--border-color); border-radius:4px; overflow:hidden;">
              <div style="width:${stats.percentage}%; height:100%; background:#292524;"></div>
            </div>
          </div>
          <div style="font-size:0.75rem; margin-top:2px;">${stats.completed}/${stats.total} دروس</div>
        </div>
      </div>

      <!-- Media Mode Segmented Control (الدرس مرئي / الدرس صوتي) -->
      <div style="display:flex; border-bottom:1.5px solid var(--border-color); margin-bottom:14px;">
        <button type="button" class="classroom-mode-tab" data-mode="video" style="flex:1; padding:12px; border:none; background:none; font-weight:700; font-size:0.95rem; cursor:pointer; text-align:center; transition:all 0.2s; border-bottom:3px solid ${activeMediaMode === 'video' ? '#292524' : 'transparent'}; color:${activeMediaMode === 'video' ? '#292524' : 'var(--text-muted)'};">
          الدرس مرئي
        </button>
        <button type="button" class="classroom-mode-tab" data-mode="audio" style="flex:1; padding:12px; border:none; background:none; font-weight:700; font-size:0.95rem; cursor:pointer; text-align:center; transition:all 0.2s; border-bottom:3px solid ${activeMediaMode === 'audio' ? '#292524' : 'transparent'}; color:${activeMediaMode === 'audio' ? '#292524' : 'var(--text-muted)'};">
          الدرس صوتي
        </button>
      </div>

      <!-- MEDIA PLAYER VIEWPORT -->
      <div class="player-viewport" style="background:#000; border-radius:12px; overflow:hidden; margin-bottom:18px; box-shadow:0 8px 24px rgba(0,0,0,0.12);">
        ${activeMediaMode === 'video' ? `
          <div style="position:relative; width:100%; aspect-ratio:16/9; background:#0a0a0a; display:flex; align-items:center; justify-content:center;">
            ${lesson.video_url ? `
              <video id="classroomVideoPlayer" controls style="width:100%; height:100%; object-fit:contain;" poster="${escapeAttr(PROGRAM_INFO.banner_image)}">
                <source src="${escapeAttr(lesson.video_url)}" type="video/mp4">
                متصفحك لا يدعم تشغيل الفيديو.
              </video>
            ` : `
              <div style="text-align:center; color:#e5e7eb; padding:20px;">
                <div style="font-size:2.5rem; margin-bottom:10px;">📖</div>
                <div style="font-weight:700; font-size:1.1rem; margin-bottom:6px;">مادة قراءة وتأصيل علمي</div>
                <div style="font-size:0.85rem; color:#9ca3af;">${escapeHtml(lesson.pdf_pages || 'الشمائل المحمدية')}</div>
              </div>
            `}
          </div>
        ` : `
          <!-- AUDIO PODCAST PLAYER -->
          <div style="padding:28px 20px; background:#1c1917; color:#fff; text-align:center;">
            <div style="width:60px; height:60px; border-radius:50%; background:rgba(255,255,255,0.1); margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:1.8rem;">
              🎙️
            </div>
            <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">${escapeHtml(lesson.title)}</div>
            <div style="font-size:0.8rem; color:#a8a29e; margin-bottom:16px;">الشيخ: ${escapeHtml(lesson.instructor)}</div>
            
            <audio id="classroomAudioPlayer" controls style="width:100%; max-width:540px; margin:0 auto;">
              <source src="${escapeAttr(lesson.audio_url)}" type="audio/mpeg">
              متصفحك لا يدعم تشغيل الصوت.
            </audio>

            <div style="display:flex; justify-content:center; align-items:center; gap:16px; margin-top:14px; font-size:0.82rem;">
              <button type="button" class="ghost-btn sm" id="audioBack15Btn" style="color:#fff; border-color:rgba(255,255,255,0.2);">
                -15 ثانية
              </button>
              <select id="audioSpeedSelect" style="background:#292524; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px 8px; border-radius:6px; font-size:0.8rem;">
                <option value="1">1.0x سرعة عادية</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
              <button type="button" class="ghost-btn sm" id="audioFwd15Btn" style="color:#fff; border-color:rgba(255,255,255,0.2);">
                +15 ثانية
              </button>
            </div>
          </div>
        `}
      </div>

      <!-- LESSON TITLE & PREV/NEXT NAVIGATOR -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:12px 16px; margin-bottom:18px;">
        <button type="button" class="ghost-btn sm" id="prevLessonBtn" ${!prevLesson ? 'disabled' : ''} style="display:flex; align-items:center; gap:6px;">
          <span>&larr;</span>
          <span>السابق</span>
        </button>
        <div style="font-weight:700; font-size:1.05rem; color:var(--text-dark); text-align:center; padding:0 8px;">
          ${escapeHtml(lesson.title)}
        </div>
        <button type="button" class="ghost-btn sm" id="nextLessonBtn" ${!nextLesson ? 'disabled' : ''} style="display:flex; align-items:center; gap:6px;">
          <span>التالي</span>
          <span>&rarr;</span>
        </button>
      </div>

      <!-- CONTENT SUB-TABS: عن الدرس / ملاحظاتي / أسئلة الدرس -->
      <div style="display:flex; gap:8px; margin-bottom:14px; overflow-x:auto;">
        <button type="button" class="classroom-content-tab ${activeContentTab === 'about' ? 'active' : ''}" data-tab="about" style="padding:8px 16px; border:1px solid var(--border-color); border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer; ${activeContentTab === 'about' ? 'background:#292524; color:#fff; border-color:#292524;' : 'background:var(--card-bg); color:var(--text-muted);'}">
          عن الدرس
        </button>
        <button type="button" class="classroom-content-tab ${activeContentTab === 'notes' ? 'active' : ''}" data-tab="notes" style="padding:8px 16px; border:1px solid var(--border-color); border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer; ${activeContentTab === 'notes' ? 'background:#292524; color:#fff; border-color:#292524;' : 'background:var(--card-bg); color:var(--text-muted);'}">
          ملاحظاتي
        </button>
        <button type="button" class="classroom-content-tab ${activeContentTab === 'qa' ? 'active' : ''}" data-tab="qa" style="padding:8px 16px; border:1px solid var(--border-color); border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer; ${activeContentTab === 'qa' ? 'background:#292524; color:#fff; border-color:#292524;' : 'background:var(--card-bg); color:var(--text-muted);'}">
          أسئلة الدرس (${discussions.length})
        </button>
      </div>

      <!-- SUB-TAB CONTENT PANELS -->
      <div class="content-panel" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:20px; margin-bottom:20px;">
        ${activeContentTab === 'about' ? `
          <div>
            <h4 style="font-family:'Amiri', serif; font-size:1.4rem; color:var(--emerald-dark); margin:0 0 8px; font-weight:700;">
              ${escapeHtml(lesson.title)}
            </h4>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:14px;">
              المحاضر: <b>${escapeHtml(lesson.instructor)}</b> • المدة: <b>${escapeHtml(lesson.duration)}</b>
            </div>
            <div style="font-family:'Amiri', serif; font-size:1.05rem; line-height:1.8; color:var(--text-dark); white-space:pre-wrap;">
              ${escapeHtml(lesson.description)}
            </div>
          </div>
        ` : ''}

        ${activeContentTab === 'notes' ? `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h4 style="margin:0; font-size:1rem; font-weight:700;">مفكرتي الخاصة</h4>
              <span id="notesSaveStatus" style="font-size:0.75rem; color:var(--emerald-dark); font-weight:600;">✓ يتم الحفظ تلقائيًا</span>
            </div>
            <textarea id="lessonNotesArea" placeholder="دوّن هنا فوائد الدرس وملاحظاتك واستنباطاتك..." style="width:100%; min-height:150px; padding:12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.95rem; font-family:'Amiri', serif; line-height:1.6; box-sizing:border-box;">${escapeHtml(notes)}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span style="font-size:0.75rem; color:var(--text-muted);">الملاحظات سرية وخاصة بحسابك فقط.</span>
              <button type="button" class="ghost-btn sm" id="downloadNotesBtn">تنزيل كملف نصي</button>
            </div>
          </div>
        ` : ''}

        ${activeContentTab === 'qa' ? `
          <div>
            <h4 style="margin:0 0 12px; font-size:1rem; font-weight:700;">أسئلة الطلاب والمناقشات العلمية</h4>
            <div style="display:flex; gap:8px; margin-bottom:16px;">
              <input type="text" id="newQuestionInput" placeholder="اطرح سؤالك أو استفسارك حول هذا الدرس..." style="flex:1; padding:9px 12px; border:1.5px solid var(--border-color); border-radius:8px; font-size:0.9rem;">
              <button type="button" id="submitQuestionBtn" class="save-btn sm" style="white-space:nowrap; background:#292524;">إرسال السؤال</button>
            </div>
            <div class="questions-list">
              ${discussions.map(d => `
                <div style="border-bottom:1px solid var(--border-color); padding:10px 0;">
                  <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
                    <b>${escapeHtml(d.author)}</b>
                    <span>${escapeHtml(d.date)}</span>
                  </div>
                  <div style="font-weight:600; font-size:0.92rem; color:var(--text-dark); margin-bottom:6px;">
                    ${escapeHtml(d.question)}
                  </div>
                  ${d.answer ? `
                    <div style="background:rgba(6,95,70,0.06); border-right:3px solid var(--emerald-dark); padding:8px 12px; border-radius:4px; font-size:0.88rem; color:var(--emerald-dark);">
                      <div style="font-size:0.75rem; font-weight:700; margin-bottom:2px;">إجابة ${escapeHtml(d.answer_by || 'المشرف')}:</div>
                      <div style="font-family:'Amiri', serif;">${escapeHtml(d.answer)}</div>
                    </div>
                  ` : `
                    <div style="font-size:0.75rem; color:#b45309; font-style:italic;">قيد المراجعة من الشيخ...</div>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- BOTTOM FLOATING ACTION BAR -->
      <div class="classroom-bottom-bar" style="position:fixed; bottom:0; left:0; right:0; z-index:40; background:rgba(255,255,255,0.92); backdrop-filter:blur(8px); border-top:1.5px solid var(--border-color); padding:12px 18px; display:flex; justify-content:space-between; align-items:center; max-width:880px; margin:0 auto; box-sizing:border-box;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:0.95rem; color:${isDone ? 'var(--emerald-dark)' : 'var(--text-dark)'};">
          <input type="checkbox" id="markCompletedCheck" ${isDone ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--emerald-dark); cursor:pointer;">
          <span>أتممتُ المحاضرة</span>
        </label>
        
        <button type="button" class="save-btn" id="openLessonDrawerBtn" style="display:inline-flex; align-items:center; gap:8px; background:#292524; color:#fff; border-radius:8px; font-weight:700; padding:9px 16px;">
          <span>☰</span>
          <span>قائمة الدروس (${allLessons.length})</span>
        </button>
      </div>

      <!-- SLIDING LESSON PLAYLIST DRAWER (Screenshots 090119 & 090123) -->
      <div id="lessonPlaylistDrawer" class="modal-overlay" style="display:${drawerOpen ? 'flex' : 'none'}; align-items:flex-end; justify-content:center; background:rgba(0,0,0,0.5);">
        <div style="background:#fff; width:100%; max-width:720px; max-height:85vh; border-radius:24px 24px 0 0; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 -10px 40px rgba(0,0,0,0.2);">
          
          <!-- Drawer Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1.5px solid var(--border-color);">
            <button type="button" id="closeDrawerBtn" style="border:none; background:none; font-size:1.6rem; cursor:pointer; color:var(--text-muted);">&times;</button>
            <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-dark);">قائمة الدروس</h3>
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${stats.completed}/${stats.total} مكتمل</span>
          </div>

          <!-- Drawer Lessons List -->
          <div style="overflow-y:auto; padding:10px 16px; flex:1;">
            ${allLessons.map(l => {
              const completed = isLessonCompleted(l.id);
              const isActive = l.id === lesson.id;
              return `
                <div class="drawer-lesson-row" data-id="${escapeAttr(l.id)}" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:10px; margin-bottom:6px; cursor:pointer; transition:all 0.15s; border-bottom:1px solid var(--border-color); ${isActive ? 'background:rgba(41,37,36,0.06); font-weight:700;' : 'background:#fff;'}">
                  <span style="width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; ${completed ? 'background:#059669; color:#fff;' : 'background:var(--bg-warm); color:var(--text-muted);'}">
                    ${completed ? '✓' : ''}
                  </span>
                  <div style="font-size:0.75rem; color:var(--text-muted); min-width:85px;">${escapeHtml(l.date)}</div>
                  <div style="flex:1; font-size:0.9rem; color:var(--text-dark);">${escapeHtml(l.title)}</div>
                  <span style="font-size:0.85rem;">${l.type === 'reading' ? '📄' : (isActive ? '⏸️' : '▶️')}</span>
                  <span style="font-size:0.82rem; font-family:monospace; color:var(--text-muted);">${l.num}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire events
  document.getElementById('classroomBackBtn')?.addEventListener('click', () => {
    if (onNavigate) onNavigate('programs');
  });

  // Media tabs
  container.querySelectorAll('.classroom-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMediaMode = btn.dataset.mode;
      renderClassroom(container, lessonId, onNavigate);
    });
  });

  // Content tabs
  container.querySelectorAll('.classroom-content-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeContentTab = btn.dataset.tab;
      renderClassroom(container, lessonId, onNavigate);
    });
  });

  // Prev / Next
  document.getElementById('prevLessonBtn')?.addEventListener('click', () => {
    if (prevLesson) renderClassroom(container, prevLesson.id, onNavigate);
  });
  document.getElementById('nextLessonBtn')?.addEventListener('click', () => {
    if (nextLesson) renderClassroom(container, nextLesson.id, onNavigate);
  });

  // Audio 15s skip and speed
  const audio = document.getElementById('classroomAudioPlayer');
  if (audio) {
    document.getElementById('audioBack15Btn')?.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    document.getElementById('audioFwd15Btn')?.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + 15); });
    document.getElementById('audioSpeedSelect')?.addEventListener('change', (e) => { audio.playbackRate = parseFloat(e.target.value); });
  }

  // Notes autosave
  const notesArea = document.getElementById('lessonNotesArea');
  if (notesArea) {
    notesArea.addEventListener('input', () => {
      saveLessonNotes(lesson.id, notesArea.value);
    });
    document.getElementById('downloadNotesBtn')?.addEventListener('click', () => {
      const blob = new Blob([`ملاحظات درس: ${lesson.title}\nالمحاضر: ${lesson.instructor}\nالتاريخ: ${new Date().toLocaleDateString('ar-SA')}\n\n${notesArea.value}`], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `notes_${lesson.id}.txt`;
      a.click();
    });
  }

  // Q&A submission
  document.getElementById('submitQuestionBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('newQuestionInput');
    if (!inp || !inp.value.trim()) return;
    addLessonDiscussion(lesson.id, inp.value.trim(), user ? (user.name_ar || user.name) : 'طالب');
    renderClassroom(container, lessonId, onNavigate);
  });

  // Mark Completed checkbox
  document.getElementById('markCompletedCheck')?.addEventListener('change', (e) => {
    toggleLessonCompletion(lesson.id);
    renderClassroom(container, lessonId, onNavigate);
  });

  // Drawer open / close
  document.getElementById('openLessonDrawerBtn')?.addEventListener('click', () => {
    drawerOpen = true;
    const drawer = document.getElementById('lessonPlaylistDrawer');
    if (drawer) drawer.style.display = 'flex';
  });
  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
    drawerOpen = false;
    const drawer = document.getElementById('lessonPlaylistDrawer');
    if (drawer) drawer.style.display = 'none';
  });

  // Drawer lesson row click
  container.querySelectorAll('.drawer-lesson-row').forEach(row => {
    row.addEventListener('click', () => {
      drawerOpen = false;
      renderClassroom(container, row.dataset.id, onNavigate);
    });
  });
}
