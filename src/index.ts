import type { FixTypoOptions } from './types';

import { alignTokenSequences, areSimilarAfterNormalization, calculateSimilarity } from './similarity';
import {
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    normalizeArabicText,
    tokenizeText,
} from './textUtils';

/**
 * Selects the best token(s) from an aligned pair during typo correction.
 * Uses various heuristics including normalization, footnote handling, typo symbols,
 * and similarity scores to determine which token(s) to keep.
 *
 * @param originalToken - Token from the original OCR text (may be null)
 * @param altToken - Token from the alternative OCR text (may be null)
 * @param options - Configuration options including typo symbols and similarity threshold
 * @returns Array of selected tokens (usually contains one token, but may contain multiple)
 */
const selectBestTokens = (
    originalToken: null | string,
    altToken: null | string,
    { similarityThreshold, typoSymbols }: FixTypoOptions,
): string[] => {
    // Handle missing tokens
    if (originalToken === null) {
        return [altToken!];
    }
    if (altToken === null) {
        return [originalToken];
    }

    // Preserve original if same after normalization (keeps diacritics)
    if (normalizeArabicText(originalToken) === normalizeArabicText(altToken)) {
        return [originalToken];
    }

    // Handle embedded footnotes
    const result = handleFootnoteSelection(originalToken, altToken);
    if (result) return result;

    // Handle standalone footnotes
    const footnoteResult = handleStandaloneFootnotes(originalToken, altToken);
    if (footnoteResult) return footnoteResult;

    // Handle typo symbols - prefer the symbol itself
    if (typoSymbols.includes(originalToken) || typoSymbols.includes(altToken)) {
        const typoSymbol = typoSymbols.find((symbol) => symbol === originalToken || symbol === altToken);
        return typoSymbol ? [typoSymbol] : [originalToken];
    }

    // Choose based on similarity
    const normalizedOriginal = normalizeArabicText(originalToken);
    const normalizedAlt = normalizeArabicText(altToken);
    const similarity = calculateSimilarity(normalizedOriginal, normalizedAlt);

    return [similarity > similarityThreshold ? originalToken : altToken];
};

/**
 * Removes duplicate tokens and handles footnote fusion in post-processing.
 * Identifies and removes tokens that are highly similar while preserving
 * important variations. Also handles special cases like footnote merging.
 *
 * @param tokens - Array of tokens to process
 * @param highSimilarityThreshold - Threshold for detecting duplicates (0.0 to 1.0)
 * @returns Array of tokens with duplicates removed and footnotes fused
 */
const removeDuplicateTokens = (tokens: string[], highSimilarityThreshold: number): string[] => {
    if (tokens.length === 0) {
        return tokens;
    }

    const result: string[] = [];

    for (const currentToken of tokens) {
        if (result.length === 0) {
            result.push(currentToken);
            continue;
        }

        const previousToken = result.at(-1)!;

        // Handle ordinary echoes (similar tokens)
        if (areSimilarAfterNormalization(previousToken, currentToken, highSimilarityThreshold)) {
            // Keep the shorter version
            if (currentToken.length < previousToken.length) {
                result[result.length - 1] = currentToken;
            }
            continue;
        }

        // Handle footnote fusion cases
        if (handleFootnoteFusion(result, previousToken, currentToken)) {
            continue;
        }

        result.push(currentToken);
    }

    return result;
};

/**
 * Processes text alignment between original and alternate OCR results to fix typos.
 * Uses the Needleman-Wunsch sequence alignment algorithm to align tokens,
 * then selects the best tokens and performs post-processing.
 *
 * @param originalText - Original OCR text that may contain typos
 * @param altText - Reference text from alternate OCR for comparison
 * @param options - Configuration options for alignment and selection
 * @returns Corrected text with typos fixed
 */
export const processTextAlignment = (originalText: string, altText: string, options: FixTypoOptions): string => {
    const originalTokens = tokenizeText(originalText, options.typoSymbols);
    const altTokens = tokenizeText(altText, options.typoSymbols);

    // Align token sequences
    const alignedPairs = alignTokenSequences(
        originalTokens,
        altTokens,
        options.typoSymbols,
        options.similarityThreshold,
    );

    // Select best tokens from each aligned pair
    const mergedTokens = alignedPairs.flatMap(([original, alt]) => selectBestTokens(original, alt, options));

    // Remove duplicates and handle post-processing
    const finalTokens = removeDuplicateTokens(mergedTokens, options.highSimilarityThreshold);

    return finalTokens.join(' ');
};

export const fixTypo = (
    original: string,
    correction: string,
    {
        highSimilarityThreshold = 0.8,
        similarityThreshold = 0.6,
        typoSymbols,
    }: Partial<FixTypoOptions> & Pick<FixTypoOptions, 'typoSymbols'>,
) => {
    return processTextAlignment(original, correction, { highSimilarityThreshold, similarityThreshold, typoSymbols });
};

export * from './similarity';
export * from './textUtils';
