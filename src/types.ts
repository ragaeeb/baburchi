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

export type MatchPolicy = {
    /** Try approximate matches for leftovers (default true). */
    enableFuzzy?: boolean;

    /** Max absolute edit distance accepted in fuzzy (default 3). */
    maxEditAbs?: number;

    /** Max relative edit distance (fraction of excerpt length). Default 0.1 (10%). */
    maxEditRel?: number;

    /** q-gram length for candidate generation (default 4). */
    q?: number;
    /** Max rare grams to seed candidates per excerpt (default 5). */
    gramsPerExcerpt?: number;
    /** Max candidate windows verified per excerpt (default 40). */
    maxCandidatesPerExcerpt?: number;
    /** Seam length for bleed windows (default 512). */
    seamLen?: number;

    /**
     * Optional logging function for debugging.
     */
    log?(message?: any, ...optionalParams: any[]): void;
};
