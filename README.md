# baburchi

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/84c1b69b-fd5f-4e84-9c10-545c723a0fa9.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/84c1b69b-fd5f-4e84-9c10-545c723a0fa9)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
[![Node.js CI](https://github.com/ragaeeb/baburchi/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/baburchi/actions/workflows/build.yml)
![GitHub License](https://img.shields.io/github/license/ragaeeb/baburchi)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/baburchi)
[![codecov](https://codecov.io/gh/ragaeeb/baburchi/graph/badge.svg?token=R3BOH5KVXM)](https://codecov.io/gh/ragaeeb/baburchi)
[![Size](https://deno.bundlejs.com/badge?q=baburchi@latest&badge=detailed)](https://bundlejs.com/?q=baburchi%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![npm](https://img.shields.io/npm/dm/baburchi)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/baburchi)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/baburchi?style=social)

A lightweight TypeScript library for intelligent OCR text post-processing, specializing in Arabic text with advanced typo correction using sequence alignment algorithms and comprehensive noise detection.

## Demo

Explore the interactive demo at <https://baburchi.surge.sh> to browse each exported helper, try Arabic-aware examples, and see formatting results in real time. The demo build ships with a `public/CNAME` file to keep the Surge domain in sync with deployments.

## Features

- 🧠 **Sequence-Aware Typo Repair** &mdash; Needleman–Wunsch alignment with typo symbol preservation and duplicate pruning.
- 📄 **Multi-Page Fuzzy Search** &mdash; Hybrid exact/fuzzy matching with q-gram seeding and cross-page seam handling.
- 📝 **Footnote Normalisation** &mdash; Converts OCR-confused numerals, fills empty references, and keeps body/footnote sets in sync.
- 🧮 **Bracket & Quote Balancing** &mdash; Detects mismatched punctuation with positional metadata for editor highlighting.
- 🧹 **Noise Classification** &mdash; Arabic-aware heuristics for punctuation spam, spacing artefacts, and mixed-script clutter.
- 🧾 **Comprehensive Typings** &mdash; Fully documented API surface with rich JSDoc coverage and generated declaration files.
- ⚙️ **Configurable Pipelines** &mdash; Fine-grained match policies, sanitisation presets, and typo symbol lists.
- 🧪 **High Test Coverage** &mdash; Extensive Bun test suite covering alignment, matching, sanitisation, and utility helpers.
- 🧳 **Lightweight Tooling** &mdash; Ships with the upstream `tsdown` bundler for fast Bun/Node builds and typed outputs.

## Installation

```bash
# Using npm
npm install baburchi

# Using yarn
yarn add baburchi

# Using pnpm
pnpm add baburchi

# Using bun
bun add baburchi
```

## Quick Start

```typescript
import { fixTypo, isArabicTextNoise } from 'baburchi';

// Basic typo correction with Arabic text
const originalText = 'محمد صلى الله عليه وسلم رسول الله';
const correctedText = 'محمد ﷺ رسول الله';
const typoSymbols = ['ﷺ', '﷽', 'ﷻ'];

const result = fixTypo(originalText, correctedText, { typoSymbols });
console.log(result); // 'محمد ﷺ رسول الله عليه وسلم'

// Noise detection for OCR cleanup
const cleanText = isArabicTextNoise('السلام عليكم'); // false
const noiseText = isArabicTextNoise('---'); // true
```

## API Reference

### Core Text Processing

#### `fixTypo(original, correction, options)`

The main function for correcting typos using text alignment.

**Parameters:**

- `original` (string): The original OCR text that may contain typos
- `correction` (string): The reference text for comparison
- `options` (object): Configuration options

**Options:**

- `typoSymbols` (string[], required): Array of special symbols to preserve
- `similarityThreshold` (number, optional): Threshold for token alignment (default: 0.6)
- `highSimilarityThreshold` (number, optional): Threshold for duplicate detection (default: 0.8)

**Returns:** Corrected text string

#### `processTextAlignment(originalText, altText, options)`

Low-level function for advanced text processing with full configuration control.

**Parameters:**

- `originalText` (string): Original text to process
- `altText` (string): Reference text for alignment
- `options` (FixTypoOptions): Complete configuration object

### Fuzzy Text Matching

#### `findMatches(pages, excerpts, policy?)`

Finds the best matching page for each excerpt using exact and fuzzy matching algorithms.

**Parameters:**

- `pages` (string[]): Array of page texts to search within
- `excerpts` (string[]): Array of text excerpts to find
- `policy` (MatchPolicy, optional): Matching configuration

**Returns:** `number[]` - Array of page indices (0-based) where each excerpt was found, or -1 if not found

**Example:**

```typescript
import { findMatches } from 'baburchi';

const pages = [
    'هذا النص في الصفحة الأولى مع محتوى إضافي',
    'النص الثاني يظهر هنا في الصفحة الثانية',
    'الصفحة الثالثة تحتوي على نص مختلف'
];

const excerpts = [
    'النص في الصفحة الأولى',
    'النص الثاني يظهر',
    'نص غير موجود'
];

const matches = findMatches(pages, excerpts);
console.log(matches); // [0, 1, -1]
```

#### `findMatchesAll(pages, excerpts, policy?)`

Finds all potential matches for each excerpt, ranked by match quality.

**Parameters:**

- `pages` (string[]): Array of page texts to search within
- `excerpts` (string[]): Array of text excerpts to find
- `policy` (MatchPolicy, optional): Matching configuration

**Returns:** `number[][]` - Array where each element is an array of page indices ranked by match quality (exact matches first, then fuzzy matches by score)

**Example:**

```typescript
import { findMatchesAll } from 'baburchi';

const pages = [
    'النص الأول مع محتوى مشابه',
    'محتوى مشابه في النص الثاني',
    'النص الأول بصيغة مختلفة قليلاً'
];

const excerpts = ['النص الأول'];

const allMatches = findMatchesAll(pages, excerpts);
console.log(allMatches); // [[0, 2]] - excerpt matches page 0 exactly, page 2 fuzzily
```

#### Match Policy Configuration

The `MatchPolicy` interface allows fine-tuning of the matching algorithm:

```typescript
interface MatchPolicy {
    enableFuzzy?: boolean;           // Enable fuzzy matching (default: true)
    maxEditAbs?: number;             // Max absolute edit distance (default: 3)
    maxEditRel?: number;             // Max relative edit distance (default: 0.1)
    q?: number;                      // Q-gram size for indexing (default: 4)
    gramsPerExcerpt?: number;        // Q-grams to sample per excerpt (default: 5)
    maxCandidatesPerExcerpt?: number; // Max candidates to evaluate (default: 40)
    seamLen?: number;                // Cross-page seam length (default: 512)
}
```

**Example with custom policy:**

```typescript
import { findMatches } from 'baburchi';

const customPolicy: MatchPolicy = {
    enableFuzzy: true,
    maxEditAbs: 6,           // Allow more character differences
    maxEditRel: 0.3,         // Allow 30% character differences
    q: 4,                    // Use 4-grams for better precision
    gramsPerExcerpt: 30,     // Sample more Q-grams
    maxCandidatesPerExcerpt: 150
};

const matches = findMatches(pages, excerpts, customPolicy);
```

### Arabic Text Normalization

#### `sanitizeArabic(input, optionsOrPreset)`

Unified Arabic text sanitizer that provides fast, configurable cleanup for Arabic text.

**Parameters:**

- `input` (string | string[]): The Arabic text to sanitize (or an array for optimized batch processing)
- `optionsOrPreset` (string | object): Either a preset name or custom options

**Presets:**

- `"light"`: Basic cleanup for display (strips zero-width chars, collapses whitespace)
- `"search"`: Tolerant search normalization (removes diacritics, normalizes letters)
- `"aggressive"`: Indexing-friendly (letters and spaces only, removes everything else)

**Batch processing / factory:**

- Pass an array to resolve options once and sanitize many strings efficiently.
- Or pre-resolve options with `createArabicSanitizer(...)` and reuse the returned function.

**Custom Options:**

```typescript
interface SanitizeOptions {
    base?: 'light' | 'search' | 'aggressive' | 'none';
    nfc?: boolean;
    stripDiacritics?: boolean;
    stripFootnotes?: boolean;
    stripTatweel?: boolean | 'safe' | 'all';
    normalizeAlif?: boolean;
    replaceAlifMaqsurah?: boolean;
    replaceTaMarbutahWithHa?: boolean;
    stripZeroWidth?: boolean;
    zeroWidthToSpace?: boolean;
    stripLatinAndSymbols?: boolean;
    lettersAndSpacesOnly?: boolean;
    keepOnlyArabicLetters?: boolean;
    collapseWhitespace?: boolean;
    trim?: boolean;
    removeHijriMarker?: boolean;
}
```

**Note on `nfc`**: NFC normalization does **not** remove diacritics; it canonicalizes equivalent sequences. This library applies an Arabic-focused NFC fast-path for common OCR compositions (e.g., Alif + combining hamza/madda), while `stripDiacritics` controls tashkīl removal.

**Examples:**

```typescript
import { createArabicSanitizer, sanitizeArabic } from 'baburchi';

// Light display cleanup
sanitizeArabic('  مرحبا\u200C\u200D   بالعالم  ', 'light'); // → 'مرحبا بالعالم'

// Tolerant search normalization
sanitizeArabic('اَلسَّلَامُ عَلَيْكُمْ', 'search'); // → 'السلام عليكم'

// Indexing-friendly text (letters + spaces only)
sanitizeArabic('اَلسَّلَامُ 1435/3/29 هـ — www', 'aggressive'); // → 'السلام'

// Custom: Tatweel-only, preserving dates/list markers
sanitizeArabic('أبـــتِـــكَةُ', { base: 'none', stripTatweel: true }); // → 'أبتِكَةُ'

// Batch processing (optimized)
sanitizeArabic(['اَلسَّلَامُ عَلَيْكُمْ', 'أبـــتِـــكَةُ'], 'search'); // → ['السلام عليكم', 'أبتِكَةُ']

// Factory (pre-resolved options)
const sanitizeSearch = createArabicSanitizer('search');
['اَلسَّلَامُ عَلَيْكُمْ', 'أبـــتِـــكَةُ'].map(sanitizeSearch);

// Zero-width controls → spaces
sanitizeArabic('يَخْلُوَ ‏. ‏ قَالَ غَرِيبٌ ‏. ‏', { 
    base: 'none', 
    stripZeroWidth: true, 
    zeroWidthToSpace: true 
});
// → 'يَخْلُوَ  .   قَالَ غَرِيبٌ  .  '
```

## Usage Examples

### Basic Arabic Text Correction

```typescript
import { fixTypo } from 'baburchi';

const original = 'النص الأصلي مع أخطاء إملائية';
const reference = 'النص الأصلي مع أخطاء إملائية';
const typoSymbols = ['ﷺ', '﷽', 'ﷻ'];

const corrected = fixTypo(original, reference, { typoSymbols });
```

### Handling Religious Symbols

```typescript
import { fixTypo } from 'baburchi';

// OCR might split religious phrases
const ocrText = 'محمد صلى الله عليه وسلم خير الأنام';
const referenceText = 'محمد ﷺ خير الأنام';

const result = fixTypo(ocrText, referenceText, {
    typoSymbols: ['ﷺ', '﷽', 'ﷻ'],
    similarityThreshold: 0.7,
});

console.log(result); // 'محمد صلى الله عليه ﷺ خير الأنام'
```

### Custom Similarity Thresholds

```typescript
import { fixTypo } from 'baburchi';

const result = fixTypo(original, reference, {
    typoSymbols: ['ﷺ'],
    similarityThreshold: 0.8, // Stricter alignment
    highSimilarityThreshold: 0.95, // Very strict duplicate detection
});
```

### Advanced Usage with Full Configuration

```typescript
import { processTextAlignment } from 'baburchi';

const options = {
    typoSymbols: ['ﷺ', '﷽', 'ﷻ'],
    similarityThreshold: 0.7,
    highSimilarityThreshold: 0.9,
};

const result = processTextAlignment('Original text with typos', 'Reference text for correction', options);
```

### Footnote Handling

```typescript
import { fixTypo } from 'baburchi';

// Handles embedded and standalone footnotes intelligently
const textWithFootnotes = 'النص (١) مع الحواشي (٢)أخرجه البخاري';
const reference = 'النص (١) مع الحواشي (٢)';

const corrected = fixTypo(textWithFootnotes, reference, {
    typoSymbols: [],
});
// Result preserves footnote formatting
```

## Algorithm Overview

Baburchi uses the **Needleman-Wunsch global sequence alignment algorithm** to optimally align text tokens:

1. **Tokenization**: Text is split into tokens while preserving special symbols
2. **Normalization**: Arabic text is normalized by removing diacritics and tatweel marks
3. **Alignment**: Tokens are aligned using dynamic programming with custom scoring
4. **Selection**: Best tokens are selected based on similarity and special rules
5. **Post-processing**: Duplicates are removed and footnotes are fused

### Scoring System

- **Perfect Match** (+2): Identical tokens after normalization
- **Soft Match** (+1): High similarity or contains typo symbols
- **Mismatch** (-2): Dissimilar tokens
- **Gap Penalty** (-1): Insertion or deletion

## Performance

- **Time Complexity**: O(m×n) for alignment, where m and n are token sequence lengths
- **Space Complexity**: O(min(m,n)) using space-optimized dynamic programming
- **Memory Efficient**: Processes text in chunks without storing large matrices

## Browser Support

Baburchi works in all modern environments:

- ✅ Node.js 22+
- ✅ Bun 1.2.21+
- ✅ Modern browsers (ES2023+)
- ✅ Deno (with npm compatibility)

## TypeScript Support

Baburchi is written in TypeScript and provides full type definitions:

```typescript
import type { FixTypoOptions } from 'baburchi';

const options: FixTypoOptions = {
    typoSymbols: ['ﷺ'],
    similarityThreshold: 0.7,
    highSimilarityThreshold: 0.9,
};
```

## Text Segment Alignment

Baburchi provides specialized functionality for aligning split text segments back to their target lines. This is particularly useful when OCR has fragmented continuous text or poetry into separate segments that need to be reconstructed.

### `alignTextSegments(targetLines, segmentLines)`

Aligns split text segments to match target lines by finding the best order and combining segments when necessary.

**Parameters:**

- `targetLines` (string[]): Array where each element is either a string to align against, or falsy to skip alignment
- `segmentLines` (string[]): Array of text segments that may represent split versions of target lines

**Returns:** Array of aligned text lines

#### Poetry Reconstruction Example

```typescript
import { alignTextSegments } from 'baburchi';

// Target lines from a poetry collection
const targetLines = [
    '', // Don't align - pass through as-is
    'قد قُدِّم العَجْبُ على الرُّوَيس وشارف الوهدُ أبا قُبيسِ',
    'وطاول البقلُ فروعَ الميْس وهبت العنز لقرع التيسِ',
    'وادَّعت الروم أبًا في قيس واختلط الناس اختلاط الحيسِ',
    'إذ قرا القاضي حليف الكيس معاني الشعر على العبيسي',
    '', // Don't align - pass through as-is
];

// OCR segments (fragmented and possibly out of order)
const segmentLines = [
    'A', // Header/marker
    'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس',
    'وطاول البقلُ فروعَ الميْس',
    'وهبت العنـز لـقرع التـيس',
    'واختلط الناس اختلاط الحيس',
    'وادَّعت الروم أبًا في قيس',
    'معـاني الشعر على العـبـيــسـي',
    'إذ قرا القاضي حليف الكيس',
    'B', // Footer/marker
];

const result = alignTextSegments(targetLines, segmentLines);
console.log(result);
// Output:
// [
//     'A',
//     'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس',
//     'وطاول البقلُ فروعَ الميْس وهبت العنـز لـقرع التـيس',
//     'وادَّعت الروم أبًا في قيس واختلط الناس اختلاط الحيس',
//     'إذ قرا القاضي حليف الكيس معـاني الشعر على العـبـيــسـي',
//     'B'
// ]
```

#### Handling Reversed Segments

```typescript
import { alignTextSegments } from 'baburchi';

// When OCR produces segments in wrong order
const targetLines = ['hello world goodbye'];
const segmentLines = ['goodbye', 'hello world'];

const result = alignTextSegments(targetLines, segmentLines);
console.log(result); // ['hello world goodbye']
```

#### Mixed Alignment Scenarios

```typescript
import { alignTextSegments } from 'baburchi';

// Some lines need alignment, others are one-to-one
const targetLines = ['', 'split line content', '']; // Empty strings = no alignment needed
const segmentLines = ['header', 'split line', 'content', 'footer'];

const result = alignTextSegments(targetLines, segmentLines);
console.log(result); // ['header', 'split line content', 'footer']
```

### How It Works

1. **Target Processing**: For each target line that requires alignment (non-falsy), the algorithm:
    - Finds the best combination of available segments that matches the target
    - Uses similarity scoring to determine optimal segment ordering
    - Combines segments when they form a better match together

2. **One-to-One Mapping**: For falsy target lines (empty strings, null, undefined), segments are passed through directly

3. **Remaining Segments**: Any segments not consumed during alignment are appended to the result

This function is particularly useful for:

- Reconstructing fragmented poetry or prose
- Aligning OCR segments with reference text
- Handling cases where text layout affects line ordering
- Processing documents where content has been split across multiple detection regions

## Hijri Date Standardization

Baburchi includes specialized functions for standardizing Hijri date symbols commonly found in Arabic historical and religious texts. These functions help normalize OCR inconsistencies in Hijri date notation.

### `standardizeHijriSymbol(text)`

Standardizes standalone ه to هـ when following Arabic digits, ensuring proper Hijri date notation.

```typescript
import { standardizeHijriSymbol } from 'baburchi';

// Standardize after Arabic-Indic digits
const text1 = standardizeHijriSymbol('سنة ١٤٤٥ ه'); // 'سنة ١٤٤٥ هـ'
const text2 = standardizeHijriSymbol('عام ٧٥٠ه'); // 'عام ٧٥٠ هـ'

// Standardize after Western digits
const text3 = standardizeHijriSymbol('في عام 1445 ه'); // 'في عام 1445 هـ'
const text4 = standardizeHijriSymbol('توفي 632ه'); // 'توفي 632 هـ'

// Does not affect ه when part of other words
const text5 = standardizeHijriSymbol('هذا كتاب'); // 'هذا كتاب' (unchanged)
```

### `standardizeIntahaSymbol(text)`

Standardizes standalone اه to اهـ when appearing as a whole word, typically used in academic and historical texts.

```typescript
import { standardizeIntahaSymbol } from 'baburchi';

// Standardize standalone AH abbreviation
const text1 = standardizeIntahaSymbol('سنة 1445 اه'); // 'سنة 1445 اهـ'
const text2 = standardizeIntahaSymbol('في العام اه'); // 'في العام اهـ'

// Does not affect اه when part of other words
const text3 = standardizeIntahaSymbol('الاهتمام بالتاريخ'); // 'الاهتمام بالتاريخ' (unchanged)
```

### Combined Hijri Standardization

```typescript
import { standardizeHijriSymbol, standardizeIntahaSymbol } from 'baburchi';

function standardizeAllHijriNotations(text: string): string {
    return standardizeIntahaSymbol(standardizeHijriSymbol(text));
}

const mixedText = 'وُلد سنة 570 ه وتوفي عام 632 اه';
const standardized = standardizeAllHijriNotations(mixedText);
console.log(standardized); // 'وُلد سنة 570 هـ وتوفي عام 632 اهـ'
```

## Utilities

The library also exports utility functions for advanced use cases:

```typescript
import {
    calculateSimilarity,
    tokenizeText,
    alignTokenSequences,
    hasInvalidFootnotes,
    correctReferences,
    alignTextSegments,
    standardizeHijriSymbol,
    standardizeIntahaSymbol,
} from 'baburchi';

// Calculate similarity between two strings
const similarity = calculateSimilarity('hello', 'helo'); // 0.8

// Tokenize with symbol preservation
const tokens = tokenizeText('محمد ﷺ رسول', ['ﷺ']); // ['محمد', 'ﷺ', 'رسول']

// Check for invalid footnote references
const hasInvalid = hasInvalidFootnotes('Text with ()'); // true

// Correct footnote references in text lines
const lines = [
    { text: 'Main text with ()', isFootnote: false },
    { text: '() This is a footnote', isFootnote: true },
];
const corrected = correctReferences(lines);

// Align fragmented text segments
const aligned = alignTextSegments(
    ['target line one', '', 'target line three'],
    ['segment1', 'segment2', 'segment3', 'segment4'],
);

// Standardize Hijri date symbols
const hijriText = standardizeHijriSymbol('سنة 1445 ه'); // 'سنة 1445 هـ'
const ahText = standardizeIntahaSymbol('عام 632 اه'); // 'عام 632 اهـ'
```

## Noise Detection

Baburchi provides comprehensive noise detection capabilities specifically designed for Arabic OCR post-processing. These functions help identify and filter out OCR artifacts, formatting elements, and meaningless content commonly found in digitized Arabic documents.

### `isArabicTextNoise(text)`

The main noise detection function that performs comprehensive analysis to identify unwanted OCR artifacts.

```typescript
import { isArabicTextNoise } from 'baburchi';

// Detect formatting artifacts
console.log(isArabicTextNoise('---')); // true
console.log(isArabicTextNoise('...')); // true
console.log(isArabicTextNoise('!!!')); // true

// Detect OCR errors
console.log(isArabicTextNoise('ABC')); // true (uppercase-only pattern)
console.log(isArabicTextNoise('- 77')); // true (digit-dash combination)

// Valid Arabic content
console.log(isArabicTextNoise('السلام عليكم')); // false
console.log(isArabicTextNoise('محمد ﷺ')); // false
console.log(isArabicTextNoise('2023')); // false (substantial number)
```

### Character Analysis Functions

#### `analyzeCharacterStats(text)`

Analyzes character composition and frequency statistics for detailed text analysis.

```typescript
import { analyzeCharacterStats } from 'baburchi';

const stats = analyzeCharacterStats('مرحبا 123!');
console.log(stats);
// {
//   arabicCount: 5,
//   digitCount: 3,
//   latinCount: 0,
//   spaceCount: 1,
//   punctuationCount: 1,
//   symbolCount: 0,
//   charFreq: Map { 'م' => 1, 'ر' => 1, 'ح' => 1, ... }
// }
```

#### `hasExcessiveRepetition(charStats, textLength)`

Detects excessive character repetition that commonly indicates noise.

```typescript
import { hasExcessiveRepetition, analyzeCharacterStats } from 'baburchi';

const stats = analyzeCharacterStats('!!!!!');
console.log(hasExcessiveRepetition(stats, 5)); // true

const normalStats = analyzeCharacterStats('hello world');
console.log(hasExcessiveRepetition(normalStats, 11)); // false
```

### Pattern Detection Functions

#### `isBasicNoisePattern(text)`

Identifies text matching common noise patterns using regular expressions.

```typescript
import { isBasicNoisePattern } from 'baburchi';

console.log(isBasicNoisePattern('---')); // true
console.log(isBasicNoisePattern('...')); // true
console.log(isBasicNoisePattern('ABC')); // true
console.log(isBasicNoisePattern('- 77')); // true
console.log(isBasicNoisePattern('hello world')); // false
```

#### `isSpacingNoise(charStats, contentChars, textLength)`

Detects problematic spacing patterns that indicate OCR artifacts.

```typescript
import { isSpacingNoise, analyzeCharacterStats } from 'baburchi';

const stats = analyzeCharacterStats(' a ');
const contentChars = stats.arabicCount + stats.latinCount + stats.digitCount;
console.log(isSpacingNoise(stats, contentChars, 3)); // true

const normalStats = analyzeCharacterStats('hello world');
const normalContent = normalStats.arabicCount + normalStats.latinCount + normalStats.digitCount;
console.log(isSpacingNoise(normalStats, normalContent, 11)); // false
```

### Content Validation Functions

#### `isValidArabicContent(charStats, textLength)`

Validates whether Arabic content is substantial enough to be meaningful.

```typescript
import { isValidArabicContent, analyzeCharacterStats } from 'baburchi';

const validStats = analyzeCharacterStats('السلام عليكم');
console.log(isValidArabicContent(validStats, 12)); // true

const shortStats = analyzeCharacterStats('ص');
console.log(isValidArabicContent(shortStats, 1)); // false

const withDigitsStats = analyzeCharacterStats('ص 5');
console.log(isValidArabicContent(withDigitsStats, 3)); // true
```

#### `isNonArabicNoise(charStats, textLength, text)`

Determines if non-Arabic content should be classified as noise.

```typescript
import { isNonArabicNoise, analyzeCharacterStats } from 'baburchi';

const stats = analyzeCharacterStats('!!!');
console.log(isNonArabicNoise(stats, 3, '!!!')); // true

const validStats = analyzeCharacterStats('2023');
console.log(isNonArabicNoise(validStats, 4, '2023')); // false
```

### Noise Detection Use Cases

#### OCR Post-Processing Pipeline

```typescript
import { isArabicTextNoise } from 'baburchi';

const ocrLines = ['السلام عليكم ورحمة الله', '---', 'هذا النص صحيح', 'ABC', '...', 'محمد ﷺ رسول الله'];

const cleanLines = ocrLines.filter((line) => !isArabicTextNoise(line));
console.log(cleanLines);
// ['السلام عليكم ورحمة الله', 'هذا النص صحيح', 'محمد ﷺ رسول الله']
```

#### Document Quality Assessment

```typescript
import { analyzeCharacterStats, isArabicTextNoise } from 'baburchi';

function assessDocumentQuality(text: string) {
    const lines = text.split('\n');
    const stats = {
        totalLines: lines.length,
        validLines: 0,
        noiseLines: 0,
        noisyContent: [] as string[],
    };

    for (const line of lines) {
        if (isArabicTextNoise(line.trim())) {
            stats.noiseLines++;
            stats.noisyContent.push(line);
        } else {
            stats.validLines++;
        }
    }

    return {
        ...stats,
        qualityRatio: stats.validLines / stats.totalLines,
        needsCleaning: stats.qualityRatio < 0.8,
    };
}

const document = `السلام عليكم
---
هذا نص عربي صحيح
ABC
النهاية`;

const quality = assessDocumentQuality(document);
console.log(quality);
// { totalLines: 5, validLines: 3, noiseLines: 2, qualityRatio: 0.6, needsCleaning: true }
```

#### Batch Text Cleaning

```typescript
import { isArabicTextNoise } from 'baburchi';

function cleanTextBatch(texts: string[]): { clean: string[]; noise: string[] } {
    const result = { clean: [] as string[], noise: [] as string[] };

    for (const text of texts) {
        if (isArabicTextNoise(text)) {
            result.noise.push(text);
        } else {
            result.clean.push(text);
        }
    }

    return result;
}

const mixedTexts = ['السلام عليكم', '---', 'مرحبا', '!!!', '2023'];
const { clean, noise } = cleanTextBatch(mixedTexts);
console.log('Clean:', clean); // ['السلام عليكم', 'مرحبا', '2023']
console.log('Noise:', noise); // ['---', '!!!']
```

### Footnote Processing

Baburchi provides specialized functions for handling footnote references:

#### `hasInvalidFootnotes(text)`

Detects invalid footnote patterns including empty parentheses "()" and OCR-confused characters.

```typescript
import { hasInvalidFootnotes } from 'baburchi';

const invalid = hasInvalidFootnotes('Text with () reference'); // true
const valid = hasInvalidFootnotes('Text with (١) reference'); // false
```

#### `correctReferences(lines)`

Corrects footnote references across multiple text lines by:

- Converting OCR-confused characters to proper Arabic numerals
- Filling empty "()" references with appropriate numbers
- Ensuring body text and footnote references match
- Generating new reference numbers when needed

```typescript
import { correctReferences } from 'baburchi';

const textLines = [
    { text: 'Main content with (O) reference', isFootnote: false },
    { text: '(1) Footnote text here', isFootnote: true },
];

const corrected = correctReferences(textLines);
// OCR characters (O) and (1) become proper Arabic numerals
```

## Text Balance Validation

Baburchi includes robust text balance validation utilities for checking proper pairing of quotes and brackets in text. These functions help identify syntax errors, unclosed brackets, mismatched pairs, and other balance issues commonly found in OCR-processed text.

### Balance Checking Functions

#### `checkBalance(text)`

Comprehensive balance checking for both quotes and brackets in a single function.

```typescript
import { checkBalance } from 'baburchi';

const result = checkBalance('Hello "world" and (test)');
console.log(result.isBalanced); // true
console.log(result.errors); // []

const problematic = checkBalance('Hello "world and (test');
console.log(problematic.isBalanced); // false
console.log(problematic.errors);
// [
//   { char: '"', index: 6, reason: 'unmatched', type: 'quote' },
//   { char: '(', index: 17, reason: 'unclosed', type: 'bracket' }
// ]
```

#### `getUnbalancedErrors(text)`

Advanced error detection for multi-line text with absolute character positioning.

```typescript
import { getUnbalancedErrors } from 'baburchi';

const multiLineText = `First line with "unmatched quote
Second line with (unclosed bracket
Third line is balanced "properly"`;

const errors = getUnbalancedErrors(multiLineText);
console.log(errors);
// [
//   { absoluteIndex: 16, char: '"', reason: 'unmatched', type: 'quote' },
//   { absoluteIndex: 51, char: '(', reason: 'unclosed', type: 'bracket' }
// ]
```

### Supported Bracket Types

Baburchi supports the following bracket pairs:

- **Parentheses**: `()`
- **Square brackets**: `[]`
- **Curly brackets**: `{}`
- **Angle brackets**: `«»`

### Error Types

The balance checker identifies three types of errors:

- **`unmatched`**: Opening or closing character without a corresponding pair
- **`unclosed`**: Opening character that was never closed
- **`mismatched`**: Wrong closing character for an opening character (e.g., `(]`)

### Balance Checking Configuration

```typescript
import { BRACKETS, OPEN_BRACKETS, CLOSE_BRACKETS } from 'baburchi';

// Access bracket mappings
console.log(BRACKETS); // { '«': '»', '(': ')', '[': ']', '{': '}' }

// Check if character is an opening bracket
console.log(OPEN_BRACKETS.has('(')); // true

// Check if character is a closing bracket
console.log(CLOSE_BRACKETS.has(')')); // true
```

### Use Cases

#### Text Editor Integration

Perfect for syntax highlighting and error detection in text editors:

```typescript
import { getUnbalancedErrors } from 'baburchi';

const editorContent = getUserInput();
const errors = getUnbalancedErrors(editorContent);

// Highlight errors in the editor using absolute positions
errors.forEach((error) => {
    highlightError(error.absoluteIndex, error.char, error.reason);
});
```

#### OCR Post-Processing

Identify and flag potential OCR errors in processed text:

```typescript
import { checkBalance } from 'baburchi';

const ocrText = processOCRDocument();
const { isBalanced, errors } = checkBalance(ocrText);

if (!isBalanced) {
    console.log(`Found ${errors.length} balance errors requiring review`);
    errors.forEach((error) => {
        console.log(`${error.type} error: "${error.char}" at position ${error.index} (${error.reason})`);
    });
}
```

#### Document Validation

Validate document structure before processing:

```typescript
import { getUnbalancedErrors } from 'baburchi';

const document = loadDocument();
const lines = document.split('\n');

// Only check lines longer than 10 characters (as per library behavior)
const longLines = lines.filter((line) => line.length > 10);
const errors = getUnbalancedErrors(document);

if (errors.length === 0) {
    console.log('Document structure is valid');
} else {
    console.log(`Document has ${errors.length} structural issues`);
}
```

## Contributing

Contributions are welcome. Please ensure your contributions adhere to the coding standards and include relevant tests.

### Development Setup

1. Fork the repository
2. Install dependencies: `bun install` (requires [Bun](https://bun.sh/))
3. Make your changes
4. Run tests: `bun test`
5. Build artefacts (optional verification): `bun run build`
6. Run linting: `bun run lint`
7. Submit a pull request

### Running Tests

```bash
# Run tests with coverage
bun test --coverage

# Run tests in watch mode
bun test --watch
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

`baburchi` is released under the MIT License. See the [LICENSE.md](./LICENSE.md) file for more details.

## Author

Ragaeeb Haq

- GitHub: [@ragaeeb](https://github.com/ragaeeb)

---

Built with ❤️ using TypeScript and Bun. Optimized for Arabic text processing, OCR post-processing, and noise detection.
