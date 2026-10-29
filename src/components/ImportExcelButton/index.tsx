import { useState } from 'react';
import { Button, Modal, Upload, Typography, message } from 'antd';
import { UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { downloadTemplate, parseExcel } from '../../utils/excel';

const { Dragger } = Upload;
const { Text } = Typography;

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface ImportExcelButtonProps {
  // 导入对象名，用于弹窗标题，如「员工」
  title: string;
  templateFilename: string;
  headers: string[];
  examples?: (string | number)[][];
  buttonText?: string;
  disabled?: boolean;
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
}

export default function ImportExcelButton({
  title,
  templateFilename,
  headers,
  examples = [],
  buttonText = '导入',
  disabled = false,
  onImport,
}: ImportExcelButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function openModal() {
    setResult(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    try {
      const rows = await parseExcel(file);
      if (rows.length === 0) {
        message.warning('文件中没有可导入的数据');
        return;
      }
      const r = await onImport(rows);
      setResult(r);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button icon={<UploadOutlined />} onClick={openModal} disabled={disabled}>
        {buttonText}
      </Button>
      <Button
        icon={<DownloadOutlined />}
        onClick={() => downloadTemplate(templateFilename, headers, examples)}
        disabled={disabled}
      >
        下载模板
      </Button>

      <Modal
        title={`导入${title}`}
        open={open}
        onCancel={closeModal}
        maskClosable={false}
        footer={
          result
            ? [
                <Button key="done" type="primary" onClick={closeModal}>
                  完成
                </Button>,
              ]
            : null
        }
      >
        {result ? (
          <div>
            <p>
              成功导入 <b>{result.success}</b> 条
              {result.failed > 0 && (
                <>
                  ，失败 <b>{result.failed}</b> 条
                </>
              )}
            </p>
            {result.errors.length > 0 && (
              <>
                <Text type="danger">失败原因：</Text>
                <ul>
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <Dragger
              accept=".xlsx,.xls"
              maxCount={1}
              showUploadList={false}
              disabled={loading}
              beforeUpload={(file) => {
                void handleFile(file);
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 Excel 文件到此处上传</p>
              <p className="ant-upload-hint">支持 .xlsx / .xls，第一行为表头</p>
            </Dragger>
            <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
              模板列：{headers.join('、')}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
