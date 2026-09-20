import React, { memo, useState } from 'react';
import { Button, Popconfirm } from 'antd';
import { MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Conversation } from '../../types';
import { formatRelativeTime, truncateText } from '../../utils/formatters';
import type { MatchRange } from '../../utils/conversationSearch';
import { HighlightedText } from './HighlightedText';
import './ConversationItem.css';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** 截断后的标题（未提供时按原逻辑截断） */
  displayTitle?: string;
  /** 截断后的最近一条内容预览（未提供时按原逻辑计算） */
  displayPreview?: string;
  /** 标题命中区间 */
  titleMatches?: MatchRange[];
  /** 预览命中区间 */
  previewMatches?: MatchRange[];
}

/**
 * 对话项组件
 */
export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  displayTitle,
  displayPreview,
  titleMatches,
  previewMatches,
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
  const title = displayTitle ?? truncateText(conversation.title, 20);
  const previewText = lastMessage
    ? (displayPreview ?? truncateText(lastMessage.content, 50))
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
          <HighlightedText text={title} ranges={titleMatches ?? []} />
        </div>
        <div className="conversation-preview">
          {lastMessage ? (
            <HighlightedText text={previewText} ranges={previewMatches ?? []} />
          ) : (
            previewText
          )}
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
