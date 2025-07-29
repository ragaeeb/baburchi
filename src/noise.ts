import { PATTERNS } from './textUtils';

/**
 * Character statistics for analyzing text content and patterns
 */
type CharacterStats = {
    /** Number of Arabic script characters in the text */
    arabicCount: number;
    /** Map of character frequencies for repetition analysis */
    charFreq: Map<string, number>;
    /** Number of digit characters (0-9) in the text */
    digitCount: number;
    /** Number of Latin alphabet characters (a-z, A-Z) in the text */
    latinCount: number;
    /** Number of punctuation characters in the text */
    punctuationCount: number;
    /** Number of whitespace characters in the text */
    spaceCount: number;
    /** Number of symbol characters (non-alphanumeric, non-punctuation) in the text */
    symbolCount: number;
};

/**
 * Determines if a given Arabic text string is likely to be noise or unwanted OCR artifacts.
 * This function performs comprehensive analysis to identify patterns commonly associated
 * with OCR errors, formatting artifacts, or meaningless content in Arabic text processing.
 *
 * @param text - The input string to analyze for noise patterns
 * @returns true if the text is likely noise or unwanted content, false if it appears to be valid Arabic content
 *
 * @example
 * ```typescript
 * import { isArabicTextNoise } from 'baburchi';
 *
 * console.log(isArabicTextNoise('---')); // true (formatting artifact)
 * console.log(isArabicTextNoise('السلام عليكم')); // false (valid Arabic)
 * console.log(isArabicTextNoise('ABC')); // true (uppercase pattern)
 * ```
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

/**
 * Analyzes character composition and frequency statistics for the input text.
 * Categorizes characters by type (Arabic, Latin, digits, spaces, punctuation, symbols)
 * and tracks character frequency for pattern analysis.
 *
 * @param text - The text string to analyze
 * @returns CharacterStats object containing detailed character analysis
 *
 * @example
 * ```typescript
 * import { analyzeCharacterStats } from 'baburchi';
 *
 * const stats = analyzeCharacterStats('مرحبا 123!');
 * console.log(stats.arabicCount); // 5
 * console.log(stats.digitCount); // 3
 * console.log(stats.symbolCount); // 1
 * ```
 */
export function analyzeCharacterStats(text: string): CharacterStats {
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

        if (PATTERNS.arabicCharacters.test(char)) {
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
 * Detects excessive repetition of specific characters that commonly indicate noise.
 * Focuses on repetitive characters like exclamation marks, dots, dashes, equals signs,
 * and underscores that often appear in OCR artifacts or formatting elements.
 *
 * @param charStats - Character statistics from analyzeCharacterStats
 * @param textLength - Total length of the original text
 * @returns true if excessive repetition is detected, false otherwise
 *
 * @example
 * ```typescript
 * import { hasExcessiveRepetition, analyzeCharacterStats } from 'baburchi';
 *
 * const stats = analyzeCharacterStats('!!!!!');
 * console.log(hasExcessiveRepetition(stats, 5)); // true
 *
 * const normalStats = analyzeCharacterStats('hello world');
 * console.log(hasExcessiveRepetition(normalStats, 11)); // false
 * ```
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
 * Identifies text that matches common noise patterns using regular expressions.
 * Detects patterns like repeated dashes, dot sequences, uppercase-only text,
 * digit-dash combinations, and other formatting artifacts commonly found in OCR output.
 *
 * @param text - The text string to check against noise patterns
 * @returns true if the text matches a basic noise pattern, false otherwise
 *
 * @example
 * ```typescript
 * import { isBasicNoisePattern } from 'baburchi';
 *
 * console.log(isBasicNoisePattern('---')); // true
 * console.log(isBasicNoisePattern('...')); // true
 * console.log(isBasicNoisePattern('ABC')); // true
 * console.log(isBasicNoisePattern('- 77')); // true
 * console.log(isBasicNoisePattern('hello world')); // false
 * ```
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
 * Determines if non-Arabic content should be classified as noise based on various heuristics.
 * Analyzes symbol-to-content ratios, text length, spacing patterns, and content composition
 * to identify unwanted OCR artifacts or meaningless content.
 *
 * @param charStats - Character statistics from analyzeCharacterStats
 * @param textLength - Total length of the original text
 * @param text - The original text string for additional pattern matching
 * @returns true if the content is likely noise, false if it appears to be valid content
 *
 * @example
 * ```typescript
 * import { isNonArabicNoise, analyzeCharacterStats } from 'baburchi';
 *
 * const stats = analyzeCharacterStats('!!!');
 * console.log(isNonArabicNoise(stats, 3, '!!!')); // true
 *
 * const validStats = analyzeCharacterStats('2023');
 * console.log(isNonArabicNoise(validStats, 4, '2023')); // false
 * ```
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
 * Detects problematic spacing patterns that indicate noise or OCR artifacts.
 * Identifies cases where spacing is excessive relative to content, or where
 * single characters are surrounded by spaces in a way that suggests OCR errors.
 *
 * @param charStats - Character statistics from analyzeCharacterStats
 * @param contentChars - Number of meaningful content characters (Arabic + Latin + digits)
 * @param textLength - Total length of the original text
 * @returns true if spacing patterns indicate noise, false otherwise
 *
 * @example
 * ```typescript
 * import { isSpacingNoise, analyzeCharacterStats } from 'baburchi';
 *
 * const stats = analyzeCharacterStats(' a ');
 * const contentChars = stats.arabicCount + stats.latinCount + stats.digitCount;
 * console.log(isSpacingNoise(stats, contentChars, 3)); // true
 *
 * const normalStats = analyzeCharacterStats('hello world');
 * const normalContent = normalStats.arabicCount + normalStats.latinCount + normalStats.digitCount;
 * console.log(isSpacingNoise(normalStats, normalContent, 11)); // false
 * ```
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
 * Validates whether Arabic content is substantial enough to be considered meaningful.
 * Uses character counts and text length to determine if Arabic text contains
 * sufficient content or if it's likely to be a fragment or OCR artifact.
 *
 * @param charStats - Character statistics from analyzeCharacterStats
 * @param textLength - Total length of the original text
 * @returns true if the Arabic content appears valid, false if it's likely noise
 *
 * @example
 * ```typescript
 * import { isValidArabicContent, analyzeCharacterStats } from 'baburchi';
 *
 * const validStats = analyzeCharacterStats('السلام عليكم');
 * console.log(isValidArabicContent(validStats, 12)); // true
 *
 * const shortStats = analyzeCharacterStats('ص');
 * console.log(isValidArabicContent(shortStats, 1)); // false
 *
 * const withDigitsStats = analyzeCharacterStats('ص 5');
 * console.log(isValidArabicContent(withDigitsStats, 3)); // true
 * ```
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
