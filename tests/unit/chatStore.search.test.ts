import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../src/stores';
import { saveConversations, loadConversations } from '../../src/services/storage';
import { searchConversations, paginate } from '../../src/utils/conversationSearch';
import type { Conversation } from '../../src/types';

function makeConversation(id: string, title: string, updatedAt: number): Conversation {
  return {
    id,
    title,
    messages: [],
    createdAt: updatedAt - 100,
    updatedAt,
  };
}

describe('chatStore 与检索列表联动', () => {
  beforeEach(() => {
    useChatStore.setState({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      streamingContent: '',
      streamingMessageId: null,
      initialized: true,
    });
  });

  it('检索状态下新建对话：结果列表立即包含新对话并排在首位', () => {
    const { createConversation } = useChatStore.getState();
    createConversation('旧的 React 对话');

    // 模拟当前处于检索 "react" 的状态
    let { conversations } = useChatStore.getState();
    let results = searchConversations(conversations, 'react');
    expect(results).toHaveLength(1);

    // 新建一个不含检索词的对话：检索结果不应包含它
    const newId = createConversation('全新对话');
    conversations = useChatStore.getState().conversations;
    results = searchConversations(conversations, 'react');
    expect(results.map((r) => r.conversation.id)).not.toContain(newId);

    // 清空检索（对应 Sidebar 的 resetQuery）后，新对话立刻出现在列表首位
    results = searchConversations(conversations, '');
    expect(results[0]?.conversation.id).toBe(newId);
    expect(useChatStore.getState().activeConversationId).toBe(newId);
  });

  it('检索状态下删除对话：结果立即收敛且总数变化', () => {
    const { createConversation, deleteConversation } = useChatStore.getState();
    const a = createConversation('React 一');
    const b = createConversation('React 二');

    let results = searchConversations(useChatStore.getState().conversations, 'react');
    expect(results).toHaveLength(2);

    deleteConversation(b);
    results = searchConversations(useChatStore.getState().conversations, 'react');
    expect(results).toHaveLength(1);
    expect(results[0]?.conversation.id).toBe(a);
  });

  it('删除当前选中对话后选中项切换到第一条，删除其他对话不影响选中', () => {
    const { createConversation, deleteConversation } = useChatStore.getState();
    const a = createConversation('对话 A'); // 最新，排在第一
    const b = createConversation('对话 B'); // 更新，排在第一
    void a;

    expect(useChatStore.getState().activeConversationId).toBe(b);

    // 删除非选中项 a，选中保持 b
    deleteConversation(a);
    expect(useChatStore.getState().activeConversationId).toBe(b);

    // 删除选中项 b，选中切换到剩余的第一条
    deleteConversation(b);
    expect(useChatStore.getState().activeConversationId).toBeNull();
  });

  it('删除最后一页的唯一项后页码自动收敛到最后一页', () => {
    const { createConversation, deleteConversation } = useChatStore.getState();
    // 造 21 个对话（都匹配检索词）
    const ids = Array.from({ length: 21 }, (_, i) =>
      createConversation(`React 对话 ${i}`),
    );

    let results = searchConversations(useChatStore.getState().conversations, 'react');
    let page = paginate(results, 2);
    expect(page.totalPages).toBe(2);
    expect(page.items).toHaveLength(1);

    // 删除第 2 页唯一的对话
    deleteConversation(ids[20]!);
    results = searchConversations(useChatStore.getState().conversations, 'react');
    page = paginate(results, 2);
    // 请求第 2 页时自动收敛为第 1 页
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(20);
  });

  it('刷新后从 localStorage 加载的次序与会话中的次序一致', () => {
    const { createConversation } = useChatStore.getState();
    // 创建顺序：旧 -> 新；用独立的会话数据，显式拉开 updatedAt，
    // 验证持久化往返后仍是"按更新时间降序"的同一次序
    const conversations: Conversation[] = [
      makeConversation('p1', '对话一', 1000),
      makeConversation('p2', '对话二', 2000),
      makeConversation('p3', '对话三', 3000),
    ];
    saveConversations(conversations);

    const reloaded = loadConversations();
    expect(reloaded.map((c) => c.id)).toEqual(['p3', 'p2', 'p1']);

    // createConversation 产出的新对话 updatedAt 最新，刷新前后都排在首位
    createConversation('对话一');
    createConversation('对话二');
    const newestId = createConversation('对话三');

    const inMemoryIds = useChatStore.getState().conversations.map((c) => c.id);
    saveConversations(useChatStore.getState().conversations);
    const afterReloadIds = loadConversations().map((c) => c.id);
    expect(afterReloadIds).toEqual(inMemoryIds);
    expect(afterReloadIds[0]).toBe(newestId);
  });
});
