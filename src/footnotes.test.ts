/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'bun:test';

import { correctReferences } from './footnotes';

describe('footnotes', () => {
    describe('correctReferences', () => {
        it('should correct the invalid footnote', () => {
            const lines = [{ text: 'Some (١) Text' }, { isFootnote: true, text: '() Footnote' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Some (١) Text',
                },
                {
                    isFootnote: true,
                    text: '(١) Footnote',
                },
            ]);
        });

        it('should only use references that were not used in the footnotes already and were found in the body', () => {
            const lines = [
                {
                    text: 'Abcd (١) (٢) (٣)',
                },
                {
                    isFootnote: true,
                    text: '() A',
                },
                {
                    isFootnote: true,
                    text: '(٢) B',
                },
                {
                    isFootnote: true,
                    text: '() C',
                },
            ];

            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Abcd (١) (٢) (٣)',
                },
                {
                    isFootnote: true,
                    text: '(١) A',
                },
                {
                    isFootnote: true,
                    text: '(٢) B',
                },
                {
                    isFootnote: true,
                    text: '(٣) C',
                },
            ]);
        });

        it('should correct the roman match in the footnote', () => {
            const lines = [{ text: 'Some () Text' }, { isFootnote: true, text: '(1) Footnote' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Some (١) Text',
                },
                {
                    isFootnote: true,
                    text: '(١) Footnote',
                },
            ]);
        });

        it('should correct the roman match in the body', () => {
            const lines = [
                { text: 'Some (1) Text with (V)' },
                { isFootnote: true, text: '(١) Footnote' },
                { isFootnote: true, text: '(٧) Another' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Some (١) Text with (٧)',
                },
                {
                    isFootnote: true,
                    text: '(١) Footnote',
                },
                {
                    isFootnote: true,
                    text: '(٧) Another',
                },
            ]);
        });

        // Additional tests for 100% coverage

        it('should handle all OCR-confused characters in body text', () => {
            const lines = [
                { text: 'Text with (.) and (O) and (9)' },
                { isFootnote: true, text: '(٠) Zero footnote' },
                { isFootnote: true, text: '(٥) Five footnote' },
                { isFootnote: true, text: '(٩) Nine footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (٠) and (٥) and (٩)',
                },
                {
                    isFootnote: true,
                    text: '(٠) Zero footnote',
                },
                {
                    isFootnote: true,
                    text: '(٥) Five footnote',
                },
                {
                    isFootnote: true,
                    text: '(٩) Nine footnote',
                },
            ]);
        });

        it('should handle all OCR-confused characters in footnote text', () => {
            const lines = [
                { text: 'Text with (٠) and (٥) and (٩)' },
                { isFootnote: true, text: '(.) Zero footnote' },
                { isFootnote: true, text: '(O) Five footnote' },
                { isFootnote: true, text: '(9) Nine footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (٠) and (٥) and (٩)',
                },
                {
                    isFootnote: true,
                    text: '(٠) Zero footnote',
                },
                {
                    isFootnote: true,
                    text: '(٥) Five footnote',
                },
                {
                    isFootnote: true,
                    text: '(٩) Nine footnote',
                },
            ]);
        });

        it('should handle footnotes with no usedReferences', () => {
            const lines = [
                { text: 'Normal text with (١)' },
                { isFootnote: true, text: '() Footnote with no body match' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Normal text with (١)',
                },
                {
                    isFootnote: true,
                    text: '(١) Footnote with no body match',
                },
            ]);
        });

        it('should handle when footnote has () but no body references were created', () => {
            const lines = [{ text: 'Text with no references' }, { isFootnote: true, text: '() Orphaned footnote' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with no references',
                },
                {
                    isFootnote: true,
                    text: '(١) Orphaned footnote',
                },
            ]);
        });

        it('should handle mismatched reference counts (more body than footnote)', () => {
            const lines = [{ text: 'Text with (١) and (٢)' }, { isFootnote: true, text: '(١) Only one footnote' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (١) and (٢)',
                },
                {
                    isFootnote: true,
                    text: '(١) Only one footnote',
                },
            ]);
        });

        it('should handle mismatched reference counts (more footnote than body)', () => {
            const lines = [
                { text: 'Text with (١)' },
                { isFootnote: true, text: '(١) First footnote' },
                { isFootnote: true, text: '(٢) Extra footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (١)',
                },
                {
                    isFootnote: true,
                    text: '(١) First footnote',
                },
                {
                    isFootnote: true,
                    text: '(٢) Extra footnote',
                },
            ]);
        });

        it('should handle text with no references at all', () => {
            const lines = [{ text: 'Normal text' }, { isFootnote: true, text: 'Normal footnote' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Normal text',
                },
                {
                    isFootnote: true,
                    text: 'Normal footnote',
                },
            ]);
        });

        it('should handle already correct Arabic references', () => {
            const lines = [
                { text: 'Text with (١) and (٢)' },
                { isFootnote: true, text: '(١) First footnote' },
                { isFootnote: true, text: '(٢) Second footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (١) and (٢)',
                },
                {
                    isFootnote: true,
                    text: '(١) First footnote',
                },
                {
                    isFootnote: true,
                    text: '(٢) Second footnote',
                },
            ]);
        });

        it('should handle empty lines array', () => {
            const lines: any[] = [];
            const actual = correctReferences(lines);

            expect(actual).toEqual([]);
        });

        it('should handle lines with no text', () => {
            const lines = [{ text: '' }, { isFootnote: true, text: '' }];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: '',
                },
                {
                    isFootnote: true,
                    text: '',
                },
            ]);
        });

        it('should handle OCR-confused characters that are not in the map', () => {
            const lines = [
                { text: 'Text with (X) unknown character' },
                { isFootnote: true, text: '(X) Unknown footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            // Since X is not in our OCR map, it should remain unchanged
            expect(actual).toEqual([
                {
                    text: 'Text with (X) unknown character',
                },
                {
                    isFootnote: true,
                    text: '(X) Unknown footnote',
                },
            ]);
        });

        it('should handle multiple references of the same type', () => {
            const lines = [
                { text: 'Text with (1) and (1) again' },
                { isFootnote: true, text: '(1) Repeated footnote' },
                { isFootnote: true, text: '(1) Another repeated footnote' },
            ];
            const actual = correctReferences(lines as any) as any;

            expect(actual).toEqual([
                {
                    text: 'Text with (١) and (١) again',
                },
                {
                    isFootnote: true,
                    text: '(١) Repeated footnote',
                },
                {
                    isFootnote: true,
                    text: '(١) Another repeated footnote',
                },
            ]);
        });
    });
});
