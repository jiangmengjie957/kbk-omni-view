import { useState } from 'react';
import { Modal, Form, Input, message, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { changePassword } from '../../api/auth';
import { getAuthState, setAuthState } from '../../hooks/useAuth';

interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function validatePasswordRule(_rule: unknown, value: string) {
  if (!value) return Promise.resolve();
  const lengthOk = value.length >= 8 && value.length <= 16;
  let classes = 0;
  if (/[a-z]/.test(value)) classes++;
  if (/[A-Z]/.test(value)) classes++;
  if (/[0-9]/.test(value)) classes++;
  if (/[^a-zA-Z0-9]/.test(value)) classes++;
  if (!lengthOk || classes < 3) {
    return Promise.reject(
      new Error('8-16 位，且至少包含大写、小写、数字、特殊字符中的三类')
    );
  }
  return Promise.resolve();
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [form] = Form.useForm<ChangePasswordForm>();
  const [submitting, setSubmitting] = useState(false);

  async function handleFinish(values: ChangePasswordForm) {
    setSubmitting(true);
    try {
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      const state = getAuthState();
      if (state) {
        setAuthState({ ...state, mustChangePassword: false });
      }
      void message.success('密码修改成功');
      form.resetFields();
      onClose();
    } catch {
      // 错误已在公共请求层（client.ts）统一提示
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="请修改初始密码"
      okText="确认修改"
      cancelText="稍后再说"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={submitting}
      maskClosable={false}
    >
      <Alert
        type="warning"
        showIcon
        message="出于安全考虑，首次登录需修改初始密码"
        style={{ marginBottom: 16 }}
      />
      <Form form={form} onFinish={handleFinish} layout="vertical">
        <Form.Item
          name="oldPassword"
          label="旧密码"
          rules={[{ required: true, message: '请输入旧密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="旧密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { validator: validatePasswordRule },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="新密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_rule, value: string) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="确认新密码"
            autoComplete="new-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
