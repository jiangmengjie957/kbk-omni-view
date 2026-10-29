// 基础数据模块：校区 / 员工 / 学员 的类型与常量定义

export type Gender = 1 | 2; // 1 男 2 女

// ── 校区 ──────────────────────────────────────────────
export interface Campus {
  id: number;
  name: string; // 名称（必填）
  address: string; // 地址
  phone: string; // 联系电话
  status: 1 | 0; // 1 启用 0 停用
  remark: string; // 备注
  createdAt: string;
}

// ── 员工 ──────────────────────────────────────────────
export interface Employee {
  id: number;
  employeeNo: string; // 工号（必填）
  name: string; // 姓名（必填）
  gender: Gender; // 性别（必填）
  position: string; // 岗位（必填）
  campusId: number | null; // 所属校区
  phone: string; // 联系电话
  hireDate: string; // 入职日期
  status: 1 | 0; // 1 在职 0 离职
  remark: string; // 备注
  createdAt: string;
}

// ── 学员 ──────────────────────────────────────────────
export interface Student {
  id: number;
  name: string; // 姓名（必填）
  gender: Gender; // 性别（必填）
  grade: string; // 年级（必填）
  campusId: number | null; // 所属校区
  phone: string; // 联系电话
  parentPhone: string; // 家长电话
  school: string; // 就读学校
  birthday: string; // 出生日期
  status: 1 | 0 | 2; // 1 在读 0 停课 2 结业
  remark: string; // 备注
  createdAt: string;
}

// ── 常量（前端写死）────────────────────────────────────

export const GENDER_OPTIONS = [
  { value: 1, label: '男' },
  { value: 2, label: '女' },
] as const;

// 员工岗位列表（与后端 employee.job_type 枚举一一对应）
export const POSITIONS = [
  '班主任',
  '教师',
  '教务',
  '校长',
  '管理员',
  '其他',
];

// 学员年级列表
export const GRADES = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '初一',
  '初二',
  '初三',
  '高一',
  '高二',
  '高三',
];

export const CAMPUS_STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
] as const;

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 1, label: '在职' },
  { value: 0, label: '离职' },
] as const;

export const STUDENT_STATUS_OPTIONS = [
  { value: 1, label: '在读' },
  { value: 0, label: '停课' },
  { value: 2, label: '结业' },
] as const;
