import { describe, expect, it } from 'bun:test';
import { sanitizeArabic } from './sanitize';

describe('sanitize', () => {
    describe('sanitizeArabic', () => {
        it('should apply the light preset (NFC, ZWJ/ZWNJ, collapse/trim)', () => {
            const input = `  مرحبا\u200C\u200D   بالعالم  `;
            const out = sanitizeArabic(input, 'light');
            expect(out).toBe('مرحبا بالعالم');
        });

        it('should strip diacritics in search preset', () => {
            const input = 'اَلسَّلَامُ عَلَيْكُمْ';
            const out = sanitizeArabic(input, 'search');
            expect(out).toBe('السلام عليكم');
        });

        it('should remove tatweel by default, and preserve in safe mode', () => {
            const wordy = 'أبـــتِـــكَةُ';
            const stripped = sanitizeArabic(wordy, { stripTatweel: true });
            expect(stripped).toBe('أبتِكَةُ'); // diacritics preserved
            const listMarker = '3 ـ البند الأول';
            const safe = sanitizeArabic(listMarker, { stripTatweel: 'safe' });
            expect(safe).toBe('3 ـ البند الأول');
        });

        it('should remove ampersand', () => {
            expect(sanitizeArabic(`أحب & لنفسي`, { stripLatinAndSymbols: true, base: 'none' })).toEqual('أحب   لنفسي');
        });

        it('should normalize Alif variants only when requested (no maqsurah -> ya unless asked)', () => {
            const input = 'أنا إلى الآفاق';
            const out = sanitizeArabic(input, { normalizeAlif: true, stripDiacritics: true });
            expect(out).toBe('انا الى الافاق'); // ى remains ى
        });

        it('should replace alif maqsurah with ya', () => {
            const input = 'على رؤى';
            const out = sanitizeArabic(input, { replaceAlifMaqsurah: true, stripDiacritics: true });
            expect(out).toBe('علي رؤي');
        });

        it('should remove the Alif maqsurah with the ya', () => {
            expect(sanitizeArabic('رؤيى', { replaceAlifMaqsurah: true, base: 'none' })).toEqual('رؤيي');
        });

        it('should replace ta marbuta with ha when requested', () => {
            const input = 'مدرسة جميلة';
            const out = sanitizeArabic(input, { replaceTaMarbutahWithHa: true, stripDiacritics: true });
            expect(out).toBe('مدرسه جميله');
        });

        it('should strip zero-width controls (to spaces)', () => {
            const input = `مرح\u200Bبا بالع\u200Fالم`;
            const out = sanitizeArabic(input, { stripZeroWidth: true, zeroWidthToSpace: true });
            expect(out).toBe('مرح با بالع الم'); // "الع\u200Fالم" -> "الع الم"
        });

        it('should strip Latin/symbols when requested without changing Hamza', () => {
            const input = 'أحب & لنفسي // test 123';
            const out = sanitizeArabic(input, {
                stripLatinAndSymbols: true,
                collapseWhitespace: true,
                trim: true,
            });
            expect(out).toBe('أحب لنفسي');
        });

        it('should keep only Arabic letters (no spaces) when keepOnlyArabicLetters = true', () => {
            const input = 'سلام 123، يا ١٢٣ عالم!';
            const out = sanitizeArabic(input, {
                stripDiacritics: true,
                keepOnlyArabicLetters: true,
            });
            expect(out).toBe('سلامياعالم'); // letters only
        });

        it('should keep only Arabic letters + spaces for FTS', () => {
            const input = 'السلامُ عليكم، 2024/05/01!';
            const out = sanitizeArabic(input, {
                stripDiacritics: true,
                lettersAndSpacesOnly: true,
                collapseWhitespace: true,
                trim: true,
            });
            expect(out).toBe('السلام عليكم');
        });

        it('should remove the ta marbutah with a ha', () => {
            expect(sanitizeArabic('مدرسة', { base: 'none', replaceTaMarbutahWithHa: true })).toEqual('مدرسه');
        });

        it('aggressive preset should be suitable for indexing (no stray ه from "هـ")', () => {
            const input = 'اَلسَّلَامُ عَلَيْكُمْ 1435/3/29 هـ — www.example.com';
            const out = sanitizeArabic(input, 'aggressive');
            expect(out).toBe('السلام عليكم');
        });

        it('should remove the empty space', () => {
            const text = 'يَخْلُوَ ‏. ‏ قَالَ غَرِيبٌ ‏. ‏';
            const expected = 'يَخْلُوَ  .   قَالَ غَرِيبٌ  .  ';
            expect(sanitizeArabic(text, { zeroWidthToSpace: true, base: 'none', stripZeroWidth: true })).toBe(expected);
        });

        it('should remove tashkeel', () => {
            expect(sanitizeArabic('مُحَمَّدٌ', { base: 'none', stripDiacritics: true })).toEqual('محمد');
        });

        it('should simplify the alif with the basic one', () => {
            expect(sanitizeArabic('أإآ', { normalizeAlif: true })).toEqual('ااا');
        });

        describe('tatweel', () => {
            it('should remove tatweel', () => {
                expect(
                    sanitizeArabic('أبـــتِـــكَةُ', {
                        stripTatweel: true,
                        base: 'none',
                    }),
                ).toEqual('أبتِكَةُ');
            });

            it('should not affect dates', () => {
                expect(
                    sanitizeArabic('1435/3/29 هـ', {
                        stripTatweel: true,
                        base: 'none',
                    }),
                ).toEqual('1435/3/29 هـ');
            });

            it('should not affect numbering', () => {
                expect(
                    sanitizeArabic('4ـ ومدح لكتاب', {
                        stripTatweel: true,
                        base: 'none',
                    }),
                ).toEqual('4ـ ومدح لكتاب');
            });

            it('should not indexed list item', () => {
                expect(
                    sanitizeArabic('3 ـ وشريط ', {
                        stripTatweel: true,
                        base: 'none',
                    }),
                ).toEqual('3 ـ وشريط ');
            });
        });
    });
});
