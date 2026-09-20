import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { searchConversations, TITLE_PREVIEW_LENGTH } from '../../src/services/conversationSearch';
import { truncateText } from '../../src/utils/formatters';
import type { Conversation, Message } from '../../src/types';

describe('searchConversations 属性测试', () => {
  // 消息生成器
  const messageArbitrary = fc
    .tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.integer({ min: 0, max: 100_000 }))
    .map(([content, timestamp]): Message => ({
      id: `msg-${timestamp}-${content.length}`,
      role: 'user' as const,
      content,
      timestamp,
      status: 'complete' as const,
    }));

  // 对话生成器（id 保证唯一）
  const conversationArbitrary: fc.Arbitrary<Conversation> = fc
    .tuple(
      fc.uuid(),
      fc.string({ minLength: 1, maxLength: 12 }),
      fc.array(messageArbitrary, { maxLength: 5 }),
      fc.integer({ min: 0, max: 100_000 }),
    )
    .map(([id, title, messages, updatedAt]): Conversation => ({
      id,
      title,
      messages,
      createdAt: updatedAt - 1,
      updatedAt,
    }));

  it('结果始终按 updatedAt 降序排列', () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(conversationArbitrary, { maxLength: 30 }),
        fc.string({ maxLength: 6 }),
        async (conversations, query) => {
          const hits = await searchConversations({ query, source: () => conversations });

          const timestamps = hits.map((hit) => hit.conversation.updatedAt);
          const sorted = [...timestamps].sort((a, b) => b - a);
          expect(timestamps).toEqual(sorted);
        },
      ),
    ));

  it('非空查询时，每条结果的标题或最近一条消息必然包含查询词（忽略大小写）', () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(conversationArbitrary, { maxLength: 30 }),
        fc
          .string({ minLength: 1, maxLength: 4 })
          .filter((q) => q.trim().length > 0),
        async (conversations, rawQuery) => {
          const query = rawQuery.trim();
          const hits = await searchConversations({ query, source: () => conversations });

          for (const hit of hits) {
            const lastMessage = hit.conversation.messages[hit.conversation.messages.length - 1];
            const inTitle = hit.conversation.title
              .toLowerCase()
              .includes(query.toLowerCase());
            const inLast =
              !!lastMessage &&
              lastMessage.content.toLowerCase().includes(query.toLowerCase());
            expect(inTitle || inLast).toBe(true);
          }
        },
      ),
    ));

  it('空查询返回的数量与数据源一致', () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(conversationArbitrary, { maxLength: 30 }),
        async (conversations) => {
          const hits = await searchConversations({ query: '', source: () => conversations });
          expect(hits).toHaveLength(conversations.length);
        },
      ),
    ));

  it('标题命中区间覆盖的原文片段与查询词一致（忽略大小写）', () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(conversationArbitrary, { maxLength: 30 }),
        fc
          .string({ minLength: 1, maxLength: 4 })
          .filter((q) => q.trim().length > 0),
        async (conversations, rawQuery) => {
          const query = rawQuery.trim();
          const hits = await searchConversations({ query, source: () => conversations });

          for (const hit of hits) {
            const displayedTitle = truncateText(hit.conversation.title, TITLE_PREVIEW_LENGTH);
            for (const range of hit.titleRanges) {
              const sliced = displayedTitle
                .slice(range.start, range.end)
                .toLowerCase();
              expect(sliced).toBe(query.toLowerCase());
            }
          }
        },
      ),
    ));
});
