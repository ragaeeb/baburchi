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

export const boundedLevenshtein = (a: string, b: string, maxDist: number): number => {
    const n = a.length,
        m = b.length;
    const big = maxDist + 1;

    if (Math.abs(n - m) > maxDist) {
        return big;
    }
    if (n === 0) {
        return m <= maxDist ? m : big;
    }
    if (m === 0) {
        return n <= maxDist ? n : big;
    }

    if (n > m) {
        return boundedLevenshtein(b, a, maxDist);
    }

    const prev = new Int16Array(m + 1);
    const curr = new Int16Array(m + 1);
    for (let j = 0; j <= m; j++) {
        prev[j] = j;
    }

    for (let i = 1; i <= n; i++) {
        const from = Math.max(1, i - maxDist);
        const to = Math.min(m, i + maxDist);

        curr[0] = i;
        let rowMin = curr[0];

        for (let j = 1; j < from; j++) {
            curr[j] = big;
        }

        for (let j = from; j <= to; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const del = prev[j] + 1;
            const ins = curr[j - 1] + 1;
            const sub = prev[j - 1] + cost;
            const val = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
            curr[j] = val;
            if (val < rowMin) {
                rowMin = val;
            }
        }

        for (let j = to + 1; j <= m; j++) {
            curr[j] = big;
        }

        if (rowMin > maxDist) {
            return big;
        }
        for (let j = 0; j <= m; j++) {
            prev[j] = curr[j];
        }
    }
    return prev[m] <= maxDist ? prev[m] : big;
};
