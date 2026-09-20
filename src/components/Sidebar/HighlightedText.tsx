import { Fragment } from 'react';
import type { MatchRange } from '../../utils/conversationSearch';

interface HighlightedTextProps {
  /** 完整的显示文本 */
  text: string;
  /** 需要高亮的区间 */
  ranges: MatchRange[];
}

/**
 * 按命中区间把文本渲染为高亮片段；区间之外保持原样。
 */
export function HighlightedText({ text, ranges }: HighlightedTextProps) {
  if (ranges.length === 0 || !text) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    const start = Math.max(0, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));

    if (start > cursor) {
      parts.push(<Fragment key={`t-${index}`}>{text.slice(cursor, start)}</Fragment>);
    }
    parts.push(
      <mark key={`h-${index}`} className="conversation-highlight">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < text.length) {
    parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  }

  return <>{parts}</>;
}
