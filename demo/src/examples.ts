import {
    alignTextSegments,
    alignTokenSequences,
    analyzeCharacterStats,
    areBracketsBalanced,
    areQuotesBalanced,
    areSimilarAfterNormalization,
    backtrackAlignment,
    boundedLevenshtein,
    calculateAlignmentScore,
    calculateLevenshteinDistance,
    calculateSimilarity,
    checkBalance,
    containsArabicHonorific,
    correctReferences,
    createArabicSanitizer,
    extractDigits,
    findHonorificCorruptions,
    findMatches,
    findMatchesAll,
    fixTypo,
    getUnbalancedErrors,
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    hasExcessiveRepetition,
    hasInvalidFootnotes,
    isArabicTextNoise,
    isBalanced,
    isBasicNoisePattern,
    isNonArabicNoise,
    isSimilarityAboveThreshold,
    isSpacingNoise,
    isValidArabicContent,
    processTextAlignment,
    removeFootnoteReferencesSimple,
    removeSingleDigitFootnoteReferences,
    sanitizeArabic,
    sanitizeQuranForSearch,
    standardizeHijriSymbol,
    standardizeIntahaSymbol,
    tokenizeText,
} from '../../dist/index.js';

export type DemoEntry = {
    category: string;
    resultNote: string;
    alternative: string;
    apply: (input: string) => string;
    description: string;
    direction?: 'ltr' | 'rtl';
    id: string;
    name: string;
    placeholder: string;
};

type AlignmentCell = {
    direction: 'diagonal' | 'left' | 'up' | null;
    score: number;
};

const typoSymbols = ['ﷺ', '﷽', 'ﷻ'];

const ensureSections = (input: string, count: number): string[] => {
    const sections = input.split(/\n-{3,}\n/).map((section) => section.trim());
    return [...sections, ...Array.from({ length: Math.max(0, count - sections.length) }, () => '')];
};

const parseLines = (input: string): string[] => {
    return input
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
};

const parseTokens = (input: string): string[] => {
    return input.split(/\s+/).filter((token) => token.length > 0);
};

const formatOutput = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value instanceof Map) {
        return JSON.stringify(Object.fromEntries(value), null, 2);
    }
    if (Array.isArray(value)) {
        return JSON.stringify(value, null, 2);
    }
    if (value && typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
};

const formatCharacterStats = (stats: ReturnType<typeof analyzeCharacterStats>) => {
    return {
        ...stats,
        charFreq: Object.fromEntries(stats.charFreq.entries()),
    };
};

const buildAlignmentMatrix = (
    tokensA: string[],
    tokensB: string[],
    symbols: string[],
    threshold: number,
): AlignmentCell[][] => {
    const matrix: AlignmentCell[][] = Array.from({ length: tokensA.length + 1 }, () =>
        Array.from({ length: tokensB.length + 1 }, () => ({ direction: null, score: 0 })),
    );

    for (let i = 1; i <= tokensA.length; i += 1) {
        matrix[i][0] = { direction: 'up', score: i * -1 };
    }
    for (let j = 1; j <= tokensB.length; j += 1) {
        matrix[0][j] = { direction: 'left', score: j * -1 };
    }

    for (let i = 1; i <= tokensA.length; i += 1) {
        for (let j = 1; j <= tokensB.length; j += 1) {
            const alignmentScore = calculateAlignmentScore(tokensA[i - 1], tokensB[j - 1], symbols, threshold);
            const diagonalScore = matrix[i - 1][j - 1].score + alignmentScore;
            const upScore = matrix[i - 1][j].score - 1;
            const leftScore = matrix[i][j - 1].score - 1;
            const maxScore = Math.max(diagonalScore, upScore, leftScore);

            if (maxScore === diagonalScore) {
                matrix[i][j] = { direction: 'diagonal', score: diagonalScore };
            } else if (maxScore === upScore) {
                matrix[i][j] = { direction: 'up', score: upScore };
            } else {
                matrix[i][j] = { direction: 'left', score: leftScore };
            }
        }
    }

    return matrix;
};

const parseFootnoteLines = (input: string) => {
    return parseLines(input).map((line) => {
        const trimmed = line.trim();
        const isFootnote = trimmed.startsWith('FN:');
        return {
            isFootnote,
            text: isFootnote ? trimmed.replace(/^FN:\s*/, '') : trimmed,
        };
    });
};

const sanitizeAggressive = createArabicSanitizer('aggressive');

/** Curated, editable examples for the function explorer; each runner uses the local library build. */
export const entries: DemoEntry[] = [
    {
        alternative: 'محمد صلى الله عليه وسلم رسول الله\n---\nمحمد ﷺ رسول الله',
        apply: (input) => {
            const [original, correction] = ensureSections(input, 2);
            return fixTypo(original, correction, { typoSymbols });
        },
        category: 'Repair & normalize',
        description:
            'Correct OCR typos by aligning original and reference text, preserving Arabic symbols and footnotes.',
        direction: 'rtl',
        id: 'fixTypo',
        name: 'fixTypo',
        placeholder: 'ذهب الطالب الطالب إلى المدرسة\n---\nذهب الطالب إلى المدرسة',
        resultNote:
            'Aligns two OCR readings and preserves configured symbols; one-sided protected symbols leave the original unchanged.',
    },
    {
        alternative: 'محمد رسول الله\n---\nمحمد ﷺ رسول الله',
        apply: (input) => {
            const [original, correction] = ensureSections(input, 2);
            return processTextAlignment(original, correction, {
                highSimilarityThreshold: 0.8,
                similarityThreshold: 0.6,
                typoSymbols,
            });
        },
        category: 'Repair & normalize',
        description: 'Run low-level alignment with full control over similarity thresholds and typo symbol handling.',
        direction: 'rtl',
        id: 'processTextAlignment',
        name: 'processTextAlignment',
        placeholder: 'النص (١) (١)أخرجه البخاري\n---\nالنص (١)أخرجه البخاري',
        resultNote:
            'Uses thresholds 0.6 and 0.8. Duplicate markers can be fused; a one-sided protected symbol keeps the original unchanged.',
    },
    {
        alternative: 'السلام عليكم ورحمة الله\n---\nورحمة الله\nالسلام عليكم',
        apply: (input) => {
            const [targetsRaw, segmentsRaw] = ensureSections(input, 2);
            return formatOutput(alignTextSegments(parseLines(targetsRaw), parseLines(segmentsRaw)));
        },
        category: 'Alignment & search',
        description: 'Reconstruct split lines by finding the best segment order against target lines.',
        direction: 'rtl',
        id: 'alignTextSegments',
        name: 'alignTextSegments',
        placeholder:
            'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس\nوطاول البقلُ فروعَ الميْس وهبت العنز لقرع التيس\n---\nقد قُدِّم العَجْبُ على الرُّوَيس\nوشـارف الوهـدُ أبــا قُبيس\nوطاول البقلُ فروعَ الميْس\nوهبت العنـز لـقرع التـيس',
        resultNote: 'Returns reconstructed lines. Each target can consume one segment or merge the next two.',
    },
    {
        alternative: 'الكتاب عن تاريخ دمشق\nرحلة إلى مكة والمدينة\n---\nرحلة إلى مكة\nzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        apply: (input) => {
            const [pagesRaw, excerptsRaw] = ensureSections(input, 2);
            return formatOutput(findMatches(parseLines(pagesRaw), parseLines(excerptsRaw)));
        },
        category: 'Alignment & search',
        description: 'Locate the best matching page for each excerpt using exact and fuzzy search.',
        direction: 'rtl',
        id: 'findMatches',
        name: 'findMatches',
        placeholder:
            'هذا النص في الصفحة الأولى مع محتوى إضافي\nالنص الثاني يظهر هنا في الصفحة الثانية\n---\nالنص في الصفحة الأولى\nالنص الثاني يظهر',
        resultNote: 'One zero-based page index per excerpt; -1 means no match. The first input line is page 0.',
    },
    {
        alternative: 'هذا كتاب مفيد\nهذا كتاب مفيد أيضا\n---\nكتاب مفيد',
        apply: (input) => {
            const [pagesRaw, excerptsRaw] = ensureSections(input, 2);
            return formatOutput(findMatchesAll(parseLines(pagesRaw), parseLines(excerptsRaw)));
        },
        category: 'Alignment & search',
        description: 'Return ranked lists of all pages that could match each excerpt.',
        direction: 'rtl',
        id: 'findMatchesAll',
        name: 'findMatchesAll',
        placeholder:
            'النص الأول مع محتوى مشابه\nمحتوى مشابه في النص الثاني\nالنص الأول بصيغة مختلفة قليلاً\n---\nالنص الأول',
        resultNote: 'One ranked array of zero-based page indices per excerpt; [] means no match.',
    },
    {
        alternative: '  إِلَى المَكْتَبَةِ  ',
        apply: (input) => sanitizeArabic(input, 'search'),
        category: 'Repair & normalize',
        description:
            'Clean Arabic text with presets for light display cleanup, search normalization, or aggressive indexing.',
        direction: 'rtl',
        id: 'sanitizeArabic',
        name: 'sanitizeArabic',
        placeholder: 'اَلسَّلَامُ عَلَيْكُمْ',
        resultNote: 'Search preset: removes vowel marks and tatweel, normalizes alif forms and ى.',
    },
    {
        alternative: 'أَهْلاً  بالعَالَمِ! ABC (٢)',
        apply: (input) => sanitizeAggressive(input),
        category: 'Repair & normalize',
        description: 'Build a reusable sanitizer function for fast repeated Arabic normalization.',
        direction: 'rtl',
        id: 'createArabicSanitizer',
        name: 'createArabicSanitizer',
        placeholder: 'اَلسَّلَامُ ١٤٤٥/٣/٢٩ هـ — www',
        resultNote:
            'The aggressive sanitizer is created once, then called on your input; output is text, not a function.',
    },
    {
        alternative: 'السلام عليكم',
        apply: (input) => formatOutput(isArabicTextNoise(input.trim())),
        category: 'Noise detection',
        description: 'Detects OCR noise patterns in Arabic text such as artifacts and formatting lines.',
        direction: 'rtl',
        id: 'isArabicTextNoise',
        name: 'isArabicTextNoise',
        placeholder: '---',
        resultNote: 'true means likely OCR noise; false means keep for further review. This is a heuristic.',
    },
    {
        alternative: 'مرحبا ١٢٣ ABC!',
        apply: (input) => formatOutput(formatCharacterStats(analyzeCharacterStats(input))),
        category: 'Noise detection',
        description: 'Break down character composition for Arabic, digits, punctuation, and symbols.',
        direction: 'rtl',
        id: 'analyzeCharacterStats',
        name: 'analyzeCharacterStats',
        placeholder: 'مرحبا 123!',
        resultNote: 'Counts character classes and frequencies. Arabic-Indic digits fall in the Arabic Unicode class.',
    },
    {
        alternative: 'مرحبا بالعالم',
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(hasExcessiveRepetition(stats, input.length));
        },
        category: 'Noise detection',
        description: 'Flags lines with excessive repeated characters that often indicate noise.',
        id: 'hasExcessiveRepetition',
        name: 'hasExcessiveRepetition',
        placeholder: '!!!!!',
        resultNote:
            'true flags repeated artifact characters such as !, dots or dashes; ordinary repeated letters are not the target.',
    },
    {
        alternative: 'السلام عليكم',
        apply: (input) => formatOutput(isBasicNoisePattern(input.trim())),
        category: 'Noise detection',
        description: 'Matches common OCR noise regex patterns like repeated dashes or dots.',
        id: 'isBasicNoisePattern',
        name: 'isBasicNoisePattern',
        placeholder: '---',
        resultNote: 'true matches a basic noise pattern; false does not guarantee meaningful text.',
    },
    {
        alternative: '2023',
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(isNonArabicNoise(stats, input.length, input));
        },
        category: 'Noise detection',
        description: 'Applies heuristic rules to label non-Arabic input as noise or valid content.',
        id: 'isNonArabicNoise',
        name: 'isNonArabicNoise',
        placeholder: 'ABC',
        resultNote:
            'A low-level heuristic using character counts; the full isArabicTextNoise detector adds other checks.',
    },
    {
        alternative: 'مرحبا بالعالم',
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            const contentChars = stats.arabicCount + stats.latinCount + stats.digitCount;
            return formatOutput(isSpacingNoise(stats, contentChars, input.length));
        },
        category: 'Noise detection',
        description: 'Detects problematic spacing patterns in OCR output.',
        id: 'isSpacingNoise',
        name: 'isSpacingNoise',
        placeholder: ' a ',
        resultNote: 'true means whitespace dominates sparse content. Spaces are preserved in this input.',
    },
    {
        alternative: '!!!',
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(isValidArabicContent(stats, input.length));
        },
        category: 'Noise detection',
        description: 'Checks whether Arabic text is substantial enough to be considered meaningful.',
        direction: 'rtl',
        id: 'isValidArabicContent',
        name: 'isValidArabicContent',
        placeholder: 'السلام عليكم',
        resultNote:
            'true means the Arabic character proportions pass the heuristic; it does not check grammar or meaning.',
    },
    {
        alternative: 'النص (٢) مع الحواشي',
        apply: (input) => formatOutput(hasInvalidFootnotes(input)),
        category: 'Footnotes',
        description: 'Detects empty or OCR-corrupted footnote references like "()" or "(O)".',
        direction: 'rtl',
        id: 'hasInvalidFootnotes',
        name: 'hasInvalidFootnotes',
        placeholder: 'النص (O) مع الحواشي',
        resultNote: 'true detects empty or OCR-confused markers. A valid Arabic-Indic marker returns false.',
    },
    {
        alternative: 'النص () مع الحواشي\nFN: (٢) شرح الحاشية',
        apply: (input) => {
            const corrected = correctReferences(parseFootnoteLines(input));
            return corrected.map((line) => `${line.isFootnote ? 'FN: ' : ''}${line.text}`).join('\n');
        },
        category: 'Footnotes',
        description: 'Normalizes footnote references across body text and footnote lines.',
        direction: 'rtl',
        id: 'correctReferences',
        name: 'correctReferences',
        placeholder: 'النص (O) مع الحواشي\nFN: (1) أخرجه البخاري\nFN: () رواه مسلم',
        resultNote:
            'FN: is a demo input convention. OCR markers are normalized and empty references get available or new numbers.',
    },
    {
        alternative: 'Hello "world and (test',
        apply: (input) => formatOutput(checkBalance(input)),
        category: 'Balance checks',
        description: 'Reports paired-quote and bracket errors with character indices.',
        id: 'checkBalance',
        name: 'checkBalance',
        placeholder: 'Hello "world" and (test)',
        resultNote:
            'Returns structured errors, including character and position details, rather than changing the text.',
    },
    {
        alternative: 'Hello "world" and (test)',
        apply: (input) => formatOutput(getUnbalancedErrors(input)),
        category: 'Balance checks',
        description: 'Gets absolute character positions for unbalanced quotes and brackets.',
        id: 'getUnbalancedErrors',
        name: 'getUnbalancedErrors',
        placeholder: 'First line with "quote\nSecond line with (bracket',
        resultNote: 'Returns error locations as absolute offsets in the complete input.',
    },
    {
        alternative: 'Hello "world',
        apply: (input) => formatOutput(areQuotesBalanced(input)),
        category: 'Balance checks',
        description: 'Checks if a string has balanced double quotes.',
        id: 'areQuotesBalanced',
        name: 'areQuotesBalanced',
        placeholder: 'Hello "world"',
        resultNote: 'true means double quotes are paired; single quotes are not checked.',
    },
    {
        alternative: '(hello [world)]',
        apply: (input) => formatOutput(areBracketsBalanced(input)),
        category: 'Balance checks',
        description: 'Checks whether brackets and guillemets are correctly nested.',
        id: 'areBracketsBalanced',
        name: 'areBracketsBalanced',
        placeholder: '(hello [world])',
        resultNote: 'true means (), [], {} and «» are properly nested; crossed pairs return false.',
    },
    {
        alternative: 'Hello "world" and (test',
        apply: (input) => formatOutput(isBalanced(input)),
        category: 'Balance checks',
        description: 'Returns true only if both quotes and brackets are balanced.',
        id: 'isBalanced',
        name: 'isBalanced',
        placeholder: 'Hello "world" and (test)',
        resultNote: 'true requires both paired double quotes and correctly nested brackets.',
    },
    {
        alternative: 'الحاشية (١٢) في الصفحة ٣٤',
        apply: (input) => extractDigits(input),
        category: 'Text utilities',
        description: 'Extracts the first sequence of Western or Arabic-Indic digits, preserving its script.',
        direction: 'rtl',
        id: 'extractDigits',
        name: 'extractDigits',
        placeholder: 'عام 1445 هـ، الصفحة 12',
        resultNote: 'Returns only the first digit sequence, not all numbers. No digits returns an empty string.',
    },
    {
        alternative: 'محمدﷺرسول الله',
        apply: (input) => formatOutput(tokenizeText(input, typoSymbols)),
        category: 'Text utilities',
        description: 'Splits text into tokens while preserving special symbols.',
        direction: 'rtl',
        id: 'tokenizeText',
        name: 'tokenizeText',
        placeholder: 'محمد ﷺ رسول الله',
        resultNote: 'Returns word tokens; configured symbols become separate tokens even without spaces.',
    },
    {
        alternative: 'النص (١)\n---\n(١)\n---\n(٢)أخرجه',
        apply: (input) => {
            const [resultRaw, previousToken, currentToken] = ensureSections(input, 3);
            const resultTokens = parseTokens(resultRaw);
            const handled = handleFootnoteFusion(resultTokens, previousToken, currentToken);
            return formatOutput({ handled, resultTokens });
        },
        category: 'Footnotes',
        description: 'Merges consecutive footnote tokens when appropriate.',
        direction: 'rtl',
        id: 'handleFootnoteFusion',
        name: 'handleFootnoteFusion',
        placeholder: 'النص (١)\n---\n(١)\n---\n(١)أخرجه',
        resultNote:
            'Shows both the handled boolean and the mutated resultTokens array. Matching marker numbers allow fusion.',
    },
    {
        alternative: 'النص\n---\nالنص',
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(handleFootnoteSelection(tokenA, tokenB));
        },
        category: 'Footnotes',
        description: 'Selects the best token when one token contains a footnote reference.',
        direction: 'rtl',
        id: 'handleFootnoteSelection',
        name: 'handleFootnoteSelection',
        placeholder: '(١) النص\n---\nالنص (١)',
        resultNote:
            'Returns selected tokens, preferring a token with an embedded marker; null means no special handling.',
    },
    {
        alternative: 'النص\n---\nالشرح',
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(handleStandaloneFootnotes(tokenA, tokenB));
        },
        category: 'Footnotes',
        description: 'Combines standalone footnote markers with surrounding tokens.',
        direction: 'rtl',
        id: 'handleStandaloneFootnotes',
        name: 'handleStandaloneFootnotes',
        placeholder: '(١)\n---\nالنص',
        resultNote: 'Preserves a standalone marker alongside regular text; null means neither token is a marker.',
    },
    {
        alternative: 'النص (٢) مع الحواشي',
        apply: (input) => removeFootnoteReferencesSimple(input),
        category: 'Footnotes',
        description: 'Removes markers shaped like (¬١٢), then collapses extra spaces.',
        direction: 'rtl',
        id: 'removeFootnoteReferencesSimple',
        name: 'removeFootnoteReferencesSimple',
        placeholder: 'النص (¬١٢) مع الحواشي (٢)',
        resultNote: 'Removes (¬١٢) while retaining ordinary (٢). Only Arabic-Indic digits after ¬ are handled.',
    },
    {
        alternative: 'الحاشية (١٢) والصفحة (12)',
        apply: (input) => removeSingleDigitFootnoteReferences(input),
        category: 'Footnotes',
        description: 'Removes single-digit footnote markers while preserving other numbers.',
        direction: 'rtl',
        id: 'removeSingleDigitFootnoteReferences',
        name: 'removeSingleDigitFootnoteReferences',
        placeholder: 'النص (٢) و(٥ م) في الصفحة 12 والحاشية (١٢)',
        resultNote: 'Removes (٢) and (٥ م); retains multi-digit (١٢) and ordinary page number 12.',
    },
    {
        alternative: 'سنة ١٤٤٥ هـ',
        apply: (input) => standardizeHijriSymbol(input),
        category: 'Text utilities',
        description: 'Normalizes standalone ه to هـ after digits in Hijri dates.',
        direction: 'rtl',
        id: 'standardizeHijriSymbol',
        name: 'standardizeHijriSymbol',
        placeholder: 'سنة 1445 ه',
        resultNote: 'Adds tatweel to ه after a Western or Arabic-Indic digit; already normalized هـ is retained.',
    },
    {
        alternative: 'انتهى الكلام اهـ',
        apply: (input) => standardizeIntahaSymbol(input),
        category: 'Text utilities',
        description: 'Standardizes the standalone quotation-ending abbreviation اه to اهـ.',
        direction: 'rtl',
        id: 'standardizeIntahaSymbol',
        name: 'standardizeIntahaSymbol',
        placeholder: 'انتهى كلام المؤلف اه',
        resultNote:
            'Adds tatweel to standalone اه, a quotation-ending abbreviation. Words containing those letters stay intact.',
    },
    {
        alternative: 'hello\n---\nhello',
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(calculateSimilarity(textA, textB));
        },
        category: 'Similarity & distance',
        description: 'Returns a similarity ratio between two strings.',
        id: 'calculateSimilarity',
        name: 'calculateSimilarity',
        placeholder: 'hello\n---\nhelo',
        resultNote: 'A ratio from 0 to 1: 1 is identical. hello / helo is 0.8; this call does not normalize Arabic.',
    },
    {
        alternative: 'كتاب\n---\nمدرسة',
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(areSimilarAfterNormalization(textA, textB, 0.6));
        },
        category: 'Similarity & distance',
        description: 'Checks similarity after Arabic normalization.',
        direction: 'rtl',
        id: 'areSimilarAfterNormalization',
        name: 'areSimilarAfterNormalization',
        placeholder: 'السَّلام\n---\nالسلام',
        resultNote: 'Normalizes Arabic first, then checks similarity against the fixed threshold 0.6.',
    },
    {
        alternative: 'كتاب\n---\nمدرسة',
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(calculateAlignmentScore(tokenA, tokenB, typoSymbols, 0.6));
        },
        category: 'Similarity & distance',
        description: 'Scores two tokens for sequence alignment.',
        direction: 'rtl',
        id: 'calculateAlignmentScore',
        name: 'calculateAlignmentScore',
        placeholder: 'محمد\n---\nمحمد',
        resultNote:
            'A token-pair score, not a percentage. Identical normalized tokens receive the strongest match score.',
    },
    {
        alternative: 'ذهب الطالب\n---\nذهب الطالب اليوم',
        apply: (input) => {
            const [tokensA, tokensB] = ensureSections(input, 2);
            return formatOutput(alignTokenSequences(parseTokens(tokensA), parseTokens(tokensB), typoSymbols, 0.6));
        },
        category: 'Alignment & search',
        description: 'Runs Needleman-Wunsch alignment on two token sequences.',
        direction: 'rtl',
        id: 'alignTokenSequences',
        name: 'alignTokenSequences',
        placeholder: 'محمد رسول\n---\nمحمد ﷺ رسول',
        resultNote: 'Each pair is [token A, token B]. null marks an insertion or deletion, not a literal token.',
    },
    {
        alternative: 'ذهب الطالب\n---\nذهب الطالب اليوم',
        apply: (input) => {
            const [tokensA, tokensB] = ensureSections(input, 2);
            const tokensLeft = parseTokens(tokensA);
            const tokensRight = parseTokens(tokensB);
            const matrix = buildAlignmentMatrix(tokensLeft, tokensRight, typoSymbols, 0.6);
            return formatOutput(backtrackAlignment(matrix, tokensLeft, tokensRight));
        },
        category: 'Alignment & search',
        description: 'Reconstructs aligned token pairs from a scoring matrix.',
        direction: 'rtl',
        id: 'backtrackAlignment',
        name: 'backtrackAlignment',
        placeholder: 'محمد رسول\n---\nمحمد ﷺ رسول',
        resultNote:
            'The demo builds a scoring matrix first; backtracking reconstructs token pairs, with null for gaps.',
    },
    {
        alternative: 'كتاب\n---\nكتاب',
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(calculateLevenshteinDistance(textA, textB));
        },
        category: 'Similarity & distance',
        description: 'Returns the raw edit distance between two strings.',
        id: 'calculateLevenshteinDistance',
        name: 'calculateLevenshteinDistance',
        placeholder: 'kitten\n---\nsitting',
        resultNote: 'Minimum insertions, deletions and substitutions: kitten → sitting takes 3 edits.',
    },
    {
        alternative: 'a\n---\nabcdefghi',
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(boundedLevenshtein(textA, textB, 3));
        },
        category: 'Similarity & distance',
        description: 'Computes edit distance with a maximum cutoff.',
        id: 'boundedLevenshtein',
        name: 'boundedLevenshtein',
        placeholder: 'kitten\n---\nsitting',
        resultNote: 'Cutoff is 3. A result of 4 means the distance exceeds the cutoff; it is not the exact distance.',
    },
    {
        alternative: 'قال النبي صلى الله عليه وسلم',
        apply: (input) => formatOutput(containsArabicHonorific(input)),
        category: 'Text utilities',
        description: 'Detects Unicode Arabic honorific signs and ligatures.',
        direction: 'rtl',
        id: 'containsArabicHonorific',
        name: 'containsArabicHonorific',
        placeholder: 'قال النبي ﷺ',
        resultNote:
            'true means a supported Unicode sign is present. A spelled-out honorific phrase alone returns false.',
    },
    {
        alternative: 'قال النبي صلى الله عليه وسلم في الحديث\n---\nقال النبي ﷺ في الحديث',
        apply: (input) => {
            const [primary, reference] = ensureSections(input, 2);
            return formatOutput(findHonorificCorruptions(primary, reference));
        },
        category: 'Alignment & search',
        description: 'Finds likely omitted or corrupted honorifics between matching OCR context words.',
        direction: 'rtl',
        id: 'findHonorificCorruptions',
        name: 'findHonorificCorruptions',
        placeholder: 'قال النبي سس في الحديث\n---\nقال النبي ﷺ في الحديث',
        resultNote:
            'Returns evidence with exact offsets in both inputs; it does not edit text. Equivalent written-out phrases are not flagged.',
    },
    {
        alternative: 'مُوسَى وَإِبْرَاهِيمَ',
        apply: (input) => sanitizeQuranForSearch(input),
        category: 'Repair & normalize',
        description: 'Creates a conservative search surface for Qur’anic orthography.',
        direction: 'rtl',
        id: 'sanitizeQuranForSearch',
        name: 'sanitizeQuranForSearch',
        placeholder: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
        resultNote:
            'Normalizes alif wasla and context-sensitive dagger alif, while retaining standard hamza forms and alif maqsurah.',
    },
    {
        alternative: 'hello\n---\nworld',
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(isSimilarityAboveThreshold(textA, textB, 0.6, true));
        },
        category: 'Similarity & distance',
        description: 'Checks whether raw string similarity reaches a chosen threshold.',
        id: 'isSimilarityAboveThreshold',
        name: 'isSimilarityAboveThreshold',
        placeholder: 'hello\n---\nhelo',
        resultNote:
            'Uses a fixed threshold of 0.6 with inclusive comparison. Unlike areSimilarAfterNormalization, it compares raw strings.',
    },
];
