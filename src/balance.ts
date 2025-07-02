/**
 * Represents an error found when checking balance of quotes or brackets in text.
 */
type BalanceError = {
    /** The character that caused the error */
    char: string;
    /** The position of the character in the string */
    index: number;
    /** The reason for the error */
    reason: 'mismatched' | 'unclosed' | 'unmatched';
    /** The type of character that caused the error */
    type: 'bracket' | 'quote';
};

/**
 * Result of a balance check operation.
 */
type BalanceResult = {
    /** Array of errors found during balance checking */
    errors: BalanceError[];
    /** Whether the text is properly balanced */
    isBalanced: boolean;
};

/**
 * Checks if all double quotes in a string are balanced and returns detailed error information.
 *
 * A string has balanced quotes when every opening quote has a corresponding closing quote.
 * This function counts all quote characters and determines if there's an even number of them.
 * If there's an odd number, the last quote is marked as unmatched.
 *
 * @param str - The string to check for quote balance
 * @returns An object containing balance status and any errors found
 *
 * @example
 * ```typescript
 * checkQuoteBalance('Hello "world"') // { errors: [], isBalanced: true }
 * checkQuoteBalance('Hello "world')  // { errors: [{ char: '"', index: 6, reason: 'unmatched', type: 'quote' }], isBalanced: false }
 * ```
 */
const checkQuoteBalance = (str: string): BalanceResult => {
    const errors: BalanceError[] = [];
    let quoteCount = 0;
    let lastQuoteIndex = -1;

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') {
            quoteCount++;
            lastQuoteIndex = i;
        }
    }

    const isBalanced = quoteCount % 2 === 0;

    if (!isBalanced && lastQuoteIndex !== -1) {
        errors.push({
            char: '"',
            index: lastQuoteIndex,
            reason: 'unmatched',
            type: 'quote',
        });
    }

    return { errors, isBalanced };
};

/** Mapping of opening brackets to their corresponding closing brackets */
export const BRACKETS = { '«': '»', '(': ')', '[': ']', '{': '}' };

/** Set of all opening bracket characters */
export const OPEN_BRACKETS = new Set(['«', '(', '[', '{']);

/** Set of all closing bracket characters */
export const CLOSE_BRACKETS = new Set(['»', ')', ']', '}']);

/**
 * Checks if all brackets in a string are properly balanced and returns detailed error information.
 *
 * A string has balanced brackets when:
 * - Every opening bracket has a corresponding closing bracket
 * - Brackets are properly nested (no crossing pairs)
 * - Each closing bracket matches the most recent unmatched opening bracket
 *
 * Supports the following bracket pairs: (), [], {}, «»
 *
 * @param str - The string to check for bracket balance
 * @returns An object containing balance status and any errors found
 *
 * @example
 * ```typescript
 * checkBracketBalance('(hello [world])')     // { errors: [], isBalanced: true }
 * checkBracketBalance('(hello [world)')      // { errors: [{ char: '[', index: 7, reason: 'unclosed', type: 'bracket' }], isBalanced: false }
 * checkBracketBalance('(hello ]world[')      // { errors: [...], isBalanced: false }
 * ```
 */
const checkBracketBalance = (str: string): BalanceResult => {
    const errors: BalanceError[] = [];
    const stack: Array<{ char: string; index: number }> = [];

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (OPEN_BRACKETS.has(char)) {
            stack.push({ char, index: i });
        } else if (CLOSE_BRACKETS.has(char)) {
            const lastOpen = stack.pop();

            if (!lastOpen) {
                errors.push({
                    char,
                    index: i,
                    reason: 'unmatched',
                    type: 'bracket',
                });
            } else if (BRACKETS[lastOpen.char as keyof typeof BRACKETS] !== char) {
                errors.push({
                    char: lastOpen.char,
                    index: lastOpen.index,
                    reason: 'mismatched',
                    type: 'bracket',
                });
                errors.push({
                    char,
                    index: i,
                    reason: 'mismatched',
                    type: 'bracket',
                });
            }
        }
    }

    stack.forEach(({ char, index }) => {
        errors.push({
            char,
            index,
            reason: 'unclosed',
            type: 'bracket',
        });
    });

    return { errors, isBalanced: errors.length === 0 };
};

/**
 * Checks if both quotes and brackets are balanced in a string and returns detailed error information.
 *
 * This function combines the results of both quote and bracket balance checking,
 * providing a comprehensive analysis of all balance issues in the text.
 * The errors are sorted by their position in the string for easier debugging.
 *
 * @param str - The string to check for overall balance
 * @returns An object containing combined balance status and all errors found, sorted by position
 *
 * @example
 * ```typescript
 * checkBalance('Hello "world" and (test)')   // { errors: [], isBalanced: true }
 * checkBalance('Hello "world and (test')     // { errors: [...], isBalanced: false }
 * ```
 */
export const checkBalance = (str: string): BalanceResult => {
    const quoteResult = checkQuoteBalance(str);
    const bracketResult = checkBracketBalance(str);

    return {
        errors: [...quoteResult.errors, ...bracketResult.errors].sort((a, b) => a.index - b.index),
        isBalanced: quoteResult.isBalanced && bracketResult.isBalanced,
    };
};

/**
 * Enhanced error detection that returns absolute character positions for use with HighlightableTextarea.
 *
 * This interface extends the basic BalanceError to include absolute positioning
 * across multiple lines of text, making it suitable for text editors and
 * syntax highlighters that need precise character positioning.
 */
export interface CharacterError {
    /** Absolute character position from the start of the entire text */
    absoluteIndex: number;
    /** The character that caused the error */
    char: string;
    /** The reason for the error */
    reason: 'mismatched' | 'unclosed' | 'unmatched';
    /** The type of character that caused the error */
    type: 'bracket' | 'quote';
}

/**
 * Gets detailed character-level errors for unbalanced quotes and brackets in multi-line text.
 *
 * This function processes text line by line, but only checks lines longer than 10 characters
 * for balance issues. It returns absolute positions that can be used with text editors
 * or highlighting components that need precise character positioning across the entire text.
 *
 * The absolute index accounts for newline characters between lines, providing accurate
 * positioning for the original text string.
 *
 * @param text - The multi-line text to analyze for balance errors
 * @returns Array of character errors with absolute positioning information
 *
 * @example
 * ```typescript
 * const text = 'Line 1 with "quote\nLine 2 with (bracket';
 * const errors = getUnbalancedErrors(text);
 * // Returns errors with absoluteIndex pointing to exact character positions
 * ```
 */
export const getUnbalancedErrors = (text: string): CharacterError[] => {
    const characterErrors: CharacterError[] = [];
    const lines = text.split('\n');
    let absoluteIndex = 0;

    lines.forEach((line, lineIndex) => {
        if (line.length > 10) {
            const balanceResult = checkBalance(line);
            if (!balanceResult.isBalanced) {
                balanceResult.errors.forEach((error) => {
                    characterErrors.push({
                        absoluteIndex: absoluteIndex + error.index,
                        char: error.char,
                        reason: error.reason,
                        type: error.type,
                    });
                });
            }
        }
        // Add 1 for the newline character (except for the last line)
        absoluteIndex += line.length + (lineIndex < lines.length - 1 ? 1 : 0);
    });

    return characterErrors;
};

/**
 * Checks if all double quotes in a string are balanced.
 *
 * This is a convenience function that returns only the boolean result
 * without detailed error information.
 *
 * @param str - The string to check for quote balance
 * @returns True if quotes are balanced, false otherwise
 *
 * @example
 * ```typescript
 * areQuotesBalanced('Hello "world"')  // true
 * areQuotesBalanced('Hello "world')   // false
 * ```
 */
export const areQuotesBalanced = (str: string): boolean => {
    return checkQuoteBalance(str).isBalanced;
};

/**
 * Checks if all brackets in a string are properly balanced.
 *
 * This is a convenience function that returns only the boolean result
 * without detailed error information.
 *
 * @param str - The string to check for bracket balance
 * @returns True if brackets are balanced, false otherwise
 *
 * @example
 * ```typescript
 * areBracketsBalanced('(hello [world])')  // true
 * areBracketsBalanced('(hello [world')    // false
 * ```
 */
export const areBracketsBalanced = (str: string): boolean => {
    return checkBracketBalance(str).isBalanced;
};

/**
 * Checks if both quotes and brackets are balanced in a string.
 *
 * This is a convenience function that returns only the boolean result
 * without detailed error information.
 *
 * @param str - The string to check for overall balance
 * @returns True if both quotes and brackets are balanced, false otherwise
 *
 * @example
 * ```typescript
 * isBalanced('Hello "world" and (test)')  // true
 * isBalanced('Hello "world and (test')    // false
 * ```
 */
export const isBalanced = (str: string): boolean => {
    return checkBalance(str).isBalanced;
};
