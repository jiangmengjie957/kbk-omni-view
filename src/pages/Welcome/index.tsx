import { Result } from 'antd';
import { SmileOutlined } from '@ant-design/icons';

export default function Welcome() {
  return (
    <Result
      icon={<SmileOutlined />}
      title="欢迎使用 KBK 后台管理中心"
      subTitle="请从左侧菜单选择功能模块"
    />
  );
}
