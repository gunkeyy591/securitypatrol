#!/usr/bin/env python3
"""
server.py - ระบบเซิร์ฟเวอร์และฐานข้อมูล SQL (SQLite3 Relational Database Engine)
ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา (YRU Security Patrol)
จัดเก็บข้อมูลการเดินตรวจ (patrol_records) และรูปภาพหลักฐาน (patrol_images) ลงในฐานข้อมูล SQL จริง
"""

import json
import os
import sqlite3
import urllib.parse
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "yru_security_patrol.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def log_sql_query(conn, sql_text):
    try:
        now_str = datetime.now().strftime("%H:%M:%S")
        conn.execute(
            "INSERT INTO sql_query_logs (sql_text, executed_at) VALUES (?, ?)",
            (sql_text.strip(), now_str),
        )
        conn.execute(
            "DELETE FROM sql_query_logs WHERE id NOT IN (SELECT id FROM sql_query_logs ORDER BY id DESC LIMIT 100)"
        )
    except Exception:
        pass


def init_database():
    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
              id VARCHAR(50) PRIMARY KEY,
              username VARCHAR(50) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              name VARCHAR(100) NOT NULL,
              role VARCHAR(20) NOT NULL DEFAULT 'user',
              role_name VARCHAR(50) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guards (
              id VARCHAR(50) PRIMARY KEY,
              code VARCHAR(20) NOT NULL UNIQUE,
              name VARCHAR(100) NOT NULL,
              role VARCHAR(50) NOT NULL,
              active INT DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checkpoints (
              id VARCHAR(50) PRIMARY KEY,
              code VARCHAR(20) NOT NULL UNIQUE,
              name VARCHAR(150) NOT NULL,
              zone VARCHAR(100),
              description TEXT,
              is_risk INT DEFAULT 0,
              risk_reason VARCHAR(255),
              active INT DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patrol_records (
              id VARCHAR(50) PRIMARY KEY,
              date DATE NOT NULL,
              time VARCHAR(10) NOT NULL,
              shift VARCHAR(20) NOT NULL,
              round VARCHAR(50),
              round_no INT DEFAULT 1,
              guard_id VARCHAR(50) NOT NULL,
              guard_name VARCHAR(100) NOT NULL,
              cp_id VARCHAR(50) NOT NULL,
              cp_code VARCHAR(30),
              cp_name VARCHAR(150) NOT NULL,
              is_risk INT DEFAULT 0,
              is_off_checkpoint INT DEFAULT 0,
              status VARCHAR(20) NOT NULL DEFAULT 'ok',
              note TEXT,
              images LONGTEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patrol_images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              record_id VARCHAR(50) NOT NULL,
              image_index INT NOT NULL DEFAULT 0,
              image_data LONGTEXT NOT NULL,
              mime_type VARCHAR(30) DEFAULT 'image/jpeg',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (record_id) REFERENCES patrol_records(id) ON DELETE CASCADE
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sql_query_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sql_text TEXT NOT NULL,
              executed_at VARCHAR(20) NOT NULL
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patrol_date ON patrol_records(date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patrol_status ON patrol_records(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_patrol_images_rec ON patrol_images(record_id);")

        # Seed default accounts if empty
        cur = conn.execute("SELECT COUNT(*) AS cnt FROM accounts")
        if cur.fetchone()["cnt"] == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO accounts (id, username, password, name, role, role_name) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    ("acc-admin", "admin", "admin1234", "ผู้ดูแลระบบ", "admin", "ผู้ดูแลระบบ"),
                    ("acc-guard", "guard", "guard1234", "เจ้าหน้าที่ รปภ.", "user", "เจ้าหน้าที่ รปภ. (ผู้ตรวจ)"),
                    ("acc-user", "user", "user1234", "เจ้าหน้าที่ทั่วไป", "user", "ผู้ใช้งานทั่วไป"),
                ],
            )

        log_sql_query(
            conn,
            "DATABASE INITIALIZED: Connected to SQLite3 (yru_security_patrol.db) with tables patrol_records & patrol_images",
        )
    conn.close()


def fetch_all_records():
    conn = get_db_connection()
    with conn:
        log_sql_query(
            conn,
            "SELECT r.*, COUNT(i.id) AS img_count FROM patrol_records r LEFT JOIN patrol_images i ON r.id = i.record_id GROUP BY r.id ORDER BY r.date DESC, r.time DESC, r.created_at DESC;",
        )
        rows = conn.execute(
            "SELECT * FROM patrol_records ORDER BY date DESC, time DESC, created_at DESC"
        ).fetchall()

        results = []
        for row in rows:
            rec_id = row["id"]
            img_rows = conn.execute(
                "SELECT image_data FROM patrol_images WHERE record_id = ? ORDER BY image_index ASC",
                (rec_id,),
            ).fetchall()

            images = [ir["image_data"] for ir in img_rows if ir["image_data"]]
            if not images and row["images"]:
                try:
                    parsed_imgs = json.loads(row["images"])
                    if isinstance(parsed_imgs, list):
                        images = parsed_imgs
                except Exception:
                    images = []

            results.append(
                {
                    "id": row["id"],
                    "date": row["date"],
                    "time": row["time"],
                    "shift": row["shift"],
                    "round": row["round"] or "",
                    "roundNo": row["round_no"] or 1,
                    "guardId": row["guard_id"],
                    "guardName": row["guard_name"],
                    "cpId": row["cp_id"],
                    "cpCode": row["cp_code"] or "CP-YRU",
                    "cpName": row["cp_name"],
                    "isRisk": bool(row["is_risk"]),
                    "isOffCheckpoint": bool(row["is_off_checkpoint"]),
                    "status": row["status"],
                    "note": row["note"] or "",
                    "images": images,
                    "createdAt": row["created_at"],
                }
            )
    conn.close()
    return results


def upsert_record(record):
    if not record or not record.get("id"):
        return False

    conn = get_db_connection()
    with conn:
        rec_id = str(record.get("id"))
        date_val = str(record.get("date") or datetime.now().strftime("%Y-%m-%d"))
        time_val = str(record.get("time") or datetime.now().strftime("%H:%M"))
        shift_val = str(record.get("shift") or "morning")
        round_val = str(record.get("round") or "")
        round_no = int(record.get("roundNo") or 1)
        guard_id = str(record.get("guardId") or "g1")
        guard_name = str(record.get("guardName") or "เจ้าหน้าที่ รปภ.")
        cp_id = str(record.get("cpId") or "cp-yru")
        cp_code = str(record.get("cpCode") or "CP-YRU")
        cp_name = str(record.get("cpName") or "")
        is_risk = 1 if record.get("isRisk") else 0
        is_off = 1 if record.get("isOffCheckpoint") else 0
        status_val = str(record.get("status") or "ok")
        note_val = str(record.get("note") or "")
        images_list = record.get("images") if isinstance(record.get("images"), list) else []
        created_at = str(record.get("createdAt") or datetime.now().isoformat())

        conn.execute(
            """
            INSERT INTO patrol_records (
              id, date, time, shift, round, round_no, guard_id, guard_name,
              cp_id, cp_code, cp_name, is_risk, is_off_checkpoint, status, note, images, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              date = excluded.date,
              time = excluded.time,
              shift = excluded.shift,
              round = excluded.round,
              round_no = excluded.round_no,
              guard_name = excluded.guard_name,
              cp_name = excluded.cp_name,
              is_risk = excluded.is_risk,
              is_off_checkpoint = excluded.is_off_checkpoint,
              status = excluded.status,
              note = excluded.note,
              images = excluded.images
            """,
            (
                rec_id,
                date_val,
                time_val,
                shift_val,
                round_val,
                round_no,
                guard_id,
                guard_name,
                cp_id,
                cp_code,
                cp_name,
                is_risk,
                is_off,
                status_val,
                note_val,
                json.dumps(images_list, ensure_ascii=False),
                created_at,
            ),
        )

        # Sync patrol_images table
        conn.execute("DELETE FROM patrol_images WHERE record_id = ?", (rec_id,))
        for idx, img_data in enumerate(images_list):
            if img_data:
                conn.execute(
                    "INSERT INTO patrol_images (record_id, image_index, image_data, mime_type) VALUES (?, ?, ?, ?)",
                    (rec_id, idx, img_data, "image/jpeg"),
                )

        log_sql_query(
            conn,
            f"INSERT INTO patrol_records (id='{rec_id}', cp_name='{cp_name}', guard_name='{guard_name}', status='{status_val}') + {len(images_list)} images INTO patrol_images;",
        )
    conn.close()
    return True


def delete_record_by_id(rec_id):
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM patrol_images WHERE record_id = ?", (rec_id,))
        cur = conn.execute("DELETE FROM patrol_records WHERE id = ?", (rec_id,))
        log_sql_query(
            conn,
            f"DELETE FROM patrol_records WHERE id = '{rec_id}'; DELETE FROM patrol_images WHERE record_id = '{rec_id}';",
        )
        affected = cur.rowcount
    conn.close()
    return affected


class SecurityPatrolRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/db/status":
            conn = get_db_connection()
            rec_count = conn.execute("SELECT COUNT(*) AS cnt FROM patrol_records").fetchone()["cnt"]
            img_count = conn.execute("SELECT COUNT(*) AS cnt FROM patrol_images").fetchone()["cnt"]
            conn.close()
            return self.send_json(
                {
                    "ok": True,
                    "connected": True,
                    "engine": "SQLite3 Relational Database (yru_security_patrol.db)",
                    "recordCount": rec_count,
                    "imageCount": img_count,
                }
            )

        if path == "/api/records":
            records = fetch_all_records()
            return self.send_json({"ok": True, "records": records, "count": len(records)})

        if path == "/api/sql-logs":
            conn = get_db_connection()
            rows = conn.execute(
                "SELECT sql_text AS sql, executed_at AS timestamp FROM sql_query_logs ORDER BY id DESC LIMIT 60"
            ).fetchall()
            conn.close()
            return self.send_json({"ok": True, "logs": [dict(r) for r in rows]})

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(body_raw)
        except Exception:
            payload = {}

        if path == "/api/records":
            if isinstance(payload.get("records"), list):
                for rec in payload["records"]:
                    upsert_record(rec)
                records = fetch_all_records()
                return self.send_json({"ok": True, "records": records, "count": len(records)})
            elif payload.get("record"):
                upsert_record(payload["record"])
                return self.send_json({"ok": True, "id": payload["record"].get("id")})
            elif payload.get("id"):
                upsert_record(payload)
                return self.send_json({"ok": True, "id": payload.get("id")})
            return self.send_json({"ok": False, "error": "Invalid record payload"}, 400)

        return self.send_json({"ok": False, "error": "Not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/records/"):
            length = int(self.headers.get("Content-Length", 0))
            body_raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                payload = json.loads(body_raw)
            except Exception:
                payload = {}
            rec = payload.get("record") or payload
            upsert_record(rec)
            return self.send_json({"ok": True, "id": rec.get("id")})

        return self.send_json({"ok": False, "error": "Not found"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/records/"):
            rec_id = urllib.parse.unquote(path.split("/api/records/", 1)[1])
            affected = delete_record_by_id(rec_id)
            return self.send_json({"ok": True, "deleted": affected, "id": rec_id})

        if path == "/api/records":
            conn = get_db_connection()
            with conn:
                conn.execute("DELETE FROM patrol_images")
                conn.execute("DELETE FROM patrol_records")
                log_sql_query(conn, "TRUNCATE TABLE patrol_records; TRUNCATE TABLE patrol_images;")
            conn.close()
            return self.send_json({"ok": True})

        return self.send_json({"ok": False, "error": "Not found"}, 404)


if __name__ == "__main__":
    init_database()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), SecurityPatrolRequestHandler)
    print(f"YRU Security Patrol SQL Server running at http://localhost:{port}")
    print(f"SQLite3 Database connected at: {DB_PATH}")
    server.serve_forever()
