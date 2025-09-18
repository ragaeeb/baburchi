import { buildAhoCorasick } from './utils/ahocorasick';
import { buildBook, posToPage } from './utils/fuzzyUtils';
import { PATTERNS } from './utils/textUtils';

const INVALID_FOOTNOTE = '()';

/**
 * Checks if the given text contains invalid footnote references.
 * Invalid footnotes include empty parentheses "()" or OCR-confused characters
 * like ".1OV9" that were misrecognized instead of Arabic numerals.
 *
 * @param text - Text to check for invalid footnote patterns
 * @returns True if text contains invalid footnote references, false otherwise
 * @example
 * hasInvalidFootnotes('This text has ()') // Returns true
 * hasInvalidFootnotes('This text has (١)') // Returns false
 * hasInvalidFootnotes('OCR mistake (O)') // Returns true
 */
export const hasInvalidFootnotes = (text: string): boolean => {
    return PATTERNS.invalidReferenceRegex.test(text);
};

// Arabic number formatter instance
const arabicFormatter = new Intl.NumberFormat('ar-SA');

/**
 * Converts a number to Arabic-Indic numerals using the Intl.NumberFormat API.
 * Uses the 'ar-SA' locale to ensure proper Arabic numeral formatting.
 *
 * @param num - The number to convert to Arabic numerals
 * @returns String representation using Arabic-Indic digits (٠-٩)
 * @example
 * numberToArabic(123) // Returns '١٢٣'
 * numberToArabic(5) // Returns '٥'
 */
const numberToArabic = (num: number): string => {
    return arabicFormatter.format(num);
};

/**
 * Converts OCR-confused characters to their corresponding Arabic-Indic numerals.
 * Handles common OCR misrecognitions where Latin characters are mistaken for Arabic digits.
 *
 * @param char - Single character that may be an OCR mistake
 * @returns Corresponding Arabic-Indic numeral or original character if no mapping exists
 * @example
 * ocrToArabic('O') // Returns '٥' (O often confused with ٥)
 * ocrToArabic('1') // Returns '١' (1 often confused with ١)
 * ocrToArabic('.') // Returns '٠' (dot often confused with ٠)
 */
const ocrToArabic = (char: string): string => {
    const ocrToArabicMap: { [key: string]: string } = {
        '1': '١',
        '9': '٩',
        '.': '٠',
        O: '٥',
        o: '٥',
        V: '٧',
        v: '٧',
    };
    return ocrToArabicMap[char] || char;
};

/**
 * Parses Arabic-Indic numerals from a reference string and converts to a JavaScript number.
 * Removes parentheses and converts each Arabic-Indic digit to its Western equivalent.
 *
 * @param arabicStr - String containing Arabic-Indic numerals, typically in format '(١٢٣)'
 * @returns Parsed number, or 0 if parsing fails
 * @example
 * arabicToNumber('(١٢٣)') // Returns 123
 * arabicToNumber('(٥)') // Returns 5
 * arabicToNumber('invalid') // Returns 0
 */
const arabicToNumber = (arabicStr: string): number => {
    const lookup: { [key: string]: string } = {
        '٠': '0',
        '١': '1',
        '٢': '2',
        '٣': '3',
        '٤': '4',
        '٥': '5',
        '٦': '6',
        '٧': '7',
        '٨': '8',
        '٩': '9',
    };
    const digits = arabicStr.replace(/[()]/g, '');
    let numStr = '';
    for (const char of digits) {
        numStr += lookup[char];
    }
    const parsed = parseInt(numStr, 10);
    return isNaN(parsed) ? 0 : parsed;
};

type TextLine = {
    isFootnote?: boolean;
    text: string;
};

/**
 * Normalizes OCR-confused numerals inside reference markers to their Arabic equivalents.
 * This pass preserves all other text while ensuring subsequent matching operates on
 * consistent reference strings.
 *
 * @param lines - Array of text line objects with optional isFootnote flag
 * @returns A new array of lines with OCR digits converted inside parentheses
 * @example
 * const lines = [
 *   { text: 'Body with (O)', isFootnote: false },
 *   { text: '(1) Footnote text', isFootnote: true }
 * ];
 * const sanitized = sanitizeReferenceMarkers(lines);
 * // sanitized[0].text === 'Body with (٥)'
 * // sanitized[1].text === '(١) Footnote text'
 */
const sanitizeReferenceMarkers = <T extends TextLine>(lines: T[]): T[] => {
    return lines.map((line) => {
        const updatedText = line.text.replace(/\([.1OV9]+\)/g, (match) => {
            return match.replace(/[.1OV9]/g, (char) => ocrToArabic(char));
        });
        return { ...line, text: updatedText };
    });
};

type ReferenceData = {
    bodyCounts: Map<string, number>;
    footnoteCounts: Map<string, number>;
    hasInvalidPlaceholders: boolean;
    maxReferenceNumber: number;
    orderedBodyRefs: string[];
    orderedFootnoteRefs: string[];
};

const collectReferenceData = <T extends TextLine>(lines: T[]): ReferenceData => {
    const orderedBodyRefs: string[] = [];
    const orderedFootnoteRefs: string[] = [];
    const uniqueRefs = new Set<string>();

    for (const line of lines) {
        const matches = line.text.match(PATTERNS.arabicReferenceRegex) || [];
        if (matches.length === 0) {
            continue;
        }

        if (line.isFootnote) {
            orderedFootnoteRefs.push(...matches);
        } else {
            orderedBodyRefs.push(...matches);
        }

        for (const ref of matches) {
            uniqueRefs.add(ref);
        }
    }

    const patterns = [INVALID_FOOTNOTE, ...uniqueRefs];
    const { book, starts } = buildBook(lines.map((line) => line.text));
    const ac = buildAhoCorasick(patterns);

    const bodyCounts = new Map<string, number>();
    const footnoteCounts = new Map<string, number>();
    let hasInvalidPlaceholders = false;

    ac.find(book, (pid, endPos) => {
        const ref = patterns[pid]!;
        const startPos = endPos - ref.length;
        const pageIndex = posToPage(startPos, starts);
        const line = lines[pageIndex];
        if (!line) {
            return;
        }

        if (ref === INVALID_FOOTNOTE) {
            hasInvalidPlaceholders = true;
            return;
        }

        const target = line.isFootnote ? footnoteCounts : bodyCounts;
        target.set(ref, (target.get(ref) ?? 0) + 1);
    });

    let maxReferenceNumber = 0;
    for (const ref of uniqueRefs) {
        maxReferenceNumber = Math.max(maxReferenceNumber, arabicToNumber(ref));
    }

    return {
        bodyCounts,
        footnoteCounts,
        hasInvalidPlaceholders,
        maxReferenceNumber,
        orderedBodyRefs,
        orderedFootnoteRefs,
    };
};

const needsCorrection = (lines: TextLine[], data: ReferenceData) => {
    const mistakenReferences = lines.some((line) => hasInvalidFootnotes(line.text));
    if (mistakenReferences || data.hasInvalidPlaceholders) {
        return true;
    }

    const refs = new Set<string>([...data.bodyCounts.keys(), ...data.footnoteCounts.keys()]);

    for (const ref of refs) {
        if ((data.bodyCounts.get(ref) ?? 0) !== (data.footnoteCounts.get(ref) ?? 0)) {
            return true;
        }
    }

    return false;
};

const buildReferenceQueue = (
    orderedRefs: string[],
    source: Map<string, number>,
    target: Map<string, number>,
): string[] => {
    const queue: string[] = [];
    const seen = new Set<string>();

    for (const ref of orderedRefs) {
        if (seen.has(ref)) {
            continue;
        }
        seen.add(ref);

        const diff = (source.get(ref) ?? 0) - (target.get(ref) ?? 0);
        for (let i = 0; i < diff; i++) {
            queue.push(ref);
        }
    }

    return queue;
};

export const correctReferences = <T extends TextLine>(lines: T[]): T[] => {
    if (lines.length === 0) {
        return lines;
    }

    const sanitizedLines = sanitizeReferenceMarkers(lines);
    const referenceData = collectReferenceData(sanitizedLines);

    if (!needsCorrection(lines, referenceData)) {
        return lines;
    }

    const bodyRefsForFootnotes = buildReferenceQueue(
        [...new Set(referenceData.orderedBodyRefs)],
        referenceData.bodyCounts,
        referenceData.footnoteCounts,
    );
    const footnoteRefsForBody = buildReferenceQueue(
        [...new Set(referenceData.orderedFootnoteRefs)],
        referenceData.footnoteCounts,
        referenceData.bodyCounts,
    );

    const referenceCounter = { count: referenceData.maxReferenceNumber + 1 };

    return sanitizedLines.map((line) => {
        if (!line.text.includes(INVALID_FOOTNOTE)) {
            return line;
        }

        const updatedText = line.text.replace(/\(\)/g, () => {
            if (line.isFootnote) {
                const availableRef = bodyRefsForFootnotes.shift();
                if (availableRef) {
                    return availableRef;
                }
            } else {
                const availableRef = footnoteRefsForBody.shift();
                if (availableRef) {
                    return availableRef;
                }
            }

            const newRef = `(${numberToArabic(referenceCounter.count)})`;
            referenceCounter.count++;
            return newRef;
        });

        return { ...line, text: updatedText };
    });
};
