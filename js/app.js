/**
 * app.js - ระบบเวียนตรวจ รปภ. มรย. (Senior & Non-tech Friendly Edition)
 * มหาวิทยาลัยราชภัฏยะลา (Yala Rajabhat University)
 * ออกแบบเน้นความเรียบง่าย ปุ่มใหญ่ ตัวหนังสือใหญ่ เข้าใจได้ทันที
 */

(function () {
  'use strict';

  // --- STATE ---
  let state = {
    accounts: DEFAULT_ACCOUNTS,
    currentUser: null, // { username, name, role, roleName }
    guards: [],
    checkpoints: [],
    history: [],
    currentShift: 'morning', // 'morning' | 'afternoon' | 'night'
    currentShiftName: 'เช้า',
    currentGuardId: '',
    currentGuardName: '',
    capturedImageBase64: null,
    capturedImages: [], // array of { dataUrl, timeStr, fullStamp, timestamp }
    speechRecognition: null,
    isRecordingVoice: false,
    selectedAdminEditStatus: 'ok',
    adminEditPhotos: []
  };

  // --- DOM ELEMENTS ---
  const el = {
    appClock: document.getElementById('appClock'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    themeToggle: document.getElementById('themeToggle'),

    // User & Auth Header
    userPill: document.getElementById('userPill'),
    userRoleBadge: document.getElementById('userRoleBadge'),
    userNameTag: document.getElementById('userNameTag'),
    logoutBtn: document.getElementById('logoutBtn'),
    navTabsWrap: document.getElementById('navTabsWrap'),
    
    // Tabs
    tabGuard: document.getElementById('tabGuard'),
    tabSupervisor: document.getElementById('tabSupervisor'),
    panelGuard: document.getElementById('panelGuard'),
    panelSupervisor: document.getElementById('panelSupervisor'),

    // Patrol Elements (ระบบบันทึกเวียนตรวจ รปภ. มรย.)
    sosPatrolBtn: document.getElementById('sosPatrolBtn'),
    shiftPatrolSeg: document.getElementById('shiftPatrolSeg'),
    guardPatrolSelect: document.getElementById('guardPatrolSelect'),
    locPatrolSelect: document.getElementById('locPatrolSelect'),
    customLocPatrolInput: document.getElementById('customLocPatrolInput'),
    toggleCustomLocBtn: document.getElementById('toggleCustomLocBtn'),
    camPatrolInput: document.getElementById('camPatrolInput'),
    triggerCamBtn: document.getElementById('triggerCamBtn'),
    photoCountBadge: document.getElementById('photoCountBadge'),
    camBtnMainText: document.getElementById('camBtnMainText'),
    camBtnSubText: document.getElementById('camBtnSubText'),
    thumbPatrolContainer: document.getElementById('thumbPatrolContainer'),
    notePatrolInput: document.getElementById('notePatrolInput'),
    micPatrolBtn: document.getElementById('micPatrolBtn'),
    riskPatrolChk: document.getElementById('riskPatrolChk'),
    submitPatrolBtn: document.getElementById('submitPatrolBtn'),
    guardRecentLogs: document.getElementById('guardRecentLogs'),
    guardLogCount: document.getElementById('guardLogCount'),


    // Supervisor panel
    statTotal: document.getElementById('statTotal'),
    statOk: document.getElementById('statOk'),
    statAlert: document.getElementById('statAlert'),
    statActiveCp: document.getElementById('statActiveCp'),
    filterDate: document.getElementById('filterDate'),
    filterShift: document.getElementById('filterShift'),
    filterStatus: document.getElementById('filterStatus'),
    resetFilterBtn: document.getElementById('resetFilterBtn'),
    reportTableBody: document.getElementById('reportTableBody'),
    logCountTag: document.getElementById('logCountTag'),
    incidentList: document.getElementById('incidentList'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportSqlBtn: document.getElementById('exportSqlBtn'),
    viewSqlLogsBtn: document.getElementById('viewSqlLogsBtn'),
    sqlLogsModal: document.getElementById('sqlLogsModal'),
    sqlLogsContainer: document.getElementById('sqlLogsContainer'),
    closeSqlLogsBtn: document.getElementById('closeSqlLogsBtn'),
    modalExportSqlBtn: document.getElementById('modalExportSqlBtn'),

    // Admin Edit Modal
    adminEditVeil: document.getElementById('adminEditVeil'),
    adminEditCloseBtn: document.getElementById('adminEditCloseBtn'),
    adminEditRecordId: document.getElementById('adminEditRecordId'),
    adminEditDate: document.getElementById('adminEditDate'),
    adminEditTime: document.getElementById('adminEditTime'),
    adminEditCpName: document.getElementById('adminEditCpName'),
    adminEditGuardName: document.getElementById('adminEditGuardName'),
    adminEditShift: document.getElementById('adminEditShift'),
    adminEditRound: document.getElementById('adminEditRound'),
    adminStatusOkBtn: document.getElementById('adminStatusOkBtn'),
    adminStatusAlertBtn: document.getElementById('adminStatusAlertBtn'),
    adminEditNote: document.getElementById('adminEditNote'),
    adminEditPhotoThumbs: document.getElementById('adminEditPhotoThumbs'),
    adminSaveEditBtn: document.getElementById('adminSaveEditBtn'),
    adminDeleteRecordBtn: document.getElementById('adminDeleteRecordBtn'),
    adminCancelEditBtn: document.getElementById('adminCancelEditBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMsg: document.getElementById('toastMsg')
  };

  // --- INITIALIZATION ---
  async function init() {
    // บังคับตรวจสอบ sessionStorage ในแท็บปัจจุบัน เพื่อให้เข้าหน้าล็อกอินทุกครั้งที่เปิดเข้าเว็บใหม่
    const savedSession = sessionStorage.getItem('yru_sp_session');
    if (!savedSession) {
      sessionStorage.removeItem('yru_sp_session');
      localStorage.removeItem('yru_sp_session');
      window.location.replace('login.html');
      return;
    }

    await loadFromLocalStorage();
    setupClock();
    setupTheme();
    setupAuth();
    bindEvents();
    setupPatrolForm();
    renderGuardRecentLogs();
    renderSupervisorDashboard();
    applyAuthUI();

    // กำหนดหน้าเริ่มต้นตามบทบาทของผู้ใช้งาน
    if (state.currentUser && state.currentUser.role === 'admin') {
      switchTab('supervisor');
    } else {
      switchTab('guard');
    }
  }

  // --- STORAGE & SQL DATABASE INTEGRATION ---
  async function loadFromLocalStorage() {
    try {
      if (window.AppDB) {
        await window.AppDB.init();
      }

      state.guards = DEFAULT_GUARDS;
      state.checkpoints = DEFAULT_CHECKPOINTS;
      state.roundChecks = {};

      if (window.AppDB) {
        // ดึงข้อมูลผ่านคำสั่ง SQL SELECT จากฐานข้อมูลจริง
        const records = await window.AppDB.query("SELECT * FROM patrol_records ORDER BY date DESC, time DESC");
        state.history = records || [];
      } else {
        const storedVersion = localStorage.getItem('yru_sp_version');
        if (storedVersion !== DATA_VERSION) {
          state.history = [];
          localStorage.setItem('yru_sp_version', DATA_VERSION);
          saveToLocalStorage();
        } else {
          const h = localStorage.getItem('yru_sp_history');
          state.history = h ? JSON.parse(h) : [];
        }
      }

      // ลบข้อมูลจำลอง/ตัวอย่างเก่าออกทั้งหมด (ล้างประวัติ mock data ทั้งใน guard และ admin)
      state.history = state.history.filter(r => !['rec-001', 'rec-off-001', 'rec-002'].includes(r.id));
      saveToLocalStorage();

      state.currentGuardId = state.guards[0]?.id || '';

      // Load session from sessionStorage (บังคับเข้าสู่หน้าล็อกอินเสมอเมื่อเปิดเบราว์เซอร์ใหม่)
      const savedSession = sessionStorage.getItem('yru_sp_session');
      if (savedSession) {
        try {
          state.currentUser = JSON.parse(savedSession);
        } catch (e) {
          state.currentUser = null;
        }
      } else {
        state.currentUser = null;
      }
    } catch (err) {
      console.warn('Storage read error, using defaults:', err);
      state.guards = DEFAULT_GUARDS;
      state.checkpoints = DEFAULT_CHECKPOINTS;
      state.history = [];
      state.roundChecks = {};
      state.currentGuardId = DEFAULT_GUARDS[0]?.id || '';
      state.currentUser = null;
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
    const saved = localStorage.getItem('yru_sp_theme_v2');
    const theme = saved || 'light'; // ค่าเริ่มต้นเป็นโหมดสว่างสบายตาสำหรับผู้ใหญ่
    document.documentElement.setAttribute('data-theme', theme);
    if (el.themeToggle) {
      el.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      el.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('yru_sp_theme_v2', next);
        el.themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
        showToast(`เปลี่ยนเป็นโหมด${next === 'dark' ? 'กลางคืน (มืด)' : 'กลางวัน (สว่างสบายตา)'}`);
      });
    }
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
    // Auth & Header Logout
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', logout);
    }

    // Admin Edit Modal events
    if (el.adminEditCloseBtn) el.adminEditCloseBtn.addEventListener('click', closeAdminEditModal);
    if (el.adminCancelEditBtn) el.adminCancelEditBtn.addEventListener('click', closeAdminEditModal);
    if (el.adminEditVeil) {
      el.adminEditVeil.addEventListener('click', (e) => {
        if (e.target === el.adminEditVeil) closeAdminEditModal();
      });
    }
    if (el.adminStatusOkBtn) el.adminStatusOkBtn.addEventListener('click', () => setAdminStatusSelection('ok'));
    if (el.adminStatusAlertBtn) el.adminStatusAlertBtn.addEventListener('click', () => setAdminStatusSelection('alert'));
    if (el.adminSaveEditBtn) el.adminSaveEditBtn.addEventListener('click', saveAdminEditRecord);
    if (el.adminDeleteRecordBtn) {
      el.adminDeleteRecordBtn.addEventListener('click', () => {
        const id = el.adminEditRecordId.value;
        if (id) deleteAdminRecord(id);
      });
    }

    // 2 Tabs switching
    if (el.tabGuard) el.tabGuard.addEventListener('click', () => switchTab('guard'));
    if (el.tabSupervisor) el.tabSupervisor.addEventListener('click', () => switchTab('supervisor'));

    // Supervisor Filters
    if (el.filterDate) el.filterDate.addEventListener('change', renderSupervisorDashboard);
    if (el.filterShift) el.filterShift.addEventListener('change', renderSupervisorDashboard);
    if (el.filterStatus) el.filterStatus.addEventListener('change', renderSupervisorDashboard);
    if (el.resetFilterBtn) {
      el.resetFilterBtn.addEventListener('click', () => {
        el.filterDate.value = '';
        el.filterShift.value = 'all';
        el.filterStatus.value = 'all';
        renderSupervisorDashboard();
        showToast('🔄 แสดงข้อมูลทั้งหมดเรียบร้อยแล้ว');
      });
    }
    if (el.exportCsvBtn) el.exportCsvBtn.addEventListener('click', exportToCsv);

    // SQL Database Management Buttons
    if (el.exportSqlBtn) {
      el.exportSqlBtn.addEventListener('click', () => {
        if (window.AppDB) {
          window.AppDB.exportSQLFile();
          showToast('💾 ส่งออกไฟล์ฐานข้อมูล SQL เรียบร้อยแล้ว', '✅');
        }
      });
    }

    if (el.viewSqlLogsBtn) {
      el.viewSqlLogsBtn.addEventListener('click', openSqlLogsModal);
    }

    if (el.closeSqlLogsBtn) {
      el.closeSqlLogsBtn.addEventListener('click', closeSqlLogsModal);
    }
    if (el.sqlLogsModal) {
      el.sqlLogsModal.addEventListener('click', (e) => {
        if (e.target === el.sqlLogsModal) closeSqlLogsModal();
      });
    }

    if (el.modalExportSqlBtn) {
      el.modalExportSqlBtn.addEventListener('click', () => {
        if (window.AppDB) {
          window.AppDB.exportSQLFile();
          showToast('💾 ส่งออกไฟล์ฐานข้อมูล SQL เรียบร้อยแล้ว', '✅');
        }
      });
    }
  }

  // --- AUTHENTICATION & ACCESS CONTROL ---
  function setupAuth() {
    // Session loaded in loadFromLocalStorage
  }

  function applyAuthUI() {
    if (!state.currentUser) {
      window.location.replace('login.html');
      return;
    }

    if (el.userPill) el.userPill.style.display = 'inline-flex';

    const isAdmin = state.currentUser.role === 'admin';
    if (el.userRoleBadge) {
      el.userRoleBadge.textContent = isAdmin ? '👑 แอดมิน' : '🚶 รปภ.';
    }
    if (el.userNameTag) {
      el.userNameTag.textContent = state.currentUser.name || state.currentUser.username;
    }

    // ซ่อนแถบแท็บด้านบนทั้งหมด เพราะแต่ละบทบาทมีหน้าเฉพาะเป็นของตัวเอง
    if (el.navTabsWrap) {
      el.navTabsWrap.style.display = 'none';
    }

    if (isAdmin) {
      // แอดมิน: แสดงเฉพาะหน้าแดชบอร์ดสรุปผลของหัวหน้าเวร (ซ่อนหน้าสำหรับ รปภ. โดยสิ้นเชิง)
      switchTab('supervisor');
    } else {
      // รปภ.: แสดงเฉพาะหน้าระบบบันทึกเวียนตรวจ (ซ่อนหน้าแดชบอร์ดสรุปผลโดยสิ้นเชิง)
      switchTab('guard');
      renderGuardRecentLogs();
    }
  }

  function logout() {
    state.currentUser = null;
    try {
      sessionStorage.clear();
      localStorage.removeItem('yru_sp_session');
    } catch (e) {}
    window.location.replace('login.html');
  }
  window.appLogout = logout;

  // --- TAB SWITCHING ---
  function switchTab(tabName) {
    const isAdmin = state.currentUser && state.currentUser.role === 'admin';

    // บังคับแยกตามสิทธิ์ชัดเจน:
    // แอดมินดูได้เฉพาะหน้า supervisor (แดชบอร์ดสรุปผล)
    // รปภ. ดูได้เฉพาะหน้า guard (เดินตรวจบันทึกจุดตรวจ)
    const effectiveTab = isAdmin ? 'supervisor' : 'guard';

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + effectiveTab);
    }

    const isGuard = effectiveTab === 'guard';

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

  // --- PATROL RECORDING SYSTEM (ระบบบันทึกเวียนตรวจ รปภ. มรย.) ---
  function setupPatrolForm() {
    // 1. Shift buttons
    if (el.shiftPatrolSeg) {
      const shiftBtns = el.shiftPatrolSeg.querySelectorAll('button');
      
      // คำนวณกะปัจจุบันตามเวลาจริงอัตโนมัติ (เช้า 06-14, บ่าย 14-22, ดึก 22-06)
      const curHour = new Date().getHours();
      let autoShift = 'morning';
      let autoShiftName = 'เช้า';
      if (curHour >= 14 && curHour < 22) {
        autoShift = 'afternoon';
        autoShiftName = 'บ่าย';
      } else if (curHour >= 22 || curHour < 6) {
        autoShift = 'night';
        autoShiftName = 'ดึก';
      }
      state.currentShift = autoShift;
      state.currentShiftName = autoShiftName;

      shiftBtns.forEach(btn => {
        if (btn.dataset.shift === autoShift) {
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.setAttribute('aria-pressed', 'false');
        }

        btn.addEventListener('click', () => {
          shiftBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          state.currentShift = btn.dataset.shift || 'morning';
          state.currentShiftName = btn.dataset.val || 'เช้า';
          showToast(`เลือกกะ: ${state.currentShiftName}`);
        });
      });
    }

    // 2. Guard select: Pre-select current user if name matches
    if (el.guardPatrolSelect) {
      if (state.currentUser && state.currentUser.name) {
        for (let opt of el.guardPatrolSelect.options) {
          if (opt.value.includes(state.currentUser.name)) {
            opt.selected = true;
            state.currentGuardName = opt.value;
            break;
          }
        }
      }
      el.guardPatrolSelect.addEventListener('change', (e) => {
        state.currentGuardName = e.target.value;
        showToast(`เลือกเจ้าหน้าที่: ${e.target.value}`);
      });
    }

    // 3. Location toggle between dropdown and custom text input
    if (el.toggleCustomLocBtn) {
      el.toggleCustomLocBtn.addEventListener('click', () => {
        const wrap = document.getElementById('customLocWrap') || el.customLocPatrolInput;
        const isHidden = wrap.style.display === 'none';
        if (isHidden) {
          wrap.style.display = 'block';
          if (el.customLocPatrolInput) el.customLocPatrolInput.style.display = 'block';
          if (el.locPatrolSelect) {
            el.locPatrolSelect.style.display = 'none';
            el.locPatrolSelect.value = '';
          }
          el.toggleCustomLocBtn.innerHTML = '<span>📋</span> เลือกจากรายการ';
          if (el.customLocPatrolInput) el.customLocPatrolInput.focus();
        } else {
          wrap.style.display = 'none';
          if (el.customLocPatrolInput) {
            el.customLocPatrolInput.style.display = 'none';
            el.customLocPatrolInput.value = '';
          }
          if (el.locPatrolSelect) el.locPatrolSelect.style.display = 'block';
          el.toggleCustomLocBtn.innerHTML = '<span>✏️</span> พิมพ์ระบุเอง';
        }
      });
    }

    // 4. Quick note chips
    document.querySelectorAll('.chip-quick-note').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text || chip.textContent.trim();
        if (el.notePatrolInput) {
          const current = el.notePatrolInput.value.trim();
          if (!current) {
            el.notePatrolInput.value = text;
          } else if (!current.includes(text)) {
            el.notePatrolInput.value = current + ' ' + text;
          }
          showToast(`เพิ่มข้อความ: "${text}"`);
          el.notePatrolInput.focus();
        }
      });
    });

    // 4. Camera & Image Compression with Watermark Timestamp & Multi-photo support
    if (el.camPatrolInput) {
      // ตรวจสอบว่าถ้าไม่ใช่ mobile ให้เอา capture="environment" ออก เพื่อให้บนคอมพิวเตอร์/โน้ตบุ๊กเปิดหน้าต่างเลือกไฟล์/เว็บแคมได้ตามปกติ
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (!isMobile) {
        el.camPatrolInput.removeAttribute('capture');
      }
      el.camPatrolInput.addEventListener('change', handlePatrolCameraUpload);
    }

    renderPatrolThumbnails();

    // 5. Speech recognition
    setupPatrolSpeechRecognition();

    // 6. Submit button
    if (el.submitPatrolBtn) {
      el.submitPatrolBtn.addEventListener('click', () => savePatrolRecord(false));
    }

    // 7. SOS button
    if (el.sosPatrolBtn) {
      el.sosPatrolBtn.addEventListener('click', triggerSOS);
    }
  }

  // --- CAMERA & PHOTO PROCESSING (กล้องมือถือ + ประทับเวลาอัตโนมัติ + ดึงรูปเข้าทันที) ---
  async function handlePatrolCameraUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      showToast('⏳ กำลังประมวลผลและประทับเวลาภาพถ่าย...', '📸');
      for (let i = 0; i < files.length; i++) {
        const photoObj = await processPatrolImageFile(files[i]);
        if (!state.capturedImages) state.capturedImages = [];
        state.capturedImages.push(photoObj);
      }
      state.capturedImageBase64 = state.capturedImages[0] ? state.capturedImages[0].dataUrl : null;
      renderPatrolThumbnails();

      const total = state.capturedImages.length;
      if (total === 1) {
        showToast('📸 ได้รูปที่ 1 แล้ว! กรุณาแตะปุ่มเพื่อถ่ายรูปที่ 2 เพิ่มเติม', '📷');
      } else {
        showToast(`✅ ถ่ายภาพสำเร็จเรียบร้อย ดึงเข้าระบบแล้ว (รวม ${total} รูป)`, '✅');
      }
    } catch (err) {
      console.error('Camera processing error:', err);
      showToast('❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', '❌');
    } finally {
      if (el.camPatrolInput) el.camPatrolInput.value = '';
    }
  }

  function processPatrolImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 900;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
              height = Math.round(height * (MAX_SIZE / width));
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width = Math.round(width * (MAX_SIZE / height));
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // คำนวณวันที่และเวลาปัจจุบัน (ภาษาไทย)
            const now = new Date();
            const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
            const thaiYear = (now.getFullYear() + 543).toString().slice(-2);
            const d = now.getDate();
            const m = thaiMonths[now.getMonth()];
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');

            const timeOnlyStr = `${hh}:${mm} น.`;
            const fullStamp = `${d} ${m} ${thaiYear} ${hh}:${mm}:${ss} น.`;

            // วาดลายน้ำระบุเวลาลงบนมุมล่างขวาของรูปภาพโดยตรง
            const fontSize = Math.max(13, Math.round(width * 0.026));
            ctx.font = `600 ${fontSize}px 'Sarabun', 'Prompt', sans-serif`;
            const stampText = `🕒 ${fullStamp}`;
            const metrics = ctx.measureText(stampText);
            const padX = 10;
            const padY = 6;
            const boxW = metrics.width + (padX * 2);
            const boxH = fontSize + (padY * 2);
            const boxX = width - boxW - 12;
            const boxY = height - boxH - 12;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            } else {
              ctx.rect(boxX, boxY, boxW, boxH);
            }
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'middle';
            ctx.fillText(stampText, boxX + padX, boxY + (boxH / 2));

            const base64 = canvas.toDataURL('image/jpeg', 0.65);
            resolve({
              dataUrl: base64,
              timeStr: timeOnlyStr,
              fullStamp: fullStamp,
              timestamp: Date.now()
            });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPatrolThumbnails() {
    if (!state.capturedImages) {
      state.capturedImages = [];
    }

    const count = state.capturedImages.length;
    state.capturedImageBase64 = count > 0 ? state.capturedImages[0].dataUrl : null;

    // อัปเดตแถบป้ายเตือนจำนวนรูปภาพ
    if (el.photoCountBadge) {
      if (count === 0) {
        el.photoCountBadge.className = 'photo-req-badge photo-req-warn';
        el.photoCountBadge.innerHTML = '⚠️ ยังไม่ได้ถ่ายรูป (0/2 รูป)';
      } else if (count === 1) {
        el.photoCountBadge.className = 'photo-req-badge photo-req-warn';
        el.photoCountBadge.innerHTML = '⚠️ ถ่ายแล้ว 1 รูป (ต้องถ่ายเพิ่มอีก 1 รูป)';
      } else {
        el.photoCountBadge.className = 'photo-req-badge photo-req-ok';
        el.photoCountBadge.innerHTML = `✅ ถ่ายแล้ว ${count} รูป (ครบตามเกณฑ์ 2+ รูป)`;
      }
    }

    // อัปเดตข้อความบนปุ่มกล้องให้เข้าใจง่าย
    if (el.camBtnMainText && el.camBtnSubText) {
      if (count === 0) {
        el.camBtnMainText.textContent = 'แตะที่นี่เพื่อเปิดกล้องถ่ายภาพหน้างาน';
        el.camBtnSubText.textContent = 'ถ่ายเสร็จจะดึงรูปเข้ามาใส่ทันที (บังคับถ่าย 2 รูปขึ้นไป)';
      } else if (count === 1) {
        el.camBtnMainText.textContent = '📸 แตะเพื่อเปิดกล้องถ่ายรูปที่ 2 เพิ่มเติม';
        el.camBtnSubText.textContent = 'ถ่ายรูปที่ 1 เข้ามาแล้ว — แตะเพื่อถ่ายรูปที่ 2 ให้ครบเกณฑ์';
      } else {
        el.camBtnMainText.textContent = `📸 แตะเพื่อเปิดกล้องถ่ายรูปเพิ่มเติม (ถ่ายแล้ว ${count} รูป)`;
        el.camBtnSubText.textContent = 'ครบตามเกณฑ์ 2 รูปแล้ว — สามารถแตะถ่ายรูปเพิ่มได้ตามต้องการ';
      }
    }

    // แสดงพรีวิวรูปภาพ พร้อมเวลาถ่ายตัวเล็กๆ
    if (el.thumbPatrolContainer) {
      if (count === 0) {
        el.thumbPatrolContainer.innerHTML = '';
        return;
      }

      el.thumbPatrolContainer.innerHTML = state.capturedImages.map((imgObj, idx) => `
        <div class="thumb-card">
          <div class="thumb">
            <img src="${imgObj.dataUrl}" alt="รูปถ่ายหลักฐานที่ ${idx + 1}">
            <button type="button" class="remove-single-patrol-img" data-index="${idx}" title="ลบรูปที่ ${idx + 1}">✖</button>
            <span class="thumb-idx-badge">#${idx + 1}</span>
          </div>
          <div class="thumb-caption">
            <span class="thumb-time-text">🕒 ถ่ายเวลา ${imgObj.timeStr}</span>
          </div>
        </div>
      `).join('');

      // เพิ่ม Event Listener สำหรับปุ่มลบรูปแต่ละใบ
      const removeBtns = el.thumbPatrolContainer.querySelectorAll('.remove-single-patrol-img');
      removeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          removePatrolImage(idx);
        });
      });
    }
  }

  function removePatrolImage(index) {
    if (typeof index === 'number') {
      state.capturedImages.splice(index, 1);
      showToast('🗑️ ลบรูปภาพเรียบร้อยแล้ว');
    } else {
      state.capturedImages = [];
    }
    state.capturedImageBase64 = state.capturedImages[0] ? state.capturedImages[0].dataUrl : null;
    if (el.camPatrolInput) el.camPatrolInput.value = '';
    renderPatrolThumbnails();
  }

  // --- SPEECH RECOGNITION (พิมพ์ด้วยเสียงภาษาไทย) ---
  let activePatrolRec = null;
  let speechAccumulated = '';
  let noteBeforeSpeech = '';

  function playMicChime(start = true) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (start) {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // AudioContext might be restricted until user gesture; ignore
    }
  }

  function setListeningState(isListening) {
    state.isRecordingVoice = isListening;
    if (el.micPatrolBtn) {
      if (isListening) {
        el.micPatrolBtn.classList.add('on');
        el.micPatrolBtn.title = 'กำลังฟังเสียง... แตะเพื่อหยุด';
      } else {
        el.micPatrolBtn.classList.remove('on');
        el.micPatrolBtn.title = 'กดเพื่อเริ่มพูดภาษาไทย';
      }
    }
    if (el.notePatrolInput) {
      if (isListening) {
        el.notePatrolInput.classList.add('is-listening');
      } else {
        el.notePatrolInput.classList.remove('is-listening');
      }
    }
    const bar = document.getElementById('micListeningBar');
    if (bar) {
      bar.style.display = isListening ? 'flex' : 'none';
    }
  }

  async function togglePatrolSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    // หากกำลังฟังอยู่ -> ให้หยุดฟังทันที
    if (state.isRecordingVoice && activePatrolRec) {
      try {
        activePatrolRec.stop();
      } catch (e) {}
      return;
    }

    // หากเบราว์เซอร์ไม่รองรับ Web Speech API
    if (!SpeechRec) {
      showToast('💡 แตะที่ช่องพิมพ์ แล้วกดปุ่มรูปไมค์ 🎙️ บนแป้นพิมพ์มือถือเพื่อพูดภาษาไทยได้ทันที', '🎙️');
      if (el.notePatrolInput) {
        el.notePatrolInput.focus();
      }
      return;
    }

    // ขออนุญาตใช้ไมโครโฟนล่วงหน้า (เผื่อสิทธิ์ยังไม่ได้อนุญาต)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.warn('Microphone permission:', permErr);
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          showToast('⚠️ กรุณากด "อนุญาต" สิทธิ์การใช้ไมโครโฟนในเบราว์เซอร์', '🔒');
          return;
        }
      }
    }

    try {
      activePatrolRec = new SpeechRec();
      activePatrolRec.lang = 'th-TH';
      activePatrolRec.continuous = true;
      activePatrolRec.interimResults = true;
      activePatrolRec.maxAlternatives = 1;

      noteBeforeSpeech = el.notePatrolInput ? el.notePatrolInput.value.trim() : '';
      speechAccumulated = '';

      activePatrolRec.onstart = () => {
        setListeningState(true);
        playMicChime(true);
        if (navigator.vibrate) navigator.vibrate(60);
        showToast('🎙️ กำลังฟังเสียงพูดภาษาไทย... พูดได้เลย', '🔴');
      };

      activePatrolRec.onresult = (evt) => {
        let interimText = '';
        let currentFinal = '';

        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          const res = evt.results[i];
          if (res.isFinal) {
            currentFinal += res[0].transcript;
          } else {
            interimText += res[0].transcript;
          }
        }

        if (currentFinal) {
          speechAccumulated += (speechAccumulated ? ' ' : '') + currentFinal.trim();
        }

        const combined = (speechAccumulated + (interimText ? ' ' + interimText : '')).trim();
        if (el.notePatrolInput && combined) {
          el.notePatrolInput.value = noteBeforeSpeech
            ? noteBeforeSpeech + ' ' + combined
            : combined;
          el.notePatrolInput.scrollTop = el.notePatrolInput.scrollHeight;
        }
      };

      activePatrolRec.onerror = (evt) => {
        console.warn('Speech recognition error:', evt.error);
        if (evt.error === 'not-allowed') {
          showToast('⚠️ ไมโครโฟนถูกปิดกั้น กรุณาอนุญาตสิทธิ์ในตั้งค่าเบราว์เซอร์', '🔒');
        } else if (evt.error === 'no-speech') {
          showToast('⚠️ ไม่ได้ยินเสียงพูด แตะปุ่มไมค์แล้วพูดใหม่อีกครั้งใกล้ๆ ไมค์', '🎙️');
        } else if (evt.error === 'network') {
          showToast('⚠️ ระบบแปลงเสียงต้องการการเชื่อมต่ออินเทอร์เน็ต', '📡');
        }
      };

      activePatrolRec.onend = () => {
        setListeningState(false);
        playMicChime(false);
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
        if (speechAccumulated.trim()) {
          showToast('✅ พิมพ์ข้อความจากเสียงเรียบร้อยแล้ว', '✅');
        }
        activePatrolRec = null;
      };

      activePatrolRec.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setListeningState(false);
      showToast('⚠️ ไม่สามารถเปิดไมโครโฟนได้ กรุณาลองใหม่อีกครั้ง');
    }
  }

  function setupPatrolSpeechRecognition() {
    if (el.micPatrolBtn) {
      el.micPatrolBtn.addEventListener('click', togglePatrolSpeechRecognition);
    }
    const stopBtn = document.getElementById('stopListeningBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (activePatrolRec) {
          try {
            activePatrolRec.stop();
          } catch (e) {}
        }
      });
    }
  }

  function triggerSOS() {
    const confirmed = confirm('🚨 ยืนยันแจ้งเหตุฉุกเฉิน (SOS)?\n\nระบบจะส่งข้อมูลแจ้งเหตุฉุกเฉินและแจ้งเตือนหัวหน้าเวรทันที\nคุณต้องการแจ้งเหตุด่วนฉุกเฉินใช่หรือไม่?');
    if (confirmed) {
      savePatrolRecord(true);
    }
  }

  async function savePatrolRecord(isSOS = false) {
    const btn = el.submitPatrolBtn;
    const guardVal = el.guardPatrolSelect ? el.guardPatrolSelect.value : '';
    let locVal = el.locPatrolSelect ? el.locPatrolSelect.value : '';
    const customLocVal = el.customLocPatrolInput ? el.customLocPatrolInput.value.trim() : '';
    let notes = el.notePatrolInput ? el.notePatrolInput.value.trim() : '';
    let isRisk = el.riskPatrolChk ? el.riskPatrolChk.checked : false;

    const isCustomLoc = Boolean(customLocVal);
    if (isCustomLoc) {
      locVal = customLocVal + ' (นอกจุดตรวจ)';
    }

    // Validation
    if (!isSOS && (!guardVal || (!locVal && !customLocVal))) {
      showToast('⚠️ กรุณาเลือกชื่อเจ้าหน้าที่ รปภ. และระบุสถานที่/อาคารให้ชัดเจน', '⚠️');
      return;
    }

    // Validation: บังคับถ่ายรูป 2 รูปขึ้นไปเพื่อเป็นหลักฐาน
    const photoCount = (state.capturedImages && state.capturedImages.length) || 0;
    if (!isSOS && photoCount < 2) {
      showToast(`⚠️ บังคับถ่ายภาพอย่างน้อย 2 รูปขึ้นไปเพื่อเป็นหลักฐาน (ขณะนี้มี ${photoCount}/2 รูป)`, '⚠️');
      if (el.triggerCamBtn) {
        el.triggerCamBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.triggerCamBtn.classList.add('shake-highlight');
        setTimeout(() => el.triggerCamBtn.classList.remove('shake-highlight'), 1200);
      }
      return;
    }

    // If SOS
    if (isSOS) {
      isRisk = true;
      notes = '🚨 แจ้งเหตุฉุกเฉิน (SOS)! ' + (notes || 'ต้องการความช่วยเหลือเร่งด่วน ณ จุดตรวจ');
      if (!locVal && !customLocVal) {
        locVal = 'แจ้งเหตุด่วนฉุกเฉิน (ไม่ระบุจุดตรวจ)';
      }
    }

    if (!isSOS && btn) {
      btn.disabled = true;
      btn.textContent = '⏳ กำลังบันทึกข้อมูล...';
    }

    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const shiftMap = {
      'เช้า': 'morning',
      'บ่าย': 'afternoon',
      'ดึก': 'night',
      'morning': 'morning',
      'afternoon': 'afternoon',
      'night': 'night'
    };
    const shiftCode = shiftMap[state.currentShift] || 'morning';
    const shiftName = state.currentShiftName || 'เช้า';

    // Normalize guard display name
    let cleanGuardName = guardVal;
    if (cleanGuardName.match(/^\d+\s/)) {
      cleanGuardName = cleanGuardName.substring(cleanGuardName.indexOf(' ') + 1);
    }
    if (!cleanGuardName) {
      cleanGuardName = state.currentUser ? state.currentUser.name : 'เจ้าหน้าที่ รปภ.';
    }

    const record = {
      id: 'rec-' + Date.now(),
      date: isoDate,
      time: timeStr,
      shift: shiftCode,
      round: `กะ${shiftName} (เวียนตรวจ)`,
      guardId: state.currentGuardId || 'g1',
      guardName: cleanGuardName,
      cpId: isCustomLoc ? 'off-checkpoint' : 'cp-yru',
      cpCode: isCustomLoc ? 'OFF-CP' : 'CP-YRU',
      cpName: locVal,
      isRisk: isRisk,
      isOffCheckpoint: isCustomLoc,
      status: isSOS ? 'alert' : (isRisk ? 'alert' : 'ok'),
      note: notes || (isSOS ? '🚨 แจ้งเหตุฉุกเฉิน' : 'ปกติ เรียบร้อยดี'),
      images: (state.capturedImages && state.capturedImages.length > 0)
        ? state.capturedImages.map(img => img.dataUrl)
        : (state.capturedImageBase64 ? [state.capturedImageBase64] : [])
    };

    // บันทึกลงฐานข้อมูล SQL (SQL INSERT INTO patrol_records)
    if (window.AppDB) {
      await window.AppDB.query(
        `INSERT INTO patrol_records (id, date, time, shift, round, guard_id, guard_name, cp_id, cp_code, cp_name, is_risk, is_off_checkpoint, status, note, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [record.id, record.date, record.time, record.shift, record.round, record.guardId, record.guardName, record.cpId, record.cpCode, record.cpName, record.isRisk ? 1 : 0, record.isOffCheckpoint ? 1 : 0, record.status, record.note, record.images, new Date().toISOString()]
      );
    }

    // Save record to history
    state.history.unshift(record);
    saveToLocalStorage();

    // Re-render UI
    renderSupervisorDashboard();
    renderGuardRecentLogs();

    if (isSOS) {
      showToast('🚨 ส่งแจ้งเหตุฉุกเฉินเรียบร้อยแล้ว!', '🚨');
    } else {
      showToast(`✅ บันทึกเวียนตรวจเรียบร้อย: ${locVal} (${timeStr} น.)`, '✅');
    }

    // Reset fields for next checkpoint
    const wrap = document.getElementById('customLocWrap');
    if (wrap) wrap.style.display = 'none';
    if (el.locPatrolSelect) {
      el.locPatrolSelect.value = '';
      el.locPatrolSelect.style.display = 'block';
    }
    if (el.customLocPatrolInput) {
      el.customLocPatrolInput.value = '';
      el.customLocPatrolInput.style.display = 'none';
    }
    if (el.toggleCustomLocBtn) {
      el.toggleCustomLocBtn.innerHTML = '<span>✏️</span> พิมพ์ระบุเอง';
    }
    if (el.riskPatrolChk) el.riskPatrolChk.checked = false;
    if (el.notePatrolInput) el.notePatrolInput.value = '';
    removePatrolImage();

    if (!isSOS && btn) {
      btn.disabled = false;
      btn.textContent = '💾 บันทึกข้อมูลเข้าสู่ระบบ';
    }
  }

  function renderGuardRecentLogs() {
    if (!el.guardRecentLogs) return;

    const today = new Date();
    const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const recent = state.history.filter(h => h.date === isoToday).slice(0, 10);

    if (el.guardLogCount) {
      el.guardLogCount.textContent = `${recent.length} รายการวันนี้`;
    }

    if (recent.length === 0) {
      el.guardRecentLogs.innerHTML = `
        <div style="text-align:center; padding: 36px 20px; color: var(--muted); font-size: 15px; border: 1.5px dashed var(--line); border-radius: 14px; background: var(--surface-alt);">
          <div style="font-size: 32px; margin-bottom: 8px;">🛡️</div>
          <b>ยังไม่มีรายการบันทึกเวียนตรวจในวันนี้</b>
          <p style="margin: 4px 0 0; font-size: 13px;">เลือกสถานที่และกรอกข้อมูลด้านบน จากนั้นกดปุ่มบันทึกเพื่อเริ่มเก็บประวัติ</p>
        </div>
      `;
      return;
    }

    el.guardRecentLogs.innerHTML = recent.map(item => {
      const isOk = item.status === 'ok';
      let cardClass = 'recent-log-card';
      if (!isOk || item.isOffCheckpoint) cardClass += ' is-alert';
      else if (item.isRisk) cardClass += ' is-risk';

      let badgeHtml = isOk
        ? `<span class="tag ok" style="font-size:12px;">✅ ปกติ</span>`
        : `<span class="tag alert" style="font-size:12px;">🚨 มีเหตุผิดปกติ</span>`;
      
      if (item.isRisk) {
        badgeHtml += ` <span class="tag risk" style="font-size:12px;">⚠️ จุดเสี่ยง</span>`;
      }
      if (item.isOffCheckpoint) {
        badgeHtml = `<span class="tag alert" style="background:#dc2626; color:#fff; font-size:12px;">🚨 เหตุด่วนนอกจุด</span>`;
      }

      let imgHtml = '';
      if (item.images && item.images.length > 0) {
        imgHtml = `
          <div class="recent-log-photos" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            ${item.images.map((img, i) => `
              <a href="${img}" target="_blank" class="recent-log-img-link" title="แตะเพื่อดูภาพขนาดเต็ม (รูปที่ ${i + 1})">
                <img src="${img}" alt="ภาพหลักฐานที่ ${i + 1}" style="width:72px; height:72px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line); box-shadow:0 2px 6px rgba(0,0,0,0.08);">
              </a>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="${cardClass}">
          <div class="recent-log-top">
            <span class="recent-log-location">${escapeHtml(item.cpName)}</span>
            <span class="recent-log-time">${item.time} น.</span>
          </div>
          <div class="recent-log-meta">
            ${badgeHtml}
            <span style="font-size:13px; color:var(--muted);">ผู้ตรวจ: <b>${escapeHtml(item.guardName)}</b></span>
            <span style="font-size:13px; color:var(--muted);">${escapeHtml(item.round || '')}</span>
          </div>
          <p class="recent-log-note">${escapeHtml(item.note || '-')}</p>
          ${imgHtml}
        </div>
      `;
    }).join('');
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
      const msg = state.history.length === 0
        ? 'ยังไม่มีข้อมูลการเวียนตรวจในระบบ (ฐานข้อมูล SQL ว่างเปล่า พร้อมบันทึกข้อมูลจริง)'
        : 'ไม่พบข้อมูลตามตัวกรองที่เลือก';
      el.reportTableBody.innerHTML = `
        <tr><td colspan="8" class="empty" style="text-align:center; padding:32px 16px; color:var(--muted);">
          <div style="font-size:28px; margin-bottom:8px;">📋</div>
          <b>${msg}</b>
        </td></tr>
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
            <td style="text-align: center;">
              <div class="admin-action-group">
                <button type="button" class="btn-action-edit" onclick="window.appOpenAdminEdit('${item.id}')" title="คลิกเพื่อตรวจสอบหรือแก้ไขข้อมูลรายการนี้">
                  ✏️ แก้ไขข้อมูล
                </button>
                <button type="button" class="btn-action-delete" onclick="window.appDeleteRecord('${item.id}')" title="คลิกเพื่อลบข้อมูลรายการนี้">
                  🗑️ ลบ
                </button>
              </div>
            </td>
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
          <div style="margin-top: 10px; display: flex; gap: 8px;">
            <button type="button" class="btn-action-edit" onclick="window.appOpenAdminEdit('${inc.id}')">
              ✏️ ตรวจสอบ / แก้ไขข้อมูลเหตุการณ์นี้ (แอดมิน)
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // --- ADMIN EDIT & INSPECT MODAL ---
  window.appOpenAdminEdit = function (recordId) {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
      showToast('⚠️ สิทธิ์ไม่เพียงพอ เฉพาะแอดมินเท่านั้น', '🔒');
      return;
    }

    const record = state.history.find(h => h.id === recordId);
    if (!record) {
      showToast('⚠️ ไม่พบข้อมูลรายการนี้', '⚠️');
      return;
    }

    el.adminEditRecordId.value = record.id;
    el.adminEditDate.value = record.date || '';
    el.adminEditTime.value = record.time || '';
    el.adminEditCpName.value = record.cpName || '';
    el.adminEditGuardName.value = record.guardName || '';
    el.adminEditShift.value = record.shift || 'morning';
    el.adminEditRound.value = record.round || '';
    el.adminEditNote.value = record.note || '';

    setAdminStatusSelection(record.status || 'ok');

    state.adminEditPhotos = record.images ? [...record.images] : [];
    renderAdminEditPhotos();

    el.adminEditVeil.removeAttribute('hidden');
    el.adminEditVeil.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  function closeAdminEditModal() {
    el.adminEditVeil.setAttribute('hidden', '');
    el.adminEditVeil.style.display = 'none';
    document.body.style.overflow = '';
  }

  function setAdminStatusSelection(status) {
    state.selectedAdminEditStatus = status;
    if (status === 'ok') {
      el.adminStatusOkBtn.setAttribute('aria-pressed', 'true');
      el.adminStatusAlertBtn.setAttribute('aria-pressed', 'false');
    } else {
      el.adminStatusOkBtn.setAttribute('aria-pressed', 'false');
      el.adminStatusAlertBtn.setAttribute('aria-pressed', 'true');
    }
  }

  function renderAdminEditPhotos() {
    if (!state.adminEditPhotos.length) {
      el.adminEditPhotoThumbs.innerHTML = '<span style="font-size:14px; color:var(--muted)">ไม่มีรูปถ่ายแนบ</span>';
      return;
    }

    el.adminEditPhotoThumbs.innerHTML = state.adminEditPhotos.map((src, index) => `
      <div class="thumb">
        <img src="${src}" alt="รูปหลักฐาน ${index + 1}">
        <button type="button" onclick="window.appRemoveAdminEditPhoto(${index})" title="ลบภาพนี้">✕</button>
      </div>
    `).join('');
  }

  window.appRemoveAdminEditPhoto = function (index) {
    state.adminEditPhotos.splice(index, 1);
    renderAdminEditPhotos();
  };

  async function saveAdminEditRecord() {
    const id = el.adminEditRecordId.value;
    const index = state.history.findIndex(h => h.id === id);
    if (index === -1) return;

    const oldRecord = state.history[index];
    const updatedRecord = {
      ...oldRecord,
      date: el.adminEditDate.value,
      time: el.adminEditTime.value,
      cpName: el.adminEditCpName.value.trim(),
      guardName: el.adminEditGuardName.value.trim(),
      shift: el.adminEditShift.value,
      round: el.adminEditRound.value.trim(),
      status: state.selectedAdminEditStatus,
      note: el.adminEditNote.value.trim(),
      images: [...state.adminEditPhotos]
    };

    state.history[index] = updatedRecord;

    // อัปเดตในฐานข้อมูล SQL (SQL UPDATE)
    if (window.AppDB) {
      await window.AppDB.query(
        `UPDATE patrol_records SET status = ?, note = ?, is_risk = ?, images = ? WHERE id = ?`,
        [updatedRecord.status, updatedRecord.note, updatedRecord.isRisk ? 1 : 0, updatedRecord.images, updatedRecord.id]
      );
    }

    // อัปเดตในรอบตรวจปัจจุบันถ้าตรงกัน
    if (updatedRecord.cpId && state.roundChecks[updatedRecord.cpId]) {
      state.roundChecks[updatedRecord.cpId] = {
        ...state.roundChecks[updatedRecord.cpId],
        time: updatedRecord.time,
        status: updatedRecord.status,
        note: updatedRecord.note,
        guardName: updatedRecord.guardName,
        images: [...updatedRecord.images]
      };
    }

    saveToLocalStorage();
    closeAdminEditModal();
    renderSupervisorDashboard();
    renderGuardRecentLogs();
    showToast('💾 แอดมินบันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว', '✅');
  }

  window.appDeleteRecord = function (recordId) {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
      showToast('⚠️ สิทธิ์ไม่เพียงพอ เฉพาะแอดมินเท่านั้น', '🔒');
      return;
    }

    deleteAdminRecord(recordId);
  };

  async function deleteAdminRecord(recordId) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกรายการนี้ออกจากระบบอย่างถาวร?')) {
      return;
    }

    const rec = state.history.find(h => h.id === recordId);
    if (rec && rec.cpId && state.roundChecks[rec.cpId]) {
      delete state.roundChecks[rec.cpId];
    }

    state.history = state.history.filter(h => h.id !== recordId);

    // ลบจากฐานข้อมูล SQL (SQL DELETE FROM)
    if (window.AppDB) {
      await window.AppDB.query(`DELETE FROM patrol_records WHERE id = ?`, [recordId]);
    }

    saveToLocalStorage();

    closeAdminEditModal();
    renderSupervisorDashboard();
    renderGuardRecentLogs();
    showToast('🗑️ ลบบันทึกข้อมูลเรียบร้อยแล้ว', '✅');
  }

  // --- SQL LOGS MODAL ---
  function openSqlLogsModal() {
    if (!el.sqlLogsModal || !el.sqlLogsContainer) return;
    const logs = window.AppDB ? window.AppDB.getQueryLogs() : [];
    if (logs.length === 0) {
      el.sqlLogsContainer.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">ยังไม่มีประวัติคำสั่ง SQL ที่บันทึก</div>';
    } else {
      el.sqlLogsContainer.innerHTML = logs.map((log, idx) => `
        <div style="margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">
          <div style="color:#64748b; font-size:11px;">#${logs.length - idx} · เวลา ${log.timestamp}</div>
          <div style="color:#38bdf8; font-family:monospace; margin-top:2px; word-break:break-all;">${escapeHtml(log.sql)}</div>
        </div>
      `).join('');
    }
    el.sqlLogsModal.removeAttribute('hidden');
    el.sqlLogsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeSqlLogsModal() {
    if (el.sqlLogsModal) {
      el.sqlLogsModal.setAttribute('hidden', '');
      el.sqlLogsModal.style.display = 'none';
      document.body.style.overflow = '';
    }
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
