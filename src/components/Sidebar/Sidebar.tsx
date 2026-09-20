
import { Button, Tooltip } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { ConversationList } from './ConversationList';
import { SearchBar } from './SearchBar';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useConversationSearchStore } from '../../stores/conversationSearchStore';
import { useConversationSearch } from '../../hooks/useConversationSearch';
import './Sidebar.css';

/**
 * 侧边栏组件
 */
export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useChatStore();

  const { setConfigPanelVisible, setMobileDrawerOpen } = useUIStore();

  const {
    query,
    setQuery,
    resetQuery,
    setPage,
  } = useConversationSearchStore();

  const {
    status,
    errorMessage,
    pagedItems,
    total,
    page: currentPage,
    totalPages,
    isSearching,
    isActiveOffPage,
    locateActive,
    retry,
  } = useConversationSearch();

  const handleNewConversation = () => {
    // 检索状态下新建对话：立即退出检索并回到第一页，
    // 保证新对话立刻出现在列表里并保持选中
    resetQuery();
    createConversation();
    setMobileDrawerOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setMobileDrawerOpen(false);
  };

  const handleOpenSettings = () => {
    setConfigPanelVisible(true);
  };

  return (
    <div className="sidebar glass-card">
      <div className="sidebar-header">
        <h2 className="sidebar-title">对话历史</h2>
        <div className="sidebar-actions">
          <Tooltip title="设置">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={handleOpenSettings}
            />
          </Tooltip>
        </div>
      </div>

      <div className="sidebar-new">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          block
        >
          新建对话
        </Button>
      </div>

      <div className="sidebar-search">
        <SearchBar value={query} onChange={setQuery} loading={status === 'loading'} />
      </div>

      <div className="sidebar-content">
        <ConversationList
          items={pagedItems}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onDelete={deleteConversation}
          status={status}
          errorMessage={errorMessage}
          onRetry={retry}
          page={currentPage}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          isSearching={isSearching}
          conversationCount={conversations.length}
          isActiveOffPage={isActiveOffPage}
          onLocateActive={locateActive}
          onClearSearch={resetQuery}
        />
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          {isSearching
            ? `命中 ${total} / 共 ${conversations.length} 个对话`
            : `共 ${conversations.length} 个对话`}
        </span>
      </div>
    </div>
  );
}
