import { describe, expect, it } from 'bun:test';

import {
    extractDigits,
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    removeFootnoteReferencesSimple,
    removeSingleDigitFootnoteReferences,
    standardizeHijriSymbol,
    standardizeIntahaSymbol,
    tokenizeText,
} from './textUtils';

describe('textUtils', () => {
    describe('removeFootnoteReferencesSimple', () => {
        it('should remove simple footnote with single Arabic numeral', () => {
            const input = 'هذا النص (¬٣) يحتوي على حاشية';
            const expected = 'هذا النص يحتوي على حاشية';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should remove footnote with multiple Arabic numerals', () => {
            const input = 'النص الأول (¬١٢٣) والثاني (¬٤٥٦)';
            const expected = 'النص الأول والثاني';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should handle footnotes with no spaces around them', () => {
            const input = 'كلمة(¬٧)أخرى';
            const expected = 'كلمة أخرى';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should handle footnotes with multiple spaces around them', () => {
            const input = 'النص   (¬٩)   هنا';
            const expected = 'النص هنا';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should normalize multiple spaces in text without footnotes', () => {
            const input = 'هذا    نص    عادي';
            const expected = 'هذا نص عادي';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(removeFootnoteReferencesSimple('')).toBe('');
        });

        it('should handle text with no footnotes', () => {
            const input = 'نص عادي بدون حواشي';
            expect(removeFootnoteReferencesSimple(input)).toBe(input);
        });

        it('should handle multiple footnotes in sequence', () => {
            const input = 'النص (¬١) (¬٢) (¬٣) هنا';
            const expected = 'النص هنا';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should handle footnotes at the beginning of text', () => {
            const input = '(¬٥) هذا نص يبدأ بحاشية';
            const expected = 'هذا نص يبدأ بحاشية';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should handle footnotes at the end of text', () => {
            const input = 'هذا نص ينتهي بحاشية (¬٨)';
            const expected = 'هذا نص ينتهي بحاشية';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });

        it('should not remove parentheses without not symbol', () => {
            const input = 'هذا (نص عادي) في أقواس';
            expect(removeFootnoteReferencesSimple(input)).toBe(input);
        });

        it('should handle mixed content with Arabic and English', () => {
            const input = 'Arabic text (¬٤) and English text';
            const expected = 'Arabic text and English text';
            expect(removeFootnoteReferencesSimple(input)).toBe(expected);
        });
    });

    describe('removeSingleDigitFootnoteReferences', () => {
        it('should remove single digit footnote', () => {
            const input = 'هذا النص (٣) يحتوي على حاشية';
            const expected = 'هذا النص يحتوي على حاشية';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should remove footnote with م suffix', () => {
            const input = 'هذا النص (٣ م) يحتوي على حاشية';
            const expected = 'هذا النص يحتوي على حاشية';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should remove both types of footnotes in same text', () => {
            const input = 'النص الأول (٣) والثاني (٥ م) هنا';
            const expected = 'النص الأول والثاني هنا';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle all Arabic digits 0-9', () => {
            const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            digits.forEach((digit) => {
                const input = `نص (${digit}) هنا`;
                const expected = 'نص هنا';
                expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
            });
        });

        it('should handle all Arabic digits with م suffix', () => {
            const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            digits.forEach((digit) => {
                const input = `نص (${digit} م) هنا`;
                const expected = 'نص هنا';
                expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
            });
        });

        it('should handle footnotes with no spaces around them', () => {
            const input = 'كلمة(٧)أخرى(٨ م)نهاية';
            const expected = 'كلمة أخرى نهاية';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle footnotes with multiple spaces around them', () => {
            const input = 'النص   (٩)   والآخر   (٢ م)   هنا';
            const expected = 'النص والآخر هنا';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should not remove multi-digit numbers', () => {
            const input = 'هذا النص (١٢) لا يجب حذفه';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(input);
        });

        it('should normalize multiple spaces', () => {
            const input = 'هذا    نص    عادي';
            const expected = 'هذا نص عادي';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(removeSingleDigitFootnoteReferences('')).toBe('');
        });

        it('should handle text with no footnotes', () => {
            const input = 'نص عادي بدون حواشي';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(input);
        });

        it('should handle multiple footnotes in sequence', () => {
            const input = 'النص (١) (٢ م) (٣) هنا';
            const expected = 'النص هنا';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle footnotes at the beginning of text', () => {
            const input = '(٥) (٦ م) هذا نص يبدأ بحاشية';
            const expected = 'هذا نص يبدأ بحاشية';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle footnotes at the end of text', () => {
            const input = 'هذا نص ينتهي بحاشية (٨) (٩ م)';
            const expected = 'هذا نص ينتهي بحاشية';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should not remove regular parentheses', () => {
            const input = 'هذا (نص عادي) في أقواس';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(input);
        });

        it('should handle mixed content with Arabic and English', () => {
            const input = 'Arabic text (٤) and (٧ م) and (٢ ه) English text';
            const expected = 'Arabic text and and English text';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle different spacing patterns with Arabic letter suffix', () => {
            const testCases = [
                { input: '(٣ م)', expected: '' },
                { input: '(٣  ه)', expected: '' },
                { input: '(٣   ب)', expected: '' },
                { input: 'نص (٣ م) هنا', expected: 'نص هنا' },
            ];

            testCases.forEach(({ input, expected }) => {
                expect(removeSingleDigitFootnoteReferences(input).trim()).toBe(expected);
            });
        });

        it('should preserve text integrity with complex Arabic text', () => {
            const input = 'قال الإمام أحمد (٣) رحمه الله (٥ م) في هذا الموضوع (٧ ب) المهم';
            const expected = 'قال الإمام أحمد رحمه الله في هذا الموضوع المهم';
            expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
        });

        it('should handle various Arabic letters as suffixes', () => {
            const testCases = [
                '(٣ أ)',
                '(٤ إ)',
                '(٥ آ)',
                '(٦ ؤ)',
                '(٧ ئ)',
                '(٨ ء)',
                '(٩ ة)',
                '(٠ ى)',
                '(١ ي)',
                '(٢ و)',
            ];

            testCases.forEach((footnote) => {
                const input = `نص ${footnote} هنا`;
                const expected = 'نص هنا';
                expect(removeSingleDigitFootnoteReferences(input)).toBe(expected);
            });
        });
    });

    describe('extractDigits', () => {
        it('should extract Arabic digits', () => {
            const input = '(٥)أخرجه البخاري';
            expect(extractDigits(input)).toBe('٥');
        });

        it('should extract Western digits', () => {
            const input = 'See note (123) for details';
            expect(extractDigits(input)).toBe('123');
        });

        it('should return first digit sequence', () => {
            const input = '(١) some text (٢)';
            expect(extractDigits(input)).toBe('١');
        });

        it('should return empty string if no digits found', () => {
            const input = 'no digits here';
            expect(extractDigits(input)).toBe('');
        });

        it('should handle empty string', () => {
            expect(extractDigits('')).toBe('');
        });

        it('should extract multi-digit sequences', () => {
            const input = '(١٢٣)';
            expect(extractDigits(input)).toBe('١٢٣');
        });
    });

    describe('tokenizeText', () => {
        it('should tokenize simple text', () => {
            const input = 'hello world test';
            const expected = ['hello', 'world', 'test'];
            expect(tokenizeText(input)).toEqual(expected);
        });

        it('should preserve special symbols', () => {
            const input = 'محمد ﷺ رسول الله';
            const expected = ['محمد', 'ﷺ', 'رسول', 'الله'];
            expect(tokenizeText(input, ['ﷺ'])).toEqual(expected);
        });

        it('should handle empty string', () => {
            expect(tokenizeText('')).toEqual([]);
        });

        it('should handle whitespace-only string', () => {
            expect(tokenizeText('   ')).toEqual([]);
        });

        it('should handle multiple preserve symbols', () => {
            const input = 'بسم ﷽ الله ﷻ الرحمن';
            const expected = ['بسم', '﷽', 'الله', 'ﷻ', 'الرحمن'];
            expect(tokenizeText(input, ['﷽', 'ﷻ'])).toEqual(expected);
        });

        it('should handle preserve symbols at boundaries', () => {
            const input = 'ﷺ start and end ﷺ';
            const expected = ['ﷺ', 'start', 'and', 'end', 'ﷺ'];
            expect(tokenizeText(input, ['ﷺ'])).toEqual(expected);
        });
    });

    describe('handleFootnoteFusion', () => {
        it('should fuse standalone with embedded footnote', () => {
            const result = ['(٥)'];
            const success = handleFootnoteFusion(result, '(٥)', '(٥)أخرجه');
            expect(success).toBe(true);
            expect(result).toEqual(['(٥)أخرجه']);
        });

        it('should skip trailing standalone footnote', () => {
            const result = ['(٥)أخرجه'];
            const success = handleFootnoteFusion(result, '(٥)أخرجه', '(٥)');
            expect(success).toBe(true);
            expect(result).toEqual(['(٥)أخرجه']);
        });

        it('should not fuse when digits differ', () => {
            const result = ['(٥)'];
            const success = handleFootnoteFusion(result, '(٥)', '(٦)أخرجه');
            expect(success).toBe(false);
            expect(result).toEqual(['(٥)']);
        });

        it('should handle Western digits', () => {
            const result = ['(5)'];
            const success = handleFootnoteFusion(result, '(5)', '(5)reference');
            expect(success).toBe(true);
            expect(result).toEqual(['(5)reference']);
        });

        it('should not process non-footnote tokens', () => {
            const result = ['hello'];
            const success = handleFootnoteFusion(result, 'hello', 'world');
            expect(success).toBe(false);
            expect(result).toEqual(['hello']);
        });
    });

    describe('handleFootnoteSelection', () => {
        it('should prefer embedded footnote over plain text', () => {
            const result = handleFootnoteSelection('text', '(١)text');
            expect(result).toEqual(['(١)text']);
        });

        it('should prefer embedded footnote when first argument contains it', () => {
            const result = handleFootnoteSelection('(١)text', 'text');
            expect(result).toEqual(['(١)text']);
        });

        it('should prefer shorter embedded footnote', () => {
            const result = handleFootnoteSelection('(١)longtext', '(١)text');
            expect(result).toEqual(['(١)text']);
        });

        it('should return null for non-footnote tokens', () => {
            const result = handleFootnoteSelection('hello', 'world');
            expect(result).toBeNull();
        });

        it('should handle both tokens having embedded footnotes', () => {
            const result = handleFootnoteSelection('(١)very long text here', '(٢)short');
            expect(result).toEqual(['(٢)short']);
        });
    });

    describe('handleStandaloneFootnotes', () => {
        it('should return both when first is footnote', () => {
            const result = handleStandaloneFootnotes('(١)', 'text');
            expect(result).toEqual(['(١)', 'text']);
        });

        it('should return both when second is footnote', () => {
            const result = handleStandaloneFootnotes('text', '(١)');
            expect(result).toEqual(['(١)', 'text']);
        });

        it('should prefer shorter when both are footnotes', () => {
            const result = handleStandaloneFootnotes('(١)', '(٢).');
            expect(result).toEqual(['(١)']);
        });

        it('should return null for non-footnote tokens', () => {
            const result = handleStandaloneFootnotes('hello', 'world');
            expect(result).toBeNull();
        });

        it('should handle Arabic footnote patterns', () => {
            const result = handleStandaloneFootnotes('(٥)،', 'النص');
            expect(result).toEqual(['(٥)،', 'النص']);
        });
    });

    describe('standardizeHijriSymbol', () => {
        it('should replace standalone ه with هـ after Arabic digits', () => {
            expect(standardizeHijriSymbol('١٢٣ه')).toBe('١٢٣ هـ');
            expect(standardizeHijriSymbol('123ه')).toBe('123 هـ');
        });

        it('should replace ه with هـ when there is one space between digit and ه', () => {
            expect(standardizeHijriSymbol('١٢٣ ه')).toBe('١٢٣ هـ');
            expect(standardizeHijriSymbol('456 ه')).toBe('456 هـ');
        });

        it('should replace ه at end of string', () => {
            expect(standardizeHijriSymbol('١٢٣ه')).toBe('١٢٣ هـ');
        });

        it('should replace ه before whitespace', () => {
            expect(standardizeHijriSymbol('١٢٣ه والبقية')).toBe('١٢٣ هـ والبقية');
        });

        it('should replace ه before non-Arabic characters', () => {
            expect(standardizeHijriSymbol('١٢٣ه.')).toBe('١٢٣ هـ.');
            expect(standardizeHijriSymbol('123ه!')).toBe('123 هـ!');
        });

        it('should not replace ه when part of Arabic word', () => {
            expect(standardizeHijriSymbol('هذا')).toBe('هذا');
            expect(standardizeHijriSymbol('١٢٣هجري')).toBe('١٢٣هجري');
        });

        it('should handle multiple occurrences', () => {
            expect(standardizeHijriSymbol('١٢٣ه و٤٥٦ه')).toBe('١٢٣ هـ و٤٥٦ هـ');
        });

        it('should handle mixed English and Arabic digits', () => {
            expect(standardizeHijriSymbol('123ه و٤٥٦ ه')).toBe('123 هـ و٤٥٦ هـ');
        });
    });

    describe('standardizeIntahaSymbol', () => {
        it('should replace standalone اه with اهـ', () => {
            expect(standardizeIntahaSymbol('اه')).toBe('اهـ');
            expect(standardizeIntahaSymbol('في اه')).toBe('في اهـ');
        });

        it('should replace اه at beginning of string', () => {
            expect(standardizeIntahaSymbol('اه والبقية')).toBe('اهـ والبقية');
        });

        it('should replace اه at end of string', () => {
            expect(standardizeIntahaSymbol('في السنة اه')).toBe('في السنة اهـ');
        });

        it('should replace اه surrounded by whitespace', () => {
            expect(standardizeIntahaSymbol('قبل اه بعد')).toBe('قبل اهـ بعد');
        });

        it('should replace اه before non-Arabic characters', () => {
            expect(standardizeIntahaSymbol('اه.')).toBe('اهـ.');
            expect(standardizeIntahaSymbol('العام اه!')).toBe('العام اهـ!');
        });

        it('should replace اه after non-Arabic characters', () => {
            expect(standardizeIntahaSymbol('.اه')).toBe('.اهـ');
            expect(standardizeIntahaSymbol('(اه)')).toBe('(اهـ)');
        });

        it('should not replace اه when part of Arabic word', () => {
            expect(standardizeIntahaSymbol('اهتمام')).toBe('اهتمام');
            expect(standardizeIntahaSymbol('الاهتمام')).toBe('الاهتمام');
        });

        it('should handle multiple occurrences', () => {
            expect(standardizeIntahaSymbol('اه اه')).toBe('اهـ اهـ');
        });
    });
});
