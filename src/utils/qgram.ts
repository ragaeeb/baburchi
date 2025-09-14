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
 * Selects grams that exist in the index from sorted items by frequency.
 * Prioritizes rarer grams for better discrimination.
 *
 * @param map - Inverted index mapping grams to postings
 * @param sortedItems - Gram items sorted by frequency (rarest first)
 * @param gramsPerExcerpt - Maximum number of grams to select
 * @returns Array of selected grams that exist in the index
 */
const selectExistingGrams = (map: Map<string, Posting[]>, sortedItems: GramItem[], gramsPerExcerpt: number) => {
    const result: GramBase[] = [];

    for (const item of sortedItems) {
        if (map.has(item.gram)) {
            result.push({ gram: item.gram, offset: item.offset });
            if (result.length >= gramsPerExcerpt) {
                break;
            }
        }
    }

    return result;
};

/**
 * Fallback selection when no indexed grams are found in rare items.
 * Selects from the most common grams as a last resort.
 *
 * @param map - Inverted index mapping grams to postings
 * @param sortedItems - Gram items sorted by frequency
 * @param gramsPerExcerpt - Maximum number of grams to select
 * @returns Array of fallback grams from most common items
 */
const selectFallbackGrams = (map: Map<string, Posting[]>, sortedItems: GramItem[], gramsPerExcerpt: number) => {
    const result: GramBase[] = [];

    for (let i = sortedItems.length - 1; i >= 0 && result.length < gramsPerExcerpt; i--) {
        const item = sortedItems[i];
        if (map.has(item.gram)) {
            result.push({ gram: item.gram, offset: item.offset });
        }
    }

    return result;
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
     *
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
        this.addGramsToMap(page, text, seam);
        this.updateGramFrequencies(text);
    }

    /**
     * Adds q-grams from text to the inverted index with position information.
     *
     * @param page - Page number for the text
     * @param text - Text to extract grams from
     * @param seam - Whether this is seam text
     */
    private addGramsToMap(page: number, text: string, seam: boolean): void {
        for (let i = 0; i + this.q <= text.length; i++) {
            const gram = text.slice(i, i + this.q);
            const postings = this.map.get(gram) ?? [];
            if (postings.length === 0) {
                this.map.set(gram, postings);
            }
            postings.push({ page, pos: i, seam });
        }
    }

    private updateGramFrequencies(text: string): void {
        for (let i = 0; i + this.q <= text.length; i++) {
            const gram = text.slice(i, i + this.q);
            this.gramFreq.set(gram, (this.gramFreq.get(gram) ?? 0) + 1);
        }
    }

    /**
     * Extracts unique grams from excerpt with their frequencies.
     */
    private extractUniqueGrams(excerpt: string): GramItem[] {
        const items: GramItem[] = [];
        const seen = new Set<string>();

        for (let i = 0; i + this.q <= excerpt.length; i++) {
            const gram = excerpt.slice(i, i + this.q);
            if (seen.has(gram)) {
                continue;
            }

            seen.add(gram);
            const freq = this.gramFreq.get(gram) ?? 0x7fffffff;
            items.push({ gram, offset: i, freq });
        }

        return items.sort((a, b) => a.freq - b.freq);
    }

    /**
     * Picks the rarest grams from an excerpt that exist in the index.
     */
    pickRare(excerpt: string, gramsPerExcerpt: number): { gram: string; offset: number }[] {
        const sortedItems = this.extractUniqueGrams(excerpt);
        const selected = selectExistingGrams(this.map, sortedItems, gramsPerExcerpt);

        return selected.length > 0 ? selected : selectFallbackGrams(this.map, sortedItems, gramsPerExcerpt);
    }

    getPostings(gram: string): Posting[] | undefined {
        return this.map.get(gram);
    }
}
