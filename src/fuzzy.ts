import type { MatchPolicy } from './types';
import { buildAhoCorasick } from './utils/ahocorasick';
import { DEFAULT_POLICY } from './utils/constants';
import { buildBook, calculateFuzzyScore, deduplicateExcerpts, findExactMatches, posToPage } from './utils/fuzzyUtils';
import { QGramIndex } from './utils/qgram';
import { sanitizeArabic } from './utils/sanitize';

/**
 * Represents a candidate match position for fuzzy matching.
 */
type Candidate = {
    /** Page number where the candidate match is found */
    page: number;
    /** Starting position within the page or seam */
    start: number;
    /** Whether this candidate is from a seam (cross-page boundary) */
    seam: boolean;
};

/**
 * Data structure for cross-page text seams used in fuzzy matching.
 */
type SeamData = {
    /** Combined text from adjacent page boundaries */
    text: string;
    /** Starting page number for this seam */
    startPage: number;
};

/**
 * Represents a fuzzy match result with quality score.
 */
type FuzzyMatch = {
    /** Page number where the match was found */
    page: number;
    /** Edit distance (lower is better) */
    dist: number;
};

/**
 * Represents a page hit with quality metrics for ranking matches.
 */
type PageHit = {
    /** Quality score (0-1, higher is better) */
    score: number;
    /** Whether this is an exact match */
    exact: boolean;
    /** Whether this hit came from a seam candidate */
    seam: boolean;
};

/**
 * Creates seam data for cross-page matching by combining text from adjacent page boundaries.
 * Seams help find matches that span across page breaks.
 *
 * @param pagesN - Array of normalized page texts
 * @param seamLen - Length of text to take from each page boundary
 * @returns Array of seam data structures
 */
function createSeams(pagesN: string[], seamLen: number): SeamData[] {
    const seams: SeamData[] = [];
    for (let p = 0; p + 1 < pagesN.length; p++) {
        const left = pagesN[p].slice(-seamLen);
        const right = pagesN[p + 1].slice(0, seamLen);
        const text = `${left} ${right}`;
        seams.push({ startPage: p, text });
    }
    return seams;
}

/**
 * Builds Q-gram index for efficient fuzzy matching candidate generation.
 * The index contains both regular pages and cross-page seams.
 *
 * @param pagesN - Array of normalized page texts
 * @param seams - Array of seam data for cross-page matching
 * @param q - Length of q-grams to index
 * @returns Constructed Q-gram index
 */
function buildQGramIndex(pagesN: string[], seams: SeamData[], q: number): QGramIndex {
    const qidx = new QGramIndex(q);

    for (let p = 0; p < pagesN.length; p++) {
        qidx.addText(p, pagesN[p], false);
    }

    for (let p = 0; p < seams.length; p++) {
        qidx.addText(p, seams[p].text, true);
    }

    return qidx;
}

/**
 * Generates fuzzy matching candidates using rare q-grams from the excerpt.
 * Uses frequency-based selection to find the most discriminative grams.
 *
 * @param excerpt - Text excerpt to find candidates for
 * @param qidx - Q-gram index containing page and seam data
 * @param cfg - Match policy configuration
 * @returns Array of candidate match positions
 */
function generateCandidates(excerpt: string, qidx: QGramIndex, cfg: Required<MatchPolicy>) {
    const seeds = qidx.pickRare(excerpt, cfg.gramsPerExcerpt);
    if (seeds.length === 0) {
        return [];
    }

    const candidates: Candidate[] = [];
    const seenKeys = new Set<string>();
    const excerptLen = excerpt.length;

    outer: for (const { gram, offset } of seeds) {
        const posts = qidx.getPostings(gram);
        if (!posts) {
            continue;
        }

        for (const p of posts) {
            const startPos = p.pos - offset;
            if (startPos < -Math.floor(excerptLen * 0.25)) {
                continue;
            }

            const start = Math.max(0, startPos);
            const key = `${p.page}:${start}:${p.seam ? 1 : 0}`;
            if (seenKeys.has(key)) {
                continue;
            }

            candidates.push({ page: p.page, seam: p.seam, start });
            seenKeys.add(key);

            if (candidates.length >= cfg.maxCandidatesPerExcerpt) {
                break outer;
            }
        }
    }

    return candidates;
}

/**
 * Finds the best fuzzy match among candidates by comparing edit distances.
 * Prioritizes lower edit distance, then earlier page number for tie-breaking.
 *
 * @param excerpt - Text excerpt to match
 * @param candidates - Array of candidate positions to evaluate
 * @param pagesN - Array of normalized page texts
 * @param seams - Array of seam data
 * @param cfg - Match policy configuration
 * @returns Best fuzzy match or null if none found
 */
function findBestFuzzyMatch(
    excerpt: string,
    candidates: Candidate[],
    pagesN: string[],
    seams: SeamData[],
    cfg: Required<MatchPolicy>,
): FuzzyMatch | null {
    if (excerpt.length === 0) {
        return null;
    }

    const maxDist = calculateMaxDistance(excerpt, cfg);
    cfg.log('maxDist', maxDist);

    const keyset = new Set<string>();
    let best: FuzzyMatch | null = null;

    for (const candidate of candidates) {
        if (shouldSkipCandidate(candidate, keyset)) {
            continue;
        }

        const match = evaluateCandidate(candidate, excerpt, pagesN, seams, maxDist, cfg);
        if (!match) {
            continue;
        }

        best = updateBestMatch(best, match, candidate);
        cfg.log('findBest best', best);

        if (match.dist === 0) {
            break;
        }
    }

    return best;
}

/**
 * Calculates the maximum allowed edit distance
 */
function calculateMaxDistance(excerpt: string, cfg: Required<MatchPolicy>): number {
    return Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * excerpt.length));
}

/**
 * Checks if a candidate should be skipped (already processed)
 */
function shouldSkipCandidate(candidate: Candidate, keyset: Set<string>): boolean {
    const key = `${candidate.page}:${candidate.start}:${candidate.seam ? 1 : 0}`;
    if (keyset.has(key)) {
        return true;
    }
    keyset.add(key);
    return false;
}

/**
 * Evaluates a candidate and returns match info if valid
 */
function evaluateCandidate(
    candidate: Candidate,
    excerpt: string,
    pagesN: string[],
    seams: SeamData[],
    maxDist: number,
    cfg: Required<MatchPolicy>,
): { dist: number; acceptance: number } | null {
    const res = calculateFuzzyScore(excerpt, candidate, pagesN, seams, maxDist);
    const dist = res?.dist ?? null;
    const acceptance = res?.acceptance ?? maxDist;

    cfg.log('dist', dist);

    return isValidMatch(dist, acceptance) ? { acceptance, dist: dist! } : null;
}

/**
 * Checks if a match is valid (within acceptance threshold)
 */
function isValidMatch(dist: number | null, acceptance: number): boolean {
    return dist !== null && dist <= acceptance;
}

/**
 * Updates the best match if the current match is better
 */
function updateBestMatch(
    current: FuzzyMatch | null,
    match: { dist: number; acceptance: number },
    candidate: Candidate,
): FuzzyMatch {
    const newMatch = { dist: match.dist, page: candidate.page };

    if (!current) {
        return newMatch;
    }

    return isBetterMatch(match.dist, candidate.page, current.dist, current.page) ? newMatch : current;
}

/**
 * Determines if a new match is better than the current best
 */
function isBetterMatch(newDist: number, newPage: number, bestDist: number, bestPage: number): boolean {
    return newDist < bestDist || (newDist === bestDist && newPage < bestPage);
}

/**
 * Performs fuzzy matching for excerpts that didn't have exact matches.
 * Uses Q-gram indexing and bounded Levenshtein distance for efficiency.
 *
 * @param excerptsN - Array of normalized excerpts
 * @param pagesN - Array of normalized page texts
 * @param seenExact - Flags indicating which excerpts had exact matches
 * @param result - Result array to update with fuzzy match pages
 * @param cfg - Match policy configuration
 */
function performFuzzyMatching(
    excerptsN: string[],
    pagesN: string[],
    seenExact: Uint8Array,
    result: Int32Array,
    cfg: Required<MatchPolicy>,
): void {
    if (!cfg.enableFuzzy) {
        return;
    }

    const seams = createSeams(pagesN, cfg.seamLen);
    const qidx = buildQGramIndex(pagesN, seams, cfg.q);

    for (let i = 0; i < excerptsN.length; i++) {
        if (seenExact[i]) {
            continue;
        }

        const excerpt = excerptsN[i];
        cfg.log('excerpt', excerpt);
        if (!excerpt || excerpt.length < cfg.q) {
            continue;
        }

        const candidates = generateCandidates(excerpt, qidx, cfg);
        cfg.log('candidates', candidates);
        if (candidates.length === 0) {
            continue;
        }

        const best = findBestFuzzyMatch(excerpt, candidates, pagesN, seams, cfg);
        cfg.log('best', best);
        if (best) {
            result[i] = best.page;
            seenExact[i] = 1;
        }
    }
}

/**
 * Main function to find the single best match per excerpt.
 * Combines exact matching with fuzzy matching for comprehensive text search.
 *
 * @param pages - Array of page texts to search within
 * @param excerpts - Array of text excerpts to find matches for
 * @param policy - Optional matching policy configuration
 * @returns Array of page indices (one per excerpt, -1 if no match found)
 *
 * @example
 * ```typescript
 * const pages = ['Hello world', 'Goodbye world'];
 * const excerpts = ['Hello', 'Good bye']; // Note the typo
 * const matches = findMatches(pages, excerpts, { enableFuzzy: true });
 * // Returns [0, 1] - exact match on page 0, fuzzy match on page 1
 * ```
 */
export function findMatches(pages: string[], excerpts: string[], policy: MatchPolicy = {}) {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    if (policy.log) {
        policy.log('pages', pages);
        policy.log('excerpts', excerpts);
        policy.log('pagesN', pagesN);
        policy.log('excerptsN', excerptsN);
    }

    const { patIdToOrigIdxs, patterns } = deduplicateExcerpts(excerptsN);
    const { book, starts: pageStarts } = buildBook(pagesN);

    const { result, seenExact } = findExactMatches(book, pageStarts, patterns, patIdToOrigIdxs, excerpts.length);

    if (policy.log) {
        policy.log('findExactMatches result', result);
        policy.log('seenExact', seenExact);
    }

    if (!seenExact.every((seen) => seen === 1)) {
        performFuzzyMatching(excerptsN, pagesN, seenExact, result, cfg);
    }

    if (policy.log) {
        policy.log('performFuzzyMatching result', result);
    }

    return Array.from(result);
}

/**
 * Records exact matches for the findMatchesAll function.
 * Updates the hits tracking structure with exact match information.
 *
 * @param book - Concatenated text from all pages
 * @param pageStarts - Array of starting positions for each page
 * @param patterns - Array of deduplicated patterns to search for
 * @param patIdToOrigIdxs - Mapping from pattern IDs to original excerpt indices
 * @param hitsByExcerpt - Array of maps tracking hits per excerpt
 */
function recordExactMatches(
    book: string,
    pageStarts: number[],
    patterns: string[],
    patIdToOrigIdxs: number[][],
    hitsByExcerpt: Array<Map<number, PageHit>>,
): void {
    const ac = buildAhoCorasick(patterns);

    ac.find(book, (pid, endPos) => {
        const pat = patterns[pid];
        const startPos = endPos - pat.length;
        const startPage = posToPage(startPos, pageStarts);

        for (const origIdx of patIdToOrigIdxs[pid]) {
            const hits = hitsByExcerpt[origIdx];
            const prev = hits.get(startPage);
            if (!prev || !prev.exact) {
                hits.set(startPage, { exact: true, score: 1, seam: false });
            }
        }
    });
}

/**
 * Processes a single fuzzy candidate and updates hits if a better match is found.
 * Used internally by the findMatchesAll function for comprehensive matching.
 *
 * @param candidate - Candidate position to evaluate
 * @param excerpt - Text excerpt being matched
 * @param pagesN - Array of normalized page texts
 * @param seams - Array of seam data
 * @param maxDist - Maximum edit distance threshold
 * @param hits - Map of page hits to update
 * @param keyset - Set to track processed candidates (for deduplication)
 */
function processFuzzyCandidate(
    candidate: Candidate,
    excerpt: string,
    pagesN: string[],
    seams: SeamData[],
    maxDist: number,
    hits: Map<number, PageHit>,
    keyset: Set<string>,
): void {
    const key = `${candidate.page}:${candidate.start}:${candidate.seam ? 1 : 0}`;
    if (keyset.has(key)) {
        return;
    }
    keyset.add(key);

    const res = calculateFuzzyScore(excerpt, candidate, pagesN, seams, maxDist);
    if (!res) {
        return;
    }

    const { dist, acceptance } = res;
    if (dist > acceptance) {
        return;
    }

    const score = 1 - dist / acceptance;

    const entry = hits.get(candidate.page);
    if (!entry || (!entry.exact && score > entry.score)) {
        hits.set(candidate.page, { exact: false, score, seam: candidate.seam });
    }
}

/**
 * Processes fuzzy matching for a single excerpt in the findMatchesAll function.
 * Generates candidates and evaluates them for potential matches.
 *
 * @param excerptIndex - Index of the excerpt being processed
 * @param excerpt - Text excerpt to find matches for
 * @param pagesN - Array of normalized page texts
 * @param seams - Array of seam data
 * @param qidx - Q-gram index for candidate generation
 * @param hitsByExcerpt - Array of maps tracking hits per excerpt
 * @param cfg - Match policy configuration
 */
function processSingleExcerptFuzzy(
    excerptIndex: number,
    excerpt: string,
    pagesN: string[],
    seams: SeamData[],
    qidx: QGramIndex,
    hitsByExcerpt: Array<Map<number, PageHit>>,
    cfg: Required<MatchPolicy>,
): void {
    // Skip if we already have exact hits
    const hasExactHits = Array.from(hitsByExcerpt[excerptIndex].values()).some((v) => v.exact);
    if (hasExactHits) {
        return;
    }

    if (!excerpt || excerpt.length < cfg.q) {
        return;
    }

    const candidates = generateCandidates(excerpt, qidx, cfg);
    if (candidates.length === 0) {
        return;
    }

    const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * excerpt.length));
    const keyset = new Set<string>();
    const hits = hitsByExcerpt[excerptIndex];

    for (const candidate of candidates) {
        processFuzzyCandidate(candidate, excerpt, pagesN, seams, maxDist, hits, keyset);
    }
}

/**
 * Records fuzzy matches for excerpts that don't have exact matches.
 * Used by findMatchesAll to provide comprehensive matching results.
 *
 * @param excerptsN - Array of normalized excerpts
 * @param pagesN - Array of normalized page texts
 * @param hitsByExcerpt - Array of maps tracking hits per excerpt
 * @param cfg - Match policy configuration
 */
function recordFuzzyMatches(
    excerptsN: string[],
    pagesN: string[],
    hitsByExcerpt: Array<Map<number, PageHit>>,
    cfg: Required<MatchPolicy>,
): void {
    const seams = createSeams(pagesN, cfg.seamLen);
    const qidx = buildQGramIndex(pagesN, seams, cfg.q);

    for (let i = 0; i < excerptsN.length; i++) {
        processSingleExcerptFuzzy(i, excerptsN[i], pagesN, seams, qidx, hitsByExcerpt, cfg);
    }
}

/**
 * Sorts matches by quality and page order for optimal ranking.
 * Exact matches are prioritized over fuzzy matches, with secondary sorting by page order.
 *
 * @param hits - Map of page hits with quality scores
 * @returns Array of page numbers sorted by match quality
 */
const sortMatches = (hits: Map<number, PageHit>) => {
    if (hits.size === 0) {
        return [];
    }

    // 1) Collapse adjacent seam pairs: keep the stronger seam and drop the weaker neighbor.
    collapseAdjacentSeams(hits);

    // 2) Remove seam hits that are worse than a non-seam neighbor on the following page.
    removeWeakSeams(hits);

    // 3) Split and rank: exact first in reading order; then fuzzy by score desc, then page asc.
    return rankHits(hits);
};

/**
 * Removes weaker seam from adjacent seam pairs
 */
const collapseAdjacentSeams = (hits: Map<number, PageHit>) => {
    const pagesAsc = Array.from(hits.keys()).sort((a, b) => a - b);

    for (const page of pagesAsc) {
        const currentHit = hits.get(page);
        const nextHit = hits.get(page + 1);

        if (shouldCollapseSeams(currentHit, nextHit)) {
            const pageToRemove = selectWeakerSeam(page, currentHit!, nextHit!);
            hits.delete(pageToRemove);
        }
    }
};

/**
 * Checks if two hits are adjacent seams that should be collapsed
 */
const shouldCollapseSeams = (hit1?: PageHit, hit2?: PageHit): boolean => {
    return Boolean(hit1?.seam && hit2?.seam);
};

/**
 * Returns the page number of the weaker seam (or later page if tied)
 */
const selectWeakerSeam = (page1: number, hit1: PageHit, hit2: PageHit): number => {
    if (hit2.score > hit1.score) {
        return page1;
    }
    if (hit2.score < hit1.score) {
        return page1 + 1;
    }
    return page1 + 1; // Tie: prefer earlier page
};

/**
 * Removes seam hits that are redundant compared to stronger neighbors
 */
const removeWeakSeams = (hits: Map<number, PageHit>) => {
    const seamPages = Array.from(hits.entries())
        .filter(([, hit]) => hit.seam)
        .map(([page]) => page);

    for (const page of seamPages) {
        const seamHit = hits.get(page)!;
        const neighbor = hits.get(page + 1);

        if (isSeamRedundant(seamHit, neighbor)) {
            hits.delete(page);
        }
    }
};

/**
 * Checks if a seam hit is redundant compared to its neighbor
 */
const isSeamRedundant = (seamHit: PageHit, neighbor?: PageHit): boolean => {
    if (!neighbor) {
        return false;
    }
    return neighbor.exact || (!neighbor.seam && neighbor.score >= seamHit.score);
};

/**
 * Splits hits into exact and fuzzy, then sorts and combines them
 */
const rankHits = (hits: Map<number, PageHit>): number[] => {
    const exact: [number, PageHit][] = [];
    const fuzzy: [number, PageHit][] = [];

    for (const entry of hits.entries()) {
        if (entry[1].exact) {
            exact.push(entry);
        } else {
            fuzzy.push(entry);
        }
    }

    exact.sort((a, b) => a[0] - b[0]);
    fuzzy.sort((a, b) => b[1].score - a[1].score || a[0] - b[0]);

    return [...exact, ...fuzzy].map((entry) => entry[0]);
};

/**
 * Main function to find all matches per excerpt, ranked by quality.
 * Returns comprehensive results with both exact and fuzzy matches for each excerpt.
 *
 * @param pages - Array of page texts to search within
 * @param excerpts - Array of text excerpts to find matches for
 * @param policy - Optional matching policy configuration
 * @returns Array of page index arrays (one array per excerpt, sorted by match quality)
 *
 * @example
 * ```typescript
 * const pages = ['Hello world', 'Hello there', 'Goodbye world'];
 * const excerpts = ['Hello'];
 * const matches = findMatchesAll(pages, excerpts);
 * // Returns [[0, 1]] - both pages 0 and 1 contain "Hello", sorted by page order
 * ```
 */
export function findMatchesAll(pages: string[], excerpts: string[], policy: MatchPolicy = {}): number[][] {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    if (policy.log) {
        policy.log('pages', pages);
        policy.log('excerpts', excerpts);
        policy.log('pagesN', pagesN);
        policy.log('excerptsN', excerptsN);
    }

    const { patIdToOrigIdxs, patterns } = deduplicateExcerpts(excerptsN);
    const { book, starts: pageStarts } = buildBook(pagesN);

    // Initialize hit tracking
    const hitsByExcerpt: Array<Map<number, PageHit>> = Array.from({ length: excerpts.length }, () => new Map());

    // Record exact matches
    recordExactMatches(book, pageStarts, patterns, patIdToOrigIdxs, hitsByExcerpt);

    // Record fuzzy matches if enabled
    if (cfg.enableFuzzy) {
        recordFuzzyMatches(excerptsN, pagesN, hitsByExcerpt, cfg);
    }

    // Sort and return results
    return hitsByExcerpt.map((hits) => sortMatches(hits));
}
