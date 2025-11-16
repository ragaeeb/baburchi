import { removeFootnoteReferencesSimple, removeSingleDigitFootnoteReferences } from './textUtils';

/**
 * Ultra-fast Arabic text sanitizer for search/indexing/display.
 * Optimized for very high call rates: avoids per-call object spreads and minimizes allocations.
 * Options can merge over a base preset or `'none'` to apply exactly the rules you request.
 */
export type SanitizePreset = 'light' | 'search' | 'aggressive';
export type SanitizeBase = 'none' | SanitizePreset;

/**
 * Public options for {@link sanitizeArabic}. When you pass an options object, it overlays the chosen
 * `base` (default `'light'`) without allocating merged objects on the hot path; flags are resolved
 * directly into local booleans for speed.
 */
export type SanitizeOptions = {
    /** Base to merge over. `'none'` applies only the options you specify. Default when passing an object: `'light'`. */
    base?: SanitizeBase;

    /** Unicode NFC normalization. Default: `true` in all presets. */
    nfc?: boolean;

    /** Strip zero-width controls (U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+FEFF). Default: `true` in presets. */
    stripZeroWidth?: boolean;

    /** If stripping zero-width, replace them with a space instead of removing. Default: `false`. */
    zeroWidthToSpace?: boolean;

    /** Remove Arabic diacritics (tashkīl). Default: `true` in `'search'`/`'aggressive'`. */
    stripDiacritics?: boolean;

    /** Remove footnote references. Default: `true` in `'search'`/`'aggressive'`. */
    stripFootnotes?: boolean;

    /**
     * Remove tatweel (ـ).
     * - `true` is treated as `'safe'` (preserves tatweel after digits or 'ه' for dates/list markers)
     * - `'safe'` or `'all'` explicitly
     * - `false` to keep tatweel
     * Default: `'all'` in `'search'`/`'aggressive'`, `false` in `'light'`.
     */
    stripTatweel?: boolean | 'safe' | 'all';

    /** Normalize آ/أ/إ → ا. Default: `true` in `'search'`/`'aggressive'`. */
    normalizeAlif?: boolean;

    /** Replace ى → ي. Default: `true` in `'search'`/`'aggressive'`. */
    replaceAlifMaqsurah?: boolean;

    /** Replace ة → ه (lossy). Default: `true` in `'aggressive'` only. */
    replaceTaMarbutahWithHa?: boolean;

    /** Strip Latin letters/digits and common OCR noise into spaces. Default: `true` in `'aggressive'`. */
    stripLatinAndSymbols?: boolean;

    /** Keep only Arabic letters (no whitespace). Use for compact keys, not FTS. */
    keepOnlyArabicLetters?: boolean;

    /** Keep Arabic letters + spaces (drops digits/punct/symbols). Great for FTS. Default: `true` in `'aggressive'`. */
    lettersAndSpacesOnly?: boolean;

    /** Collapse runs of whitespace to a single space. Default: `true`. */
    collapseWhitespace?: boolean;

    /** Trim leading/trailing whitespace. Default: `true`. */
    trim?: boolean;

    /**
     * Remove the Hijri date marker ("هـ" or bare "ه" if tatweel already removed) when it follows a date-like token
     * (digits/slashes/hyphens/spaces). Example: `1435/3/29 هـ` → `1435/3/29`.
     * Default: `true` in `'search'`/`'aggressive'`, `false` in `'light'`.
     */
    removeHijriMarker?: boolean;
};

/** Fully-resolved internal preset options (no `base`, and tatweel as a mode). */
type PresetOptions = {
    nfc: boolean;
    stripZeroWidth: boolean;
    zeroWidthToSpace: boolean;
    stripDiacritics: boolean;
    stripFootnotes: boolean;
    stripTatweel: false | 'safe' | 'all';
    normalizeAlif: boolean;
    replaceAlifMaqsurah: boolean;
    replaceTaMarbutahWithHa: boolean;
    stripLatinAndSymbols: boolean;
    keepOnlyArabicLetters: boolean;
    lettersAndSpacesOnly: boolean;
    collapseWhitespace: boolean;
    trim: boolean;
    removeHijriMarker: boolean;
};

const RX_SPACES = /\s+/g;
const RX_TATWEEL = /\u0640/g;
const RX_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const RX_ALIF_VARIANTS = /[أإآٱ]/g;
const RX_ALIF_MAQSURAH = /\u0649/g;
const RX_TA_MARBUTAH = /\u0629/g;
const RX_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const RX_LATIN_AND_SYMBOLS = /[A-Za-z]+[0-9]*|[0-9]+|[¬§`=]|[/]{2,}|[&]|[ﷺ]/g;
const RX_NON_ARABIC_LETTERS = /[^\u0621-\u063A\u0641-\u064A\u0671\u067E\u0686\u06A4-\u06AF\u06CC\u06D2\u06D3]/g;
const RX_NOT_LETTERS_OR_SPACE = /[^\u0621-\u063A\u0641-\u064A\u0671\u067E\u0686\u06A4-\u06AF\u06CC\u06D2\u06D3\s]/g;

/**
 * Checks whether a code point represents the ASCII space character.
 *
 * @param code - The numeric code point to evaluate.
 * @returns True when the code point is the ASCII space character.
 */
const isAsciiSpace = (code: number): boolean => code === 32;

/**
 * Checks whether a code point represents a Western or Arabic-Indic digit.
 *
 * @param code - The numeric code point to evaluate.
 * @returns True when the code point is a digit in either numeral system.
 */
const isDigitCodePoint = (code: number): boolean => (code >= 48 && code <= 57) || (code >= 0x0660 && code <= 0x0669);

/**
 * Removes tatweel while preserving a tatweel that immediately follows a digit or 'ه'.
 * This protects list markers and Hijri date forms.
 *
 * @param s - The string to sanitize.
 * @returns The sanitized string with only safe tatweel removed.
 */
const removeTatweelSafely = (s: string): string =>
    s.replace(RX_TATWEEL, (_m, i: number, str: string) => {
        let j = i - 1;
        while (j >= 0 && isAsciiSpace(str.charCodeAt(j))) {
            j--;
        }
        if (j >= 0) {
            const prev = str.charCodeAt(j);
            if (isDigitCodePoint(prev) || prev === 0x0647) {
                return 'ـ';
            }
        }
        return '';
    });

/**
 * Removes the Hijri date marker when it immediately follows a date-like token.
 *
 * @param s - The string to sanitize.
 * @returns The string without redundant Hijri markers.
 */
const removeHijriDateMarker = (s: string): string =>
    s.replace(/([0-9\u0660-\u0669][0-9\u0660-\u0669/\-\s]*?)\s*ه(?:ـ)?(?=(?:\s|$|[^\p{L}\p{N}]))/gu, '$1');

/**
 * Applies NFC normalization if available and requested.
 *
 * @param s - The string to normalize.
 * @param enable - Flag indicating whether normalization should be applied.
 * @returns The normalized string when enabled; otherwise the original string.
 */
const applyNfcNormalization = (s: string, enable: boolean): string => (enable && s.normalize ? s.normalize('NFC') : s);

/**
 * Removes zero-width controls, optionally replacing them with spaces.
 *
 * @param s - The input string to process.
 * @param enable - Whether zero-width characters should be removed.
 * @param asSpace - When true, replaces zero-width characters with spaces instead of deleting them.
 * @returns The updated string with zero-width characters handled.
 */
const removeZeroWidthControls = (s: string, enable: boolean, asSpace: boolean): string =>
    enable ? s.replace(RX_ZERO_WIDTH, asSpace ? ' ' : '') : s;

/**
 * Removes diacritics and tatweel according to the selected mode.
 *
 * @param s - The string to sanitize.
 * @param removeDiacritics - Whether diacritics should be stripped.
 * @param tatweelMode - Mode describing how tatweel characters should be handled.
 * @returns The sanitized string after diacritic and tatweel processing.
 */
const removeDiacriticsAndTatweel = (
    s: string,
    removeDiacritics: boolean,
    tatweelMode: false | 'safe' | 'all',
): string => {
    if (removeDiacritics) {
        s = s.replace(RX_DIACRITICS, '');
    }
    if (tatweelMode === 'safe') {
        return removeTatweelSafely(s);
    }
    if (tatweelMode === 'all') {
        return s.replace(RX_TATWEEL, '');
    }
    return s;
};

/**
 * Applies canonical character mappings: Alif variants, alif maqṣūrah, tāʾ marbūṭa.
 *
 * @param s - The string to normalize.
 * @param normalizeAlif - Whether to normalize different Alif forms to bare Alif.
 * @param maqsurahToYa - Whether to convert alif maqṣūrah to yāʾ.
 * @param taMarbutahToHa - Whether to convert tāʾ marbūṭa to hāʾ.
 * @returns The string after applying character mappings.
 */
const applyCharacterMappings = (
    s: string,
    normalizeAlif: boolean,
    maqsurahToYa: boolean,
    taMarbutahToHa: boolean,
): string => {
    if (normalizeAlif) {
        s = s.replace(RX_ALIF_VARIANTS, 'ا');
    }
    if (maqsurahToYa) {
        s = s.replace(RX_ALIF_MAQSURAH, 'ي');
    }
    if (taMarbutahToHa) {
        s = s.replace(RX_TA_MARBUTAH, 'ه');
    }
    return s;
};

/**
 * Removes Latin letters/digits and common OCR noise by converting them to spaces.
 *
 * @param s - The string to sanitize.
 * @param enable - Whether to strip the noisy characters.
 * @returns The sanitized string with noise removed when enabled.
 */
const removeLatinAndSymbolNoise = (s: string, enable: boolean): string =>
    enable ? s.replace(RX_LATIN_AND_SYMBOLS, ' ') : s;

/**
 * Applies letter filters:
 * - `lettersAndSpacesOnly`: keep Arabic letters and whitespace, drop everything else to spaces.
 * - `lettersOnly`: keep only Arabic letters, drop everything else.
 *
 * @param s - The string to filter.
 * @param lettersAndSpacesOnly - When true, retains Arabic letters and spaces only.
 * @param lettersOnly - When true, retains Arabic letters exclusively.
 * @returns The filtered string according to the provided flags.
 */
const applyLetterFilters = (s: string, lettersAndSpacesOnly: boolean, lettersOnly: boolean): string => {
    if (lettersAndSpacesOnly) {
        return s.replace(RX_NOT_LETTERS_OR_SPACE, ' ');
    }
    if (lettersOnly) {
        return s.replace(RX_NON_ARABIC_LETTERS, '');
    }
    return s;
};

/**
 * Collapses whitespace runs and trims if requested.
 *
 * @param s - The string to normalize.
 * @param collapse - Whether to collapse consecutive whitespace into single spaces.
 * @param doTrim - Whether to trim leading and trailing whitespace.
 * @returns The normalized string with whitespace adjustments applied.
 */
const normalizeWhitespace = (s: string, collapse: boolean, doTrim: boolean): string => {
    if (collapse) {
        s = s.replace(RX_SPACES, ' ');
    }
    if (doTrim) {
        s = s.trim();
    }
    return s;
};

/**
 * Resolves a boolean by taking an optional override over a preset value.
 *
 * @param presetValue - The value defined by the preset.
 * @param override - Optional override provided by the caller.
 * @returns The resolved boolean value.
 */
const resolveBoolean = (presetValue: boolean, override?: boolean): boolean =>
    override === undefined ? presetValue : !!override;

/**
 * Resolves the tatweel mode by taking an optional override over a preset mode.
 * An override of `true` maps to `'safe'` for convenience.
 *
 * @param presetValue - The mode specified by the preset.
 * @param override - Optional override provided by the caller.
 * @returns The resolved tatweel mode.
 */
const resolveTatweelMode = (
    presetValue: false | 'safe' | 'all',
    override?: boolean | 'safe' | 'all',
): false | 'safe' | 'all' => {
    if (override === undefined) {
        return presetValue;
    }
    if (override === true) {
        return 'safe';
    }
    if (override === false) {
        return false;
    }
    return override;
};

const PRESETS: Record<SanitizePreset, PresetOptions> = {
    aggressive: {
        collapseWhitespace: true,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: true,
        nfc: true,
        normalizeAlif: true,
        removeHijriMarker: true,
        replaceAlifMaqsurah: true,
        replaceTaMarbutahWithHa: true,
        stripDiacritics: true,
        stripFootnotes: true,
        stripLatinAndSymbols: true,
        stripTatweel: 'all',
        stripZeroWidth: true,
        trim: true,
        zeroWidthToSpace: false,
    },
    light: {
        collapseWhitespace: true,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: false,
        nfc: true,
        normalizeAlif: false,
        removeHijriMarker: false,
        replaceAlifMaqsurah: false,
        replaceTaMarbutahWithHa: false,
        stripDiacritics: false,
        stripFootnotes: false,
        stripLatinAndSymbols: false,
        stripTatweel: false,
        stripZeroWidth: true,
        trim: true,
        zeroWidthToSpace: false,
    },
    search: {
        collapseWhitespace: true,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: false,
        nfc: true,
        normalizeAlif: true,
        removeHijriMarker: true,
        replaceAlifMaqsurah: true,
        replaceTaMarbutahWithHa: false,
        stripDiacritics: true,
        stripFootnotes: true,
        stripLatinAndSymbols: false,
        stripTatweel: 'all',
        stripZeroWidth: true,
        trim: true,
        zeroWidthToSpace: false,
    },
} as const;

const PRESET_NONE: PresetOptions = {
    collapseWhitespace: false,
    keepOnlyArabicLetters: false,
    lettersAndSpacesOnly: false,
    nfc: false,
    normalizeAlif: false,
    removeHijriMarker: false,
    replaceAlifMaqsurah: false,
    replaceTaMarbutahWithHa: false,
    stripDiacritics: false,
    stripFootnotes: false,
    stripLatinAndSymbols: false,
    stripTatweel: false,
    stripZeroWidth: false,
    trim: false,
    zeroWidthToSpace: false,
};

/**
 * Sanitizes Arabic text according to a preset or custom options.
 *
 * Presets:
 * - `'light'`: NFC, zero-width removal, collapse/trim spaces.
 * - `'search'`: removes diacritics and tatweel, normalizes Alif and ى→ي, removes Hijri marker.
 * - `'aggressive'`: ideal for FTS; keeps letters+spaces only and strips common noise.
 *
 * Custom options:
 * - Passing an options object overlays the selected `base` preset (default `'light'`).
 * - Use `base: 'none'` to apply **only** the rules you specify (e.g., tatweel only).
 *
 * Examples:
 * ```ts
 * sanitizeArabic('أبـــتِـــكَةُ', { base: 'none', stripTatweel: true }); // 'أبتِكَةُ'
 * sanitizeArabic('1435/3/29 هـ', 'aggressive'); // '1435 3 29'
 * sanitizeArabic('اَلسَّلَامُ عَلَيْكُمْ', 'search'); // 'السلام عليكم'
 * ```
 */
export const sanitizeArabic = (input: string, optionsOrPreset: SanitizePreset | SanitizeOptions = 'search'): string => {
    if (!input) {
        return '';
    }

    let preset: PresetOptions;
    let opts: SanitizeOptions | null = null;

    if (typeof optionsOrPreset === 'string') {
        preset = PRESETS[optionsOrPreset];
    } else {
        const base = optionsOrPreset.base ?? 'light';
        preset = base === 'none' ? PRESET_NONE : PRESETS[base];
        opts = optionsOrPreset;
    }

    const nfc = resolveBoolean(preset.nfc, opts?.nfc);
    const stripZW = resolveBoolean(preset.stripZeroWidth, opts?.stripZeroWidth);
    const zwAsSpace = resolveBoolean(preset.zeroWidthToSpace, opts?.zeroWidthToSpace);
    const removeDia = resolveBoolean(preset.stripDiacritics, opts?.stripDiacritics);
    const removeFootnotes = resolveBoolean(preset.stripFootnotes, opts?.stripFootnotes);
    const normAlif = resolveBoolean(preset.normalizeAlif, opts?.normalizeAlif);
    const maqToYa = resolveBoolean(preset.replaceAlifMaqsurah, opts?.replaceAlifMaqsurah);
    const taToHa = resolveBoolean(preset.replaceTaMarbutahWithHa, opts?.replaceTaMarbutahWithHa);
    const stripNoise = resolveBoolean(preset.stripLatinAndSymbols, opts?.stripLatinAndSymbols);
    const lettersSpacesOnly = resolveBoolean(preset.lettersAndSpacesOnly, opts?.lettersAndSpacesOnly);
    const lettersOnly = resolveBoolean(preset.keepOnlyArabicLetters, opts?.keepOnlyArabicLetters);
    const collapseWS = resolveBoolean(preset.collapseWhitespace, opts?.collapseWhitespace);
    const doTrim = resolveBoolean(preset.trim, opts?.trim);
    const removeHijri = resolveBoolean(preset.removeHijriMarker, opts?.removeHijriMarker);
    const tatweelMode = resolveTatweelMode(preset.stripTatweel, opts?.stripTatweel);

    let s = input;
    s = applyNfcNormalization(s, nfc);
    s = removeZeroWidthControls(s, stripZW, zwAsSpace);
    if (removeHijri) {
        s = removeHijriDateMarker(s);
    }
    s = removeDiacriticsAndTatweel(s, removeDia, tatweelMode);
    s = applyCharacterMappings(s, normAlif, maqToYa, taToHa);

    if (removeFootnotes) {
        s = removeFootnoteReferencesSimple(s);
        s = removeSingleDigitFootnoteReferences(s);
    }

    if (!lettersSpacesOnly) {
        s = removeLatinAndSymbolNoise(s, stripNoise);
    }
    s = applyLetterFilters(s, lettersSpacesOnly, lettersOnly);

    s = normalizeWhitespace(s, collapseWS, doTrim);

    return s;
};
