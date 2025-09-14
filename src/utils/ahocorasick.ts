/**
 * Node in the Aho-Corasick automaton trie structure.
 * Each node represents a state in the pattern matching automaton.
 */
class ACNode {
    /** Transition map from characters to next node indices */
    next: Map<string, number> = new Map();
    /** Failure link for efficient pattern matching */
    link = 0;
    /** Pattern IDs that end at this node */
    out: number[] = [];
}

/**
 * Aho-Corasick automaton for efficient multi-pattern string matching.
 * Provides O(n + m + z) time complexity where n is text length,
 * m is total pattern length, and z is number of matches.
 */
class AhoCorasick {
    /** Array of nodes forming the automaton */
    private nodes: ACNode[] = [new ACNode()];

    /**
     * Adds a pattern to the automaton trie.
     *
     * @param pattern - Pattern string to add
     * @param id - Unique identifier for this pattern
     */
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

    /**
     * Builds failure links for the automaton using BFS.
     * Must be called after adding all patterns and before searching.
     */
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

    /**
     * Finds all pattern matches in the given text.
     *
     * @param text - Text to search in
     * @param onMatch - Callback function called for each match found
     *                  Receives pattern ID and end position of the match
     */
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

/**
 * Builds Aho-Corasick automaton for exact pattern matching.
 *
 * @param patterns - Array of patterns to search for
 * @returns Constructed and built Aho-Corasick automaton ready for searching
 *
 * @example
 * ```typescript
 * const patterns = ['hello', 'world', 'hell'];
 * const ac = buildAhoCorasick(patterns);
 * ac.find('hello world', (patternId, endPos) => {
 *   console.log(`Found pattern ${patternId} ending at position ${endPos}`);
 * });
 * ```
 */
export function buildAhoCorasick(patterns: string[]): AhoCorasick {
    const ac = new AhoCorasick();
    for (let pid = 0; pid < patterns.length; pid++) {
        const pat = patterns[pid];
        if (pat.length > 0) {
            ac.add(pat, pid);
        }
    }
    ac.build();
    return ac;
}
