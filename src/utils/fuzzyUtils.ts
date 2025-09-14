type BookData = {
    book: string;
    starts: number[];
    lens: number[];
};

/**
 * Builds a concatenated book from pages with position tracking
 */
export function buildBook(pagesN: string[]): BookData {
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

type ExcerptPattern = {
    keyToPatId: Map<string, number>;
    patIdToOrigIdxs: number[][];
    patterns: string[];
};

/**
 * Deduplicates excerpts and creates pattern mapping
 */
export function deduplicateExcerpts(excerptsN: string[]): ExcerptPattern {
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
