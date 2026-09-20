import type { Conversation } from '../types';
import { searchConversations, type ConversationDisplay } from '../utils/conversationSearch';

export interface ConversationSearchParams {
  /** 原始检索词（按标题与最近一条内容检索） */
  query: string;
  /** 待检索的对话快照 */
  conversations: Conversation[];
  /** 用于取消过期请求的信号 */
  signal?: AbortSignal;
}

/**
 * 对话检索运行器：把"发起一次检索请求"抽象成异步接口，
 * 便于在请求失败时给出明确说明并重试，也便于测试注入。
 */
export type ConversationSearchRunner = (
  params: ConversationSearchParams,
) => Promise<ConversationDisplay[]>;

/**
 * 默认运行器：基于本地数据执行检索。
 * 保留 Promise 接口与 AbortSignal，语义上与远程请求一致——
 * 任何失败都会向上抛出，由调用方进入"请求失败，可重试"状态。
 */
export const defaultConversationSearchRunner: ConversationSearchRunner = async ({
  query,
  conversations,
  signal,
}) => {
  if (signal?.aborted) {
    throw new DOMException('检索已取消', 'AbortError');
  }

  try {
    return searchConversations(conversations, query);
  } catch (error) {
    throw new Error(
      `检索对话失败：${error instanceof Error ? error.message : '未知错误'}`,
    );
  }
};

let activeRunner: ConversationSearchRunner = defaultConversationSearchRunner;

/** 替换检索运行器（主要用于测试注入失败/延迟场景） */
export function setConversationSearchRunner(runner: ConversationSearchRunner): void {
  activeRunner = runner;
}

/** 恢复默认检索运行器 */
export function resetConversationSearchRunner(): void {
  activeRunner = defaultConversationSearchRunner;
}

/** 发起一次对话检索 */
export function runConversationSearch(
  params: ConversationSearchParams,
): Promise<ConversationDisplay[]> {
  return activeRunner(params);
}
