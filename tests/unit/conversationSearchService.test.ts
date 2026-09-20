import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Conversation } from '../../src/types';
import {
  runConversationSearch,
  setConversationSearchRunner,
  resetConversationSearchRunner,
} from '../../src/services/conversationSearchService';
import { searchConversations } from '../../src/utils/conversationSearch';

function makeConversation(id: string, title: string, updatedAt: number): Conversation {
  return {
    id,
    title,
    messages: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('conversationSearchService', () => {
  afterEach(() => {
    resetConversationSearchRunner();
  });

  it('默认运行器返回检索结果', async () => {
    const conversations = [
      makeConversation('c1', 'React 学习', 2000),
      makeConversation('c2', '生活随笔', 1000),
    ];

    const results = await runConversationSearch({ query: 'react', conversations });
    expect(results.map((r) => r.conversation.id)).toEqual(['c1']);
  });

  it('请求失败时错误向上抛出，便于调用方提示并支持重试', async () => {
    setConversationSearchRunner(
      vi.fn().mockRejectedValue(new Error('网络错误')),
    );

    await expect(
      runConversationSearch({ query: 'react', conversations: [] }),
    ).rejects.toThrow('网络错误');
  });

  it('失败后可以再试一遍：第二次调用成功', async () => {
    const runner = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce(
        searchConversations([makeConversation('c1', 'React', 1000)], 'react'),
      );
    setConversationSearchRunner(runner);

    await expect(
      runConversationSearch({ query: 'react', conversations: [] }),
    ).rejects.toThrow('网络错误');

    const results = await runConversationSearch({ query: 'react', conversations: [] });
    expect(results).toHaveLength(1);
    expect(results[0]?.conversation.id).toBe('c1');
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('信号已取消时默认运行器抛出 AbortError', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runConversationSearch({
        query: '',
        conversations: [],
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
