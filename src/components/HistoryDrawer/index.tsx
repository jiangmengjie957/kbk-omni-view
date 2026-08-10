import { useEffect, useState, useCallback } from 'react';
import { Drawer, Button, Checkbox, List, Empty, Modal, Tag, message, Tooltip, Spin } from 'antd';
import { EyeOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listHistoryByType,
  deleteHistoryRecords,
  clearHistoryByType,
  type HistoryRecord,
  type HistoryType,
} from '../../utils/historyDb';
import styles from './HistoryDrawer.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  type: HistoryType;
  onSelect: (record: HistoryRecord) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function downloadFile(record: HistoryRecord) {
  if (!record.fileBinary || record.fileBinary.byteLength === 0) {
    void message.warning('原始文件不可用');
    return;
  }
  const blob = new Blob([record.fileBinary], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = record.fileName || 'history.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function HistoryDrawer({ open, onClose, type, onSelect }: Props) {
  const [messageApi, contextHolder] = message.useMessage();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listHistoryByType(type);
      setRecords(list);
    } catch (err) {
      console.error('[history] 加载列表失败:', err);
      void messageApi.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, [type, messageApi]);

  useEffect(() => {
    if (open) {
      void loadRecords();
      setSelectedIds(new Set());
    }
  }, [open, loadRecords]);

  const allChecked = records.length > 0 && selectedIds.size === records.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < records.length;

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(records.map(r => r.id!).filter(Boolean)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleToggle(id: number, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Modal.confirm({
      title: '确认删除',
      content: `将删除 ${ids.length} 条记录，不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteHistoryRecords(ids);
        void messageApi.success(`已删除 ${ids.length} 条记录`);
        setSelectedIds(new Set());
        await loadRecords();
      },
    });
  }

  async function handleClearAll() {
    if (records.length === 0) return;
    Modal.confirm({
      title: '清空全部历史',
      content: `将删除全部 ${records.length} 条 ${type === 'perf-stats' ? '绩效统计' : '消课表'} 历史记录，不可恢复。`,
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await clearHistoryByType(type);
        void messageApi.success('已清空全部历史记录');
        setSelectedIds(new Set());
        await loadRecords();
      },
    });
  }

  function handleView(record: HistoryRecord) {
    onSelect(record);
    onClose();
  }

  return (
    <Drawer
      title="历史记录"
      open={open}
      onClose={onClose}
      width={520}
      className={styles.drawer}
      destroyOnClose
    >
      {contextHolder}

      <div className={styles.toolbar}>
        <Checkbox
          className={styles.selectAll}
          checked={allChecked}
          indeterminate={someChecked}
          onChange={e => handleSelectAll(e.target.checked)}
          disabled={records.length === 0}
        >
          全选
        </Checkbox>
        <Tooltip title={selectedIds.size === 0 ? '请先勾选记录' : ''}>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            删除选中 ({selectedIds.size})
          </Button>
        </Tooltip>
        <Button
          size="small"
          danger
          onClick={handleClearAll}
          disabled={records.length === 0}
        >
          清空全部
        </Button>
      </div>

      {loading ? (
        <div className={styles.emptyWrap}>
          <Spin />
        </div>
      ) : records.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty description="暂无历史记录" />
        </div>
      ) : (
        <div className={styles.listWrap}>
          <List
            dataSource={records}
            renderItem={(record) => {
              const id = record.id!;
              const checked = selectedIds.has(id);
              return (
                <div className={styles.recordItem} key={id}>
                  <Checkbox
                    className={styles.recordCheck}
                    checked={checked}
                    onChange={e => handleToggle(id, e.target.checked)}
                  />
                  <div className={styles.recordMain}>
                    <div className={styles.recordHeader}>
                      <Tooltip title={record.fileName}>
                        <span className={styles.fileName}>{record.fileName}</span>
                      </Tooltip>
                      <span className={styles.recordTime}>{formatTime(record.createdAt)}</span>
                    </div>
                    <div className={styles.recordMeta}>
                      <Tag color="blue">有效 {record.validCount}</Tag>
                      {record.invalidCount > 0 && (
                        <Tag color="orange">异常 {record.invalidCount}</Tag>
                      )}
                      {record.targetMonth && (
                        <Tag color="purple">
                          {record.targetMonth.year}年{record.targetMonth.month}月
                        </Tag>
                      )}
                      <span style={{ color: '#bbb' }}>
                        {(record.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <Tooltip title="查看">
                      <Button
                        size="small"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handleView(record)}
                      />
                    </Tooltip>
                    <Tooltip title="下载原始文件">
                      <Button
                        size="small"
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={() => downloadFile(record)}
                        disabled={!record.fileBinary || record.fileBinary.byteLength === 0}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
    </Drawer>
  );
}
