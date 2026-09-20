import { describe, it, expect } from 'vitest';
import type { Conversation, Message } from '../../src/types';
import {
  CONVERSATION_PAGE_SIZE,
  compareConversations,
  normalizeQuery,
  findMatchRanges,
  conversationMatches,
  getConversationDisplay,
  searchConversations,
  paginate,
} from '../../src/utils/conversationSearch';

function makeMessage(
  role: Message['role'],
  content: string,
  timestamp: number,
): Message {
  return {
    id: `${role}-${timestamp}-${content.length}`,
    role,
    content,
    timestamp,
    status: 'complete',
  };
}

function makeConversation(
  id: string,
  title: string,
  lastContent: string | null,
  updatedAt: number,
  createdAt: number = updatedAt - 1000,
): Conversation {
  return {
    id,
    title,
    messages: lastContent === null ? [] : [makeMessage('user', '你好', createdAt), makeMessage('assistant', lastContent, updatedAt)],
    createdAt,
    updatedAt,
  };
}

describe('normalizeQuery', () => {
  it('去除首尾空白并按空白拆分为小写词', () => {
    expect(normalizeQuery('  Hello   World  ')).toEqual(['hello', 'world']);
    expect(normalizeQuery('')).toEqual([]);
    expect(normalizeQuery('   ')).toEqual([]);
  });
});

describe('compareConversations', () => {
  it('按更新时间降序', () => {
    const older = makeConversation('a', 'A', 'x', 1000);
    const newer = makeConversation('b', 'B', 'x', 2000);
    const sorted = [older, newer].sort(compareConversations);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('更新时间相同时按创建时间降序', () => {
    const a: Conversation = { ...makeConversation('a', 'A', 'x', 100, 50) };
    const b: Conversation = { ...makeConversation('b', 'B', 'x', 100, 80) };
    // b 创建更晚，排在 a 前面，因此 compare(a, b) > 0
    expect(compareConversations(a, b)).toBeGreaterThan(0);
    expect([a, b].sort(compareConversations).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('时间都相同时按 id 兜底，结果稳定', () => {
    const a = { ...makeConversation('a', 'A', 'x', 1, 1) };
    const b = { ...makeConversation('b', 'B', 'x', 1, 1) };
    expect([b, a].sort(compareConversations).map((c) => c.id)).toEqual(['a', 'b']);
    expect([a, b].sort(compareConversations).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('findMatchRanges', () => {
  it('大小写不敏感并返回所有命中区间', () => {
    expect(findMatchRanges('Hello hello HELLO', ['hello'])).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
      { start: 12, end: 17 },
    ]);
  });

  it('合并重叠/相邻区间', () => {
    // ab 命中 [0,2)/[3,5)，bc 命中 [1,3)/[4,6)，连续覆盖合并为整段
    expect(findMatchRanges('abcabc', ['ab', 'bc'])).toEqual([
      { start: 0, end: 6 },
    ]);
  });

  it('保留相互独立的区间', () => {
    expect(findMatchRanges('abxxab', ['ab'])).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it('空文本或空词返回空数组', () => {
    expect(findMatchRanges('', ['a'])).toEqual([]);
    expect(findMatchRanges('abc', [])).toEqual([]);
  });
});

describe('conversationMatches', () => {
  const conv = makeConversation('c1', 'React 学习笔记', 'Hooks 真好用', 1000);

  it('无检索词时全部命中', () => {
    expect(conversationMatches(conv, [])).toBe(true);
  });

  it('标题命中', () => {
    expect(conversationMatches(conv, ['react'])).toBe(true);
  });

  it('最近一条内容命中', () => {
    expect(conversationMatches(conv, ['hooks'])).toBe(true);
  });

  it('多个词为 AND 关系，可分别命中标题与内容', () => {
    expect(conversationMatches(conv, ['react', 'hooks'])).toBe(true);
    expect(conversationMatches(conv, ['react', 'vue'])).toBe(false);
  });

  it('只检索最近一条消息，更早的消息不参与匹配', () => {
    const c = makeConversation('c2', '标题', '最近内容', 2000);
    expect(conversationMatches(c, ['你好'])).toBe(false);
  });

  it('无消息的对话只匹配标题', () => {
    const empty = makeConversation('c3', '空对话标题', null, 1000);
    expect(conversationMatches(empty, ['空对话'])).toBe(true);
    expect(conversationMatches(empty, ['任意内容'])).toBe(false);
  });
});

describe('searchConversations', () => {
  const conversations = [
    makeConversation('c1', 'React 学习', 'useState 入门', 1000),
    makeConversation('c2', 'Vue 学习', 'React 是什么', 3000),
    makeConversation('c3', '生活', '今天天气不错', 2000),
    makeConversation('c4', 'react 原理', 'fiber 架构', 4000),
  ];

  it('按标题与最近一条内容过滤，并按更新时间降序', () => {
    const results = searchConversations(conversations, 'react');
    // c4（标题命中，4000）、c2（内容命中，3000）、c1（标题命中，1000）
    expect(results.map((r) => r.conversation.id)).toEqual(['c4', 'c2', 'c1']);
  });

  it('附带高亮区间', () => {
    const results = searchConversations(conversations, 'react');
    const c2 = results.find((r) => r.conversation.id === 'c2');
    expect(c2?.titleMatches).toEqual([]);
    expect(c2?.previewMatches).toEqual([{ start: 0, end: 5 }]);

    const c4 = results.find((r) => r.conversation.id === 'c4');
    expect(c4?.titleMatches).toEqual([{ start: 0, end: 5 }]);
  });

  it('检索词为空时返回全部，按更新时间降序', () => {
    const results = searchConversations(conversations, '   ');
    expect(results.map((r) => r.conversation.id)).toEqual(['c4', 'c2', 'c3', 'c1']);
  });

  it('高亮区间基于截断后的展示文本计算', () => {
    const longTitle = 'a'.repeat(5) + '关键词' + 'b'.repeat(50);
    const conv = makeConversation('c5', longTitle, 'x', 1000);
    const display = getConversationDisplay(conv, ['关键词']);
    // 标题被截断到 20 字，"关键词"位于 5-8，仍在展示范围内
    expect(display.displayTitle.length).toBeLessThanOrEqual(20);
    expect(display.titleMatches).toEqual([{ start: 5, end: 8 }]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i);

  it('按页切片', () => {
    const page1 = paginate(items, 1, CONVERSATION_PAGE_SIZE);
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(45);
    expect(page1.totalPages).toBe(3);
    expect(page1.page).toBe(1);

    const page3 = paginate(items, 3, CONVERSATION_PAGE_SIZE);
    expect(page3.items).toEqual([40, 41, 42, 43, 44]);
  });

  it('页码超出范围时收敛到最后一页', () => {
    const page = paginate(items, 99, CONVERSATION_PAGE_SIZE);
    expect(page.page).toBe(3);
    expect(page.items).toEqual([40, 41, 42, 43, 44]);
  });

  it('页码小于 1 时收敛到第一页', () => {
    const page = paginate(items, 0, CONVERSATION_PAGE_SIZE);
    expect(page.page).toBe(1);
  });

  it('空列表时仍返回第一页', () => {
    const page = paginate([], 5, CONVERSATION_PAGE_SIZE);
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.items).toEqual([]);
  });
});
