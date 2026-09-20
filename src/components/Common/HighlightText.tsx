import { memo, type ReactNode } from 'react';
import './HighlightText.css';

export interface HighlightRange {
  /** 起始位置（含） */
  start: number;
  /** 结束位置（不含） */
  end: number;
}

interface HighlightTextProps {
  /** 原始文本 */
  text: string;
  /** 命中区间 */
  ranges?: HighlightRange[];
  /** 自定义类名 */
  className?: string;
}

/**
 * 按命中区间渲染高亮文本。
 * 区间外的部分原样展示，保证检索词之外的内容与大小写不发生变化。
 */
export const HighlightText = memo(function HighlightText({
  text,
  ranges = [],
  className,
}: HighlightTextProps) {
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // 过滤非法区间并按起点排序，避免区间重叠导致渲染异常
  const validRanges = ranges
    .filter((range) => range.end > range.start && range.start >= 0 && range.end <= text.length)
    .slice()
    .sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let cursor = 0;

  validRanges.forEach((range, index) => {
    // 跳过重叠区间
    if (range.start < cursor) {
      return;
    }
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }
    parts.push(
      <mark key={`hl-${index}`} className="search-highlight">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
});
