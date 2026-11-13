import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  TimePicker,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  AuditOutlined,
  CopyOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ImportOutlined,
  InboxOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { lessonApi, transferApi } from '../../api/lesson';
import { employeeApi, studentApi, classroomApi } from '../../api/basicData';
import { getAuthState } from '../../hooks/useAuth';
import { parseExcel, downloadTemplate } from '../../utils/excel';
import type { Employee, Student, Classroom } from '../../types/basicData';
import type {
  Lesson,
  LessonInput,
  LessonTransfer,
  StudentLessonStatus,
  TransferType,
} from '../../types/lesson';
import {
  STUDENT_LESSON_STATUS_LABEL,
  STUDENT_LESSON_STATUS_OPTIONS,
  WORK_ORDER_TYPE_LABEL,
} from '../../types/lesson';
import styles from './index.module.scss';

const { Title, Text } = Typography;

// ─────────────────────────────────────────────────────────────
// 排课管理（已联调后端）
// 纵轴 = 教师，横轴 = 日期 → 星期 → 时间段（固定列宽，可横向滑动）
// 每格 = 该教师该时段的课程：年级 + 学生名单 + 教室 + 状态
// ─────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '08:00-10:00',
  '10:05-12:05',
  '13:00-15:00',
  '15:05-17:05',
  '17:30-19:30',
  '19:30-21:30',
];

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 排课导入模板列（与后端 normalizeInput 对应）
const IMPORT_HEADERS = ['日期', '开始时间', '结束时间', '教师姓名', '年级', '学生姓名', '教室编号', '备注'];
const IMPORT_EXAMPLES = [['2026-11-14', '13:00', '15:00', '黄伊楠', '高一', '李承恩、张伟', 'A08', '']];

// 给 AI 的整理提示词（用户可复制，让 AI 把现有文件整理成导入格式）
const AI_PROMPT = `请帮我把以下排课信息整理成一张表格（Excel 可导入的格式），表头必须是这 8 列，顺序固定：
日期 | 开始时间 | 结束时间 | 教师姓名 | 年级 | 学生姓名 | 教室编号 | 备注

要求：
1. 日期格式 YYYY-MM-DD（如 2026-11-14）；
2. 开始时间/结束时间格式 HH:mm（如 13:00、15:00）；
3. 教师姓名需与系统中的教师姓名完全一致；
4. 学生姓名用「、」分隔（一对多班级填多个学生）；若一个班里有多名学生，写在同一行用顿号隔开；
5. 年级填 高一/高二/高三/新高一/九年级/八年级/七年级 等，与系统一致；
6. 教室编号如 A08、A15，没有可留空；
7. 备注可留空；
8. 一节课一行，不要把同一老师不同时间段合并到一格。

整理完成后，请直接输出可复制到 Excel 的表格内容（每列用制表符分隔，或直接给我 CSV）。`;

const AI_PROMPT_COPY = AI_PROMPT; // 供复制使用

// ── 日期工具 ──
function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtMd(d: Date): string {
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

function weekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// 解析 "HH:mm-HH:mm" 为分钟数 [起, 止]
function parseRange(range: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec((range ?? '').trim());
  if (!m) return null;
  const toMin = (h: string, mm: string) => Number(h) * 60 + Number(mm);
  return [toMin(m[1], m[2]), toMin(m[3], m[4])];
}

function startsInSlot(slot: string, timeRange: string): boolean {
  const rs = parseRange(slot);
  const rl = parseRange(timeRange);
  if (!rs || !rl) return false;
  return rl[0] >= rs[0] && rl[0] < rs[1];
}

function overlappingSlots(timeRange: string): number[] {
  const rl = parseRange(timeRange);
  if (!rl) return [];
  const [start, end] = rl;
  const idxs: number[] = [];
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const rs = parseRange(TIME_SLOTS[i]);
    if (!rs) continue;
    if (start < rs[1] && end > rs[0]) idxs.push(i);
  }
  return idxs;
}

function slotIndicesFor(timeRange: string): number[] {
  const overlap = overlappingSlots(timeRange);
  if (overlap.length > 0) return overlap;
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    if (startsInSlot(TIME_SLOTS[i], timeRange)) return [i];
  }
  return [];
}

function anchorSlotFor(timeRange: string): number {
  const rl = parseRange(timeRange);
  if (!rl) return 0;
  const [start, end] = rl;
  const firstStart = parseRange(TIME_SLOTS[0])?.[0] ?? 0;
  const lastEnd = parseRange(TIME_SLOTS[TIME_SLOTS.length - 1])?.[1] ?? 0;
  if (end <= firstStart) return 0;
  if (start >= lastEnd) return TIME_SLOTS.length - 1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const rs = parseRange(TIME_SLOTS[i]);
    if (!rs) continue;
    const dist = Math.abs(start - rs[0]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function specialBlockWithin(
  timeRange: string,
  slotIndex: number
): { left: number; width: number } {
  const rl = parseRange(timeRange);
  const rs = parseRange(TIME_SLOTS[slotIndex]);
  if (!rl || !rs) return { left: 0, width: 100 };
  const [start, end] = rl;
  const [slotStart, slotEnd] = rs;
  const slotDur = slotEnd - slotStart;
  const clampStart = Math.max(start, slotStart);
  const clampEnd = Math.min(end, slotEnd);
  let left: number;
  let width: number;
  if (clampEnd > clampStart) {
    left = ((clampStart - slotStart) / slotDur) * 100;
    width = ((clampEnd - clampStart) / slotDur) * 100;
  } else if (end <= slotStart) {
    left = 0;
    width = Math.min(((end - start) / slotDur) * 100, 100);
  } else {
    width = Math.min(((end - start) / slotDur) * 100, 100);
    left = 100 - width;
  }
  return { left: Math.max(0, Math.min(100, left)), width: Math.max(0, Math.min(100, width)) };
}

function LessonCard({ lesson, studentName, onOpen }: {
  lesson: Lesson;
  studentName: (id: number) => string;
  onOpen: () => void;
}) {
  const pending = lesson.status === 2;
  return (
    <div
      className={`${styles.lessonCard} ${pending ? styles.pending : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <div className={styles.grade}>{lesson.grade || '-'}</div>
      <div className={styles.students}>
        {lesson.students.map((s) => {
          const off = s.status !== 1;
          return (
            <span key={s.studentId} className={off ? styles.studentOff : ''}>
              {studentName(s.studentId)}
              {off ? `(${STUDENT_LESSON_STATUS_LABEL[s.status]})` : ''}
              {'  '}
            </span>
          );
        })}
      </div>
      <div className={styles.metaRow}>
        {lesson.classroomId != null && (
          <span className={styles.classroom}>{`教室${lesson.classroomId}`}</span>
        )}
        {lesson.note && <span className={styles.note}>{lesson.note}</span>}
        {pending && (
          <Tag className={styles.statusTag} color="warning">
            审批中
          </Tag>
        )}
      </div>
    </div>
  );
}

export default function ScheduleManage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));

  const [teachers, setTeachers] = useState<Employee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);

  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferType, setTransferType] = useState<TransferType>(1);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [transfers, setTransfers] = useState<LessonTransfer[]>([]);

  const [saving, setSaving] = useState(false);

  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [timeMode, setTimeMode] = useState<'slot' | 'custom'>('slot');
  const [customTime, setCustomTime] = useState('');
  const [transferTimeMode, setTransferTimeMode] = useState<'slot' | 'custom'>('slot');
  const [customNewTime, setCustomNewTime] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  // 导入相关
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; results: { line: number; ok: boolean; message: string }[] } | null>(null);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  // 当前用户角色：管理员（含超级管理员）可直接排课，无需审批
  const isAdminUser = useMemo(() => {
    const auth = getAuthState();
    if (!auth) return false;
    if (auth.isSuper) return true;
    return (auth.roles ?? []).includes('admin');
  }, []);

  // 是否可审批（管理员/教务/校长）
  const canApprove = useMemo(() => {
    const auth = getAuthState();
    if (!auth) return false;
    if (auth.isSuper) return true;
    const roles = auth.roles ?? [];
    return roles.includes('admin') || roles.includes('academic') || roles.includes('principal');
  }, []);

  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t.name])), [teachers]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classroomById = useMemo(() => new Map(classrooms.map((c) => [c.id, c])), [classrooms]);

  const studentName = (id: number) => studentById.get(id)?.name ?? `#${id}`;
  const classroomName = (id: number | null) =>
    id == null ? '-' : classroomById.get(id)?.roomName ?? classroomById.get(id)?.roomNo ?? '-';

  // 从学员列表收集年级选项
  const gradeOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.grade).filter(Boolean));
    return [...set].map((g) => ({ value: g, label: g }));
  }, [students]);

  const dateOptions = useMemo(
    () =>
      dates.map((d) => ({
        value: toDateStr(d),
        label: `${WEEKDAY_LABELS[d.getDay()]} ${fmtMd(d)}`,
      })),
    [dates]
  );

  // 按 日期|教师 分组
  const lessonsByDay = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const key = `${l.lessonDate}|${l.teacherId}`;
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return map;
  }, [lessons]);

  async function refreshLessons() {
    const [start, end] = [toDateStr(dates[0]), toDateStr(dates[6])];
    const list = await lessonApi.list({ startDate: start, endDate: end });
    setLessons(list);
  }

  async function refreshBase() {
    const [emps, stus, rooms] = await Promise.all([
      employeeApi.list(),
      studentApi.list(),
      classroomApi.list(),
    ]);
    // 教师列表只展示岗位为「教师」的员工（即使没排课也会显示）
    setTeachers(emps.filter((e) => e.position === '教师'));
    setStudents(stus);
    setClassrooms(rooms);
  }

  async function refresh() {
    setLoading(true);
    try {
      await refreshBase();
      await refreshLessons();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dates.length) void refreshLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function refreshTransfers() {
    const list = await transferApi.list();
    setTransfers(list);
  }

  function shiftWeek(days: number) {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  }

  function splitTimeRange(range: string): { startTime: string; endTime: string } {
    const [start = '', end = ''] = range.split('-');
    return { startTime: start, endTime: end };
  }

  // 解析导入的 Excel：按表头映射为 LessonInput 数组
  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseExcel(file);
      if (!rows.length) {
        message.warning('文件中没有可导入的数据');
        return;
      }
      const items: LessonInput[] = [];
      const errors: string[] = [];
      rows.forEach((row, idx) => {
        const line = idx + 2;
        const date = (row['日期'] ?? '').trim();
        const start = (row['开始时间'] ?? '').trim();
        const end = (row['结束时间'] ?? '').trim();
        const teacherName = (row['教师姓名'] ?? '').trim();
        const grade = (row['年级'] ?? '').trim();
        const studentNames = (row['学生姓名'] ?? '').trim();
        const classroomNo = (row['教室编号'] ?? '').trim();
        const note = (row['备注'] ?? '').trim();

        const teacher = teachers.find((t) => t.name === teacherName);
        if (!teacher) {
          errors.push(`第 ${line} 行：教师「${teacherName || '(空)'}」不存在`);
          return;
        }
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          errors.push(`第 ${line} 行：日期格式不正确（应为 YYYY-MM-DD）`);
          return;
        }
        if (!studentNames) {
          errors.push(`第 ${line} 行：学生姓名为空`);
          return;
        }
        const nameList = studentNames.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean);
        const studentIds: number[] = [];
        const missing: string[] = [];
        for (const nm of nameList) {
          const st = students.find((s) => s.name === nm);
          if (st) studentIds.push(st.id);
          else missing.push(nm);
        }
        if (missing.length) {
          errors.push(`第 ${line} 行：学生「${missing.join('、')}」不存在`);
          return;
        }
        const classroom = classroomNo ? classrooms.find((c) => c.roomNo === classroomNo) : undefined;
        if (classroomNo && !classroom) {
          errors.push(`第 ${line} 行：教室「${classroomNo}」不存在`);
          return;
        }

        items.push({
          teacherId: teacher.id,
          classroomId: classroom?.id ?? null,
          lessonDate: date,
          startTime: start,
          endTime: end,
          grade,
          note,
          reason: '批量导入排课',
          students: studentIds.map((sid) => ({ studentId: sid, status: 1 as StudentLessonStatus })),
        });
      });

      if (!items.length && !errors.length) {
        message.warning('没有可导入的数据');
        return;
      }

      let result: { success: number; failed: number; results: { line: number; ok: boolean; message: string }[] } = { success: 0, failed: errors.length, results: [] };
      if (items.length) {
        const res = await lessonApi.batch(items);
        // 合并后端冲突结果与本地预校验错误
        result = {
          success: res.success,
          failed: res.failed + errors.length,
          results: res.results,
        };
      }
      setImportResult(result);
      if (result.success > 0) await refreshLessons();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  function openCreate(prefill: { teacherId?: number; date?: string; timeRange?: string } = {}) {
    setEditing(null);
    setTimeMode('slot');
    setCustomTime('');
    form.resetFields();
    if (prefill.teacherId) form.setFieldsValue({ teacherId: prefill.teacherId });
    if (prefill.date) form.setFieldsValue({ lessonDate: prefill.date });
    if (prefill.timeRange) form.setFieldsValue({ timeRange: prefill.timeRange });
    setCreateOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditing(lesson);
    setTimeMode('slot');
    setCustomTime('');
    form.setFieldsValue({
      teacherId: lesson.teacherId,
      lessonDate: lesson.lessonDate,
      timeRange: lesson.timeRange,
      grade: lesson.grade,
      students: lesson.students.map((s) => s.studentId),
      classroomId: lesson.classroomId,
      note: lesson.note,
    });
    setCreateOpen(true);
  }

  async function submitCreate() {
    const values = await form.validateFields();
    const timeRange = (timeMode === 'custom' ? customTime : values.timeRange).trim();
    if (!timeRange) {
      message.warning('请填写时间段');
      return;
    }
    const { startTime, endTime } = splitTimeRange(timeRange);
    const studentIds: number[] = values.students ?? [];

    // 同年级校验：不同年级需二次确认
    const grades = new Set(
      studentIds.map((id) => studentById.get(id)?.grade).filter(Boolean)
    );
    if (grades.size > 1) {
      Modal.confirm({
        title: '学生年级不一致',
        icon: null,
        content: (
          <div>
            所选学生来自不同年级（{[...grades].join('、')}），是否仍要排到同一节课中？
          </div>
        ),
        okText: '确认排课',
        cancelText: '返回修改',
        onOk: () => doCreate(startTime, endTime, studentIds, values),
      });
      return;
    }
    await doCreate(startTime, endTime, studentIds, values);
  }

  async function doCreate(
    startTime: string,
    endTime: string,
    studentIds: number[],
    values: any
  ) {
    setSaving(true);
    try {
      const payload: LessonInput = {
        teacherId: values.teacherId,
        classroomId: values.classroomId ?? null,
        lessonDate: values.lessonDate,
        startTime,
        endTime,
        grade: values.grade ?? '',
        note: values.note ?? '',
        reason: values.reason ?? '',
        students: studentIds.map((sid) => ({ studentId: sid, status: 1 as StudentLessonStatus })),
      };
      if (editing) {
        await lessonApi.update(editing.id, payload);
        message.success('已更新');
      } else {
        await lessonApi.create(payload);
        // 非管理员排课走审批
        message.success(isAdminUser ? '已新增排课' : '已提交排课申请，等待审批');
      }
      setCreateOpen(false);
      await refreshLessons();
      if (!isAdminUser) await refreshTransfers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await lessonApi.remove(id);
    message.success('已删除');
    setDetailLesson(null);
    await refreshLessons();
  }

  async function updateStudentStatus(lessonId: number, studentId: number, status: StudentLessonStatus) {
    await lessonApi.updateStudentStatus(lessonId, studentId, status);
    setDetailLesson((prev) =>
      prev
        ? {
            ...prev,
            students: prev.students.map((s) =>
              s.studentId === studentId ? { ...s, status } : s
            ),
          }
        : prev
    );
    await refreshLessons();
    message.success('已更新学生状态');
  }

  function openTransfer(lessonId?: number) {
    setTransferType(1);
    setTransferTimeMode('slot');
    setCustomNewTime('');
    transferForm.resetFields();
    if (lessonId) transferForm.setFieldsValue({ lessonId });
    setTransferOpen(true);
  }

  async function submitTransfer() {
    const values = await transferForm.validateFields();
    const type = values.type as TransferType;
    let targetStartTime: string | undefined;
    let targetEndTime: string | undefined;
    if (type === 1) {
      const range = (transferTimeMode === 'custom' ? customNewTime : values.newTimeRange).trim();
      if (!range) {
        message.warning('请填写新时间段');
        return;
      }
      const sp = splitTimeRange(range);
      targetStartTime = sp.startTime;
      targetEndTime = sp.endTime;
    }
    await transferApi.apply({
      lessonId: values.lessonId,
      type,
      targetDate: type === 1 ? values.newDate : undefined,
      targetStartTime,
      targetEndTime,
      targetTeacherId: type === 2 ? values.newTeacherId : undefined,
      reason: values.reason,
    });
    message.success('调课申请已提交，等待审批');
    setTransferOpen(false);
    await refreshTransfers();
    await refreshLessons();
  }

  async function approveTransfer(id: number) {
    await transferApi.approve(id, 'approve');
    message.success('已通过并生效');
    await refreshTransfers();
    await refreshLessons();
  }

  async function rejectTransfer(id: number) {
    await transferApi.approve(id, 'reject');
    message.info('已驳回');
    await refreshTransfers();
    await refreshLessons();
  }

  function openApprovals() {
    void refreshTransfers();
    setApprovalsOpen(true);
  }

  const normalLessons = useMemo(() => lessons.filter((l) => l.status !== 2), [lessons]);
  const pendingCount = transfers.filter((t) => t.status === 0).length;

  return (
    <div className={`${styles.page} ${fullscreen ? styles.fullscreen : ''}`}>
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>
          排课管理
        </Title>
        <Space wrap>
          <Space.Compact>
            <Button icon={<LeftOutlined />} onClick={() => shiftWeek(-7)} />
            <Button onClick={() => setWeekStart(mondayOf(new Date()))}>本周</Button>
            <Button icon={<RightOutlined />} onClick={() => shiftWeek(7)} />
          </Space.Compact>
          <Text className={styles.weekRange}>
            {toDateStr(dates[0])} ~ {toDateStr(dates[6])}
          </Text>
          <Button
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
        </Space>
      </div>

      <div className={styles.toolbarRow}>
        <Text type="secondary" className={styles.hint}>
          点击空白格可快速新增排课 · 表格可左右滑动
        </Text>
        <Space wrap>
          <Badge count={pendingCount} size="small">
            <Button icon={<AuditOutlined />} onClick={openApprovals}>
              待审批
            </Button>
          </Badge>
          <Button icon={<SwapOutlined />} onClick={() => openTransfer()}>
            申请调课
          </Button>
          {isAdminUser && (
            <Button icon={<ImportOutlined />} onClick={() => { setImportResult(null); setImportOpen(true); }}>
              导入
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            新增排课
          </Button>
        </Space>
      </div>

      <div className={styles.card}>
        <Spin spinning={loading}>
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <colgroup>
                <col className={styles.colTeacher} />
                {dates.flatMap((d) =>
                  TIME_SLOTS.map((s) => (
                    <col key={`${toDateStr(d)}|${s}`} className={styles.colSlot} />
                  ))
                )}
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.corner} rowSpan={3}>
                    教师
                  </th>
                  {dates.map((d) => (
                    <th key={toDateStr(d)} className={styles.dateHead} colSpan={TIME_SLOTS.length}>
                      {`${d.getMonth() + 1}月${d.getDate()}日`}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dates.map((d) => (
                    <th key={toDateStr(d)} className={styles.weekHead} colSpan={TIME_SLOTS.length}>
                      {WEEKDAY_LABELS[d.getDay()]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dates.flatMap((d) =>
                    TIME_SLOTS.map((s) => (
                      <th key={`${toDateStr(d)}|${s}`} className={styles.slotHead}>
                        {s}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const cells: ReactNode[] = [];
                  for (const d of dates) {
                    const ds = toDateStr(d);
                    const dayLessons = lessonsByDay.get(`${ds}|${t.id}`) ?? [];
                    const specialLessons = dayLessons.filter(
                      (l) => slotIndicesFor(l.timeRange).length === 0
                    );
                    let i = 0;
                    while (i < TIME_SLOTS.length) {
                      const slot = TIME_SLOTS[i];
                      const lesson = dayLessons.find((l) => {
                        const idxs = slotIndicesFor(l.timeRange);
                        return idxs.length > 0 && idxs[0] === i;
                      });
                      if (lesson) {
                        const span = Math.max(slotIndicesFor(lesson.timeRange).length, 1);
                        cells.push(
                          <td key={`${ds}|${slot}`} className={styles.lessonCell} colSpan={span}>
                            <LessonCard
                              lesson={lesson}
                              studentName={studentName}
                              onOpen={() => setDetailLesson(lesson)}
                            />
                          </td>
                        );
                        i += span;
                        continue;
                      }
                      const specials = specialLessons.filter(
                        (l) => anchorSlotFor(l.timeRange) === i
                      );
                      cells.push(
                        <td key={`${ds}|${slot}`} className={styles.lessonCell}>
                          <div className={styles.cellInner}>
                            {specials.map((sl) => {
                              const pct = specialBlockWithin(sl.timeRange, i);
                              return (
                                <div
                                  key={sl.id}
                                  className={styles.specialBlock}
                                  style={{ left: `${pct.left}%`, width: `${pct.width}%` }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailLesson(sl);
                                  }}
                                >
                                  <span className={styles.specialTime}>{sl.timeRange}</span>
                                  <span className={styles.specialStudent}>
                                    {sl.students.map((s) => studentName(s.studentId)).join('、')}
                                  </span>
                                </div>
                              );
                            })}
                            <div
                              className={styles.emptyCell}
                              onClick={() =>
                                openCreate({ teacherId: t.id, date: ds, timeRange: slot })
                              }
                            >
                              <span className={styles.emptyPlus}>+</span>
                            </div>
                          </div>
                        </td>
                      );
                      i += 1;
                    }
                  }
                  return (
                    <tr key={t.id}>
                      <td className={styles.teacherCell}>
                        <div className={styles.teacherName}>{t.name}</div>
                      </td>
                      {cells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Spin>
      </div>

      {/* 课程详情 */}
      <Drawer
        title="课程详情"
        width={420}
        open={!!detailLesson}
        onClose={() => setDetailLesson(null)}
      >
        {detailLesson && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="年级">{detailLesson.grade || '-'}</Descriptions.Item>
              <Descriptions.Item label="教师">
                {teacherById.get(detailLesson.teacherId) ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="日期">{detailLesson.lessonDate}</Descriptions.Item>
              <Descriptions.Item label="时间段">{detailLesson.timeRange}</Descriptions.Item>
              <Descriptions.Item label="教室">{classroomName(detailLesson.classroomId)}</Descriptions.Item>
              <Descriptions.Item label="备注">{detailLesson.note || '-'}</Descriptions.Item>
            </Descriptions>

            <div className={styles.studentList}>
              <div className={styles.studentListTitle}>学生出勤状态</div>
              {detailLesson.students.map((s) => (
                <div key={s.studentId} className={styles.studentItem}>
                  <span className={styles.studentItemName}>{studentName(s.studentId)}</span>
                  <Select
                    size="small"
                    value={s.status}
                    style={{ width: 100 }}
                    options={STUDENT_LESSON_STATUS_OPTIONS}
                    onChange={(val) => updateStudentStatus(detailLesson.id, s.studentId, val)}
                  />
                </div>
              ))}
            </div>

            <Space style={{ marginTop: 16 }}>
              {detailLesson.status !== 2 && (
                <Button type="primary" icon={<SwapOutlined />} onClick={() => openTransfer(detailLesson.id)}>
                  申请调课
                </Button>
              )}
              <Button onClick={() => openEdit(detailLesson)}>编辑</Button>
              <Popconfirm title="确定删除该课程吗？" onConfirm={() => handleDelete(detailLesson.id)}>
                <Button danger>删除</Button>
              </Popconfirm>
            </Space>
          </>
        )}
      </Drawer>

      {/* 导入排课 */}
      <Modal
        title="导入排课"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        width={640}
        maskClosable={false}
        footer={
          importResult
            ? [
                <Button key="done" type="primary" onClick={() => setImportOpen(false)}>
                  完成
                </Button>,
              ]
            : null
        }
      >
        {importResult ? (
          <div>
            <p>
              成功 <b>{importResult.success}</b> 条
              {importResult.failed > 0 && (
                <>
                  ，失败 <b>{importResult.failed}</b> 条
                </>
              )}
            </p>
            {importResult.failed > 0 && (
              <>
                <Text type="danger">失败明细：</Text>
                <ul style={{ maxHeight: 240, overflow: 'auto', paddingLeft: 20 }}>
                  {importResult.results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.line}>
                        第 {r.line} 行：{r.message}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="导入格式要求"
              description={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>
                    模板列：{IMPORT_HEADERS.join(' | ')}
                  </span>
                  <span>
                    · 教师/学生/教室需与系统中已有数据一致；一对多班级学生用「、」分隔
                  </span>
                </div>
              }
            />
            <Upload.Dragger
              accept=".xlsx,.xls"
              maxCount={1}
              showUploadList={false}
              disabled={importing}
              beforeUpload={(file) => {
                void handleImportFile(file);
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 Excel 文件到此处上传</p>
              <p className="ant-upload-hint">支持 .xlsx / .xls，第一行为表头</p>
            </Upload.Dragger>

            <Space style={{ marginTop: 16 }}>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => downloadTemplate('排课导入模板.xlsx', IMPORT_HEADERS, IMPORT_EXAMPLES)}
              >
                下载模板
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  void navigator.clipboard.writeText(AI_PROMPT_COPY);
                  message.success('提示词已复制，粘贴给 AI 即可');
                }}
              >
                复制 AI 提示词
              </Button>
            </Space>
          </>
        )}
      </Modal>

      {/* 新增/编辑排课 */}
      <Modal
        title={editing ? '编辑排课' : '新增排课'}
        open={createOpen}
        onOk={submitCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={saving}
        forceRender
        width={500}
        maskClosable={false}
        zIndex={1200}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="teacherId" label="教师" rules={[{ required: true, message: '请选择教师' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="请选择"
            />
          </Form.Item>
          <Form.Item name="lessonDate" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <Select showSearch optionFilterProp="label" options={dateOptions} placeholder="请选择" />
          </Form.Item>
          <Form.Item label="时间段" required>
            <Radio.Group
              value={timeMode}
              onChange={(e) => setTimeMode(e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <Radio.Button value="slot">标准时段</Radio.Button>
              <Radio.Button value="custom">特殊时间</Radio.Button>
            </Radio.Group>
            {timeMode === 'slot' ? (
              <Form.Item name="timeRange" noStyle rules={[{ required: true, message: '请选择时间段' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={TIME_SLOTS.map((s) => ({ value: s, label: s }))}
                  placeholder="请选择"
                />
              </Form.Item>
            ) : (
              <TimePicker.RangePicker
                format="HH:mm"
                minuteStep={5}
                style={{ width: '100%' }}
                placeholder={['开始时间', '结束时间']}
                onChange={(times) => {
                  if (times && times[0] && times[1]) {
                    setCustomTime(`${times[0].format('HH:mm')}-${times[1].format('HH:mm')}`);
                  } else {
                    setCustomTime('');
                  }
                }}
              />
            )}
          </Form.Item>
          <Form.Item name="grade" label="年级">
            <Select showSearch optionFilterProp="label" options={gradeOptions} placeholder="请选择" />
          </Form.Item>
          <Form.Item
            name="students"
            label="学生（可多选，支持一对多班）"
            rules={[{ required: true, message: '请至少选择一名学生' }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={students.map((s) => ({ value: s.id, label: `${s.name}（${s.grade}）` }))}
              placeholder="请选择学生"
            />
          </Form.Item>
          <Form.Item name="classroomId" label="教室">
            <Select
              showSearch
              optionFilterProp="label"
              allowClear
              options={classrooms.map((c) => ({ value: c.id, label: c.roomName || c.roomNo }))}
              placeholder="请选择教室"
            />
          </Form.Item>
          <Form.Item name="note" label="备注/标签">
            <Input placeholder="如 1V1 / 6-8人 / 代课" maxLength={50} />
          </Form.Item>
          {!isAdminUser && !editing && (
            <Form.Item
              name="reason"
              label="排课申请原因"
              rules={[{ required: true, message: '请填写排课申请原因' }]}
            >
              <Input.TextArea placeholder="请说明排课原因（将提交给教务/校长/管理员审批）" rows={3} maxLength={200} />
            </Form.Item>
          )}
          {!isAdminUser && !editing && (
            <Alert
              type="info"
              showIcon
              message="非管理员排课需教务/校长/管理员审批，审批通过后生效，审批期间该档期将被占用。"
            />
          )}
        </Form>
      </Modal>

      {/* 申请调课 */}
      <Modal
        title="申请调课"
        open={transferOpen}
        onOk={submitTransfer}
        onCancel={() => setTransferOpen(false)}
        forceRender
        width={520}
        maskClosable={false}
        zIndex={1200}
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item name="lessonId" label="选择课程" rules={[{ required: true, message: '请选择要调动的课程' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择要调动的课程"
              options={normalLessons.map((l) => ({
                value: l.id,
                label: `${l.grade || '-'} · ${l.students.map((s) => studentName(s.studentId)).join('、')}（${l.lessonDate} ${l.timeRange} · ${teacherById.get(l.teacherId)}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="type" label="调整类型" initialValue={1}>
            <Radio.Group onChange={(e) => setTransferType(e.target.value)}>
              <Radio.Button value={1}>调整时间</Radio.Button>
              <Radio.Button value={2}>更换教师</Radio.Button>
              <Radio.Button value={3}>取消课程</Radio.Button>
            </Radio.Group>
          </Form.Item>
          {transferType === 1 && (
            <>
              <Form.Item name="newDate" label="新日期" rules={[{ required: true, message: '请选择新日期' }]}>
                <Select showSearch optionFilterProp="label" options={dateOptions} placeholder="请选择" />
              </Form.Item>
              <Form.Item label="新时间段" required>
                <Radio.Group
                  value={transferTimeMode}
                  onChange={(e) => setTransferTimeMode(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <Radio.Button value="slot">标准时段</Radio.Button>
                  <Radio.Button value="custom">特殊时间</Radio.Button>
                </Radio.Group>
                {transferTimeMode === 'slot' ? (
                  <Form.Item name="newTimeRange" noStyle rules={[{ required: true, message: '请选择新时间段' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={TIME_SLOTS.map((s) => ({ value: s, label: s }))}
                      placeholder="请选择"
                    />
                  </Form.Item>
                ) : (
                  <TimePicker.RangePicker
                    format="HH:mm"
                    minuteStep={5}
                    style={{ width: '100%' }}
                    placeholder={['开始时间', '结束时间']}
                    onChange={(times) => {
                      if (times && times[0] && times[1]) {
                        setCustomNewTime(`${times[0].format('HH:mm')}-${times[1].format('HH:mm')}`);
                      } else {
                        setCustomNewTime('');
                      }
                    }}
                  />
                )}
              </Form.Item>
            </>
          )}
          {transferType === 2 && (
            <Form.Item name="newTeacherId" label="新教师" rules={[{ required: true, message: '请选择新教师' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="请选择"
              />
            </Form.Item>
          )}
          <Form.Item name="reason" label="申请原因" rules={[{ required: true, message: '请填写申请原因' }]}>
            <Input.TextArea placeholder="请说明调课原因" rows={3} maxLength={200} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="非管理员排课调整需管理员/教务审批，审批通过后方可生效。"
          />
        </Form>
      </Modal>

      {/* 排课/调课工单审批 */}
      <Drawer
        title="工单审批"
        width={460}
        open={approvalsOpen}
        onClose={() => setApprovalsOpen(false)}
      >
        {transfers.length === 0 ? (
          <Empty description="暂无工单" />
        ) : (
          <div className={styles.approvalList}>
            {transfers.map((tr) => (
              <div key={tr.id} className={styles.approvalItem}>
                <div className={styles.approvalTitle}>
                  <Tag color="blue">{WORK_ORDER_TYPE_LABEL[tr.type] ?? `类型${tr.type}`}</Tag>
                  {tr.lesson
                    ? `${tr.lesson.grade || '-'} · ${tr.lesson.timeRange}`
                    : `课程#${tr.lessonId}`}
                </div>
                <div className={styles.approvalMeta}>
                  {tr.type === 1 && `调整时间 → ${tr.targetDate} ${tr.targetStartTime}-${tr.targetEndTime}`}
                  {tr.type === 2 && `更换教师 → 教师#${tr.targetTeacherId}`}
                  {tr.type === 3 && '取消课程'}
                  {tr.type === 4 && '申请新增排课'}
                </div>
                <div className={styles.approvalReason}>原因：{tr.reason || '-'}</div>
                {tr.status === 0 ? (
                  canApprove ? (
                    <Space className={styles.approvalActions}>
                      <Button size="small" type="primary" onClick={() => approveTransfer(tr.id)}>
                        通过
                      </Button>
                      <Button size="small" onClick={() => rejectTransfer(tr.id)}>
                        驳回
                      </Button>
                    </Space>
                  ) : (
                    <Tag color="processing">待审批</Tag>
                  )
                ) : (
                  <Tag color={tr.status === 1 ? 'green' : 'red'}>
                    {tr.status === 1 ? '已通过' : '已驳回'}
                  </Tag>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
