/**
 * app.js - ระบบเวียนตรวจ รปภ. มรย. (Senior & Non-tech Friendly Edition)
 * มหาวิทยาลัยราชภัฏยะลา (Yala Rajabhat University)
 * ออกแบบเน้นความเรียบง่าย ปุ่มใหญ่ ตัวหนังสือใหญ่ เข้าใจได้ทันที
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
    tabGuard: document.getElementById('tabGuard'),
    tabSupervisor: document.getElementById('tabSupervisor'),
    panelGuard: document.getElementById('panelGuard'),
    panelSupervisor: document.getElementById('panelSupervisor'),

    // Guard panel
    guardSelect: document.getElementById('guardSelect'),
    roundSelect: document.getElementById('roundSelect'),
    shiftSegment: document.getElementById('shiftSegment'),
    progressText: document.getElementById('progressText'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressPercent: document.getElementById('progressPercent'),
    checkpointList: document.getElementById('checkpointList'),
    resetRoundBtn: document.getElementById('resetRoundBtn'),
    filterAllCpBtn: document.getElementById('filterAllCpBtn'),
    filterRiskCpBtn: document.getElementById('filterRiskCpBtn'),
    openOffCpBtn: document.getElementById('openOffCpBtn'),

    // Inspection Modal (ตรวจจุดปกติ)
    inspectionVeil: document.getElementById('inspectionVeil'),
    sheetTitle: document.getElementById('sheetTitle'),
    sheetSubtitle: document.getElementById('sheetSubtitle'),
    sheetCloseBtn: document.getElementById('sheetCloseBtn'),
    sheetStampTime: document.getElementById('sheetStampTime'),
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

    // Off-Checkpoint Emergency Modal (เหตุด่วนนอกจุดตรวจ)
    offCpVeil: document.getElementById('offCpVeil'),
    offCpCloseBtn: document.getElementById('offCpCloseBtn'),
    offCpStampTime: document.getElementById('offCpStampTime'),
    offCpGuardTag: document.getElementById('offCpGuardTag'),
    offCpLocation: document.getElementById('offCpLocation'),
    offCpType: document.getElementById('offCpType'),
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
    reportTableBody: document.getElementById('reportTableBody'),
    logCountTag: document.getElementById('logCountTag'),
    incidentList: document.getElementById('incidentList'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),

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

    // Check URL Hash for initial tab
    const hash = window.location.hash.replace('#', '');
    if (hash === 'supervisor') {
      switchTab('supervisor');
    }

    // Auto open inspection if requested in URL
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

    function tick() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      el.clockTime.textContent = `${h}:${m} น.`;

      const d = now.getDate();
      const mon = thaiMonths[now.getMonth()];
      const y = (now.getFullYear() + 543) % 100;
      el.clockDate.textContent = `${d} ${mon} ${y}`;
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
        const activeBtn = state.activeMicTarget === 'sheet' ? el.micBtn : el.offCpMicBtn;
        activeBtn.classList.add('on');
        activeBtn.innerHTML = '<span>🎙️</span> กำลังฟังเสียง... พูดได้เลย';
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
        showToast('✓ พิมพ์ข้อความจากเสียงให้แล้ว');
      };

      rec.onerror = (evt) => {
        console.warn('Speech recognition error:', evt.error);
        showToast('⚠️ ไม่สามารถแปลงเสียงได้ กรุณาลองใหม่');
      };

      rec.onend = () => {
        state.isRecordingVoice = false;
        el.micBtn.classList.remove('on');
        el.micBtn.innerHTML = '<span>🎙️</span> กดเพื่อเริ่มพูด';
        el.offCpMicBtn.classList.remove('on');
        el.offCpMicBtn.innerHTML = '<span>🎙️</span> กดเพื่อเริ่มพูด';
      };

      state.speechRecognition = rec;
    }
  }

  function toggleVoiceRecording(target) {
    if (!state.speechRecognition) {
      showToast('⚠️ เบราว์เซอร์นี้ไม่รองรับการพูด (แนะนำเปิดผ่าน Chrome บนมือถือ)');
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
    // 2 Tabs switching
    el.tabGuard.addEventListener('click', () => switchTab('guard'));
    el.tabSupervisor.addEventListener('click', () => switchTab('supervisor'));

    // Guard select change
    el.guardSelect.addEventListener('change', (e) => {
      state.currentGuardId = e.target.value;
      const selectedGuard = state.guards.find(g => g.id === e.target.value);
      showToast(`เลือก: ${selectedGuard ? selectedGuard.name : ''}`);
    });

    // Round select change
    el.roundSelect.addEventListener('change', (e) => {
      state.currentRound = e.target.value;
      updateProgress();
      renderCheckpoints();
      showToast(`เปลี่ยนเป็น: ${e.target.value}`);
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
      if (confirm('คุณต้องการเริ่มรอบการตรวจใหม่หรือไม่? (ข้อมูลรอบเก่าจะยังคงถูกบันทึกไว้ในระบบ)')) {
        state.roundChecks = {};
        saveToLocalStorage();
        renderCheckpoints();
        updateProgress();
        showToast('🔄 เริ่มรอบการตรวจใหม่เรียบร้อย');
      }
    });

    // Inspection Status picker buttons (2 ปุ่มยักษ์)
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
    el.exportCsvBtn.addEventListener('click', exportToCsv);
  }

  // --- TAB SWITCHING ---
  function switchTab(tabName) {
    if (history.replaceState) {
      history.replaceState(null, '', '#' + tabName);
    }
    const isGuard = tabName === 'guard';
    el.tabGuard.setAttribute('aria-selected', isGuard ? 'true' : 'false');
    el.tabSupervisor.setAttribute('aria-selected', isGuard ? 'false' : 'true');

    if (isGuard) {
      el.panelGuard.removeAttribute('hidden');
      el.panelSupervisor.setAttribute('hidden', '');
      document.body.classList.remove('wide');
    } else {
      el.panelGuard.setAttribute('hidden', '');
      el.panelSupervisor.removeAttribute('hidden');
      document.body.classList.add('wide');
      renderSupervisorDashboard();
    }
  }

  // --- GUARDS & CHECKPOINTS RENDERING ---
  function renderGuardSelect() {
    el.guardSelect.innerHTML = state.guards.map((g, idx) => `
      <option value="${g.id}">${idx + 1}. ${g.name} (${g.code})</option>
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
      el.checkpointList.innerHTML = `<div class="empty">ไม่พบจุดตรวจในตัวกรองนี้</div>`;
      return;
    }

    el.checkpointList.innerHTML = activeCps.map((cp, idx) => {
      const check = state.roundChecks[cp.id];
      const isDone = !!check;
      const isAlert = check && check.status === 'alert';
      const isRisk = !!cp.isRisk;

      let cardClass = 'cp-card';
      if (isRisk) cardClass += ' is-risk';

      if (!isDone) {
        // ยังไม่ได้ตรวจ: แสดงปุ่มเขียวใหญ่กดบันทึกจุดนี้
        return `
          <div class="${cardClass}">
            <div class="cp-card-top">
              <div class="cp-num">${idx + 1}</div>
              <div class="cp-card-info">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <div class="cp-card-title">${escapeHtml(cp.name)}</div>
                  ${isRisk ? '<span class="tag risk">⚠️ จุดเสี่ยงพิเศษ</span>' : ''}
                </div>
                <div class="cp-card-zone">📍 ${escapeHtml(cp.zone)} • ${escapeHtml(cp.code)}</div>
                <div class="cp-card-desc">🔍 สิ่งที่ต้องดู: ${escapeHtml(cp.desc)}</div>
              </div>
            </div>
            <button type="button" class="btn-check-action" onclick="window.appOpenInspection('${cp.id}')">
              👉 แตะเพื่อบันทึกจุดนี้
            </button>
          </div>
        `;
      } else if (isAlert) {
        // ตรวจแล้ว: พบปัญหา (สีแดง)
        cardClass += ' alert';
        return `
          <div class="${cardClass}">
            <div class="cp-card-top">
              <div class="cp-num">🚨</div>
              <div class="cp-card-info">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <div class="cp-card-title">${escapeHtml(cp.name)}</div>
                  <span class="tag alert">🚨 พบปัญหา (${check.time} น.)</span>
                </div>
                <div class="cp-card-zone">📍 ${escapeHtml(cp.zone)} • ตรวจโดย: ${escapeHtml(check.guardName)}</div>
                ${check.note ? `<div style="font-size:15px; color:var(--alert); font-weight:700; margin-top:6px; background:rgba(220,38,38,0.08); padding:6px 10px; border-radius:8px;">⚠️ บันทึก: ${escapeHtml(check.note)}</div>` : ''}
              </div>
            </div>
            <button type="button" class="btn-check-action edit" onclick="window.appOpenInspection('${cp.id}')">
              ✏️ แตะเพื่อแก้ไขข้อมูลจุดนี้
            </button>
          </div>
        `;
      } else {
        // ตรวจแล้ว: ปกติ (สีเขียว)
        cardClass += ' done';
        return `
          <div class="${cardClass}">
            <div class="cp-card-top">
              <div class="cp-num">✅</div>
              <div class="cp-card-info">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <div class="cp-card-title">${escapeHtml(cp.name)}</div>
                  <span class="tag ok">✅ ปกติเรียบร้อย (${check.time} น.)</span>
                </div>
                <div class="cp-card-zone">📍 ${escapeHtml(cp.zone)} • ตรวจโดย: ${escapeHtml(check.guardName)}</div>
                ${check.note ? `<div style="font-size:14px; margin-top:4px;">💬 บันทึก: ${escapeHtml(check.note)}</div>` : ''}
              </div>
            </div>
            <button type="button" class="btn-check-action edit" onclick="window.appOpenInspection('${cp.id}')">
              ✏️ แตะเพื่อแก้ไขข้อมูลจุดนี้
            </button>
          </div>
        `;
      }
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

    const remaining = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    el.progressBarFill.style.width = `${percent}%`;
    el.progressPercent.textContent = `${percent}%`;
    
    if (completed === total) {
      el.progressText.innerHTML = `<span style="color:var(--ok); font-weight:700;">🎉 ตรวจครบทั้ง ${total} จุดแล้ว!</span>`;
    } else {
      el.progressText.textContent = `ตรวจเสร็จแล้ว ${completed} จาก ${total} จุด (เหลืออีก ${remaining} จุด)`;
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
    el.sheetTitle.textContent = `${riskPrefix}${cp.name}`;
    el.sheetSubtitle.textContent = `พิกัด: ${cp.zone} • ${cp.desc || 'เดินตรวจความเรียบร้อยรอบพื้นที่'}`;
    el.sheetGuardTag.textContent = currentGuard ? currentGuard.name : 'รปภ.';

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    el.sheetStampTime.textContent = existingCheck ? `${existingCheck.time} น.` : `${timeStr} น.`;

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
        <button type="button" onclick="window.appRemovePhoto(${index})" title="ลบรูปนี้">✕</button>
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
    showToast(isAlert ? '🚨 บันทึกพบเหตุผิดปกติแล้ว' : '✅ บันทึกว่าปกติเรียบร้อย', isAlert ? '🚨' : '✅');
  }

  // --- OFF-CHECKPOINT INCIDENT MODAL (แจ้งเหตุด่วน) ---
  function openOffCheckpointModal() {
    const currentGuard = state.guards.find(g => g.id === state.currentGuardId) || state.guards[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    el.offCpStampTime.textContent = `${timeStr} น.`;
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
        <button type="button" onclick="window.appRemoveOffCpPhoto(${index})" title="ลบภาพนี้">✕</button>
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
      showToast('⚠️ กรุณาระบุสถานที่หรือพิกัดที่พบเหตุก่อน');
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
      isRisk: true,
      isOffCheckpoint: true,
      status: 'alert',
      note: `[${el.offCpType.value}] ${el.offCpNote.value.trim()}`,
      images: [...state.offCpAttachedPhotos]
    };

    state.history.unshift(record);
    saveToLocalStorage();
    closeOffCheckpointModal();
    renderSupervisorDashboard();

    showToast('🚨 แจ้งเหตุด่วนเรียบร้อยแล้ว!', '🚨');
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

    const filtered = state.history.filter(item => {
      if (dateVal && item.date !== dateVal) return false;
      if (shiftVal !== 'all' && item.shift !== shiftVal) return false;
      
      if (statusVal === 'ok' && item.status !== 'ok') return false;
      if (statusVal === 'alert' && item.status !== 'alert') return false;
      if (statusVal === 'risk' && !item.isRisk) return false;
      if (statusVal === 'off' && !item.isOffCheckpoint) return false;

      return true;
    });

    el.logCountTag.textContent = `${filtered.length} รายการ`;

    if (filtered.length === 0) {
      el.reportTableBody.innerHTML = `
        <tr><td colspan="7" class="empty">ไม่พบข้อมูลตามตัวกรองที่เลือก</td></tr>
      `;
    } else {
      const shiftMap = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };

      el.reportTableBody.innerHTML = filtered.map(item => {
        const isOk = item.status === 'ok';
        let statusBadge = isOk 
          ? `<span class="tag ok">✅ ปกติ</span>` 
          : `<span class="tag alert">🚨 มีปัญหา</span>`;
        
        if (item.isOffCheckpoint) {
          statusBadge = `<span class="tag alert" style="background:#dc2626;">🚨 เหตุด่วนนอกจุด</span>`;
        }

        const photoPreview = (item.images && item.images.length > 0)
          ? `<span>📷 ${item.images.length} รูป</span>`
          : `<span style="color:var(--muted)">-</span>`;

        return `
          <tr>
            <td><b>${item.time} น.</b><br><small style="color:var(--muted);">${item.date}</small></td>
            <td>
              <b>${escapeHtml(item.cpName)}</b>
              ${item.isRisk ? '<br><span class="tag risk" style="font-size:11px;">จุดเสี่ยง</span>' : ''}
            </td>
            <td>${escapeHtml(item.guardName)}</td>
            <td>${shiftMap[item.shift] || item.shift}<br><small style="color:var(--muted);">${item.round || ''}</small></td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(item.note || '-')}</td>
            <td>${photoPreview}</td>
          </tr>
        `;
      }).join('');
    }

    // Incident Feed
    const incidents = state.history.filter(h => h.status === 'alert').slice(0, 10);
    if (incidents.length === 0) {
      el.incidentList.innerHTML = `<div class="empty">ไม่มีรายงานเหตุผิดปกติในขณะนี้ ทุกจุดเรียบร้อยดี</div>`;
    } else {
      el.incidentList.innerHTML = incidents.map(inc => `
        <div style="background:var(--alert-bg); border:1.5px solid var(--alert-border); border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:var(--alert); font-size:17px;">${escapeHtml(inc.cpName)}</b>
            <span class="tag alert">${inc.time} น.</span>
          </div>
          <div style="font-size:14px; color:var(--muted); margin-top:2px;">
            ผู้แจ้ง: <b>${escapeHtml(inc.guardName)}</b> (${inc.date})
          </div>
          <p style="margin:6px 0 0; font-size:15px; font-weight:600;">${escapeHtml(inc.note || 'ไม่มีรายละเอียด')}</p>
          ${inc.images && inc.images.length ? `
            <div class="thumbs">
              ${inc.images.map(img => `<div class="thumb"><img src="${img}"></div>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  }

  // --- EXPORT TO CSV ---
  function exportToCsv() {
    if (!state.history.length) {
      showToast('⚠️ ยังไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'วันที่', 'เวลา', 'กะ', 'รอบ', 'จุดตรวจหรือสถานที่', 'รปภ. ผู้ตรวจ', 'สถานะ', 'รายละเอียด'];
    const shiftMap = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };

    const rows = state.history.map((h, i) => [
      i + 1,
      `"${h.date}"`,
      `"${h.time} น."`,
      `"${shiftMap[h.shift] || h.shift}"`,
      `"${h.round || ''}"`,
      `"${(h.cpName || '').replace(/"/g, '""')}"`,
      `"${(h.guardName || '').replace(/"/g, '""')}"`,
      `"${h.status === 'ok' ? 'ปกติ' : 'มีปัญหา'}"`,
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
    showToast('📥 ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว');
  }

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
