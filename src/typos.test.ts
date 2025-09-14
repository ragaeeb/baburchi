import { describe, expect, it } from 'bun:test';

import { processTextAlignment } from './typos';

describe('typos', () => {
    describe('processTextAlignment', () => {
        const defaultOptions = {
            highSimilarityThreshold: 0.9,
            similarityThreshold: 0.7,
            typoSymbols: ['ﷺ'],
        };

        it('should fix typos when typo symbols are present', () => {
            const result = processTextAlignment(
                'محمد صلى الله عليه وسلم رسول الله',
                'محمد ﷺ رسول الله',
                defaultOptions,
            );

            expect(result).toEqual('محمد صلى الله عليه ﷺ رسول الله');
        });

        it('should be a no-op', () => {
            const result = processTextAlignment('normal text', 'normal text', defaultOptions);
            expect(result).toEqual('normal text');
        });

        it('should work with different typo symbols', () => {
            const options = {
                highSimilarityThreshold: 0.9,
                similarityThreshold: 0.7,
                typoSymbols: ['﷽', 'ﷻ'],
            };

            const result = processTextAlignment('بسم الله الرحمن الرحيم الله جل جلاله', 'بسم ﷽ الله ﷻ', options);

            expect(result).toEqual('بسم الله الرحمن ﷽ الله جل ﷻ');
        });

        it('should handle similarity threshold edge cases', () => {
            const options = {
                highSimilarityThreshold: 0.9,
                similarityThreshold: 0.1, // Very low threshold
                typoSymbols: ['ﷺ'],
            };

            const result = processTextAlignment('totally other words', 'completely different ﷺ text', options);

            expect(result).toEqual('totally other ﷺ text');
        });

        it('should preserve diacritics when appropriate', () => {
            const result = processTextAlignment('النص صلى الله عليه وسلم العربي', 'النَّص ﷺ العَرَبي', defaultOptions);
            expect(result).toEqual('النص صلى الله عليه ﷺ العربي');
        });
    });
});
