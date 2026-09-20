import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Conversation, Message } from '../../src/types';
import {
  compareConversations,
  normalizeQuery,
  searchConversations,
  paginate,
  CONVERSATION_PAGE_SIZE,
} from '../../src/utils/conversationSearch';

// 可控词表，保证一定能拼出命中/不命中的标题与内容
const WORDS = ['react', 'vue', 'hooks', 'fiber', '天气', '笔记', '会议', '读书'];

const wordArb = fc.constantFrom(...WORDS);
const textArb = fc
  .array(wordArb, { maxLength: 4 })
  .map((words) => words.join(' '));

const messageArb: fc.Arbitrary<Message> = fc
  .tuple(textArb, fc.integer({ min: 0, max: 1_000_000 }))
  .map(([content, timestamp]) => ({
    id: `m-${timestamp}-${content.length}`,
    role: 'user' as const,
    content,
    timestamp,
    status: 'complete' as const,
  }));

const conversationArb: fc.Arbitrary<Conversation> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
    textArb,
    fc.array(messageArb, { maxLength: 5 }),
    fc.integer({ min: 0, max: 1_000_000 }),
  )
  .map(([id, title, messages, updatedAt]) => ({
    id,
    title,
    messages,
    createdAt: updatedAt,
    updatedAt,
  }));

describe('conversationSearch 属性测试', () => {
  it('排序结果始终满足 updatedAt 非递增，且与输入顺序无关', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 30 }),
        (conversations) => {
          const asc = [...conversations].sort(compareConversations);
          const desc = [...conversations].reverse().sort(compareConversations);

          for (const sorted of [asc, desc]) {
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i - 1]!.updatedAt).toBeGreaterThanOrEqual(
                sorted[i]!.updatedAt,
              );
            }
          }
          // 幂等：稳定排序
          expect(asc.map((c) => c.id)).toEqual(desc.map((c) => c.id));
        },
      ),
    );
  });

  it('空检索词返回全部对话', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 30 }),
        fc.constantFrom('', '   '),
        (conversations, query) => {
          expect(searchConversations(conversations, query)).toHaveLength(
            conversations.length,
          );
        },
      ),
    );
  });

  it('每个结果都包含所有检索词（标题或最近一条内容，大小写不敏感）', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 30 }),
        fc.array(wordArb, { minLength: 1, maxLength: 3 }).map((w) => w.join(' ')),
        (conversations, query) => {
          const terms = normalizeQuery(query);
          const results = searchConversations(conversations, query);

          for (const item of results) {
            const last = item.conversation.messages[
              item.conversation.messages.length - 1
            ];
            const haystack =
              `${item.conversation.title}\n${last?.content ?? ''}`.toLowerCase();
            for (const term of terms) {
              expect(haystack).toContain(term);
            }
          }
        },
      ),
    );
  });

  it('所有命中的对话都出现在结果中（无遗漏）', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 30 }),
        wordArb,
        (conversations, term) => {
          const results = searchConversations(conversations, term);
          const expected = conversations.filter((c) => {
            const last = c.messages[c.messages.length - 1];
            return `${c.title}\n${last?.content ?? ''}`
              .toLowerCase()
              .includes(term);
          });
          expect(results).toHaveLength(expected.length);
        },
      ),
    );
  });

  it('分页不重不漏，且每页不超过 pageSize', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 60 }),
        fc.integer({ min: -3, max: 10 }),
        (conversations, requestedPage) => {
          const results = searchConversations(conversations, '');
          const page = paginate(results, requestedPage);

          expect(page.items.length).toBeLessThanOrEqual(CONVERSATION_PAGE_SIZE);
          expect(page.page).toBeGreaterThanOrEqual(1);
          expect(page.page).toBeLessThanOrEqual(page.totalPages);
          expect(page.items.length).toBe(
            Math.min(
              CONVERSATION_PAGE_SIZE,
              Math.max(0, page.total - (page.page - 1) * CONVERSATION_PAGE_SIZE),
            ),
          );
        },
      ),
    );
  });

  it('所有页拼起来恰好等于完整结果（顺序一致）', () => {
    fc.assert(
      fc.property(
        fc.array(conversationArb, { maxLength: 60 }),
        (conversations) => {
          const results = searchConversations(conversations, '');
          const totalPages = Math.max(
            1,
            Math.ceil(results.length / CONVERSATION_PAGE_SIZE),
          );
          const collected: typeof results = [];
          for (let p = 1; p <= totalPages; p++) {
            collected.push(...paginate(results, p).items);
          }
          expect(collected.map((r) => r.conversation.id)).toEqual(
            results.map((r) => r.conversation.id),
          );
        },
      ),
    );
  });
});
