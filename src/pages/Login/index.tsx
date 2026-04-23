import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AUTH_USERNAME, AUTH_PASSWORD } from '../../config/auth';
import { setAuthState } from '../../hooks/useAuth';
import styles from './Login.module.scss';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  function handleFinish({ username, password }: LoginFormValues) {
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      setAuthState();
      void navigate('/admin', { replace: true });
    } else {
      void messageApi.error('账号或密码错误，请重试');
    }
  }

  return (
    <div className={styles.page}>
      {contextHolder}

      <div className={`${styles.bgCircle} ${styles['bgCircle--top']}`} />
      <div className={`${styles.bgCircle} ${styles['bgCircle--bottom']}`} />

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={styles.card}
      >
        <div className={styles.header}>
          <div className={styles.logoBox}>K</div>
          <Title level={3} className={styles.title}>
            KBK 后台管理中心
          </Title>
          <Text type="secondary" className={styles.subtitle}>
            请使用管理员账号登录
          </Text>
        </div>

        <Form
          form={form}
          onFinish={handleFinish}
          layout="vertical"
          size="large"
          className={styles.form}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item className={styles.formFooterItem}>
            <Button
              type="primary"
              htmlType="submit"
              block
              className={styles.submitBtn}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </motion.div>
    </div>
  );
}
