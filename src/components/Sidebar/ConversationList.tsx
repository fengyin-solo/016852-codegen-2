import { useEffect, useRef } from 'react';
import { Button, Empty, Input, Pagination } from 'antd';
import {
  InboxOutlined,
  SearchOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { Conversation } from '../../types';
import { ConversationItem } from './ConversationItem';
import {
  useConversationSearch,
  SEARCH_PAGE_SIZE,
} from '../../hooks/useConversationSearch';
import './ConversationList.css';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * 对话列表组件
 *
 * 支持按标题与最近一条消息检索、按更新时间排序、命中片段高亮与分页；
 * 检索不到或请求失败时给出明确说明并提供重试入口。
 * 翻页与检索都不会改动当前选中项；检索状态下新建/删除对话会自动刷新结果，
 * 每页的滚动位置单独记忆，翻回来时仍停在原处。
 */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  const {
    inputValue,
    setInputValue,
    isSearching,
    status,
    isLoadingResults,
    errorMessage,
    total,
    page,
    setPage,
    pagedHits,
    retry,
    clearQuery,
  } = useConversationSearch({ conversations });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 每个检索关键词下、每一页的滚动位置
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousPageRef = useRef(page);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const scrollPositionKey = () =>
    `${isSearching ? inputValue.trim() : ''}:${page}`;

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    scrollPositionsRef.current.set(scrollPositionKey(), container.scrollTop);
  };

  // 页码变化：翻到新页回到顶部，翻回看过的页恢复到之前的位置；
  // 每次渲染后校准，也能兼容删除等操作导致的页码收敛。
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (previousPageRef.current === page) return;

    const saved = scrollPositionsRef.current.get(scrollPositionKey());
    container.scrollTop = saved ?? 0;
    previousPageRef.current = page;
  });

  const renderContent = () => {
    if (status === 'idle' || isLoadingResults) {
      return (
        <div className="conversation-list-message conversation-list-loading">
          <span className="conversation-list-loading-text">
            {isSearching ? '检索中…' : '加载中…'}
          </span>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="conversation-list-message conversation-list-error">
          <CloseCircleOutlined className="conversation-list-error-icon" />
          <span className="conversation-list-error-text">
            {errorMessage || '检索失败，请稍后重试'}
          </span>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={retry}
          >
            重试
          </Button>
        </div>
      );
    }

    if (total === 0) {
      return (
        <div className="conversation-list-empty">
          {isSearching ? (
            <Empty
              image={
                <SearchOutlined
                  style={{ fontSize: 32, color: 'var(--color-text-tertiary)' }}
                />
              }
              description={<span>未找到与「{inputValue.trim()}」相关的对话</span>}
              imageStyle={{ height: 40 }}
            >
              <Button type="link" size="small" onClick={clearQuery}>
                清空检索条件
              </Button>
            </Empty>
          ) : (
            <Empty
              image={
                <InboxOutlined
                  style={{ fontSize: 32, color: 'var(--color-text-tertiary)' }}
                />
              }
              description="暂无对话"
              imageStyle={{ height: 40 }}
            />
          )}
        </div>
      );
    }

    return (
      <>
        <div
          className="conversation-list"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {pagedHits.map((hit) => (
            <ConversationItem
              key={hit.conversation.id}
              conversation={hit.conversation}
              isActive={hit.conversation.id === activeId}
              onSelect={onSelect}
              onDelete={onDelete}
              titleRanges={isSearching ? hit.titleRanges : []}
              previewText={isSearching ? hit.previewText : undefined}
              previewRanges={isSearching ? hit.previewRanges : []}
            />
          ))}
        </div>

        {total > SEARCH_PAGE_SIZE && (
          <div className="conversation-list-pagination">
            <Pagination
              simple
              size="small"
              current={page}
              pageSize={SEARCH_PAGE_SIZE}
              total={total}
              onChange={handlePageChange}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="conversation-list-wrapper">
      <div className="conversation-search">
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined />}
          suffix={status === 'loading' ? <LoadingOutlined /> : undefined}
          placeholder="搜索标题或最近一条内容"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        {isSearching && status === 'success' && (
          <div className="conversation-search-meta">命中 {total} 个对话</div>
        )}
      </div>
      {renderContent()}
    </div>
  );
}
