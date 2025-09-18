import { boundedLevenshtein, calculateLevenshteinDistance } from './levenshthein';
import { sanitizeArabic } from './sanitize';

// Alignment scoring constants
const ALIGNMENT_SCORES = {
    GAP_PENALTY: -1,
    MISMATCH_PENALTY: -2,
    PERFECT_MATCH: 2,
    SOFT_MATCH: 1,
} as const;

/**
 * Calculates similarity ratio between two strings as a value between 0.0 and 1.0.
 * Uses Levenshtein distance normalized by the length of the longer string.
 * A ratio of 1.0 indicates identical strings, 0.0 indicates completely different strings.
 *
 * @param textA - First string to compare
 * @param textB - Second string to compare
 * @returns Similarity ratio from 0.0 (completely different) to 1.0 (identical)
 * @example
 * calculateSimilarity('hello', 'hello') // Returns 1.0
 * calculateSimilarity('hello', 'help') // Returns 0.6
 */
export const calculateSimilarity = (textA: string, textB: string): number => {
    const maxLength = Math.max(textA.length, textB.length) || 1;
    const distance = calculateLevenshteinDistance(textA, textB);
    return (maxLength - distance) / maxLength;
};

const EPSILON = 1e-9;

const computeMaxDistance = (length: number, threshold: number, inclusive: boolean): number => {
    if (threshold >= 1) {
        return inclusive && threshold === 1 ? 0 : -1;
    }

    const allowed = (1 - threshold) * length;

    if (inclusive) {
        return Math.floor(allowed + EPSILON);
    }

    if (allowed <= 0) {
        return -1;
    }

    if (allowed <= EPSILON) {
        return 0;
    }

    return Math.ceil(allowed - EPSILON) - 1;
};

export const isSimilarityAboveThreshold = (
    textA: string,
    textB: string,
    threshold: number,
    inclusive: boolean = false,
): boolean => {
    const maxLength = Math.max(textA.length, textB.length);

    if (maxLength === 0) {
        return inclusive ? threshold <= 1 : threshold < 1;
    }

    const maxDistance = computeMaxDistance(maxLength, threshold, inclusive);
    if (maxDistance < 0) {
        return false;
    }

    const distance = boundedLevenshtein(textA, textB, maxDistance);
    return distance <= maxDistance;
};

/**
 * Checks if two texts are similar after Arabic normalization.
 * Normalizes both texts by removing diacritics and decorative elements,
 * then compares their similarity against the provided threshold.
 *
 * @param textA - First text to compare
 * @param textB - Second text to compare
 * @param threshold - Similarity threshold (0.0 to 1.0)
 * @returns True if normalized texts meet the similarity threshold
 * @example
 * areSimilarAfterNormalization('السَّلام', 'السلام', 0.9) // Returns true
 */
export const areSimilarAfterNormalization = (textA: string, textB: string, threshold: number = 0.6): boolean => {
    const normalizedA = sanitizeArabic(textA);
    const normalizedB = sanitizeArabic(textB);
    return isSimilarityAboveThreshold(normalizedA, normalizedB, threshold, true);
};

/**
 * Calculates alignment score for two tokens in sequence alignment.
 * Uses different scoring criteria: perfect match after normalization gets highest score,
 * typo symbols or highly similar tokens get soft match score, mismatches get penalty.
 *
 * @param tokenA - First token to score
 * @param tokenB - Second token to score
 * @param typoSymbols - Array of special symbols that get preferential treatment
 * @param similarityThreshold - Threshold for considering tokens highly similar
 * @returns Alignment score (higher is better match)
 * @example
 * calculateAlignmentScore('hello', 'hello', [], 0.8) // Returns 2 (perfect match)
 * calculateAlignmentScore('hello', 'help', [], 0.8) // Returns 1 or -2 based on similarity
 */
export const calculateAlignmentScore = (
    tokenA: string,
    tokenB: string,
    typoSymbols: string[],
    similarityThreshold: number,
): number => {
    const normalizedA = sanitizeArabic(tokenA);
    const normalizedB = sanitizeArabic(tokenB);

    if (normalizedA === normalizedB) {
        return ALIGNMENT_SCORES.PERFECT_MATCH;
    }

    const isTypoSymbol = typoSymbols.includes(tokenA) || typoSymbols.includes(tokenB);
    const isHighlySimilar = isSimilarityAboveThreshold(normalizedA, normalizedB, similarityThreshold, true);

    return isTypoSymbol || isHighlySimilar ? ALIGNMENT_SCORES.SOFT_MATCH : ALIGNMENT_SCORES.MISMATCH_PENALTY;
};

type AlignedTokenPair = [null | string, null | string];

type AlignmentCell = {
    direction: 'diagonal' | 'left' | 'up' | null;
    score: number;
};

/**
 * Backtracks through the scoring matrix to reconstruct optimal sequence alignment.
 * Follows the directional indicators in the matrix to build the sequence of aligned
 * token pairs from the Needleman-Wunsch algorithm.
 *
 * @param matrix - Scoring matrix with directional information from alignment
 * @param tokensA - First sequence of tokens
 * @param tokensB - Second sequence of tokens
 * @returns Array of aligned token pairs, where null indicates a gap
 * @throws Error if invalid alignment direction is encountered
 */
export const backtrackAlignment = (
    matrix: AlignmentCell[][],
    tokensA: string[],
    tokensB: string[],
): AlignedTokenPair[] => {
    const alignment: AlignedTokenPair[] = [];
    let i = tokensA.length;
    let j = tokensB.length;

    while (i > 0 || j > 0) {
        const currentCell = matrix[i][j];

        switch (currentCell.direction) {
            case 'diagonal':
                alignment.push([tokensA[--i], tokensB[--j]]);
                break;
            case 'left':
                alignment.push([null, tokensB[--j]]);
                break;
            case 'up':
                alignment.push([tokensA[--i], null]);
                break;
            default:
                throw new Error('Invalid alignment direction');
        }
    }

    return alignment.reverse();
};

/**
 * Initializes the scoring matrix with gap penalties.
 */
const initializeScoringMatrix = (lengthA: number, lengthB: number): AlignmentCell[][] => {
    const matrix: AlignmentCell[][] = Array.from({ length: lengthA + 1 }, () =>
        Array.from({ length: lengthB + 1 }, () => ({ direction: null, score: 0 })),
    );

    // Initialize first row and column with gap penalties
    for (let i = 1; i <= lengthA; i++) {
        matrix[i][0] = { direction: 'up', score: i * ALIGNMENT_SCORES.GAP_PENALTY };
    }
    for (let j = 1; j <= lengthB; j++) {
        matrix[0][j] = { direction: 'left', score: j * ALIGNMENT_SCORES.GAP_PENALTY };
    }

    return matrix;
};

/**
 * Determines the best alignment direction and score for a cell.
 */
const getBestAlignment = (
    diagonalScore: number,
    upScore: number,
    leftScore: number,
): { direction: 'diagonal' | 'up' | 'left'; score: number } => {
    const maxScore = Math.max(diagonalScore, upScore, leftScore);

    if (maxScore === diagonalScore) {
        return { direction: 'diagonal', score: maxScore };
    }
    if (maxScore === upScore) {
        return { direction: 'up', score: maxScore };
    }
    return { direction: 'left', score: maxScore };
};

/**
 * Performs global sequence alignment using the Needleman-Wunsch algorithm.
 * Aligns two token sequences to find the optimal pairing that maximizes
 * the total alignment score, handling insertions, deletions, and substitutions.
 *
 * @param tokensA - First sequence of tokens to align
 * @param tokensB - Second sequence of tokens to align
 * @param typoSymbols - Special symbols that affect scoring
 * @param similarityThreshold - Threshold for high similarity scoring
 * @returns Array of aligned token pairs, with null indicating gaps
 * @example
 * alignTokenSequences(['a', 'b'], ['a', 'c'], [], 0.8)
 * // Returns [['a', 'a'], ['b', 'c']]
 */
export const alignTokenSequences = (
    tokensA: string[],
    tokensB: string[],
    typoSymbols: string[],
    similarityThreshold: number,
): AlignedTokenPair[] => {
    const lengthA = tokensA.length;
    const lengthB = tokensB.length;

    const matrix = initializeScoringMatrix(lengthA, lengthB);
    const typoSymbolsSet = new Set(typoSymbols);
    const normalizedA = tokensA.map((t) => sanitizeArabic(t));
    const normalizedB = tokensB.map((t) => sanitizeArabic(t));

    // Fill scoring matrix
    for (let i = 1; i <= lengthA; i++) {
        for (let j = 1; j <= lengthB; j++) {
            const aNorm = normalizedA[i - 1];
            const bNorm = normalizedB[j - 1];
            let alignmentScore: number;
            if (aNorm === bNorm) {
                alignmentScore = ALIGNMENT_SCORES.PERFECT_MATCH;
            } else {
                const isTypo = typoSymbolsSet.has(tokensA[i - 1]) || typoSymbolsSet.has(tokensB[j - 1]);
                const highSim = calculateSimilarity(aNorm, bNorm) >= similarityThreshold;
                alignmentScore = isTypo || highSim ? ALIGNMENT_SCORES.SOFT_MATCH : ALIGNMENT_SCORES.MISMATCH_PENALTY;
            }

            const diagonalScore = matrix[i - 1][j - 1].score + alignmentScore;
            const upScore = matrix[i - 1][j].score + ALIGNMENT_SCORES.GAP_PENALTY;
            const leftScore = matrix[i][j - 1].score + ALIGNMENT_SCORES.GAP_PENALTY;

            const { direction, score } = getBestAlignment(diagonalScore, upScore, leftScore);
            matrix[i][j] = { direction, score };
        }
    }

    return backtrackAlignment(matrix, tokensA, tokensB);
};
