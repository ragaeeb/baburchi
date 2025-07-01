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

A lightweight TypeScript library for intelligent OCR text post-processing, specializing in Arabic text with advanced typo correction using sequence alignment algorithms.

## Features

- 🧠 **Intelligent Text Alignment**: Uses the Needleman-Wunsch algorithm for optimal text sequence alignment
- 🔤 **Arabic Text Specialization**: Advanced normalization and diacritics handling for Arabic text
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
import { fixTypo } from 'baburchi';

// Basic usage with Arabic text
const originalText = 'محمد صلى الله عليه وسلم رسول الله';
const correctedText = 'محمد ﷺ رسول الله';
const typoSymbols = ['ﷺ', '﷽', 'ﷻ'];

const result = fixTypo(originalText, correctedText, { typoSymbols });
console.log(result); // 'محمد صلى الله عليه ﷺ رسول الله'
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

Built with ❤️ using TypeScript and Bun. Optimized for Arabic text processing and OCR post-processing.
