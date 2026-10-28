import { useState } from 'react';
import { Form, Input, Button, message, Typography, Card } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../api/auth';
import { getAuthState, setAuthState } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';
import styles from './ChangePassword.module.scss';

const { Title, Text } = Typography;

interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
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

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ChangePasswordForm>();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);

  async function handleFinish(values: ChangePasswordForm) {
    setLoading(true);
    try {
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      const state = getAuthState();
      if (state) {
        setAuthState({ ...state, mustChangePassword: false });
      }
      void messageApi.success('密码修改成功');
      void navigate('/admin', { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '修改失败，请稍后重试';
      void messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {contextHolder}
      <Card className={styles.card}>
        <Title level={3}>修改初始密码</Title>
        <Text type="secondary">首次登录请设置新密码</Text>

        <Form
          form={form}
          onFinish={handleFinish}
          layout="vertical"
          size="large"
          className={styles.form}
        >
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

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
