import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation } from '../types';
import {
  searchConversations,
  type ConversationSearchHit,
} from '../services/conversationSearch';

/** 每页展示条数 */
export const SEARCH_PAGE_SIZE = 10;
/** 检索词防抖时间 */
const QUERY_DEBOUNCE_MS = 300;

export type ConversationSearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseConversationSearchOptions {
  /** 全部对话（检索状态下新建/删除后，依据它自动重新检索） */
  conversations: Conversation[];
}

/**
 * 对话列表检索逻辑：
 * - 输入防抖后异步检索（标题 + 最近一条消息）
 * - 维护 加载 / 成功（含空结果）/ 失败 状态，失败可重试
 * - 分页基于检索结果切片；翻页不改动选中项，删除等操作后自动收敛页码
 * - 对话增删或标题/更新时间变化时，使用当前关键词重新检索，列表即时更新
 * - 同一关键词的后台刷新采用 stale-while-revalidate，列表不会闪烁加载态
 */
export function useConversationSearch({ conversations }: UseConversationSearchOptions) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<ConversationSearchStatus>('idle');
  const [hits, setHits] = useState<ConversationSearchHit[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);

  // 通过 ref 读取最新对话，避免 conversations 引用变化（如流式追加）导致在途请求被中止
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // 输入防抖；关键词变化时回到第一页
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = inputValue.trim();
      setDebouncedQuery((previous) => {
        if (previous === trimmed) {
          return previous;
        }
        setPage(1);
        return trimmed;
      });
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 对话列表的轻量签名：仅包含 id、更新时间与标题。
  // 流式追加内容时三者均不变，不会反复触发检索；
  // 新建 / 删除 / 新增消息 / 流式完成 / 标题生成或修改 等场景都会改变签名。
  const conversationsSignature = useMemo(
    () =>
      conversations
        .map((conversation) => `${conversation.id}:${conversation.updatedAt}:${conversation.title}`)
        .join('|'),
    [conversations],
  );

  // 最近一次成功检索时的「关键词 + 签名」，用于判断是否需要重新检索
  const lastLoadedKeyRef = useRef<string | null>(null);
  // 最近一次成功检索的关键词，用于区分「新词加载」与「同词后台刷新」
  const successfulQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const loadKey = `${debouncedQuery}@@${conversationsSignature}`;
    if (lastLoadedKeyRef.current === loadKey) {
      return;
    }

    const controller = new AbortController();

    setStatus('loading');
    setErrorMessage('');

    searchConversations({
      query: debouncedQuery,
      signal: controller.signal,
      source: () => conversationsRef.current,
    })
      .then((results) => {
        lastLoadedKeyRef.current = loadKey;
        successfulQueryRef.current = debouncedQuery;
        setHits(results);
        setStatus('success');
        // 删除等操作导致结果变少后，把当前页收敛到最后一个有效页
        setPage((current) =>
          Math.min(current, Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE))),
        );
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '检索失败，请稍后重试');
        setStatus('error');
      });

    return () => controller.abort();
  }, [debouncedQuery, conversationsSignature, retryNonce]);

  // 首次加载或更换关键词时展示整屏加载态；同词后台刷新时继续展示已有结果
  const isLoadingResults =
    status === 'loading' && successfulQueryRef.current !== debouncedQuery;

  const totalPages = Math.max(1, Math.ceil(hits.length / SEARCH_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedHits = useMemo(
    () =>
      hits.slice(
        (currentPage - 1) * SEARCH_PAGE_SIZE,
        currentPage * SEARCH_PAGE_SIZE,
      ),
    [hits, currentPage],
  );

  const retry = useCallback(() => {
    lastLoadedKeyRef.current = null;
    setRetryNonce((value) => value + 1);
  }, []);

  const clearQuery = useCallback(() => {
    setInputValue('');
  }, []);

  return {
    /** 搜索框当前输入值 */
    inputValue,
    setInputValue,
    /** 防抖后的检索词（非空即处于检索状态） */
    query: debouncedQuery,
    isSearching: debouncedQuery.length > 0,
    /** 请求状态 */
    status,
    /** 是否需要整屏加载态（首次加载/新词检索） */
    isLoadingResults,
    /** 失败说明 */
    errorMessage,
    /** 命中总数 */
    total: hits.length,
    /** 当前页码（已收敛到有效范围） */
    page: currentPage,
    setPage,
    /** 当前页的命中结果（后台刷新期间为上一次结果） */
    pagedHits,
    /** 重新发起检索 */
    retry,
    /** 清空检索词 */
    clearQuery,
  };
}
