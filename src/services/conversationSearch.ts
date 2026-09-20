import type { Conversation } from '../types';
import { useChatStore } from '../stores/chatStore';
import { truncateText } from '../utils/formatters';
import { buildPreviewSnippet, getMatchRanges, matchesQuery, normalizeQuery } from '../utils/highlight';

/**
 * 单条对话的检索结果
 */
export interface ConversationSearchHit {
  /** 对话对象 */
  conversation: Conversation;
  /** 标题命中区间（基于展示用的截断标题） */
  titleRanges: Array<{ start: number; end: number }>;
  /** 最近一条消息预览文本（围绕命中位置截取） */
  previewText: string;
  /** 预览文本中的命中区间 */
  previewRanges: Array<{ start: number; end: number }>;
  /** 最近一条消息是否命中（未命中则为标题命中） */
  matchedInLastMessage: boolean;
}

export interface SearchConversationsOptions {
  /** 检索词 */
  query: string;
  /** 数据源（默认从 chatStore 读取，便于测试与失败注入） */
  source?: () => Conversation[];
  /** 模拟异步延迟（毫秒，默认 0） */
  delayMs?: number;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 检索失败时抛出的错误类型
 */
export class ConversationSearchError extends Error {
  constructor(message = '检索失败，请稍后重试') {
    super(message);
    this.name = 'ConversationSearchError';
  }
}

const defaultSource = (): Conversation[] => useChatStore.getState().conversations;

function abortError(): Error {
  const error = new Error('检索已取消');
  error.name = 'AbortError';
  return error;
}

/**
 * 异步检索对话：
 * - 按标题与最近一条消息内容匹配（大小写不敏感）
 * - 结果按更新时间降序（updatedAt 相同则按 id 稳定排序）
 * - 附带命中区间用于高亮
 *
 * 数据源读取失败时抛出 ConversationSearchError，由调用方展示失败说明与重试入口。
 */
export async function searchConversations(
  options: SearchConversationsOptions,
): Promise<ConversationSearchHit[]> {
  const { query, source = defaultSource, delayMs = 0, signal } = options;

  if (signal?.aborted) {
    throw abortError();
  }

  if (delayMs > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true },
      );
    });
  }

  let conversations: Conversation[];
  try {
    conversations = source();
    if (!Array.isArray(conversations)) {
      throw new Error('数据源返回格式不正确');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new ConversationSearchError(
      error instanceof Error ? `检索失败：${error.message}` : '检索失败，请稍后重试',
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  const normalizedQuery = normalizeQuery(query);

  const hits: ConversationSearchHit[] = [];
  for (const conversation of conversations) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    const titleMatched =
      normalizedQuery.length === 0 || matchesQuery(conversation.title, normalizedQuery);
    const lastMessageMatched =
      normalizedQuery.length > 0 &&
      !!lastMessage &&
      matchesQuery(lastMessage.content, normalizedQuery);

    // 无检索词时返回全部；有检索词时标题或最近一条消息任一命中即可
    if (normalizedQuery.length > 0 && !titleMatched && !lastMessageMatched) {
      continue;
    }

    const snippet = lastMessage
      ? buildPreviewSnippet(lastMessage.content, normalizedQuery)
      : { text: '', ranges: [] };

    hits.push({
      conversation,
      // 高亮区间基于列表实际展示的截断标题计算
      titleRanges:
        normalizedQuery.length > 0
          ? getMatchRanges(truncateText(conversation.title, TITLE_PREVIEW_LENGTH), normalizedQuery)
          : [],
      previewText: lastMessage ? snippet.text : '暂无消息',
      previewRanges: normalizedQuery.length > 0 ? snippet.ranges : [],
      matchedInLastMessage: lastMessageMatched,
    });
  }

  // 按更新时间降序；时间相同用 id 保证次序稳定（刷新后次序仍一致）
  hits.sort((a, b) => {
    const diff = b.conversation.updatedAt - a.conversation.updatedAt;
    if (diff !== 0) return diff;
    return a.conversation.id < b.conversation.id ? -1 : 1;
  });

  return hits;
}

/**
 * 标题展示长度，与列表项保持一致
 */
export const TITLE_PREVIEW_LENGTH = 20;
