import { Modal, Table, Divider } from 'antd';
import type { TableColumnsType } from 'antd';
import styles from './CalcRules.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── 价格表数据 ────────────────────────────────────────────────

interface PriceRow {
  grade: string;
  v1: number;
  vn1: number;
  vn2: number;
  vn3: number;
}

const priceData: PriceRow[] = [
  { grade: '3–5 年级', v1: 160, vn1: 80,  vn2: 160, vn3: 200 },
  { grade: '6–8 年级', v1: 160, vn1: 100, vn2: 160, vn3: 200 },
  { grade: '初三',     v1: 180, vn1: 120, vn2: 180, vn3: 220 },
  { grade: '高一 / 二', v1: 180, vn1: 120, vn2: 180, vn3: 220 },
  { grade: '高三',     v1: 220, vn1: 140, vn2: 220, vn3: 240 },
];

const priceColumns: TableColumnsType<PriceRow> = [
  { title: '年级', dataIndex: 'grade', key: 'grade', width: 90 },
  { title: '一对一', dataIndex: 'v1',  key: 'v1',  width: 72, align: 'center', render: v => `¥${v}` },
  { title: '一对多 · 1 人', dataIndex: 'vn1', key: 'vn1', width: 100, align: 'center', render: v => `¥${v}` },
  { title: '一对多 · 2 人', dataIndex: 'vn2', key: 'vn2', width: 100, align: 'center', render: v => `¥${v}` },
  { title: '一对多 · 3 人', dataIndex: 'vn3', key: 'vn3', width: 100, align: 'center',
    render: v => <span className={styles.highlight}>¥{v}</span> },
];

// ── 阶梯系数数据 ──────────────────────────────────────────────

interface MultiplierRow {
  range: string;
  value: string;
  note: string;
}

const multiplierData: MultiplierRow[] = [
  { range: '≤ 50 次',    value: '× 1.00', note: '基础档' },
  { range: '51 – 60 次', value: '× 1.05', note: '+5%' },
  { range: '61 – 80 次', value: '× 1.10', note: '+10%' },
  { range: '81 – 100 次',value: '× 1.15', note: '+15%' },
  { range: '> 100 次',   value: '× 1.20', note: '+20%' },
];

const multiplierColumns: TableColumnsType<MultiplierRow> = [
  { title: '月课次区间', dataIndex: 'range', key: 'range' },
  { title: '阶梯系数',   dataIndex: 'value', key: 'value', align: 'center',
    render: v => <span className={styles.highlight}>{v}</span> },
  { title: '说明',       dataIndex: 'note',  key: 'note', align: 'center' },
];

// ── 组件 ─────────────────────────────────────────────────────

export default function CalcRulesModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="知道了"
      cancelButtonProps={{ style: { display: 'none' } }}
      title="课时费计算规则"
      width={600}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 } }}
    >
      <div className={styles.modalContent}>

        {/* 1. 基础价格表 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>基础单价表（标准 2 小时）</div>
          <Table
            className={styles.priceTable}
            columns={priceColumns}
            dataSource={priceData}
            rowKey="grade"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
          <div className={styles.tip}>
            ▸ <strong>4 人及以上</strong>：在 3 人价格基础上，每增加 1 人 <strong>+¥45</strong>。
            <br />
            例：6–8 年级 4 人 = ¥200 + 1 × ¥45 = <strong>¥245</strong>
          </div>
        </div>

        <Divider style={{ margin: '0' }} />

        {/* 2. 阶梯系数 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>月课次阶梯系数</div>
          <Table
            className={styles.multiplierTable}
            columns={multiplierColumns}
            dataSource={multiplierData}
            rowKey="range"
            size="small"
            pagination={false}
          />
          <div className={styles.tip}>
            ▸ 系数按该老师<strong>当月全部课次合计</strong>确定，同一老师所有课次使用同一系数。
          </div>
        </div>

        <Divider style={{ margin: '0' }} />

        {/* 3. 时长比例 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>课时时长比例</div>
          <div className={styles.tip}>
            ▸ 以上所有价格均为 <strong>2 小时标准课时</strong> 单价。<br />
            ▸ 实际时长不足或超过 2 小时时，按比例换算：
            <strong> 时长比例 = 实际时长（小时）÷ 2</strong>
            <br />
            例：1.5 小时的课 → 时长比例 = 75%；3 小时的课 → 时长比例 = 150%
          </div>
        </div>

        <Divider style={{ margin: '0' }} />

        {/* 4. 最终公式 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>最终计算公式</div>
          <div className={styles.formula}>
            <div className={styles.formulaRow}>
              <strong>本次课时费</strong> = 基础单价 × 阶梯系数 × 时长比例
            </div>
            <div className={styles.formulaRow}>
              <strong>月总课时费</strong> = Σ（该老师当月所有课次的课时费）
            </div>
          </div>
          <div className={styles.tip}>
            ▸ <strong>基础单价</strong>：按年级 + 班型 + 实际上课学生人数查上方价格表。<br />
            ▸ <strong>阶梯系数</strong>：按该老师当月课次总数查系数表（所有课次共用同一系数）。<br />
            ▸ <strong>时长比例</strong>：从时间列自动解析，精确到分钟。
          </div>
        </div>

      </div>
    </Modal>
  );
}
