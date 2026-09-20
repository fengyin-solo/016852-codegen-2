import { useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useConversationSearchStore } from '../stores/conversationSearchStore';
import { runConversationSearch } from '../services/conversationSearchService';
import {
  CONVERSATION_PAGE_SIZE,
  paginate,
  type ConversationDisplay,
} from '../utils/conversationSearch';

/** 输入检索词时的防抖时间 */
const SEARCH_DEBOUNCE_MS = 250;
/** 对话数据变化（新建/删除/收到消息等）后的防抖时间 */
const CONVERSATION_CHANGE_DEBOUNCE_MS = 150;

export type ConversationSearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseConversationSearchResult {
  /** 当前请求状态 */
  status: ConversationSearchStatus;
  /** 请求失败时的说明 */
  errorMessage: string | null;
  /** 当前页的展示数据 */
  pagedItems: ConversationDisplay[];
  /** 命中总数 */
  total: number;
  /** 当前页码（已收敛） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否处于检索状态（检索词非空） */
  isSearching: boolean;
  /** 当前选中的对话是否命中、但不在当前页上 */
  isActiveOffPage: boolean;
  /** 翻到当前选中对话所在的那一页 */
  locateActive: () => void;
  /** 失败后再试一遍 */
  retry: () => void;
}

/**
 * 对话列表检索：
 * - 按标题与最近一条内容检索，按更新时间排序，结果带高亮区间；
 * - 输入防抖，请求过期自动丢弃，失败可重试；
 * - 对话数据变化（新建/删除/新消息）后自动重新检索；
 * - 页码超出范围自动收敛，并可随时回到选中对话所在页。
 */
export function useConversationSearch(): UseConversationSearchResult {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const { query, page, setPage } = useConversationSearchStore();

  const [results, setResults] = useState<ConversationDisplay[]>([]);
  // 初始即为 loading：首屏在首轮请求完成前展示加载态，避免误闪"暂无对话"
  const [status, setStatus] = useState<ConversationSearchStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const isSearching = query.trim().length > 0;

  // 与检索结果相关的数据签名：只关心 id、标题、更新时间与最近一条消息，
  // 流式输出等场景下列表未变化就不重新发起请求。
  const signature = useMemo(
    () =>
      conversations
        .map((c) => {
          const last = c.messages[c.messages.length - 1];
          return `${c.id}|${c.updatedAt}|${c.title}|${last?.id ?? ''}|${last?.status ?? ''}|${last?.content.length ?? 0}`;
        })
               .join('\n'),
    [conversations],
  );

  // 记录上一次触发请求时的入参，用来判断变化来源并选择防抖时长。
  // signature 初始为 null，使首次挂载即使数据为空也会发起一次请求。
  const prevRef = useRef<{ query: string; signature: string | null; nonce: number }>({
    query: '',
    signature: null,
    nonce: -1,
  });

  useEffect(() => {
    const prev = prevRef.current;
    const queryChanged = prev.query !== query;
    const signatureChanged = prev.signature !== signature;
    const nonceChanged = prev.nonce !== nonce;
    prevRef.current = { query, signature, nonce };

    if (!queryChanged && !signatureChanged && !nonceChanged) {
      return;
    }

    // 手动重试立即发起；输入检索词走防抖；数据变化短防抖以合并连续更新
    const delay = nonceChanged
      ? 0
      : queryChanged
        ? SEARCH_DEBOUNCE_MS
        : CONVERSATION_CHANGE_DEBOUNCE_MS;

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      setStatus('loading');
      setErrorMessage(null);

      runConversationSearch({
        query,
        conversations,
        signal: controller.signal,
      })
        .then((nextResults) => {
          if (cancelled || controller.signal.aborted) return;
          setResults(nextResults);
          setStatus('success');
          setErrorMessage(null);
        })
        .catch((error: unknown) => {
          if (cancelled || controller.signal.aborted) return;
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          setStatus('error');
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : '检索请求失败，请稍后重试',
          );
        });
    }, delay);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // conversations 通过 signature 间接参与，避免无关引用变化触发请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, signature, nonce]);

  const pageMeta = useMemo(
    () => paginate(results, page, CONVERSATION_PAGE_SIZE),
    [results, page],
  );

  // 检索结果变少导致当前页超出范围时，收敛到最后一页
  useEffect(() => {
    if (page > pageMeta.totalPages) {
      setPage(pageMeta.totalPages);
    }
  }, [page, pageMeta.totalPages, setPage]);

  const activeIndex = useMemo(() => {
    if (!activeConversationId) return -1;
    return results.findIndex(
      (item) => item.conversation.id === activeConversationId,
    );
  }, [results, activeConversationId]);

  const activePage = activeIndex === -1 ? -1 : Math.floor(activeIndex / pageMeta.pageSize) + 1;
  const isActiveOffPage = activeIndex !== -1 && activePage !== pageMeta.page;

  const locateActive = () => {
    if (activePage !== -1) {
      setPage(activePage);
    }
  };

  const retry = () => setNonce((value) => value + 1);

  return {
    status,
    errorMessage,
    pagedItems: pageMeta.items,
    total: pageMeta.total,
    page: pageMeta.page,
    pageSize: pageMeta.pageSize,
    totalPages: pageMeta.totalPages,
    isSearching,
    isActiveOffPage,
    locateActive,
    retry,
  };
}
