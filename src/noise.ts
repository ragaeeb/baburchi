import { PATTERNS } from './textUtils';

/**
 * Analyzes character statistics for the text
 */
type CharacterStats = {
    arabicCount: number;
    charFreq: Map<string, number>;
    digitCount: number;
    latinCount: number;
    punctuationCount: number;
    spaceCount: number;
    symbolCount: number;
};

/**
 * Determines if a given Arabic text string is likely to be noise
 * @param text - The input string to analyze
 * @returns true if the text is likely noise, false if it appears to be valid Arabic content
 */
export const isArabicTextNoise = (text: string): boolean => {
    // Early return for empty or very short strings
    if (!text || text.trim().length === 0) {
        return true;
    }

    const trimmed = text.trim();
    const length = trimmed.length;

    // Very short strings are likely noise unless they're meaningful Arabic
    if (length < 2) {
        return true;
    }

    // Check for basic noise patterns first
    if (isBasicNoisePattern(trimmed)) {
        return true;
    }

    const charStats = analyzeCharacterStats(trimmed);

    // Check for excessive repetition
    if (hasExcessiveRepetition(charStats, length)) {
        return true;
    }

    // Check if text contains Arabic characters
    const hasArabic = PATTERNS.arabicCharacters.test(trimmed);

    // Handle non-Arabic text
    if (!hasArabic && /[a-zA-Z]/.test(trimmed)) {
        return true;
    }

    // Arabic-specific validation
    if (hasArabic) {
        return !isValidArabicContent(charStats, length);
    }

    // Non-Arabic content validation
    return isNonArabicNoise(charStats, length, trimmed);
};

export function analyzeCharacterStats(text: string): CharacterStats {
    const arabicRange = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const stats: CharacterStats = {
        arabicCount: 0,
        charFreq: new Map<string, number>(),
        digitCount: 0,
        latinCount: 0,
        punctuationCount: 0,
        spaceCount: 0,
        symbolCount: 0,
    };

    const chars = Array.from(text);

    for (const char of chars) {
        // Count character frequency for repetition detection
        stats.charFreq.set(char, (stats.charFreq.get(char) || 0) + 1);

        if (arabicRange.test(char)) {
            stats.arabicCount++;
        } else if (/\d/.test(char)) {
            stats.digitCount++;
        } else if (/[a-zA-Z]/.test(char)) {
            stats.latinCount++;
        } else if (/\s/.test(char)) {
            stats.spaceCount++;
        } else if (/[.,;:()[\]{}"""''`]/.test(char)) {
            stats.punctuationCount++;
        } else {
            stats.symbolCount++;
        }
    }

    return stats;
}

/**
 * Checks if text has excessive character repetition
 */
export function hasExcessiveRepetition(charStats: CharacterStats, textLength: number): boolean {
    let repeatCount = 0;
    const repetitiveChars = ['!', '.', '-', '=', '_'];

    for (const [char, count] of charStats.charFreq) {
        if (count >= 5 && repetitiveChars.includes(char)) {
            repeatCount += count;
        }
    }

    // High repetition ratio indicates noise
    return repeatCount / textLength > 0.4;
}

/**
 * Checks if text matches basic noise patterns
 */
export function isBasicNoisePattern(text: string): boolean {
    const noisePatterns = [
        /^[-=_━≺≻\s]*$/, // Only dashes, equals, underscores, special chars, or spaces
        /^[.\s]*$/, // Only dots and spaces
        /^[!\s]*$/, // Only exclamation marks and spaces
        /^[A-Z\s]*$/, // Only uppercase letters and spaces (like "Ap Ap Ap")
        /^[-\d\s]*$/, // Only dashes, digits and spaces (like "- 77", "- 4")
        /^\d+\s*$/, // Only digits and spaces (like "1", " 1 ")
        /^[A-Z]\s*$/, // Single uppercase letter with optional spaces
        /^[—\s]*$/, // Only em-dashes and spaces
        /^[्र\s-]*$/, // Devanagari characters (likely OCR errors)
    ];

    return noisePatterns.some((pattern) => pattern.test(text));
}

/**
 * Determines if non-Arabic content is noise
 */
export function isNonArabicNoise(charStats: CharacterStats, textLength: number, text: string): boolean {
    const contentChars = charStats.arabicCount + charStats.latinCount + charStats.digitCount;
    const nonContentChars =
        charStats.symbolCount + charStats.punctuationCount - Math.min(charStats.punctuationCount, 3);

    // Text that's mostly symbols or punctuation is likely noise
    if (contentChars === 0) {
        return true;
    }

    // Check for specific spacing patterns that indicate noise
    if (isSpacingNoise(charStats, contentChars, textLength)) {
        return true;
    }

    // High symbol-to-content ratio indicates noise
    if (nonContentChars / Math.max(contentChars, 1) > 2) {
        return true;
    }

    // Very short strings with no Arabic are likely noise (except substantial numbers)
    if (textLength <= 5 && charStats.arabicCount === 0 && !(/^\d+$/.test(text) && charStats.digitCount >= 3)) {
        return true;
    }

    // Allow pure numbers if they're substantial (like years)
    if (/^\d{3,4}$/.test(text)) {
        return false;
    }

    // Default to not noise for longer content
    return textLength <= 10;
}

/**
 * Checks for spacing patterns that indicate noise
 */
export function isSpacingNoise(charStats: CharacterStats, contentChars: number, textLength: number): boolean {
    const { arabicCount, spaceCount } = charStats;

    // Too many spaces relative to content
    if (spaceCount > 0 && contentChars === spaceCount + 1 && contentChars <= 5) {
        return true;
    }

    // Short text with multiple spaces and no Arabic
    if (textLength <= 10 && spaceCount >= 2 && arabicCount === 0) {
        return true;
    }

    // Excessive spacing ratio
    if (spaceCount / textLength > 0.6) {
        return true;
    }

    return false;
}

/**
 * Validates Arabic content based on character statistics
 */
export function isValidArabicContent(charStats: CharacterStats, textLength: number): boolean {
    // Arabic text with reasonable content length is likely valid
    if (charStats.arabicCount >= 3) {
        return true;
    }

    // Short Arabic snippets with numbers might be valid (like dates, references)
    if (charStats.arabicCount >= 1 && charStats.digitCount > 0 && textLength <= 20) {
        return true;
    }

    return false;
}
