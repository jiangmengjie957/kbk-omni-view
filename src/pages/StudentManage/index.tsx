import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { campusApi, studentApi } from '../../api/basicData';
import type { StudentInput } from '../../api/basicData';
import type { Campus, Student } from '../../types/basicData';
import { GENDER_OPTIONS, GRADES, STUDENT_STATUS_OPTIONS } from '../../types/basicData';
import ImportExcelButton from '../../components/ImportExcelButton';
import styles from '../BasicData.module.scss';

const { Title } = Typography;

const TEMPLATE_HEADERS = [
  '姓名',
  '性别',
  '年级',
  '所属校区',
  '联系电话',
  '家长电话',
  '就读学校',
  '出生日期',
  '状态',
  '备注',
];
const TEMPLATE_EXAMPLES = [
  ['李四', '女', '高一', '宝杨路校区', '13900000000', '13700000000', '某中学', '2009-05-01', '在读', ''],
];

function mapGender(text: string): 1 | 2 | null {
  if (text === '男') return 1;
  if (text === '女') return 2;
  return null;
}

function mapStatus(text: string): Student['status'] {
  if (text === '停课') return 0;
  if (text === '结业') return 2;
  return 1;
}

const STATUS_COLOR: Record<Student['status'], string> = {
  1: 'green',
  0: 'orange',
  2: 'blue',
};

const STATUS_LABEL: Record<Student['status'], string> = {
  1: '在读',
  0: '停课',
  2: '结业',
};

export default function StudentManage() {
  const [list, setList] = useState<Student[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<StudentInput>();

  const campusName = useMemo(
    () => new Map(campuses.map((c) => [c.id, c.name])),
    [campuses]
  );
  const campusByName = useMemo(
    () => new Map(campuses.map((c) => [c.name, c.id])),
    [campuses]
  );

  async function refresh() {
    setLoading(true);
    try {
      const [students, camps] = await Promise.all([
        studentApi.list(),
        campusApi.list(),
      ]);
      setList(students);
      setCampuses(camps);
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

  function openEdit(record: Student) {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const payload: StudentInput = {
      name: values.name.trim(),
      gender: values.gender,
      grade: values.grade,
      campusId: values.campusId ?? null,
      phone: (values.phone ?? '').trim(),
      parentPhone: (values.parentPhone ?? '').trim(),
      school: (values.school ?? '').trim(),
      birthday: (values.birthday ?? '').trim(),
      status: values.status,
      remark: (values.remark ?? '').trim(),
    };
    setSaving(true);
    try {
      if (editing) {
        await studentApi.update(editing.id, payload);
        message.success('已更新');
      } else {
        await studentApi.create(payload);
        message.success('已新增');
      }
      setModalOpen(false);
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await studentApi.remove(id);
    message.success('已删除');
    void refresh();
  }

  async function handleImport(rows: Record<string, string>[]) {
    const items: StudentInput[] = [];
    const errors: string[] = [];
    rows.forEach((row, idx) => {
      const line = idx + 2;
      const name = (row['姓名'] ?? '').trim();
      const gender = mapGender((row['性别'] ?? '').trim());
      const grade = (row['年级'] ?? '').trim();
      if (!name) {
        errors.push(`第 ${line} 行：姓名为空`);
        return;
      }
      if (!gender) {
        errors.push(`第 ${line} 行：性别无效（应为 男/女）`);
        return;
      }
      if (!grade) {
        errors.push(`第 ${line} 行：年级为空`);
        return;
      }
      const campusText = (row['所属校区'] ?? '').trim();
      items.push({
        name,
        gender,
        grade,
        campusId: campusText ? (campusByName.get(campusText) ?? null) : null,
        phone: (row['联系电话'] ?? '').trim(),
        parentPhone: (row['家长电话'] ?? '').trim(),
        school: (row['就读学校'] ?? '').trim(),
        birthday: (row['出生日期'] ?? '').trim(),
        status: mapStatus((row['状态'] ?? '').trim()),
        remark: (row['备注'] ?? '').trim(),
      });
    });
    if (items.length) await studentApi.batchCreate(items);
    return { success: items.length, failed: errors.length, errors };
  }

  const columns: TableColumnsType<Student> = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 70,
      render: (v: Student['gender']) => (v === 1 ? '男' : '女'),
    },
    { title: '年级', dataIndex: 'grade', key: 'grade', width: 90 },
    {
      title: '所属校区',
      dataIndex: 'campusId',
      key: 'campusId',
      render: (v: Student['campusId']) => (v == null ? '-' : campusName.get(v) ?? '-'),
    },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
    { title: '家长电话', dataIndex: 'parentPhone', key: 'parentPhone', render: (v: string) => v || '-' },
    { title: '就读学校', dataIndex: 'school', key: 'school', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: Student['status']) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该学员吗？" onConfirm={() => handleDelete(record.id)}>
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
          学员管理
        </Title>
        <div className={styles.toolbar}>
          <ImportExcelButton
            title="学员"
            templateFilename="学员导入模板.xlsx"
            headers={TEMPLATE_HEADERS}
            examples={TEMPLATE_EXAMPLES}
            onImport={handleImport}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增学员
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <Table<Student>
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
        title={editing ? '编辑学员' : '新增学员'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="姓名" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择性别' }]}
          >
            <Select options={[...GENDER_OPTIONS]} placeholder="请选择" />
          </Form.Item>
          <Form.Item
            name="grade"
            label="年级"
            rules={[{ required: true, message: '请选择年级' }]}
          >
            <Select
              options={GRADES.map((g) => ({ value: g, label: g }))}
              placeholder="请选择"
            />
          </Form.Item>
          <Form.Item name="campusId" label="所属校区">
            <Select
              allowClear
              placeholder="请选择"
              options={campuses.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="联系电话" maxLength={30} />
          </Form.Item>
          <Form.Item name="parentPhone" label="家长电话">
            <Input placeholder="家长电话" maxLength={30} />
          </Form.Item>
          <Form.Item name="school" label="就读学校">
            <Input placeholder="就读学校" maxLength={100} />
          </Form.Item>
          <Form.Item name="birthday" label="出生日期">
            <Input placeholder="如 2009-05-01" maxLength={20} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[...STUDENT_STATUS_OPTIONS]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="备注" rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
