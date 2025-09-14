import type { MatchPolicy } from './types';
import { buildAhoCorasick } from './utils/ahocorasick';
import { DEFAULT_POLICY } from './utils/constants';
import { buildBook, deduplicateExcerpts, posToPage } from './utils/fuzzyUtils';
import { boundedLevenshtein } from './utils/leventhein';
import { QGramIndex } from './utils/qgram';
import { sanitizeArabic } from './utils/sanitize';

type Candidate = {
    page: number;
    start: number;
    seam: boolean;
};

type SeamData = {
    text: string;
    startPage: number;
};

type FuzzyMatch = {
    page: number;
    dist: number;
};

type PageHit = {
    score: number;
    exact: boolean;
};

/**
 * Performs exact matching using Aho-Corasick
 */
function findExactMatches(
    book: string,
    pageStarts: number[],
    patterns: string[],
    patIdToOrigIdxs: number[][],
    excerpts: string[],
): { result: Int32Array; seenExact: Uint8Array } {
    const ac = buildAhoCorasick(patterns);
    const result = new Int32Array(excerpts.length).fill(-1);
    const seenExact = new Uint8Array(excerpts.length);

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
 * Creates seam data for cross-page matching
 */
function createSeams(pagesN: string[], seamLen: number): SeamData[] {
    const seams: SeamData[] = [];
    for (let p = 0; p + 1 < pagesN.length; p++) {
        const left = pagesN[p].slice(-seamLen);
        const right = pagesN[p + 1].slice(0, seamLen);
        const text = `${left} ${right}`;
        seams.push({ text, startPage: p });
    }
    return seams;
}

/**
 * Builds Q-gram index for fuzzy matching
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
 * Generates candidates for fuzzy matching
 */
function generateCandidates(excerpt: string, qidx: QGramIndex, cfg: Required<MatchPolicy>): Candidate[] {
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
                start: Math.max(0, startPos),
                seam: p.seam,
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
 * Calculates fuzzy match score for a candidate
 */
function calculateFuzzyScore(
    excerpt: string,
    candidate: Candidate,
    pagesN: string[],
    seams: SeamData[],
    maxDist: number,
): number | null {
    const src = candidate.seam ? seams[candidate.page]?.text : pagesN[candidate.page];
    if (!src) {
        return null;
    }

    const L = excerpt.length;
    const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
    const start0 = Math.max(0, candidate.start - Math.floor(extra / 2));
    const end0 = Math.min(src.length, start0 + L + extra);

    if (end0 <= start0) {
        return null;
    }

    const window = src.slice(start0, end0);
    const dist = boundedLevenshtein(excerpt, window, maxDist);

    return dist <= maxDist ? dist : null;
}

/**
 * Finds the best fuzzy match among candidates
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
    const keyset = new Set<string>();
    let best: FuzzyMatch | null = null;

    for (const candidate of candidates) {
        const key = `${candidate.page}:${candidate.start}:${candidate.seam ? 1 : 0}`;
        if (keyset.has(key)) {
            continue;
        }
        keyset.add(key);

        const dist = calculateFuzzyScore(excerpt, candidate, pagesN, seams, maxDist);
        if (dist === null) {
            continue;
        }

        if (!best || dist < best.dist || (dist === best.dist && candidate.page < best.page)) {
            best = { page: candidate.page, dist };
            if (dist === 0) {
                break;
            }
        }
    }

    return best;
}

/**
 * Performs fuzzy matching for unmatched excerpts
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
        if (!excerpt || excerpt.length < cfg.q) {
            continue;
        }

        const candidates = generateCandidates(excerpt, qidx, cfg);
        if (candidates.length === 0) {
            continue;
        }

        const best = findBestFuzzyMatch(excerpt, candidates, pagesN, seams, cfg);
        if (best) {
            result[i] = best.page;
            seenExact[i] = 1;
        }
    }
}

/**
 * Main function to find single best match per excerpt
 */
export function findMatches(pages: string[], excerpts: string[], policy: MatchPolicy = {}) {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    const { patIdToOrigIdxs, patterns } = deduplicateExcerpts(excerptsN);
    const { book, starts: pageStarts } = buildBook(pagesN);

    const { result, seenExact } = findExactMatches(book, pageStarts, patterns, patIdToOrigIdxs, excerpts);

    if (!seenExact.every((seen) => seen === 1)) {
        performFuzzyMatching(excerptsN, pagesN, seenExact, result, cfg);
    }

    return Array.from(result);
}

/**
 * Records exact matches for findMatchesAll
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
                hits.set(startPage, { score: 1, exact: true });
            }
        }
    });
}

/**
 * Records fuzzy matches for excerpts without exact matches
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
        // Skip if we already have exact hits
        const hasExactHits = Array.from(hitsByExcerpt[i].values()).some((v) => v.exact);
        if (hasExactHits) {
            continue;
        }

        const excerpt = excerptsN[i];
        if (!excerpt || excerpt.length < cfg.q) {
            continue;
        }

        const candidates = generateCandidates(excerpt, qidx, cfg);
        if (candidates.length === 0) {
            continue;
        }

        const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * excerpt.length));
        const keyset = new Set<string>();

        for (const candidate of candidates) {
            const key = `${candidate.page}:${candidate.start}:${candidate.seam ? 1 : 0}`;
            if (keyset.has(key)) {
                continue;
            }
            keyset.add(key);

            const dist = calculateFuzzyScore(excerpt, candidate, pagesN, seams, maxDist);
            if (dist === null) {
                continue;
            }

            const score = 1 - dist / maxDist; // in (0, 1], higher is better
            const entry = hitsByExcerpt[i].get(candidate.page);
            if (!entry || (!entry.exact && score > entry.score)) {
                hitsByExcerpt[i].set(candidate.page, { score, exact: false });
            }
        }
    }
}

/**
 * Sorts matches by quality and page order
 */
function sortMatches(hits: Map<number, PageHit>): number[] {
    if (hits.size === 0) {
        return [];
    }

    const exact: [number, PageHit][] = [];
    const fuzzy: [number, PageHit][] = [];

    for (const entry of hits.entries()) {
        if (entry[1].exact) {
            exact.push(entry);
        } else {
            fuzzy.push(entry);
        }
    }

    exact.sort((a, b) => a[0] - b[0]); // reading order
    fuzzy.sort((a, b) => b[1].score - a[1].score || a[0] - b[0]); // score desc, then page asc

    return [...exact, ...fuzzy].map((entry) => entry[0]);
}

/**
 * Main function to find all matches per excerpt, ranked by quality
 */
export function findMatchesAll(pages: string[], excerpts: string[], policy: MatchPolicy = {}): number[][] {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

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
