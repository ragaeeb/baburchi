import { describe, expect, it } from 'bun:test';

import { boundedLevenshtein, calculateLevenshteinDistance } from './leventhein';

describe('leventhein', () => {
    describe('calculateLevenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(calculateLevenshteinDistance('hello', 'hello')).toBe(0);
            expect(calculateLevenshteinDistance('', '')).toBe(0);
            expect(calculateLevenshteinDistance('a', 'a')).toBe(0);
        });

        it('should return length for empty vs non-empty string', () => {
            expect(calculateLevenshteinDistance('', 'hello')).toBe(5);
            expect(calculateLevenshteinDistance('hello', '')).toBe(5);
        });

        it('should return 0 for two empty strings', () => {
            expect(calculateLevenshteinDistance('', '')).toBe(0);
        });

        it('should calculate correct distance for substitutions', () => {
            expect(calculateLevenshteinDistance('cat', 'bat')).toBe(1);
        });

        it('should calculate correct distance for insertions', () => {
            expect(calculateLevenshteinDistance('cat', 'cats')).toBe(1);
        });

        it('should calculate correct distance for deletions', () => {
            expect(calculateLevenshteinDistance('cats', 'cat')).toBe(1);
        });

        it('should handle complex example', () => {
            expect(calculateLevenshteinDistance('kitten', 'sitting')).toBe(3);
        });

        it('should work with Arabic text', () => {
            expect(calculateLevenshteinDistance('السلام', 'السلم')).toBe(1);
        });

        it('should be symmetric', () => {
            const dist1 = calculateLevenshteinDistance('hello', 'world');
            const dist2 = calculateLevenshteinDistance('world', 'hello');
            expect(dist1).toBe(dist2);
        });

        it('should handle strings of very different lengths', () => {
            expect(calculateLevenshteinDistance('a', 'abcdefg')).toBe(6);
            expect(calculateLevenshteinDistance('abcdefg', 'a')).toBe(6);
        });
    });

    describe('boundedLevenshtein', () => {
        it('should return exact distance when within bound', () => {
            expect(boundedLevenshtein('abc', 'def', 5)).toBe(3);
            expect(boundedLevenshtein('kitten', 'sitting', 5)).toBe(3);
        });

        it('should return bound + 1 when distance exceeds bound', () => {
            expect(boundedLevenshtein('abc', 'xyz', 2)).toBe(3); // bound + 1
            expect(boundedLevenshtein('hello', 'world', 3)).toBe(4); // bound + 1
        });

        it('should handle identical strings', () => {
            expect(boundedLevenshtein('hello', 'hello', 1)).toBe(0);
            expect(boundedLevenshtein('', '', 5)).toBe(0);
        });

        it('should handle empty strings', () => {
            expect(boundedLevenshtein('', 'hello', 10)).toBe(5);
            expect(boundedLevenshtein('hello', '', 10)).toBe(5);
            expect(boundedLevenshtein('', 'hello', 3)).toBe(4);
        });

        it('should early exit on length difference', () => {
            expect(boundedLevenshtein('a', 'abcde', 2)).toBe(3); // bound + 1
            expect(boundedLevenshtein('abcde', 'a', 3)).toBe(4); // bound + 1
        });

        it('should handle zero bound', () => {
            expect(boundedLevenshtein('abc', 'abc', 0)).toBe(0);
            expect(boundedLevenshtein('abc', 'def', 0)).toBe(1); // bound + 1
        });

        it('should handle single character differences within bound', () => {
            expect(boundedLevenshtein('abc', 'axc', 1)).toBe(1);
            expect(boundedLevenshtein('abc', 'ab', 1)).toBe(1);
        });

        it('should optimize by swapping longer string', () => {
            const short = 'abc';
            const long = 'abcdefghij';
            expect(boundedLevenshtein(long, short, 10)).toBe(boundedLevenshtein(short, long, 10));
        });

        it('should handle large bound efficiently', () => {
            expect(boundedLevenshtein('test', 'testing', 100)).toBe(3);
        });

        it('should handle edge cases with bound 1', () => {
            expect(boundedLevenshtein('a', 'b', 1)).toBe(1);
            expect(boundedLevenshtein('a', 'ab', 1)).toBe(1);
            expect(boundedLevenshtein('ab', 'a', 1)).toBe(1);
            expect(boundedLevenshtein('ab', 'cd', 1)).toBe(2); // bound + 1
        });
    });
});
