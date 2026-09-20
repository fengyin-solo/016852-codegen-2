import { Button, Empty, Pagination, Spin } from 'antd';
import {
  InboxOutlined,
  SearchOutlined,
  ReloadOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { ConversationDisplay } from '../../utils/conversationSearch';
import { CONVERSATION_PAGE_SIZE } from '../../utils/conversationSearch';
import { useUIStore } from '../../stores/uiStore';
import type { ConversationSearchStatus } from '../../hooks/useConversationSearch';
import { ConversationItem } from './ConversationItem';
import './ConversationList.css';

interface ConversationListProps {
  /** 当前页的展示数据（含高亮区间） */
  items: ConversationDisplay[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** 检索请求状态 */
  status: ConversationSearchStatus;
  /** 失败说明 */
  errorMessage: string | null;
  /** 失败后重试 */
  onRetry: () => void;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 总页数 */
  totalPages: number;
  /** 命中总数 */
  total: number;
  /** 翻页 */
  onPageChange: (page: number) => void;
  /** 是否处于检索状态 */
  isSearching: boolean;
  /** 全部对话数量（检索状态之外的空态判断） */
  conversationCount: number;
  /** 选中的对话命中但不在当前页 */
  isActiveOffPage: boolean;
  /** 翻到选中对话所在页 */
  onLocateActive: () => void;
  /** 清空检索 */
  onClearSearch: () => void;
}

/**
 * 对话列表组件：负责检索结果的分页展示、状态说明（加载/失败/空），
 * 选中高亮与删除行为保持不变。
 */
export function ConversationList({
  items,
  activeId,
  onSelect,
  onDelete,
  status,
  errorMessage,
  onRetry,
  page,
  totalPages,
  total,
  onPageChange,
  isSearching,
  conversationCount,
  isActiveOffPage,
  onLocateActive,
  onClearSearch,
}: ConversationListProps) {
  const isMobile = useUIStore((state) => state.isMobile);

  // 请求失败：给出明确说明并提供"再试一遍"
  if (status === 'error') {
    return (
      <div className="conversation-list-feedback conversation-list-error">
        <p className="conversation-feedback-title">检索失败</p>
        <p className="conversation-feedback-desc">
          {errorMessage ?? '检索请求失败，请稍后重试'}
        </p>
        <Button
          type="primary"
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRetry}
        >
          再试一遍
        </Button>
      </div>
    );
  }

  // 首次加载（没有可展示的旧结果）
  if (status === 'loading' && items.length === 0) {
    return (
      <div className="conversation-list-feedback">
        <Spin size="small" />
        <span className="conversation-feedback-desc">
          {isSearching ? '正在检索对话…' : '正在加载对话…'}
        </span>
      </div>
    );
  }

  // 空态：区分"本来就没有对话"与"检索不到"
  if (items.length === 0) {
    if (isSearching) {
      return (
        <div className="conversation-list-empty">
          <Empty
            image={
              <SearchOutlined
                style={{ fontSize: 32, color: 'var(--color-text-tertiary)' }}
              />
            }
            imageStyle={{ height: 40 }}
            description={
              <span className="conversation-list-empty-text">
                没有找到匹配的对话
              </span>
            }
          >
            <Button type="link" size="small" onClick={onClearSearch}>
              清空检索条件
            </Button>
          </Empty>
        </div>
      );
    }

    if (conversationCount === 0) {
      return (
        <div className="conversation-list-empty">
          <Empty
            image={
              <InboxOutlined
                style={{ fontSize: 32, color: 'var(--color-text-tertiary)' }}
              />
            }
            imageStyle={{ height: 40 }}
            description={
              <span className="conversation-list-empty-text">暂无对话</span>
            }
          />
        </div>
      );
    }
  }

  return (
    <div
      className={`conversation-list ${status === 'loading' ? 'is-loading' : ''}`}
    >
      {items.map(({ conversation, displayTitle, displayPreview, titleMatches, previewMatches }) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          displayTitle={displayTitle}
          displayPreview={displayPreview}
          titleMatches={titleMatches}
          previewMatches={previewMatches}
        />
      ))}

      {isActiveOffPage && (
        <Button
          block
          type="dashed"
          size="small"
          icon={<AimOutlined />}
          className="conversation-locate-button"
          onClick={onLocateActive}
        >
          当前选中的对话在其他页，点此返回
        </Button>
      )}

      {totalPages > 1 && (
        <div className="conversation-pagination">
          <Pagination
            current={page}
            total={total}
            pageSize={CONVERSATION_PAGE_SIZE}
            size="small"
            simple={isMobile}
            showSizeChanger={false}
            onChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
