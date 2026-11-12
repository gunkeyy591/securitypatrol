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
    quickSwitchViewBtn: document.getElementById('quickSwitchViewBtn'),
    
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

    // Supervisor panel & Cloud sync
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
    syncCloudBtn: document.getElementById('syncCloudBtn'),
    cloudSyncStatusText: document.getElementById('cloudSyncStatusText'),
    adminGoToGuardBtn: document.getElementById('adminGoToGuardBtn'),

    // Patrol Success Modal
    patrolSuccessModal: document.getElementById('patrolSuccessModal'),
    patrolSuccessSummary: document.getElementById('patrolSuccessSummary'),
    btnGoToAdminFromModal: document.getElementById('btnGoToAdminFromModal'),
    btnCloseSuccessModal: document.getElementById('btnCloseSuccessModal'),

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
    setupClock();

    // บังคับตรวจสอบ sessionStorage ในแท็บปัจจุบัน เพื่อให้เข้าหน้าล็อกอินทุกครั้งที่เปิดเข้าเว็บใหม่
    const savedSession = sessionStorage.getItem('yru_sp_session');
    if (!savedSession) {
      sessionStorage.removeItem('yru_sp_session');
      localStorage.removeItem('yru_sp_session');
      window.location.replace('login.html');
      return;
    }

    await loadFromLocalStorage();
    setupTheme();
    setupAuth();
    bindEvents();
    setupPatrolForm();
    renderGuardRecentLogs();
    renderSupervisorDashboard();
    applyAuthUI();
    setupCloudSyncReceiver();

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
      console.warn('Storage save failed, applying fallback compression:', err);
      try {
        const trimmedHistory = state.history.map((r, idx) => {
          if (idx > 20 && r.images && r.images.length > 0) {
            return { ...r, images: [] }; // ลดรูปถ่ายเก่าป้องกัน quota เต็ม
          }
          return r;
        });
        localStorage.setItem('yru_sp_history', JSON.stringify(trimmedHistory));
      } catch (fallbackErr) {
        console.error('Fatal storage save failed:', fallbackErr);
      }
    }
  }

  // --- CLOCK & DATE ---
  function setupClock() {
    if (window.__securityPatrolClockStarted) return;
    window.__securityPatrolClockStarted = true;

    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    function tick() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      if (el.clockTime) {
        el.clockTime.textContent = `${h}:${m}:${s} น.`;
      }

      const d = now.getDate();
      const mon = thaiMonths[now.getMonth()];
      const y = (now.getFullYear() + 543) % 100;
      if (el.clockDate) {
        el.clockDate.textContent = `${d} ${mon} ${y}`;
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  // --- THEME ---
  const SVG_SUN = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const SVG_MOON = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function setupTheme() {
    const saved = localStorage.getItem('yru_sp_theme_v2');
    const theme = saved || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (el.themeToggle) {
      el.themeToggle.innerHTML = theme === 'dark' ? SVG_SUN : SVG_MOON;
      el.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('yru_sp_theme_v2', next);
        el.themeToggle.innerHTML = next === 'dark' ? SVG_SUN : SVG_MOON;
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

      const micSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';

      rec.onstart = () => {
        state.isRecordingVoice = true;
        const activeBtn = state.activeMicTarget === 'sheet' ? el.micBtn : el.offCpMicBtn;
        activeBtn.classList.add('on');
        activeBtn.innerHTML = `${micSvg} กำลังฟังเสียง... พูดได้เลย`;
        showToast('กำลังฟังเสียงพูดภาษาไทย...');
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
        if (el.micBtn) {
          el.micBtn.classList.remove('on');
          el.micBtn.innerHTML = `${micSvg} กดเพื่อเริ่มพูด`;
        }
        if (el.offCpMicBtn) {
          el.offCpMicBtn.classList.remove('on');
          el.offCpMicBtn.innerHTML = `${micSvg} กดเพื่อเริ่มพูด`;
        }
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

    // Quick switch role / view button
    if (el.quickSwitchViewBtn) {
      el.quickSwitchViewBtn.addEventListener('click', toggleQuickView);
    }
    if (el.adminGoToGuardBtn) {
      el.adminGoToGuardBtn.addEventListener('click', () => switchTab('guard'));
    }
    if (el.syncCloudBtn) {
      el.syncCloudBtn.addEventListener('click', syncLatestFromCloud);
    }
    if (el.btnGoToAdminFromModal) {
      el.btnGoToAdminFromModal.addEventListener('click', () => {
        closePatrolSuccessModal();
        switchTab('supervisor');
      });
    }
    if (el.btnCloseSuccessModal) {
      el.btnCloseSuccessModal.addEventListener('click', () => {
        closePatrolSuccessModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function toggleQuickView() {
    const isGuardVisible = el.panelGuard && !el.panelGuard.hasAttribute('hidden') && el.panelGuard.style.display !== 'none';
    if (isGuardVisible) {
      switchTab('supervisor');
    } else {
      switchTab('guard');
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
      switchTab('supervisor');
    } else {
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
    let target = tabName || (state.currentUser && state.currentUser.role === 'admin' ? 'supervisor' : 'guard');

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + target);
    }

    const isGuard = target === 'guard';
    document.body.classList.add('wide');

    if (isGuard) {
      if (el.panelGuard) {
        el.panelGuard.removeAttribute('hidden');
        el.panelGuard.style.display = 'block';
      }
      if (el.panelSupervisor) {
        el.panelSupervisor.setAttribute('hidden', '');
        el.panelSupervisor.style.display = 'none';
      }
      renderGuardRecentLogs();
    } else {
      if (el.panelGuard) {
        el.panelGuard.setAttribute('hidden', '');
        el.panelGuard.style.display = 'none';
      }
      if (el.panelSupervisor) {
        el.panelSupervisor.removeAttribute('hidden');
        el.panelSupervisor.style.display = 'block';
      }
      reloadFromStorageAndRender();
      pollRecentCloudRecords();
    }

    if (el.quickSwitchViewBtn) {
      if (isGuard) {
        el.quickSwitchViewBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> <span>สลับดูหน้าแอดมิน</span>';
        el.quickSwitchViewBtn.title = 'สลับไปดูหน้าสรุปผลและรายงานสำหรับผู้ดูแลระบบ';
      } else {
        el.quickSwitchViewBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> <span>สลับไปหน้า รปภ.</span>';
        el.quickSwitchViewBtn.title = 'สลับไปหน้าแบบฟอร์มบันทึกเวียนตรวจของ รปภ.';
      }
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

    // 2. Guard select: Pre-select current user or default to first guard
    if (el.guardPatrolSelect) {
      let matched = false;
      if (state.currentUser && state.currentUser.name) {
        for (let opt of el.guardPatrolSelect.options) {
          if (opt.value && (opt.value.includes(state.currentUser.name) || state.currentUser.name.includes(opt.value))) {
            opt.selected = true;
            state.currentGuardName = opt.value;
            matched = true;
            break;
          }
        }
      }
      // หากไม่มีชื่อตรง ให้เลือกเจ้าหน้าที่นายแรกเป็นค่าเริ่มต้น (1 นายรอแม กามา) ทันที
      if (!matched && el.guardPatrolSelect.options.length > 1) {
        el.guardPatrolSelect.selectedIndex = 1;
        state.currentGuardName = el.guardPatrolSelect.value;
      }

      el.guardPatrolSelect.addEventListener('change', (e) => {
        state.currentGuardName = e.target.value;
        el.guardPatrolSelect.classList.remove('shake-highlight', 'field-error');
        savePatrolFormDraft();
        showToast(`เลือกเจ้าหน้าที่: ${e.target.value}`);
      });
    }

    if (el.locPatrolSelect) {
      el.locPatrolSelect.addEventListener('change', () => {
        el.locPatrolSelect.classList.remove('shake-highlight', 'field-error');
        savePatrolFormDraft();
      });
    }

    if (el.customLocPatrolInput) {
      el.customLocPatrolInput.addEventListener('input', () => {
        savePatrolFormDraft();
      });
    }

    if (el.notePatrolInput) {
      el.notePatrolInput.addEventListener('input', () => {
        savePatrolFormDraft();
      });
    }

    if (el.riskPatrolChk) {
      el.riskPatrolChk.addEventListener('change', () => {
        savePatrolFormDraft();
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
          el.toggleCustomLocBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> เลือกจากรายการ';
          if (el.customLocPatrolInput) el.customLocPatrolInput.focus();
        } else {
          wrap.style.display = 'none';
          if (el.customLocPatrolInput) {
            el.customLocPatrolInput.style.display = 'none';
            el.customLocPatrolInput.value = '';
          }
          if (el.locPatrolSelect) el.locPatrolSelect.style.display = 'block';
          el.toggleCustomLocBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> พิมพ์ระบุเอง';
        }
        savePatrolFormDraft();
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
          savePatrolFormDraft();
          showToast(`เพิ่มข้อความ: "${text}"`);
          el.notePatrolInput.focus();
        }
      });
    });

    // 4. Camera & Image Compression with Watermark Timestamp & Multi-photo support (Android + iOS + Desktop)
    if (el.triggerCamBtn) {
      el.triggerCamBtn.addEventListener('click', (e) => {
        e.preventDefault();
        savePatrolFormDraft();
        openLivePatrolCamera();
      });
    }

    if (el.camPatrolInput) {
      // บังคับตั้งค่า capture="environment" เสมอสำหรับ Fallback เพื่อให้เปิดกล้องหลังโดยตรง
      el.camPatrolInput.setAttribute('capture', 'environment');
      el.camPatrolInput.setAttribute('accept', 'image/*');
      el.camPatrolInput.addEventListener('change', handlePatrolCameraUpload);
    }

    setupLiveCameraModalEvents();

    // กู้คืนข้อมูลและรูปที่ถ่ายค้างไว้ (กรณีมือถือ Android รีโหลดหน้าเว็บหลังกลับจากแอปกล้อง)
    restorePatrolFormDraft();
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

  // --- CAMERA & PHOTO PROCESSING (เปิดกล้องสดโดยตรงบน Android ทุกรุ่น + iOS ไม่ผ่านอัลบั้มรูป + ประทับเวลาอัตโนมัติ) ---
  const PATROL_DRAFT_STORAGE_KEY = 'yru_sp_patrol_draft';
  let isProcessingPatrolCamera = false;
  let liveCameraStream = null;
  let liveCameraFacingMode = 'environment';
  let liveCameraClockTimer = null;

  function setupLiveCameraModalEvents() {
    const closeBtn = document.getElementById('btnCloseLiveCam');
    const doneBtn = document.getElementById('btnDoneLiveCam');
    const snapBtn = document.getElementById('btnSnapLivePhoto');
    const switchBtn = document.getElementById('btnSwitchCamera');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeLivePatrolCamera());
    }
    if (doneBtn) {
      doneBtn.addEventListener('click', () => closeLivePatrolCamera());
    }
    if (snapBtn) {
      snapBtn.addEventListener('click', () => snapLivePatrolPhoto());
    }
    if (switchBtn) {
      switchBtn.addEventListener('click', () => switchLiveCameraFacing());
    }

    const retryBtn = document.getElementById('btnRetryLiveCam');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        try {
          await startLiveCameraInModal();
        } catch (err) {
          stopLiveCameraStreamOnly();
          showLiveCamError(err);
        }
      });
    }

    const extBtn = document.getElementById('btnOpenExternalBrowser');
    if (extBtn) {
      extBtn.addEventListener('click', () => {
        savePatrolFormDraft();
        if (window.YRUBrowser && typeof window.YRUBrowser.openInExternalBrowser === 'function') {
          window.YRUBrowser.openInExternalBrowser();
        }
      });
    }

    const nativeBtn = document.getElementById('btnNativeCamFallback');
    if (nativeBtn) {
      nativeBtn.addEventListener('click', () => {
        savePatrolFormDraft();
        // ปิดหน้ากล้องสดหลังจากเปิดแอปกล้องของเครื่องแล้ว
        setTimeout(() => closeLivePatrolCamera(true), 300);
      });
    }

    // หยุดกล้องเมื่อสลับแอป/ล็อกจอ ป้องกันกล้องค้างและแบตหมด แล้วเปิดใหม่เมื่อกลับมา
    document.addEventListener('visibilitychange', async () => {
      const modal = document.getElementById('liveCameraModal');
      const isOpen = modal && modal.style.display !== 'none' && !modal.hidden;
      if (!isOpen) return;
      if (document.hidden) {
        stopLiveCameraStreamOnly();
      } else {
        try {
          await startLiveCameraInModal();
        } catch (err) {
          showLiveCamError(err);
        }
      }
    });
  }

  async function startCameraMediaStream(facingMode) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error('getUserMedia not supported');
    }

    stopLiveCameraStreamOnly();

    // ลำดับการขอเปิดกล้องหลัง (environment) บน Android ให้แม่นยำที่สุด
    const constraintCandidates = [
      {
        audio: false,
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      {
        audio: false,
        video: { facingMode: facingMode }
      },
      {
        audio: false,
        video: true
      }
    ];

    let lastErr = null;
    for (let i = 0; i < constraintCandidates.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraintCandidates[i]);
        if (stream) return stream;
      } catch (err) {
        lastErr = err;
        // ถ้าผู้ใช้/แอปปฏิเสธสิทธิ์กล้อง ไม่ต้องลองซ้ำ
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError' || err.name === 'PermissionDeniedError')) {
          break;
        }
      }
    }
    throw lastErr || new Error('ไม่สามารถเปิดเลนส์กล้องได้');
  }

  function hideLiveCamError() {
    const panel = document.getElementById('liveCamErrorPanel');
    if (panel) {
      panel.hidden = true;
      panel.style.display = 'none';
    }
  }

  function showLiveCamError(err) {
    const panel = document.getElementById('liveCamErrorPanel');
    const titleEl = document.getElementById('liveCamErrorTitle');
    const msgEl = document.getElementById('liveCamErrorMsg');
    const extBtn = document.getElementById('btnOpenExternalBrowser');
    const nativeBtn = document.getElementById('btnNativeCamFallback');
    const browser = window.YRUBrowser || {};
    const errName = err && err.name ? err.name : '';

    let title = 'ไม่สามารถเปิดกล้องได้';
    let msg = 'กรุณาอนุญาตการใช้งานกล้องให้กับเว็บไซต์นี้ แล้วแตะ "ลองเปิดกล้องอีกครั้ง"';

    if (browser.isInApp) {
      title = 'เบราว์เซอร์ในแอปนี้ไม่อนุญาตให้เปิดกล้องโดยตรง';
      msg = 'คุณกำลังเปิดเว็บผ่านแอป (เช่น LINE / Facebook) ซึ่งจะเปิดอัลบั้มรูปแทนกล้อง กรุณาแตะปุ่มด้านล่างเพื่อเปิดใน Chrome (Android) หรือ Safari (iPhone) แล้วจะเปิดกล้องได้ทันที';
    } else if (!window.isSecureContext) {
      title = 'ต้องเปิดผ่านลิงก์ HTTPS';
      msg = 'เบราว์เซอร์อนุญาตให้เปิดกล้องเฉพาะเว็บที่เป็น https:// เท่านั้น กรุณาเปิดผ่าน https://gunkeyy591.github.io/securitypatrol/';
    } else if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      title = 'ยังไม่ได้อนุญาตให้ใช้กล้อง';
      msg = browser.isIOS
        ? 'ไปที่ การตั้งค่า > Safari > กล้อง แล้วเลือก "อนุญาต" จากนั้นแตะ "ลองเปิดกล้องอีกครั้ง"'
        : 'แตะไอคอนแม่กุญแจ 🔒 ข้างแถบที่อยู่เว็บ > สิทธิ์ > กล้อง > "อนุญาต" จากนั้นแตะ "ลองเปิดกล้องอีกครั้ง"';
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      title = 'กล้องกำลังถูกใช้งานโดยแอปอื่น';
      msg = 'กรุณาปิดแอปอื่นที่ใช้กล้องอยู่ (เช่น แอปกล้อง / วิดีโอคอล) แล้วแตะ "ลองเปิดกล้องอีกครั้ง"';
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      title = 'ไม่พบกล้องบนอุปกรณ์นี้';
      msg = 'กรุณาใช้อุปกรณ์ที่มีกล้อง หรือแตะ "ใช้แอปกล้องของเครื่อง"';
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (extBtn) {
      const showExt = Boolean(browser.isInApp);
      extBtn.hidden = !showExt;
      extBtn.style.display = showExt ? 'inline-flex' : 'none';
    }
    // ในแอป LINE/Facebook ปุ่มแอปกล้องของเครื่องจะเด้งไปอัลบั้ม จึงซ่อนไว้
    if (nativeBtn) {
      nativeBtn.style.display = browser.isInApp ? 'none' : 'inline-flex';
    }
    if (panel) {
      panel.hidden = false;
      panel.style.display = 'flex';
    }
  }

  async function startLiveCameraInModal() {
    const video = document.getElementById('liveCameraVideo');
    hideLiveCamError();
    liveCameraStream = await startCameraMediaStream(liveCameraFacingMode);
    if (video) {
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.srcObject = liveCameraStream;
      await video.play().catch(() => {});
    }
    updateLiveCameraModalUI();
  }

  async function openLivePatrolCamera() {
    const modal = document.getElementById('liveCameraModal');
    const video = document.getElementById('liveCameraVideo');
    const browser = window.YRUBrowser || {};
    const hasGUM = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');

    if (!modal || !video) {
      if (el.camPatrolInput) el.camPatrolInput.click();
      return;
    }

    // เปิดหน้ากล้องสดเต็มจอ (ไม่ผ่านอัลบั้มรูปภาพ)
    modal.hidden = false;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateLiveCameraModalUI();

    if (liveCameraClockTimer) clearInterval(liveCameraClockTimer);
    liveCameraClockTimer = setInterval(() => {
      const clockEl = document.getElementById('liveCamClockText');
      if (clockEl) {
        const meta = buildPatrolTimestampMeta();
        clockEl.textContent = `🕒 ${meta.fullStamp}`;
      }
    }, 500);

    if (!hasGUM) {
      // Chrome/Safari ปกติที่ไม่รองรับ getUserMedia (หายากมาก) -> ใช้ input capture ซึ่งจะเปิดแอปกล้องโดยตรง
      if (!browser.isInApp && el.camPatrolInput) {
        closeLivePatrolCamera(true);
        el.camPatrolInput.click();
        return;
      }
      showLiveCamError(null);
      return;
    }

    try {
      await startLiveCameraInModal();
    } catch (camErr) {
      console.warn('Direct live camera failed:', camErr);
      stopLiveCameraStreamOnly();
      // ไม่เด้งไปอัลบั้มรูปอัตโนมัติอีกต่อไป — แสดงคำแนะนำและทางเลือกที่ถูกต้องแทน
      showLiveCamError(camErr);
    }
  }

  function stopLiveCameraStreamOnly() {
    if (liveCameraStream) {
      try {
        liveCameraStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      liveCameraStream = null;
    }
    const video = document.getElementById('liveCameraVideo');
    if (video) {
      try {
        video.pause();
        video.srcObject = null;
      } catch (e) {}
    }
  }

  function closeLivePatrolCamera(silent) {
    if (liveCameraClockTimer) {
      clearInterval(liveCameraClockTimer);
      liveCameraClockTimer = null;
    }
    stopLiveCameraStreamOnly();
    hideLiveCamError();
    document.body.style.overflow = '';
    const modal = document.getElementById('liveCameraModal');
    if (modal) {
      modal.hidden = true;
      modal.style.display = 'none';
    }
    if (!silent) {
      renderPatrolThumbnails();
    }
  }

  async function switchLiveCameraFacing() {
    liveCameraFacingMode = liveCameraFacingMode === 'environment' ? 'user' : 'environment';
    const video = document.getElementById('liveCameraVideo');
    try {
      liveCameraStream = await startCameraMediaStream(liveCameraFacingMode);
      if (video) {
        video.srcObject = liveCameraStream;
        await video.play().catch(() => {});
      }
      showToast(liveCameraFacingMode === 'environment' ? 'สลับเป็นกล้องหลังแล้ว' : 'สลับเป็นกล้องหน้าแล้ว', '📷');
    } catch (err) {
      console.warn('Switch camera error:', err);
      showToast('ไม่สามารถสลับกล้องได้บนอุปกรณ์นี้', '⚠️');
    }
  }

  function updateLiveCameraModalUI() {
    const count = Array.isArray(state.capturedImages) ? state.capturedImages.length : 0;
    const badgeEl = document.getElementById('liveCamCounterBadge');
    const doneBtn = document.getElementById('btnDoneLiveCam');
    const doneText = document.getElementById('btnDoneLiveCamText');
    const stripEl = document.getElementById('liveCamStrip');
    const clockEl = document.getElementById('liveCamClockText');

    if (clockEl) {
      const meta = buildPatrolTimestampMeta();
      clockEl.textContent = `🕒 ${meta.fullStamp}`;
    }

    if (badgeEl) {
      if (count < 2) {
        badgeEl.className = 'live-cam-badge';
        badgeEl.textContent = `📸 ถ่ายแล้ว ${count}/2 รูป (ต้องอย่างน้อย 2 รูป)`;
      } else {
        badgeEl.className = 'live-cam-badge is-complete';
        badgeEl.textContent = `✅ ถ่ายครบเกณฑ์แล้ว (${count} รูป)`;
      }
    }

    if (doneBtn && doneText) {
      if (count >= 2) {
        doneBtn.classList.add('ready');
        doneText.textContent = `ใช้รูปภาพ (${count})`;
      } else {
        doneBtn.classList.remove('ready');
        doneText.textContent = count > 0 ? `เสร็จสิ้น (${count})` : 'ปิดกล้อง';
      }
    }

    if (stripEl) {
      if (count === 0) {
        stripEl.innerHTML = '';
      } else {
        stripEl.innerHTML = state.capturedImages.map((imgObj, idx) => `
          <div class="live-cam-mini-thumb">
            <img src="${imgObj.dataUrl}" alt="รูปที่ ${idx + 1}">
            <span class="live-cam-mini-num">#${idx + 1}</span>
          </div>
        `).join('');
        stripEl.scrollLeft = stripEl.scrollWidth;
      }
    }
  }

  function snapLivePatrolPhoto() {
    const video = document.getElementById('liveCameraVideo');
    if (!video || !liveCameraStream) return;

    const flashEl = document.getElementById('liveCamFlash');
    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 180);
    }

    const rawW = video.videoWidth || video.clientWidth || 640;
    const rawH = video.videoHeight || video.clientHeight || 480;
    const MAX_SIZE = 520;
    let width = rawW;
    let height = rawH;

    if (width > height && width > MAX_SIZE) {
      height = Math.max(1, Math.round(height * (MAX_SIZE / width)));
      width = MAX_SIZE;
    } else if (height > MAX_SIZE) {
      width = Math.max(1, Math.round(width * (MAX_SIZE / height)));
      height = MAX_SIZE;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    const meta = buildPatrolTimestampMeta();
    const fontSize = Math.max(14, Math.round(width * 0.028));
    ctx.font = `600 ${fontSize}px 'Sarabun', 'Prompt', sans-serif`;
    const stampText = `🕒 ${meta.fullStamp}`;
    const metrics = ctx.measureText(stampText);
    const padX = 12;
    const padY = 7;
    const boxW = metrics.width + (padX * 2);
    const boxH = fontSize + (padY * 2);
    const boxX = Math.max(6, width - boxW - 14);
    const boxY = Math.max(6, height - boxH - 14);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(stampText, boxX + padX, boxY + (boxH / 2));

    const base64 = canvas.toDataURL('image/jpeg', 0.60);
    const photoObj = {
      dataUrl: base64,
      timeStr: meta.timeStr,
      fullStamp: meta.fullStamp,
      timestamp: meta.timestamp
    };

    if (!state.capturedImages) state.capturedImages = [];
    state.capturedImages.push(photoObj);
    state.capturedImageBase64 = state.capturedImages[0] ? state.capturedImages[0].dataUrl : null;

    savePatrolFormDraft();
    renderPatrolThumbnails();
    updateLiveCameraModalUI();

    const total = state.capturedImages.length;
    if (total === 1) {
      showToast('📸 บันทึกรูปที่ 1 แล้ว! กดปุ่มชัตเตอร์อีก 1 ครั้งเพื่อถ่ายรูปที่ 2', '📷');
    } else if (total === 2) {
      showToast('✅ ถ่ายครบ 2 รูปแล้ว! กดปุ่ม "ใช้รูปภาพ" หรือถ่ายเพิ่มได้ทันที', '✅');
    } else {
      showToast(`✅ บันทึกรูปที่ ${total} เรียบร้อยแล้ว`, '✅');
    }
  }

  function savePatrolFormDraft() {
    try {
      const wrap = document.getElementById('customLocWrap');
      const isCustomLoc = wrap && wrap.style.display !== 'none';
      const draft = {
        updatedAt: Date.now(),
        guardName: el.guardPatrolSelect ? el.guardPatrolSelect.value : state.currentGuardName,
        shift: state.currentShift,
        shiftName: state.currentShiftName,
        isCustomLoc: Boolean(isCustomLoc),
        locSelectVal: el.locPatrolSelect ? el.locPatrolSelect.value : '',
        customLocVal: el.customLocPatrolInput ? el.customLocPatrolInput.value : '',
        noteVal: el.notePatrolInput ? el.notePatrolInput.value : '',
        riskChecked: el.riskPatrolChk ? Boolean(el.riskPatrolChk.checked) : false,
        capturedImages: Array.isArray(state.capturedImages) ? state.capturedImages : []
      };
      localStorage.setItem(PATROL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('Could not save patrol draft:', e);
    }
  }

  function restorePatrolFormDraft() {
    try {
      const raw = localStorage.getItem(PATROL_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // อายุ Draft ไม่เกิน 3 ชั่วโมง
      if (!draft || !draft.updatedAt || (Date.now() - draft.updatedAt > 3 * 60 * 60 * 1000)) {
        localStorage.removeItem(PATROL_DRAFT_STORAGE_KEY);
        return;
      }

      if (draft.guardName && el.guardPatrolSelect) {
        for (let opt of el.guardPatrolSelect.options) {
          if (opt.value === draft.guardName) {
            opt.selected = true;
            state.currentGuardName = draft.guardName;
            break;
          }
        }
      }

      if (draft.isCustomLoc) {
        const wrap = document.getElementById('customLocWrap');
        if (wrap) wrap.style.display = 'block';
        if (el.customLocPatrolInput) {
          el.customLocPatrolInput.style.display = 'block';
          el.customLocPatrolInput.value = draft.customLocVal || '';
        }
        if (el.locPatrolSelect) {
          el.locPatrolSelect.style.display = 'none';
        }
      } else if (draft.locSelectVal && el.locPatrolSelect) {
        el.locPatrolSelect.value = draft.locSelectVal;
      }

      if (typeof draft.noteVal === 'string' && el.notePatrolInput) {
        el.notePatrolInput.value = draft.noteVal;
      }

      if (typeof draft.riskChecked === 'boolean' && el.riskPatrolChk) {
        el.riskPatrolChk.checked = draft.riskChecked;
      }

      if (Array.isArray(draft.capturedImages) && draft.capturedImages.length > 0) {
        state.capturedImages = draft.capturedImages;
        state.capturedImageBase64 = state.capturedImages[0] ? state.capturedImages[0].dataUrl : null;
      }
    } catch (e) {
      console.warn('Could not restore patrol draft:', e);
    }
  }

  function clearPatrolFormDraft() {
    try {
      localStorage.removeItem(PATROL_DRAFT_STORAGE_KEY);
    } catch (e) {}
  }

  async function handlePatrolCameraUpload(event) {
    if (isProcessingPatrolCamera) return;

    const inputEl = (event && event.target) ? event.target : el.camPatrolInput;
    const rawFiles = inputEl && inputEl.files ? Array.from(inputEl.files) : [];
    if (!rawFiles || rawFiles.length === 0) return;

    isProcessingPatrolCamera = true;

    try {
      showToast('⏳ กำลังดึงรูปภาพและประทับเวลาหน้างาน...', '📸');

      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i];
        if (!file) continue;
        const photoObj = await processPatrolImageFile(file);
        if (photoObj && photoObj.dataUrl) {
          if (!state.capturedImages) state.capturedImages = [];
          state.capturedImages.push(photoObj);
        }
      }

      state.capturedImageBase64 = state.capturedImages[0] ? state.capturedImages[0].dataUrl : null;
      savePatrolFormDraft();
      renderPatrolThumbnails();

      const total = state.capturedImages.length;
      if (total === 1) {
        showToast('📸 ได้รูปที่ 1 แล้ว! กรุณาแตะถ่ายรูปที่ 2 เพิ่มเติม', '📷');
      } else if (total >= 2) {
        showToast(`✅ ได้ภาพเรียบร้อย ดึงเข้าระบบแล้ว (รวม ${total} รูป)`, '✅');
      }
    } catch (err) {
      console.error('Camera processing error:', err);
      showToast('❌ ไม่สามารถประมวลผลรูปได้ กรุณาลองถ่ายใหม่อีกครั้ง', '❌');
    } finally {
      // รีเซ็ตค่า input หลังจากอ่านไฟล์จาก Android content:// เสร็จสมบูรณ์แล้ว เพื่อให้แตะถ่ายรูปที่ 2 ต่อได้ทันที
      if (el.camPatrolInput) {
        try {
          el.camPatrolInput.value = '';
        } catch (e) {}
      }
      isProcessingPatrolCamera = false;
    }
  }

  function buildPatrolTimestampMeta() {
    const now = new Date();
    const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const thaiYear = (now.getFullYear() + 543).toString().slice(-2);
    const d = now.getDate();
    const m = thaiMonths[now.getMonth()];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    return {
      timeStr: `${hh}:${mm} น.`,
      fullStamp: `${d} ${m} ${thaiYear} ${hh}:${mm}:${ss} น.`,
      timestamp: Date.now()
    };
  }

  function processPatrolImageFile(file) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('การประมวลผลรูปใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'));
        }
      }, 20000);

      function done(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }

      function fail(err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }

      // วิธีหลัก: URL.createObjectURL + Image (เสถียรที่สุดบน Android ทุกรุ่น Samsung, Xiaomi, Oppo, Vivo และ iOS)
      let blobUrl = null;
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          blobUrl = URL.createObjectURL(file);
          const img = new Image();
          img.onload = function () {
            const w = img.naturalWidth || img.width || 640;
            const h = img.naturalHeight || img.height || 480;
            const ok = drawAndWatermark(img, w, h, () => {
              if (blobUrl) {
                try { URL.revokeObjectURL(blobUrl); } catch (e) {}
              }
            });
            if (!ok) {
              fallbackWithFileReader();
            }
          };
          img.onerror = function () {
            if (blobUrl) {
              try { URL.revokeObjectURL(blobUrl); } catch (err) {}
            }
            fallbackWithFileReader();
          };
          img.src = blobUrl;
          return;
        }
      } catch (urlErr) {
        if (blobUrl) {
          try { URL.revokeObjectURL(blobUrl); } catch (err) {}
        }
      }

      fallbackWithFileReader();

      function fallbackWithFileReader() {
        try {
          const reader = new FileReader();
          reader.onload = function (e) {
            const dataUrl = e && e.target ? e.target.result : null;
            if (!dataUrl) {
              fail(new Error('ไม่สามารถอ่านข้อมูลรูปภาพได้'));
              return;
            }
            const fallbackImg = new Image();
            fallbackImg.onload = function () {
              const w = fallbackImg.naturalWidth || fallbackImg.width || 640;
              const h = fallbackImg.naturalHeight || fallbackImg.height || 480;
              const ok = drawAndWatermark(fallbackImg, w, h);
              if (!ok) {
                // กรณี WebView รุ่นเก่าวาด Canvas ไม่สำเร็จ ให้ใช้ภาพต้นฉบับจากกล้องทันทีโดยไม่แครช
                const meta = buildPatrolTimestampMeta();
                done({
                  dataUrl: dataUrl,
                  timeStr: meta.timeStr,
                  fullStamp: meta.fullStamp,
                  timestamp: meta.timestamp
                });
              }
            };
            fallbackImg.onerror = function () {
              const meta = buildPatrolTimestampMeta();
              done({
                dataUrl: dataUrl,
                timeStr: meta.timeStr,
                fullStamp: meta.fullStamp,
                timestamp: meta.timestamp
              });
            };
            fallbackImg.src = dataUrl;
          };
          reader.onerror = function () {
            fail(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์ภาพจากอุปกรณ์'));
          };
          reader.readAsDataURL(file);
        } catch (readerErr) {
          fail(readerErr);
        }
      }

      function drawAndWatermark(imgSource, originalW, originalH, cleanupCallback) {
        try {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 520;
          let width = originalW || 520;
          let height = originalH || 390;

          if (width > height && width > MAX_SIZE) {
            height = Math.max(1, Math.round(height * (MAX_SIZE / width)));
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.max(1, Math.round(width * (MAX_SIZE / height)));
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (typeof cleanupCallback === 'function') {
              try { cleanupCallback(); } catch (e) {}
            }
            return false;
          }

          ctx.drawImage(imgSource, 0, 0, width, height);

          if (typeof cleanupCallback === 'function') {
            try { cleanupCallback(); } catch (e) {}
          }

          const meta = buildPatrolTimestampMeta();

          // วาดแถบลายน้ำระบุเวลาลงบนรูปภาพ
          const fontSize = Math.max(14, Math.round(width * 0.028));
          ctx.font = `600 ${fontSize}px 'Sarabun', 'Prompt', sans-serif`;
          const stampText = `🕒 ${meta.fullStamp}`;
          const metrics = ctx.measureText(stampText);
          const padX = 12;
          const padY = 7;
          const boxW = metrics.width + (padX * 2);
          const boxH = fontSize + (padY * 2);
          const boxX = Math.max(6, width - boxW - 14);
          const boxY = Math.max(6, height - boxH - 14);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(boxX, boxY, boxW, boxH);

          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.fillText(stampText, boxX + padX, boxY + (boxH / 2));

          const base64 = canvas.toDataURL('image/jpeg', 0.60);
          done({
            dataUrl: base64,
            timeStr: meta.timeStr,
            fullStamp: meta.fullStamp,
            timestamp: meta.timestamp
          });
          return true;
        } catch (drawErr) {
          console.warn('Canvas drawAndWatermark fallback triggered:', drawErr);
          if (typeof cleanupCallback === 'function') {
            try { cleanupCallback(); } catch (e) {}
          }
          return false;
        }
      }
    });
  }

  function renderPatrolThumbnails() {
    if (!state.capturedImages) {
      state.capturedImages = [];
    }

    const count = state.capturedImages.length;
    state.capturedImageBase64 = count > 0 ? state.capturedImages[0].dataUrl : null;

    // อัปเดตแถบป้ายเตือนจำนวนรูปภาพ
    const svgWarn = '<svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    const svgCheck = '<svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

    if (el.photoCountBadge) {
      if (count === 0) {
        el.photoCountBadge.className = 'photo-req-badge photo-req-warn';
        el.photoCountBadge.innerHTML = `${svgWarn} <span>ยังไม่ได้ถ่ายรูป (0/2 รูป)</span>`;
      } else if (count === 1) {
        el.photoCountBadge.className = 'photo-req-badge photo-req-warn';
        el.photoCountBadge.innerHTML = `${svgWarn} <span>ถ่ายแล้ว 1 รูป (ต้องถ่ายเพิ่มอีก 1 รูป)</span>`;
      } else {
        el.photoCountBadge.className = 'photo-req-badge photo-req-ok';
        el.photoCountBadge.innerHTML = `${svgCheck} <span>ถ่ายแล้ว ${count} รูป (ครบตามเกณฑ์ 2+ รูป)</span>`;
      }
    }

    // อัปเดตข้อความบนปุ่มกล้องให้เข้าใจง่าย
    if (el.camBtnMainText && el.camBtnSubText) {
      if (count === 0) {
        el.camBtnMainText.textContent = 'แตะที่นี่เพื่อเปิดกล้องถ่ายภาพหน้างาน';
        el.camBtnSubText.textContent = 'ถ่ายเสร็จจะดึงรูปเข้ามาใส่ทันทีพร้อมประทับเวลาอัตโนมัติ (บังคับถ่าย 2 รูปขึ้นไป)';
      } else if (count === 1) {
        el.camBtnMainText.textContent = 'แตะเพื่อเปิดกล้องถ่ายรูปที่ 2 เพิ่มเติม';
        el.camBtnSubText.textContent = 'ถ่ายรูปที่ 1 เข้ามาแล้ว — แตะเพื่อถ่ายรูปที่ 2 ให้ครบเกณฑ์';
      } else {
        el.camBtnMainText.textContent = `แตะเพื่อเปิดกล้องถ่ายรูปเพิ่มเติม (ถ่ายแล้ว ${count} รูป)`;
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
            <button type="button" class="remove-single-patrol-img" data-index="${idx}" title="ลบรูปที่ ${idx + 1}">✕</button>
            <span class="thumb-idx-badge">#${idx + 1}</span>
          </div>
          <div class="thumb-caption">
            <span class="thumb-time-text">ถ่ายเวลา ${imgObj.timeStr}</span>
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
    savePatrolFormDraft();
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
    let guardVal = el.guardPatrolSelect ? el.guardPatrolSelect.value : '';
    let locVal = el.locPatrolSelect ? el.locPatrolSelect.value : '';
    const customLocVal = el.customLocPatrolInput ? el.customLocPatrolInput.value.trim() : '';
    let notes = el.notePatrolInput ? el.notePatrolInput.value.trim() : '';
    let isRisk = el.riskPatrolChk ? el.riskPatrolChk.checked : false;

    const isCustomLoc = Boolean(customLocVal);
    if (isCustomLoc) {
      locVal = customLocVal + ' (นอกจุดตรวจ)';
    }

    // Auto-select guard if empty
    if (!guardVal && el.guardPatrolSelect && el.guardPatrolSelect.options.length > 1) {
      el.guardPatrolSelect.selectedIndex = 1;
      guardVal = el.guardPatrolSelect.value;
      state.currentGuardName = guardVal;
    }

    // Validation
    if (!isSOS) {
      if (!guardVal) {
        showToast('⚠️ กรุณาเลือกชื่อเจ้าหน้าที่ รปภ.', '⚠️');
        if (el.guardPatrolSelect) {
          el.guardPatrolSelect.classList.add('shake-highlight', 'field-error');
          el.guardPatrolSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el.guardPatrolSelect.classList.remove('shake-highlight'), 1200);
        }
        return;
      }

      if (!locVal && !customLocVal) {
        showToast('⚠️ กรุณาแตะเลือกสถานที่/อาคารจุดตรวจให้ชัดเจน', '⚠️');
        if (el.locPatrolSelect) {
          el.locPatrolSelect.classList.add('shake-highlight', 'field-error');
          el.locPatrolSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el.locPatrolSelect.classList.remove('shake-highlight'), 1200);
        }
        return;
      }
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
      btn.textContent = '⏳ กำลังบันทึกข้อมูลและส่งรายงาน...';
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

    // คำนวณรอบการเดินตรวจของกะนี้ในวันนี้โดยอัตโนมัติ (Round Number)
    const sameShiftCount = state.history.filter(r => r.date === isoDate && r.shift === shiftCode).length;
    const roundNo = sameShiftCount + 1;

    const record = {
      id: 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: isoDate,
      time: timeStr,
      shift: shiftCode,
      roundNo: roundNo,
      round: `กะ${shiftName} · รอบที่ ${roundNo}`,
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
        : (state.capturedImageBase64 ? [state.capturedImageBase64] : []),
      createdAt: new Date().toISOString()
    };

    // บันทึกลงฐานข้อมูล SQL (SQL INSERT INTO patrol_records & patrol_images)
    if (window.AppDB) {
      try {
        await window.AppDB.query(
          `INSERT INTO patrol_records (id, date, time, shift, round, guard_id, guard_name, cp_id, cp_code, cp_name, is_risk, is_off_checkpoint, status, note, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [record.id, record.date, record.time, record.shift, record.round, record.guardId, record.guardName, record.cpId, record.cpCode, record.cpName, record.isRisk ? 1 : 0, record.isOffCheckpoint ? 1 : 0, record.status, record.note, record.images, record.createdAt, record.roundNo]
        );
      } catch (dbErr) {
        console.warn('AppDB insert error:', dbErr);
      }
    }

    // Save record to history
    if (!state.history.some(r => r.id === record.id)) {
      state.history.unshift(record);
    }
    saveToLocalStorage();

    // Re-render UI
    renderSupervisorDashboard();
    renderGuardRecentLogs();

    // Broadcast to other open tabs and send to cloud SQL channel (ส่งถึงแอดมินทันที + คิวส่งซ้ำอัตโนมัติ)
    const deliveredToAdmin = await broadcastPatrolRecord(record);

    if (isSOS) {
      showToast(deliveredToAdmin ? '🚨 ส่งแจ้งเหตุฉุกเฉินถึงแอดมินเรียบร้อยแล้ว!' : '🚨 บันทึกแจ้งเหตุแล้ว ระบบกำลังส่งถึงแอดมินอัตโนมัติ...', '🚨');
    } else if (deliveredToAdmin) {
      showToast(`✅ บันทึกและส่งถึงแอดมินแล้ว: ${locVal} (${timeStr} น.)`, '✅');
    } else {
      showToast('📶 บันทึกแล้ว — สัญญาณอินเทอร์เน็ตไม่เสถียร ระบบจะส่งถึงแอดมินอัตโนมัติทันทีที่มีสัญญาณ', '⚠️');
    }

    // Show prominent confirmation modal
    showPatrolSuccessModal(record, isSOS);

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
    clearPatrolFormDraft();

    if (!isSOS && btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="submit-icon" aria-hidden="true"><svg class="svg-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span><span class="submit-text">บันทึกข้อมูลเข้าสู่ระบบ</span>';
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
        <div class="empty-illust-box">
          <svg viewBox="0 0 80 80" fill="none" style="width:58px; height:58px; margin: 0 auto 10px; color: var(--primary);">
            <circle cx="40" cy="40" r="34" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="4 4"/>
            <path d="M40 18L56 24V37C56 48.2 49.2 56.5 40 59.5C30.8 56.5 24 48.2 24 37V24L40 18Z" stroke="currentColor" stroke-width="2.2"/>
            <path d="M33 39L38 44L48 34" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <b>ยังไม่มีรายการบันทึกเวียนตรวจในวันนี้</b>
          <p style="margin: 4px 0 0; font-size: 13px;">เลือกสถานที่และแนบภาพถ่ายด้านซ้าย จากนั้นกดปุ่มบันทึกเพื่อเริ่มเก็บประวัติ</p>
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
        ? `<span class="tag ok" style="font-size:12px;">ปกติเรียบร้อย</span>`
        : `<span class="tag alert" style="font-size:12px;">พบเหตุผิดปกติ</span>`;
      
      if (item.isRisk) {
        badgeHtml += ` <span class="tag risk" style="font-size:12px;">จุดเสี่ยง</span>`;
      }
      if (item.isOffCheckpoint) {
        badgeHtml = `<span class="tag alert" style="background:#e11d48; color:#fff; font-size:12px;">เหตุด่วนนอกจุด</span>`;
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

  // --- PATROL SUCCESS MODAL (ยืนยันผลการบันทึกและส่งรายงานให้แอดมิน) ---
  function showPatrolSuccessModal(record, isSOS) {
    if (!el.patrolSuccessModal) return;

    const shiftMap = { morning: 'กะเช้า (06:00 - 14:00 น.)', afternoon: 'กะบ่าย (14:00 - 22:00 น.)', night: 'กะดึก (22:00 - 06:00 น.)' };

    if (el.patrolSuccessSummary) {
      el.patrolSuccessSummary.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size:14.5px;">
          <span style="color:var(--muted);">สถานที่ / อาคาร:</span>
          <b>${escapeHtml(record.cpName)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size:14.5px;">
          <span style="color:var(--muted);">รปภ. ผู้ตรวจ:</span>
          <b>${escapeHtml(record.guardName)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size:14.5px;">
          <span style="color:var(--muted);">เวลา / ผลัดเวร:</span>
          <b>${record.time} น. (${shiftMap[record.shift] || record.shift})</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size:14.5px;">
          <span style="color:var(--muted);">ภาพถ่ายหลักฐาน:</span>
          <b style="color:var(--ok);">${record.images ? record.images.length : 0} รูปภาพ (ประทับเวลาสด)</b>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size:14.5px;">
          <span style="color:var(--muted);">สถานะผลตรวจ:</span>
          <b>${record.status === 'ok' ? 'เหตุการณ์ปกติ เรียบร้อยดี' : 'พบปัญหา / ผิดปกติ'}</b>
        </div>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); display:flex; align-items:center; gap:8px; color:var(--ok); font-weight:700; font-size:14px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; flex-shrink:0;"></span>
          <span>ส่งข้อมูลเข้าสู่ระบบและแจ้งเตือนผู้ดูแลระบบ (แอดมิน) เรียบร้อยแล้ว</span>
        </div>
      `;
    }

    el.patrolSuccessModal.removeAttribute('hidden');
    el.patrolSuccessModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closePatrolSuccessModal() {
    if (el.patrolSuccessModal) {
      el.patrolSuccessModal.setAttribute('hidden', '');
      el.patrolSuccessModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // --- REAL-TIME MULTI-DEVICE & CLOUD SQL SYNC ENGINE (iOS iPhone + Android + PC) ---
  // ใช้โปรโตคอล Inline Packet (<= 3,400 ไบต์ต่อแพ็กเก็ต) แบบ Simple CORS POST (ไม่มี Custom Headers)
  // เพื่อป้องกันปัญหา iOS Safari บล็อก CORS Preflight และไม่ใช้โควต้าไฟล์แนบ (Attachment) ของ ntfy.sh
  const CLOUD_SYNC_URL = 'https://ntfy.sh/yru_sp_sync_channel_live_2026';
  const OUTBOX_STORAGE_KEY = 'yru_sp_outbox_v2';
  const NTFY_SEEN_KEY = 'yru_sp_ntfy_seen_v2';
  const IMG_CHUNK_SIZE = 2600;
  let cloudEventSource = null;
  let syncIntervalId = null;
  let outboxTimerId = null;
  let sseReconnectTimer = null;
  let sseBackoffMs = 1500;
  let sseLastActivity = 0;
  let sseConnected = false;
  let isPollingCloud = false;
  let isFlushingOutbox = false;
  let lastCloudUpdateAt = null;
  let memoryOutbox = null;
  const seenNtfyIds = new Set();
  // เก็บชิ้นส่วนรูปภาพที่ส่งมาจาก iPhone / Android แบบ Real-time: rid -> { imgTotal, images: { [imgIdx]: { cTotal, chunks: {}, completedDataUrl } } }
  const incomingImageBuffers = {};

  // ล้างคิวเก่าที่ค้างจากเวอร์ชันก่อนหน้า (ซึ่งอาจมีไฟล์ขนาดใหญ่เกินโควต้าค้างอยู่บน iPhone)
  try {
    localStorage.removeItem('yru_sp_outbox');
    localStorage.removeItem('yru_sp_ntfy_last_id');
  } catch (e) {}

  try {
    const seenRaw = localStorage.getItem(NTFY_SEEN_KEY);
    if (seenRaw) JSON.parse(seenRaw).forEach(id => seenNtfyIds.add(id));
  } catch (e) {}

  function persistSeenNtfyIds() {
    try {
      const arr = Array.from(seenNtfyIds);
      const trimmed = arr.slice(-800);
      if (trimmed.length !== arr.length) {
        seenNtfyIds.clear();
        trimmed.forEach(id => seenNtfyIds.add(id));
      }
      localStorage.setItem(NTFY_SEEN_KEY, JSON.stringify(trimmed));
    } catch (e) {}
  }

  /**
   * ย่อขนาดรูปภาพจาก iPhone / Android ให้กะทัดรัด (<= 10,400 ตัวอักษร Base64 หรือ ~7.5KB)
   * เพื่อให้แบ่งส่งเป็น Inline Packet (<= 4 แพ็กเก็ตต่อรูป) ถึงแอดมินได้รวดเร็ว 100% โดยไม่ติดขีดจำกัดไฟล์แนบ
   */
  function compressImageForCloud(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof dataUrl !== 'string') {
        resolve('');
        return;
      }
      if (dataUrl.length <= 10400) {
        resolve(dataUrl);
        return;
      }
      const timer = setTimeout(() => {
        resolve(dataUrl.length <= 28000 ? dataUrl : '');
      }, 6000);

      const img = new Image();
      img.onload = function () {
        clearTimeout(timer);
        try {
          const origW = img.naturalWidth || img.width || 480;
          const origH = img.naturalHeight || img.height || 360;
          const attempts = [
            { maxDim: 380, quality: 0.48 },
            { maxDim: 320, quality: 0.42 },
            { maxDim: 260, quality: 0.36 },
            { maxDim: 220, quality: 0.32 }
          ];
          let out = dataUrl;
          for (let i = 0; i < attempts.length; i++) {
            const maxDim = attempts[i].maxDim;
            let w = origW;
            let h = origH;
            if (w > h && w > maxDim) {
              h = Math.max(1, Math.round(h * (maxDim / widthOrDefault(w))));
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.max(1, Math.round(w * (maxDim / widthOrDefault(h))));
              h = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) break;
            ctx.drawImage(img, 0, 0, w, h);
            out = canvas.toDataURL('image/jpeg', attempts[i].quality);
            if (out.length <= 10400) break;
          }
          resolve(out);
        } catch (e) {
          resolve(dataUrl.length <= 28000 ? dataUrl : '');
        }
      };
      img.onerror = function () {
        clearTimeout(timer);
        resolve(dataUrl.length <= 28000 ? dataUrl : '');
      };
      img.src = dataUrl;
    });
  }

  function widthOrDefault(val) {
    return val > 0 ? val : 1;
  }

  // ---------- OUTBOX (คิวส่งแพ็กเก็ตขนาดเล็ก <= 3.4KB ไม่ให้ข้อมูลหายบน iPhone / Android) ----------
  function readOutbox() {
    if (memoryOutbox) return memoryOutbox;
    try {
      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeOutbox(items) {
    const trimmed = Array.isArray(items) ? items.slice(-60) : [];
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(trimmed));
      memoryOutbox = null;
    } catch (e) {
      memoryOutbox = trimmed;
    }
  }

  /**
   * ส่งข้อความ JSON ไปยัง ntfy.sh ด้วย Simple CORS Request (ไม่มี Custom Headers และไม่มี cache: 'no-store')
   * ทำให้ iOS Safari (iPhone) และทุกเบราว์เซอร์ส่งผ่านทันทีโดยไม่ต้องทำ CORS OPTIONS Preflight
   */
  async function postInlinePacketToCloud(bodyStr, timeoutMs = 10000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const resp = await fetch(CLOUD_SYNC_URL, {
        method: 'POST',
        body: bodyStr,
        signal: controller ? controller.signal : undefined
      });
      return resp.ok;
    } catch (e) {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function flushOutbox() {
    if (isFlushingOutbox) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const items = readOutbox();
    if (!items.length) return;

    isFlushingOutbox = true;
    try {
      const remaining = [];
      for (const item of items) {
        if (!item || !item.body) continue;
        const ok = await postInlinePacketToCloud(item.body, 8000);
        if (!ok) {
          item.tries = (item.tries || 0) + 1;
          if (item.tries < 15) {
            remaining.push(item);
          }
        }
        await new Promise(r => setTimeout(r, 120));
      }
      writeOutbox(remaining);
    } finally {
      isFlushingOutbox = false;
    }
  }

  function startOutboxWorker() {
    if (outboxTimerId) clearInterval(outboxTimerId);
    outboxTimerId = setInterval(flushOutbox, 5000);
    window.addEventListener('online', flushOutbox);
    window.addEventListener('pageshow', flushOutbox);
    window.addEventListener('focus', flushOutbox);
  }

  /**
   * ส่งข้อมูลจาก รปภ. (iPhone / Android / PC) ไปยังแอดมินทันที:
   * 1. ส่งแพ็กเก็ตข้อมูลหลัก (patrol_record, < 1.5KB) ออกไปก่อนทันที -> แอดมินเห็นรายการขึ้นทันทีใน 0.2 วินาที
   * 2. ย่อและแบ่งรูปภาพออกเป็นแพ็กเก็ตย่อย (patrol_img_chunk, <= 3.2KB ต่อแพ็กเก็ต) แล้วส่งตามทันที -> รูปขึ้นครบทั้งบน iPhone และ Android 100%
   */
  async function broadcastPatrolRecord(record, actionType = 'patrol_record') {
    // 1. Same-device multi-tab broadcast via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('yru_patrol_channel');
        bc.postMessage({ type: actionType, record: record });
        setTimeout(() => bc.close(), 1000);
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // กรณีคำสั่งลบข้อมูล (patrol_delete)
    if (actionType === 'patrol_delete') {
      const delBody = JSON.stringify({
        type: 'patrol_delete',
        record: record,
        timestamp: Date.now()
      });
      const ok = await postInlinePacketToCloud(delBody, 8000);
      if (!ok) {
        const q = readOutbox();
        q.push({ body: delBody, tries: 0 });
        writeOutbox(q);
      }
      return ok;
    }

    if (!record || !record.id) return false;

    const rawImages = Array.isArray(record.images) ? record.images.filter(Boolean) : [];

    // 2. ขั้นที่ 1: ส่งแพ็กเก็ตข้อมูลการตรวจ (ไม่รวม Base64 รูปภาพ เพื่อให้ขนาด < 1.5KB เป็น Inline Message เสมอ)
    const headerRecord = {
      ...record,
      images: [],
      expectedImages: rawImages.length
    };
    const headerBody = JSON.stringify({
      type: actionType,
      record: headerRecord,
      timestamp: Date.now()
    });

    let headerOk = await postInlinePacketToCloud(headerBody, 8000);
    if (!headerOk) {
      await new Promise(r => setTimeout(r, 400));
      headerOk = await postInlinePacketToCloud(headerBody, 8000);
    }
    if (!headerOk) {
      const q = readOutbox();
      q.push({ body: headerBody, tries: 0 });
      writeOutbox(q);
    }

    // 3. ขั้นที่ 2: บีบอัดและแบ่งรูปภาพเป็น Inline Chunks (<= 3.2KB ต่อชิ้น) ส่งตามไปติดๆ
    if (rawImages.length > 0) {
      const cloudImages = [];
      for (let i = 0; i < rawImages.length; i++) {
        const compact = await compressImageForCloud(rawImages[i]);
        if (compact) cloudImages.push(compact);
      }

      const chunkPackets = [];
      for (let imgIdx = 0; imgIdx < cloudImages.length; imgIdx++) {
        const imgStr = cloudImages[imgIdx];
        const cTotal = Math.max(1, Math.ceil(imgStr.length / IMG_CHUNK_SIZE));
        for (let cIdx = 0; cIdx < cTotal; cIdx++) {
          const slice = imgStr.slice(cIdx * IMG_CHUNK_SIZE, (cIdx + 1) * IMG_CHUNK_SIZE);
          chunkPackets.push(JSON.stringify({
            type: 'patrol_img_chunk',
            rid: record.id,
            imgIdx: imgIdx,
            imgTotal: cloudImages.length,
            cIdx: cIdx,
            cTotal: cTotal,
            chunk: slice
          }));
        }
      }

      // ส่งทีละแพ็กเก็ตอย่างรวดเร็ว หากชิ้นใดส่งไม่ผ่านจะเข้าคิวส่งซ้ำอัตโนมัติ
      for (let k = 0; k < chunkPackets.length; k++) {
        const pkt = chunkPackets[k];
        let pktOk = await postInlinePacketToCloud(pkt, 8000);
        if (!pktOk) {
          await new Promise(r => setTimeout(r, 250));
          pktOk = await postInlinePacketToCloud(pkt, 8000);
        }
        if (!pktOk) {
          const q = readOutbox();
          q.push({ body: pkt, tries: 0 });
          writeOutbox(q);
        }
        if (k < chunkPackets.length - 1) {
          await new Promise(r => setTimeout(r, 120));
        }
      }
    }

    // ล้างคิวที่อาจค้างอยู่ในพื้นหลัง
    setTimeout(() => flushOutbox(), 1500);
    return headerOk;
  }

  /**
   * ประกอบชิ้นส่วนรูปภาพ (patrol_img_chunk) ที่ส่งมาจาก iPhone / Android เข้าด้วยกัน
   */
  function bufferImgChunk(parsed) {
    if (!parsed || parsed.type !== 'patrol_img_chunk' || !parsed.rid) return false;
    const rid = String(parsed.rid);
    const imgIdx = Number(parsed.imgIdx || 0);
    const imgTotal = Number(parsed.imgTotal || 1);
    const cIdx = Number(parsed.cIdx || 0);
    const cTotal = Number(parsed.cTotal || 1);
    const chunk = typeof parsed.chunk === 'string' ? parsed.chunk : '';
    if (!chunk) return false;

    if (!incomingImageBuffers[rid]) {
      incomingImageBuffers[rid] = {
        imgTotal: imgTotal,
        images: {}
      };
    }
    const entry = incomingImageBuffers[rid];
    if (imgTotal > entry.imgTotal) entry.imgTotal = imgTotal;

    if (!entry.images[imgIdx]) {
      entry.images[imgIdx] = {
        cTotal: cTotal,
        chunks: {},
        completedDataUrl: null
      };
    }
    const imgHolder = entry.images[imgIdx];
    imgHolder.cTotal = cTotal;
    imgHolder.chunks[cIdx] = chunk;

    // ตรวจสอบว่าได้รับครบทุกชิ้นของรูปที่ imgIdx หรือยัง
    if (!imgHolder.completedDataUrl && Object.keys(imgHolder.chunks).length >= cTotal) {
      let full = '';
      let allPresent = true;
      for (let i = 0; i < cTotal; i++) {
        if (typeof imgHolder.chunks[i] !== 'string') {
          allPresent = false;
          break;
        }
        full += imgHolder.chunks[i];
      }
      if (allPresent && full.startsWith('data:image/')) {
        imgHolder.completedDataUrl = full;
        return true; // มีรูปที่ประกอบเสร็จใหม่
      }
    }
    return false;
  }

  function getReconstructedImagesForRecord(rid) {
    const entry = incomingImageBuffers[String(rid)];
    if (!entry || !entry.images) return [];
    const result = [];
    const keys = Object.keys(entry.images).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      const h = entry.images[k];
      if (h && h.completedDataUrl) {
        result.push(h.completedDataUrl);
      }
    }
    return result;
  }

  async function applyBufferedImagesToRecord(rid, shouldRender = true) {
    const reconstructed = getReconstructedImagesForRecord(rid);
    if (!reconstructed.length) return false;

    const idx = state.history.findIndex(r => String(r.id) === String(rid));
    if (idx === -1) return false;

    const currentImgs = Array.isArray(state.history[idx].images) ? state.history[idx].images : [];
    if (reconstructed.length <= currentImgs.length && currentImgs.every((v, i) => v === reconstructed[i])) {
      return false;
    }

    state.history[idx].images = reconstructed;

    if (window.AppDB) {
      try {
        const rec = state.history[idx];
        await window.AppDB.query(
          `INSERT INTO patrol_records (id, date, time, shift, round, guard_id, guard_name, cp_id, cp_code, cp_name, is_risk, is_off_checkpoint, status, note, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rec.id, rec.date, rec.time, rec.shift, rec.round, rec.guardId, rec.guardName, rec.cpId, rec.cpCode, rec.cpName, rec.isRisk ? 1 : 0, rec.isOffCheckpoint ? 1 : 0, rec.status, rec.note, rec.images, rec.createdAt || new Date().toISOString(), rec.roundNo || 1]
        );
      } catch (e) {}
    }

    if (shouldRender) {
      saveToLocalStorage();
      renderSupervisorDashboard();
      renderGuardRecentLogs();
    }
    return true;
  }

  /**
   * แยกข้อมูล JSON ของการเดินตรวจและรูปภาพจาก ntfy event (รองรับทั้ง inline message และ file attachment)
   */
  async function extractNtfyPayload(data) {
    if (!data) return null;
    try {
      // 1. ข้อความ Inline JSON (<= 4KB) ซึ่งไม่ต้องดาวน์โหลดไฟล์แนบ
      if (data.message && typeof data.message === 'string' && data.message.trim().startsWith('{')) {
        return JSON.parse(data.message);
      }
      // 2. กรณีรายการเก่าที่เป็นไฟล์แนบ (ไม่ใส่ cache: 'no-store' เพื่อไม่ให้ติด CORS Preflight)
      if (data.attachment && data.attachment.url) {
        const attResp = await fetch(data.attachment.url);
        if (attResp.ok) {
          return await attResp.json();
        }
        return null;
      }
    } catch (e) {}
    return null;
  }

  /**
   * ประมวลผลข้อความจาก ntfy ทีละรายการแบบ Real-time
   */
  async function processNtfyMessage(data, options = {}) {
    if (!data || !data.id) return false;
    if (data.event && data.event !== 'message') return false;
    if (seenNtfyIds.has(data.id)) return false;

    const parsed = await extractNtfyPayload(data);
    if (!parsed) {
      if (data.attachment && data.attachment.url) return false;
      seenNtfyIds.add(data.id);
      persistSeenNtfyIds();
      return false;
    }

    let changed = false;
    if (parsed.type === 'patrol_img_chunk') {
      const newlyCompleted = bufferImgChunk(parsed);
      if (newlyCompleted) {
        changed = await applyBufferedImagesToRecord(parsed.rid, true);
      }
    } else if (parsed.record) {
      if (parsed.type === 'patrol_record' || parsed.type === 'patrol_update') {
        const bufferedImgs = getReconstructedImagesForRecord(parsed.record.id);
        if (bufferedImgs.length > ((parsed.record.images && parsed.record.images.length) || 0)) {
          parsed.record.images = bufferedImgs;
        }
        changed = await handleIncomingRecord(parsed.record, parsed.type === 'patrol_update', options);
      } else if (parsed.type === 'patrol_delete') {
        changed = await handleIncomingDelete(parsed.record.ids || parsed.record.id);
      }
    }

    seenNtfyIds.add(data.id);
    persistSeenNtfyIds();
    markCloudUpdated();
    return changed;
  }

  function markCloudUpdated() {
    lastCloudUpdateAt = new Date();
    updateCloudSyncUI(sseConnected ? 'connected' : 'polling');
  }

  function scheduleSseReconnect() {
    if (sseReconnectTimer) return;
    const delay = sseBackoffMs;
    sseBackoffMs = Math.min(sseBackoffMs * 2, 12000);
    sseReconnectTimer = setTimeout(() => {
      sseReconnectTimer = null;
      connectCloudSSE();
    }, delay);
  }

  function connectCloudSSE() {
    if (typeof EventSource === 'undefined') return;
    try {
      if (cloudEventSource) {
        try { cloudEventSource.close(); } catch (e) {}
        cloudEventSource = null;
      }
      const es = new EventSource(`${CLOUD_SYNC_URL}/sse`);
      cloudEventSource = es;
      sseLastActivity = Date.now();

      const touch = () => { sseLastActivity = Date.now(); };

      es.onopen = () => {
        touch();
        sseConnected = true;
        sseBackoffMs = 1500;
        updateCloudSyncUI('connected');
      };
      es.addEventListener('open', touch);
      es.addEventListener('keepalive', touch);

      es.onmessage = async (event) => {
        touch();
        try {
          const data = JSON.parse(event.data);
          await processNtfyMessage(data, { notify: true });
        } catch (err) {}
      };

      es.onerror = () => {
        sseConnected = false;
        updateCloudSyncUI('reconnecting');
        try { es.close(); } catch (e) {}
        if (cloudEventSource === es) cloudEventSource = null;
        scheduleSseReconnect();
      };
    } catch (e) {
      console.warn('SSE setup error:', e);
      scheduleSseReconnect();
    }
  }

  function setupCloudSyncReceiver() {
    // 1. Listen for local tab broadcasts (zero latency)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('yru_patrol_channel');
        bc.onmessage = (event) => {
          if (!event.data) return;
          if (event.data.type === 'patrol_record' || event.data.type === 'NEW_RECORD' || event.data.type === 'patrol_update') {
            handleIncomingRecord(event.data.record, event.data.type === 'patrol_update', { notify: true });
          } else if (event.data.type === 'patrol_delete' && event.data.record) {
            handleIncomingDelete(event.data.record.ids || event.data.record.id);
          }
        };
      } catch (e) {}
    }

    // 2. Listen for storage events (cross-tab support)
    window.addEventListener('storage', (e) => {
      if (e.key === 'yru_sp_history' || e.key === 'yru_sp_sql_db') {
        reloadFromStorageAndRender();
      }
    });

    // 3. Real-Time Cloud SSE Receiver (cross-device: iPhone / Android -> Admin)
    connectCloudSSE();

    // 4. ดึงข้อมูลย้อนหลัง 24 ชม. ตอนเริ่มต้น และดึงข้อมูลใหม่ทุกๆ 5 วินาทีควบคู่กับ SSE
    pollRecentCloudRecords(true);
    if (syncIntervalId) clearInterval(syncIntervalId);
    let tickCount = 0;
    syncIntervalId = setInterval(() => {
      tickCount++;
      if (typeof EventSource !== 'undefined' && Date.now() - sseLastActivity > 70000) {
        sseConnected = false;
        connectCloudSSE();
      }
      pollRecentCloudRecords(false);
      if (tickCount % 3 === 0) {
        reloadFromStorageAndRender();
      }
      updateCloudSyncUI(sseConnected ? 'connected' : 'polling');
    }, 5000);

    // 5. เมื่อกลับมาเปิดหน้าจอบน iPhone / Android / PC ให้ซิงค์ทันที
    const resyncNow = () => {
      if (document.hidden) return;
      if (!sseConnected || Date.now() - sseLastActivity > 20000) {
        connectCloudSSE();
      }
      pollRecentCloudRecords(false);
      flushOutbox();
    };
    document.addEventListener('visibilitychange', resyncNow);
    window.addEventListener('online', resyncNow);
    window.addEventListener('pageshow', resyncNow);
    window.addEventListener('focus', resyncNow);

    // 6. เริ่มคิวส่งข้อมูลสำรอง
    startOutboxWorker();

    // 7. ขออนุญาตแจ้งเตือนสำหรับแอดมิน
    if (state.currentUser && state.currentUser.role === 'admin' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const askOnce = () => {
        try { Notification.requestPermission(); } catch (e) {}
        document.removeEventListener('click', askOnce);
      };
      document.addEventListener('click', askOnce);
    }
  }

  function updateCloudSyncUI(status) {
    if (!el.cloudSyncStatusText) return;
    const t = lastCloudUpdateAt
      ? ` • อัปเดตล่าสุด ${String(lastCloudUpdateAt.getHours()).padStart(2, '0')}:${String(lastCloudUpdateAt.getMinutes()).padStart(2, '0')}:${String(lastCloudUpdateAt.getSeconds()).padStart(2, '0')} น.`
      : '';
    if (status === 'connected') {
      el.cloudSyncStatusText.innerHTML = `<span class="live-sync-pill"><span class="live-sync-dot on"></span>LIVE</span> รับข้อมูลและรูปภาพจาก iPhone / Android แบบ Real-time${t}`;
    } else if (status === 'polling') {
      el.cloudSyncStatusText.innerHTML = `<span class="live-sync-pill"><span class="live-sync-dot on"></span>SYNC</span> ซิงค์ข้อมูลอัตโนมัติแบบ Real-time ทุก 5 วินาที${t}`;
    } else {
      el.cloudSyncStatusText.innerHTML = `<span class="live-sync-pill"><span class="live-sync-dot"></span>SYNC</span> กำลังเชื่อมต่อระบบ Real-time...${t}`;
    }
  }

  let newRecordAudioCtx = null;
  function alertAdminNewRecord(incoming) {
    if (!state.currentUser || state.currentUser.role !== 'admin') return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        newRecordAudioCtx = newRecordAudioCtx || new Ctx();
        const ctx = newRecordAudioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = incoming.status === 'alert' ? 980 : 760;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
    try {
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(incoming.status === 'alert' ? '🚨 แจ้งเหตุ / จุดเสี่ยง' : '✅ รายงานเวียนตรวจใหม่', {
          body: `${incoming.cpName || ''} • ${incoming.guardName || ''} • ${incoming.time || ''}`,
          tag: String(incoming.id)
        });
      }
    } catch (e) {}
  }

  async function handleIncomingDelete(idOrIds) {
    if (!idOrIds) return false;
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (window.AppDB && typeof window.AppDB.markIdsDeleted === 'function') {
      window.AppDB.markIdsDeleted(ids);
    }
    const idSet = new Set(ids.map(String));
    const before = state.history.length;
    state.history = state.history.filter(r => !idSet.has(String(r.id)));
    if (state.history.length !== before) {
      if (window.AppDB) {
        for (const recordId of ids) {
          try {
            await window.AppDB.query(`DELETE FROM patrol_records WHERE id = ?`, [recordId]);
          } catch (e) {}
        }
      }
      saveToLocalStorage();
      renderSupervisorDashboard();
      renderGuardRecentLogs();
      return true;
    }
    return false;
  }

  async function handleIncomingRecord(incoming, isUpdate = false, options = {}) {
    if (!incoming || !incoming.id) return false;
    if (window.AppDB && typeof window.AppDB.isIdDeleted === 'function' && window.AppDB.isIdDeleted(incoming.id)) {
      return false;
    }

    // แนบรูปที่ประกอบเสร็จแล้วจากบัฟเฟอร์ (ถ้ามี)
    const bufferedImgs = getReconstructedImagesForRecord(incoming.id);
    if (bufferedImgs.length > ((incoming.images && incoming.images.length) || 0)) {
      incoming.images = bufferedImgs;
    }

    const existingIdx = state.history.findIndex(r => r.id === incoming.id);
    if (existingIdx !== -1 && !isUpdate) {
      const exImgs = (state.history[existingIdx].images || []).length;
      const incImgs = (incoming.images || []).length;
      if (incImgs <= exImgs) return false;
      // คงค่าเดิมและอัปเดตเฉพาะรูปที่เพิ่งมาถึงครบ
      state.history[existingIdx] = {
        ...state.history[existingIdx],
        ...incoming,
        images: incoming.images
      };
    } else if (existingIdx !== -1) {
      const keepImgs = (incoming.images && incoming.images.length > 0)
        ? incoming.images
        : (state.history[existingIdx].images || []);
      state.history[existingIdx] = {
        ...incoming,
        images: keepImgs
      };
    } else {
      state.history.unshift(incoming);
    }

    const savedRec = existingIdx !== -1 ? state.history[existingIdx] : incoming;

    if (window.AppDB) {
      try {
        await window.AppDB.query(
          `INSERT INTO patrol_records (id, date, time, shift, round, guard_id, guard_name, cp_id, cp_code, cp_name, is_risk, is_off_checkpoint, status, note, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [savedRec.id, savedRec.date, savedRec.time, savedRec.shift, savedRec.round, savedRec.guardId, savedRec.guardName, savedRec.cpId, savedRec.cpCode, savedRec.cpName, savedRec.isRisk ? 1 : 0, savedRec.isOffCheckpoint ? 1 : 0, savedRec.status, savedRec.note, savedRec.images, savedRec.createdAt || new Date().toISOString(), savedRec.roundNo || 1]
        );
      } catch (e) {}
    }

    saveToLocalStorage();
    renderSupervisorDashboard();
    renderGuardRecentLogs();

    if (existingIdx === -1 && options.notify !== false) {
      showToast(`ได้รับรายงานเวียนตรวจใหม่: ${incoming.cpName} (${incoming.guardName})`, 'ok');
      alertAdminNewRecord(incoming);
    }
    return true;
  }

  async function pollRecentCloudRecords(isInitial = false) {
    if (isPollingCloud) return;
    isPollingCloud = true;
    try {
      // ดึงข้อมูลแบบ Simple CORS GET (ไม่มี Custom Headers / cache: 'no-store')
      const sinceWindow = isInitial ? '24h' : '30m';
      const resp = await fetch(`${CLOUD_SYNC_URL}/json?poll=1&since=${sinceWindow}`);
      if (!resp.ok) return;

      const text = await resp.text();
      const lines = text.trim().split('\n').filter(Boolean);
      const unseen = [];
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data && data.id && (!data.event || data.event === 'message') && !seenNtfyIds.has(data.id)) {
            unseen.push(data);
          }
        } catch (e) {}
      }

      if (unseen.length === 0) {
        markCloudUpdated();
        return;
      }

      const parsedList = [];
      for (const m of unseen) {
        const parsed = await extractNtfyPayload(m);
        parsedList.push({ msg: m, parsed });
      }

      // Pass 1: รวบรวมคำสั่งลบ และประกอบชิ้นส่วนรูปภาพ (patrol_img_chunk) ทั้งหมดก่อน
      const deletedIds = window.AppDB && typeof window.AppDB.getDeletedIdsSet === 'function'
        ? window.AppDB.getDeletedIdsSet()
        : new Set();
      const touchedRids = new Set();

      for (const { msg, parsed } of parsedList) {
        if (!parsed) continue;
        if (parsed.type === 'patrol_delete' && parsed.record) {
          if (Array.isArray(parsed.record.ids)) parsed.record.ids.forEach(id => deletedIds.add(String(id)));
          else if (parsed.record.id) deletedIds.add(String(parsed.record.id));
          seenNtfyIds.add(msg.id);
        } else if (parsed.type === 'patrol_img_chunk') {
          bufferImgChunk(parsed);
          if (parsed.rid) touchedRids.add(String(parsed.rid));
          seenNtfyIds.add(msg.id);
        }
      }

      if (deletedIds.size > 0) {
        await handleIncomingDelete(Array.from(deletedIds));
      }

      // Pass 2: นำเข้ารายการเวียนตรวจพร้อมรูปภาพที่ประกอบเสร็จแล้ว
      for (const { msg, parsed } of parsedList) {
        if (!parsed) {
          if (!(msg.attachment && msg.attachment.url)) seenNtfyIds.add(msg.id);
          continue;
        }
        if ((parsed.type === 'patrol_record' || parsed.type === 'patrol_update') && parsed.record) {
          if (!deletedIds.has(String(parsed.record.id))) {
            await handleIncomingRecord(parsed.record, parsed.type === 'patrol_update', { notify: !isInitial });
          }
        }
        seenNtfyIds.add(msg.id);
      }

      // Pass 3: อัปเดตรูปภาพให้กับรายการที่มีอยู่ในตารางแล้วแต่เพิ่งได้รับชิ้นส่วนรูปครบในรอบนี้
      let imgUpdated = false;
      for (const rid of touchedRids) {
        if (!deletedIds.has(rid)) {
          const ok = await applyBufferedImagesToRecord(rid, false);
          if (ok) imgUpdated = true;
        }
      }
      if (imgUpdated) {
        saveToLocalStorage();
        renderSupervisorDashboard();
        renderGuardRecentLogs();
      }

      persistSeenNtfyIds();
      markCloudUpdated();
    } catch (e) {
    } finally {
      isPollingCloud = false;
    }
  }

  async function syncLatestFromCloud() {
    const btn = el.syncCloudBtn;
    const syncSvg = '<svg class="svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${syncSvg} <span>กำลังซิงค์ฐานข้อมูล SQL...</span>`;
    }
    try {
      await reloadFromStorageAndRender();
      await pollRecentCloudRecords(true);
      await flushOutbox();
      showToast('ซิงค์ฐานข้อมูล SQL และรูปภาพทั้งหมดเป็นปัจจุบันเรียบร้อยแล้ว', 'ok');
    } catch (e) {
      showToast('อัปเดตข้อมูลจากฐานข้อมูล SQL ในเครื่องเรียบร้อยแล้ว', 'ok');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${syncSvg} <span>ซิงค์ข้อมูลจากฐานข้อมูล / คลาวด์</span>`;
      }
    }
  }

  async function reloadFromStorageAndRender() {
    if (window.AppDB) {
      try {
        const records = await window.AppDB.query("SELECT * FROM patrol_records ORDER BY date DESC, time DESC");
        state.history = records || [];
      } catch (e) {}
    } else {
      const h = localStorage.getItem('yru_sp_history');
      if (h) {
        try { state.history = JSON.parse(h); } catch (e) {}
      }
    }
    renderSupervisorDashboard();
    renderGuardRecentLogs();
  }

  // --- SUPERVISOR DASHBOARD & ADMIN DELETE ENGINE ---
  const selectedRecordIds = new Set();

  function updateBulkDeleteUI() {
    const bulkBtn = document.getElementById('bulkDeleteSelectedBtn');
    const bulkTxt = document.getElementById('bulkDeleteSelectedText');
    const selectAllChk = document.getElementById('selectAllRecordsChk');
    const deleteAllBtn = document.getElementById('deleteAllRecordsBtn');

    // ล้าง ID ที่ไม่อยู่ใน state.history แล้ว
    for (const id of Array.from(selectedRecordIds)) {
      if (!state.history.some(r => r.id === id)) {
        selectedRecordIds.delete(id);
      }
    }

    if (bulkBtn && bulkTxt) {
      if (selectedRecordIds.size > 0) {
        bulkBtn.style.display = 'inline-flex';
        bulkTxt.textContent = `ลบที่เลือก (${selectedRecordIds.size} รายการ)`;
      } else {
        bulkBtn.style.display = 'none';
      }
    }

    if (deleteAllBtn) {
      deleteAllBtn.style.display = state.history.length > 0 ? 'inline-flex' : 'none';
    }

    if (selectAllChk) {
      selectAllChk.checked = state.history.length > 0 && selectedRecordIds.size === state.history.length;
    }
  }

  function renderSupervisorDashboard() {
    const total = state.history.length;
    const okCount = state.history.filter(h => h.status === 'ok').length;
    const alertCount = state.history.filter(h => h.status === 'alert').length;
    const activeCpCount = state.checkpoints.filter(c => c.active !== false).length;

    el.statTotal.textContent = total;
    el.statOk.textContent = okCount;
    el.statAlert.textContent = alertCount;
    el.statActiveCp.textContent = activeCpCount;

    // อัปเดตสถานะการเชื่อมต่อฐานข้อมูล SQL และจำนวนรูปภาพทั้งหมด
    const sqlBadge = document.getElementById('sqlDbStatusBadge');
    if (sqlBadge && window.AppDB && typeof window.AppDB.getStats === 'function') {
      const dbStats = window.AppDB.getStats();
      sqlBadge.textContent = `SQL DB: ${dbStats.recordCount} รอบตรวจ · ${dbStats.imageCount} รูปภาพ`;
    }

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

    el.logCountTag.textContent = `${filtered.length} รอบการตรวจ`;
    updateBulkDeleteUI();

    if (filtered.length === 0) {
      const msg = state.history.length === 0
        ? 'ยังไม่มีข้อมูลการเวียนตรวจในระบบ (ฐานข้อมูล SQL พร้อมรับข้อมูลและรูปภาพจากเจ้าหน้าที่ รปภ.)'
        : 'ไม่พบข้อมูลตามตัวกรองที่เลือก (กดปุ่ม "ล้างตัวกรองทั้งหมด" เพื่อดูประวัติทุกรอบ)';
      el.reportTableBody.innerHTML = `
        <tr><td colspan="9" class="empty" style="text-align:center; padding:44px 16px; color:var(--muted);">
          <svg viewBox="0 0 64 64" fill="none" style="width:48px; height:48px; margin:0 auto 10px; color:var(--primary); opacity:0.65;">
            <rect x="12" y="10" width="40" height="44" rx="6" stroke="currentColor" stroke-width="2.2"/>
            <line x1="22" y1="24" x2="42" y2="24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <line x1="22" y1="34" x2="36" y2="34" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
          <div><b>${msg}</b></div>
        </td></tr>
      `;
    } else {
      const shiftMap = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };

      el.reportTableBody.innerHTML = filtered.map((item, idx) => {
        const isOk = item.status === 'ok';
        const roundDisplayNo = item.roundNo || (filtered.length - idx);
        const isChecked = selectedRecordIds.has(item.id) ? 'checked' : '';
        let statusBadge = isOk 
          ? `<span class="tag ok">ปกติเรียบร้อย</span>` 
          : `<span class="tag alert">พบปัญหา</span>`;
        
        if (item.isOffCheckpoint) {
          statusBadge = `<span class="tag alert" style="background:#e11d48; color:#fff;">เหตุด่วนนอกจุด</span>`;
        }

        const imgs = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
        let photoPreview = `<span style="color:var(--muted)">ไม่มีรูปภาพ</span>`;
        if (imgs.length > 0) {
          const thumbsHtml = imgs.slice(0, 3).map((src, i) => `
            <button type="button" onclick="window.appOpenPhotoLightbox('${item.id}', ${i})" title="คลิกเพื่อดูรูปภาพขยายใหญ่ (รูปที่ ${i + 1})" style="padding:0; border:1.5px solid var(--primary); border-radius:8px; overflow:hidden; width:46px; height:46px; cursor:pointer; background:#000; flex-shrink:0;">
              <img src="${src}" alt="รูปที่ ${i + 1}" style="width:100%; height:100%; object-fit:cover; display:block;">
            </button>
          `).join('');
          photoPreview = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
              <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">${thumbsHtml}</div>
              <button type="button" class="photo-count-chip" onclick="window.appOpenPhotoLightbox('${item.id}', 0)" style="cursor:pointer; border:none;">
                <svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>ดูภาพ (${imgs.length} รูป)</span>
              </button>
            </div>
          `;
        }

        return `
          <tr>
            <td style="text-align: center;">
              <input type="checkbox" class="row-select-chk" data-id="${item.id}" ${isChecked} onchange="window.appToggleSelectRecord('${item.id}', this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
            </td>
            <td>
              <span class="tag" style="background:var(--primary-soft); color:var(--primary); font-size:11.5px; padding:2px 8px; margin-bottom:4px;">รอบที่ #${roundDisplayNo}</span><br>
              <b>${item.time} น.</b><br>
              <small style="color:var(--muted);">${item.date}</small>
            </td>
            <td>
              <b>${escapeHtml(item.cpName)}</b>
              ${item.isRisk ? '<br><span class="tag risk" style="font-size:11px; margin-top:4px;">พื้นที่เสี่ยง</span>' : ''}
            </td>
            <td><b>${escapeHtml(item.guardName)}</b></td>
            <td>
              <b>${shiftMap[item.shift] || item.shift}</b><br>
              <small style="color:var(--muted);">${escapeHtml(item.round || `รอบที่ ${roundDisplayNo}`)}</small>
            </td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(item.note || '-')}</td>
            <td style="text-align: center;">${photoPreview}</td>
            <td style="text-align: center;">
              <div class="admin-action-group">
                <button type="button" class="btn-action-edit" onclick="window.appOpenAdminEdit('${item.id}')" title="คลิกเพื่อตรวจสอบหรือแก้ไขข้อมูลรายการนี้">
                  <svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span>แก้ไข</span>
                </button>
                <button type="button" class="btn-action-delete" onclick="window.appDeleteRecord('${item.id}')" title="คลิกเพื่อลบข้อมูลรายการนี้ออกจากระบบ">
                  <svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>ลบ</span>
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
      el.incidentList.innerHTML = `<div class="empty">ไม่มีรายงานเหตุผิดปกติในขณะนี้ ทุกจุดตรวจเรียบร้อยดี</div>`;
    } else {
      el.incidentList.innerHTML = incidents.map(inc => `
        <div class="incident-alert-item">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:var(--alert); font-size:16.5px;">${escapeHtml(inc.cpName)}</b>
            <span class="tag alert">${inc.time} น.</span>
          </div>
          <div style="font-size:13.5px; color:var(--muted); margin-top:3px;">
            ผู้แจ้ง: <b>${escapeHtml(inc.guardName)}</b> (${inc.date})
          </div>
          <p style="margin:6px 0 0; font-size:14.5px; font-weight:600;">${escapeHtml(inc.note || 'ไม่มีรายละเอียด')}</p>
          ${inc.images && inc.images.length ? `
            <div class="thumbs" style="margin-top:8px;">
              ${inc.images.map((img, i) => `<div class="thumb" style="cursor:pointer;" onclick="window.appOpenPhotoLightbox('${inc.id}', ${i})"><img src="${img}"></div>`).join('')}
            </div>
          ` : ''}
          <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-action-edit" onclick="window.appOpenAdminEdit('${inc.id}')">
              ตรวจสอบ / แก้ไข
            </button>
            <button type="button" class="btn-action-delete" onclick="window.appDeleteRecord('${inc.id}')">
              <svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>ลบรายการนี้</span>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // --- ADMIN EDIT & INSPECT MODAL ---
  window.appOpenAdminEdit = function (recordId) {
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
    broadcastPatrolRecord(updatedRecord, 'patrol_update');
    closeAdminEditModal();
    renderSupervisorDashboard();
    renderGuardRecentLogs();
    showToast('💾 แอดมินบันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว', '✅');
  }

  window.appOpenPhotoLightbox = function (recordId, startIdx = 0) {
    const record = state.history.find(h => h.id === recordId);
    if (!record || !Array.isArray(record.images) || record.images.length === 0) {
      showToast('ไม่มีรูปภาพสำหรับรายการนี้', 'warn');
      return;
    }

    const modal = document.getElementById('photoLightboxModal');
    const titleEl = document.getElementById('lightboxTitle');
    const subEl = document.getElementById('lightboxSubtitle');
    const galleryEl = document.getElementById('lightboxGalleryContainer');
    const closeBtn = document.getElementById('closeLightboxBtn');

    if (!modal || !galleryEl) return;

    if (titleEl) titleEl.textContent = `${record.cpName} (${record.images.length} รูปภาพหลักฐาน)`;
    if (subEl) subEl.textContent = `ผู้ตรวจ: ${record.guardName} · วันที่ ${record.date} เวลา ${record.time} น. (${record.round || ''})`;

    galleryEl.innerHTML = record.images.map((src, idx) => `
      <div style="background:var(--surface-alt); border:1.5px solid ${idx === startIdx ? 'var(--primary)' : 'var(--line)'}; border-radius:14px; overflow:hidden; padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px; font-weight:700;">
          <span>ภาพถ่ายหลักฐานที่ #${idx + 1}</span>
          <a href="${src}" download="patrol_${record.id}_${idx + 1}.jpg" class="tag ok" style="text-decoration:none; font-size:11.5px;">ดาวน์โหลดรูป</a>
        </div>
        <img src="${src}" alt="ภาพถ่ายหลักฐาน ${idx + 1}" style="width:100%; max-height:460px; object-fit:contain; border-radius:10px; background:#000; display:block;">
      </div>
    `).join('');

    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const closeLightbox = () => {
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
      document.body.style.overflow = '';
    };

    if (closeBtn) closeBtn.onclick = closeLightbox;
    modal.onclick = (e) => {
      if (e.target === modal) closeLightbox();
    };
  };

  // --- ADMIN DELETE FUNCTIONS (ลบรายการเดียว, ลบหลายรายการที่เลือก, และลบทั้งหมด) ---
  let pendingDeleteAction = null;

  function openDeleteConfirmModal({ title, message, onConfirm }) {
    const modal = document.getElementById('deleteConfirmModal');
    const titleEl = document.getElementById('deleteConfirmTitle');
    const msgEl = document.getElementById('deleteConfirmMessage');
    const cancelBtn = document.getElementById('cancelDeleteModalBtn');
    const confirmBtn = document.getElementById('confirmDeleteModalBtn');

    if (!modal || !confirmBtn) {
      if (confirm(message || 'ยืนยันการลบข้อมูลนี้?')) {
        onConfirm();
      }
      return;
    }

    if (titleEl) titleEl.textContent = title || 'ยืนยันการลบข้อมูลออกจากระบบ?';
    if (msgEl) msgEl.innerHTML = message || 'ข้อมูลและรูปภาพหลักฐานจะถูกลบออกจากฐานข้อมูล SQL อย่างถาวร';

    pendingDeleteAction = onConfirm;

    const closeModal = () => {
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
      document.body.style.overflow = '';
      pendingDeleteAction = null;
    };

    cancelBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    confirmBtn.onclick = async () => {
      const action = pendingDeleteAction;
      closeModal();
      if (typeof action === 'function') {
        await action();
      }
    };

    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.appToggleSelectRecord = function (recordId, isChecked) {
    if (isChecked) {
      selectedRecordIds.add(recordId);
    } else {
      selectedRecordIds.delete(recordId);
    }
    updateBulkDeleteUI();
  };

  window.appDeleteRecord = function (recordId) {
    deleteAdminRecord(recordId);
  };

  async function executeDeleteRecordIds(ids = []) {
    if (!ids.length) return;
    const idSet = new Set(ids);

    if (window.AppDB && typeof window.AppDB.markIdsDeleted === 'function') {
      window.AppDB.markIdsDeleted(ids);
    }

    ids.forEach(recordId => {
      const rec = state.history.find(h => h.id === recordId);
      if (rec && rec.cpId && state.roundChecks[rec.cpId]) {
        delete state.roundChecks[rec.cpId];
      }
      selectedRecordIds.delete(recordId);
    });

    state.history = state.history.filter(h => !idSet.has(h.id));

    if (window.AppDB) {
      for (const recordId of ids) {
        await window.AppDB.query(`DELETE FROM patrol_records WHERE id = ?`, [recordId]);
      }
    }

    saveToLocalStorage();
    broadcastPatrolRecord({ id: ids[0], ids: ids }, 'patrol_delete');

    closeAdminEditModal();
    renderSupervisorDashboard();
    renderGuardRecentLogs();
  }

  function deleteAdminRecord(recordId) {
    const rec = state.history.find(h => h.id === recordId);
    const label = rec ? `<b>${escapeHtml(rec.cpName)}</b> (${escapeHtml(rec.guardName)} · ${rec.time} น.)` : `รายการรหัส ${escapeHtml(recordId)}`;

    openDeleteConfirmModal({
      title: 'ยืนยันการลบบันทึกการเดินตรวจ?',
      message: `คุณต้องการลบข้อมูลและรูปภาพของ ${label} ออกจากฐานข้อมูล SQL อย่างถาวรใช่หรือไม่?`,
      onConfirm: async () => {
        await executeDeleteRecordIds([recordId]);
        showToast('ลบบันทึกข้อมูลและรูปภาพออกจากฐานข้อมูลเรียบร้อยแล้ว', 'ok');
      }
    });
  }

  function setupAdminBulkDeleteEvents() {
    const selectAllChk = document.getElementById('selectAllRecordsChk');
    const bulkBtn = document.getElementById('bulkDeleteSelectedBtn');
    const deleteAllBtn = document.getElementById('deleteAllRecordsBtn');

    if (selectAllChk) {
      selectAllChk.addEventListener('change', (e) => {
        const checked = e.target.checked;
        selectedRecordIds.clear();
        if (checked) {
          state.history.forEach(r => selectedRecordIds.add(r.id));
        }
        renderSupervisorDashboard();
      });
    }

    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        const ids = Array.from(selectedRecordIds);
        if (!ids.length) return;
        openDeleteConfirmModal({
          title: `ยืนยันการลบข้อมูลที่เลือก (${ids.length} รายการ)?`,
          message: `คุณต้องการลบข้อมูลการเดินตรวจและรูปภาพที่เลือกทั้งหมด <b>${ids.length} รายการ</b> ออกจากฐานข้อมูล SQL อย่างถาวรใช่หรือไม่?`,
          onConfirm: async () => {
            await executeDeleteRecordIds(ids);
            showToast(`ลบข้อมูลที่เลือกจำนวน ${ids.length} รายการเรียบร้อยแล้ว`, 'ok');
          }
        });
      });
    }

    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', () => {
        if (!state.history.length) {
          showToast('ไม่มีข้อมูลในระบบให้ลบ', 'warn');
          return;
        }
        const allIds = state.history.map(r => r.id);
        openDeleteConfirmModal({
          title: `ยืนยันการล้างประวัติทั้งหมด (${allIds.length} รายการ)?`,
          message: `คุณต้องการลบประวัติการเดินตรวจและรูปภาพหลักฐานทั้งหมด <b>${allIds.length} รายการ</b> ออกจากฐานข้อมูล SQL อย่างถาวรใช่หรือไม่?`,
          onConfirm: async () => {
            if (window.AppDB && typeof window.AppDB.markIdsDeleted === 'function') {
              window.AppDB.markIdsDeleted(allIds);
            }
            selectedRecordIds.clear();
            state.history = [];
            state.roundChecks = {};
            if (window.AppDB) {
              await window.AppDB.query(`DELETE FROM patrol_records`);
            }
            saveToLocalStorage();
            broadcastPatrolRecord({ ids: allIds }, 'patrol_delete');
            renderSupervisorDashboard();
            renderGuardRecentLogs();
            showToast('ล้างข้อมูลประวัติการเดินตรวจทั้งหมดเรียบร้อยแล้ว', 'ok');
          }
        });
      });
    }
  }
  setupAdminBulkDeleteEvents();

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
  function showToast(msg, icon = 'info') {
    if (toastTimer) clearTimeout(toastTimer);
    // Strip leading emojis for clean professional look
    const cleanMsg = String(msg || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]+/u, '').trim() || msg;
    el.toastMsg.textContent = cleanMsg;
    const isWarn = String(icon).includes('⚠') || String(icon).includes('❌') || String(icon).includes('🚨') || icon === 'warn';
    const isOk = String(icon).includes('✅') || icon === 'ok';
    if (isWarn) {
      el.toastIcon.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (isOk) {
      el.toastIcon.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
      el.toastIcon.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    el.toast.removeAttribute('hidden');
    el.toast.style.display = 'inline-flex';
    toastTimer = setTimeout(() => {
      el.toast.setAttribute('hidden', '');
      el.toast.style.display = 'none';
    }, 3000);
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
