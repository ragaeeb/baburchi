import { buildAhoCorasick } from './ahocorasick';

/**
 * Builds a concatenated book from pages with position tracking
 */
export function buildBook(pagesN: string[]) {
    const parts: string[] = [];
    const starts: number[] = [];
    const lens: number[] = [];
    let off = 0;

    for (let i = 0; i < pagesN.length; i++) {
        const p = pagesN[i];
        starts.push(off);
        lens.push(p.length);
        parts.push(p);
        off += p.length;

        if (i + 1 < pagesN.length) {
            parts.push(' '); // single space to allow cross-page substring matches
            off += 1;
        }
    }
    return { book: parts.join(''), starts, lens };
}

/**
 * Binary search to find which page contains a given position
 */
export function posToPage(pos: number, pageStarts: number[]): number {
    let lo = 0;
    let hi = pageStarts.length - 1;
    let ans = 0;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (pageStarts[mid] <= pos) {
            ans = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return ans;
}

/**
 * Performs exact matching using Aho-Corasick algorithm to find all occurrences
 * of patterns in the concatenated book text.
 *
 * @param book - Concatenated text from all pages
 * @param pageStarts - Array of starting positions for each page in the book
 * @param patterns - Array of deduplicated patterns to search for
 * @param patIdToOrigIdxs - Mapping from pattern IDs to original excerpt indices
 * @param excerpts - Original array of excerpts (used for length reference)
 * @returns Object containing result array and exact match flags
 */
export function findExactMatches(
    book: string,
    pageStarts: number[],
    patterns: string[],
    patIdToOrigIdxs: number[][],
    excerptsCount: number,
): { result: Int32Array; seenExact: Uint8Array } {
    const ac = buildAhoCorasick(patterns);
    const result = new Int32Array(excerptsCount).fill(-1);
    const seenExact = new Uint8Array(excerptsCount);

    ac.find(book, (pid, endPos) => {
        const pat = patterns[pid];
        const startPos = endPos - pat.length;
        const startPage = posToPage(startPos, pageStarts);

        for (const origIdx of patIdToOrigIdxs[pid]) {
            if (!seenExact[origIdx]) {
                result[origIdx] = startPage;
                seenExact[origIdx] = 1;
            }
        }
    });

    return { result, seenExact };
}

/**
 * Deduplicates excerpts and creates pattern mapping
 */
export function deduplicateExcerpts(excerptsN: string[]) {
    const keyToPatId = new Map<string, number>();
    const patIdToOrigIdxs: number[][] = [];
    const patterns: string[] = [];

    for (let i = 0; i < excerptsN.length; i++) {
        const k = excerptsN[i];
        let pid = keyToPatId.get(k);

        if (pid === undefined) {
            pid = patterns.length;
            keyToPatId.set(k, pid);
            patterns.push(k);
            patIdToOrigIdxs.push([i]);
        } else {
            patIdToOrigIdxs[pid].push(i);
        }
    }

    return { keyToPatId, patIdToOrigIdxs, patterns };
}
