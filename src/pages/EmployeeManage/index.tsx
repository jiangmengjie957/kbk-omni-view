import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { campusApi, employeeApi } from '../../api/basicData';
import { employeeAccountApi } from '../../api/employeeAccount';
import type { EmployeeAccountMap } from '../../api/employeeAccount';
import { getAuthState } from '../../hooks/useAuth';
import type { EmployeeInput } from '../../api/basicData';
import type { Campus, Employee } from '../../types/basicData';
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  POSITIONS,
} from '../../types/basicData';
import ImportExcelButton from '../../components/ImportExcelButton';
import styles from '../BasicData.module.scss';

const { Title } = Typography;

const TEMPLATE_HEADERS = [
  '姓名',
  '性别',
  '岗位',
  '用工类型',
  '所属校区',
  '联系电话',
  '入职日期',
  '状态',
  '备注',
];
const TEMPLATE_EXAMPLES = [
  ['张三', '男', '教师', '全职', '宝杨路校区', '13800000000', '2026-01-01', '在职', ''],
];

function mapGender(text: string): 1 | 2 | null {
  if (text === '男') return 1;
  if (text === '女') return 2;
  return null;
}

function mapStatus(text: string): 1 | 0 {
  return text === '离职' ? 0 : 1;
}

function mapEmploymentType(text: string): 1 | 2 {
  return text === '兼职' ? 2 : 1;
}

export default function EmployeeManage() {
  const [list, setList] = useState<Employee[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm<EmployeeInput>();

  // 账号管理相关
  const [accountMap, setAccountMap] = useState<EmployeeAccountMap | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [showAccount, setShowAccount] = useState<Employee | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);

  const isAdmin = useMemo(() => {
    const auth = getAuthState();
    if (!auth) return false;
    if (auth.isSuper) return true;
    return (auth.roles ?? []).includes('admin');
  }, []);

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
      const [employees, camps] = await Promise.all([
        employeeApi.list(),
        campusApi.list(),
      ]);
      setList(employees);
      setCampuses(camps);
      if (isAdmin) {
        setAccountLoading(true);
        try {
          setAccountMap(await employeeAccountApi.accounts());
        } catch {
          setAccountMap(null);
        } finally {
          setAccountLoading(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 为员工创建账号
  async function handleCreateAccount(employee: Employee) {
    setCreatingAccount(true);
    try {
      const res = await employeeAccountApi.create(employee.id);
      setShowAccount(null);
      setCredential({ username: res.username, password: res.password });
      setAccountMap((current) => ({
        ...current,
        [employee.id]: { username: res.username, status: 1 },
      }));
      message.success('账号创建成功');
    } finally {
      setCreatingAccount(false);
    }
  }

  // 启用/禁用账号
  async function handleToggleAccount(employee: Employee) {
    const cur = accountMap?.[String(employee.id)];
    if (!cur) return;
    const next = cur.status === 2 ? 1 : 2;
    await employeeAccountApi.updateStatus(employee.id, next);
    setAccountMap((current) => ({
      ...current,
      [employee.id]: { ...cur, status: next },
    }));
    message.success(next === 1 ? '账号已启用' : '账号已禁用');
  }

  // 重置密码
  async function handleResetPassword(employee: Employee) {
    const res = await employeeAccountApi.resetPassword(employee.id);
    setCredential({ username: res.username, password: res.password });
    message.success('密码已重置');
  }

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(record: Employee) {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const payload: EmployeeInput = {
      name: values.name.trim(),
      gender: values.gender,
      position: values.position,
      employmentType: values.employmentType ?? 1,
      campusId: values.campusId ?? null,
      phone: (values.phone ?? '').trim(),
      hireDate: (values.hireDate ?? '').trim(),
      status: values.status,
      remark: (values.remark ?? '').trim(),
    };
    setSaving(true);
    try {
      if (editing) {
        await employeeApi.update(editing.id, payload);
        message.success('已更新');
      } else {
        await employeeApi.create(payload);
        message.success('已新增');
      }
      setModalOpen(false);
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  function openDelete(record: Employee) {
    setDeleteTarget(record);
    setDeleteStep(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    // 第一次点击是「继续」进入二次确认，第二次才真正删除
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    setDeleting(true);
    try {
      await employeeApi.remove(deleteTarget.id);
      message.success('已删除');
      setDeleteTarget(null);
      void refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleImport(rows: Record<string, string>[]) {
    const items: EmployeeInput[] = [];
    const errors: string[] = [];
    rows.forEach((row, idx) => {
      const line = idx + 2;
      const name = (row['姓名'] ?? '').trim();
      const gender = mapGender((row['性别'] ?? '').trim());
      const position = (row['岗位'] ?? '').trim();
      if (!name) {
        errors.push(`第 ${line} 行：姓名为空`);
        return;
      }
      if (!gender) {
        errors.push(`第 ${line} 行：性别无效（应为 男/女）`);
        return;
      }
      if (!position) {
        errors.push(`第 ${line} 行：岗位为空`);
        return;
      }
      const campusText = (row['所属校区'] ?? '').trim();
      items.push({
        name,
        gender,
        position,
        employmentType: mapEmploymentType((row['用工类型'] ?? '').trim()),
        campusId: campusText ? (campusByName.get(campusText) ?? null) : null,
        phone: (row['联系电话'] ?? '').trim(),
        hireDate: (row['入职日期'] ?? '').trim(),
        status: mapStatus((row['状态'] ?? '').trim()),
        remark: (row['备注'] ?? '').trim(),
      });
    });
    if (items.length) await employeeApi.batchCreate(items);
    return { success: items.length, failed: errors.length, errors };
  }

  const columns: TableColumnsType<Employee> = [
    { title: '工号', dataIndex: 'employeeNo', key: 'employeeNo' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 70,
      render: (v: Employee['gender']) => (v === 1 ? '男' : '女'),
    },
    { title: '岗位', dataIndex: 'position', key: 'position' },
    {
      title: '用工类型',
      dataIndex: 'employmentType',
      key: 'employmentType',
      width: 90,
      render: (v: Employee['employmentType']) =>
        v === 2 ? <Tag color="blue">兼职</Tag> : <Tag>全职</Tag>,
    },
    {
      title: '所属校区',
      dataIndex: 'campusId',
      key: 'campusId',
      render: (v: Employee['campusId']) => (v == null ? '-' : campusName.get(v) ?? '-'),
    },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
    { title: '入职日期', dataIndex: 'hireDate', key: 'hireDate', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: Employee['status']) =>
        v === 1 ? <Tag color="green">在职</Tag> : <Tag color="default">离职</Tag>,
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
          <Button type="link" size="small" danger onClick={() => openDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
    {
      title: '账号状态',
      key: 'accountStatus',
      render: (_, record) => {
        if (!accountMap) return '-';
        const account = accountMap[String(record.id)];
        if (!account) return <Tag>未创建</Tag>;
        if (account.status === 1) return <Tag color="green">已启用</Tag>;
        if (account.status === 2) return <Tag color="default">已禁用</Tag>;
        return <Tag color="orange">已锁定</Tag>;
      },
    },
    {
      title: '账号操作',
      key: 'accountAction',
      render: (_, record) => {
        if (!accountMap) return '-';
        const account = accountMap[String(record.id)];
        return account ? (
          <Space>
            <Button type="link" size="small" onClick={() => setShowAccount(record)}>
              查看账号
            </Button>
            <Button type="link" size="small" onClick={() => {
              Modal.confirm({
                title: '重置密码',
                content: `确定重置员工「${record.name}」的登录密码吗？原密码将立即失效。`,
                onOk: () => handleResetPassword(record),
              });
            }}>
              重置密码
            </Button>
            <Button type="link" size="small" danger={account.status === 1} onClick={() => {
              Modal.confirm({
                title: account.status === 1 ? '禁用账号' : '启用账号',
                content: `确定${account.status === 1 ? '禁用' : '启用'}员工「${record.name}」的登录账号吗？`,
                onOk: () => handleToggleAccount(record),
              });
            }}>
              {account.status === 1 ? '禁用' : '启用'}
            </Button>
          </Space>
        ) : (
          <Button type="link" size="small" onClick={() => setShowAccount(record)}>
            创建账号
          </Button>
        );
      },
    },
  ];

  if (!isAdmin) columns.splice(columns.length - 2, 2);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Title level={4} className={styles.title}>
          员工管理
        </Title>
        <div className={styles.toolbar}>
          <ImportExcelButton
            title="员工"
            templateFilename="员工导入模板.xlsx"
            headers={TEMPLATE_HEADERS}
            examples={TEMPLATE_EXAMPLES}
            onImport={handleImport}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增员工
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <Table<Employee>
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading || (isAdmin && accountLoading)}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          className={styles.table}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? '编辑员工' : '新增员工'}
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
            name="position"
            label="岗位"
            rules={[{ required: true, message: '请选择岗位' }]}
          >
            <Select
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              placeholder="请选择"
            />
          </Form.Item>
          <Form.Item
            name="employmentType"
            label="用工类型"
            initialValue={1}
            rules={[{ required: true, message: '请选择用工类型' }]}
          >
            <Select options={[...EMPLOYMENT_TYPE_OPTIONS]} placeholder="请选择" />
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
          <Form.Item name="hireDate" label="入职日期">
            <Input placeholder="如 2026-01-01" maxLength={20} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[...EMPLOYEE_STATUS_OPTIONS]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="备注" rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      {isAdmin && (
        <>
          <Modal
            title={accountMap?.[String(showAccount?.id)] ? '查看员工账号' : '创建员工账号'}
            open={!!showAccount}
            onOk={() => {
              if (showAccount && !accountMap?.[String(showAccount.id)]) {
                return handleCreateAccount(showAccount).catch(() => {});
              }
              setShowAccount(null);
            }}
            onCancel={() => { if (!creatingAccount) setShowAccount(null); }}
            okText={accountMap?.[String(showAccount?.id)] ? '关闭' : '确认创建'}
            confirmLoading={creatingAccount}
            cancelButtonProps={{ disabled: creatingAccount }}
            maskClosable={false}
          >
            {accountMap?.[String(showAccount?.id)] ? (
              <p>员工「{showAccount?.name}」的登录账号：<strong>{accountMap[String(showAccount?.id)].username}</strong>。密码无法查看，如需新密码请重置。</p>
            ) : (
              <p>确定为员工「{showAccount?.name}」创建登录账号吗？初始账号和密码仅在创建成功后显示一次。</p>
            )}
          </Modal>
          <Modal
            title="初始登录凭据"
            open={!!credential}
            onOk={() => setCredential(null)}
            onCancel={() => setCredential(null)}
            okText="我已保存"
            cancelButtonProps={{ style: { display: 'none' } }}
            maskClosable={false}
            destroyOnClose
          >
            <p>登录账号：<strong>{credential?.username}</strong></p>
            <p>初始密码：<strong>{credential?.password}</strong></p>
            <p>请妥善保存并安全告知员工；关闭后无法再次查看，只能重置密码。</p>
          </Modal>
        </>
      )}

      <Modal
        title={deleteStep === 1 ? '删除员工' : '再次确认删除'}
        open={!!deleteTarget}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        okText={deleteStep === 1 ? '继续' : '确认删除'}
        cancelText={deleteStep === 1 ? '取消' : '返回'}
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
        maskClosable={false}
      >
        {deleteStep === 1 ? (
          <div>
            删除员工「<strong>{deleteTarget?.name}</strong>」将
            <strong>同步删除其登录账号</strong>
            ，删除后该账号将无法再登录系统，相关数据不可恢复。请确认是否继续？
          </div>
        ) : (
          <div>
            您即将永久删除员工「<strong>{deleteTarget?.name}</strong>」及其登录账号，
            此操作<strong>不可撤销</strong>。请再次确认是否删除？
          </div>
        )}
      </Modal>
    </div>
  );
}
