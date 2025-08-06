import { describe, expect, it } from 'bun:test';

import {
    analyzeCharacterStats,
    hasExcessiveRepetition,
    isArabicTextNoise,
    isBasicNoisePattern,
    isNonArabicNoise,
    isSpacingNoise,
    isValidArabicContent,
} from './noise';

describe('noise', () => {
    describe('isArabicTextNoise', () => {
        describe('basic validation', () => {
            it('should return true for empty string', () => {
                expect(isArabicTextNoise('')).toBeTrue();
            });

            it('should return true for whitespace only', () => {
                expect(isArabicTextNoise('   ')).toBeTrue();
                expect(isArabicTextNoise('\t\n')).toBeTrue();
            });

            it('should return true for single character strings', () => {
                expect(isArabicTextNoise('a')).toBeTrue();
                expect(isArabicTextNoise('1')).toBeTrue();
                expect(isArabicTextNoise('!')).toBeTrue();
            });
        });

        describe('basic noise patterns', () => {
            it('should detect dash/underscore/equals patterns', () => {
                expect(isArabicTextNoise('---')).toBeTrue();
                expect(isArabicTextNoise('___')).toBeTrue();
                expect(isArabicTextNoise('===')).toBeTrue();
                expect(isArabicTextNoise('━━━')).toBeTrue();
                expect(isArabicTextNoise('≺≻')).toBeTrue();
                expect(isArabicTextNoise('- - -')).toBeTrue();
            });

            it('should detect dot patterns', () => {
                expect(isArabicTextNoise('...')).toBeTrue();
                expect(isArabicTextNoise('. . .')).toBeTrue();
            });

            it('should detect exclamation patterns', () => {
                expect(isArabicTextNoise('!!!')).toBeTrue();
                expect(isArabicTextNoise('! ! !')).toBeTrue();
            });

            it('should detect uppercase letter patterns', () => {
                expect(isArabicTextNoise('ABC')).toBeTrue();
                expect(isArabicTextNoise('A B C')).toBeTrue();
                expect(isArabicTextNoise('Ap Ap Ap')).toBeTrue();
            });

            it('should detect dash-digit patterns', () => {
                expect(isArabicTextNoise('- 77')).toBeTrue();
                expect(isArabicTextNoise('- 4')).toBeTrue();
                expect(isArabicTextNoise('-123')).toBeTrue();
            });

            it('should detect digit-only patterns', () => {
                expect(isArabicTextNoise('1')).toBeTrue();
                expect(isArabicTextNoise(' 1 ')).toBeTrue();
                expect(isArabicTextNoise('12')).toBeTrue();
            });

            it('should detect single uppercase with spaces', () => {
                expect(isArabicTextNoise('A ')).toBeTrue();
                expect(isArabicTextNoise(' B')).toBeTrue();
            });

            it('should detect em-dash patterns', () => {
                expect(isArabicTextNoise('—')).toBeTrue();
                expect(isArabicTextNoise('— — —')).toBeTrue();
            });

            it('should detect Devanagari characters', () => {
                expect(isArabicTextNoise('्र')).toBeTrue();
                expect(isArabicTextNoise('्र-')).toBeTrue();
            });
        });

        describe('excessive repetition', () => {
            it('should detect excessive repetition of special characters', () => {
                expect(isArabicTextNoise('!!!!!!')).toBeTrue();
                expect(isArabicTextNoise('......')).toBeTrue();
                expect(isArabicTextNoise('------')).toBeTrue();
                expect(isArabicTextNoise('======')).toBeTrue();
                expect(isArabicTextNoise('______')).toBeTrue();
            });

            it('should handle mixed repetition', () => {
                expect(isArabicTextNoise('!!!...---')).toBeTrue();
            });
        });

        describe('Arabic text handling', () => {
            it('should accept valid Arabic text', () => {
                expect(isArabicTextNoise('السلام عليكم')).toBeFalse();
                expect(isArabicTextNoise('محمد')).toBeFalse();
                expect(isArabicTextNoise('الله أكبر')).toBeFalse();
            });

            it('should accept short Arabic with numbers', () => {
                expect(isArabicTextNoise('ص 123')).toBeFalse();
                expect(isArabicTextNoise('آية 5')).toBeFalse();
            });

            it('should reject single letter Arabic context', () => {
                expect(isArabicTextNoise('ص')).toBeTrue();
            });

            it('should accept Arabic-Indic numerals in parentheses', () => {
                expect(isArabicTextNoise('(٦٠١٠).')).toBeFalse();
                expect(isArabicTextNoise('(١٢٣٤)')).toBeFalse();
                expect(isArabicTextNoise('[٥٦٧٨]')).toBeFalse();
            });

            it('should accept very short Arabic without context', () => {
                expect(isArabicTextNoise('صص')).toBeFalse();
                expect(isArabicTextNoise('له.')).toBeFalse();
                expect(isArabicTextNoise('في:')).toBeFalse();
                expect(isArabicTextNoise('من،')).toBeFalse();
            });

            it('should handle Arabic with Latin letters as noise', () => {
                expect(isArabicTextNoise('hello مرحبا')).toBeFalse(); // Has Arabic, so not noise
            });
        });

        describe('non-Arabic content', () => {
            it('should reject Latin text without Arabic', () => {
                expect(isArabicTextNoise('hello world')).toBeTrue();
                expect(isArabicTextNoise('test')).toBeTrue();
            });

            it('should reject short numbers', () => {
                expect(isArabicTextNoise('12')).toBeTrue();
                expect(isArabicTextNoise('5')).toBeTrue();
            });

            it('should handle symbol-heavy content', () => {
                expect(isArabicTextNoise('!@#$%^&*()')).toBeTrue();
                expect(isArabicTextNoise('hello!!!')).toBeTrue(); // High symbol ratio
            });

            it('should handle spacing patterns', () => {
                expect(isArabicTextNoise('a b')).toBeTrue(); // Short with spaces
                expect(isArabicTextNoise('a  b  c')).toBeTrue(); // Excessive spacing
                expect(isArabicTextNoise(' a ')).toBeTrue(); // Single content char with spaces
            });
        });

        describe('edge cases', () => {
            it('should handle punctuation correctly', () => {
                expect(isArabicTextNoise('hello, world!')).toBeTrue(); // Latin text
                expect(isArabicTextNoise('مرحبا، عالم!')).toBeFalse(); // Arabic text
            });

            it('should handle unicode edge cases', () => {
                expect(isArabicTextNoise('\u0600\u0601\u0602')).toBeFalse(); // Arabic unicode
                expect(isArabicTextNoise('\u0020\u0021\u0022')).toBeTrue(); // Non-Arabic unicode
            });
        });
    });

    describe('isBasicNoisePattern', () => {
        it('should detect all basic noise patterns', () => {
            expect(isBasicNoisePattern('---')).toBeTrue();
            expect(isBasicNoisePattern('...')).toBeTrue();
            expect(isBasicNoisePattern('!!!')).toBeTrue();
            expect(isBasicNoisePattern('ABC')).toBeTrue();
            expect(isBasicNoisePattern('- 77')).toBeTrue();
            expect(isBasicNoisePattern('123')).toBeTrue();
            expect(isBasicNoisePattern('A ')).toBeTrue();
            expect(isBasicNoisePattern('—')).toBeTrue();
            expect(isBasicNoisePattern('्र')).toBeTrue();
        });

        it('should not match valid patterns', () => {
            expect(isBasicNoisePattern('hello world')).toBeFalse();
            expect(isBasicNoisePattern('مرحبا')).toBeFalse();
            expect(isBasicNoisePattern('123abc')).toBeFalse();
        });
    });

    describe('analyzeCharacterStats', () => {
        it('should correctly count Arabic characters', () => {
            const stats = analyzeCharacterStats('مرحبا');
            expect(stats.arabicCount).toBe(5);
            expect(stats.latinCount).toBe(0);
        });

        it('should correctly count Latin characters', () => {
            const stats = analyzeCharacterStats('hello');
            expect(stats.latinCount).toBe(5);
            expect(stats.arabicCount).toBe(0);
        });

        it('should correctly count digits', () => {
            const stats = analyzeCharacterStats('123');
            expect(stats.digitCount).toBe(3);
        });

        it('should correctly count spaces', () => {
            const stats = analyzeCharacterStats('a b c');
            expect(stats.spaceCount).toBe(2);
        });

        it('should correctly count symbols', () => {
            const stats = analyzeCharacterStats('hello@world#test');
            expect(stats.symbolCount).toBe(2);
        });

        it('should track character frequency', () => {
            const stats = analyzeCharacterStats('aaa');
            expect(stats.charFreq.get('a')).toBe(3);
        });
    });

    describe('hasExcessiveRepetition', () => {
        it('should detect excessive repetition', () => {
            const stats = analyzeCharacterStats('!!!!!');
            expect(hasExcessiveRepetition(stats, 5)).toBeTrue();
        });

        it('should not detect normal repetition', () => {
            const stats = analyzeCharacterStats('hello');
            expect(hasExcessiveRepetition(stats, 5)).toBeFalse();
        });

        it('should only count specific repetitive characters', () => {
            const stats = analyzeCharacterStats('aaaaa'); // 'a' is not in repetitive chars
            expect(hasExcessiveRepetition(stats, 5)).toBeFalse();
        });
    });

    describe('isValidArabicContent', () => {
        it('should validate Arabic content with sufficient length', () => {
            const stats = analyzeCharacterStats('مرحبا');
            expect(isValidArabicContent(stats, 5)).toBeTrue();
        });

        it('should validate short Arabic with digits', () => {
            const stats = analyzeCharacterStats('ص 5');
            expect(isValidArabicContent(stats, 3)).toBeTrue();
        });

        it('should reject insufficient Arabic content', () => {
            const stats = analyzeCharacterStats('ص');
            expect(isValidArabicContent(stats, 1)).toBeTrue();
        });

        it('should reject short Arabic without digits when too long', () => {
            const stats = analyzeCharacterStats('صص hello world this is long');
            expect(isValidArabicContent(stats, 25)).toBeFalse();
        });
    });

    describe('isNonArabicNoise', () => {
        it('should detect content with no meaningful characters', () => {
            const stats = analyzeCharacterStats('!!!');
            expect(isNonArabicNoise(stats, 3, '!!!')).toBeTrue();
        });

        it('should accept substantial numbers', () => {
            const stats = analyzeCharacterStats('2023');
            expect(isNonArabicNoise(stats, 4, '2023')).toBeFalse();
        });

        it('should detect high symbol-to-content ratio', () => {
            const stats = analyzeCharacterStats('a!!!!!!!!');
            expect(isNonArabicNoise(stats, 10, 'a!!!!!!!!')).toBeTrue();
        });

        it('should detect short strings without Arabic', () => {
            const stats = analyzeCharacterStats('abc');
            expect(isNonArabicNoise(stats, 3, 'abc')).toBeTrue();
        });

        it('should accept longer content', () => {
            const stats = analyzeCharacterStats('this is longer content');
            expect(isNonArabicNoise(stats, 22, 'this is longer content')).toBeFalse();
        });

        it('should reject insufficient numbers', () => {
            const stats = analyzeCharacterStats('12');
            expect(isNonArabicNoise(stats, 2, '12')).toBeTrue();
        });
    });

    describe('isSpacingNoise', () => {
        it('should detect single content character with spaces', () => {
            const stats = analyzeCharacterStats(' a ');
            expect(isSpacingNoise(stats, 1, 3)).toBeTrue();
        });

        it('should detect short text with multiple spaces', () => {
            const stats = analyzeCharacterStats('a  b  c');
            expect(isSpacingNoise(stats, 3, 7)).toBeTrue();
        });

        it('should detect excessive spacing ratio', () => {
            const stats = analyzeCharacterStats('a       ');
            expect(isSpacingNoise(stats, 1, 8)).toBeTrue();
        });

        it('should not detect normal spacing', () => {
            const stats = analyzeCharacterStats('hello world');
            expect(isSpacingNoise(stats, 10, 11)).toBeFalse();
        });

        it('should handle Arabic text with spaces correctly', () => {
            const stats = analyzeCharacterStats('مرحبا عالم');
            expect(isSpacingNoise(stats, 10, 11)).toBeFalse();
        });
    });
});
