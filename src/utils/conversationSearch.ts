import type { Conversation } from '../types';
import { truncateText } from './formatters';

/** 每页默认展示的对话数量 */
export const CONVERSATION_PAGE_SIZE = 20;
/** 标题最大展示长度 */
export const TITLE_PREVIEW_LENGTH = 20;
/** 最近一条内容预览的最大长度 */
export const CONTENT_PREVIEW_LENGTH = 50;

/** 高亮区间：在显示文本中的 [起始下标, 结束下标) */
export interface MatchRange {
  start: number;
  end: number;
}

/** 供列表渲染的对话展示数据 */
export interface ConversationDisplay {
  conversation: Conversation;
  /** 截断后的标题 */
  displayTitle: string;
  /** 截断后的最近一条内容（无消息时为空串） */
  displayPreview: string;
  /** 标题中命中的区间 */
  titleMatches: MatchRange[];
  /** 预览内容中命中的区间 */
  previewMatches: MatchRange[];
}

/** 分页后的检索结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 统一的对话排序：按更新时间降序；更新时间相同则按创建时间降序；
 * 再相同则按 id 兜底，保证任意环境下次序稳定（刷新后也能对得上）。
 */
export function compareConversations(a: Conversation, b: Conversation): number {
  if (b.updatedAt !== a.updatedAt) {
    return b.updatedAt - a.updatedAt;
  }
  if (b.createdAt !== a.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 归一化检索词：去除首尾空白，连续空白合并为单个空格并转小写。
 * 返回的多个词之间为 AND 关系。
 */
export function normalizeQuery(rawQuery: string): string[] {
  return rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * 在文本中查找所有检索词命中的区间（大小写不敏感，包含重叠）。
 */
export function findMatchRanges(text: string, terms: string[]): MatchRange[] {
  if (!text || terms.length === 0) {
    return [];
  }

  const lower = text.toLowerCase();
  const ranges: MatchRange[] = [];

  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    let index = lower.indexOf(term, from);
    while (index !== -1) {
      ranges.push({ start: index, end: index + term.length });
      from = index + 1;
      index = lower.indexOf(term, from);
    }
  }

  // 合并重叠/相邻区间，按起始位置排序
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MatchRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * 判断一个对话是否命中全部检索词：
 * 每个词需要命中标题或最近一条消息内容（大小写不敏感）。
 */
export function conversationMatches(
  conversation: Conversation,
  terms: string[],
): boolean {
  if (terms.length === 0) {
    return true;
  }

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const title = conversation.title ?? '';
  const content = lastMessage?.content ?? '';
  const haystack = `${title}\n${content}`.toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

/**
 * 计算列表项的展示文本与高亮区间。高亮区间基于截断后的展示文本计算，
 * 保证只高亮当前可见的片段。
 */
export function getConversationDisplay(
  conversation: Conversation,
  terms: string[],
): ConversationDisplay {
  const displayTitle = truncateText(conversation.title, TITLE_PREVIEW_LENGTH);
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const displayPreview = lastMessage
    ? truncateText(lastMessage.content, CONTENT_PREVIEW_LENGTH)
    : '';

  return {
    conversation,
    displayTitle,
    displayPreview,
    titleMatches: findMatchRanges(displayTitle, terms),
    previewMatches: findMatchRanges(displayPreview, terms),
  };
}

/**
 * 检索对话：按标题与最近一条内容过滤，按更新时间降序排序，
 * 并附带高亮区间。
 */
export function searchConversations(
  conversations: Conversation[],
  rawQuery: string,
): ConversationDisplay[] {
  const terms = normalizeQuery(rawQuery);

  return conversations
    .filter((conversation) => conversationMatches(conversation, terms))
    .sort(compareConversations)
    .map((conversation) => getConversationDisplay(conversation, terms));
}

/**
 * 将结果按页切片，页码超出范围时自动收敛到最后一页。
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = CONVERSATION_PAGE_SIZE,
): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
