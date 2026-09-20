import { Input, Tooltip, Button } from 'antd';
import { SearchOutlined, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
}

/**
 * 对话列表检索框：输入即检索，可一键清空。
 */
export function SearchBar({ value, onChange, loading }: SearchBarProps) {
  const suffix = loading ? (
    <LoadingOutlined style={{ color: 'var(--color-text-tertiary)' }} />
  ) : value ? (
    <Tooltip title="清空检索">
      <Button
        type="text"
        size="small"
        icon={<CloseCircleFilled />}
        onClick={() => onChange('')}
        className="search-clear-button"
      />
    </Tooltip>
  ) : null;

  return (
    <Input
      allowClear={false}
      prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
      suffix={suffix}
      placeholder="搜索标题或最近一条内容"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="conversation-search-input"
      aria-label="搜索对话"
    />
  );
}
