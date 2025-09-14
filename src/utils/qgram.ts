type Posting = { page: number; pos: number; seam: boolean };

export class QGramIndex {
    private q: number;
    private map: Map<string, Posting[]> = new Map();
    private gramFreq: Map<string, number> = new Map();

    constructor(q: number) {
        this.q = q;
    }

    addText(page: number, text: string, seam: boolean): void {
        const q = this.q;
        for (let i = 0; i + q <= text.length; i++) {
            const g = text.slice(i, i + q);
            let arr = this.map.get(g);
            if (arr === undefined) {
                arr = [];
                this.map.set(g, arr);
            }
            arr.push({ page, pos: i, seam });
        }
        for (let i = 0; i + q <= text.length; i++) {
            const g = text.slice(i, i + q);
            this.gramFreq.set(g, (this.gramFreq.get(g) ?? 0) + 1);
        }
    }

    pickRare(excerpt: string, gramsPerExcerpt: number): { gram: string; offset: number }[] {
        const q = this.q;
        const items: Array<{ gram: string; offset: number; freq: number }> = [];
        const seen = new Set<string>();

        for (let i = 0; i + q <= excerpt.length; i++) {
            const g = excerpt.slice(i, i + q);
            if (seen.has(g)) {
                continue;
            }
            seen.add(g);
            const f = this.gramFreq.get(g) ?? 0x7fffffff;
            items.push({ gram: g, offset: i, freq: f });
        }
        items.sort((a, b) => a.freq - b.freq);

        const out: { gram: string; offset: number }[] = [];
        for (const it of items) {
            if (this.map.has(it.gram)) {
                out.push({ gram: it.gram, offset: it.offset });
                if (out.length >= gramsPerExcerpt) {
                    break;
                }
            }
        }
        if (out.length === 0) {
            for (let i = items.length - 1; i >= 0 && out.length < gramsPerExcerpt; i--) {
                if (this.map.has(items[i].gram)) {
                    out.push({ gram: items[i].gram, offset: items[i].offset });
                }
            }
        }
        return out;
    }

    getPostings(gram: string): Posting[] | undefined {
        return this.map.get(gram);
    }
}
