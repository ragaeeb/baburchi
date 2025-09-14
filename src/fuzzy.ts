import type { MatchPolicy } from './types';
import { buildAhoCorasick } from './utils/ahocorasick';
import { DEFAULT_POLICY } from './utils/constants';
import { buildBook, deduplicateExcerpts, findExactMatches, posToPage } from './utils/fuzzyUtils';
import { boundedLevenshtein } from './utils/levenshthein';
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
    const excerptLen = excerpt.length;

    for (const { gram, offset } of seeds) {
        const posts = qidx.getPostings(gram);
        if (!posts) {
            continue;
        }

        for (const p of posts) {
            const startPos = p.pos - offset;
            if (startPos < -Math.floor(excerptLen * 0.25)) {
                continue;
            }

            candidates.push({
                page: p.page,
                seam: p.seam,
                start: Math.max(0, startPos),
            });

            if (candidates.length >= cfg.maxCandidatesPerExcerpt) {
                break;
            }
        }

        if (candidates.length >= cfg.maxCandidatesPerExcerpt) {
            break;
        }
    }

    return candidates;
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
// Tunables (conservative so we don't regress other tests)
const SEAM_GAP_CEILING = 200; // max chars we are willing to skip at a boundary
const SEAM_BONUS_CAP = 80; // extra edit distance allowed for cross-page cases

function calculateFuzzyScore(
    excerpt: string,
    candidate: { page: number; seam: boolean; start: number },
    pagesN: string[],
    seams: { text: string }[],
    maxDist: number,
): { dist: number; acceptance: number } | null {
    const L = excerpt.length;

    const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
    const half = Math.floor(extra / 2);
    const start0 = candidate.start - half;

    const buildWindow = (trimTailEndBy: number = 0, trimHeadStartBy: number = 0): string | null => {
        if (candidate.seam) {
            const seam = seams[candidate.page]?.text;
            if (!seam) {
                return null;
            }
            const s0 = Math.max(0, start0);
            const desired = L + extra;
            const end = Math.min(seam.length, s0 + desired);
            return end > s0 ? seam.slice(s0, end) : null;
        }

        const p = candidate.page;
        const base = pagesN[p];
        if (!base) {
            return null;
        }

        const desired = L + extra;

        let s0 = start0;
        let window = '';

        if (s0 < 0) {
            let needPre = -s0 + trimHeadStartBy;
            let pp = p - 1;
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
            if (bits.length) {
                window += `${bits.join(' ')} `;
            }
            s0 = 0;
        }

        const end0 = Math.min(base.length - trimTailEndBy, Math.max(0, s0) + desired - window.length);
        if (end0 > s0) {
            window += base.slice(Math.max(0, s0), end0);
        }

        let remaining = desired - window.length;
        let pn = p + 1;
        while (remaining > 0 && pn < pagesN.length) {
            const src = pagesN[pn];
            if (!src) {
                break;
            }
            const addition = src.slice(0, remaining);
            if (!addition.length) {
                break;
            }
            window += ` ${addition}`;
            remaining = desired - window.length;
            pn++;
        }

        return window.length ? window : null;
    };

    const windows: string[] = [];
    const base = candidate.seam ? seams[candidate.page]?.text : pagesN[candidate.page];
    if (!base) {
        return null;
    }

    const desired = L + extra;
    const crossesEnd = !candidate.seam && start0 + desired > base.length;
    const crossesStart = !candidate.seam && start0 < 0;

    const w0 = buildWindow(0, 0);
    if (w0) {
        windows.push(w0);
    }

    if (crossesEnd && candidate.page + 1 < pagesN.length) {
        const cut = Math.min(SEAM_GAP_CEILING, Math.max(0, base.length - Math.max(0, start0)));
        if (cut > 0) {
            const wTrimTail = buildWindow(cut, 0);
            if (wTrimTail) {
                windows.push(wTrimTail);
            }
        }
    }

    if (crossesStart && candidate.page > 0) {
        const wTrimHead = buildWindow(0, Math.min(SEAM_GAP_CEILING, -start0));
        if (wTrimHead) {
            windows.push(wTrimHead);
        }
    }

    const acceptance =
        crossesEnd || crossesStart || candidate.seam
            ? maxDist + Math.min(SEAM_BONUS_CAP, Math.ceil(L * 0.08))
            : maxDist;

    let best: number | null = null;
    for (const w of windows) {
        const d = boundedLevenshtein(excerpt, w, acceptance);
        if (d != null && (best == null || d < best)) {
            best = d;
        }
    }

    for (const [i, w] of windows.entries()) {
        console.log?.('window', { allowance: acceptance, crossesEnd, crossesStart, i, len: w.length });
    }

    return best == null ? null : { acceptance, dist: best };
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

    const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * excerpt.length));
    cfg.log('maxDist', maxDist);

    const keyset = new Set<string>();
    let best: FuzzyMatch | null = null;

    for (const candidate of candidates) {
        const key = `${candidate.page}:${candidate.start}:${candidate.seam ? 1 : 0}`;
        if (keyset.has(key)) {
            continue;
        }
        keyset.add(key);

        cfg.log('keyset', keyset);

        const res = calculateFuzzyScore(excerpt, candidate, pagesN, seams, maxDist);
        const dist = res?.dist ?? null;
        const acceptance = res?.acceptance ?? maxDist;

        cfg.log('dist', dist);

        if (dist === null) {
            continue;
        }
        if (dist > acceptance) {
            continue;
        }

        if (!best || dist < best.dist || (dist === best.dist && candidate.page < best.page)) {
            best = { dist, page: candidate.page };
            cfg.log('findBest best', best);
            if (dist === 0) {
                break;
            }
        }
    }

    return best;
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
function sortMatches(hits: Map<number, PageHit>): number[] {
    if (hits.size === 0) {
        return [];
    }

    // 1) Collapse adjacent seam pairs: keep the stronger seam and drop the weaker neighbor.
    //    Rationale: a seam at page p covers boundary (p, p+1). When both seam(p) and seam(p+1)
    //    exist for the same excerpt, they are competing views of nearly the same cross-page
    //    region; keeping only the higher-scoring one prevents duplicate, lower-quality
    //    artifacts (like your page 1 alongside page 2).
    const pagesAsc = Array.from(hits.keys()).sort((a, b) => a - b);
    for (let i = 0; i < pagesAsc.length; i++) {
        const p = pagesAsc[i]!;
        const hp = hits.get(p);
        if (!hp || !hp.seam) {
            continue;
        }

        const q = p + 1;
        const hq = hits.get(q);
        if (!hq || !hq.seam) {
            continue;
        }

        // Both are seam hits on adjacent pages: drop the weaker one.
        if (hq.score > hp.score) {
            hits.delete(p);
        } else if (hq.score < hp.score) {
            hits.delete(q);
        } else {
            // Tie: prefer the earlier page (stable reading-order bias).
            hits.delete(q);
        }
    }

    // 2) Remove seam hits that are worse than a non-seam neighbor on the following page.
    //    If page (p+1) has an exact or stronger non-seam fuzzy match, seam(p) is redundant.
    for (const [page, hit] of Array.from(hits.entries())) {
        if (!hit.seam) {
            continue;
        }

        const neighbor = hits.get(page + 1);
        if (!neighbor) {
            continue;
        }

        if (neighbor.exact || (!neighbor.seam && neighbor.score >= hit.score)) {
            hits.delete(page);
        }
    }

    // 3) Split and rank: exact first in reading order; then fuzzy by score desc, then page asc.
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
}

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
