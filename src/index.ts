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
 * @param suryaToken - Token from the Surya OCR text (may be null)
 * @param options - Configuration options including typo symbols and similarity threshold
 * @returns Array of selected tokens (usually contains one token, but may contain multiple)
 */
const selectBestTokens = (
    originalToken: null | string,
    suryaToken: null | string,
    { similarityThreshold, typoSymbols }: FixTypoOptions,
): string[] => {
    // Handle missing tokens
    if (originalToken === null) {
        return [suryaToken!];
    }
    if (suryaToken === null) {
        return [originalToken];
    }

    // Preserve original if same after normalization (keeps diacritics)
    if (normalizeArabicText(originalToken) === normalizeArabicText(suryaToken)) {
        return [originalToken];
    }

    // Handle embedded footnotes
    const result = handleFootnoteSelection(originalToken, suryaToken);
    if (result) return result;

    // Handle standalone footnotes
    const footnoteResult = handleStandaloneFootnotes(originalToken, suryaToken);
    if (footnoteResult) return footnoteResult;

    // Handle typo symbols - prefer the symbol itself
    if (typoSymbols.includes(originalToken) || typoSymbols.includes(suryaToken)) {
        const typoSymbol = typoSymbols.find((symbol) => symbol === originalToken || symbol === suryaToken);
        return typoSymbol ? [typoSymbol] : [originalToken];
    }

    // Choose based on similarity
    const normalizedOriginal = normalizeArabicText(originalToken);
    const normalizedSurya = normalizeArabicText(suryaToken);
    const similarity = calculateSimilarity(normalizedOriginal, normalizedSurya);

    return [similarity > similarityThreshold ? originalToken : suryaToken];
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
 * Processes text alignment between original and Surya OCR results to fix typos.
 * Uses the Needleman-Wunsch sequence alignment algorithm to align tokens,
 * then selects the best tokens and performs post-processing.
 *
 * @param originalText - Original OCR text that may contain typos
 * @param suryaText - Reference text from Surya OCR for comparison
 * @param options - Configuration options for alignment and selection
 * @returns Corrected text with typos fixed
 */
export const processTextAlignment = (originalText: string, suryaText: string, options: FixTypoOptions): string => {
    const originalTokens = tokenizeText(originalText, options.typoSymbols);
    const suryaTokens = tokenizeText(suryaText, options.typoSymbols);

    // Align token sequences
    const alignedPairs = alignTokenSequences(
        originalTokens,
        suryaTokens,
        options.typoSymbols,
        options.similarityThreshold,
    );

    // Select best tokens from each aligned pair
    const mergedTokens = alignedPairs.flatMap(([original, surya]) => selectBestTokens(original, surya, options));

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
