/**
 * Represents a posting in the inverted index, storing position information.
 */
type Posting = {
    /** Page number where this gram occurs */
    page: number;
    /** Position within the page where this gram starts */
    pos: number;
    /** Whether this posting is from a seam (cross-page boundary) */
    seam: boolean;
};

/**
 * Basic gram information with position offset.
 */
type GramBase = {
    /** The q-gram string */
    gram: string;
    /** Offset position of this gram in the original text */
    offset: number;
};

/**
 * Extended gram information including frequency data for selection.
 */
type GramItem = GramBase & {
    /** Frequency count of this gram in the corpus */
    freq: number;
};

/**
 * Q-gram index for efficient fuzzy string matching candidate generation.
 * Maintains an inverted index of q-grams to their occurrence positions.
 */
export class QGramIndex {
    /** Length of q-grams to index */

    private q: number;
    /** Inverted index mapping q-grams to their postings */

    private map = new Map<string, Posting[]>();
    /** Frequency count for each q-gram in the corpus */

    private gramFreq = new Map<string, number>();

    /**
     * Creates a new Q-gram index with the specified gram length.
     * @param q - Length of q-grams to index (typically 3-5)
     */
    constructor(q: number) {
        this.q = q;
    }

    /**
     * Adds text to the index, extracting q-grams and building postings.
     *
     * @param page - Page number or identifier for this text
     * @param text - Text content to index
     * @param seam - Whether this text represents a seam (cross-page boundary)
     */
    addText(page: number, text: string, seam: boolean): void {
        const q = this.q;
        const m = text.length;
        if (m < q) {
            return;
        }

        for (let i = 0; i + q <= m; i++) {
            const gram = text.slice(i, i + q);

            // postings
            let postings = this.map.get(gram);
            if (!postings) {
                postings = [];
                this.map.set(gram, postings);
            }
            postings.push({ page, pos: i, seam });

            // freq
            this.gramFreq.set(gram, (this.gramFreq.get(gram) ?? 0) + 1);
        }
    }

    /**
     * Picks the rarest grams from an excerpt that exist in the index.
     */
    pickRare(excerpt: string, gramsPerExcerpt: number): { gram: string; offset: number }[] {
        gramsPerExcerpt = Math.max(1, Math.floor(gramsPerExcerpt));

        // extract unique grams with freqs (single pass)
        const items: GramItem[] = [];
        const seen = new Set<string>();
        const q = this.q;
        for (let i = 0; i + q <= excerpt.length; i++) {
            const gram = excerpt.slice(i, i + q);
            if (seen.has(gram)) {
                continue;
            }
            seen.add(gram);
            const freq = this.gramFreq.get(gram) ?? 0x7fffffff;
            items.push({ freq, gram, offset: i });
        }
        items.sort((a, b) => a.freq - b.freq);

        // prefer rare grams that exist; fallback to common ones if nothing exists
        const result: GramBase[] = [];
        for (const it of items) {
            if (this.map.has(it.gram)) {
                result.push({ gram: it.gram, offset: it.offset });
                if (result.length >= gramsPerExcerpt) {
                    return result;
                }
            }
        }
        if (result.length < gramsPerExcerpt) {
            const chosen = new Set(result.map((r) => r.gram));
            for (let i = items.length - 1; i >= 0 && result.length < gramsPerExcerpt; i--) {
                const it = items[i]!;
                if (this.map.has(it.gram) && !chosen.has(it.gram)) {
                    result.push({ gram: it.gram, offset: it.offset });
                    chosen.add(it.gram);
                }
            }
        }
        return result;
    }

    getPostings(gram: string): Posting[] | undefined {
        return this.map.get(gram);
    }
}
