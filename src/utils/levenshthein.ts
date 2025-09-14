/**
 * Calculates Levenshtein distance between two strings using space-optimized dynamic programming.
 * The Levenshtein distance is the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into another.
 *
 * @param textA - First string to compare
 * @param textB - Second string to compare
 * @returns Minimum edit distance between the two strings
 * @complexity Time: O(m*n), Space: O(min(m,n)) where m,n are string lengths
 * @example
 * calculateLevenshteinDistance('kitten', 'sitting') // Returns 3
 * calculateLevenshteinDistance('', 'hello') // Returns 5
 */
export const calculateLevenshteinDistance = (textA: string, textB: string): number => {
    const lengthA = textA.length;
    const lengthB = textB.length;

    if (lengthA === 0) {
        return lengthB;
    }

    if (lengthB === 0) {
        return lengthA;
    }

    // Use shorter string for the array to optimize space
    const [shorter, longer] = lengthA <= lengthB ? [textA, textB] : [textB, textA];
    const shortLen = shorter.length;
    const longLen = longer.length;

    let previousRow = Array.from({ length: shortLen + 1 }, (_, index) => index);

    for (let i = 1; i <= longLen; i++) {
        const currentRow = [i];

        for (let j = 1; j <= shortLen; j++) {
            const substitutionCost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
            const minCost = Math.min(
                previousRow[j] + 1, // deletion
                currentRow[j - 1] + 1, // insertion
                previousRow[j - 1] + substitutionCost, // substitution
            );
            currentRow.push(minCost);
        }

        previousRow = currentRow;
    }

    return previousRow[shortLen];
};

/**
 * Early exit check for bounded Levenshtein distance.
 */
const shouldEarlyExit = (a: string, b: string, maxDist: number): number | null => {
    if (Math.abs(a.length - b.length) > maxDist) {
        return maxDist + 1;
    }
    if (a.length === 0) {
        return b.length <= maxDist ? b.length : maxDist + 1;
    }
    if (b.length === 0) {
        return a.length <= maxDist ? a.length : maxDist + 1;
    }
    return null;
};

/**
 * Initializes arrays for bounded Levenshtein calculation.
 */
const initializeBoundedArrays = (m: number): [Int16Array, Int16Array] => {
    const prev = new Int16Array(m + 1);
    const curr = new Int16Array(m + 1);
    for (let j = 0; j <= m; j++) {
        prev[j] = j;
    }
    return [prev, curr];
};

/**
 * Calculates the bounds for the current row in bounded Levenshtein.
 */
const getRowBounds = (i: number, maxDist: number, m: number) => ({
    from: Math.max(1, i - maxDist),
    to: Math.min(m, i + maxDist),
});

/**
 * Processes a single cell in the bounded Levenshtein matrix.
 */
const processBoundedCell = (a: string, b: string, i: number, j: number, prev: Int16Array, curr: Int16Array): number => {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    const del = prev[j] + 1;
    const ins = curr[j - 1] + 1;
    const sub = prev[j - 1] + cost;
    return Math.min(del, ins, sub);
};

/**
 * Processes a single row in bounded Levenshtein calculation.
 */
const processBoundedRow = (
    a: string,
    b: string,
    i: number,
    maxDist: number,
    prev: Int16Array,
    curr: Int16Array,
): number => {
    const m = b.length;
    const big = maxDist + 1;
    const { from, to } = getRowBounds(i, maxDist, m);

    curr[0] = i;
    let rowMin = i;

    // Fill out-of-bounds cells
    for (let j = 1; j < from; j++) {
        curr[j] = big;
    }
    for (let j = to + 1; j <= m; j++) {
        curr[j] = big;
    }

    // Process valid range
    for (let j = from; j <= to; j++) {
        const val = processBoundedCell(a, b, i, j, prev, curr);
        curr[j] = val;
        if (val < rowMin) {
            rowMin = val;
        }
    }

    return rowMin;
};

/**
 * Calculates bounded Levenshtein distance with early termination.
 * More efficient when you only care about distances up to a threshold.
 */
export const boundedLevenshtein = (a: string, b: string, maxDist: number): number => {
    const big = maxDist + 1;

    // Early exit checks
    const earlyResult = shouldEarlyExit(a, b, maxDist);
    if (earlyResult !== null) {
        return earlyResult;
    }

    // Ensure a is shorter for optimization
    if (a.length > b.length) {
        return boundedLevenshtein(b, a, maxDist);
    }

    // use `let` so we can swap references instead of copying contents
    let [prev, curr] = initializeBoundedArrays(b.length);

    for (let i = 1; i <= a.length; i++) {
        const rowMin = processBoundedRow(a, b, i, maxDist, prev, curr);
        if (rowMin > maxDist) {
            return big;
        }

        // O(1) swap instead of O(m) copy
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }

    return prev[b.length] <= maxDist ? prev[b.length] : big;
};
