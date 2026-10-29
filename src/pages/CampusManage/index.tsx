import { useEffect, useState } from 'react';
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
import { campusApi } from '../../api/basicData';
import type { CampusInput } from '../../api/basicData';
import type { Campus } from '../../types/basicData';
import { CAMPUS_STATUS_OPTIONS } from '../../types/basicData';
import ImportExcelButton from '../../components/ImportExcelButton';
import styles from '../BasicData.module.scss';

const { Title } = Typography;

const TEMPLATE_HEADERS = ['名称', '地址', '联系电话', '状态', '备注'];
const TEMPLATE_EXAMPLES = [['宝杨路校区', '上海市宝山区', '021-12345678', '启用', '']];

function mapStatus(text: string): 1 | 0 {
  return text === '停用' ? 0 : 1;
}

export default function CampusManage() {
  const [list, setList] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campus | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CampusInput>();

  async function refresh() {
    setLoading(true);
    try {
      setList(await campusApi.list());
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

  function openEdit(record: Campus) {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await campusApi.update(editing.id, values);
        message.success('已更新');
      } else {
        await campusApi.create(values);
        message.success('已新增');
      }
      setModalOpen(false);
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await campusApi.remove(id);
    message.success('已删除');
    void refresh();
  }

  async function handleImport(rows: Record<string, string>[]) {
    const items: CampusInput[] = [];
    const errors: string[] = [];
    rows.forEach((row, idx) => {
      const name = (row['名称'] ?? '').trim();
      if (!name) {
        errors.push(`第 ${idx + 2} 行：名称为空`);
        return;
      }
      items.push({
        name,
        address: (row['地址'] ?? '').trim(),
        phone: (row['联系电话'] ?? '').trim(),
        status: mapStatus((row['状态'] ?? '').trim()),
        remark: (row['备注'] ?? '').trim(),
      });
    });
    if (items.length) await campusApi.batchCreate(items);
    return { success: items.length, failed: errors.length, errors };
  }

  const columns: TableColumnsType<Campus> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '地址', dataIndex: 'address', key: 'address', render: (v: string) => v || '-' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: Campus['status']) =>
        v === 1 ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
    },
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
          <Popconfirm title="确定删除该校区吗？" onConfirm={() => handleDelete(record.id)}>
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
          校区管理
        </Title>
        {/* 校区暂不支持新增/导入：当前仅一个校区（宝杨路），多校区上线后开放 */}
        <div className={styles.toolbar}>
          <ImportExcelButton
            title="校区"
            templateFilename="校区导入模板.xlsx"
            headers={TEMPLATE_HEADERS}
            examples={TEMPLATE_EXAMPLES}
            onImport={handleImport}
            disabled
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled>
            新增校区
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <Table<Campus>
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
        title={editing ? '编辑校区' : '新增校区'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：宝杨路校区" maxLength={50} />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="校区地址" maxLength={200} />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="联系电话" maxLength={30} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[...CAMPUS_STATUS_OPTIONS]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="备注" rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
