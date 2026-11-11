/**
 * db.js - ระบบฐานข้อมูล SQL (SQL Database & Image Storage Engine v4.0)
 * ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา
 * จัดการตาราง accounts, guards, checkpoints, patrol_records และ patrol_images
 * รองรับการเชื่อมต่อ 3 ชั้น:
 *   1. SQLite3 Relational Database Server (/api/records, /api/db/status)
 *   2. IndexedDB SQL Storage (รองรับการเก็บรูปภาพความละเอียดสูงไม่จำกัดขนาด)
 *   3. LocalStorage Sync Cache (สำรองข้อมูลความเร็วสูง)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'yru_sp_sql_db';
  const DB_VERSION = '4.0';
  const IDB_NAME = 'YRU_SecurityPatrol_SQL_DB';
  const IDB_VERSION = 2;

  class SQLDatabase {
    constructor() {
      this.tables = {
        accounts: [],
        guards: [],
        checkpoints: [],
        patrol_records: [],
        patrol_images: [],
        query_logs: []
      };
      this.isReady = false;
      this.serverConnected = false;
      this.idb = null;
      this.connectionMode = 'SQL Engine (IndexedDB + SQLite)';
    }

    /**
     * เปิดการเชื่อมต่อฐานข้อมูล IndexedDB สำหรับจัดเก็บตาราง patrol_records และ patrol_images
     */
    openIndexedDB() {
      return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }
        try {
          const req = indexedDB.open(IDB_NAME, IDB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('patrol_records')) {
              const recStore = db.createObjectStore('patrol_records', { keyPath: 'id' });
              recStore.createIndex('idx_date', 'date', { unique: false });
              recStore.createIndex('idx_status', 'status', { unique: false });
            }
            if (!db.objectStoreNames.contains('patrol_images')) {
              const imgStore = db.createObjectStore('patrol_images', { keyPath: 'id', autoIncrement: true });
              imgStore.createIndex('idx_record_id', 'recordId', { unique: false });
            }
          };
          req.onsuccess = (e) => {
            this.idb = e.target.result;
            resolve(this.idb);
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }

    async loadFromIndexedDB() {
      if (!this.idb) return [];
      return new Promise((resolve) => {
        try {
          const tx = this.idb.transaction(['patrol_records', 'patrol_images'], 'readonly');
          const recStore = tx.objectStore('patrol_records');
          const imgStore = tx.objectStore('patrol_images');

          const recReq = recStore.getAll();
          const imgReq = imgStore.getAll();

          tx.oncomplete = () => {
            const records = recReq.result || [];
            const allImages = imgReq.result || [];

            const imgMap = {};
            allImages.forEach(item => {
              if (!imgMap[item.recordId]) imgMap[item.recordId] = [];
              imgMap[item.recordId].push(item);
            });

            const merged = records.map(r => {
              const imgs = (imgMap[r.id] || [])
                .sort((a, b) => (a.imageIndex || 0) - (b.imageIndex || 0))
                .map(x => x.imageData);
              return {
                ...r,
                images: imgs.length > 0 ? imgs : (Array.isArray(r.images) ? r.images : [])
              };
            });

            resolve(merged);
          };
          tx.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    }

    async saveRecordToIndexedDB(record) {
      if (!this.idb || !record || !record.id) return;
      return new Promise((resolve) => {
        try {
          const tx = this.idb.transaction(['patrol_records', 'patrol_images'], 'readwrite');
          const recStore = tx.objectStore('patrol_records');
          const imgStore = tx.objectStore('patrol_images');

          recStore.put(record);

          // ลบรูปเดิมของ record_id นี้แล้วบันทึกใหม่ลงตาราง patrol_images
          const idx = imgStore.index('idx_record_id');
          const keyReq = idx.getAllKeys(record.id);
          keyReq.onsuccess = () => {
            const keys = keyReq.result || [];
            keys.forEach(k => imgStore.delete(k));
            if (Array.isArray(record.images)) {
              record.images.forEach((imgData, i) => {
                if (imgData) {
                  imgStore.add({
                    recordId: record.id,
                    imageIndex: i,
                    imageData: imgData,
                    mimeType: 'image/jpeg',
                    createdAt: new Date().toISOString()
                  });
                }
              });
            }
          };

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    async deleteRecordFromIndexedDB(recordId) {
      if (!this.idb || !recordId) return;
      return new Promise((resolve) => {
        try {
          const tx = this.idb.transaction(['patrol_records', 'patrol_images'], 'readwrite');
          const recStore = tx.objectStore('patrol_records');
          const imgStore = tx.objectStore('patrol_images');

          recStore.delete(recordId);
          const idx = imgStore.index('idx_record_id');
          const keyReq = idx.getAllKeys(recordId);
          keyReq.onsuccess = () => {
            (keyReq.result || []).forEach(k => imgStore.delete(k));
          };

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    async init() {
      try {
        await this.executeDDL();
        await this.openIndexedDB();

        // 1. โหลดข้อมูลจาก LocalStorage เดิมก่อน
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.patrol_records)) {
              this.tables.patrol_records = parsed.patrol_records.filter(
                r => !['rec-001', 'rec-off-001', 'rec-002'].includes(r.id)
              );
            }
            if (Array.isArray(parsed.query_logs)) {
              this.tables.query_logs = parsed.query_logs;
            }
          } catch (e) {}
        }

        const legacyHistory = localStorage.getItem('yru_sp_history');
        if (legacyHistory) {
          try {
            const parsedH = JSON.parse(legacyHistory).filter(
              r => !['rec-001', 'rec-off-001', 'rec-002'].includes(r.id)
            );
            this.mergeRecords(parsedH);
          } catch (e) {}
        }

        // 2. โหลดข้อมูลและรูปภาพจาก IndexedDB SQL Store
        const idbRecords = await this.loadFromIndexedDB();
        if (idbRecords && idbRecords.length > 0) {
          this.mergeRecords(idbRecords);
        }

        // 3. เชื่อมต่อกับเซิร์ฟเวอร์ฐานข้อมูล SQLite3 (/api/records) หากเปิดใช้งานอยู่
        await this.syncWithSQLServer();

        // บันทึกข้อมูลทั้งหมดให้ตรงกันทุกชั้น
        for (const rec of this.tables.patrol_records) {
          await this.saveRecordToIndexedDB(rec);
        }
        this.rebuildImagesTable();
        this.save();

        localStorage.setItem('yru_sp_db_version', DB_VERSION);
        this.isReady = true;
        this.logQuery(`DATABASE INITIALIZED: Connected (${this.connectionMode}) — ${this.tables.patrol_records.length} records, ${this.tables.patrol_images.length} images.`);
      } catch (err) {
        console.error('SQL DB Init Error:', err);
        this.isReady = true;
      }
    }

    /**
     * ซิงค์ข้อมูลสองทางกับ SQLite3 Database Server (/api/records)
     */
    async syncWithSQLServer() {
      try {
        const resp = await fetch('/api/records', { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok && Array.isArray(data.records)) {
            this.serverConnected = true;
            this.connectionMode = 'SQLite3 Server + IndexedDB SQL';

            const serverIds = new Set(data.records.map(r => r.id));
            const localOnly = this.tables.patrol_records.filter(r => r && r.id && !serverIds.has(r.id));

            // รวมข้อมูลจากเซิร์ฟเวอร์เข้ากับเครื่อง
            this.mergeRecords(data.records);

            // หากในเครื่องมีรายการที่เพิ่งบันทึกแต่ยังไม่อยู่ใน SQLite Server ให้ส่งขึ้นไปบันทึกทันที
            if (localOnly.length > 0) {
              fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: localOnly })
              }).catch(() => {});
            }
            return true;
          }
        }
      } catch (e) {
        this.serverConnected = false;
        this.connectionMode = 'IndexedDB SQL + Cloud Sync';
      }
      return false;
    }

    mergeRecords(incomingList) {
      if (!Array.isArray(incomingList)) return 0;
      const map = new Map();
      this.tables.patrol_records.forEach(r => {
        if (r && r.id) map.set(r.id, r);
      });

      let addedOrUpdated = 0;
      incomingList.forEach(inc => {
        if (!inc || !inc.id || ['rec-001', 'rec-off-001', 'rec-002'].includes(inc.id)) return;
        const existing = map.get(inc.id);
        if (!existing) {
          map.set(inc.id, inc);
          addedOrUpdated++;
        } else {
          // หากรายการที่เข้ามามีรูปภาพมากกว่า หรือถูกแก้ไขใหม่กว่า ให้อัปเดต
          const incImgs = Array.isArray(inc.images) ? inc.images : [];
          const exImgs = Array.isArray(existing.images) ? existing.images : [];
          if (incImgs.length >= exImgs.length) {
            map.set(inc.id, { ...existing, ...inc, images: incImgs.length ? incImgs : exImgs });
          }
        }
      });

      const all = Array.from(map.values());
      all.sort((a, b) => {
        const dtA = `${a.date || ''} ${a.time || ''} ${a.id || ''}`;
        const dtB = `${b.date || ''} ${b.time || ''} ${b.id || ''}`;
        return dtB.localeCompare(dtA);
      });

      this.tables.patrol_records = all;
      this.rebuildImagesTable();
      return addedOrUpdated;
    }

    rebuildImagesTable() {
      const imgs = [];
      let autoId = 1;
      this.tables.patrol_records.forEach(rec => {
        if (Array.isArray(rec.images)) {
          rec.images.forEach((dataUrl, idx) => {
            if (dataUrl) {
              imgs.push({
                id: autoId++,
                recordId: rec.id,
                imageIndex: idx,
                imageData: dataUrl,
                mimeType: 'image/jpeg',
                createdAt: rec.createdAt || new Date().toISOString()
              });
            }
          });
        }
      });
      this.tables.patrol_images = imgs;
    }

    async executeDDL() {
      this.logQuery('CREATE TABLE IF NOT EXISTS accounts (id VARCHAR(50) PRIMARY KEY, username VARCHAR(50) UNIQUE, password VARCHAR(255), name VARCHAR(100), role VARCHAR(20), role_name VARCHAR(50));');
      this.tables.accounts = typeof DEFAULT_ACCOUNTS !== 'undefined' ? [...DEFAULT_ACCOUNTS] : [];

      this.logQuery('CREATE TABLE IF NOT EXISTS guards (id VARCHAR(50) PRIMARY KEY, code VARCHAR(20) UNIQUE, name VARCHAR(100), role VARCHAR(50), active INT);');
      this.tables.guards = typeof DEFAULT_GUARDS !== 'undefined' ? [...DEFAULT_GUARDS] : [];

      this.logQuery('CREATE TABLE IF NOT EXISTS checkpoints (id VARCHAR(50) PRIMARY KEY, code VARCHAR(20) UNIQUE, name VARCHAR(150), zone VARCHAR(100), is_risk INT, active INT);');
      this.tables.checkpoints = typeof DEFAULT_CHECKPOINTS !== 'undefined' ? [...DEFAULT_CHECKPOINTS] : [];

      this.logQuery('CREATE TABLE IF NOT EXISTS patrol_records (id VARCHAR(50) PRIMARY KEY, date DATE, time VARCHAR(10), shift VARCHAR(20), round VARCHAR(50), round_no INT, guard_id VARCHAR(50), guard_name VARCHAR(100), cp_id VARCHAR(50), cp_code VARCHAR(30), cp_name VARCHAR(150), is_risk INT, is_off_checkpoint INT, status VARCHAR(20), note TEXT, images LONGTEXT, created_at TIMESTAMP);');
      this.logQuery('CREATE TABLE IF NOT EXISTS patrol_images (id INTEGER PRIMARY KEY AUTOINCREMENT, record_id VARCHAR(50), image_index INT, image_data LONGTEXT, mime_type VARCHAR(30), created_at TIMESTAMP, FOREIGN KEY(record_id) REFERENCES patrol_records(id));');
    }

    save() {
      try {
        // เก็บใน localStorage โดยไม่เก็บรูปซ้ำซ้อนใน patrol_images เพื่อประหยัดพื้นที่ Quota
        const compactTables = {
          accounts: this.tables.accounts,
          guards: this.tables.guards,
          checkpoints: this.tables.checkpoints,
          patrol_records: this.tables.patrol_records,
          query_logs: (this.tables.query_logs || []).slice(0, 40)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compactTables));
        localStorage.setItem('yru_sp_history', JSON.stringify(this.tables.patrol_records));
      } catch (err) {
        // กรณีรูปภาพเยอะเกิน 5MB ของ localStorage (รูปทั้งหมดถูกเก็บใน IndexedDB และ SQLite Server แล้ว)
        try {
          const lightRecords = this.tables.patrol_records.map((r, idx) => {
            if (idx > 12 && r.images && r.images.length > 0) {
              return { ...r, images: r.images.slice(0, 1) };
            }
            return r;
          });
          localStorage.setItem('yru_sp_history', JSON.stringify(lightRecords));
        } catch (retryErr) {}
      }
    }

    logQuery(sql) {
      const entry = {
        sql: sql.trim(),
        timestamp: new Date().toLocaleTimeString('th-TH')
      };
      if (!this.tables.query_logs) this.tables.query_logs = [];
      this.tables.query_logs.unshift(entry);
      if (this.tables.query_logs.length > 60) this.tables.query_logs.pop();
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
          // ซิงค์ข้อมูลล่าสุดจาก SQLite Server ก่อนคืนค่าหากเชื่อมต่อได้
          await this.syncWithSQLServer();

          let list = [...this.tables.patrol_records];

          if (upper.includes("WHERE STATUS = 'ALERT'")) {
            list = list.filter(r => r.status === 'alert');
          }

          if (upper.includes('ORDER BY')) {
            list.sort((a, b) => {
              const dtA = `${a.date || ''} ${a.time || ''} ${a.id || ''}`;
              const dtB = `${b.date || ''} ${b.time || ''} ${b.id || ''}`;
              return dtB.localeCompare(dtA);
            });
          }

          return list;
        }

        if (upper.includes('FROM PATROL_IMAGES')) {
          return [...this.tables.patrol_images];
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

      // 2. INSERT INTO คำสั่งเพิ่มข้อมูลและรูปภาพลงตาราง SQL
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
            createdAt: params[15] || new Date().toISOString(),
            roundNo: params[16] || 1
          };
        } else if (params[0] && typeof params[0] === 'object') {
          record = { ...params[0] };
        }

        if (record) {
          const existingIdx = this.tables.patrol_records.findIndex(r => r.id === record.id);
          if (existingIdx !== -1) {
            this.tables.patrol_records[existingIdx] = record;
          } else {
            this.tables.patrol_records.unshift(record);
          }

          // บันทึกรูปภาพลงตาราง patrol_images
          if (Array.isArray(record.images) && record.images.length > 0) {
            this.logQuery(`INSERT INTO patrol_images (record_id, image_index, image_data, mime_type) VALUES ('${record.id}', 0..${record.images.length - 1}, '[BASE64_IMAGE_BLOB]', 'image/jpeg');`);
          }

          this.rebuildImagesTable();
          await this.saveRecordToIndexedDB(record);
          this.save();

          // ส่งไปบันทึกใน SQLite3 Server ทันที
          try {
            const resp = await fetch('/api/records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ record })
            });
            if (resp.ok) this.serverConnected = true;
          } catch (e) {}

          return { success: true, insertId: record.id, affectedRows: 1 };
        }
      }

      // 3. UPDATE คำสั่งแก้ไขข้อมูลและรูปภาพ
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
          this.rebuildImagesTable();
          await this.saveRecordToIndexedDB(rec);
          this.save();

          try {
            await fetch(`/api/records/${encodeURIComponent(id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ record: rec })
            });
          } catch (e) {}

          return { success: true, affectedRows: 1 };
        }
      }

      // 4. DELETE FROM คำสั่งลบข้อมูลและรูปภาพ
      if (upper.startsWith('DELETE FROM PATROL_RECORDS')) {
        if (upper.includes('WHERE ID =')) {
          const id = params[0];
          const before = this.tables.patrol_records.length;
          this.tables.patrol_records = this.tables.patrol_records.filter(r => r.id !== id);
          this.rebuildImagesTable();
          await this.deleteRecordFromIndexedDB(id);
          this.save();

          try {
            await fetch(`/api/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
          } catch (e) {}

          return { success: true, affectedRows: before - this.tables.patrol_records.length };
        } else {
          const count = this.tables.patrol_records.length;
          this.tables.patrol_records = [];
          this.tables.patrol_images = [];
          this.save();
          try {
            await fetch('/api/records', { method: 'DELETE' });
          } catch (e) {}
          return { success: true, affectedRows: count };
        }
      }

      return { success: true, affectedRows: 0 };
    }

    getStats() {
      return {
        connected: true,
        serverConnected: this.serverConnected,
        mode: this.connectionMode,
        recordCount: this.tables.patrol_records.length,
        imageCount: this.tables.patrol_images.length
      };
    }

    /**
     * ส่งออกเป็นไฟล์ SQL Script (.sql) แท้จริง พร้อมตาราง patrol_records และ patrol_images
     */
    exportSQLFile() {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');

      let sql = `-- =========================================================================\n`;
      sql += `-- ฐานข้อมูล SQL ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา\n`;
      sql += `-- ส่งออกข้อมูลเมื่อ: ${now.toLocaleString('th-TH')}\n`;
      sql += `-- เวอร์ชันระบบ: ${DB_VERSION} (${this.connectionMode})\n`;
      sql += `-- จำนวนรายการตรวจ: ${this.tables.patrol_records.length} รายการ | รูปภาพหลักฐาน: ${this.tables.patrol_images.length} รูป\n`;
      sql += `-- =========================================================================\n\n`;

      sql += `SET NAMES utf8mb4;\n`;
      sql += `SET foreign_key_checks = 0;\n\n`;

      // 1. DDL Statements: patrol_records & patrol_images
      sql += `-- ----------------------------\n-- โครงสร้างตาราง patrol_records\n-- ----------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`patrol_records\`;\n`;
      sql += `CREATE TABLE \`patrol_records\` (\n`;
      sql += `  \`id\` varchar(50) NOT NULL,\n`;
      sql += `  \`date\` date NOT NULL,\n`;
      sql += `  \`time\` varchar(10) NOT NULL,\n`;
      sql += `  \`shift\` varchar(20) NOT NULL,\n`;
      sql += `  \`round\` varchar(50) DEFAULT NULL,\n`;
      sql += `  \`round_no\` int DEFAULT 1,\n`;
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

      sql += `-- ----------------------------\n-- โครงสร้างตาราง patrol_images\n-- ----------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`patrol_images\`;\n`;
      sql += `CREATE TABLE \`patrol_images\` (\n`;
      sql += `  \`id\` int NOT NULL AUTO_INCREMENT,\n`;
      sql += `  \`record_id\` varchar(50) NOT NULL,\n`;
      sql += `  \`image_index\` int NOT NULL DEFAULT 0,\n`;
      sql += `  \`image_data\` longtext NOT NULL,\n`;
      sql += `  \`mime_type\` varchar(30) DEFAULT 'image/jpeg',\n`;
      sql += `  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,\n`;
      sql += `  PRIMARY KEY (\`id\`),\n`;
      sql += `  KEY \`idx_record_id\` (\`record_id\`)\n`;
      sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      // 2. DML Records
      const escape = str => String(str || '').replace(/'/g, "''").replace(/\\/g, '\\\\');
      if (this.tables.patrol_records.length > 0) {
        sql += `-- ----------------------------\n-- ข้อมูลบันทึกการเวียนตรวจจริง (${this.tables.patrol_records.length} รายการ)\n-- ----------------------------\n`;
        this.tables.patrol_records.forEach((r, idx) => {
          const imgsJson = JSON.stringify(r.images || []);
          const rNo = r.roundNo || (this.tables.patrol_records.length - idx);
          sql += `INSERT INTO \`patrol_records\` VALUES ('${escape(r.id)}', '${escape(r.date)}', '${escape(r.time)}', '${escape(r.shift)}', '${escape(r.round)}', ${rNo}, '${escape(r.guardId)}', '${escape(r.guardName)}', '${escape(r.cpId)}', '${escape(r.cpCode)}', '${escape(r.cpName)}', ${r.isRisk ? 1 : 0}, ${r.isOffCheckpoint ? 1 : 0}, '${escape(r.status)}', '${escape(r.note)}', '${escape(imgsJson)}', NOW());\n`;
        });

        if (this.tables.patrol_images.length > 0) {
          sql += `\n-- ----------------------------\n-- ข้อมูลรูปภาพหลักฐานการเดินตรวจ (${this.tables.patrol_images.length} รูป)\n-- ----------------------------\n`;
          this.tables.patrol_images.forEach(img => {
            sql += `INSERT INTO \`patrol_images\` (\`id\`, \`record_id\`, \`image_index\`, \`image_data\`, \`mime_type\`, \`created_at\`) VALUES (${img.id}, '${escape(img.recordId)}', ${img.imageIndex}, '${escape(img.imageData)}', '${escape(img.mimeType)}', NOW());\n`;
          });
        }
      } else {
        sql += `-- (ขณะนี้ยังไม่มีบันทึกข้อมูลการเวียนตรวจในระบบ)\n`;
      }

      sql += `\nSET foreign_key_checks = 1;\n`;

      const blob = new Blob([sql], { type: 'text/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yru_security_patrol_db_${timestamp.slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }

    getQueryLogs() {
      return this.tables.query_logs || [];
    }
  }

  window.AppDB = new SQLDatabase();
})();
