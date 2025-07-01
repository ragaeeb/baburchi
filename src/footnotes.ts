import { PATTERNS } from './textUtils';

const INVALID_FOOTNOTE = '()';

// Reusable function to detect if text has invalid footnotes
export const hasInvalidFootnotes = (text: string): boolean => {
    return PATTERNS.invalidReferenceRegex.test(text);
};

// Arabic number formatter instance
const arabicFormatter = new Intl.NumberFormat('ar-SA');

// Helper function to convert numbers to Arabic numerals using Intl
const numberToArabic = (num: number): string => {
    return arabicFormatter.format(num);
};

// Helper function to convert OCR-confused characters to Arabic numerals
const ocrToArabic = (char: string): string => {
    const ocrToArabicMap: { [key: string]: string } = {
        '1': '١',
        '9': '٩',
        '.': '٠',
        O: '٥',
        V: '٧',
    };
    return ocrToArabicMap[char] || char;
};

// Helper function to parse Arabic numerals from a reference string like '(١٢)'
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

// Extract all references from lines
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

// Check if corrections are needed
const needsCorrection = (lines: TextLine[], references: ReturnType<typeof extractReferences>) => {
    const mistakenReferences = lines.some((line) => hasInvalidFootnotes(line.text));
    if (mistakenReferences) return true;

    const bodySet = new Set(references.bodyReferences);
    const footnoteSet = new Set(references.footnoteReferences);
    if (bodySet.size !== footnoteSet.size) return true;

    // Check if the sets contain the same elements
    for (const ref of bodySet) {
        if (!footnoteSet.has(ref)) {
            return true;
        }
    }

    return false;
};

export const correctReferences = (lines: TextLine[]): TextLine[] => {
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
                if (availableRef) return availableRef;
            } else {
                // It's body text
                const availableRef = footnoteRefsForBody.shift();
                if (availableRef) return availableRef;
            }

            // If no available partner reference exists, generate a new one.
            const newRef = `(${numberToArabic(referenceCounter.count)})`;
            referenceCounter.count++;
            return newRef;
        });

        return { ...line, text: updatedText };
    });
};
