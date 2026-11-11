/**
 * data.js - ข้อมูลเริ่มต้นระบบเวียนตรวจ รปภ. มหาวิทยาลัยราชภัฏยะลา (มรย.)
 * อัปเดตรายชื่อ รปภ. 9 นาย + เพิ่มพื้นที่เสี่ยง + เพิ่มประเภทเหตุนอกจุดตรวจ
 */

const DATA_VERSION = '3.0';

// บัญชีผู้ใช้งานระบบ (สิทธิ์ Admin และ User ธรรมดา)
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc-admin',
    username: 'admin',
    password: 'admin1234',
    name: 'ผู้ดูแลระบบ',
    role: 'admin', // แอดมิน: ดูรายงาน, แก้ไข, ตรวจสอบ, ลบข้อมูลได้
    roleName: 'ผู้ดูแลระบบ'
  },
  {
    id: 'acc-guard',
    username: 'guard',
    password: 'guard1234',
    name: 'เจ้าหน้าที่ รปภ.',
    role: 'user', // user ธรรมดา: เพิ่มรายงานได้อย่างเดียว ไม่สามารถแก้ไขอะไรได้
    roleName: 'เจ้าหน้าที่ รปภ. (ผู้ตรวจ)'
  },
  {
    id: 'acc-user',
    username: 'user',
    password: 'user1234',
    name: 'เจ้าหน้าที่ทั่วไป',
    role: 'user', // user ธรรมดา
    roleName: 'ผู้ใช้งานทั่วไป'
  }
];

const DEFAULT_SHIFTS = [
  { id: 'morning', name: 'กะเช้า', time: '07:00 - 15:00', color: 'var(--sm)' },
  { id: 'afternoon', name: 'กะบ่าย', time: '15:00 - 23:00', color: 'var(--sa)' },
  { id: 'night', name: 'กะดึก', time: '23:00 - 07:00', color: 'var(--sn)' }
];

// รายชื่อเจ้าหน้าที่ รปภ. มรย. 9 นาย
const DEFAULT_GUARDS = [
  { id: 'g1', name: 'นายรอแม กามา', code: 'SP-01', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g2', name: 'นายศิลปชัย ขุนทรัพย์', code: 'SP-02', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g3', name: 'นายสุไลมาน สารี', code: 'SP-03', role: 'หัวหน้าชุดตรวจ' },
  { id: 'g4', name: 'นายกิตติวัฒน์ สระบัว', code: 'SP-04', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g5', name: 'นายปิยศักดิ์ ศักดิ์สองเมือง', code: 'SP-05', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g6', name: 'นายสุกรี เจ๊ะมิง', code: 'SP-06', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g7', name: 'นายซุลกิฟลี วาแฉะ', code: 'SP-07', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g8', name: 'นางภัณฑิรา วุฒิพงศ์', code: 'SP-08', role: 'เจ้าหน้าที่ รปภ.' },
  { id: 'g9', name: 'นายนาวาวี เซะ', code: 'SP-09', role: 'เจ้าหน้าที่ รปภ.' }
];

// รายการจุดตรวจ พร้อมระบุ "พื้นที่เสี่ยง" (isRisk: true)
const DEFAULT_CHECKPOINTS = [
  {
    id: 'cp1',
    code: 'CP-01',
    name: 'ประตู 1 (ทางเข้าหลัก ฝั่งถนนเทศบาล 1)',
    zone: 'พื้นที่รอบนอก / ทางเข้า',
    desc: 'ตรวจป้อมยาม ตรวจไม้กั้นอัตโนมัติ และไฟส่องสว่างหน้าป้ายมหาวิทยาลัย',
    isRisk: false,
    active: true
  },
  {
    id: 'cp2',
    code: 'CP-02',
    name: 'อาคาร 1 (อาคารเฉลิมพระเกียรติ 50 พรรษา มหาวชิราลงกรณ)',
    zone: 'อาคารเรียนรวม',
    desc: 'ตรวจประตูกระจกชั้น 1 แผงควบคุมไฟ ลิฟต์โดยสาร และทางหนีไฟ',
    isRisk: false,
    active: true
  },
  {
    id: 'cp3',
    code: 'CP-03',
    name: 'อาคาร 2 (คณะครุศาสตร์)',
    zone: 'อาคารคณะ',
    desc: 'ตรวจห้องพักอาจารย์ ห้องเรียนชั้นล่าง ทางเชื่อมอาคาร และกุญแจห้องประชุม',
    isRisk: false,
    active: true
  },
  {
    id: 'cp4',
    code: 'CP-04',
    name: 'อาคาร 3 (คณะมนุษยศาสตร์และสังคมศาสตร์)',
    zone: 'อาคารคณะ',
    desc: 'ตรวจระเบียงทางเดิน บันไดหนีไฟ และจุดรวมตู้ดับเพลิง',
    isRisk: false,
    active: true
  },
  {
    id: 'cp5',
    code: 'CP-05',
    name: 'อาคาร 4 (คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร)',
    zone: 'ห้องปฏิบัติการ / สารเคมี',
    desc: 'ตรวจห้องแล็บเคมี ระบบวาล์วน้ำ และการล็อกประตูหลังอาคาร',
    isRisk: true,
    riskReason: 'มีสารเคมีและห้องปฏิบัติการวิจัยสำคัญ ต้องล็อกประตูหนาแน่น',
    active: true
  },
  {
    id: 'cp6',
    code: 'CP-06',
    name: 'อาคารคณะวิทยาการจัดการ',
    zone: 'อาคารคณะ',
    desc: 'ตรวจโถงกลาง จุดบริการนักศึกษา และจุดจอดรถจักรยานยนต์',
    isRisk: false,
    active: true
  },
  {
    id: 'cp7',
    code: 'CP-07',
    name: 'ศูนย์บรรณสารสนเทศ (หอสมุดกลาง มรย.)',
    zone: 'วิทยบริการ',
    desc: 'ตรวจประตูล็อคอิเล็กทรอนิกส์ ทางหนีไฟฉุกเฉิน และเครื่องปรับอากาศส่วนกลาง',
    isRisk: false,
    active: true
  },
  {
    id: 'cp8',
    code: 'CP-08',
    name: 'หอพักนักศึกษาและลานกิจกรรม',
    zone: 'พื้นที่พักอาศัย / จุดเสี่ยงบุคคลภายนอก',
    desc: 'ตรวจความเรียบร้อยรอบรั้วกั้น บุคคลภายนอก และไฟทางเดินช่วงดึก',
    isRisk: true,
    riskReason: 'จุดเฝ้าระวังบุคคลภายนอกลักลอบเข้าเขตหอพักยามวิกาล',
    active: true
  },
  {
    id: 'cp9',
    code: 'CP-09',
    name: 'โรงยิมเนเซียมและสนามกีฬา มรย.',
    zone: 'พื้นที่กีฬาและสันทนาการ',
    desc: 'ตรวจประตูกรงเหล็ก ไฟสปอร์ตไลท์สนาม และห้องเก็บอุปกรณ์กีฬา',
    isRisk: false,
    active: true
  },
  {
    id: 'cp10',
    code: 'CP-10',
    name: 'แนวกำแพงรั้วด้านหลังและลานจอดรถพัสดุ',
    zone: 'พื้นที่เสี่ยงสูง / แนวรั้วรอบนอก',
    desc: 'จุดอับสายตา ตรวจช่องโหว่แนวกำแพง รั้วลวดหนาม คลังพัสดุ และไฟส่องสว่างริมคลอง',
    isRisk: true,
    riskReason: 'พื้นที่มืดอับสายตา ริมกำแพงด้านหลัง สุ่มเสี่ยงการปีนข้ามรั้ว',
    active: true
  }
];

// บันทึกประวัติเริ่มต้น (ค่าเริ่มต้นว่างเปล่าสำหรับฐานข้อมูลจริง)
const DEFAULT_HISTORY = [];

// แนบตัวแปรเข้า window เพื่อให้เข้าถึงได้ 100% ในทุกสคริปต์
if (typeof window !== 'undefined') {
  window.DATA_VERSION = DATA_VERSION;
  window.DEFAULT_ACCOUNTS = DEFAULT_ACCOUNTS;
  window.DEFAULT_SHIFTS = DEFAULT_SHIFTS;
  window.DEFAULT_GUARDS = DEFAULT_GUARDS;
  window.DEFAULT_CHECKPOINTS = DEFAULT_CHECKPOINTS;
  window.DEFAULT_HISTORY = DEFAULT_HISTORY;
}

