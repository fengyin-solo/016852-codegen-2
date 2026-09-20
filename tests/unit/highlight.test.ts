import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  getMatchRanges,
  matchesQuery,
  buildPreviewSnippet,
} from '../../src/utils/highlight';

describe('normalizeQuery', () => {
  it('去除首尾空白', () => {
    expect(normalizeQuery('  hello ')).toBe('hello');
    expect(normalizeQuery('\t你好\n')).toBe('你好');
  });

  it('空白查询规范化为空字符串', () => {
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('getMatchRanges', () => {
  it('返回全部互不重叠的命中区间', () => {
    const ranges = getMatchRanges('abc-abc-ABC', 'abc');
    expect(ranges).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 },
    ]);
  });

  it('大小写不敏感，区间按原文大小写返回', () => {
    const ranges = getMatchRanges('Hello HELLO hello', 'hello');
    expect(ranges).toHaveLength(3);
    expect('Hello HELLO hello'.slice(ranges[1]!.start, ranges[1]!.end)).toBe('HELLO');
  });

  it('空查询或空文本返回空数组', () => {
    expect(getMatchRanges('text', '')).toEqual([]);
    expect(getMatchRanges('text', '   ')).toEqual([]);
    expect(getMatchRanges('', 'x')).toEqual([]);
  });

  it('对查询词做首尾空白规范化', () => {
    expect(getMatchRanges('findme here', ' find ')).toEqual([{ start: 0, end: 4 }]);
  });
});

describe('matchesQuery', () => {
  it('按子串大小写不敏感匹配', () => {
    expect(matchesQuery('TypeScript 指南', 'typescript')).toBe(true);
    expect(matchesQuery('JavaScript', 'typescript')).toBe(false);
  });

  it('空查询恒为 false', () => {
    expect(matchesQuery('anything', '')).toBe(false);
  });
});

describe('buildPreviewSnippet', () => {
  it('无查询词时退化为从开头截断', () => {
    const result = buildPreviewSnippet('a'.repeat(60), '');
    expect(result.text).toHaveLength(50);
    expect(result.text.endsWith('...')).toBe(true);
    expect(result.ranges).toEqual([]);
  });

  it('未命中时从开头截断且无高亮', () => {
    const result = buildPreviewSnippet('x'.repeat(60), '不存在');
    expect(result.ranges).toEqual([]);
    expect(result.text.endsWith('...')).toBe(true);
  });

  it('短文本完整返回并给出命中区间', () => {
    const result = buildPreviewSnippet('hello world', 'world');
    expect(result.text).toBe('hello world');
    expect(result.ranges).toEqual([{ start: 6, end: 11 }]);
  });

  it('命中位置靠近结尾时，片段仍包含命中内容且区间有效', () => {
    const content = 'a'.repeat(100) + '目标';
    const result = buildPreviewSnippet(content, '目标');
    expect(result.text.startsWith('...')).toBe(true);
    expect(result.text).toContain('目标');
    for (const range of result.ranges) {
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThanOrEqual(result.text.length);
      expect(result.text.slice(range.start, range.end)).toBe('目标');
    }
  });

  it('片段两侧省略号不会破坏命中区间', () => {
    const content = '前缀'.repeat(40) + '关键词' + '后缀'.repeat(40);
    const result = buildPreviewSnippet(content, '关键词');
    expect(result.text).toContain('关键词');
    const matched = result.ranges.some(
      (range) => result.text.slice(range.start, range.end) === '关键词',
    );
    expect(matched).toBe(true);
  });

  it('空内容返回空片段', () => {
    expect(buildPreviewSnippet('', 'x')).toEqual({ text: '', ranges: [] });
  });
});
