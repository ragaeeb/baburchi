import { describe, expect, it } from 'bun:test';
import { createArabicSanitizer, sanitizeArabic } from './sanitize';

// Arabic letters (excluding diacritics)
const ARABIC_LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
// Arabic diacritics (tashkeel)
const ARABIC_DIACRITICS = '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0670'; // fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, superscript alif

/**
 * Generates a random Arabic paragraph with diacritics.
 * Creates realistic text with words separated by spaces.
 */
const generateArabicParagraph = (minChars: number, maxChars: number): string => {
    const length = Math.floor(Math.random() * (maxChars - minChars + 1)) + minChars;
    const chars: string[] = [];
    let charCount = 0;

    while (charCount < length) {
        // Generate a word (3-10 letters)
        const wordLength = Math.floor(Math.random() * 8) + 3;

        for (let j = 0; j < wordLength && charCount < length; j++) {
            // Add a random Arabic letter
            const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
            chars.push(letter);
            charCount++;

            // 60% chance to add a diacritic after the letter
            if (Math.random() < 0.6 && charCount < length) {
                const diacritic = ARABIC_DIACRITICS[Math.floor(Math.random() * ARABIC_DIACRITICS.length)];
                chars.push(diacritic);
                charCount++;
            }
        }

        // Add space between words (unless we're at the end)
        if (charCount < length - 1) {
            chars.push(' ');
            charCount++;
        }
    }

    return chars.join('');
};

/**
 * Generates an array of Arabic paragraphs for benchmarking.
 */
const generateArabicTexts = (count: number, minChars = 100, maxChars = 200): string[] => {
    const texts: string[] = new Array(count);
    for (let i = 0; i < count; i++) {
        texts[i] = generateArabicParagraph(minChars, maxChars);
    }
    return texts;
};

const TEXT_COUNT = 50000;
const MIN_CHARS = 100;
const MAX_CHARS = 200;

// Generate test data once at module level
console.log(`\n📊 Generating ${TEXT_COUNT} Arabic texts (${MIN_CHARS}-${MAX_CHARS} chars each)...`);
const startGen = performance.now();
const testTexts = generateArabicTexts(TEXT_COUNT, MIN_CHARS, MAX_CHARS);
const genTime = performance.now() - startGen;
console.log(`   Generated in ${genTime.toFixed(2)}ms`);
console.log(`   Sample text (first 80 chars): ${testTexts[0].substring(0, 80)}...`);

describe('sanitizeArabic Performance Benchmark', () => {
    // Store baseline times for comparison
    let baselineSearchTime = 0;
    let baselineAggressiveTime = 0;
    let baselineCustomTime = 0;

    describe('BASELINE (loop-based)', () => {
        it('"search" preset', () => {
            console.log('\n🔄 BASELINE: Loop-based sanitizeArabic with "search" preset');

            const start = performance.now();
            const results: string[] = new Array(testTexts.length);
            for (let i = 0; i < testTexts.length; i++) {
                results[i] = sanitizeArabic(testTexts[i], 'search');
            }
            baselineSearchTime = performance.now() - start;

            console.log(`   ⏱️  Time: ${baselineSearchTime.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / baselineSearchTime) * 1000).toFixed(0)} texts/sec`);

            expect(results.length).toBe(TEXT_COUNT);
            expect(results[0]).not.toContain('\u064E'); // fatha should be removed
        });

        it('"aggressive" preset', () => {
            console.log('\n🔄 BASELINE: Loop-based sanitizeArabic with "aggressive" preset');

            const start = performance.now();
            const results: string[] = new Array(testTexts.length);
            for (let i = 0; i < testTexts.length; i++) {
                results[i] = sanitizeArabic(testTexts[i], 'aggressive');
            }
            baselineAggressiveTime = performance.now() - start;

            console.log(`   ⏱️  Time: ${baselineAggressiveTime.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / baselineAggressiveTime) * 1000).toFixed(0)} texts/sec`);

            expect(results.length).toBe(TEXT_COUNT);
        });

        it('custom options', () => {
            console.log('\n🔄 BASELINE: Loop-based sanitizeArabic with custom options');

            const options = {
                collapseWhitespace: true,
                normalizeAlif: true,
                replaceAlifMaqsurah: true,
                stripDiacritics: true,
                trim: true,
            };

            const start = performance.now();
            const results: string[] = new Array(testTexts.length);
            for (let i = 0; i < testTexts.length; i++) {
                results[i] = sanitizeArabic(testTexts[i], options);
            }
            baselineCustomTime = performance.now() - start;

            console.log(`   ⏱️  Time: ${baselineCustomTime.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / baselineCustomTime) * 1000).toFixed(0)} texts/sec`);

            expect(results.length).toBe(TEXT_COUNT);
        });
    });

    describe('OPTIMIZED (batch array)', () => {
        it('"search" preset - batch array', () => {
            console.log('\n✨ OPTIMIZED: sanitizeArabic(array, "search")');

            const start = performance.now();
            const results = sanitizeArabic(testTexts, 'search');
            const elapsed = performance.now() - start;

            console.log(`   ⏱️  Time: ${elapsed.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / elapsed) * 1000).toFixed(0)} texts/sec`);

            const improvement = ((baselineSearchTime - elapsed) / baselineSearchTime) * 100;
            console.log(`   🚀 Improvement: ${improvement.toFixed(1)}% faster`);

            expect(results.length).toBe(TEXT_COUNT);
            expect(results[0]).not.toContain('\u064E');
        });

        it('"aggressive" preset - batch array', () => {
            console.log('\n✨ OPTIMIZED: sanitizeArabic(array, "aggressive")');

            const start = performance.now();
            const results = sanitizeArabic(testTexts, 'aggressive');
            const elapsed = performance.now() - start;

            console.log(`   ⏱️  Time: ${elapsed.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / elapsed) * 1000).toFixed(0)} texts/sec`);

            const improvement = ((baselineAggressiveTime - elapsed) / baselineAggressiveTime) * 100;
            console.log(`   🚀 Improvement vs baseline: ${improvement.toFixed(1)}% faster`);

            expect(results.length).toBe(TEXT_COUNT);
        });

        it('custom options - batch array', () => {
            console.log('\n✨ OPTIMIZED: sanitizeArabic(array, custom options)');

            const options = {
                collapseWhitespace: true,
                normalizeAlif: true,
                replaceAlifMaqsurah: true,
                stripDiacritics: true,
                trim: true,
            };

            const start = performance.now();
            const results = sanitizeArabic(testTexts, options);
            const elapsed = performance.now() - start;

            console.log(`   ⏱️  Time: ${elapsed.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / elapsed) * 1000).toFixed(0)} texts/sec`);

            const improvement = ((baselineCustomTime - elapsed) / baselineCustomTime) * 100;
            console.log(`   🚀 Improvement vs baseline: ${improvement.toFixed(1)}% faster`);

            expect(results.length).toBe(TEXT_COUNT);
        });
    });

    describe('OPTIMIZED (createArabicSanitizer factory)', () => {
        it('"search" preset - factory', () => {
            console.log('\n🏭 OPTIMIZED: createArabicSanitizer("search") + map');

            const sanitize = createArabicSanitizer('search');

            const start = performance.now();
            const results: string[] = new Array(testTexts.length);
            for (let i = 0; i < testTexts.length; i++) {
                results[i] = sanitize(testTexts[i]);
            }
            const elapsed = performance.now() - start;

            console.log(`   ⏱️  Time: ${elapsed.toFixed(2)}ms`);
            console.log(`   📈 Throughput: ${((TEXT_COUNT / elapsed) * 1000).toFixed(0)} texts/sec`);

            const improvement = ((baselineSearchTime - elapsed) / baselineSearchTime) * 100;
            console.log(`   🚀 Improvement: ${improvement.toFixed(1)}% faster`);

            expect(results.length).toBe(TEXT_COUNT);
            expect(results[0]).not.toContain('\u064E');
        });
    });
});
