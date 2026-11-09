/**
 * app.js - ระบบเวียนตรวจ รปภ. มรย. (Security Patrol System)
 * มหาวิทยาลัยราชภัฏยะลา (Yala Rajabhat University)
 * เวอร์ชัน 2.1: รองรับ รปภ. 9 นาย + ระบบพื้นที่เสี่ยง + แจ้งเหตุนอกจุดตรวจ
 */

(function () {
  'use strict';

  // --- STATE ---
  let state = {
    guards: [],
    checkpoints: [],
    history: [],
    currentShift: 'morning',
    currentRound: 'รอบที่ 1',
    currentGuardId: '',
    cpRiskFilter: 'all', // 'all' | 'risk'
    roundChecks: {}, // { [cpId]: record }
    activeCpForInspection: null,
    selectedInspectionStatus: 'ok',
    attachedPhotos: [],
    offCpAttachedPhotos: [],
    speechRecognition: null,
    isRecordingVoice: false,
    activeMicTarget: 'sheet' // 'sheet' | 'offCp'
  };

  // --- DOM ELEMENTS ---
  const el = {
    appClock: document.getElementById('appClock'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    themeToggle: document.getElementById('themeToggle'),
    
    // Tabs
    tabButtons: document.querySelectorAll('.tabs button'),
    panels: {
      guard: document.getElementById('panelGuard'),
      supervisor: document.getElementById('panelSupervisor'),
      checkpoints: document.getElementById('panelCheckpoints')
    },

    // Guard panel
    guardSelect: document.getElementById('guardSelect'),
    roundSelect: document.getElementById('roundSelect'),
    shiftSegment: document.getElementById('shiftSegment'),
    progressTag: document.getElementById('progressTag'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressPercent: document.getElementById('progressPercent'),
    checkpointList: document.getElementById('checkpointList'),
    resetRoundBtn: document.getElementById('resetRoundBtn'),
    filterAllCpBtn: document.getElementById('filterAllCpBtn'),
    filterRiskCpBtn: document.getElementById('filterRiskCpBtn'),
    openOffCpBtn: document.getElementById('openOffCpBtn'),

    // Inspection Sheet (ปกติ / จุดตรวจ)
    inspectionVeil: document.getElementById('inspectionVeil'),
    sheetTitle: document.getElementById('sheetTitle'),
    sheetSubtitle: document.getElementById('sheetSubtitle'),
    sheetCloseBtn: document.getElementById('sheetCloseBtn'),
    sheetStampTime: document.getElementById('sheetStampTime'),
    sheetStampDate: document.getElementById('sheetStampDate'),
    sheetGuardTag: document.getElementById('sheetGuardTag'),
    statusOkBtn: document.getElementById('statusOkBtn'),
    statusAlertBtn: document.getElementById('statusAlertBtn'),
    sheetNote: document.getElementById('sheetNote'),
    micBtn: document.getElementById('micBtn'),
    photoInput: document.getElementById('photoInput'),
    takePhotoBtn: document.getElementById('takePhotoBtn'),
    photoThumbs: document.getElementById('photoThumbs'),
    saveInspectionBtn: document.getElementById('saveInspectionBtn'),
    cancelInspectionBtn: document.getElementById('cancelInspectionBtn'),

    // Off-Checkpoint Incident Sheet (พบเหตุนอกจุดตรวจ)
    offCpVeil: document.getElementById('offCpVeil'),
    offCpCloseBtn: document.getElementById('offCpCloseBtn'),
    offCpStampTime: document.getElementById('offCpStampTime'),
    offCpStampDate: document.getElementById('offCpStampDate'),
    offCpGuardTag: document.getElementById('offCpGuardTag'),
    offCpLocation: document.getElementById('offCpLocation'),
    offCpType: document.getElementById('offCpType'),
    offCpUrgency: document.getElementById('offCpUrgency'),
    offCpNote: document.getElementById('offCpNote'),
    offCpMicBtn: document.getElementById('offCpMicBtn'),
    offCpPhotoInput: document.getElementById('offCpPhotoInput'),
    offCpTakePhotoBtn: document.getElementById('offCpTakePhotoBtn'),
    offCpPhotoThumbs: document.getElementById('offCpPhotoThumbs'),
    saveOffCpBtn: document.getElementById('saveOffCpBtn'),
    cancelOffCpBtn: document.getElementById('cancelOffCpBtn'),

    // Supervisor panel
    statTotal: document.getElementById('statTotal'),
    statOk: document.getElementById('statOk'),
    statAlert: document.getElementById('statAlert'),
    statActiveCp: document.getElementById('statActiveCp'),
    filterDate: document.getElementById('filterDate'),
    filterShift: document.getElementById('filterShift'),
    filterStatus: document.getElementById('filterStatus'),
    filterSearch: document.getElementById('filterSearch'),
    reportTableBody: document.getElementById('reportTableBody'),
    logCountTag: document.getElementById('logCountTag'),
    incidentList: document.getElementById('incidentList'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),

    // Checkpoint Manager panel
    addCheckpointForm: document.getElementById('addCheckpointForm'),
    newCpCode: document.getElementById('newCpCode'),
    newCpZone: document.getElementById('newCpZone'),
    newCpName: document.getElementById('newCpName'),
    newCpDesc: document.getElementById('newCpDesc'),
    newCpIsRisk: document.getElementById('newCpIsRisk'),
    checkpointEditorList: document.getElementById('checkpointEditorList'),
    resetCheckpointsBtn: document.getElementById('resetCheckpointsBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMsg: document.getElementById('toastMsg')
  };

  // --- INITIALIZATION ---
  function init() {
    loadFromLocalStorage();
    setupClock();
    setupTheme();
    setupSpeechRecognition();
    bindEvents();
    renderGuardSelect();
    renderCheckpoints();
    updateProgress();
    renderSupervisorDashboard();
    renderCheckpointEditor();

    // Check URL Hash for initial tab
    const hash = window.location.hash.replace('#', '');
    if (['guard', 'supervisor', 'checkpoints'].includes(hash)) {
      switchTab(hash);
    }

    // Auto open checkpoint inspection if requested in URL
    const urlParams = new URLSearchParams(window.location.search);
    const openCp = urlParams.get('open');
    if (openCp === 'off') {
      setTimeout(() => openOffCheckpointModal(), 200);
    } else if (openCp) {
      setTimeout(() => window.appOpenInspection(openCp), 200);
    }
  }

  // --- STORAGE ---
  function loadFromLocalStorage() {
    try {
      const storedVersion = localStorage.getItem('yru_sp_version');
      if (storedVersion !== DATA_VERSION) {
        // อัปเดตข้อมูลรุ่นใหม่ (รายชื่อ รปภ. 9 นาย + จุดตรวจพื้นที่เสี่ยง)
        state.guards = DEFAULT_GUARDS;
        state.checkpoints = DEFAULT_CHECKPOINTS;
        state.history = DEFAULT_HISTORY;
        state.roundChecks = {};
        localStorage.setItem('yru_sp_version', DATA_VERSION);
        saveToLocalStorage();
      } else {
        const g = localStorage.getItem('yru_sp_guards');
        state.guards = g ? JSON.parse(g) : DEFAULT_GUARDS;

        const cp = localStorage.getItem('yru_sp_checkpoints');
        state.checkpoints = cp ? JSON.parse(cp) : DEFAULT_CHECKPOINTS;

        const h = localStorage.getItem('yru_sp_history');
        state.history = h ? JSON.parse(h) : DEFAULT_HISTORY;

        const rc = localStorage.getItem('yru_sp_round_checks');
        state.roundChecks = rc ? JSON.parse(rc) : {};
      }

      state.currentGuardId = state.guards[0]?.id || '';
    } catch (err) {
      console.warn('Storage read error, using defaults:', err);
      state.guards = DEFAULT_GUARDS;
      state.checkpoints = DEFAULT_CHECKPOINTS;
      state.history = DEFAULT_HISTORY;
      state.roundChecks = {};
      state.currentGuardId = DEFAULT_GUARDS[0]?.id || '';
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem('yru_sp_version', DATA_VERSION);
      localStorage.setItem('yru_sp_guards', JSON.stringify(state.guards));
      localStorage.setItem('yru_sp_checkpoints', JSON.stringify(state.checkpoints));
      localStorage.setItem('yru_sp_history', JSON.stringify(state.history));
      localStorage.setItem('yru_sp_round_checks', JSON.stringify(state.roundChecks));
    } catch (err) {
      console.warn('Storage save failed:', err);
    }
  }

  // --- CLOCK & DATE ---
  function setupClock() {
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    function tick() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      el.clockTime.textContent = `${h}:${m}:${s} น.`;

      const dayName = thaiDays[now.getDay()];
      const d = now.getDate();
      const mon = thaiMonths[now.getMonth()];
      const y = now.getFullYear() + 543;
      el.clockDate.textContent = `วัน${dayName}ที่ ${d} ${mon} ${y}`;
    }

    tick();
    setInterval(tick, 1000);
  }

  // --- THEME ---
  function setupTheme() {
    const saved = localStorage.getItem('yru_sp_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      el.themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      el.themeToggle.textContent = prefersDark ? '☀️' : '🌙';
    }

    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('yru_sp_theme', next);
      el.themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
      showToast(`เปลี่ยนเป็นโหมด ${next === 'dark' ? 'มืด' : 'สว่าง'}`);
    });
  }

  // --- SPEECH RECOGNITION ---
  function setupSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = 'th-TH';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        state.isRecordingVoice = true;
        if (state.activeMicTarget === 'sheet') {
          el.micBtn.classList.add('on');
        } else {
          el.offCpMicBtn.classList.add('on');
        }
        showToast('🎙️ กำลังฟังเสียงพูดภาษาไทย...');
      };

      rec.onresult = (evt) => {
        const transcript = evt.results[0][0].transcript;
        const targetTextarea = state.activeMicTarget === 'sheet' ? el.sheetNote : el.offCpNote;
        if (targetTextarea.value.trim()) {
          targetTextarea.value += ' ' + transcript;
        } else {
          targetTextarea.value = transcript;
        }
        showToast('✓ แปลงเสียงเป็นข้อความแล้ว');
      };

      rec.onerror = (evt) => {
        console.warn('Speech recognition error:', evt.error);
        showToast('⚠️ ไม่สามารถแปลงเสียงได้: ' + (evt.error || 'กรุณาลองใหม่'));
      };

      rec.onend = () => {
        state.isRecordingVoice = false;
        el.micBtn.classList.remove('on');
        el.offCpMicBtn.classList.remove('on');
      };

      state.speechRecognition = rec;
    } else {
      el.micBtn.title = 'เบราว์เซอร์ไม่รองรับ Speech Recognition';
      el.offCpMicBtn.title = 'เบราว์เซอร์ไม่รองรับ Speech Recognition';
    }
  }

  function toggleVoiceRecording(target) {
    if (!state.speechRecognition) {
      showToast('⚠️ เบราว์เซอร์นี้ไม่รองรับการพิมพ์ด้วยเสียง (แนะนำ Chrome/Edge/Safari)');
      return;
    }
    state.activeMicTarget = target;
    if (state.isRecordingVoice) {
      state.speechRecognition.stop();
    } else {
      try {
        state.speechRecognition.start();
      } catch (e) {
        console.warn(e);
      }
    }
  }

  // --- EVENTS BINDING ---
  function bindEvents() {
    // Tab switching
    el.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Guard select change
    el.guardSelect.addEventListener('change', (e) => {
      state.currentGuardId = e.target.value;
    });

    // Round select change
    el.roundSelect.addEventListener('change', (e) => {
      state.currentRound = e.target.value;
      updateProgress();
      renderCheckpoints();
    });

    // Shift segment
    el.shiftSegment.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        el.shiftSegment.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        state.currentShift = btn.dataset.shift;
        showToast(`เลือกกะ: ${btn.querySelector('b').textContent}`);
      });
    });

    // Checkpoint Risk Filter Buttons
    el.filterAllCpBtn.addEventListener('click', () => {
      state.cpRiskFilter = 'all';
      el.filterAllCpBtn.classList.add('active');
      el.filterRiskCpBtn.classList.remove('active');
      renderCheckpoints();
    });

    el.filterRiskCpBtn.addEventListener('click', () => {
      state.cpRiskFilter = 'risk';
      el.filterRiskCpBtn.classList.add('active');
      el.filterAllCpBtn.classList.remove('active');
      renderCheckpoints();
    });

    // Reset round
    el.resetRoundBtn.addEventListener('click', () => {
      if (confirm('คุณต้องการเริ่มรอบการตรวจใหม่หรือไม่? (ประวัติรอบเก่าจะยังคงถูกบันทึกไว้)')) {
        state.roundChecks = {};
        saveToLocalStorage();
        renderCheckpoints();
        updateProgress();
        showToast('🔄 เริ่มรอบการตรวจใหม่เรียบร้อย');
      }
    });

    // Inspection Status picker buttons
    el.statusOkBtn.addEventListener('click', () => setStatusSelection('ok'));
    el.statusAlertBtn.addEventListener('click', () => setStatusSelection('alert'));

    // Mic buttons
    el.micBtn.addEventListener('click', () => toggleVoiceRecording('sheet'));
    el.offCpMicBtn.addEventListener('click', () => toggleVoiceRecording('offCp'));

    // Photo Attachments - Normal
    el.takePhotoBtn.addEventListener('click', () => el.photoInput.click());
    el.photoInput.addEventListener('change', handlePhotoSelect);

    // Modal Close / Cancel / Save - Normal
    el.sheetCloseBtn.addEventListener('click', closeInspectionSheet);
    el.cancelInspectionBtn.addEventListener('click', closeInspectionSheet);
    el.inspectionVeil.addEventListener('click', (e) => {
      if (e.target === el.inspectionVeil) closeInspectionSheet();
    });
    el.saveInspectionBtn.addEventListener('click', saveInspection);

    // Off-Checkpoint Modal events
    el.openOffCpBtn.addEventListener('click', openOffCheckpointModal);
    el.offCpCloseBtn.addEventListener('click', closeOffCheckpointModal);
    el.cancelOffCpBtn.addEventListener('click', closeOffCheckpointModal);
    el.offCpVeil.addEventListener('click', (e) => {
      if (e.target === el.offCpVeil) closeOffCheckpointModal();
    });
    el.offCpTakePhotoBtn.addEventListener('click', () => el.offCpPhotoInput.click());
    el.offCpPhotoInput.addEventListener('change', handleOffCpPhotoSelect);
    el.saveOffCpBtn.addEventListener('click', saveOffCheckpointIncident);

    // Supervisor Filters
    el.filterDate.addEventListener('change', renderSupervisorDashboard);
    el.filterShift.addEventListener('change', renderSupervisorDashboard);
    el.filterStatus.addEventListener('change', renderSupervisorDashboard);
    el.filterSearch.addEventListener('input', renderSupervisorDashboard);
    el.exportCsvBtn.addEventListener('click', exportToCsv);

    // Checkpoint Form
    el.addCheckpointForm.addEventListener('submit', handleAddCheckpoint);
    el.resetCheckpointsBtn.addEventListener('click', () => {
      if (confirm('ยืนยันคืนค่าจุดตรวจเริ่มต้นทั้งหมด (รวมพื้นที่เสี่ยง มรย.) หรือไม่?')) {
        state.checkpoints = JSON.parse(JSON.stringify(DEFAULT_CHECKPOINTS));
        saveToLocalStorage();
        renderCheckpoints();
        renderCheckpointEditor();
        updateProgress();
        showToast('คืนค่าจุดตรวจเริ่มต้นแล้ว');
      }
    });
  }

  // --- TAB SWITCHING ---
  function switchTab(tabName) {
    if (history.replaceState) {
      history.replaceState(null, '', '#' + tabName);
    }
    el.tabButtons.forEach(b => {
      const selected = b.dataset.tab === tabName;
      b.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    Object.keys(el.panels).forEach(key => {
      if (key === tabName) {
        el.panels[key].removeAttribute('hidden');
      } else {
        el.panels[key].setAttribute('hidden', '');
      }
    });

    if (tabName === 'supervisor') {
      document.body.classList.add('wide');
      renderSupervisorDashboard();
    } else {
      document.body.classList.remove('wide');
    }

    if (tabName === 'checkpoints') {
      renderCheckpointEditor();
    }
  }

  // --- GUARDS & CHECKPOINTS RENDERING ---
  function renderGuardSelect() {
    el.guardSelect.innerHTML = state.guards.map(g => `
      <option value="${g.id}">${g.name} (${g.code}) - ${g.role}</option>
    `).join('');

    if (state.currentGuardId) {
      el.guardSelect.value = state.currentGuardId;
    }
  }

  function renderCheckpoints() {
    let activeCps = state.checkpoints.filter(cp => cp.active !== false);

    if (state.cpRiskFilter === 'risk') {
      activeCps = activeCps.filter(cp => cp.isRisk === true);
    }

    if (activeCps.length === 0) {
      el.checkpointList.innerHTML = `
        <div class="empty">
          ${state.cpRiskFilter === 'risk' ? 'ไม่พบจุดตรวจที่ระบุเป็นพื้นที่เสี่ยง' : 'ยังไม่มีจุดตรวจที่เปิดใช้งาน'}
        </div>
      `;
      return;
    }

    el.checkpointList.innerHTML = activeCps.map((cp, idx) => {
      const check = state.roundChecks[cp.id];
      const isDone = !!check;
      const isAlert = check && check.status === 'alert';

      let statusBadge = `<span class="tag">ยังไม่ได้ตรวจ</span>`;
      let cardClass = 'cp';

      if (cp.isRisk) {
        cardClass += ' is-risk';
      }

      if (isDone) {
        if (isAlert) {
          cardClass += ' alert';
          statusBadge = `<span class="tag alert">⚠️ พบเหตุผิดปกติ (${check.time})</span>`;
        } else {
          cardClass += ' done';
          statusBadge = `<span class="tag ok">✓ ปกติ (${check.time})</span>`;
        }
      }

      const riskBadge = cp.isRisk ? `<span class="tag risk" title="${escapeHtml(cp.riskReason || '')}">⚠️ พื้นที่เสี่ยง</span>` : '';

      return `
        <div class="${cardClass}" data-cpid="${cp.id}">
          <div class="cp-icon">${idx + 1}</div>
          <div class="cp-main">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="cp-name">${escapeHtml(cp.name)}</span>
              ${riskBadge}
            </div>
            <div class="cp-meta">${escapeHtml(cp.zone)} • ${escapeHtml(cp.code)}</div>
            ${cp.riskReason ? `<div style="font-size:12px; color:var(--alert); margin-top:2px;">🚨 จุดเฝ้าระวัง: ${escapeHtml(cp.riskReason)}</div>` : ''}
            <div style="margin-top: 4px;">${statusBadge}</div>
          </div>
          <button type="button" class="btn small ${isDone ? 'ghost' : ''}" onclick="window.appOpenInspection('${cp.id}')">
            ${isDone ? 'แก้ไข' : 'ตรวจ'}
          </button>
        </div>
      `;
    }).join('');
  }

  function updateProgress() {
    const activeCps = state.checkpoints.filter(cp => cp.active !== false);
    const total = activeCps.length;
    let completed = 0;

    activeCps.forEach(cp => {
      if (state.roundChecks[cp.id]) {
        completed++;
      }
    });

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    el.progressBarFill.style.width = `${percent}%`;
    el.progressPercent.textContent = `${percent}%`;
    el.progressTag.textContent = `${completed} / ${total} จุด`;

    if (percent === 100) {
      el.progressTag.className = 'tag ok';
    } else {
      el.progressTag.className = 'tag';
    }
  }

  // --- INSPECTION SHEET MODAL ---
  window.appOpenInspection = function (cpId) {
    const cp = state.checkpoints.find(c => c.id === cpId);
    if (!cp) return;

    state.activeCpForInspection = cp;
    state.attachedPhotos = [];

    const currentGuard = state.guards.find(g => g.id === state.currentGuardId) || state.guards[0];
    const existingCheck = state.roundChecks[cpId];

    const riskPrefix = cp.isRisk ? '⚠️ [พื้นที่เสี่ยง] ' : '';
    el.sheetTitle.textContent = `${riskPrefix}${cp.code}: ${cp.name}`;
    el.sheetSubtitle.textContent = `${cp.zone} — ${cp.desc || 'เดินตรวจความเรียบร้อยรอบพื้นที่'}`;
    el.sheetGuardTag.textContent = currentGuard ? currentGuard.name : 'รปภ.';

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    
    el.sheetStampTime.textContent = existingCheck ? existingCheck.time : timeStr;
    el.sheetStampDate.textContent = existingCheck ? existingCheck.date : dateStr;

    if (existingCheck) {
      setStatusSelection(existingCheck.status || 'ok');
      el.sheetNote.value = existingCheck.note || '';
      state.attachedPhotos = existingCheck.images ? [...existingCheck.images] : [];
    } else {
      setStatusSelection('ok');
      el.sheetNote.value = '';
    }

    renderPhotoThumbs();
    el.inspectionVeil.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  };

  function closeInspectionSheet() {
    el.inspectionVeil.setAttribute('hidden', '');
    document.body.style.overflow = '';
    state.activeCpForInspection = null;
    if (state.isRecordingVoice && state.speechRecognition) {
      state.speechRecognition.stop();
    }
  }

  function setStatusSelection(status) {
    state.selectedInspectionStatus = status;
    if (status === 'ok') {
      el.statusOkBtn.setAttribute('aria-pressed', 'true');
      el.statusAlertBtn.setAttribute('aria-pressed', 'false');
    } else {
      el.statusOkBtn.setAttribute('aria-pressed', 'false');
      el.statusAlertBtn.setAttribute('aria-pressed', 'true');
    }
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.attachedPhotos.push(event.target.result);
        renderPhotoThumbs();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function renderPhotoThumbs() {
    el.photoThumbs.innerHTML = state.attachedPhotos.map((src, index) => `
      <div class="thumb">
        <img src="${src}" alt="รูปหลักฐาน ${index + 1}">
        <button type="button" onclick="window.appRemovePhoto(${index})" title="ลบภาพ">✕</button>
      </div>
    `).join('');
  }

  window.appRemovePhoto = function (index) {
    state.attachedPhotos.splice(index, 1);
    renderPhotoThumbs();
  };

  function saveInspection() {
    if (!state.activeCpForInspection) return;

    const cp = state.activeCpForInspection;
    const currentGuard = state.guards.find(g => g.id === state.currentGuardId) || state.guards[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const record = {
      id: 'rec-' + Date.now(),
      date: isoDate,
      time: timeStr,
      shift: state.currentShift,
      round: state.currentRound,
      guardId: currentGuard ? currentGuard.id : 'unknown',
      guardName: currentGuard ? currentGuard.name : 'เจ้าหน้าที่ รปภ.',
      cpId: cp.id,
      cpCode: cp.code,
      cpName: cp.name,
      isRisk: !!cp.isRisk,
      isOffCheckpoint: false,
      status: state.selectedInspectionStatus,
      note: el.sheetNote.value.trim(),
      images: [...state.attachedPhotos]
    };

    state.roundChecks[cp.id] = record;
    state.history.unshift(record);

    saveToLocalStorage();
    closeInspectionSheet();
    renderCheckpoints();
    updateProgress();
    renderSupervisorDashboard();

    const isAlert = record.status === 'alert';
    showToast(isAlert ? '⚠️ บันทึกพบเหตุผิดปกติแล้ว' : '✓ บันทึกการตรวจปกติเรียบร้อย');
  }

  // --- OFF-CHECKPOINT INCIDENT MODAL (พบเหตุนอกจุดตรวจ) ---
  function openOffCheckpointModal() {
    const currentGuard = state.guards.find(g => g.id === state.currentGuardId) || state.guards[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

    el.offCpStampTime.textContent = timeStr;
    el.offCpStampDate.textContent = dateStr;
    el.offCpGuardTag.textContent = currentGuard ? currentGuard.name : 'รปภ.';
    el.offCpLocation.value = '';
    el.offCpNote.value = '';
    state.offCpAttachedPhotos = [];
    renderOffCpPhotoThumbs();

    el.offCpVeil.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeOffCheckpointModal() {
    el.offCpVeil.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (state.isRecordingVoice && state.speechRecognition) {
      state.speechRecognition.stop();
    }
  }

  function handleOffCpPhotoSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.offCpAttachedPhotos.push(event.target.result);
        renderOffCpPhotoThumbs();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function renderOffCpPhotoThumbs() {
    el.offCpPhotoThumbs.innerHTML = state.offCpAttachedPhotos.map((src, index) => `
      <div class="thumb">
        <img src="${src}" alt="รูปหลักฐาน ${index + 1}">
        <button type="button" onclick="window.appRemoveOffCpPhoto(${index})" title="ลบภาพ">✕</button>
      </div>
    `).join('');
  }

  window.appRemoveOffCpPhoto = function (index) {
    state.offCpAttachedPhotos.splice(index, 1);
    renderOffCpPhotoThumbs();
  };

  function saveOffCheckpointIncident() {
    const locationVal = el.offCpLocation.value.trim();
    if (!locationVal) {
      showToast('⚠️ กรุณาระบุสถานที่หรือพิกัดที่พบเหตุ');
      el.offCpLocation.focus();
      return;
    }

    const currentGuard = state.guards.find(g => g.id === state.currentGuardId) || state.guards[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const record = {
      id: 'rec-off-' + Date.now(),
      date: isoDate,
      time: timeStr,
      shift: state.currentShift,
      round: 'เหตุด่วนนอกจุดตรวจ',
      guardId: currentGuard ? currentGuard.id : 'unknown',
      guardName: currentGuard ? currentGuard.name : 'เจ้าหน้าที่ รปภ.',
      cpId: 'off-checkpoint',
      cpCode: 'OFF-CP',
      cpName: `พบเหตุนอกจุดตรวจ: ${locationVal}`,
      incidentType: el.offCpType.value,
      urgency: el.offCpUrgency.value,
      isRisk: true,
      isOffCheckpoint: true,
      status: 'alert',
      note: `[ประเภท: ${el.offCpType.value}] ${el.offCpNote.value.trim()}`,
      images: [...state.offCpAttachedPhotos]
    };

    state.history.unshift(record);
    saveToLocalStorage();
    closeOffCheckpointModal();
    renderSupervisorDashboard();

    showToast('🚨 บันทึกเหตุนอกจุดตรวจและแจ้งเตือนแล้ว', '🚨');
  }

  // --- SUPERVISOR DASHBOARD ---
  function renderSupervisorDashboard() {
    const total = state.history.length;
    const okCount = state.history.filter(h => h.status === 'ok').length;
    const alertCount = state.history.filter(h => h.status === 'alert').length;
    const activeCpCount = state.checkpoints.filter(c => c.active !== false).length;

    el.statTotal.textContent = total;
    el.statOk.textContent = okCount;
    el.statAlert.textContent = alertCount;
    el.statActiveCp.textContent = activeCpCount;

    const dateVal = el.filterDate.value;
    const shiftVal = el.filterShift.value;
    const statusVal = el.filterStatus.value;
    const searchVal = el.filterSearch.value.trim().toLowerCase();

    const filtered = state.history.filter(item => {
      if (dateVal && item.date !== dateVal) return false;
      if (shiftVal !== 'all' && item.shift !== shiftVal) return false;
      
      if (statusVal === 'ok' && item.status !== 'ok') return false;
      if (statusVal === 'alert' && item.status !== 'alert') return false;
      if (statusVal === 'risk' && !item.isRisk) return false;
      if (statusVal === 'off' && !item.isOffCheckpoint) return false;

      if (searchVal) {
        const text = `${item.cpName} ${item.cpCode || ''} ${item.guardName} ${item.note || ''} ${item.incidentType || ''}`.toLowerCase();
        if (!text.includes(searchVal)) return false;
      }
      return true;
    });

    el.logCountTag.textContent = `${filtered.length} รายการ`;

    if (filtered.length === 0) {
      el.reportTableBody.innerHTML = `
        <tr><td colspan="7" class="empty">ไม่พบข้อมูลตามตัวกรองที่เลือก</td></tr>
      `;
    } else {
      const shiftMap = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };
      const shiftColor = { morning: 'var(--sm)', afternoon: 'var(--sa)', night: 'var(--sn)' };

      el.reportTableBody.innerHTML = filtered.map(item => {
        const isOk = item.status === 'ok';
        let statusBadge = isOk 
          ? `<span class="tag ok">✓ ปกติ</span>` 
          : `<span class="tag alert">⚠️ มีเหตุ</span>`;
        
        if (item.isOffCheckpoint) {
          statusBadge = `<span class="tag alert" style="background:#e11d48; color:#fff;">🚨 นอกจุดตรวจ</span>`;
        }

        const riskIndicator = item.isRisk 
          ? `<span class="tag risk" style="font-size:11px; padding:1px 6px;">พื้นที่เสี่ยง</span>` 
          : '';

        const photoPreview = (item.images && item.images.length > 0)
          ? `<span title="${item.images.length} รูป">📷 ${item.images.length}</span>`
          : `<span style="color:var(--muted)">-</span>`;

        return `
          <tr>
            <td>
              <b>${item.time} น.</b>
              <small style="display:block; color:var(--muted);">${item.date}</small>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <b>${escapeHtml(item.cpName)}</b>
                ${riskIndicator}
              </div>
            </td>
            <td>${escapeHtml(item.guardName)}</td>
            <td>
              <span class="sdot" style="--c:${shiftColor[item.shift] || 'var(--accent)'}"></span>
              ${shiftMap[item.shift] || item.shift} / ${item.round || '-'}
            </td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(item.note || '-')}</td>
            <td>${photoPreview}</td>
          </tr>
        `;
      }).join('');
    }

    // Incident Feed
    const incidents = state.history.filter(h => h.status === 'alert').slice(0, 15);
    if (incidents.length === 0) {
      el.incidentList.innerHTML = `<div class="empty">ไม่มีรายงานเหตุผิดปกติในขณะนี้ ทุกจุดเรียบร้อยดี</div>`;
    } else {
      el.incidentList.innerHTML = incidents.map(inc => {
        const isOff = !!inc.isOffCheckpoint;
        const urgencyHtml = inc.urgency === 'critical' 
          ? `<span class="urgency-badge critical">ฉุกเฉินสูงสุด</span>` 
          : (inc.urgency === 'high' ? `<span class="urgency-badge high">เร่งด่วน</span>` : '');

        return `
          <div class="log" style="${isOff ? 'background:rgba(225,29,72,0.04); border-left:4px solid #e11d48; padding-left:12px;' : ''}">
            <time>
              ${inc.time} น.
              <small>${inc.date}</small>
            </time>
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <b style="color:${isOff ? '#e11d48' : 'var(--alert)'};">${escapeHtml(inc.cpName)}</b>
                ${urgencyHtml}
                <span class="tag alert">ผู้แจ้ง: ${escapeHtml(inc.guardName)}</span>
              </div>
              <p>${escapeHtml(inc.note || 'ไม่มีรายละเอียดเพิ่มเติม')}</p>
              ${inc.images && inc.images.length ? `
                <div class="thumbs" style="margin-top:6px;">
                  ${inc.images.map(img => `<div class="thumb"><img src="${img}"></div>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // --- EXPORT TO CSV ---
  function exportToCsv() {
    if (!state.history.length) {
      showToast('⚠️ ยังไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'วันที่', 'เวลา', 'กะ', 'รอบ', 'รหัสจุดตรวจ', 'ชื่อจุดตรวจ/สถานที่', 'พื้นที่เสี่ยง', 'เหตุนอกจุดตรวจ', 'รปภ. ผู้ตรวจ', 'สถานะ', 'หมายเหตุ'];
    const shiftMap = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };

    const rows = state.history.map((h, i) => [
      i + 1,
      `"${h.date}"`,
      `"${h.time}"`,
      `"${shiftMap[h.shift] || h.shift}"`,
      `"${h.round || ''}"`,
      `"${h.cpCode || ''}"`,
      `"${(h.cpName || '').replace(/"/g, '""')}"`,
      `"${h.isRisk ? 'ใช่' : 'ไม่ใช่'}"`,
      `"${h.isOffCheckpoint ? 'ใช่' : 'ไม่ใช่'}"`,
      `"${(h.guardName || '').replace(/"/g, '""')}"`,
      `"${h.status === 'ok' ? 'ปกติ' : 'ผิดปกติ'}"`,
      `"${(h.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานเวียนตรวจ_รปภ_มรย_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว');
  }

  // --- CHECKPOINT MANAGER ---
  function renderCheckpointEditor() {
    el.checkpointEditorList.innerHTML = state.checkpoints.map((cp, idx) => `
      <div class="edrow" data-id="${cp.id}">
        <div class="line">
          <b>จุดที่ ${idx + 1}</b>
          <input type="text" value="${escapeHtml(cp.code)}" style="width:100px;" onchange="window.appUpdateCpField('${cp.id}', 'code', this.value)" placeholder="รหัส">
          <input type="text" value="${escapeHtml(cp.name)}" style="flex:2;" onchange="window.appUpdateCpField('${cp.id}', 'name', this.value)" placeholder="ชื่อจุดตรวจ">
          <input type="text" value="${escapeHtml(cp.zone)}" style="flex:1;" onchange="window.appUpdateCpField('${cp.id}', 'zone', this.value)" placeholder="โซน">
          <label class="chk" style="color: ${cp.isRisk ? '#e11d48' : 'inherit'};">
            <input type="checkbox" ${cp.isRisk ? 'checked' : ''} onchange="window.appToggleCpRisk('${cp.id}', this.checked)">
            ⚠️ พื้นที่เสี่ยง
          </label>
          <label class="chk">
            <input type="checkbox" ${cp.active !== false ? 'checked' : ''} onchange="window.appToggleCpActive('${cp.id}', this.checked)">
            เปิดใช้งาน
          </label>
          <button type="button" class="btn danger small" onclick="window.appDeleteCp('${cp.id}')" title="ลบ">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function handleAddCheckpoint(e) {
    e.preventDefault();
    const code = el.newCpCode.value.trim();
    const zone = el.newCpZone.value.trim();
    const name = el.newCpName.value.trim();
    const desc = el.newCpDesc.value.trim();
    const isRisk = el.newCpIsRisk ? el.newCpIsRisk.checked : false;

    if (!code || !name) {
      showToast('⚠️ กรุณากรอกรหัสและชื่อจุดตรวจ');
      return;
    }

    const newCp = {
      id: 'cp-' + Date.now(),
      code,
      name,
      zone: zone || 'ทั่วไป',
      desc,
      isRisk,
      active: true
    };

    state.checkpoints.push(newCp);
    saveToLocalStorage();
    renderCheckpoints();
    renderCheckpointEditor();
    updateProgress();

    el.addCheckpointForm.reset();
    showToast(`✓ เพิ่มจุดตรวจ "${name}" เรียบร้อย`);
  }

  window.appUpdateCpField = function (cpId, field, value) {
    const cp = state.checkpoints.find(c => c.id === cpId);
    if (cp) {
      cp[field] = value.trim();
      saveToLocalStorage();
      renderCheckpoints();
      showToast('บันทึกการแก้ไขแล้ว');
    }
  };

  window.appToggleCpRisk = function (cpId, isRisk) {
    const cp = state.checkpoints.find(c => c.id === cpId);
    if (cp) {
      cp.isRisk = isRisk;
      saveToLocalStorage();
      renderCheckpoints();
      showToast(isRisk ? 'กำหนดเป็นพื้นที่เสี่ยงแล้ว' : 'ยกเลิกสถานะพื้นที่เสี่ยงแล้ว');
    }
  };

  window.appToggleCpActive = function (cpId, active) {
    const cp = state.checkpoints.find(c => c.id === cpId);
    if (cp) {
      cp.active = active;
      saveToLocalStorage();
      renderCheckpoints();
      updateProgress();
      renderSupervisorDashboard();
      showToast(active ? 'เปิดใช้งานจุดตรวจแล้ว' : 'ปิดการใช้งานจุดตรวจชั่วคราว');
    }
  };

  window.appDeleteCp = function (cpId) {
    if (confirm('คุณแน่ใจว่าต้องการลบจุดตรวจนี้ใช่หรือไม่?')) {
      state.checkpoints = state.checkpoints.filter(c => c.id !== cpId);
      saveToLocalStorage();
      renderCheckpoints();
      renderCheckpointEditor();
      updateProgress();
      showToast('ลบจุดตรวจเรียบร้อย');
    }
  };

  // --- TOAST HELPER ---
  let toastTimer = null;
  function showToast(msg, icon = 'ℹ️') {
    if (toastTimer) clearTimeout(toastTimer);
    el.toastMsg.textContent = msg;
    el.toastIcon.textContent = icon;
    el.toast.removeAttribute('hidden');
    toastTimer = setTimeout(() => {
      el.toast.setAttribute('hidden', '');
    }, 2800);
  }

  // --- UTILS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
