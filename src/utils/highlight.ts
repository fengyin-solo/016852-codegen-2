/**
 * 文本命中高亮相关的纯函数工具
 */

/**
 * 规范化检索词：去除首尾空白
 */
export function normalizeQuery(rawQuery: string): string {
  return rawQuery.trim();
}

/**
 * 在文本中查找检索词所有出现位置（大小写不敏感，互不重叠）
 * @param text 原始文本
 * @param rawQuery 检索词（会被规范化并转小写匹配）
 * @returns 命中区间数组，按出现位置升序
 */
export function getMatchRanges(
  text: string,
  rawQuery: string,
): Array<{ start: number; end: number }> {
  const query = normalizeQuery(rawQuery).toLowerCase();
  if (!query || !text) {
    return [];
  }

  const lowerText = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  let fromIndex = 0;
  while (fromIndex <= lowerText.length - query.length) {
    const index = lowerText.indexOf(query, fromIndex);
    if (index === -1) {
      break;
    }
    ranges.push({ start: index, end: index + query.length });
    fromIndex = index + query.length;
  }

  return ranges;
}

/**
 * 判断文本是否包含检索词（大小写不敏感）
 */
export function matchesQuery(text: string, rawQuery: string): boolean {
  const query = normalizeQuery(rawQuery).toLowerCase();
  if (!query) return false;
  return text.toLowerCase().includes(query);
}

/**
 * 预览片段长度
 */
export const PREVIEW_SNIPPET_LENGTH = 50;

/**
 * 围绕检索词截取最近一条消息的预览片段，并返回片段内的命中区间。
 * 命中位置靠近结尾时会向中间展示，保证命中片段可见。
 * @param content 完整消息内容
 * @param rawQuery 检索词
 * @param maxLength 片段最大长度（默认 50）
 */
export function buildPreviewSnippet(
  content: string,
  rawQuery: string,
  maxLength: number = PREVIEW_SNIPPET_LENGTH,
): { text: string; ranges: Array<{ start: number; end: number }> } {
  const query = normalizeQuery(rawQuery).toLowerCase();
  if (!content) {
    return { text: '', ranges: [] };
  }

  // 无检索词或未命中时，退化为从开头截断（与原列表行为一致）
  if (!query) {
    return {
      text: truncate(content, maxLength),
      ranges: [],
    };
  }

  const lowerContent = content.toLowerCase();
  const matchIndex = lowerContent.indexOf(query);
  if (matchIndex === -1) {
    return {
      text: truncate(content, maxLength),
      ranges: [],
    };
  }

  if (content.length <= maxLength) {
    return { text: content, ranges: getMatchRanges(content, rawQuery) };
  }

  // 让命中片段尽量出现在片段中间
  const windowStart = Math.min(
    Math.max(0, matchIndex - Math.floor((maxLength - query.length) / 2)),
    content.length - maxLength,
  );
  const windowEnd = windowStart + maxLength;

  let text = content.slice(windowStart, windowEnd);
  const prefix = windowStart > 0 ? '...' : '';
  const suffix = windowEnd < content.length ? '...' : '';
  text = prefix + text + suffix;

  // 在最终片段上重新计算命中区间（区间会随省略号整体偏移）
  const ranges = getMatchRanges(text, rawQuery);

  return { text, ranges };
}

function truncate(text: string, maxLength: number): string {
  const suffix = '...';
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - suffix.length) + suffix;
}
