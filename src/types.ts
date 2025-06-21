/**
 * Configuration options for fixing typos in OCR text using alignment algorithms.
 * These options control how text tokens are compared, aligned, and merged during typo correction.
 */
export type FixTypoOptions = {
    /**
     * High similarity threshold (0.0 to 1.0) for detecting and removing duplicate tokens.
     * Used in post-processing to eliminate redundant tokens that are nearly identical.
     * Should typically be higher than similarityThreshold to catch only very similar duplicates.
     * @default 0.9
     * @example 0.95 // Removes tokens that are 95% or more similar
     */
    readonly highSimilarityThreshold: number;

    /**
     * Similarity threshold (0.0 to 1.0) for determining if two tokens should be aligned.
     * Higher values require closer matches, lower values are more permissive.
     * Used in the Needleman-Wunsch alignment algorithm for token matching.
     * @default 0.7
     * @example 0.8 // Requires 80% similarity for token alignment
     */
    readonly similarityThreshold: number;

    /**
     * Array of special symbols that should be preserved during typo correction.
     * These symbols (like honorifics or religious markers) take precedence in token selection.
     * @example ['ﷺ', '﷽', 'ﷻ'] // Common Arabic religious symbols
     */
    readonly typoSymbols: string[];
};
