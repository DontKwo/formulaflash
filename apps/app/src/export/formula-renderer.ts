import katex from 'katex';

export interface RenderedFormulaGraphic {
  svgDataUri?: string;
  pngDataUri?: string;
  width: number;
  height: number;
  altText: string;
  fallbackText?: string;
  failed?: boolean;
}

const formulaCache = new Map<string, RenderedFormulaGraphic>();

/**
 * Parses and generates PNG graphic of a rendered KaTeX formula with safe padding.
 */
export async function renderFormulaGraphic(
  latex: string,
  fontSize: number,
  color: string = '#000000',
  dpi: number = 300
): Promise<RenderedFormulaGraphic> {
  const cacheKey = `${latex}::${fontSize}::${color}::${dpi}`;
  if (formulaCache.has(cacheKey)) {
    return formulaCache.get(cacheKey)!;
  }

  try {
    const renderedHtml = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: true,
      output: 'html',
    });

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowser) {
      const fallback: RenderedFormulaGraphic = {
        width: Math.max(40, latex.length * fontSize * 0.6),
        height: fontSize * 1.8,
        altText: latex,
        fallbackText: latex,
      };
      formulaCache.set(cacheKey, fallback);
      return fallback;
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.display = 'inline-block';
    container.style.padding = '6px 10px';
    container.style.fontSize = `${fontSize}pt`;
    container.style.color = color;
    container.innerHTML = renderedHtml;
    document.body.appendChild(container);

    const rect = container.getBoundingClientRect();
    const naturalWidth = Math.max(36, Math.ceil(rect.width) + 6);
    const naturalHeight = Math.max(20, Math.ceil(rect.height) + 6);
    document.body.removeChild(container);

    const scale = dpi / 72;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(naturalWidth * scale);
    canvas.height = Math.ceil(naturalHeight * scale);
    const ctx = canvas.getContext('2d');

    let pngUri: string | undefined;

    if (ctx) {
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${naturalWidth}" height="${naturalHeight}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color:${color};font-size:${fontSize}pt;padding:6px 10px;display:inline-block;">
              ${renderedHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });

      try {
        pngUri = canvas.toDataURL('image/png');
      } catch {
        // Fallback to plain text drawing if tainted canvas
      }
    }

    const result: RenderedFormulaGraphic = {
      pngDataUri: pngUri,
      width: naturalWidth,
      height: naturalHeight,
      altText: latex,
    };

    formulaCache.set(cacheKey, result);
    return result;
  } catch {
    const errorFallback: RenderedFormulaGraphic = {
      width: Math.max(40, latex.length * fontSize * 0.5),
      height: fontSize * 1.5,
      altText: latex,
      fallbackText: latex,
      failed: true,
    };
    formulaCache.set(cacheKey, errorFallback);
    return errorFallback;
  }
}
