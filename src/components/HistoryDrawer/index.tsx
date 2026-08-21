import { useEffect, useState, useCallback } from 'react';
import { Drawer, Button, Checkbox, List, Empty, Modal, Tabs, Tag, message, Tooltip, Spin } from 'antd';
import { EyeOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listHistoryByType,
  deleteHistoryRecords,
  clearHistoryByType,
  type HistoryRecord,
  type HistoryType,
} from '../../utils/historyDb';
import {
  listAllMonthlyRecords,
  deleteMonthlyRecords,
  clearAllMonthlyRecords,
} from '../../utils/persistentLessonDb';
import type { LessonMonthlyRecord } from '../../db';
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

// 长期单元的 key 就是 yearMonth（主键），直接用字符串作为 Set 元素
function longtermKey(r: LessonMonthlyRecord): string {
  return r.yearMonth;
}

export default function HistoryDrawer({ open, onClose, type, onSelect }: Props) {
  const [messageApi, messageContextHolder] = message.useMessage();
  // 用 Modal.useModal() hook 模式，避免命令式 Modal.confirm 被 Drawer 遮挡
  const [modal, modalContextHolder] = Modal.useModal();

  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // 长期消课单元状态（仅 lesson-cancel 类型使用）
  const [longtermRecords, setLongtermRecords] = useState<LessonMonthlyRecord[]>([]);
  const [selectedLongtermKeys, setSelectedLongtermKeys] = useState<Set<string>>(new Set());
  const [longtermLoading, setLongtermLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'longterm'>('history');

  const isLessonCancel = type === 'lesson-cancel';

  // ── 加载上传历史 ──────────────────────────────────────────
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

  // ── 加载长期消课单元 ──────────────────────────────────────
  const loadLongtermRecords = useCallback(async () => {
    setLongtermLoading(true);
    try {
      const list = await listAllMonthlyRecords();
      // 按 savedAt 降序（最近保存的在前）
      list.sort((a, b) => b.savedAt - a.savedAt);
      setLongtermRecords(list);
    } catch (err) {
      console.error('[history] 加载长期单元失败:', err);
      void messageApi.error('加载长期消课单元失败');
    } finally {
      setLongtermLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    if (open) {
      void loadRecords();
      setSelectedIds(new Set());
      if (isLessonCancel) {
        void loadLongtermRecords();
        setSelectedLongtermKeys(new Set());
      }
    }
  }, [open, loadRecords, loadLongtermRecords, isLessonCancel]);

  // ── 上传历史：全选/勾选 ────────────────────────────────────
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

  // ── 上传历史：删除选中（用 hook modal 避免 Drawer 遮挡）─────
  function handleDeleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    modal.confirm({
      title: '确认删除',
      content: `将删除 ${ids.length} 条上传历史记录，不可恢复。`,
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

  // ── 上传历史：清空全部 ──────────────────────────────────────
  function handleClearAll() {
    if (records.length === 0) return;
    modal.confirm({
      title: '清空全部上传历史',
      content: `将删除全部 ${records.length} 条 ${type === 'perf-stats' ? '绩效统计' : '消课表'} 上传历史，不可恢复。长期消课单元不受影响。`,
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await clearHistoryByType(type);
        void messageApi.success('已清空全部上传历史');
        setSelectedIds(new Set());
        await loadRecords();
      },
    });
  }

  function handleView(record: HistoryRecord) {
    onSelect(record);
    onClose();
  }

  // ── 长期单元：全选/勾选 ────────────────────────────────────
  const allLongtermChecked =
    longtermRecords.length > 0 && selectedLongtermKeys.size === longtermRecords.length;
  const someLongtermChecked =
    selectedLongtermKeys.size > 0 && selectedLongtermKeys.size < longtermRecords.length;

  function handleLongtermSelectAll(checked: boolean) {
    if (checked) {
      setSelectedLongtermKeys(new Set(longtermRecords.map(longtermKey)));
    } else {
      setSelectedLongtermKeys(new Set());
    }
  }

  function handleLongtermToggle(key: string, checked: boolean) {
    setSelectedLongtermKeys(prev => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // ── 长期单元：删除选中（按 yearMonth 主键）─────────────────
  function handleDeleteLongtermSelected() {
    const keys = [...selectedLongtermKeys];
    if (keys.length === 0) return;
    modal.confirm({
      title: '确认删除长期单元',
      content: `将删除 ${keys.length} 个月度消课单元，不可恢复。上传历史不受影响。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteMonthlyRecords(keys);
        void messageApi.success(`已删除 ${keys.length} 个月度单元`);
        setSelectedLongtermKeys(new Set());
        await loadLongtermRecords();
      },
    });
  }

  // ── 长期单元：清空全部 ─────────────────────────────────────
  function handleClearAllLongterm() {
    if (longtermRecords.length === 0) return;
    modal.confirm({
      title: '清空全部长期消课单元',
      content: `将删除全部 ${longtermRecords.length} 条长期消课单元（不过期存储），不可恢复。上传历史不受影响。`,
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await clearAllMonthlyRecords();
        void messageApi.success('已清空全部长期消课单元');
        setSelectedLongtermKeys(new Set());
        await loadLongtermRecords();
      },
    });
  }

  // ── 渲染上传历史列表 ───────────────────────────────────────
  function renderHistoryList() {
    return (
      <>
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
            <Empty description="暂无上传历史" />
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
      </>
    );
  }

  // ── 渲染长期消课单元列表 ───────────────────────────────────
  function renderLongtermList() {
    return (
      <>
        <div className={styles.toolbar}>
          <Checkbox
            className={styles.selectAll}
            checked={allLongtermChecked}
            indeterminate={someLongtermChecked}
            onChange={e => handleLongtermSelectAll(e.target.checked)}
            disabled={longtermRecords.length === 0}
          >
            全选
          </Checkbox>
          <Tooltip title={selectedLongtermKeys.size === 0 ? '请先勾选记录' : ''}>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleDeleteLongtermSelected}
              disabled={selectedLongtermKeys.size === 0}
            >
              删除选中 ({selectedLongtermKeys.size})
            </Button>
          </Tooltip>
          <Button
            size="small"
            danger
            onClick={handleClearAllLongterm}
            disabled={longtermRecords.length === 0}
          >
            清空全部
          </Button>
        </div>

        {longtermLoading ? (
          <div className={styles.emptyWrap}>
            <Spin />
          </div>
        ) : longtermRecords.length === 0 ? (
          <div className={styles.emptyWrap}>
            <Empty description="暂无长期消课单元（在消课表页面点'保存到长期存储'后此处可见）" />
          </div>
        ) : (
          <div className={styles.listWrap}>
            <List
              dataSource={longtermRecords}
              renderItem={(record) => {
                const key = longtermKey(record);
                const checked = selectedLongtermKeys.has(key);
                const studentCount = record.students.length;
                const dayCount = record.students.reduce(
                  (sum, s) => sum + Object.keys(s.dayMap).length,
                  0,
                );
                return (
                  <div className={styles.recordItem} key={key}>
                    <Checkbox
                      className={styles.recordCheck}
                      checked={checked}
                      onChange={e => handleLongtermToggle(key, e.target.checked)}
                    />
                    <div className={styles.recordMain}>
                      <div className={styles.recordHeader}>
                        <span className={styles.fileName}>{record.yearMonth}</span>
                        <span className={styles.recordTime}>{formatTime(record.savedAt)}</span>
                      </div>
                      <div className={styles.recordMeta}>
                        <Tag color="cyan">{record.yearMonth}</Tag>
                        <Tag color="blue">{studentCount} 位学生</Tag>
                        <Tag color="green">共 {record.total} 节</Tag>
                        <span style={{ color: '#bbb' }}>
                          {dayCount} 条明细
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        )}
      </>
    );
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
      {messageContextHolder}
      {modalContextHolder}

      {isLessonCancel ? (
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'history' | 'longterm')}
          items={[
            {
              key: 'history',
              label: `上传历史 (${records.length})`,
              children: renderHistoryList(),
            },
            {
              key: 'longterm',
              label: `长期消课单元 (${longtermRecords.length})`,
              children: renderLongtermList(),
            },
          ]}
        />
      ) : (
        renderHistoryList()
      )}
    </Drawer>
  );
}
