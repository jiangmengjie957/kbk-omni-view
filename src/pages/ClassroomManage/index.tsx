import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { campusApi, classroomApi, employeeApi } from '../../api/basicData';
import type { ClassroomInput } from '../../api/basicData';
import type { Campus, Classroom, Employee } from '../../types/basicData';
import { ROOM_TYPE_OPTIONS, CLASSROOM_STATUS_OPTIONS } from '../../types/basicData';
import ImportExcelButton from '../../components/ImportExcelButton';
import styles from '../BasicData.module.scss';

const { Title } = Typography;

const TEMPLATE_HEADERS = [
  '校区',
  '教室编号',
  '教室名称',
  '类型',
  '容量',
  '楼层',
  '设备',
  '状态',
  '负责人',
  '排序',
  '备注',
];
const TEMPLATE_EXAMPLES = [
  ['宝杨路校区', '101', '一号教室', '普通', '30', '1楼', '投影仪', '启用', '张三', '1', ''],
];

const ROOM_TYPE_LABEL: Record<number, string> = {
  1: '普通',
  2: '一对一',
  3: '多媒体',
  4: '实验室',
  5: '其他',
};

const ROOM_STATUS_LABEL: Record<number, string> = {
  1: '启用',
  2: '停用',
  3: '维修中',
};

const ROOM_STATUS_COLOR: Record<number, string> = {
  1: 'green',
  2: 'default',
  3: 'orange',
};

function mapRoomType(text: string): number {
  const t = (text ?? '').trim();
  if (t === '一对一') return 2;
  if (t === '多媒体') return 3;
  if (t === '实验室') return 4;
  if (t === '其他') return 5;
  return 1; // 普通
}

function mapStatus(text: string): number {
  const t = (text ?? '').trim();
  if (t === '停用') return 2;
  if (t === '维修中') return 3;
  return 1; // 启用
}

function toInt(v: string): number {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

export default function ClassroomManage() {
  const [list, setList] = useState<Classroom[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ClassroomInput>();

  const campusName = useMemo(
    () => new Map(campuses.map((c) => [c.id, c.name])),
    [campuses]
  );
  const campusByName = useMemo(
    () => new Map(campuses.map((c) => [c.name, c.id])),
    [campuses]
  );
  const employeeName = useMemo(
    () => new Map(employees.map((e) => [e.id, e.name])),
    [employees]
  );
  const employeeByName = useMemo(
    () => new Map(employees.map((e) => [e.name, e.id])),
    [employees]
  );

  async function refresh() {
    setLoading(true);
    try {
      const [rooms, camps, emps] = await Promise.all([
        classroomApi.list(),
        campusApi.list(),
        employeeApi.list(),
      ]);
      setList(rooms);
      setCampuses(camps);
      setEmployees(emps);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(record: Classroom) {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const payload: ClassroomInput = {
      campusId: values.campusId ?? null,
      roomNo: values.roomNo.trim(),
      roomName: values.roomName.trim(),
      roomType: values.roomType ?? 1,
      capacity: values.capacity ?? 0,
      floor: (values.floor ?? '').trim(),
      equipment: (values.equipment ?? '').trim(),
      status: values.status ?? 1,
      managerEmployeeId: values.managerEmployeeId ?? null,
      sort: values.sort ?? 0,
      remark: (values.remark ?? '').trim(),
    };
    setSaving(true);
    try {
      if (editing) {
        await classroomApi.update(editing.id, payload);
        message.success('已更新');
      } else {
        await classroomApi.create(payload);
        message.success('已新增');
      }
      setModalOpen(false);
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await classroomApi.remove(id);
    message.success('已删除');
    void refresh();
  }

  async function handleImport(rows: Record<string, string>[]) {
    const items: ClassroomInput[] = [];
    const errors: string[] = [];
    rows.forEach((row, idx) => {
      const line = idx + 2;
      const roomNo = (row['教室编号'] ?? '').trim();
      const roomName = (row['教室名称'] ?? '').trim();
      if (!roomNo) {
        errors.push(`第 ${line} 行：教室编号为空`);
        return;
      }
      if (!roomName) {
        errors.push(`第 ${line} 行：教室名称为空`);
        return;
      }
      const campusText = (row['校区'] ?? '').trim();
      const managerText = (row['负责人'] ?? '').trim();
      items.push({
        campusId: campusText ? (campusByName.get(campusText) ?? null) : null,
        roomNo,
        roomName,
        roomType: mapRoomType(row['类型'] ?? ''),
        capacity: toInt(row['容量'] ?? ''),
        floor: (row['楼层'] ?? '').trim(),
        equipment: (row['设备'] ?? '').trim(),
        status: mapStatus(row['状态'] ?? ''),
        managerEmployeeId: managerText ? (employeeByName.get(managerText) ?? null) : null,
        sort: toInt(row['排序'] ?? ''),
        remark: (row['备注'] ?? '').trim(),
      });
    });
    if (items.length) await classroomApi.batchCreate(items);
    return { success: items.length, failed: errors.length, errors };
  }

  const columns: TableColumnsType<Classroom> = [
    {
      title: '所属校区',
      dataIndex: 'campusId',
      key: 'campusId',
      render: (v: Classroom['campusId']) => (v == null ? '-' : campusName.get(v) ?? '-'),
    },
    { title: '教室编号', dataIndex: 'roomNo', key: 'roomNo', width: 100 },
    { title: '教室名称', dataIndex: 'roomName', key: 'roomName' },
    {
      title: '类型',
      dataIndex: 'roomType',
      key: 'roomType',
      width: 90,
      render: (v: number) => ROOM_TYPE_LABEL[v] ?? '-',
    },
    { title: '容量', dataIndex: 'capacity', key: 'capacity', width: 80 },
    { title: '楼层', dataIndex: 'floor', key: 'floor', width: 80, render: (v: string) => v || '-' },
    { title: '设备', dataIndex: 'equipment', key: 'equipment', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: number) => <Tag color={ROOM_STATUS_COLOR[v] ?? 'default'}>{ROOM_STATUS_LABEL[v] ?? '-'}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'managerEmployeeId',
      key: 'managerEmployeeId',
      render: (v: Classroom['managerEmployeeId']) => (v == null ? '-' : employeeName.get(v) ?? '-'),
    },
    { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
    { title: '备注', dataIndex: 'remark', key: 'remark', render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该教室吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>
          教室管理
        </Title>
        <div className={styles.toolbar}>
          <ImportExcelButton
            title="教室"
            templateFilename="教室导入模板.xlsx"
            headers={TEMPLATE_HEADERS}
            examples={TEMPLATE_EXAMPLES}
            onImport={handleImport}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增教室
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <Table<Classroom>
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          className={styles.table}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? '编辑教室' : '新增教室'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="campusId"
            label="所属校区"
            rules={[{ required: true, message: '请选择校区' }]}
          >
            <Select
              placeholder="请选择"
              options={campuses.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item
            name="roomNo"
            label="教室编号"
            rules={[{ required: true, message: '请输入教室编号' }]}
          >
            <Input placeholder="如 101" maxLength={32} />
          </Form.Item>
          <Form.Item
            name="roomName"
            label="教室名称"
            rules={[{ required: true, message: '请输入教室名称' }]}
          >
            <Input placeholder="如 一号教室" maxLength={50} />
          </Form.Item>
          <Form.Item name="roomType" label="类型" initialValue={1}>
            <Select options={[...ROOM_TYPE_OPTIONS]} />
          </Form.Item>
          <Form.Item name="capacity" label="容量">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="容量" />
          </Form.Item>
          <Form.Item name="floor" label="楼层">
            <Input placeholder="如 1楼" maxLength={20} />
          </Form.Item>
          <Form.Item name="equipment" label="设备">
            <Input placeholder="如 投影仪" maxLength={500} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[...CLASSROOM_STATUS_OPTIONS]} />
          </Form.Item>
          <Form.Item name="managerEmployeeId" label="教室负责人">
            <Select
              allowClear
              placeholder="请选择"
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="排序号" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="备注" rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
