class ACNode {
    next: Map<string, number> = new Map();
    link = 0;
    out: number[] = [];
}

export class AhoCorasick {
    private nodes: ACNode[] = [new ACNode()];

    add(pattern: string, id: number): void {
        let v = 0;
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];
            let to = this.nodes[v].next.get(ch);
            if (to === undefined) {
                to = this.nodes.length;
                this.nodes[v].next.set(ch, to);
                this.nodes.push(new ACNode());
            }
            v = to;
        }
        this.nodes[v].out.push(id);
    }

    build(): void {
        const q: number[] = [];
        for (const [, to] of this.nodes[0].next) {
            this.nodes[to].link = 0;
            q.push(to);
        }
        while (q.length) {
            const v = q.shift()!;
            for (const [ch, to] of this.nodes[v].next) {
                q.push(to);
                let link = this.nodes[v].link;
                while (link !== 0 && !this.nodes[link].next.has(ch)) {
                    link = this.nodes[link].link;
                }
                const nxt = this.nodes[link].next.get(ch);
                this.nodes[to].link = nxt === undefined ? 0 : nxt;
                this.nodes[to].out = this.nodes[to].out.concat(this.nodes[this.nodes[to].link].out);
            }
        }
    }

    find(text: string, onMatch: (patternId: number, endPos: number) => void): void {
        let v = 0;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            while (v !== 0 && !this.nodes[v].next.has(ch)) {
                v = this.nodes[v].link;
            }
            const to = this.nodes[v].next.get(ch);
            v = to === undefined ? 0 : to;
            if (this.nodes[v].out.length) {
                for (const pid of this.nodes[v].out) {
                    onMatch(pid, i + 1);
                }
            }
        }
    }
}
