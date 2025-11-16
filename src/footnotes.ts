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
    return Number.isNaN(parsed) ? 0 : parsed;
};

type TextLine = {
    isFootnote?: boolean;
    text: string;
};

/**
 * Extracts all footnote references from text lines, categorizing them by type and location.
 * Handles both Arabic-Indic numerals and OCR-confused characters in body text and footnotes.
 *
 * @param lines - Array of text line objects with optional isFootnote flag
 * @returns Object containing categorized reference arrays:
 *   - bodyReferences: All valid references found in body text
 *   - footnoteReferences: All valid references found in footnotes
 *   - ocrConfusedInBody: OCR-confused references in body text (for tracking)
 *   - ocrConfusedInFootnotes: OCR-confused references in footnotes (for tracking)
 * @example
 * const lines = [
 *   { text: 'Body with (١) and (O)', isFootnote: false },
 *   { text: '(١) Footnote text', isFootnote: true }
 * ];
 * const refs = extractReferences(lines);
 * // refs.bodyReferences contains ['(١)', '(٥)'] - OCR 'O' converted to '٥'
 */
const extractReferences = (lines: TextLine[]) => {
    const arabicReferencesInBody = lines
        .filter((b) => !b.isFootnote)
        .flatMap((b) => b.text.match(PATTERNS.arabicReferenceRegex) || []);

    const ocrConfusedReferencesInBody = lines
        .filter((b) => !b.isFootnote)
        .flatMap((b) => b.text.match(PATTERNS.ocrConfusedReferenceRegex) || []);

    const arabicReferencesInFootnotes = lines
        .filter((b) => b.isFootnote)
        .flatMap((b) => b.text.match(PATTERNS.arabicFootnoteReferenceRegex) || []);

    const ocrConfusedReferencesInFootnotes = lines
        .filter((b) => b.isFootnote)
        .flatMap((b) => b.text.match(PATTERNS.ocrConfusedFootnoteReferenceRegex) || []);

    const convertedOcrBodyRefs = ocrConfusedReferencesInBody.map((ref) =>
        ref.replace(/[.1OV9]/g, (char) => ocrToArabic(char)),
    );

    const convertedOcrFootnoteRefs = ocrConfusedReferencesInFootnotes.map((ref) =>
        ref.replace(/[.1OV9]/g, (char) => ocrToArabic(char)),
    );

    return {
        bodyReferences: [...arabicReferencesInBody, ...convertedOcrBodyRefs],
        footnoteReferences: [...arabicReferencesInFootnotes, ...convertedOcrFootnoteRefs],
        ocrConfusedInBody: ocrConfusedReferencesInBody,
        ocrConfusedInFootnotes: ocrConfusedReferencesInFootnotes,
    };
};

/**
 * Determines if footnote reference correction is needed by checking for:
 * 1. Invalid footnote patterns (empty parentheses, OCR mistakes)
 * 2. Mismatched sets of references between body text and footnotes
 * 3. Different counts of references in body vs footnotes
 *
 * @param lines - Array of text line objects to analyze
 * @param references - Extracted reference data from extractReferences()
 * @returns True if correction is needed, false if references are already correct
 * @example
 * const lines = [{ text: 'Text with ()', isFootnote: false }];
 * const refs = extractReferences(lines);
 * needsCorrection(lines, refs) // Returns true due to invalid "()" reference
 */
const needsCorrection = (lines: TextLine[], references: ReturnType<typeof extractReferences>) => {
    const mistakenReferences = lines.some((line) => hasInvalidFootnotes(line.text));
    if (mistakenReferences) {
        return true;
    }

    const bodySet = new Set(references.bodyReferences);
    const footnoteSet = new Set(references.footnoteReferences);
    if (bodySet.size !== footnoteSet.size) {
        return true;
    }

    // Check if the sets contain the same elements
    for (const ref of bodySet) {
        if (!footnoteSet.has(ref)) {
            return true;
        }
    }

    return false;
};

/**
 * Corrects footnote references in an array of text lines by:
 * 1. Converting OCR-confused characters to proper Arabic numerals
 * 2. Filling in empty "()" references with appropriate numbers
 * 3. Ensuring footnote references in body text match those in footnotes
 * 4. Generating new reference numbers when needed
 *
 * @param lines - Array of text line objects, each with optional isFootnote flag
 * @returns Array of corrected text lines with proper footnote references
 * @example
 * const lines = [
 *   { text: 'Main text with ()', isFootnote: false },
 *   { text: '() This is a footnote', isFootnote: true }
 * ];
 * const corrected = correctReferences(lines);
 * // Returns lines with "()" replaced by proper Arabic numerals like "(١)"
 */
export const correctReferences = <T extends TextLine>(lines: T[]): T[] => {
    const initialReferences = extractReferences(lines);

    if (!needsCorrection(lines, initialReferences)) {
        return lines;
    }

    // Pass 1: Sanitize lines by correcting only OCR characters inside reference markers.
    const sanitizedLines = lines.map((line) => {
        let updatedText = line.text;
        // This regex finds the full reference, e.g., "(O)" or "(1)"
        const ocrRegex = /\([.1OV9]+\)/g;
        updatedText = updatedText.replace(ocrRegex, (match) => {
            // This replace acts *inside* the found match, e.g., on "O" or "1"
            return match.replace(/[.1OV9]/g, (char) => ocrToArabic(char));
        });
        return { ...line, text: updatedText };
    });

    // Pass 2: Analyze the sanitized lines to get a clear and accurate picture of references.
    const cleanReferences = extractReferences(sanitizedLines);

    // Step 3: Create queues of "unmatched" references for two-way pairing.
    const bodyRefSet = new Set(cleanReferences.bodyReferences);
    const footnoteRefSet = new Set(cleanReferences.footnoteReferences);

    const uniqueBodyRefs = [...new Set(cleanReferences.bodyReferences)];
    const uniqueFootnoteRefs = [...new Set(cleanReferences.footnoteReferences)];

    // Queue 1: Body references available for footnotes.
    const bodyRefsForFootnotes = uniqueBodyRefs.filter((ref) => !footnoteRefSet.has(ref));
    // Queue 2: Footnote references available for the body.
    const footnoteRefsForBody = uniqueFootnoteRefs.filter((ref) => !bodyRefSet.has(ref));

    // Step 4: Determine the starting point for any completely new reference numbers.
    const allRefs = [...bodyRefSet, ...footnoteRefSet];
    const maxRefNum = allRefs.length > 0 ? Math.max(0, ...allRefs.map((ref) => arabicToNumber(ref))) : 0;
    const referenceCounter = { count: maxRefNum + 1 };

    // Step 5: Map over the sanitized lines, filling in '()' using the queues.
    return sanitizedLines.map((line) => {
        if (!line.text.includes(INVALID_FOOTNOTE)) {
            return line;
        }
        let updatedText = line.text;

        updatedText = updatedText.replace(/\(\)/g, () => {
            if (line.isFootnote) {
                const availableRef = bodyRefsForFootnotes.shift();
                if (availableRef) {
                    return availableRef;
                }
            } else {
                // It's body text
                const availableRef = footnoteRefsForBody.shift();
                if (availableRef) {
                    return availableRef;
                }
            }

            // If no available partner reference exists, generate a new one.
            const newRef = `(${numberToArabic(referenceCounter.count)})`;
            referenceCounter.count++;
            return newRef;
        });

        return { ...line, text: updatedText };
    });
};
