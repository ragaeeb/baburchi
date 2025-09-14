import { describe, expect, it } from 'bun:test';

import { calculateLevenshteinDistance } from './leventhein';

describe('leventhein', () => {
    describe('calculateLevenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(calculateLevenshteinDistance('hello', 'hello')).toBe(0);
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
    });
});
