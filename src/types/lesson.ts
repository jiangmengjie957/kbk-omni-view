// 排课系统类型定义（与后端 lesson 模块对应）

// 学生上课状态：1正常 2请假 3缺席 4试听
export type StudentLessonStatus = 1 | 2 | 3 | 4;

export const STUDENT_LESSON_STATUS_LABEL: Record<StudentLessonStatus, string> = {
  1: '正常',
  2: '请假',
  3: '缺席',
  4: '试听',
};

export const STUDENT_LESSON_STATUS_OPTIONS = (
  [1, 2, 3, 4] as StudentLessonStatus[]
).map((s) => ({ value: s, label: STUDENT_LESSON_STATUS_LABEL[s] }));

// 课程状态：1正常 2待审批 3已取消
export type LessonStatus = 1 | 2 | 3;

// 一节课里的一个学生及其上课状态
export interface LessonStudent {
  studentId: number;
  status: StudentLessonStatus;
}

// 课程主记录（后端返回）
export interface Lesson {
  id: number;
  campusId: number;
  teacherId: number;
  classroomId: number | null;
  lessonDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timeRange: string; // HH:mm-HH:mm（后端拼好）
  grade: string;
  note: string;
  status: LessonStatus;
  students: LessonStudent[];
  createdAt: string | null;
}

// 新增/更新入参
export interface LessonInput {
  campusId?: number;
  teacherId: number;
  classroomId: number | null;
  lessonDate: string;
  startTime: string;
  endTime: string;
  grade: string;
  note?: string;
  students: LessonStudent[];
}

// 调课类型：1调整时间 2更换教师 3取消课程
export type TransferType = 1 | 2 | 3;

export const TRANSFER_TYPE_LABEL: Record<TransferType, string> = {
  1: '调整时间',
  2: '更换教师',
  3: '取消课程',
};

// 调课申请状态：0待审批 1通过 2驳回
export type TransferStatus = 0 | 1 | 2;

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  0: '待审批',
  1: '已通过',
  2: '已驳回',
};

// 调课申请
export interface LessonTransfer {
  id: number;
  lessonId: number;
  type: TransferType;
  targetDate: string;
  targetStartTime: string;
  targetEndTime: string;
  targetTeacherId: number | null;
  targetClassroomId: number | null;
  reason: string;
  status: TransferStatus;
  applyBy: number | null;
  createdAt: string | null;
  lesson: {
    grade: string;
    date: string;
    timeRange: string;
    teacherId: number;
  } | null;
}

export interface TransferInput {
  lessonId: number;
  type: TransferType;
  targetDate?: string;
  targetStartTime?: string;
  targetEndTime?: string;
  targetTeacherId?: number;
  targetClassroomId?: number;
  reason: string;
}
