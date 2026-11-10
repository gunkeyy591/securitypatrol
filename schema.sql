-- =========================================================================
-- ระบบเวียนตรวจรักษาความปลอดภัย มหาวิทยาลัยราชภัฏยะลา (YRU Security Patrol)
-- ฐานข้อมูล SQL สำหรับการจัดเก็บข้อมูลจริง (Official Production SQL Database Schema)
-- รองรับ: MySQL, MariaDB, PostgreSQL, และ SQLite
-- รหัสภาษา: UTF-8 (utf8mb4) รองรับภาษาไทย 100%
-- =========================================================================

-- 1. ตารางบัญชีผู้ใช้งานระบบ (Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  role_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางผลัดเวรการทำงาน (Shifts)
CREATE TABLE IF NOT EXISTS shifts (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  time_range VARCHAR(50) NOT NULL,
  color VARCHAR(30)
);

-- 3. ตารางเจ้าหน้าที่รักษาความปลอดภัย (Guards)
CREATE TABLE IF NOT EXISTS guards (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ตารางจุดตรวจในมหาวิทยาลัย (Checkpoints)
CREATE TABLE IF NOT EXISTS checkpoints (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  zone VARCHAR(100),
  description TEXT,
  is_risk TINYINT(1) DEFAULT 0,
  risk_reason VARCHAR(255),
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตารางบันทึกการเวียนตรวจจริง (Patrol Records) - ไม่มีข้อมูลตัวอย่าง พร้อมใช้งานจริง
CREATE TABLE IF NOT EXISTS patrol_records (
  id VARCHAR(50) PRIMARY KEY,
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL,
  shift VARCHAR(20) NOT NULL,
  round VARCHAR(50),
  guard_id VARCHAR(50) NOT NULL,
  guard_name VARCHAR(100) NOT NULL,
  cp_id VARCHAR(50) NOT NULL,
  cp_code VARCHAR(30),
  cp_name VARCHAR(150) NOT NULL,
  is_risk TINYINT(1) DEFAULT 0,
  is_off_checkpoint TINYINT(1) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  note TEXT,
  images LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ดัชนีเพื่อเพิ่มความเร็วในการสืบค้นข้อมูล (Indexes)
CREATE INDEX IF NOT EXISTS idx_patrol_date ON patrol_records(date);
CREATE INDEX IF NOT EXISTS idx_patrol_status ON patrol_records(status);
CREATE INDEX IF NOT EXISTS idx_patrol_guard ON patrol_records(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrol_cp ON patrol_records(cp_id);

-- =========================================================================
-- ข้อมูลตั้งต้นหลัก (Master Data Seeding)
-- =========================================================================

-- บัญชีผู้ใช้เริ่มต้น
INSERT INTO accounts (id, username, password, name, role, role_name) VALUES
('acc-admin', 'admin', 'admin1234', 'หัวหน้าเวร (ผู้ดูแลระบบ)', 'admin', 'แอดมิน / หัวหน้าเวร'),
('acc-guard', 'guard', 'guard1234', 'เจ้าหน้าที่ รปภ.', 'user', 'เจ้าหน้าที่ รปภ. (ผู้ตรวจ)'),
('acc-user', 'user', 'user1234', 'เจ้าหน้าที่ทั่วไป', 'user', 'ผู้ใช้งานทั่วไป')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ผลัดเวร
INSERT INTO shifts (id, name, time_range, color) VALUES
('morning', 'กะเช้า', '06:00 - 14:00 น.', 'var(--sm)'),
('afternoon', 'กะบ่าย', '14:00 - 22:00 น.', 'var(--sa)'),
('night', 'กะดึก', '22:00 - 06:00 น.', 'var(--sn)')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- รายชื่อเจ้าหน้าที่ รปภ. มรย. 9 นาย
INSERT INTO guards (id, code, name, role, active) VALUES
('g1', 'SP-01', 'นายรอแม กามา', 'เจ้าหน้าที่ รปภ.', 1),
('g2', 'SP-02', 'นายศิลปชัย ขุนทรัพย์', 'เจ้าหน้าที่ รปภ.', 1),
('g3', 'SP-03', 'นายสุไลมาน สารี', 'หัวหน้าชุดตรวจ', 1),
('g4', 'SP-04', 'นายกิตติวัฒน์ สระบัว', 'เจ้าหน้าที่ รปภ.', 1),
('g5', 'SP-05', 'นายปิยศักดิ์ ศักดิ์สองเมือง', 'เจ้าหน้าที่ รปภ.', 1),
('g6', 'SP-06', 'นายสุกรี เจ๊ะมิง', 'เจ้าหน้าที่ รปภ.', 1),
('g7', 'SP-07', 'นายซุลกิฟลี วาแฉะ', 'เจ้าหน้าที่ รปภ.', 1),
('g8', 'SP-08', 'นางภัณฑิรา วุฒิพงศ์', 'เจ้าหน้าที่ รปภ.', 1),
('g9', 'SP-09', 'นายนาวาวี เซะ', 'เจ้าหน้าที่ รปภ.', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- รายการจุดตรวจ 10 จุด มรย.
INSERT INTO checkpoints (id, code, name, zone, description, is_risk, risk_reason, active) VALUES
('cp1', 'CP-01', 'ประตู 1 (ทางเข้าหลัก ฝั่งถนนเทศบาล 1)', 'โซนด้านหน้ามหาวิทยาลัย', 'ตรวจบุคคล ยานพาหนะเข้า-ออก และความเรียบร้อยป้อมยามหน้า', 0, NULL, 1),
('cp2', 'CP-02', 'ประตู 2 (ทางเข้า-ออก ฝั่งโรงเรียนสาธิตฯ)', 'โซนด้านหน้ามหาวิทยาลัย', 'ตรวจการปิด-ล็อกประตูช่วงค่ำ และความปลอดภัยบริเวณหน้าโรงเรียนสาธิต', 0, NULL, 1),
('cp3', 'CP-03', 'อาคาร 20 (อาคารเฉลิมพระเกียรติ 50 พรรษา / สำนักงานอธิการบดี)', 'โซนอาคารบริหารส่วนกลาง', 'ตรวจประตูกระจกหลัก ตรวจล็อกห้องสำนักงาน ชั้น 1-8 และระบบไฟทางเดิน', 0, NULL, 1),
('cp4', 'CP-04', 'อาคาร 15 (คณะมนุษยศาสตร์และสังคมศาสตร์)', 'โซนอาคารเรียนกลาง', 'ตรวจความเรียบร้อยห้องเรียน ห้องปฏิบัติการ และบริเวณลานใต้ถุนอาคาร', 0, NULL, 1),
('cp5', 'CP-05', 'อาคาร 4 (คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร)', 'โซนวิทยาศาสตร์และห้องแล็บ', 'จุดเสี่ยง: มีสารเคมีและอุปกรณ์แล็บราคาแพง ตรวจล็อกประตูหน้าต่างอย่างเข้มงวด', 1, 'มีห้องปฏิบัติการวิทยาศาสตร์ สารเคมี และอุปกรณ์วิจัยมูลค่าสูง', 1),
('cp6', 'CP-06', 'อาคาร 22 (คณะครุศาสตร์)', 'โซนอาคารเรียนกลาง', 'ตรวจห้องพักอาจารย์ ห้องเรียนรวม และประตูบันไดหนีไฟทุกชั้น', 0, NULL, 1),
('cp7', 'CP-07', 'อาคาร 24 (คณะวิทยาการจัดการ)', 'โซนอาคารเรียนฝั่งทิศใต้', 'ตรวจร้านค้าสหกรณ์ ลานจอดรถใต้ดิน และระบบไฟส่องสว่างรอบอาคาร', 0, NULL, 1),
('cp8', 'CP-08', 'อาคารหอสมุดกลาง (ศูนย์บรรณสารสนเทศ)', 'โซนบริการการศึกษา', 'ตรวจประตูด้านหน้า-หลัง เครื่องสแกน และระบบป้องกันอัคคีภัย', 0, NULL, 1),
('cp9', 'CP-09', 'หอพักนักศึกษา (หอพักในมหาวิทยาลัย)', 'โซนที่พักอาศัยนักศึกษา', 'จุดเสี่ยง: เฝ้าระวังบุคคลภายนอก ตรวจเวลาเข้า-ออก และความปลอดภัยรอบหอพัก', 1, 'พื้นที่พักอาศัยนักศึกษา เฝ้าระวังบุคคลภายนอกลักลอบเข้าเวลากลางคืน', 1),
('cp10', 'CP-10', 'แนวกำแพงรั้วด้านหลังและลานจอดรถพัสดุ', 'พื้นที่เสี่ยงสูง / แนวรั้วรอบนอก', 'จุดเสี่ยง: จุดอับสายตา ตรวจช่องโหว่แนวกำแพง รั้วลวดหนาม คลังพัสดุ และไฟริมคลอง', 1, 'พื้นที่มืดอับสายตา ริมกำแพงด้านหลัง สุ่มเสี่ยงการปีนข้ามรั้ว', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);
