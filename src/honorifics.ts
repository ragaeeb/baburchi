import { sanitizeArabic } from './utils/sanitize';
import { isSimilarityAboveThreshold } from './utils/similarity';

const HONORIFIC_SOURCE =
    '[\\u0610-\\u0614\\uFBC3-\\uFBD2\\uFD40-\\uFD4F\\uFDC8-\\uFDCF\\uFDFA-\\uFDFB\\uFDFD-\\uFDFF\\u{10ED1}-\\u{10ED8}]';
const HONORIFIC_GLOBAL = new RegExp(HONORIFIC_SOURCE, 'gu');
const HONORIFIC_ANY = new RegExp(HONORIFIC_SOURCE, 'u');
const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu;
const MAX_GAP_WORDS = 4;
const CONTEXT_SIMILARITY = 0.8;

const EQUIVALENT_PHRASES: Readonly<Record<string, readonly string[]>> = {
    '\u0610': ['صلى الله عليه وسلم', 'صلي الله عليه وسلم'],
    '\u0611': ['عليه السلام'],
    '\u0612': ['رحمه الله', 'رحمه الله تعالى', 'رحمة الله عليه'],
    '\u0613': ['رضي الله عنه', 'رضي الله عنها', 'رضي الله عنهما', 'رضي الله عنهم', 'رضي الله عنهن'],
    '﵀': ['رحمه الله', 'رحمه الله تعالى', 'رحمة الله عليه'],
    '﵁': ['رضي الله عنه', 'رضي الله تعالى عنه'],
    '﵂': ['رضي الله عنها', 'رضي الله تعالى عنها'],
    '﵃': ['رضي الله عنهم', 'رضي الله تعالى عنهم'],
    '﵄': ['رضي الله عنهما', 'رضي الله تعالى عنهما'],
    '﵅': ['رضي الله عنهن'],
    '﵆': ['صلى الله عليه واله'],
    '﵇': ['عليه السلام'],
    '﵈': ['عليهم السلام'],
    '﵉': ['عليهما السلام'],
    '﵊': ['عليه الصلاة والسلام'],
    '﵋': ['قدس سره'],
    '﵌': ['صلى الله عليه واله وسلم'],
    '﵍': ['عليها السلام'],
    '﵎': ['تبارك وتعالى'],
    '﵏': ['رحمهم الله'],
    ﷺ: ['صلى الله عليه وسلم', 'صلي الله عليه وسلم'],
    ﷻ: ['جل جلاله', 'عز وجل'],
    '﷾': ['سبحانه وتعالى'],
    '﷿': ['عز وجل'],
};

type WordSpan = {
    end: number;
    normalized: string;
    start: number;
};

/** Evidence that one OCR stream probably corrupted an honorific visible in another stream. */
export type HonorificCorruption = {
    /** Honorific observed in the reference OCR. */
    honorific: string;
    /** Exclusive end offset of the suspected primary OCR span. */
    primaryEnd: number;
    /** Start offset of the suspected primary OCR span. */
    primaryStart: number;
    /** Exact suspected text from the primary OCR; empty means the glyph was omitted. */
    primaryText: string;
    /** Exclusive end offset of the honorific in the reference OCR. */
    referenceEnd: number;
    /** Start offset of the honorific in the reference OCR. */
    referenceStart: number;
};

const wordSpans = (text: string): WordSpan[] => {
    const withoutHonorifics = text.replace(HONORIFIC_GLOBAL, (honorific) => ' '.repeat(honorific.length));
    return [...withoutHonorifics.matchAll(WORD_PATTERN)].map((match) => ({
        end: match.index + match[0].length,
        normalized: sanitizeArabic(match[0], 'search'),
        start: match.index,
    }));
};

const matchesAt = (words: WordSpan[], start: number, expected: WordSpan[]): boolean =>
    expected.every((word, offset) => words[start + offset]?.normalized === word.normalized);

const contextMatchesAt = (words: WordSpan[], start: number, expected: WordSpan[]): boolean =>
    expected.every((word, offset) => {
        const actual = words[start + offset]?.normalized;
        return actual !== undefined && isSimilarityAboveThreshold(actual, word.normalized, CONTEXT_SIMILARITY, true);
    });

const trimWhitespace = (text: string, start: number, end: number): [number, number] => {
    while (start < end && /\s/u.test(text[start])) {
        start++;
    }
    while (end > start && /\s/u.test(text[end - 1])) {
        end--;
    }
    return [start, end];
};

const normalizedPhrase = (text: string): string => sanitizeArabic(text, { base: 'search', lettersAndSpacesOnly: true });

const isEquivalentPhrase = (text: string, honorific: string): boolean => {
    const normalized = normalizedPhrase(text);
    return (EQUIVALENT_PHRASES[honorific] ?? []).some((phrase) => normalized === normalizedPhrase(phrase));
};

const findAfterIndex = (words: WordSpan[], start: number, expected: WordSpan[]): number | null => {
    if (expected.length === 0) {
        return start;
    }

    const limit = Math.min(words.length, start + MAX_GAP_WORDS + 1);
    for (let index = start; index <= limit; index++) {
        if (contextMatchesAt(words, index, expected)) {
            return index;
        }
    }
    return null;
};

const locateGap = (
    primary: string,
    primaryWords: WordSpan[],
    before: WordSpan[],
    after: WordSpan[],
): null | [number, number] => {
    const matches: Array<[number, number]> = [];

    for (let index = 0; index <= primaryWords.length - before.length; index++) {
        if (before.length > 0 && !matchesAt(primaryWords, index, before)) {
            continue;
        }

        const gapWordStart = index + before.length;
        const afterIndex = findAfterIndex(primaryWords, gapWordStart, after);
        if (afterIndex !== null) {
            const start = before.length > 0 ? primaryWords[gapWordStart - 1]!.end : 0;
            const end = after.length > 0 ? primaryWords[afterIndex]!.start : primary.length;
            matches.push([start, end]);
        }
    }

    return matches.length === 1 ? matches[0]! : null;
};

/**
 * Finds high-confidence honorific corruption candidates by anchoring a glyph
 * observed by one OCR engine between the same surrounding words in another.
 * The function only returns evidence; it never edits or inserts source text.
 *
 * @param primaryText - OCR text suspected of corrupting or omitting an honorific.
 * @param referenceText - Independent OCR text that contains the honorific glyph.
 * @returns Unambiguous corruption candidates with exact offsets in both inputs.
 */
export const findHonorificCorruptions = (primaryText: string, referenceText: string): HonorificCorruption[] => {
    const primaryWords = wordSpans(primaryText);
    const referenceWords = wordSpans(referenceText);
    const results: HonorificCorruption[] = [];

    for (const match of referenceText.matchAll(HONORIFIC_GLOBAL)) {
        const referenceStart = match.index;
        const referenceEnd = referenceStart + match[0].length;
        const before = referenceWords.filter((word) => word.end <= referenceStart).slice(-2);
        const after = referenceWords.filter((word) => word.start >= referenceEnd).slice(0, 2);
        if (before.length === 0 && after.length === 0) {
            continue;
        }

        const gap = locateGap(primaryText, primaryWords, before, after);
        if (!gap) {
            continue;
        }

        const [primaryStart, primaryEnd] = trimWhitespace(primaryText, ...gap);
        const primaryCandidate = primaryText.slice(primaryStart, primaryEnd);
        if (HONORIFIC_ANY.test(primaryCandidate) || isEquivalentPhrase(primaryCandidate, match[0])) {
            continue;
        }

        results.push({
            honorific: match[0],
            primaryEnd,
            primaryStart,
            primaryText: primaryCandidate,
            referenceEnd,
            referenceStart,
        });
    }

    return results;
};

/**
 * Checks whether text contains a Unicode Arabic honorific sign or ligature.
 *
 * @param text - Text to inspect.
 * @returns True when at least one supported honorific code point is present.
 */
export const containsArabicHonorific = (text: string): boolean => {
    return HONORIFIC_ANY.test(text);
};
