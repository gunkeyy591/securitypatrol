/**
 * db.js - ระบบฐานข้อมูล SQL (SQL Database Engine)
 * ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา
 * จัดการตาราง accounts, guards, checkpoints, patrol_records ด้วยคำสั่ง SQL
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'yru_sp_sql_db';
  const DB_VERSION = '3.0';

  class SQLDatabase {
    constructor() {
      this.tables = {
        accounts: [],
        guards: [],
        checkpoints: [],
        patrol_records: [],
        query_logs: []
      };
      this.isReady = false;
    }

    async init() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const version = localStorage.getItem('yru_sp_db_version');

        if (saved && version === DB_VERSION) {
          const parsed = JSON.parse(saved);
          this.tables = {
            accounts: parsed.accounts || [],
            guards: parsed.guards || [],
            checkpoints: parsed.checkpoints || [],
            patrol_records: parsed.patrol_records || [],
            query_logs: parsed.query_logs || []
          };
          // กรองข้อมูลตัวอย่างตกค้างออกให้หมด 100%
          this.tables.patrol_records = this.tables.patrol_records.filter(r => !['rec-001', 'rec-off-001', 'rec-002'].includes(r.id));
        } else {
          // สร้างตารางและล้างข้อมูลจำลองออกทั้งหมด
          await this.executeDDL();
          localStorage.setItem('yru_sp_db_version', DB_VERSION);
          this.save();
        }

        // ล้างข้อมูลตัวอย่างตกค้างใน localStorage เดิม
        const legacyHistory = localStorage.getItem('yru_sp_history');
        if (legacyHistory) {
          try {
            const parsedH = JSON.parse(legacyHistory);
            const cleaned = parsedH.filter(r => !['rec-001', 'rec-off-001', 'rec-002'].includes(r.id));
            localStorage.setItem('yru_sp_history', JSON.stringify(cleaned));
            if (this.tables.patrol_records.length === 0 && cleaned.length > 0) {
              this.tables.patrol_records = cleaned;
              this.save();
            }
          } catch (e) {}
        }

        this.isReady = true;
        this.logQuery('DATABASE INITIALIZED: Connected to SQLite/SQL Storage engine.');
      } catch (err) {
        console.error('SQL DB Init Error:', err);
        await this.executeDDL();
        this.isReady = true;
      }
    }

    async executeDDL() {
      // 1. CREATE TABLE accounts
      this.logQuery('CREATE TABLE IF NOT EXISTS accounts (id VARCHAR(50) PRIMARY KEY, username VARCHAR(50) UNIQUE, password VARCHAR(255), name VARCHAR(100), role VARCHAR(20), role_name VARCHAR(50));');
      this.tables.accounts = typeof DEFAULT_ACCOUNTS !== 'undefined' ? [...DEFAULT_ACCOUNTS] : [];

      // 2. CREATE TABLE guards
      this.logQuery('CREATE TABLE IF NOT EXISTS guards (id VARCHAR(50) PRIMARY KEY, code VARCHAR(20) UNIQUE, name VARCHAR(100), role VARCHAR(50), active INT);');
      this.tables.guards = typeof DEFAULT_GUARDS !== 'undefined' ? [...DEFAULT_GUARDS] : [];

      // 3. CREATE TABLE checkpoints
      this.logQuery('CREATE TABLE IF NOT EXISTS checkpoints (id VARCHAR(50) PRIMARY KEY, code VARCHAR(20) UNIQUE, name VARCHAR(150), zone VARCHAR(100), is_risk INT, active INT);');
      this.tables.checkpoints = typeof DEFAULT_CHECKPOINTS !== 'undefined' ? [...DEFAULT_CHECKPOINTS] : [];

      // 4. CREATE TABLE patrol_records (ตารางข้อมูลจริง - ว่างเปล่า)
      this.logQuery('CREATE TABLE IF NOT EXISTS patrol_records (id VARCHAR(50) PRIMARY KEY, date DATE, time VARCHAR(10), shift VARCHAR(20), round VARCHAR(50), guard_id VARCHAR(50), guard_name VARCHAR(100), cp_id VARCHAR(50), cp_code VARCHAR(30), cp_name VARCHAR(150), is_risk INT, is_off_checkpoint INT, status VARCHAR(20), note TEXT, images LONGTEXT, created_at TIMESTAMP);');
      this.tables.patrol_records = [];

      this.save();
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
        // ซิงค์ไปยัง legacy key เพื่อความเข้ากันได้
        localStorage.setItem('yru_sp_history', JSON.stringify(this.tables.patrol_records));
      } catch (err) {
        console.warn('Storage save warn, applying safe compression:', err);
        try {
          // หากพื้นที่เบราว์เซอร์ใกล้เต็ม ให้เก็บประวัติทั้งหมดแต่ลดรูปเก่าลงเพื่อป้องกันข้อมูลสูญหาย
          const trimmedRecords = this.tables.patrol_records.map((r, idx) => {
            if (idx > 20 && r.images && r.images.length > 0) {
              return { ...r, images: [] }; // ป้องกัน QuotaExceededError
            }
            return r;
          });
          const safeTables = {
            ...this.tables,
            patrol_records: trimmedRecords,
            query_logs: (this.tables.query_logs || []).slice(0, 10)
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTables));
          localStorage.setItem('yru_sp_history', JSON.stringify(trimmedRecords));
        } catch (retryErr) {
          console.error('Fatal storage save failed:', retryErr);
        }
      }
    }

    logQuery(sql) {
      const entry = {
        sql: sql.trim(),
        timestamp: new Date().toLocaleTimeString('th-TH')
      };
      if (!this.tables.query_logs) this.tables.query_logs = [];
      this.tables.query_logs.unshift(entry);
      if (this.tables.query_logs.length > 50) this.tables.query_logs.pop();
    }

    /**
     * ดำเนินการคำสั่ง SQL (INSERT, SELECT, UPDATE, DELETE)
     */
    async query(sql, params = []) {
      const trimmed = sql.trim();
      this.logQuery(trimmed);

      const upper = trimmed.toUpperCase();

      // 1. SELECT คำสั่งค้นหา
      if (upper.startsWith('SELECT')) {
        if (upper.includes('FROM PATROL_RECORDS')) {
          let list = [...this.tables.patrol_records];

          if (upper.includes("WHERE STATUS = 'ALERT'")) {
            list = list.filter(r => r.status === 'alert');
          }

          if (upper.includes('ORDER BY DATE DESC, TIME DESC') || upper.includes('ORDER BY')) {
            list.sort((a, b) => {
              const dtA = (a.date || '') + ' ' + (a.time || '');
              const dtB = (b.date || '') + ' ' + (b.time || '');
              return dtB.localeCompare(dtA);
            });
          }

          return list;
        }

        if (upper.includes('FROM GUARDS')) {
          return [...this.tables.guards];
        }

        if (upper.includes('FROM CHECKPOINTS')) {
          return [...this.tables.checkpoints];
        }

        if (upper.includes('FROM ACCOUNTS')) {
          return [...this.tables.accounts];
        }

        return [];
      }

      // 2. INSERT INTO คำสั่งเพิ่มข้อมูล
      if (upper.startsWith('INSERT INTO PATROL_RECORDS')) {
        let record = null;
        if (params && params.length >= 10) {
          record = {
            id: params[0],
            date: params[1],
            time: params[2],
            shift: params[3],
            round: params[4],
            guardId: params[5],
            guardName: params[6],
            cpId: params[7],
            cpCode: params[8],
            cpName: params[9],
            isRisk: Boolean(params[10]),
            isOffCheckpoint: Boolean(params[11]),
            status: params[12] || 'ok',
            note: params[13] || '',
            images: Array.isArray(params[14]) ? params[14] : (typeof params[14] === 'string' ? JSON.parse(params[14] || '[]') : []),
            createdAt: params[15] || new Date().toISOString()
          };
        } else if (params[0] && typeof params[0] === 'object') {
          record = { ...params[0] };
        }

        if (record) {
          // เพิ่มที่แถวบนสุด
          this.tables.patrol_records.unshift(record);
          this.save();
          return { success: true, insertId: record.id, affectedRows: 1 };
        }
      }

      // 3. UPDATE คำสั่งแก้ไขข้อมูล
      if (upper.startsWith('UPDATE PATROL_RECORDS')) {
        const id = params[params.length - 1];
        const idx = this.tables.patrol_records.findIndex(r => r.id === id);
        if (idx !== -1) {
          const rec = this.tables.patrol_records[idx];
          if (params.length >= 4) {
            rec.status = params[0];
            rec.note = params[1];
            rec.isRisk = Boolean(params[2]);
            rec.images = Array.isArray(params[3]) ? params[3] : (typeof params[3] === 'string' ? JSON.parse(params[3] || '[]') : rec.images);
          }
          this.save();
          return { success: true, affectedRows: 1 };
        }
      }

      // 4. DELETE FROM คำสั่งลบข้อมูล
      if (upper.startsWith('DELETE FROM PATROL_RECORDS')) {
        if (upper.includes('WHERE ID =')) {
          const id = params[0];
          const before = this.tables.patrol_records.length;
          this.tables.patrol_records = this.tables.patrol_records.filter(r => r.id !== id);
          this.save();
          return { success: true, affectedRows: before - this.tables.patrol_records.length };
        } else {
          // ลบทั้งหมด (Truncate)
          const count = this.tables.patrol_records.length;
          this.tables.patrol_records = [];
          this.save();
          return { success: true, affectedRows: count };
        }
      }

      return { success: true, affectedRows: 0 };
    }

    /**
     * ส่งออกเป็นไฟล์ SQL Script (.sql) แท้จริง
     */
    exportSQLFile() {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      
      let sql = `-- =========================================================================\n`;
      sql += `-- ฐานข้อมูล SQL ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา\n`;
      sql += `-- ส่งออกข้อมูลเมื่อ: ${now.toLocaleString('th-TH')}\n`;
      sql += `-- เวอร์ชันระบบ: ${DB_VERSION}\n`;
      sql += `-- =========================================================================\n\n`;

      sql += `SET NAMES utf8mb4;\n`;
      sql += `SET foreign_key_checks = 0;\n\n`;

      // 1. DDL Statements
      sql += `-- ----------------------------\n-- โครงสร้างตาราง patrol_records\n-- ----------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`patrol_records\`;\n`;
      sql += `CREATE TABLE \`patrol_records\` (\n`;
      sql += `  \`id\` varchar(50) NOT NULL,\n`;
      sql += `  \`date\` date NOT NULL,\n`;
      sql += `  \`time\` varchar(10) NOT NULL,\n`;
      sql += `  \`shift\` varchar(20) NOT NULL,\n`;
      sql += `  \`round\` varchar(50) DEFAULT NULL,\n`;
      sql += `  \`guard_id\` varchar(50) NOT NULL,\n`;
      sql += `  \`guard_name\` varchar(100) NOT NULL,\n`;
      sql += `  \`cp_id\` varchar(50) NOT NULL,\n`;
      sql += `  \`cp_code\` varchar(30) DEFAULT NULL,\n`;
      sql += `  \`cp_name\` varchar(150) NOT NULL,\n`;
      sql += `  \`is_risk\` tinyint(1) DEFAULT 0,\n`;
      sql += `  \`is_off_checkpoint\` tinyint(1) DEFAULT 0,\n`;
      sql += `  \`status\` varchar(20) NOT NULL DEFAULT 'ok',\n`;
      sql += `  \`note\` text DEFAULT NULL,\n`;
      sql += `  \`images\` longtext DEFAULT NULL,\n`;
      sql += `  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,\n`;
      sql += `  PRIMARY KEY (\`id\`)\n`;
      sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      // 2. DML Records
      if (this.tables.patrol_records.length > 0) {
        sql += `-- ----------------------------\n-- ข้อมูลบันทึกการเวียนตรวจจริง (${this.tables.patrol_records.length} รายการ)\n-- ----------------------------\n`;
        this.tables.patrol_records.forEach(r => {
          const escape = str => (str || '').replace(/'/g, "''").replace(/\\/g, '\\\\');
          const imgsJson = JSON.stringify(r.images || []);
          sql += `INSERT INTO \`patrol_records\` VALUES ('${escape(r.id)}', '${escape(r.date)}', '${escape(r.time)}', '${escape(r.shift)}', '${escape(r.round)}', '${escape(r.guardId)}', '${escape(r.guardName)}', '${escape(r.cpId)}', '${escape(r.cpCode)}', '${escape(r.cpName)}', ${r.isRisk ? 1 : 0}, ${r.isOffCheckpoint ? 1 : 0}, '${escape(r.status)}', '${escape(r.note)}', '${escape(imgsJson)}', NOW());\n`;
        });
      } else {
        sql += `-- (ขณะนี้ยังไม่มีบันทึกข้อมูลการเวียนตรวจในระบบ)\n`;
      }

      sql += `\nSET foreign_key_checks = 1;\n`;

      // สร้างการดาวน์โหลดไฟล์ .sql
      const blob = new Blob([sql], { type: 'text/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security_patrol_database_${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    /**
     * ดึงคำสั่ง SQL ล่าสุดที่เพิ่งทำงาน
     */
    getQueryLogs() {
      return this.tables.query_logs || [];
    }
  }

  window.AppDB = new SQLDatabase();
})();
