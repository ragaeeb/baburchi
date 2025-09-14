import { describe, expect, it } from 'bun:test';

import { QGramIndex } from './qgram';

describe('QGramIndex', () => {
    it('should create index with specified q value', () => {
        const index = new QGramIndex(3);
        expect(index).toBeInstanceOf(QGramIndex);
    });

    it('should add text and generate postings', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'hello', false);

        const postings = index.getPostings('he');
        expect(postings).toEqual([{ page: 0, pos: 0, seam: false }]);

        const ellPostings = index.getPostings('el');
        expect(ellPostings).toEqual([{ page: 0, pos: 1, seam: false }]);
    });

    it('should handle multiple pages', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'hello', false);
        index.addText(1, 'world', false);

        const loPostings = index.getPostings('lo');
        expect(loPostings).toEqual([{ page: 0, pos: 3, seam: false }]);

        const rlPostings = index.getPostings('rl');
        expect(rlPostings).toEqual([{ page: 1, pos: 2, seam: false }]);
    });

    it('should handle seam flag', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'test', true);

        const postings = index.getPostings('te');
        expect(postings).toEqual([{ page: 0, pos: 0, seam: true }]);
    });

    it('should return undefined for non-existent grams', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'hello', false);

        expect(index.getPostings('xyz')).toBeUndefined();
    });

    it('should handle overlapping grams across multiple occurrences', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'abab', false);

        const abPostings = index.getPostings('ab');
        expect(abPostings).toEqual([
            { page: 0, pos: 0, seam: false },
            { page: 0, pos: 2, seam: false },
        ]);
    });

    it('should pick rare grams correctly', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'common', false);
        index.addText(1, 'common', false);
        index.addText(2, 'rare', false);

        const rareGrams = index.pickRare('rare', 2);
        expect(rareGrams).toHaveLength(2);
        expect(rareGrams.some((g) => g.gram === 'ra')).toBe(true);
    });

    it('should limit number of picked grams', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'testing', false);

        const grams = index.pickRare('testing', 3);
        expect(grams.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty text', () => {
        const index = new QGramIndex(3);
        index.addText(0, '', false);

        const grams = index.pickRare('', 5);
        expect(grams).toEqual([]);
    });

    it('should handle text shorter than q', () => {
        const index = new QGramIndex(5);
        index.addText(0, 'hi', false);

        const postings = index.getPostings('hi');
        expect(postings).toBeUndefined();

        const grams = index.pickRare('hi', 5);
        expect(grams).toEqual([]);
    });

    it('should handle duplicate grams in same text', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'aaaa', false);

        const aaPostings = index.getPostings('aa');
        expect(aaPostings).toEqual([
            { page: 0, pos: 0, seam: false },
            { page: 0, pos: 1, seam: false },
            { page: 0, pos: 2, seam: false },
        ]);
    });

    it('should prefer rarer grams when picking', () => {
        const index = new QGramIndex(2);
        // Add common pattern multiple times
        for (let i = 0; i < 10; i++) {
            index.addText(i, 'common', false);
        }
        // Add rare pattern once
        index.addText(10, 'unique', false);

        const grams = index.pickRare('unique', 3);
        // Should prefer the unique grams over common ones
        expect(grams.length).toBeGreaterThan(0);
        expect(grams.every((g) => ['un', 'ni', 'iq', 'qu', 'ue'].includes(g.gram))).toBe(true);
    });

    it('should handle fallback selection when no rare grams exist', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'test', false);

        // Try to pick grams from text not in index
        const grams = index.pickRare('notinindex', 2);
        expect(grams).toEqual([]);
    });

    it('should handle q=1 (single character grams)', () => {
        const index = new QGramIndex(1);
        index.addText(0, 'abc', false);

        expect(index.getPostings('a')).toEqual([{ page: 0, pos: 0, seam: false }]);
        expect(index.getPostings('b')).toEqual([{ page: 0, pos: 1, seam: false }]);
        expect(index.getPostings('c')).toEqual([{ page: 0, pos: 2, seam: false }]);
    });

    it('should track gram frequencies correctly', () => {
        const index = new QGramIndex(2);
        index.addText(0, 'abab', false); // 'ab' appears twice
        index.addText(1, 'cd', false); // 'cd' appears once

        const grams = index.pickRare('abcd', 4);
        // Should prefer 'cd' over 'ab' since 'cd' is rarer
        expect(grams.some((g) => g.gram === 'cd')).toBe(true);
    });

    it('should handle large q values', () => {
        const index = new QGramIndex(10);
        const text = 'this is a long text for testing';
        index.addText(0, text, false);

        const grams = index.pickRare(text, 5);
        expect(grams.length).toBeGreaterThan(0);
        expect(grams.every((g) => g.gram.length === 10)).toBe(true);
    });
});
