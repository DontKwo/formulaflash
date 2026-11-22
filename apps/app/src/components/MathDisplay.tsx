import React, { useMemo } from 'react';
import katex from 'katex';

export interface MathDisplayProps {
  latex: string;
  display?: boolean;
  className?: string;
}

export const MathDisplay: React.FC<MathDisplayProps> = ({
  latex,
  display = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      return `<code class="fallback-math">${latex}</code>`;
    }
  }, [latex, display]);

  return (
    <span
      className={`math-display ${display ? 'math-display-block' : 'math-display-inline'} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface TextSegment {
  kind: 'text' | 'math';
  value: string;
}

const BARE_LATEX_PATTERN =
  /(\\[a-zA-Z]+(?:\{[^{}]*\})*(?:_(?:\{[^{}]*\}|[a-zA-Z0-9+\-*]+)|\^(?:\{[^{}]*\}|[a-zA-Z0-9*+]+))*)/g;

function parseMathTextSegments(input: string): TextSegment[] {
  if (!input) return [];
  const result: TextSegment[] = [];
  const dollarParts = input.split(/(\$[^$]+\$)/g);

  for (const part of dollarParts) {
    if (!part) continue;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      result.push({ kind: 'math', value: part.slice(1, -1) });
      continue;
    }

    let lastIdx = 0;
    let match: RegExpExecArray | null;
    BARE_LATEX_PATTERN.lastIndex = 0;
    while ((match = BARE_LATEX_PATTERN.exec(part)) !== null) {
      if (match.index > lastIdx) {
        result.push({ kind: 'text', value: part.slice(lastIdx, match.index) });
      }
      result.push({ kind: 'math', value: match[1] });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < part.length) {
      result.push({ kind: 'text', value: part.slice(lastIdx) });
    }
  }

  return result;
}

export interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const segments = useMemo(() => parseMathTextSegments(text), [text]);

  return (
    <span className={className ? `math-text ${className}` : 'math-text'}>
      {segments.map((seg, idx) =>
        seg.kind === 'math' ? (
          <MathDisplay key={idx} latex={seg.value} display={false} />
        ) : (
          <React.Fragment key={idx}>{seg.value}</React.Fragment>
        )
      )}
    </span>
  );
};
