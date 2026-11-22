import type {
  PageSizeName,
  PageOrientation,
  MarginPreset,
  Margins,
  ColorTheme,
} from './types.js';

// Standard paper dimensions in points (72 pt/inch)
export const PAGE_SIZES_PT: Record<Exclude<PageSizeName, 'custom'>, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612.0, height: 792.0 },
  A5: { width: 419.53, height: 595.28 },
  Legal: { width: 612.0, height: 1008.0 },
};

export const MARGIN_PRESETS_PT: Record<Exclude<MarginPreset, 'custom'>, Margins> = {
  narrow: { top: 28, right: 20, bottom: 28, left: 20 },
  normal: { top: 38, right: 36, bottom: 38, left: 36 },
  wide: { top: 54, right: 54, bottom: 54, left: 54 },
};

export function getPageDimensions(
  pageSize: PageSizeName,
  orientation: PageOrientation,
  custom?: { width?: number; height?: number }
): { width: number; height: number } {
  let base: { width: number; height: number };
  if (pageSize === 'custom' && custom && custom.width && custom.height) {
    base = { width: custom.width, height: custom.height };
  } else if (pageSize === 'custom') {
    base = PAGE_SIZES_PT.A4;
  } else {
    base = PAGE_SIZES_PT[pageSize];
  }

  if (orientation === 'landscape') {
    return {
      width: Math.max(base.width, base.height),
      height: Math.min(base.width, base.height),
    };
  }
  return {
    width: Math.min(base.width, base.height),
    height: Math.max(base.width, base.height),
  };
}

export function getMargins(preset: MarginPreset, custom?: Margins): Margins {
  if (preset === 'custom' && custom) {
    return custom;
  }
  if (preset === 'custom') {
    return MARGIN_PRESETS_PT.normal;
  }
  return MARGIN_PRESETS_PT[preset];
}

// Conservative character widths per font at 1pt so text never clips past container edges
const CHAR_WIDTH_APPROX: Record<string, number> = {
  Helvetica: 0.56,
  Times: 0.53,
  Courier: 0.62,
};

export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  isBold: boolean = false
): number {
  const factor = CHAR_WIDTH_APPROX[fontFamily] || 0.56;
  const weightMult = isBold ? 1.08 : 1.0;
  return text.length * fontSize * factor * weightMult;
}

function splitOverlongToken(
  token: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  isBold: boolean
): string[] {
  const chunks: string[] = [];
  let buf = '';
  for (const ch of token) {
    const candidate = buf + ch;
    if (buf.length > 0 && measureTextWidth(candidate, fontSize, fontFamily, isBold) > maxWidth) {
      chunks.push(buf);
      buf = ch;
    } else {
      buf = candidate;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length > 0 ? chunks : [token];
}

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  isBold: boolean = false
): string[] {
  if (!text) return [];
  const safeWidth = Math.max(20, maxWidth);
  const lines: string[] = [];
  const rawParagraphs = text.split('\n');

  for (const para of rawParagraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measureTextWidth(candidate, fontSize, fontFamily, isBold) <= safeWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        if (measureTextWidth(word, fontSize, fontFamily, isBold) > safeWidth) {
          const chunks = splitOverlongToken(word, safeWidth, fontSize, fontFamily, isBold);
          for (let cIdx = 0; cIdx < chunks.length - 1; cIdx++) {
            lines.push(chunks[cIdx]);
          }
          currentLine = chunks[chunks.length - 1];
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Normalizes LaTeX notation inside plain PDF text runs (titles, prompts, term descriptions)
 * so standard Type1 PDF fonts never print raw backslashes or broken braces.
 */
export function formatLatexForPdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\$/g, '')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
    .replace(/\\mathcal\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:mathbf|boldsymbol|vec|hat|bar|tilde|overline|underline)\{([^{}]+)\}/g, '$1')
    .replace(/\\dot\{([^{}]+)\}/g, 'd$1/dt')
    .replace(/\\ddot\{([^{}]+)\}/g, 'd^2$1/dt^2')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, '')
    .replace(/\\(neq|ne)\b/g, '!=')
    .replace(/\\(leq|le)\b/g, '<=')
    .replace(/\\(geq|ge)\b/g, '>=')
    .replace(/\\approx\b/g, '~=')
    .replace(/\\infty\b/g, 'inf')
    .replace(/\\times\b/g, 'x')
    .replace(/\\cdot\b/g, '*')
    .replace(/\\,/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ColorPalette {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  bgCard: string;
  borderCard: string;
  accent: string;
}

export function getColorPalette(theme: ColorTheme, categoryColor?: string): ColorPalette {
  switch (theme) {
    case 'black-and-white':
      return {
        textPrimary: '#000000',
        textSecondary: '#222222',
        textMuted: '#444444',
        bgCard: '#ffffff',
        borderCard: '#000000',
        accent: '#000000',
      };
    case 'grayscale':
      return {
        textPrimary: '#111111',
        textSecondary: '#444444',
        textMuted: '#777777',
        bgCard: '#f5f5f5',
        borderCard: '#cccccc',
        accent: '#555555',
      };
    case 'high-contrast':
      return {
        textPrimary: '#000000',
        textSecondary: '#000000',
        textMuted: '#222222',
        bgCard: '#ffffff',
        borderCard: '#000000',
        accent: '#0000ee',
      };
    case 'color':
    default:
      return {
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        bgCard: '#f8fafc',
        borderCard: '#cbd5e1',
        accent: categoryColor || '#3b82f6',
      };
  }
}
