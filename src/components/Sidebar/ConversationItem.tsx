import React, { memo, useState } from 'react';
import { Button, Popconfirm } from 'antd';
import { MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Conversation } from '../../types';
import { formatRelativeTime, truncateText } from '../../utils/formatters';
import { HighlightText, type HighlightRange } from '../Common/HighlightText';
import './ConversationItem.css';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** 标题命中区间（检索状态下传入，基于截断后的展示标题） */
  titleRanges?: HighlightRange[];
  /** 最近一条消息预览文本（检索状态下传入命中片段，未传入时沿用原截断逻辑） */
  previewText?: string;
  /** 预览命中区间 */
  previewRanges?: HighlightRange[];
}

/**
 * 对话项组件
 */
export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  titleRanges,
  previewText,
  previewRanges,
}: ConversationItemProps) {
  const [showActions, setShowActions] = useState(false);

  const handleClick = () => {
    onSelect(conversation.id);
  };

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onDelete(conversation.id);
  };

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const fallbackPreview = lastMessage
    ? truncateText(lastMessage.content, 50)
    : '暂无消息';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="conversation-icon">
        <MessageOutlined />
      </div>

      <div className="conversation-content">
        <div className="conversation-title">
          <HighlightText
            text={truncateText(conversation.title, 20)}
            ranges={titleRanges}
          />
        </div>
        <div className="conversation-preview">
          <HighlightText
            text={previewText ?? fallbackPreview}
            ranges={previewRanges}
          />
        </div>
        <div className="conversation-time">
          {formatRelativeTime(conversation.updatedAt)}
        </div>
      </div>

      <div className={`conversation-actions ${showActions ? 'visible' : ''}`}>
        <Popconfirm
          title="删除对话"
          description="确定要删除这个对话吗？"
          onConfirm={handleDelete}
          okText="删除"
          cancelText="取消"
          placement="right"
        >
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      </div>
    </div>
  );
});
