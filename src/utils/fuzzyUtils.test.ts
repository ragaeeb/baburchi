import { describe, expect, it } from 'bun:test';
import { buildBook, deduplicateExcerpts, posToPage } from './fuzzyUtils';

describe('fuzzyUtils', () => {
    describe('buildBook', () => {
        it('should build book from single page', () => {
            const pages = ['Hello world'];
            const result = buildBook(pages);

            expect(result.book).toBe('Hello world');
            expect(result.starts).toEqual([0]);
            expect(result.lens).toEqual([11]);
        });

        it('should build book from multiple pages with spaces', () => {
            const pages = ['Page 1', 'Page 2', 'Page 3'];
            const result = buildBook(pages);

            expect(result.book).toBe('Page 1 Page 2 Page 3');
            expect(result.starts).toEqual([0, 7, 14]);
            expect(result.lens).toEqual([6, 6, 6]);
        });

        it('should handle empty pages', () => {
            const pages = ['', 'content', ''];
            const result = buildBook(pages);

            expect(result.book).toBe(' content ');
            expect(result.starts).toEqual([0, 1, 9]);
            expect(result.lens).toEqual([0, 7, 0]);
        });

        it('should handle single empty page', () => {
            const pages = [''];
            const result = buildBook(pages);

            expect(result.book).toBe('');
            expect(result.starts).toEqual([0]);
            expect(result.lens).toEqual([0]);
        });

        it('should handle pages with different lengths', () => {
            const pages = ['a', 'bb', 'ccc'];
            const result = buildBook(pages);

            expect(result.book).toBe('a bb ccc');
            expect(result.starts).toEqual([0, 2, 5]);
            expect(result.lens).toEqual([1, 2, 3]);
        });
    });

    describe('posToPage', () => {
        it('should find correct page for position at start', () => {
            const pageStarts = [0, 10, 20, 30];
            expect(posToPage(0, pageStarts)).toBe(0);
            expect(posToPage(10, pageStarts)).toBe(1);
            expect(posToPage(20, pageStarts)).toBe(2);
        });

        it('should find correct page for position in middle', () => {
            const pageStarts = [0, 10, 20, 30];
            expect(posToPage(5, pageStarts)).toBe(0);
            expect(posToPage(15, pageStarts)).toBe(1);
            expect(posToPage(25, pageStarts)).toBe(2);
        });

        it('should handle position at exact boundaries', () => {
            const pageStarts = [0, 5, 10];
            expect(posToPage(5, pageStarts)).toBe(1);
            expect(posToPage(10, pageStarts)).toBe(2);
        });

        it('should handle position beyond last page start', () => {
            const pageStarts = [0, 10, 20];
            expect(posToPage(100, pageStarts)).toBe(2);
        });

        it('should handle single page', () => {
            const pageStarts = [0];
            expect(posToPage(0, pageStarts)).toBe(0);
            expect(posToPage(100, pageStarts)).toBe(0);
        });

        it('should handle large position values', () => {
            const pageStarts = [0, 1000, 2000, 3000];
            expect(posToPage(2500, pageStarts)).toBe(2);
        });
    });

    describe('deduplicateExcerpts', () => {
        it('should handle unique excerpts', () => {
            const excerpts = ['hello', 'world', 'test'];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual(['hello', 'world', 'test']);
            expect(result.patIdToOrigIdxs).toEqual([[0], [1], [2]]);
            expect(result.keyToPatId.size).toBe(3);
        });

        it('should deduplicate identical excerpts', () => {
            const excerpts = ['hello', 'world', 'hello', 'test', 'world'];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual(['hello', 'world', 'test']);
            expect(result.patIdToOrigIdxs).toEqual([[0, 2], [1, 4], [3]]);
            expect(result.keyToPatId.get('hello')).toBe(0);
            expect(result.keyToPatId.get('world')).toBe(1);
        });

        it('should handle empty excerpts list', () => {
            const excerpts: string[] = [];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual([]);
            expect(result.patIdToOrigIdxs).toEqual([]);
            expect(result.keyToPatId.size).toBe(0);
        });

        it('should handle all identical excerpts', () => {
            const excerpts = ['same', 'same', 'same'];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual(['same']);
            expect(result.patIdToOrigIdxs).toEqual([[0, 1, 2]]);
            expect(result.keyToPatId.size).toBe(1);
        });

        it('should handle empty string excerpts', () => {
            const excerpts = ['', 'test', '', 'other'];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual(['', 'test', 'other']);
            expect(result.patIdToOrigIdxs).toEqual([[0, 2], [1], [3]]);
        });

        it('should maintain correct mapping for complex case', () => {
            const excerpts = ['a', 'b', 'a', 'c', 'b', 'a'];
            const result = deduplicateExcerpts(excerpts);

            expect(result.patterns).toEqual(['a', 'b', 'c']);
            expect(result.patIdToOrigIdxs).toEqual([[0, 2, 5], [1, 4], [3]]);
        });
    });
});
