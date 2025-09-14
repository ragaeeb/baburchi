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
 * Returns `true` if the code point is ASCII space.
 */
const isAsciiSpace = (code: number): boolean => code === 32;

/**
 * Returns `true` if the code point is a Western digit or Arabic-Indic digit.
 */
const isDigitCodePoint = (code: number): boolean => (code >= 48 && code <= 57) || (code >= 0x0660 && code <= 0x0669);

/**
 * Removes tatweel while preserving a tatweel that immediately follows a digit or 'ه'.
 * This protects list markers and Hijri date forms.
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
 */
const removeHijriDateMarker = (s: string): string =>
    s.replace(/([0-9\u0660-\u0669][0-9\u0660-\u0669/\-\s]*?)\s*ه(?:ـ)?(?=(?:\s|$|[^\p{L}\p{N}]))/gu, '$1');

/**
 * Applies NFC normalization if available and requested.
 */
const applyNfcNormalization = (s: string, enable: boolean): string => (enable && s.normalize ? s.normalize('NFC') : s);

/**
 * Removes zero-width controls, optionally replacing them with spaces.
 */
const removeZeroWidthControls = (s: string, enable: boolean, asSpace: boolean): string =>
    enable ? s.replace(RX_ZERO_WIDTH, asSpace ? ' ' : '') : s;

/**
 * Removes diacritics and tatweel according to the selected mode.
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
 */
const removeLatinAndSymbolNoise = (s: string, enable: boolean): string =>
    enable ? s.replace(RX_LATIN_AND_SYMBOLS, ' ') : s;

/**
 * Applies letter filters:
 * - `lettersAndSpacesOnly`: keep Arabic letters and whitespace, drop everything else to spaces.
 * - `lettersOnly`: keep only Arabic letters, drop everything else.
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
 */
const resolveBoolean = (presetValue: boolean, override?: boolean): boolean =>
    override === undefined ? presetValue : !!override;

/**
 * Resolves the tatweel mode by taking an optional override over a preset mode.
 * An override of `true` maps to `'safe'` for convenience.
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
    light: {
        nfc: true,
        stripZeroWidth: true,
        zeroWidthToSpace: false,
        stripDiacritics: false,
        stripTatweel: false,
        normalizeAlif: false,
        replaceAlifMaqsurah: false,
        replaceTaMarbutahWithHa: false,
        stripLatinAndSymbols: false,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: false,
        collapseWhitespace: true,
        trim: true,
        removeHijriMarker: false,
    },
    search: {
        nfc: true,
        stripZeroWidth: true,
        zeroWidthToSpace: false,
        stripDiacritics: true,
        stripTatweel: 'all',
        normalizeAlif: true,
        replaceAlifMaqsurah: true,
        replaceTaMarbutahWithHa: false,
        stripLatinAndSymbols: false,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: false,
        collapseWhitespace: true,
        trim: true,
        removeHijriMarker: true,
    },
    aggressive: {
        nfc: true,
        stripZeroWidth: true,
        zeroWidthToSpace: false,
        stripDiacritics: true,
        stripTatweel: 'all',
        normalizeAlif: true,
        replaceAlifMaqsurah: true,
        replaceTaMarbutahWithHa: true,
        stripLatinAndSymbols: true,
        keepOnlyArabicLetters: false,
        lettersAndSpacesOnly: true,
        collapseWhitespace: true,
        trim: true,
        removeHijriMarker: true,
    },
} as const;

const PRESET_NONE: PresetOptions = {
    nfc: false,
    stripZeroWidth: false,
    zeroWidthToSpace: false,
    stripDiacritics: false,
    stripTatweel: false,
    normalizeAlif: false,
    replaceAlifMaqsurah: false,
    replaceTaMarbutahWithHa: false,
    stripLatinAndSymbols: false,
    keepOnlyArabicLetters: false,
    lettersAndSpacesOnly: false,
    collapseWhitespace: false,
    trim: false,
    removeHijriMarker: false,
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

    if (!lettersSpacesOnly) {
        s = removeLatinAndSymbolNoise(s, stripNoise);
    }
    s = applyLetterFilters(s, lettersSpacesOnly, lettersOnly);

    s = normalizeWhitespace(s, collapseWS, doTrim);

    return s;
};

/** Character class for Arabic diacritics (tashkīl/harakāt). */
const DIACRITICS_CLASS = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]';
/** Tatweel (kashīda) class. */
const TATWEEL_CLASS = '\\u0640';

/**
 * Escape a string so it can be safely embedded into a RegExp source.
 *
 * @param s Any string
 * @returns Escaped string
 */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Optional equivalence toggles for {@link makeDiacriticInsensitiveRegex}. */
type EquivOptions = {
    /** Treat ا/أ/إ/آ as equivalent. @default true */
    alif?: boolean;
    /** Treat ة/ه as equivalent. @default true */
    taMarbutahHa?: boolean;
    /** Treat ى/ي as equivalent. @default true */
    alifMaqsurahYa?: boolean;
};

/** Options for {@link makeDiacriticInsensitiveRegex}. */
export type MakeRegexOptions = {
    /**
     * Character equivalences to allow.
     * @default { alif: true, taMarbutahHa: true, alifMaqsurahYa: true }
     */
    equivalences?: EquivOptions;

    /**
     * Allow tatweel between letters (tolerate decorative elongation).
     * @default true
     */
    allowTatweel?: boolean;

    /**
     * Ignore diacritics by inserting a `DIACRITICS_CLASS*` after each letter.
     * @default true
     */
    ignoreDiacritics?: boolean;

    /**
     * Treat any whitespace in the needle as `\s+` for flexible matching.
     * @default true
     */
    flexWhitespace?: boolean;

    /**
     * RegExp flags to use.
     * @default 'u'
     */
    flags?: string;
};

/**
 * Build a **diacritic-insensitive**, **tatweel-tolerant** RegExp for Arabic text matching.
 *
 * Features:
 * - Optional character equivalences: ا~أ~إ~آ, ة~ه, ى~ي.
 * - Optional tolerance for tatweel between characters.
 * - Optional diacritic-insensitivity (by inserting a diacritics class after each char).
 * - Optional flexible whitespace (needle whitespace becomes `\s+`).
 *
 * @param needle The Arabic text to match
 * @param opts See {@link MakeRegexOptions}
 * @returns A `RegExp` matching the needle with the desired tolerances
 *
 * @example
 * const rx = makeDiacriticInsensitiveRegex('أنا إلى الآفاق');
 * rx.test('انا الي الافاق'); // true
 * rx.test('اَنا إلى الآفاق'); // true
 */
export const makeDiacriticInsensitiveRegex = (needle: string, opts: MakeRegexOptions = {}): RegExp => {
    const {
        equivalences = { alif: true, taMarbutahHa: true, alifMaqsurahYa: true },
        allowTatweel = true,
        ignoreDiacritics = true,
        flexWhitespace = true,
        flags = 'u',
    } = opts;

    // Safety guard against extremely large inputs causing excessive pattern sizes
    if (needle.length > 5000) {
        throw new Error('makeDiacriticInsensitiveRegex: needle too long');
    }

    const charClass = (ch: string): string => {
        switch (ch) {
            case 'ا':
            case 'أ':
            case 'إ':
            case 'آ':
                return equivalences.alif ? '[اأإآ]' : 'ا';
            case 'ة':
            case 'ه':
                return equivalences.taMarbutahHa ? '[هة]' : escapeRegex(ch);
            case 'ى':
            case 'ي':
                return equivalences.alifMaqsurahYa ? '[ىي]' : escapeRegex(ch);
            default:
                return escapeRegex(ch);
        }
    };

    const after = `${ignoreDiacritics ? `${DIACRITICS_CLASS}*` : ''}${allowTatweel ? `${TATWEEL_CLASS}*` : ''}`;

    let pattern = '';
    for (const ch of Array.from(needle)) {
        if (/\s/.test(ch)) {
            pattern += flexWhitespace ? '\\s+' : '\\s*';
        } else {
            pattern += `${charClass(ch)}${after}`;
        }
    }

    return new RegExp(pattern, flags);
};
