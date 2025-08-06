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

## Features

- 🧠 **Intelligent Text Alignment**: Uses the Needleman-Wunsch algorithm for optimal text sequence alignment
- 🔤 **Arabic Text Specialization**: Advanced normalization and diacritics handling for Arabic text
- 🧹 **Noise Detection**: Comprehensive Arabic text noise detection and OCR artifact identification
- 📝 **Footnote Management**: Smart handling of embedded and standalone footnotes
- ⚡ **High Performance**: Space-optimized algorithms with O(min(m,n)) space complexity
- 🎯 **Special Symbol Preservation**: Configurable preservation of religious symbols and honorifics
- 🔧 **Flexible Configuration**: Customizable similarity thresholds and typo symbols
- 📦 **Zero Dependencies**: Pure TypeScript implementation with no external dependencies
- 🌐 **Universal Compatibility**: Works in Node.js, Bun, and modern browsers

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
console.log(result); // 'محمد صلى الله عليه ﷺ رسول الله'

// Noise detection for OCR cleanup
const cleanText = isArabicTextNoise('السلام عليكم'); // false
const noiseText = isArabicTextNoise('---'); // true
```

## API Reference

### `fixTypo(original, correction, options)`

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

### `processTextAlignment(originalText, altText, options)`

Low-level function for advanced text processing with full configuration control.

**Parameters:**

- `originalText` (string): Original text to process
- `altText` (string): Reference text for alignment
- `options` (FixTypoOptions): Complete configuration object

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

- ✅ Node.js 18+
- ✅ Bun 1.0+
- ✅ Modern browsers (ES2020+)
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

## Utilities

The library also exports utility functions for advanced use cases:

```typescript
import {
    calculateSimilarity,
    normalizeArabicText,
    tokenizeText,
    alignTokenSequences,
    hasInvalidFootnotes,
    correctReferences,
    alignTextSegments,
} from 'baburchi';

// Calculate similarity between two strings
const similarity = calculateSimilarity('hello', 'helo'); // 0.8

// Normalize Arabic text
const normalized = normalizeArabicText('اَلسَّلَامُ'); // 'السلام'

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
5. Run linting: `bun run lint`
6. Submit a pull request

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
