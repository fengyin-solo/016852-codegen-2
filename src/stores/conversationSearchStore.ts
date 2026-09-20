import { create } from 'zustand';

interface ConversationSearchState {
  /** 检索输入框的原始内容 */
  query: string;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 设置检索词；检索词变化时回到第一页 */
  setQuery: (query: string) => void;
  /** 清空检索并回到第一页 */
  resetQuery: () => void;
  /** 切换页码 */
  setPage: (page: number) => void;
}

/**
 * 对话列表检索的 UI 状态。
 * 放在独立 store 中而非组件局部状态：桌面侧边栏与移动端抽屉会分别挂载
 * Sidebar 实例，独立 store 可以保证检索词与页码在二者之间保持一致。
 */
export const useConversationSearchStore = create<ConversationSearchState>((set) => ({
  query: '',
  page: 1,

  setQuery: (query) => set({ query, page: 1 }),
  resetQuery: () => set({ query: '', page: 1 }),
  setPage: (page) => set({ page: Math.max(1, page) }),
}));
