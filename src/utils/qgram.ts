type Posting = { page: number; pos: number; seam: boolean };
type GramBase = { gram: string; offset: number };
type GramItem = GramBase & { freq: number };

/**
 * Selects grams that exist in the index from sorted items.
 */
const selectExistingGrams = (
    map: Map<string, Posting[]>,
    sortedItems: GramItem[],
    gramsPerExcerpt: number,
): GramBase[] => {
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
 */
const selectFallbackGrams = (
    map: Map<string, Posting[]>,
    sortedItems: GramItem[],
    gramsPerExcerpt: number,
): GramBase[] => {
    const result: GramBase[] = [];

    for (let i = sortedItems.length - 1; i >= 0 && result.length < gramsPerExcerpt; i--) {
        const item = sortedItems[i];
        if (map.has(item.gram)) {
            result.push({ gram: item.gram, offset: item.offset });
        }
    }

    return result;
};

export class QGramIndex {
    private q: number;
    private map = new Map<string, Posting[]>();
    private gramFreq = new Map<string, number>();

    constructor(q: number) {
        this.q = q;
    }

    addText(page: number, text: string, seam: boolean): void {
        this.addGramsToMap(page, text, seam);
        this.updateGramFrequencies(text);
    }

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
