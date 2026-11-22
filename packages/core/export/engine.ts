import type {
  ExportOptions,
  BoxItem,
  TextRun,
  FormulaBlock,
  PageModel,
  DocumentModel,
  CardOverride,
  Margins,
} from './types.js';
import {
  getPageDimensions,
  getMargins,
  wrapText,
  measureTextWidth,
  getColorPalette,
  formatLatexForPdfText,
} from './geometry.js';
import { resolveCardTerm, type TermDefinition } from '../model/index.js';
import { detectFormulaTerms } from '../math/terms.js';

export interface CardSourceData {
  id: string;
  category: string;
  title: string;
  prompt?: string;
  shortPrompt?: string;
  latexAnswer: string;
  hint?: string;
  cheatSheetNote?: string;
  explanation?: string;
  terms?: TermDefinition[];
  order?: number;
  difficulty?: number;
  mastery?: number;
}

export interface SetSourceData {
  id: string;
  name: string;
  category?: string;
  cards: CardSourceData[];
  glossary?: Record<string, TermDefinition>;
}

const CATEGORY_ACCENT_COLORS = [
  '#2563eb', // blue
  '#0d9488', // teal
  '#7c3aed', // purple
  '#c026d3', // fuchsia
  '#ea580c', // orange
  '#16a34a', // green
  '#db2777', // pink
  '#4f46e5', // indigo
];

function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CATEGORY_ACCENT_COLORS.length;
  return CATEGORY_ACCENT_COLORS[idx];
}

interface MeasuredCardLayout {
  height: number;
  runs: TextRun[];
  formulas: FormulaBlock[];
  warning?: string;
}

interface SizedCardBox {
  id: string;
  type: 'card';
  card: CardSourceData;
  override?: CardOverride;
  measured: MeasuredCardLayout;
  desiredHeight: number;
  spanAllColumns: boolean;
  pageBreakBefore: boolean;
  keepTogether: boolean;
  categoryColor: string;
}

interface SizedCategoryBox {
  id: string;
  type: 'category-header';
  title: string;
  desiredHeight: number;
  spanAllColumns: boolean;
  pageBreakBefore: boolean;
  keepTogether: boolean;
}

type SizedItem = SizedCardBox | SizedCategoryBox;

/**
 * Estimates formula bounding height in points based on LaTeX structure and box width.
 */
function estimateFormulaHeight(latex: string, fontSize: number, maxWidth: number): number {
  if (!latex) return 0;
  const lineBreaks = (latex.match(/\\\\/g) || []).length;
  let rowMult = 1.85;
  if (latex.includes('\\frac') || latex.includes('\\dfrac') || latex.includes('\\tfrac')) {
    rowMult += 0.9;
  }
  if (latex.includes('\\sum') || latex.includes('\\int') || latex.includes('\\prod') || latex.includes('\\oint')) {
    rowMult += 0.75;
  }
  if (latex.includes('\\begin{')) {
    rowMult += 0.6 + lineBreaks * 1.15;
  }
  if (latex.includes('\\sqrt')) {
    rowMult += 0.35;
  }
  const approxCleanLen = formatLatexForPdfText(latex).length;
  const approxNaturalW = approxCleanLen * fontSize * 0.55;
  const wrappedLines = maxWidth > 0 ? Math.max(1, Math.ceil(approxNaturalW / maxWidth)) : 1;
  const baseH = fontSize * rowMult;
  return Math.max(baseH, wrappedLines * fontSize * 1.35, 22);
}

function resolveCardTermsForExport(
  card: CardSourceData,
  formulaText: string,
  setGlossary?: Record<string, TermDefinition>
): TermDefinition[] {
  if (card.terms && card.terms.length > 0) {
    if (!setGlossary) return card.terms;
    return card.terms.map((t) => {
      const merged = resolveCardTerm(t.symbol, [t], setGlossary);
      return merged || t;
    });
  }
  if (!setGlossary || !formulaText) return [];
  const detected = detectFormulaTerms(formulaText);
  const resolved: TermDefinition[] = [];
  for (const sym of detected) {
    const found = resolveCardTerm(sym, undefined, setGlossary);
    if (found && (found.name || found.shortName || found.definition || found.shortDefinition)) {
      resolved.push(found);
    }
  }
  return resolved;
}

/**
 * Computes layout runs, formulas, and height for a single card box.
 */
function measureCardBox(
  card: CardSourceData,
  index: number,
  colWidth: number,
  options: ExportOptions,
  override?: CardOverride,
  setGlossary?: Record<string, TermDefinition>
): MeasuredCardLayout {
  const scale = options.globalScale * (override?.fontSizeOverride ? override.fontSizeOverride / 10 : 1);
  const titleFont = options.titleFontSize * scale;
  const bodyFont = options.bodyFontSize * scale;
  const formulaFont = options.formulaFontSize * scale * options.formulaScale;
  const hintFont = options.hintFontSize * scale;
  const termsFont = options.termsFontSize * scale;
  const fontFamily = options.fontFamily;
  const lineSpacing = options.lineSpacing;
  const isCompactMode = options.cardLayoutMode === 'answer-key' || options.onlyShowFormulas;
  const padding = options.containerStyle === 'plain' ? 4 : isCompactMode ? 6 : 7;
  const innerWidth = Math.max(16, colWidth - padding * 2);

  const palette = getColorPalette(
    options.colorTheme,
    options.useCategoryColors ? getCategoryColor(card.category || 'General') : undefined
  );

  // Effective flags: per-card override takes precedence over global options
  const isFormulaOnly = options.onlyShowFormulas || options.cardLayoutMode === 'formula-only';
  const isAnswerKey = !options.onlyShowFormulas && options.cardLayoutMode === 'answer-key';
  const useShort = override?.useCheatSheetVersion ?? options.useCheatSheetVersion;

  const showTitle = override?.showCardTitle ?? (options.onlyShowFormulas ? false : options.showCardTitle);
  const showPrompt =
    override?.showPrompt ?? (!isFormulaOnly && !isAnswerKey && options.showPrompt);
  const showFormula = override?.showFormula ?? options.showFormula;
  const showHint =
    override?.showHint ??
    (override?.hideHint !== undefined ? !override.hideHint : (!isFormulaOnly && !isAnswerKey && options.showHint));

  const showTermNames = override?.showTermNames ?? options.showTermNames;
  const showTermDefs = override?.showTermDefinitions ?? options.showTermDefinitions;
  const showUnits = override?.showUnits ?? options.showUnits;
  const hasAnyTermContent = showTermNames || showTermDefs || showUnits;
  const showTerms =
    override?.showTerms ?? (options.showTerms && options.termsMode !== 'none' && hasAnyTermContent);
  const showCheatNote =
    override?.showCheatSheetNote ?? (!isFormulaOnly && options.showCheatSheetNotes);

  const runs: TextRun[] = [];
  const formulas: FormulaBlock[] = [];
  let currentY = padding;
  let cardWarning: string | undefined;

  // 1. Header: Number, Title, Category
  const rawTitle = override?.customTitle !== undefined ? override.customTitle : card.title;
  const cleanTitle = formatLatexForPdfText(rawTitle);
  const numberText = options.showCardNumber ? `#${index + 1} ` : '';
  const answerKeyCatTag = isAnswerKey && card.category ? ` [${card.category}]` : '';
  const fullTitle = `${numberText}${cleanTitle}${answerKeyCatTag}`.trim();

  if (showTitle && fullTitle) {
    const titleLines = wrapText(fullTitle, innerWidth, titleFont, fontFamily, true);
    for (const line of titleLines) {
      const lineH = titleFont * lineSpacing;
      runs.push({
        type: 'text',
        text: line,
        x: padding,
        y: currentY,
        width: measureTextWidth(line, titleFont, fontFamily, true),
        height: lineH,
        fontSize: titleFont,
        fontFamily,
        style: 'bold',
        color: palette.textPrimary,
      });
      currentY += lineH;
    }
    currentY += 1.5;
  }

  if (options.showCategoryLabel && !isAnswerKey && !isFormulaOnly && card.category) {
    const catText = card.category.toUpperCase();
    const catLines = wrapText(catText, innerWidth, hintFont, fontFamily, true);
    for (const line of catLines) {
      const catH = hintFont * lineSpacing;
      runs.push({
        type: 'text',
        text: line,
        x: padding,
        y: currentY,
        width: measureTextWidth(line, hintFont, fontFamily, true),
        height: catH,
        fontSize: hintFont,
        fontFamily,
        style: 'bold',
        color: palette.accent,
      });
      currentY += catH;
    }
    currentY += 2;
  }

  // 2. Prompt (omitted in formula-only and compact answer-key modes unless overridden)
  const rawPrompt =
    override?.replacementPrompt !== undefined
      ? override.replacementPrompt
      : useShort && card.shortPrompt
      ? card.shortPrompt
      : card.prompt;

  if (showPrompt && rawPrompt) {
    const cleanPrompt = formatLatexForPdfText(rawPrompt);
    if (cleanPrompt) {
      const promptLines = wrapText(cleanPrompt, innerWidth, bodyFont, fontFamily, false);
      for (const line of promptLines) {
        const lineH = bodyFont * lineSpacing;
        runs.push({
          type: 'text',
          text: line,
          x: padding,
          y: currentY,
          width: measureTextWidth(line, bodyFont, fontFamily, false),
          height: lineH,
          fontSize: bodyFont,
          fontFamily,
          style: 'regular',
          color: palette.textSecondary,
        });
        currentY += lineH;
      }
      currentY += 2.5;
    }
  }

  // 3. Formula block
  const formulaText =
    override?.replacementFormula !== undefined ? override.replacementFormula : card.latexAnswer;

  if (showFormula && formulaText) {
    const formulaH = estimateFormulaHeight(formulaText, formulaFont, innerWidth);
    formulas.push({
      type: 'formula',
      latex: formulaText,
      x: padding,
      y: currentY,
      width: innerWidth,
      height: formulaH,
      fontSize: formulaFont,
      altText: formulaText,
    });
    currentY += formulaH + 4;
  }

  // 4. Cheat sheet extra note / explanation summary
  const rawCheatNote =
    override?.cheatSheetNote !== undefined
      ? override.cheatSheetNote
      : useShort
      ? card.cheatSheetNote
      : card.explanation || card.cheatSheetNote;

  if (showCheatNote && rawCheatNote) {
    const cleanNote = formatLatexForPdfText(rawCheatNote);
    if (cleanNote) {
      const prefix = isAnswerKey ? 'Key: ' : '';
      const cheatLines = wrapText(`${prefix}${cleanNote}`, innerWidth, hintFont, fontFamily, false);
      for (const line of cheatLines) {
        const lineH = hintFont * lineSpacing;
        runs.push({
          type: 'text',
          text: line,
          x: padding,
          y: currentY,
          width: measureTextWidth(line, hintFont, fontFamily, false),
          height: lineH,
          fontSize: hintFont,
          fontFamily,
          style: 'italic',
          color: palette.textSecondary,
        });
        currentY += lineH;
      }
      currentY += 2;
    }
  }

  // 5. Hint (when enabled)
  if (showHint && card.hint) {
    const cleanHint = formatLatexForPdfText(card.hint);
    if (cleanHint) {
      const hintLines = wrapText(`Hint: ${cleanHint}`, innerWidth, hintFont, fontFamily, false);
      for (const line of hintLines) {
        const lineH = hintFont * lineSpacing;
        runs.push({
          type: 'text',
          text: line,
          x: padding,
          y: currentY,
          width: measureTextWidth(line, hintFont, fontFamily, false),
          height: lineH,
          fontSize: hintFont,
          fontFamily,
          style: 'italic',
          color: palette.textMuted,
        });
        currentY += lineH;
      }
      currentY += 2;
    }
  }

  // 6. Term definitions (resolves card.terms + setGlossary fallback)
  if (showTerms && options.termsMode !== 'none') {
    let termsToRender = resolveCardTermsForExport(card, formulaText, setGlossary);
    if (options.termsFilter === 'only-with-units') {
      termsToRender = termsToRender.filter((t) => !!t.units && t.units !== 'variable');
    } else if (options.termsFilter === 'exclude-undefined') {
      termsToRender = termsToRender.filter(
        (t) => !!t.definition || !!t.shortDefinition || !!t.name || !!t.shortName
      );
    }

    const formatTermText = (t: TermDefinition): string => {
      const sym = formatLatexForPdfText(t.symbol);
      const namePart = showTermNames ? formatLatexForPdfText((useShort ? t.shortName : undefined) || t.name || '') : '';
      const defPart = showTermDefs ? formatLatexForPdfText((useShort ? t.shortDefinition : undefined) || t.definition || '') : '';
      const unitPart = showUnits && t.units && t.units !== 'variable' ? ` [${formatLatexForPdfText(t.units)}]` : '';

      let desc = '';
      if (namePart && defPart && namePart.toLowerCase() !== defPart.toLowerCase()) {
        desc = `${namePart} - ${defPart}`;
      } else {
        desc = namePart || defPart;
      }
      return desc ? `${sym}: ${desc}${unitPart}` : `${sym}${unitPart}`;
    };

    if (termsToRender.length > 0) {
      if (options.termsMode === 'compact-inline') {
        const termsStr = termsToRender.map(formatTermText).join(' | ');
        const termLines = wrapText(termsStr, innerWidth, termsFont, fontFamily, false);
        for (const line of termLines) {
          const lineH = termsFont * lineSpacing;
          runs.push({
            type: 'text',
            text: line,
            x: padding,
            y: currentY,
            width: measureTextWidth(line, termsFont, fontFamily, false),
            height: lineH,
            fontSize: termsFont,
            fontFamily,
            style: 'regular',
            color: palette.textMuted,
          });
          currentY += lineH;
        }
      } else if (options.termsMode === 'table') {
        for (const t of termsToRender) {
          const rowText = formatTermText(t);
          const tLines = wrapText(rowText, innerWidth, termsFont, fontFamily, false);
          for (const line of tLines) {
            const lineH = termsFont * lineSpacing;
            runs.push({
              type: 'text',
              text: line,
              x: padding,
              y: currentY,
              width: measureTextWidth(line, termsFont, fontFamily, false),
              height: lineH,
              fontSize: termsFont,
              fontFamily,
              style: 'regular',
              color: palette.textSecondary,
            });
            currentY += lineH;
          }
        }
      } else if (options.termsMode === 'footnote') {
        for (let i = 0; i < termsToRender.length; i++) {
          const fnText = `[${i + 1}] ${formatTermText(termsToRender[i])}`;
          const fnFont = termsFont * 0.92;
          const fnLines = wrapText(fnText, innerWidth, fnFont, fontFamily, false);
          for (const line of fnLines) {
            const lineH = fnFont * lineSpacing;
            runs.push({
              type: 'text',
              text: line,
              x: padding,
              y: currentY,
              width: measureTextWidth(line, fnFont, fontFamily, false),
              height: lineH,
              fontSize: fnFont,
              fontFamily,
              style: 'regular',
              color: palette.textMuted,
            });
            currentY += lineH;
          }
        }
      }
      currentY += 2;
    }
  }

  // 7. Custom Card User Note (per-card override)
  if (options.showNotes && override?.note) {
    const cleanCustomNote = formatLatexForPdfText(override.note);
    const noteLines = wrapText(`Note: ${cleanCustomNote}`, innerWidth, hintFont, fontFamily, false);
    for (const line of noteLines) {
      const lineH = hintFont * lineSpacing;
      runs.push({
        type: 'text',
        text: line,
        x: padding,
        y: currentY,
        width: measureTextWidth(line, hintFont, fontFamily, false),
        height: lineH,
        fontSize: hintFont,
        fontFamily,
        style: 'italic',
        color: palette.textSecondary,
      });
      currentY += lineH;
    }
    currentY += 2;
  }

  const finalHeight = Math.max(currentY + padding + 2, 24);

  if (titleFont < 6 || bodyFont < 6 || formulaFont < 6) {
    cardWarning = 'Effective font size is below 6 pt. Text may be hard to read when printed.';
  }

  return { height: finalHeight, runs, formulas, warning: cardWarning };
}

function sortCards(cards: CardSourceData[], sortOrder: ExportOptions['sortOrder']): CardSourceData[] {
  const result = [...cards];
  switch (sortOrder) {
    case 'alphabetical':
      return result.sort((a, b) => a.title.localeCompare(b.title));
    case 'category':
      return result.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.title.localeCompare(b.title));
    case 'difficulty':
      return result.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
    case 'mastery':
      return result.sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
    case 'shuffled':
      return result.sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return (hashA % 31) - (hashB % 31);
      });
    case 'original':
    default:
      return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}

function buildAppendixAndToc(
  cards: CardSourceData[],
  options: ExportOptions,
  setGlossary?: Record<string, TermDefinition>
): { appendixItems: CardSourceData[]; tocCategories: string[] } {
  const tocCategories: string[] = [];
  const seenCats = new Set<string>();
  for (const c of cards) {
    const cat = c.category || 'General';
    if (!seenCats.has(cat)) {
      seenCats.add(cat);
      tocCategories.push(cat);
    }
  }

  if (!options.includeGlossaryAppendix) {
    return { appendixItems: [], tocCategories };
  }

  const termMap = new Map<string, TermDefinition>();
  if (setGlossary) {
    for (const [key, term] of Object.entries(setGlossary)) {
      termMap.set(key, term);
    }
  }

  for (const c of cards) {
    if (c.terms) {
      for (const t of c.terms) {
        if (!termMap.has(t.symbol) || (!termMap.get(t.symbol)?.definition && t.definition)) {
          termMap.set(t.symbol, t);
        }
      }
    }
  }

  const sortedTerms = Array.from(termMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const appendixCards: CardSourceData[] = sortedTerms.map((t, idx) => ({
    id: `glossary-term-${idx}`,
    category: 'Appendix: Glossary',
    title: formatLatexForPdfText(t.name || t.symbol),
    prompt: t.shortDefinition || t.definition || 'Symbol definition',
    shortPrompt: t.shortName || t.name || 'Symbol',
    latexAnswer: t.symbol,
    cheatSheetNote: t.definition ? `${t.definition}${t.units ? ` [${t.units}]` : ''}` : undefined,
    explanation: t.definition ? `${t.definition}${t.units ? ` (Units: ${t.units})` : ''}` : undefined,
  }));

  return { appendixItems: appendixCards, tocCategories };
}

export function layoutDocument(
  setData: SetSourceData,
  options: ExportOptions
): DocumentModel {
  const { width: pageWidth, height: pageHeight } = getPageDimensions(
    options.pageSize,
    options.orientation,
    options.customPageDimensions
  );

  const rawMargins = getMargins(options.marginPreset, options.customMargins);
  const hasHeader = Boolean(options.headerText || options.showDateInHeader);
  const hasFooter = Boolean(options.footerCustomText || options.showPageNumbers);
  const margins: Margins = {
    top: hasHeader ? Math.max(28, rawMargins.top) : rawMargins.top,
    right: rawMargins.right,
    bottom: hasFooter ? Math.max(28, rawMargins.bottom) : rawMargins.bottom,
    left: rawMargins.left,
  };

  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;

  let activeCards = setData.cards;
  if (options.selectedCardIds && options.selectedCardIds.length > 0) {
    const selectedSet = new Set(options.selectedCardIds);
    activeCards = activeCards.filter((c) => selectedSet.has(c.id));
  }

  activeCards = sortCards(activeCards, options.sortOrder);

  const { appendixItems, tocCategories } = buildAppendixAndToc(
    activeCards,
    options,
    setData.glossary
  );

  const allItemsToLayout: CardSourceData[] = [...activeCards];
  if (options.includeGlossaryAppendix) {
    allItemsToLayout.push(...appendixItems);
  }

  const cols = Math.max(1, Math.min(6, options.columns));
  const colGap = options.columnGap;
  const rowGap = options.rowGap;
  const standardColWidth = (contentWidth - (cols - 1) * colGap) / cols;

  const docWarnings: string[] = [];
  const itemsWithCategories: SizedItem[] = [];
  let lastCategory = '';
  let cardNumberCounter = 0;

  for (let i = 0; i < allItemsToLayout.length; i++) {
    const card = allItemsToLayout[i];
    const cat = card.category || 'General';

    if (options.groupByCategory && cat !== lastCategory) {
      lastCategory = cat;
      itemsWithCategories.push({
        id: `cat-header-${cat}`,
        type: 'category-header',
        title: cat,
        desiredHeight: 22 * options.globalScale,
        spanAllColumns: true,
        pageBreakBefore: false,
        keepTogether: true,
      });
    }

    const override = options.cardOverrides[card.id];
    const isSpan = override?.spanAllColumns ?? false;
    const cardColW = isSpan ? contentWidth : standardColWidth;
    const measured = measureCardBox(card, cardNumberCounter, cardColW, options, override, setData.glossary);
    cardNumberCounter++;

    itemsWithCategories.push({
      id: card.id,
      type: 'card',
      card,
      override,
      measured,
      desiredHeight: measured.height,
      spanAllColumns: isSpan,
      pageBreakBefore: override?.pageBreakBefore ?? false,
      keepTogether: override?.keepTogether ?? options.keepCardsTogether,
      categoryColor: options.useCategoryColors ? getCategoryColor(cat) : '#3b82f6',
    });
  }

  interface PageState {
    pageNumber: number;
    boxes: BoxItem[];
    colHeights: number[];
  }

  const pages: PageState[] = [];

  function createNewPage(): PageState {
    const newPage: PageState = {
      pageNumber: pages.length + 1,
      boxes: [],
      colHeights: new Array(cols).fill(0),
    };
    pages.push(newPage);
    return newPage;
  }

  if (itemsWithCategories.length === 0) {
    createNewPage();
  } else {
    let currentPage = createNewPage();

    for (let itemIdx = 0; itemIdx < itemsWithCategories.length; itemIdx++) {
      const item = itemsWithCategories[itemIdx];

      if (item.pageBreakBefore && currentPage.boxes.length > 0) {
        currentPage = createNewPage();
      }

      if (item.type === 'category-header') {
        const maxCurrentColH = Math.max(...currentPage.colHeights);
        if (maxCurrentColH + item.desiredHeight > contentHeight && currentPage.boxes.length > 0) {
          currentPage = createNewPage();
        }
        const yTop = Math.max(...currentPage.colHeights);
        const headerRect = {
          x: margins.left,
          y: margins.top + yTop,
          width: contentWidth,
          height: item.desiredHeight,
        };

        const headerPalette = getColorPalette(options.colorTheme, getCategoryColor(item.title));
        const textH = 11 * options.globalScale;

        currentPage.boxes.push({
          id: item.id,
          type: 'category-header',
          rect: headerRect,
          backgroundColor: options.colorTheme === 'color' ? `${headerPalette.accent}15` : undefined,
          borderColor: headerPalette.accent,
          borderWidth: 1,
          runs: [
            {
              type: 'text',
              text: item.title.toUpperCase(),
              x: 4,
              y: (item.desiredHeight - textH) / 2,
              width: contentWidth - 8,
              height: textH,
              fontSize: textH,
              fontFamily: options.fontFamily,
              style: 'bold',
              color: headerPalette.accent,
            },
          ],
          formulas: [],
        });

        const newH = yTop + item.desiredHeight + rowGap;
        for (let c = 0; c < cols; c++) {
          currentPage.colHeights[c] = newH;
        }
        continue;
      }

      const isSpan = item.spanAllColumns;
      const palette = getColorPalette(options.colorTheme, item.categoryColor);
      const measured = item.measured;

      if (measured.warning && !docWarnings.includes(measured.warning)) {
        docWarnings.push(measured.warning);
      }

      const boxHeight = measured.height;
      let placed = false;

      if (isSpan) {
        const maxH = Math.max(...currentPage.colHeights);
        if (maxH + boxHeight > contentHeight && currentPage.boxes.length > 0) {
          currentPage = createNewPage();
        }
        const yTop = Math.max(...currentPage.colHeights);
        const boxRect = {
          x: margins.left,
          y: margins.top + yTop,
          width: contentWidth,
          height: boxHeight,
        };

        currentPage.boxes.push({
          id: item.id,
          cardId: item.card.id,
          type: 'card',
          rect: boxRect,
          backgroundColor: options.containerStyle === 'shaded' ? palette.bgCard : undefined,
          borderColor: options.containerStyle === 'boxed' || options.containerStyle === 'ruled' ? palette.borderCard : undefined,
          borderWidth: options.containerStyle === 'plain' ? 0 : options.ruleWeight,
          borderRadius: options.containerStyle === 'boxed' ? options.borderRadius : 0,
          runs: measured.runs,
          formulas: measured.formulas,
          warning: measured.warning,
        });

        const newH = yTop + boxHeight + rowGap;
        for (let c = 0; c < cols; c++) {
          currentPage.colHeights[c] = newH;
        }
        placed = true;
      } else {
        let bestCol = 0;
        if (options.fillOrder === 'across-rows') {
          let minH = Infinity;
          for (let c = 0; c < cols; c++) {
            if (currentPage.colHeights[c] < minH) {
              minH = currentPage.colHeights[c];
              bestCol = c;
            }
          }
        } else {
          for (let c = 0; c < cols; c++) {
            if (currentPage.colHeights[c] + boxHeight <= contentHeight) {
              bestCol = c;
              placed = true;
              break;
            }
          }
        }

        if (!placed && currentPage.colHeights[bestCol] + boxHeight > contentHeight && currentPage.boxes.length > 0) {
          currentPage = createNewPage();
          bestCol = 0;
        }

        const colX = margins.left + bestCol * (standardColWidth + colGap);
        const colY = margins.top + currentPage.colHeights[bestCol];

        const boxRect = {
          x: colX,
          y: colY,
          width: standardColWidth,
          height: boxHeight,
        };

        currentPage.boxes.push({
          id: item.id,
          cardId: item.card.id,
          type: 'card',
          rect: boxRect,
          backgroundColor: options.containerStyle === 'shaded' ? palette.bgCard : undefined,
          borderColor: options.containerStyle === 'boxed' || options.containerStyle === 'ruled' ? palette.borderCard : undefined,
          borderWidth: options.containerStyle === 'plain' ? 0 : options.ruleWeight,
          borderRadius: options.containerStyle === 'boxed' ? options.borderRadius : 0,
          runs: measured.runs,
          formulas: measured.formulas,
          warning: measured.warning,
        });

        currentPage.colHeights[bestCol] += boxHeight + rowGap;
      }
    }
  }

  const totalPages = pages.length;
  const formattedPages: PageModel[] = pages.map((p) => {
    const pageHeader = options.headerText.replace('{setName}', setData.name || 'Formula Flash');
    const headerDate = options.showDateInHeader ? new Date().toLocaleDateString() : '';

    return {
      pageNumber: p.pageNumber,
      totalPages,
      width: pageWidth,
      height: pageHeight,
      margins,
      boxes: p.boxes,
      headerFooter: {
        headerLeft: pageHeader,
        headerRight: headerDate,
        footerLeft: options.footerCustomText,
        footerRight: options.showPageNumbers ? `Page ${p.pageNumber} of ${totalPages}` : undefined,
        lineY: margins.top - 10,
      },
    };
  });

  const bookmarks: Array<{ title: string; pageNumber: number; level: number }> = [];
  if (options.generatePdfBookmarks) {
    bookmarks.push({ title: setData.name || 'Cheat Sheet', pageNumber: 1, level: 1 });
    if (options.groupByCategory) {
      for (const cat of tocCategories) {
        const targetPage = formattedPages.find((p) =>
          p.boxes.some((b) => b.type === 'category-header' && b.runs.some((r) => r.text === cat.toUpperCase()))
        );
        bookmarks.push({
          title: cat,
          pageNumber: targetPage ? targetPage.pageNumber : 1,
          level: 2,
        });
      }
    }
    if (options.includeGlossaryAppendix) {
      const targetPage = formattedPages.find((p) =>
        p.boxes.some((b) => b.type === 'category-header' && b.runs.some((r) => r.text.includes('APPENDIX')))
      );
      if (targetPage) {
        bookmarks.push({ title: 'Appendix: Glossary', pageNumber: targetPage.pageNumber, level: 1 });
      }
    }
  }

  return {
    id: `doc-${Date.now()}`,
    title: `${setData.name} - Cheat Sheet`,
    author: 'Formula Flash',
    subject: setData.category || 'Study Material',
    keywords: ['flashcards', 'formulas', 'cheat sheet', setData.name],
    options,
    pages: formattedPages,
    bookmarks,
    warnings: docWarnings,
  };
}

/**
 * Fit-to-N-Pages auto-scaling mode via binary search over globalScale.
 */
export function layoutWithAutoFit(
  setData: SetSourceData,
  options: ExportOptions
): DocumentModel {
  if (!options.fitToPageCount || options.fitToPageCount <= 0 || setData.cards.length === 0) {
    return layoutDocument(setData, options);
  }

  const targetPages = options.fitToPageCount;
  let lowScale = 0.4;
  let highScale = 2.0;
  let bestDoc = layoutDocument(setData, { ...options, globalScale: lowScale });

  if (bestDoc.pages.length > targetPages) {
    bestDoc.warnings.push(`Could not fit all cards onto ${targetPages} pages even at minimum font size.`);
    return bestDoc;
  }

  for (let iter = 0; iter < 8; iter++) {
    const midScale = (lowScale + highScale) / 2;
    const testDoc = layoutDocument(setData, { ...options, globalScale: midScale });

    if (testDoc.pages.length <= targetPages) {
      bestDoc = testDoc;
      lowScale = midScale;
    } else {
      highScale = midScale;
    }
  }

  return bestDoc;
}
