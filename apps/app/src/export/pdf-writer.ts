import { jsPDF } from 'jspdf';
import { formatLatexForPdfText, type DocumentModel } from '@formulaflash/core';
import { renderFormulaGraphic } from './formula-renderer.ts';

export interface PdfWriterProgressCallback {
  (current: number, total: number, phase: string): void;
}

export interface PdfWriterOptions {
  onProgress?: PdfWriterProgressCallback;
  cancelSignal?: { cancelled: boolean };
}

function hexToRgb(hex?: string): [number, number, number] | undefined {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return undefined;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawWrappedFallbackFormula(
  pdf: jsPDF,
  latex: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  isError: boolean
): void {
  pdf.setFont('Courier', 'normal');
  pdf.setFontSize(Math.max(6, fontSize * 0.9));
  if (isError) {
    pdf.setTextColor(185, 28, 28);
  } else {
    pdf.setTextColor(30, 41, 59);
  }
  const cleanText = formatLatexForPdfText(latex) || latex;
  const lines = pdf.splitTextToSize(isError ? `[Formula: ${cleanText}]` : cleanText, Math.max(20, maxWidth));
  const maxLines = Math.max(1, Math.min(lines.length, 4));
  for (let i = 0; i < maxLines; i++) {
    pdf.text(lines[i], x, y + fontSize * 0.9 + i * fontSize * 1.15);
  }
}

/**
 * Pure PDF writer taking the generated DocumentModel and writing a binary PDF.
 */
export async function writeDocumentToPdf(
  docModel: DocumentModel,
  options?: PdfWriterOptions
): Promise<Uint8Array> {
  const firstPage = docModel.pages[0];
  const orientation = firstPage.width > firstPage.height ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [firstPage.width, firstPage.height],
    putOnlyUsedFonts: true,
    compress: true,
  });

  pdf.setDocumentProperties({
    title: docModel.title,
    author: docModel.author,
    subject: docModel.subject || '',
    keywords: (docModel.keywords || []).join(', '),
    creator: 'Formula Flash Cheat Sheet Engine',
  });

  const totalPages = docModel.pages.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (options?.cancelSignal?.cancelled) {
      throw new Error('Export cancelled by user');
    }

    if (pageIdx > 0) {
      const page = docModel.pages[pageIdx];
      pdf.addPage([page.width, page.height], page.width > page.height ? 'landscape' : 'portrait');
    }

    const page = docModel.pages[pageIdx];
    options?.onProgress?.(pageIdx + 1, totalPages, `Rendering page ${pageIdx + 1} of ${totalPages}`);

    // 1. Render Header & Footer
    const hf = page.headerFooter;
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);

    if (hf.headerLeft) {
      pdf.text(hf.headerLeft, page.margins.left, page.margins.top - 14);
    }
    if (hf.headerRight) {
      pdf.text(hf.headerRight, page.width - page.margins.right, page.margins.top - 14, { align: 'right' });
    }
    if (hf.lineY) {
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(page.margins.left, page.margins.top - 9, page.width - page.margins.right, page.margins.top - 9);
    }

    if (hf.footerLeft) {
      pdf.text(hf.footerLeft, page.margins.left, page.height - page.margins.bottom + 14);
    }
    if (hf.footerRight) {
      pdf.text(hf.footerRight, page.width - page.margins.right, page.height - page.margins.bottom + 14, { align: 'right' });
    }

    // 2. Render Page Boxes
    for (const box of page.boxes) {
      const rect = box.rect;

      if (box.backgroundColor) {
        const rgb = hexToRgb(box.backgroundColor);
        if (rgb) {
          pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
          if (box.borderRadius && box.borderRadius > 0) {
            pdf.roundedRect(rect.x, rect.y, rect.width, rect.height, box.borderRadius, box.borderRadius, 'F');
          } else {
            pdf.rect(rect.x, rect.y, rect.width, rect.height, 'F');
          }
        }
      }

      if (box.borderColor && box.borderWidth && box.borderWidth > 0) {
        const rgb = hexToRgb(box.borderColor);
        if (rgb) {
          pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
          pdf.setLineWidth(box.borderWidth);
          if (box.borderRadius && box.borderRadius > 0) {
            pdf.roundedRect(rect.x, rect.y, rect.width, rect.height, box.borderRadius, box.borderRadius, 'D');
          } else {
            pdf.rect(rect.x, rect.y, rect.width, rect.height, 'D');
          }
        }
      }

      // Draw Text Runs clipped inside box width
      for (const run of box.runs) {
        const fontStyle = run.style === 'bold' ? 'bold' : run.style === 'italic' ? 'italic' : 'normal';
        pdf.setFont(run.fontFamily || 'Helvetica', fontStyle);
        pdf.setFontSize(run.fontSize);

        const textRgb = hexToRgb(run.color) || [15, 23, 42];
        pdf.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

        const safeMaxWidth = Math.max(10, rect.width - run.x * 2);
        pdf.text(run.text, rect.x + run.x, rect.y + run.y + run.fontSize * 0.85, {
          maxWidth: safeMaxWidth,
        });
      }

      // Draw Formula Blocks scaled proportionally within BOTH width and height bounds
      for (const formula of box.formulas) {
        try {
          const formulaGraphic = await renderFormulaGraphic(
            formula.latex,
            formula.fontSize,
            box.borderColor || '#0f172a'
          );

          if (formulaGraphic.pngDataUri) {
            const scaleW = formula.width / Math.max(1, formulaGraphic.width);
            const scaleH = formula.height / Math.max(1, formulaGraphic.height);
            const fitScale = Math.min(1, scaleW, scaleH);
            const fitW = formulaGraphic.width * fitScale;
            const fitH = formulaGraphic.height * fitScale;
            const offsetY = Math.max(0, (formula.height - fitH) / 2);

            pdf.addImage(
              formulaGraphic.pngDataUri,
              'PNG',
              rect.x + formula.x,
              rect.y + formula.y + offsetY,
              fitW,
              fitH
            );
          } else {
            drawWrappedFallbackFormula(
              pdf,
              formula.latex,
              rect.x + formula.x,
              rect.y + formula.y,
              formula.width,
              formula.fontSize,
              false
            );
          }
        } catch {
          drawWrappedFallbackFormula(
            pdf,
            formula.latex,
            rect.x + formula.x,
            rect.y + formula.y,
            formula.width,
            formula.fontSize,
            true
          );
        }
      }
    }
  }

  if (docModel.bookmarks && docModel.bookmarks.length > 0) {
    for (const bm of docModel.bookmarks) {
      try {
        pdf.outline.add(null, bm.title, { pageNumber: bm.pageNumber });
      } catch {
        // Outline may not be supported on all jsPDF targets
      }
    }
  }

  const arrayBuffer = pdf.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}
