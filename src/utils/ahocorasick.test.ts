import { describe, expect, it } from 'bun:test';
import { buildAhoCorasick } from './ahocorasick';

describe('AhoCorasick', () => {
    it('should build automaton and find single pattern', () => {
        const ac = buildAhoCorasick(['hello']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('hello world', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toEqual([{ patternId: 0, endPos: 5 }]);
    });

    it('should find multiple patterns in text', () => {
        const ac = buildAhoCorasick(['he', 'she', 'his', 'hers']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('ushers', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.patternId === 1)).toBe(true); // 'she' found
    });

    it('should handle overlapping patterns', () => {
        const ac = buildAhoCorasick(['abc', 'bcd', 'cde']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('abcde', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toHaveLength(3);
        expect(matches.map((m) => m.patternId).sort()).toEqual([0, 1, 2]);
    });

    it('should handle empty patterns', () => {
        const ac = buildAhoCorasick(['', 'test', '']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('test', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toEqual([{ patternId: 1, endPos: 4 }]);
    });

    it('should handle patterns not found in text', () => {
        const ac = buildAhoCorasick(['xyz', 'abc']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('hello world', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toHaveLength(0);
    });

    it('should handle empty text', () => {
        const ac = buildAhoCorasick(['test']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toHaveLength(0);
    });

    it('should handle single character patterns', () => {
        const ac = buildAhoCorasick(['a', 'b', 'c']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('abc', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toHaveLength(3);
        expect(matches.map((m) => ({ id: m.patternId, pos: m.endPos }))).toEqual([
            { id: 0, pos: 1 },
            { id: 1, pos: 2 },
            { id: 2, pos: 3 },
        ]);
    });

    it('should handle duplicate patterns', () => {
        const ac = buildAhoCorasick(['test', 'test', 'other']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('testing', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches).toHaveLength(2); // Both 'test' patterns should match
        expect(matches.every((m) => m.endPos === 4)).toBe(true);
    });

    it('should handle complex overlapping case', () => {
        const ac = buildAhoCorasick(['i', 'in', 'tin', 'sting']);
        const matches: Array<{ patternId: number; endPos: number }> = [];

        ac.find('sting', (patternId, endPos) => {
            matches.push({ patternId, endPos });
        });

        expect(matches.length).toBeGreaterThan(1);
        expect(matches.some((m) => m.patternId === 3)).toBe(true); // 'sting' found
    });
});
