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
    correctReferences,
    createArabicSanitizer,
    extractDigits,
    findMatches,
    findMatchesAll,
    fixTypo,
    getUnbalancedErrors,
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
    isArabicTextNoise,
    isBalanced,
    isBasicNoisePattern,
    isNonArabicNoise,
    isSpacingNoise,
    isValidArabicContent,
    processTextAlignment,
    removeFootnoteReferencesSimple,
    removeSingleDigitFootnoteReferences,
    sanitizeArabic,
    standardizeHijriSymbol,
    standardizeIntahaSymbol,
    tokenizeText,
} from 'baburchi';
import { createMemo, createSignal, For, Show } from 'solid-js';
import rootPackage from '../../package.json';
import demoPackage from '../package.json';
import './App.css';

type DemoEntry = {
    apply: (input: string) => string;
    description: string;
    direction?: 'ltr' | 'rtl';
    helper?: string;
    id: string;
    name: string;
    placeholder: string;
};

type AlignmentCell = {
    direction: 'diagonal' | 'left' | 'up' | null;
    score: number;
};

const typoSymbols = ['ﷺ', '﷽', 'ﷻ'];

const parseSections = (input: string): string[] => {
    return input
        .split(/\n-{3,}\n/)
        .map((section) => section.trim())
        .filter((section) => section.length > 0);
};

const ensureSections = (input: string, count: number): string[] => {
    const sections = parseSections(input);
    if (sections.length >= count) {
        return sections;
    }
    return [...sections, ...Array.from({ length: count - sections.length }, () => '')];
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
    return '';
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

const entries: DemoEntry[] = [
    {
        apply: (input) => {
            const [original, correction] = ensureSections(input, 2);
            return fixTypo(original, correction, { typoSymbols });
        },
        description:
            'Correct OCR typos by aligning original and reference text, preserving Arabic symbols and footnotes.',
        direction: 'rtl',
        helper: 'Provide original text and correction text separated by a line with ---.',
        id: 'fixTypo',
        name: 'fixTypo',
        placeholder: 'محمد صلى الله عليه وسلم رسول الله\n---\nمحمد ﷺ رسول الله',
    },
    {
        apply: (input) => {
            const [original, correction] = ensureSections(input, 2);
            return processTextAlignment(original, correction, {
                highSimilarityThreshold: 0.8,
                similarityThreshold: 0.6,
                typoSymbols,
            });
        },
        description: 'Run low-level alignment with full control over similarity thresholds and typo symbol handling.',
        direction: 'rtl',
        helper: 'Provide original text and reference text separated by a line with ---.',
        id: 'processTextAlignment',
        name: 'processTextAlignment',
        placeholder: 'النص الأصلي مع أخطاء إملائية\n---\nالنص الأصلي مع أخطاء إملائية',
    },
    {
        apply: (input) => {
            const [targetsRaw, segmentsRaw] = ensureSections(input, 2);
            return formatOutput(alignTextSegments(parseLines(targetsRaw), parseLines(segmentsRaw)));
        },
        description: 'Reconstruct split lines by finding the best segment order against target lines.',
        direction: 'rtl',
        helper: 'Provide target lines, then --- and the OCR segments.',
        id: 'alignTextSegments',
        name: 'alignTextSegments',
        placeholder:
            'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس\nوطاول البقلُ فروعَ الميْس وهبت العنز لقرع التيس\n---\nقد قُدِّم العَجْبُ على الرُّوَيس\nوشـارف الوهـدُ أبــا قُبيس\nوطاول البقلُ فروعَ الميْس\nوهبت العنـز لـقرع التـيس',
    },
    {
        apply: (input) => {
            const [pagesRaw, excerptsRaw] = ensureSections(input, 2);
            return formatOutput(findMatches(parseLines(pagesRaw), parseLines(excerptsRaw)));
        },
        description: 'Locate the best matching page for each excerpt using exact and fuzzy search.',
        direction: 'rtl',
        helper: 'Provide page texts, then --- and the excerpts to search for.',
        id: 'findMatches',
        name: 'findMatches',
        placeholder:
            'هذا النص في الصفحة الأولى مع محتوى إضافي\nالنص الثاني يظهر هنا في الصفحة الثانية\n---\nالنص في الصفحة الأولى\nالنص الثاني يظهر',
    },
    {
        apply: (input) => {
            const [pagesRaw, excerptsRaw] = ensureSections(input, 2);
            return formatOutput(findMatchesAll(parseLines(pagesRaw), parseLines(excerptsRaw)));
        },
        description: 'Return ranked lists of all pages that could match each excerpt.',
        direction: 'rtl',
        helper: 'Provide page texts, then --- and the excerpts to search for.',
        id: 'findMatchesAll',
        name: 'findMatchesAll',
        placeholder:
            'النص الأول مع محتوى مشابه\nمحتوى مشابه في النص الثاني\nالنص الأول بصيغة مختلفة قليلاً\n---\nالنص الأول',
    },
    {
        apply: (input) => sanitizeArabic(input, 'search'),
        description:
            'Clean Arabic text with presets for light display cleanup, search normalization, or aggressive indexing.',
        direction: 'rtl',
        helper: 'Uses the "search" preset to normalize the input.',
        id: 'sanitizeArabic',
        name: 'sanitizeArabic',
        placeholder: 'اَلسَّلَامُ عَلَيْكُمْ',
    },
    {
        apply: (input) => sanitizeAggressive(input),
        description: 'Build a reusable sanitizer function for fast repeated Arabic normalization.',
        direction: 'rtl',
        helper: 'Uses the "aggressive" preset for the formatter.',
        id: 'createArabicSanitizer',
        name: 'createArabicSanitizer',
        placeholder: 'اَلسَّلَامُ ١٤٤٥/٣/٢٩ هـ — www',
    },
    {
        apply: (input) => formatOutput(isArabicTextNoise(input.trim())),
        description: 'Detects OCR noise patterns in Arabic text such as artifacts and formatting lines.',
        direction: 'rtl',
        id: 'isArabicTextNoise',
        name: 'isArabicTextNoise',
        placeholder: '---',
    },
    {
        apply: (input) => formatOutput(formatCharacterStats(analyzeCharacterStats(input))),
        description: 'Break down character composition for Arabic, digits, punctuation, and symbols.',
        direction: 'rtl',
        id: 'analyzeCharacterStats',
        name: 'analyzeCharacterStats',
        placeholder: 'مرحبا 123!',
    },
    {
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(hasExcessiveRepetition(stats, input.length));
        },
        description: 'Flags lines with excessive repeated characters that often indicate noise.',
        id: 'hasExcessiveRepetition',
        name: 'hasExcessiveRepetition',
        placeholder: '!!!!!',
    },
    {
        apply: (input) => formatOutput(isBasicNoisePattern(input.trim())),
        description: 'Matches common OCR noise regex patterns like repeated dashes or dots.',
        id: 'isBasicNoisePattern',
        name: 'isBasicNoisePattern',
        placeholder: '---',
    },
    {
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(isNonArabicNoise(stats, input.length, input));
        },
        description: 'Applies heuristic rules to label non-Arabic input as noise or valid content.',
        id: 'isNonArabicNoise',
        name: 'isNonArabicNoise',
        placeholder: 'ABC',
    },
    {
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            const contentChars = stats.arabicCount + stats.latinCount + stats.digitCount;
            return formatOutput(isSpacingNoise(stats, contentChars, input.length));
        },
        description: 'Detects problematic spacing patterns in OCR output.',
        id: 'isSpacingNoise',
        name: 'isSpacingNoise',
        placeholder: ' a ',
    },
    {
        apply: (input) => {
            const stats = analyzeCharacterStats(input);
            return formatOutput(isValidArabicContent(stats, input.length));
        },
        description: 'Checks whether Arabic text is substantial enough to be considered meaningful.',
        direction: 'rtl',
        id: 'isValidArabicContent',
        name: 'isValidArabicContent',
        placeholder: 'السلام عليكم',
    },
    {
        apply: (input) => formatOutput(hasInvalidFootnotes(input)),
        description: 'Detects empty or OCR-corrupted footnote references like "()" or "(O)".',
        direction: 'rtl',
        id: 'hasInvalidFootnotes',
        name: 'hasInvalidFootnotes',
        placeholder: 'النص (O) مع الحواشي',
    },
    {
        apply: (input) => {
            const corrected = correctReferences(parseFootnoteLines(input));
            return corrected.map((line) => `${line.isFootnote ? 'FN: ' : ''}${line.text}`).join('\n');
        },
        description: 'Normalizes footnote references across body text and footnote lines.',
        direction: 'rtl',
        helper: 'Prefix footnote lines with "FN:". Body lines are left unprefixed.',
        id: 'correctReferences',
        name: 'correctReferences',
        placeholder: 'النص (O) مع الحواشي\nFN: (1) أخرجه البخاري\nFN: () رواه مسلم',
    },
    {
        apply: (input) => formatOutput(checkBalance(input)),
        description: 'Reports detailed quote and bracket balance errors.',
        id: 'checkBalance',
        name: 'checkBalance',
        placeholder: 'Hello "world" and (test)',
    },
    {
        apply: (input) => formatOutput(getUnbalancedErrors(input)),
        description: 'Gets absolute character positions for unbalanced quotes and brackets.',
        id: 'getUnbalancedErrors',
        name: 'getUnbalancedErrors',
        placeholder: 'First line with "quote\nSecond line with (bracket',
    },
    {
        apply: (input) => formatOutput(areQuotesBalanced(input)),
        description: 'Checks if a string has balanced double quotes.',
        id: 'areQuotesBalanced',
        name: 'areQuotesBalanced',
        placeholder: 'Hello "world"',
    },
    {
        apply: (input) => formatOutput(areBracketsBalanced(input)),
        description: 'Checks if brackets are correctly opened and closed.',
        id: 'areBracketsBalanced',
        name: 'areBracketsBalanced',
        placeholder: '(hello [world])',
    },
    {
        apply: (input) => formatOutput(isBalanced(input)),
        description: 'Returns true only if both quotes and brackets are balanced.',
        id: 'isBalanced',
        name: 'isBalanced',
        placeholder: 'Hello "world" and (test)',
    },
    {
        apply: (input) => extractDigits(input),
        description: 'Extracts digits from mixed text for downstream cleanup tasks.',
        direction: 'rtl',
        id: 'extractDigits',
        name: 'extractDigits',
        placeholder: 'عام 1445 هـ، الصفحة 12',
    },
    {
        apply: (input) => formatOutput(tokenizeText(input, typoSymbols)),
        description: 'Splits text into tokens while preserving special symbols.',
        direction: 'rtl',
        id: 'tokenizeText',
        name: 'tokenizeText',
        placeholder: 'محمد ﷺ رسول الله',
    },
    {
        apply: (input) => {
            const [resultRaw, previousToken, currentToken] = ensureSections(input, 3);
            const resultTokens = parseTokens(resultRaw);
            return formatOutput(handleFootnoteFusion(resultTokens, previousToken, currentToken));
        },
        description: 'Merges consecutive footnote tokens when appropriate.',
        direction: 'rtl',
        helper: 'Provide existing tokens, then --- previous token, then --- current token.',
        id: 'handleFootnoteFusion',
        name: 'handleFootnoteFusion',
        placeholder: 'النص (١)\n---\n(١)\n---\nأخرجه',
    },
    {
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(handleFootnoteSelection(tokenA, tokenB));
        },
        description: 'Selects the best token when one token contains a footnote reference.',
        direction: 'rtl',
        helper: 'Provide token A, then --- and token B.',
        id: 'handleFootnoteSelection',
        name: 'handleFootnoteSelection',
        placeholder: '(١) النص\n---\nالنص (١)',
    },
    {
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(handleStandaloneFootnotes(tokenA, tokenB));
        },
        description: 'Combines standalone footnote markers with surrounding tokens.',
        direction: 'rtl',
        helper: 'Provide token A, then --- and token B.',
        id: 'handleStandaloneFootnotes',
        name: 'handleStandaloneFootnotes',
        placeholder: '(١)\n---\nالنص',
    },
    {
        apply: (input) => removeFootnoteReferencesSimple(input),
        description: 'Strips basic footnote references from text.',
        direction: 'rtl',
        id: 'removeFootnoteReferencesSimple',
        name: 'removeFootnoteReferencesSimple',
        placeholder: 'النص (١) مع الحواشي',
    },
    {
        apply: (input) => removeSingleDigitFootnoteReferences(input),
        description: 'Removes single-digit footnote markers while preserving other numbers.',
        direction: 'rtl',
        id: 'removeSingleDigitFootnoteReferences',
        name: 'removeSingleDigitFootnoteReferences',
        placeholder: 'النص (٢) في الصفحة 12',
    },
    {
        apply: (input) => standardizeHijriSymbol(input),
        description: 'Normalizes standalone ه to هـ after digits in Hijri dates.',
        direction: 'rtl',
        id: 'standardizeHijriSymbol',
        name: 'standardizeHijriSymbol',
        placeholder: 'سنة 1445 ه',
    },
    {
        apply: (input) => standardizeIntahaSymbol(input),
        description: 'Standardizes standalone اه to اهـ in historical abbreviations.',
        direction: 'rtl',
        id: 'standardizeIntahaSymbol',
        name: 'standardizeIntahaSymbol',
        placeholder: 'سنة 1445 اه',
    },
    {
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(calculateSimilarity(textA, textB));
        },
        description: 'Returns a similarity ratio between two strings.',
        helper: 'Provide text A, then --- and text B.',
        id: 'calculateSimilarity',
        name: 'calculateSimilarity',
        placeholder: 'hello\n---\nhelo',
    },
    {
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(areSimilarAfterNormalization(textA, textB, 0.6));
        },
        description: 'Checks similarity after Arabic normalization.',
        direction: 'rtl',
        helper: 'Provide text A, then --- and text B.',
        id: 'areSimilarAfterNormalization',
        name: 'areSimilarAfterNormalization',
        placeholder: 'السَّلام\n---\nالسلام',
    },
    {
        apply: (input) => {
            const [tokenA, tokenB] = ensureSections(input, 2);
            return formatOutput(calculateAlignmentScore(tokenA, tokenB, typoSymbols, 0.6));
        },
        description: 'Scores two tokens for sequence alignment.',
        direction: 'rtl',
        helper: 'Provide token A, then --- and token B.',
        id: 'calculateAlignmentScore',
        name: 'calculateAlignmentScore',
        placeholder: 'محمد\n---\nمحمد',
    },
    {
        apply: (input) => {
            const [tokensA, tokensB] = ensureSections(input, 2);
            return formatOutput(alignTokenSequences(parseTokens(tokensA), parseTokens(tokensB), typoSymbols, 0.6));
        },
        description: 'Runs Needleman-Wunsch alignment on two token sequences.',
        direction: 'rtl',
        helper: 'Provide token sequence A, then --- and sequence B.',
        id: 'alignTokenSequences',
        name: 'alignTokenSequences',
        placeholder: 'محمد رسول\n---\nمحمد ﷺ رسول',
    },
    {
        apply: (input) => {
            const [tokensA, tokensB] = ensureSections(input, 2);
            const tokensLeft = parseTokens(tokensA);
            const tokensRight = parseTokens(tokensB);
            const matrix = buildAlignmentMatrix(tokensLeft, tokensRight, typoSymbols, 0.6);
            return formatOutput(backtrackAlignment(matrix, tokensLeft, tokensRight));
        },
        description: 'Reconstructs aligned token pairs from a scoring matrix.',
        direction: 'rtl',
        helper: 'Provide token sequence A, then --- and sequence B.',
        id: 'backtrackAlignment',
        name: 'backtrackAlignment',
        placeholder: 'محمد رسول\n---\nمحمد ﷺ رسول',
    },
    {
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(calculateLevenshteinDistance(textA, textB));
        },
        description: 'Returns the raw edit distance between two strings.',
        helper: 'Provide text A, then --- and text B.',
        id: 'calculateLevenshteinDistance',
        name: 'calculateLevenshteinDistance',
        placeholder: 'kitten\n---\nsitting',
    },
    {
        apply: (input) => {
            const [textA, textB] = ensureSections(input, 2);
            return formatOutput(boundedLevenshtein(textA, textB, 3));
        },
        description: 'Computes edit distance with a maximum cutoff.',
        helper: 'Provide text A, then --- and text B. Uses a max distance of 3.',
        id: 'boundedLevenshtein',
        name: 'boundedLevenshtein',
        placeholder: 'kitten\n---\nsitting',
    },
];

const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());

function App() {
    const [selectedId, setSelectedId] = createSignal(uniqueEntries[0]?.id ?? '');
    const [textValue, setTextValue] = createSignal(uniqueEntries[0]?.placeholder ?? '');
    const [errorMessage, setErrorMessage] = createSignal('');

    const selectedEntry = createMemo(() => uniqueEntries.find((entry) => entry.id === selectedId()));

    const handleSelect = (entry: DemoEntry) => {
        setSelectedId(entry.id);
        setTextValue(entry.placeholder);
        setErrorMessage('');
    };

    const handleFormat = () => {
        const entry = selectedEntry();
        if (!entry) {
            return;
        }
        try {
            const result = entry.apply(textValue());
            setTextValue(result);
            setErrorMessage('');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
        }
    };

    const libraryVersion = demoPackage.dependencies?.baburchi ?? 'unknown';
    const author = rootPackage.author ?? 'Unknown author';

    return (
        <div class="app-shell">
            <aside class="sidebar">
                <div class="sidebar__header">
                    <p class="sidebar__eyebrow">baburchi demo</p>
                    <h2 class="sidebar__title">Function explorer</h2>
                    <p class="sidebar__subtitle">Browse every export and see instant formatting results.</p>
                </div>
                <nav class="sidebar__nav">
                    <For each={uniqueEntries}>
                        {(entry) => (
                            <button
                                class="sidebar__item"
                                classList={{ 'sidebar__item--active': entry.id === selectedId() }}
                                onClick={() => handleSelect(entry)}
                                type="button"
                            >
                                <span class="sidebar__item-name">{entry.name}</span>
                                <span class="sidebar__item-desc">{entry.description}</span>
                            </button>
                        )}
                    </For>
                </nav>
            </aside>

            <main class="main">
                <header class="hero">
                    <p class="hero__eyebrow">OCR post-processing toolkit</p>
                    <h1 class="hero__title">Baburchi: Arabic-first OCR repair, alignment, and noise detection.</h1>
                    <p class="hero__subtitle">
                        Baburchi is a lightweight TypeScript library designed to fix OCR typos, normalize Arabic text,
                        and surface noisy artifacts using alignment algorithms, configurable sanitizers, and rich text
                        utilities.
                    </p>
                    <p class="hero__meta">Maintained by {author}.</p>
                </header>

                <section class="panel">
                    <div class="panel__header">
                        <div>
                            <h2 class="panel__title">{selectedEntry()?.name}</h2>
                            <p class="panel__description">{selectedEntry()?.description}</p>
                        </div>
                        <button class="action-button" onClick={handleFormat} type="button">
                            Format
                        </button>
                    </div>

                    <Show when={selectedEntry()?.helper}>
                        <p class="panel__helper">{selectedEntry()?.helper}</p>
                    </Show>

                    <textarea
                        class="panel__textarea"
                        dir={selectedEntry()?.direction ?? 'ltr'}
                        value={textValue()}
                        onInput={(event) => setTextValue(event.currentTarget.value)}
                    />

                    <Show when={errorMessage()}>
                        <p class="panel__error">{errorMessage()}</p>
                    </Show>
                </section>

                <footer class="footer">
                    <div class="footer__content">
                        <span>baburchi version: {libraryVersion}</span>
                        <span>Author: {author}</span>
                    </div>
                    <span class="footer__note">Deployed at https://baburchi.surge.sh</span>
                </footer>
            </main>
        </div>
    );
}

export default App;
