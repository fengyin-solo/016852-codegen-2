import { describe, it, expect } from 'vitest';
import {
  searchConversations,
  ConversationSearchError,
} from '../../src/services/conversationSearch';
import type { Conversation } from '../../src/types';

function makeConversation(
  id: string,
  title: string,
  lastContent: string | null,
  updatedAt: number,
): Conversation {
  return {
    id,
    title,
    createdAt: updatedAt - 1000,
    updatedAt,
    messages: lastContent === null
      ? []
      : [
          {
            id: `${id}-msg`,
            role: 'user',
            content: lastContent,
            timestamp: updatedAt,
            status: 'complete' as const,
          },
        ],
  };
}

const baseConversations: Conversation[] = [
  makeConversation('c1', 'React 学习笔记', '如何理解 useEffect 的依赖数组', 1000),
  makeConversation('c2', '周报', '本周完成了搜索功能的联调', 3000),
  makeConversation('c3', 'React 项目排期', '下周开始测试', 2000),
  makeConversation('c4', '空对话', null, 4000),
];

describe('searchConversations', () => {
  it('无查询词时返回全部对话，并按更新时间降序', async () => {
    const hits = await searchConversations({
      query: '',
      source: () => baseConversations,
    });

    expect(hits.map((hit) => hit.conversation.id)).toEqual(['c4', 'c2', 'c3', 'c1']);
    expect(hits.every((hit) => hit.titleRanges.length === 0)).toBe(true);
  });

  it('按标题命中时给出标题高亮区间', async () => {
    const hits = await searchConversations({
      query: 'react',
      source: () => baseConversations,
    });

    const ids = hits.map((hit) => hit.conversation.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');

    const c1 = hits.find((hit) => hit.conversation.id === 'c1')!;
    expect(c1.matchedInLastMessage).toBe(false);
    expect(c1.titleRanges).toEqual([{ start: 0, end: 5 }]);
  });

  it('按最近一条消息命中时给出预览高亮区间', async () => {
    const hits = await searchConversations({
      query: '搜索',
      source: () => baseConversations,
    });

    expect(hits.map((hit) => hit.conversation.id)).toEqual(['c2']);
    const c2 = hits[0]!;
    expect(c2.matchedInLastMessage).toBe(true);
    expect(c2.previewRanges.length).toBeGreaterThan(0);
    for (const range of c2.previewRanges) {
      expect(c2.previewText.slice(range.start, range.end)).toBe('搜索');
    }
  });

  it('标题与最近消息任一命中即返回，未命中的不返回', async () => {
    const hits = await searchConversations({
      query: 'React',
      source: () => baseConversations,
    });
    const ids = hits.map((hit) => hit.conversation.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
    expect(ids).not.toContain('c2');
    expect(ids).not.toContain('c4');
  });

  it('空结果返回空数组', async () => {
    const hits = await searchConversations({
      query: '不存在的关键词xyz',
      source: () => baseConversations,
    });
    expect(hits).toEqual([]);
  });

  it('没有消息的对话，预览显示“暂无消息”', async () => {
    const hits = await searchConversations({
      query: '',
      source: () => baseConversations,
    });
    const c4 = hits.find((hit) => hit.conversation.id === 'c4')!;
    expect(c4.previewText).toBe('暂无消息');
  });

  it('查询词首尾空白被忽略', async () => {
    const hits = await searchConversations({
      query: '  react  ',
      source: () => baseConversations,
    });
    expect(hits.length).toBe(2);
  });

  it('数据源抛错时转换为 ConversationSearchError，可被捕获后重试', async () => {
    let shouldFail = true;
    const source = (): Conversation[] => {
      if (shouldFail) {
        throw new Error('网络异常');
      }
      return baseConversations;
    };

    await expect(searchConversations({ query: 'react', source })).rejects.toBeInstanceOf(
      ConversationSearchError,
    );

    shouldFail = false;
    const hits = await searchConversations({ query: 'react', source });
    expect(hits.length).toBe(2);
  });

  it('取消后以 AbortError 拒绝', async () => {
    const controller = new AbortController();
    const promise = searchConversations({
      query: 'react',
      source: () => baseConversations,
      delayMs: 50,
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('已经中止的信号直接拒绝', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      searchConversations({ query: 'react', source: () => baseConversations, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
