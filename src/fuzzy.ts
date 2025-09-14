import { sanitizeArabic } from './sanitize';
import type { MatchPolicy } from './types';
import { AhoCorasick } from './utils/ahocorasick';
import { DEFAULT_POLICY } from './utils/constants';
import { boundedLevenshtein } from './utils/leventhein';
import { QGramIndex } from './utils/qgram';

function buildBook(pagesN: string[]) {
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

function posToPage(pos: number, pageStarts: number[]): number {
    let lo = 0,
        hi = pageStarts.length - 1,
        ans = 0;
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

type Candidate = { page: number; start: number; seam: boolean };

export function findMatches(pages: string[], excerpts: string[], policy: MatchPolicy = {}): number[] {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    // Dedup excerpts
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

    const { book, starts: pageStarts } = buildBook(pagesN);

    // Exact/substring with AC
    const ac = new AhoCorasick();
    for (let pid = 0; pid < patterns.length; pid++) {
        const pat = patterns[pid];
        if (pat.length > 0) {
            ac.add(pat, pid);
        }
    }
    ac.build();

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

    // If everything matched or fuzzy disabled
    let allMatched = true;
    for (let i = 0; i < seenExact.length; i++) {
        if (!seenExact[i]) {
            allMatched = false;
            break;
        }
    }
    if (allMatched || !cfg.enableFuzzy) {
        return Array.from(result);
    }

    // Fuzzy: q-gram index + seams
    const qidx = new QGramIndex(cfg.q);
    for (let p = 0; p < pagesN.length; p++) {
        qidx.addText(p, pagesN[p], false);
    }
    const seams: Array<{ text: string; startPage: number }> = [];
    for (let p = 0; p + 1 < pagesN.length; p++) {
        const left = pagesN[p].slice(-cfg.seamLen);
        const right = pagesN[p + 1].slice(0, cfg.seamLen);
        const text = `${left} ${right}`;
        seams.push({ text, startPage: p });
        qidx.addText(p, text, true);
    }

    const pickBestFuzzy = (excerpt: string, candidates: Candidate[]): { page: number; dist: number } | null => {
        const L = excerpt.length;
        if (L === 0) {
            return null;
        }
        const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * L));
        let best: { page: number; dist: number } | null = null;

        const keyset = new Set<string>();
        for (const c of candidates) {
            const k = `${c.page}:${c.start}:${c.seam ? 1 : 0}`;
            if (keyset.has(k)) {
                continue;
            }
            keyset.add(k);

            const src = c.seam ? seams[c.page]?.text : pagesN[c.page];
            if (!src) {
                continue;
            }

            const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
            const start0 = Math.max(0, c.start - Math.floor(extra / 2));
            const end0 = Math.min(src.length, start0 + L + extra);
            if (end0 <= start0) {
                continue;
            }

            const window = src.slice(start0, end0);
            const d = boundedLevenshtein(excerpt, window, maxDist);
            if (d <= maxDist) {
                if (!best || d < best.dist || (d === best.dist && c.page < best.page)) {
                    best = { page: c.page, dist: d };
                    if (d === 0) {
                        break;
                    }
                }
            }
        }
        return best;
    };

    for (let i = 0; i < excerptsN.length; i++) {
        if (seenExact[i]) {
            continue;
        }
        const ex = excerptsN[i];
        if (!ex || ex.length < cfg.q) {
            continue;
        }

        const seeds = qidx.pickRare(ex, cfg.gramsPerExcerpt);
        if (seeds.length === 0) {
            continue;
        }

        const allCandidates: Array<{ page: number; start: number; seam: boolean }> = [];
        for (const { gram, offset } of seeds) {
            const posts = qidx.getPostings(gram);
            if (!posts) {
                continue;
            }
            for (const p of posts) {
                const startPos = p.pos - offset;
                if (startPos < -Math.floor(ex.length * 0.25)) {
                    continue;
                }
                allCandidates.push({ page: p.page, start: Math.max(0, startPos), seam: p.seam });
                if (allCandidates.length >= cfg.maxCandidatesPerExcerpt) {
                    break;
                }
            }
            if (allCandidates.length >= cfg.maxCandidatesPerExcerpt) {
                break;
            }
        }

        if (allCandidates.length === 0) {
            continue;
        }

        const best = pickBestFuzzy(ex, allCandidates);
        if (best) {
            result[i] = best.page;
            seenExact[i] = 1;
        }
    }

    return Array.from(result);
}

export function findMatchesAll(pages: string[], excerpts: string[], policy: MatchPolicy = {}): number[][] {
    const cfg = { ...DEFAULT_POLICY, ...policy };

    const pagesN = pages.map((p) => sanitizeArabic(p, 'aggressive'));
    const excerptsN = excerpts.map((e) => sanitizeArabic(e, 'aggressive'));

    // Dedup excerpts
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

    const { book, starts: pageStarts } = buildBook(pagesN);

    // Collect matches per excerpt as best score per page
    type PageHit = { score: number; exact: boolean };
    const hitsByExcerpt: Array<Map<number, PageHit>> = Array.from({ length: excerpts.length }, () => new Map());

    // Exact with AC: record ALL exact hits
    const ac = new AhoCorasick();
    for (let pid = 0; pid < patterns.length; pid++) {
        const pat = patterns[pid];
        if (pat.length > 0) {
            ac.add(pat, pid);
        }
    }
    ac.build();

    ac.find(book, (pid, endPos) => {
        const pat = patterns[pid];
        const startPos = endPos - pat.length;
        const startPage = posToPage(startPos, pageStarts);
        for (const origIdx of patIdToOrigIdxs[pid]) {
            const m = hitsByExcerpt[origIdx];
            // exact matches get score = 1.0
            const prev = m.get(startPage);
            if (!prev || !prev.exact) {
                m.set(startPage, { score: 1, exact: true });
            }
        }
    });

    // Fuzzy for excerpts that have no exact hits (to keep cost bounded)
    if (cfg.enableFuzzy) {
        const qidx = new QGramIndex(cfg.q);
        for (let p = 0; p < pagesN.length; p++) {
            qidx.addText(p, pagesN[p], false);
        }
        const seams: Array<{ text: string; startPage: number }> = [];
        for (let p = 0; p + 1 < pagesN.length; p++) {
            const left = pagesN[p].slice(-cfg.seamLen);
            const right = pagesN[p + 1].slice(0, cfg.seamLen);
            const text = left + ' ' + right;
            seams.push({ text, startPage: p });
            qidx.addText(p, text, true);
        }

        for (let i = 0; i < excerptsN.length; i++) {
            // Skip if we already have at least one exact hit
            if (hitsByExcerpt[i].size && Array.from(hitsByExcerpt[i].values()).some((v) => v.exact)) {
                continue;
            }

            const ex = excerptsN[i];
            if (!ex || ex.length < cfg.q) {
                continue;
            }

            const seeds = qidx.pickRare(ex, cfg.gramsPerExcerpt);
            if (seeds.length === 0) {
                continue;
            }

            const candidates: Array<{ page: number; start: number; seam: boolean }> = [];
            for (const { gram, offset } of seeds) {
                const posts = qidx.getPostings(gram);
                if (!posts) {
                    continue;
                }
                for (const p of posts) {
                    const startPos = p.pos - offset;
                    if (startPos < -Math.floor(ex.length * 0.25)) {
                        continue;
                    }
                    candidates.push({ page: p.page, start: Math.max(0, startPos), seam: p.seam });
                    if (candidates.length >= cfg.maxCandidatesPerExcerpt) {
                        break;
                    }
                }
                if (candidates.length >= cfg.maxCandidatesPerExcerpt) {
                    break;
                }
            }
            if (candidates.length === 0) {
                continue;
            }

            const L = ex.length;
            const maxDist = Math.max(cfg.maxEditAbs, Math.ceil(cfg.maxEditRel * L));
            const keyset = new Set<string>();
            let bestDist = Number.POSITIVE_INFINITY;

            for (const c of candidates) {
                const k = `${c.page}:${c.start}:${c.seam ? 1 : 0}`;
                if (keyset.has(k)) {
                    continue;
                }
                keyset.add(k);

                const src = c.seam ? seams[c.page]?.text : pagesN[c.page];
                if (!src) {
                    continue;
                }

                const extra = Math.min(maxDist, Math.max(6, Math.ceil(L * 0.12)));
                const start0 = Math.max(0, c.start - Math.floor(extra / 2));
                const end0 = Math.min(src.length, start0 + L + extra);
                if (end0 <= start0) {
                    continue;
                }

                const window = src.slice(start0, end0);
                const d = boundedLevenshtein(ex, window, maxDist);
                if (d <= maxDist) {
                    if (d < bestDist) {
                        bestDist = d;
                    }
                    const score = 1 - d / maxDist; // in (0, 1], higher is better
                    const entry = hitsByExcerpt[i].get(c.page);
                    if (!entry || (entry && !entry.exact && score > entry.score)) {
                        hitsByExcerpt[i].set(c.page, { score, exact: false });
                    }
                }
            }
        }
    }

    // Build output: for each excerpt, list page indices best-first
    const out: number[][] = [];
    for (let i = 0; i < hitsByExcerpt.length; i++) {
        const m = hitsByExcerpt[i];
        if (m.size === 0) {
            out.push([]);
            continue;
        }

        // Sort: exact first (stable by page order), then fuzzy by score desc, then page asc
        const exact: Array<[number, PageHit]> = [];
        const fuzzy: Array<[number, PageHit]> = [];
        for (const e of m.entries()) {
            if (e[1].exact) {
                exact.push(e);
            } else {
                fuzzy.push(e);
            }
        }

        exact.sort((a, b) => a[0] - b[0]); // reading order
        fuzzy.sort((a, b) => b[1].score - a[1].score || a[0] - b[0]);

        out.push([...exact, ...fuzzy].map((e) => e[0]));
    }

    return out;
}
