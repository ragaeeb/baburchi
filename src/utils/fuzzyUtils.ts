import { buildAhoCorasick } from './ahocorasick';
import { boundedLevenshtein } from './levenshthein';

const SEAM_GAP_CEILING = 200; // max chars we are willing to skip at a boundary
const SEAM_BONUS_CAP = 80; // extra edit distance allowed for cross-page cases

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
    return { book: parts.join(''), lens, starts };
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

/**
 * Calculates fuzzy match score for a candidate using bounded Levenshtein distance.
 * Extracts a window around the candidate position and computes edit distance.
 *
 * @param excerpt - Text excerpt to match
 * @param candidate - Candidate position to evaluate
 * @param pagesN - Array of normalized page texts
 * @param seams - Array of seam data
 * @param maxDist - Maximum edit distance to consider
 * @returns Edit distance if within bounds, null otherwise
 */
export const calculateFuzzyScore = (
    excerpt: string,
    candidate: { page: number; seam: boolean; start: number },
    pagesN: string[],
    seams: { text: string }[],
    maxDist: number,
) => {
    const L = excerpt.length;
    const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
    const half = Math.floor(extra / 2);
    const start0 = candidate.start - half;

    const base = candidate.seam ? seams[candidate.page]?.text : pagesN[candidate.page];
    if (!base) {
        return null;
    }

    const buildWindow = createWindowBuilder(candidate, pagesN, seams, start0, L, extra);
    const windows = generateWindows(buildWindow, candidate, base, start0, L, extra);

    const acceptance = calculateAcceptance(candidate, base, start0, L, extra, maxDist);
    return findBestMatch(windows, excerpt, acceptance);
};

/**
 * Creates a window builder function for the given candidate
 */
const createWindowBuilder = (
    candidate: { page: number; seam: boolean; start: number },
    pagesN: string[],
    seams: { text: string }[],
    start0: number,
    L: number,
    extra: number,
) => {
    return (trimTailEndBy: number = 0, trimHeadStartBy: number = 0): string | null => {
        if (candidate.seam) {
            return buildSeamWindow(seams, candidate.page, start0, L, extra);
        }
        return buildPageWindow(pagesN, candidate.page, start0, L, extra, trimTailEndBy, trimHeadStartBy);
    };
};

/**
 * Builds a window from seam text
 */
const buildSeamWindow = (
    seams: { text: string }[],
    page: number,
    start0: number,
    L: number,
    extra: number,
): string | null => {
    const seam = seams[page]?.text;
    if (!seam) {
        return null;
    }

    const s0 = Math.max(0, start0);
    const desired = L + extra;
    const end = Math.min(seam.length, s0 + desired);
    return end > s0 ? seam.slice(s0, end) : null;
};

/**
 * Builds a window from page text, potentially spanning multiple pages
 */
const buildPageWindow = (
    pagesN: string[],
    page: number,
    start0: number,
    L: number,
    extra: number,
    trimTailEndBy: number,
    trimHeadStartBy: number,
): string | null => {
    const base = pagesN[page];
    if (!base) {
        return null;
    }

    const desired = L + extra;
    let s0 = start0;
    let window = '';

    // Prepend from previous pages if needed
    if (s0 < 0) {
        const needFromPrev = Math.max(0, -s0 - trimHeadStartBy);
        if (needFromPrev > 0) {
            window += buildPreviousPagesContent(pagesN, page, needFromPrev);
        }
        s0 = 0;
    }

    // Take from current page
    const end0 = Math.min(base.length - trimTailEndBy, Math.max(0, s0) + desired - window.length);
    if (end0 > s0) {
        window += base.slice(Math.max(0, s0), end0);
    }

    // Append from following pages
    window += buildFollowingPagesContent(pagesN, page, desired - window.length);

    return window.length ? window : null;
};

/**
 * Builds content from previous pages
 */
const buildPreviousPagesContent = (pagesN: string[], currentPage: number, needed: number): string => {
    let needPre = needed;
    let pp = currentPage - 1;
    const bits: string[] = [];

    while (needPre > 0 && pp >= 0) {
        const src = pagesN[pp];
        if (!src) {
            break;
        }

        const take = Math.min(needPre, src.length);
        const chunk = src.slice(src.length - take);
        bits.unshift(chunk);
        needPre -= chunk.length;
        pp--;
    }

    return bits.length ? `${bits.join(' ')} ` : '';
};

/**
 * Builds content from following pages
 */
const buildFollowingPagesContent = (pagesN: string[], currentPage: number, remaining: number): string => {
    let content = '';
    let pn = currentPage + 1;

    while (remaining > 0 && pn < pagesN.length) {
        const src = pagesN[pn];
        if (!src) {
            break;
        }

        const addition = src.slice(0, remaining);
        if (!addition.length) {
            break;
        }

        content += ` ${addition}`;
        remaining -= addition.length;
        pn++;
    }

    return content;
};

/**
 * Generates all possible windows for matching
 */
const generateWindows = (
    buildWindow: (trimTail: number, trimHead: number) => string | null,
    candidate: { page: number; seam: boolean; start: number },
    base: string,
    start0: number,
    L: number,
    extra: number,
): string[] => {
    const windows: string[] = [];
    const desired = L + extra;
    const crossesEnd = !candidate.seam && start0 + desired > base.length;
    const crossesStart = !candidate.seam && start0 < 0;

    // Primary window
    const w0 = buildWindow(0, 0);
    if (w0) {
        windows.push(w0);
    }

    // Trimmed tail window if crossing end
    if (crossesEnd) {
        const cut = Math.min(SEAM_GAP_CEILING, Math.max(0, base.length - Math.max(0, start0)));
        if (cut > 0) {
            const wTrimTail = buildWindow(cut, 0);
            if (wTrimTail) {
                windows.push(wTrimTail);
            }
        }
    }

    // Trimmed head window if crossing start
    if (crossesStart) {
        const wTrimHead = buildWindow(0, Math.min(SEAM_GAP_CEILING, -start0));
        if (wTrimHead) {
            windows.push(wTrimHead);
        }
    }

    return windows;
};

/**
 * Calculates the acceptance threshold for edit distance
 */
const calculateAcceptance = (
    candidate: { page: number; seam: boolean; start: number },
    base: string,
    start0: number,
    L: number,
    extra: number,
    maxDist: number,
): number => {
    const desired = L + extra;
    const crossesEnd = !candidate.seam && start0 + desired > base.length;
    const crossesStart = !candidate.seam && start0 < 0;

    const normalizationSlack = Math.min(2, Math.max(1, Math.ceil(L * 0.005)));

    return crossesEnd || crossesStart || candidate.seam
        ? maxDist + Math.min(SEAM_BONUS_CAP, Math.ceil(L * 0.08))
        : maxDist + normalizationSlack;
};

/**
 * Finds the best match among all windows
 */
const findBestMatch = (
    windows: string[],
    excerpt: string,
    acceptance: number,
): { acceptance: number; dist: number } | null => {
    let best: number | null = null;

    for (const w of windows) {
        const d = boundedLevenshtein(excerpt, w, acceptance);
        if (d <= acceptance && (best == null || d < best)) {
            best = d;
        }
    }

    return best == null ? null : { acceptance, dist: best };
};
