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

    /**
     * NFC normalization (fast-path).
     *
     * For performance, this sanitizer avoids calling `String.prototype.normalize('NFC')` and instead
     * applies the key Arabic canonical compositions inline (hamza/madda combining marks).
     * This preserves the NFC behavior that matters for typical Arabic OCR text while keeping throughput high.
     *
     * Default: `true` in all presets.
     */
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

/** Fully-resolved internal options with short names for performance. */
type ResolvedOptions = {
    nfc: boolean;
    stripZW: boolean;
    zwAsSpace: boolean;
    removeHijri: boolean;
    removeDia: boolean;
    tatweelMode: false | 'safe' | 'all';
    normAlif: boolean;
    maqToYa: boolean;
    taToHa: boolean;
    removeFootnotes: boolean;
    lettersSpacesOnly: boolean;
    stripNoise: boolean;
    lettersOnly: boolean;
    collapseWS: boolean;
    doTrim: boolean;
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

// Constants for character codes
const CHAR_SPACE = 32;
const CHAR_TATWEEL = 0x0640;
const CHAR_HA = 0x0647;
const CHAR_YA = 0x064a;
const CHAR_WAW = 0x0648;
const CHAR_ALIF = 0x0627;
const CHAR_ALIF_MADDA = 0x0622;
const CHAR_ALIF_HAMZA_ABOVE = 0x0623;
const CHAR_WAW_HAMZA_ABOVE = 0x0624;
const CHAR_ALIF_HAMZA_BELOW = 0x0625;
const CHAR_YEH_HAMZA_ABOVE = 0x0626;
const CHAR_ALIF_WASLA = 0x0671;
const CHAR_ALIF_MAQSURAH = 0x0649;
const CHAR_TA_MARBUTAH = 0x0629;
const CHAR_MADDA_ABOVE = 0x0653;
const CHAR_HAMZA_ABOVE_MARK = 0x0654;
const CHAR_HAMZA_BELOW_MARK = 0x0655;
const CHAR_DAGGER_ALIF = 0x0670;

// Shared resources to avoid allocations
let sharedBuffer = new Uint16Array(2048); // Start with 2KB (enough for ~1000 chars)
const decoder = new TextDecoder('utf-16le');

// Diacritic ranges
const isDiacritic = (code: number): boolean => {
    return (
        (code >= 0x064b && code <= 0x065f) ||
        (code >= 0x0610 && code <= 0x061a) ||
        code === CHAR_DAGGER_ALIF ||
        (code >= 0x06d6 && code <= 0x06ed)
    );
};

const isZeroWidth = (code: number): boolean => {
    return (
        (code >= 0x200b && code <= 0x200f) ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2060 && code <= 0x2064) ||
        code === 0xfeff
    );
};

const isLatinOrDigit = (code: number): boolean => {
    return (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) // 0-9
    );
};

const isSymbol = (code: number): boolean => {
    // [¬§`=]|[&]|[ﷺ]
    return (
        code === 0x00ac || // ¬
        code === 0x00a7 || // §
        code === 0x0060 || // `
        code === 0x003d || // =
        code === 0x0026 || // &
        code === 0xfdfa // ﷺ
    );
};

const isArabicLetter = (code: number): boolean => {
    return (
        (code >= 0x0621 && code <= 0x063a) ||
        (code >= 0x0641 && code <= 0x064a) ||
        code === 0x0671 ||
        code === 0x067e ||
        code === 0x0686 ||
        (code >= 0x06a4 && code <= 0x06af) ||
        code === 0x06cc ||
        code === 0x06d2 ||
        code === 0x06d3
    );
};

/**
 * Checks whether a code point represents a Western or Arabic-Indic digit.
 *
 * @param code - The numeric code point to evaluate.
 * @returns True when the code point is a digit in either numeral system.
 */
const isDigit = (code: number): boolean => (code >= 48 && code <= 57) || (code >= 0x0660 && code <= 0x0669);

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

/**
 * Mutable loop state threaded through step handlers.
 * Allocated once per {@link applySanitization} call; fields mutated in place.
 */
type SanitizeContext = {
    /** Shared output buffer (reference to the module-level {@link sharedBuffer}). */
    buffer: Uint16Array;
    /** Source string. */
    text: string;
    /** `text.length`, cached to avoid repeated property access. */
    len: number;
    /** Next write position in `buffer`. */
    bufIdx: number;
    /** Whether the last emitted character was a space (for collapse logic). */
    lastWasSpace: boolean;
    /**
     * Current loop index. Handlers that perform lookahead (hijri marker, noise,
     * footnotes) advance this so the outer loop can skip consumed characters.
     */
    i: number;
};

/**
 * Emits a single space into the output buffer, respecting the collapse-whitespace flag.
 *
 * @param ctx - Mutable loop state; `bufIdx` and `lastWasSpace` may be updated.
 * @param collapseWS - When true, suppress consecutive spaces and leading spaces.
 */
const emitSpace = (ctx: SanitizeContext, collapseWS: boolean): void => {
    if (collapseWS) {
        if (!ctx.lastWasSpace && ctx.bufIdx > 0) {
            ctx.buffer[ctx.bufIdx++] = CHAR_SPACE;
            ctx.lastWasSpace = true;
        }
    } else {
        ctx.buffer[ctx.bufIdx++] = CHAR_SPACE;
        ctx.lastWasSpace = false;
    }
};

/**
 * Applies letter-level normalization to a single code point:
 * alif variants → bare alif, alif maqsurah → ya, ta marbutah → ha.
 *
 * @param code - Input code point.
 * @param normAlif - Whether to collapse alif variants.
 * @param maqToYa - Whether to replace ى with ي.
 * @param taToHa - Whether to replace ة with ه.
 * @returns The (possibly mapped) output code point.
 */
const normalizeCode = (code: number, normAlif: boolean, maqToYa: boolean, taToHa: boolean): number => {
    let out = code;
    if (normAlif) {
        if (
            code === CHAR_ALIF_MADDA ||
            code === CHAR_ALIF_HAMZA_ABOVE ||
            code === CHAR_ALIF_HAMZA_BELOW ||
            code === CHAR_ALIF_WASLA
        ) {
            out = CHAR_ALIF;
        }
    }
    if (maqToYa && code === CHAR_ALIF_MAQSURAH) {
        out = CHAR_YA;
    }
    if (taToHa && code === CHAR_TA_MARBUTAH) {
        out = CHAR_HA;
    }
    return out;
};

// ---------------------------------------------------------------------------
// Step handlers — each returns true when the character has been consumed
// (i.e. the outer loop should `continue`), false to let processing fall through.
// ---------------------------------------------------------------------------

/**
 * Handles ASCII and control whitespace (code ≤ 32).
 * Returns `false` for non-whitespace characters.
 */
const processWhitespace = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (code > 32) {
        return false;
    }
    if (opts.lettersOnly) {
        return true; // drop silently
    }
    if (opts.collapseWS) {
        if (!ctx.lastWasSpace && ctx.bufIdx > 0) {
            ctx.buffer[ctx.bufIdx++] = CHAR_SPACE;
            ctx.lastWasSpace = true;
        }
    } else {
        ctx.buffer[ctx.bufIdx++] = code; // preserve original whitespace (e.g. newlines)
        ctx.lastWasSpace = false;
    }
    return true;
};

/**
 * Performs inline NFC canonical composition for Arabic combining marks.
 * Only handles the five compositions relevant to Arabic OCR:
 *   ا + ◌ٓ → آ,  ا + ◌ٔ → أ,  ا + ◌ٕ → إ,  و + ◌ٔ → ؤ,  ي + ◌ٔ → ئ
 *
 * Called only when `nfc` is enabled. Returns `false` when the mark cannot be
 * composed (it will then be emitted as a standalone character by the fallthrough).
 */
const processNfc = (code: number, ctx: SanitizeContext): boolean => {
    if (code !== CHAR_MADDA_ABOVE && code !== CHAR_HAMZA_ABOVE_MARK && code !== CHAR_HAMZA_BELOW_MARK) {
        return false;
    }
    const prevIdx = ctx.bufIdx - 1;
    if (prevIdx < 0) {
        return false;
    }

    const prev = ctx.buffer[prevIdx];
    let composed = 0;

    if (prev === CHAR_ALIF) {
        if (code === CHAR_MADDA_ABOVE) {
            composed = CHAR_ALIF_MADDA;
        } else if (code === CHAR_HAMZA_ABOVE_MARK) {
            composed = CHAR_ALIF_HAMZA_ABOVE;
        } else {
            composed = CHAR_ALIF_HAMZA_BELOW; // CHAR_HAMZA_BELOW_MARK
        }
    } else if (code === CHAR_HAMZA_ABOVE_MARK) {
        // Only hamza-above composes with WAW and YEH in NFC
        if (prev === CHAR_WAW) {
            composed = CHAR_WAW_HAMZA_ABOVE;
        } else if (prev === CHAR_YA) {
            composed = CHAR_YEH_HAMZA_ABOVE;
        }
    }

    if (composed === 0) {
        return false;
    }
    ctx.buffer[prevIdx] = composed;
    return true;
};

/**
 * Strips zero-width controls (U+200B–U+FEFF range).
 * When `zwAsSpace` is set, emits a space in place of the removed character.
 * Called only when `stripZW` is enabled.
 */
const processZeroWidth = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (!isZeroWidth(code)) {
        return false;
    }
    if (opts.zwAsSpace) {
        emitSpace(ctx, opts.collapseWS);
    }
    return true;
};

/**
 * Removes the Hijri date marker "هـ" (or bare "ه" when tatweel has already been
 * stripped) when it immediately follows a date-like token (digits/slashes/hyphens).
 *
 * May advance `ctx.i` by one to also consume an attached tatweel.
 * Called only when `removeHijri` is enabled.
 */
const processHijriMarker = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (code !== CHAR_HA) {
        return false;
    }

    const { text, len } = ctx;
    const origI = ctx.i;
    let nextIdx = origI + 1;
    const hasTatweel = nextIdx < len && text.charCodeAt(nextIdx) === CHAR_TATWEEL;
    if (hasTatweel) {
        nextIdx++;
    }

    // The marker must appear at a word boundary (end of string or followed by space/separator)
    let isBoundary = nextIdx >= len;
    if (!isBoundary) {
        const nextCode = text.charCodeAt(nextIdx);
        isBoundary = nextCode <= 32 || isSymbol(nextCode) || nextCode === 47 || nextCode === 45;
    }
    if (!isBoundary) {
        return false;
    }

    // Only suppress if the preceding non-space character is a digit
    let backIdx = origI - 1;
    while (backIdx >= 0 && (text.charCodeAt(backIdx) <= 32 || isZeroWidth(text.charCodeAt(backIdx)))) {
        backIdx--;
    }
    if (backIdx < 0 || !isDigit(text.charCodeAt(backIdx))) {
        return false;
    }

    if (hasTatweel) {
        ctx.i = origI + 1; // outer loop's i++ will clear the tatweel position
    }
    return true;
};

/**
 * Strips tatweel (ـ U+0640) according to the resolved mode.
 *
 * - `'all'`: always remove.
 * - `'safe'`: remove unless immediately preceded by a digit or ه
 *   (preserves date suffixes like "هـ" and list markers like "4ـ").
 *
 * Called only when `tatweelMode !== false`.
 */
const processTatweel = (code: number, ctx: SanitizeContext, tatweelMode: 'safe' | 'all'): boolean => {
    if (code !== CHAR_TATWEEL) {
        return false;
    }
    if (tatweelMode === 'all') {
        return true;
    }

    // 'safe': scan back through spaces to find the previous non-space output character
    let backIdx = ctx.bufIdx - 1;
    while (backIdx >= 0 && ctx.buffer[backIdx] === CHAR_SPACE) {
        backIdx--;
    }
    if (backIdx < 0) {
        return true; // nothing before it — drop
    }

    const prev = ctx.buffer[backIdx];
    return !(isDigit(prev) || prev === CHAR_HA); // keep when after digit/ha, drop otherwise
};

/**
 * Replaces Latin letters, Western digits, and recognised symbols with a space.
 * Also collapses runs of double-slashes ("//") common in URLs.
 *
 * Called only when `stripNoise` is enabled and letter-filtering is not already
 * handling cleanup (`lettersSpacesOnly` / `lettersOnly` take care of it themselves).
 *
 * May advance `ctx.i` to consume a run of slashes.
 */
const processNoise = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (opts.lettersSpacesOnly || opts.lettersOnly) {
        return false;
    }

    if (isLatinOrDigit(code) || isSymbol(code)) {
        emitSpace(ctx, opts.collapseWS);
        return true;
    }

    // Collapse "//" (URL noise)
    if (code === 47 && ctx.i + 1 < ctx.len && ctx.text.charCodeAt(ctx.i + 1) === 47) {
        while (ctx.i + 1 < ctx.len && ctx.text.charCodeAt(ctx.i + 1) === 47) {
            ctx.i++;
        }
        emitSpace(ctx, opts.collapseWS);
        return true;
    }

    return false;
};

/**
 * Matches footnote pattern 1: `(¬٣)` or `(¬٣ )` — a negation sign followed by
 * Arabic-Indic digits and an optional space before the closing parenthesis.
 *
 * @param text - Full source string.
 * @param len - Length of `text`.
 * @param startPos - Index of the first character **after** ¬.
 * @returns Index of the closing `)` on match, or -1 on no match.
 */
const matchFootnotePattern1 = (text: string, len: number, startPos: number): number => {
    let pos = startPos;
    let hasDigits = false;
    while (pos < len && text.charCodeAt(pos) >= 0x0660 && text.charCodeAt(pos) <= 0x0669) {
        hasDigits = true;
        pos++;
    }
    if (!hasDigits || pos >= len) {
        return -1;
    }

    const closing = text.charCodeAt(pos);
    if (closing === 41) {
        return pos; // `)`
    }
    if (closing === CHAR_SPACE && pos + 1 < len && text.charCodeAt(pos + 1) === 41) {
        return pos + 1;
    }
    return -1;
};

/**
 * Matches footnote pattern 2: `(٣)` or `(٣ X)` — a single Arabic-Indic digit,
 * optionally followed by a space and one Arabic letter, then a closing parenthesis.
 *
 * @param text - Full source string.
 * @param len - Length of `text`.
 * @param digitPos - Index of the Arabic-Indic digit character.
 * @returns Index of the closing `)` on match, or -1 on no match.
 */
const matchFootnotePattern2 = (text: string, len: number, digitPos: number): number => {
    const afterDigit = digitPos + 1;
    if (afterDigit >= len) {
        return -1;
    }

    const c2 = text.charCodeAt(afterDigit);
    if (c2 === 41) {
        return afterDigit; // `(٣)`
    }

    if (c2 !== CHAR_SPACE) {
        return -1;
    }
    const afterSpace = afterDigit + 1;
    if (afterSpace >= len) {
        return -1;
    }

    const c3 = text.charCodeAt(afterSpace);
    if (c3 < 0x0600 || c3 > 0x06ff) {
        return -1; // must be an Arabic character
    }

    const closingIdx = afterSpace + 1;
    if (closingIdx >= len || text.charCodeAt(closingIdx) !== 41) {
        return -1;
    }
    return closingIdx; // `(٣ X)`
};

/**
 * Removes inline footnote references of the form `(٣)`, `(٣ م)`, or `(¬٣)`.
 * Replaces the entire token (including parens) with a single space.
 *
 * Called only when `removeFootnotes` is enabled and letter-filtering is inactive.
 * May advance `ctx.i` past the consumed token.
 */
const processFootnote = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (opts.lettersSpacesOnly || opts.lettersOnly || code !== 40) {
        return false; // `(`
    }

    const { text, len } = ctx;
    let nextIdx = ctx.i + 1;
    if (nextIdx < len && text.charCodeAt(nextIdx) === CHAR_SPACE) {
        nextIdx++;
    }
    if (nextIdx >= len) {
        return false;
    }

    const c1 = text.charCodeAt(nextIdx);
    let endIdx = -1;

    if (c1 === 0x00ac) {
        // Pattern 1: (¬digits)
        endIdx = matchFootnotePattern1(text, len, nextIdx + 1);
    } else if (c1 >= 0x0660 && c1 <= 0x0669) {
        // Pattern 2: (digit) or (digit letter)
        endIdx = matchFootnotePattern2(text, len, nextIdx);
    }

    if (endIdx < 0) {
        return false;
    }
    ctx.i = endIdx; // outer loop's i++ will land past the closing ')'
    emitSpace(ctx, opts.collapseWS);
    return true;
};

/**
 * Handles letter filtering for the `lettersSpacesOnly` / `lettersOnly` modes.
 * Non-Arabic characters are either dropped (lettersOnly) or replaced with a space.
 * Arabic letters are emitted after normalization.
 *
 * Returns `false` when neither mode is active, allowing the default emit to run.
 */
const processLetterFilter = (code: number, ctx: SanitizeContext, opts: ResolvedOptions): boolean => {
    if (!opts.lettersSpacesOnly && !opts.lettersOnly) {
        return false;
    }

    if (!isArabicLetter(code)) {
        if (!opts.lettersOnly) {
            emitSpace(ctx, opts.collapseWS); // lettersSpacesOnly: replace with space
        }
        return true; // lettersOnly: drop silently
    }

    ctx.buffer[ctx.bufIdx++] = normalizeCode(code, opts.normAlif, opts.maqToYa, opts.taToHa);
    ctx.lastWasSpace = false;
    return true;
};

/**
 * Internal sanitization logic. Iterates once over the source string, dispatching
 * each character through a series of focused step handlers. All options must be
 * pre-resolved; no allocations occur beyond the context object and any buffer growth.
 */
const applySanitization = (input: string, options: ResolvedOptions): string => {
    if (!input) {
        return '';
    }

    const {
        nfc,
        stripZW,
        removeHijri,
        removeDia,
        tatweelMode,
        stripNoise,
        removeFootnotes,
        normAlif,
        maqToYa,
        taToHa,
        doTrim,
    } = options;

    const text = input;
    const len = text.length;

    if (len > sharedBuffer.length) {
        sharedBuffer = new Uint16Array(len + 1024);
    }

    const ctx: SanitizeContext = {
        buffer: sharedBuffer,
        bufIdx: 0,
        i: 0,
        lastWasSpace: false,
        len,
        text,
    };

    let start = 0;
    if (doTrim) {
        while (start < len && text.charCodeAt(start) <= 32) {
            start++;
        }
    }

    for (let i = start; i < len; i++) {
        ctx.i = i;
        const code = text.charCodeAt(i);

        if (processWhitespace(code, ctx, options)) {
            continue;
        }
        if (nfc && processNfc(code, ctx)) {
            continue;
        }
        if (stripZW && processZeroWidth(code, ctx, options)) {
            continue;
        }
        if (removeHijri && processHijriMarker(code, ctx, options)) {
            i = ctx.i;
            continue;
        }
        if (removeDia && isDiacritic(code)) {
            continue;
        }
        if (tatweelMode !== false && processTatweel(code, ctx, tatweelMode)) {
            continue;
        }
        if (stripNoise && processNoise(code, ctx, options)) {
            i = ctx.i;
            continue;
        }
        if (removeFootnotes && processFootnote(code, ctx, options)) {
            i = ctx.i;
            continue;
        }
        if (processLetterFilter(code, ctx, options)) {
            continue;
        }

        // Default: emit the (possibly normalized) character
        ctx.buffer[ctx.bufIdx++] = normalizeCode(code, normAlif, maqToYa, taToHa);
        ctx.lastWasSpace = false;
    }

    // Trailing-trim: drop the last space if it was the final emitted character
    if (doTrim && ctx.lastWasSpace && ctx.bufIdx > 0) {
        ctx.bufIdx--;
    }

    if (ctx.bufIdx === 0) {
        return '';
    }
    return decoder.decode(ctx.buffer.subarray(0, ctx.bufIdx));
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves options from a preset or custom options object.
 * Returns all resolved flags for reuse in batch processing.
 */
const resolveOptions = (optionsOrPreset: SanitizePreset | SanitizeOptions): ResolvedOptions => {
    let preset: PresetOptions;
    let opts: SanitizeOptions | null = null;

    if (typeof optionsOrPreset === 'string') {
        preset = PRESETS[optionsOrPreset];
    } else {
        const base = optionsOrPreset.base ?? 'light';
        preset = base === 'none' ? PRESET_NONE : PRESETS[base];
        opts = optionsOrPreset;
    }

    return {
        collapseWS: resolveBoolean(preset.collapseWhitespace, opts?.collapseWhitespace),
        doTrim: resolveBoolean(preset.trim, opts?.trim),
        lettersOnly: resolveBoolean(preset.keepOnlyArabicLetters, opts?.keepOnlyArabicLetters),
        lettersSpacesOnly: resolveBoolean(preset.lettersAndSpacesOnly, opts?.lettersAndSpacesOnly),
        maqToYa: resolveBoolean(preset.replaceAlifMaqsurah, opts?.replaceAlifMaqsurah),
        nfc: resolveBoolean(preset.nfc, opts?.nfc),
        normAlif: resolveBoolean(preset.normalizeAlif, opts?.normalizeAlif),
        removeDia: resolveBoolean(preset.stripDiacritics, opts?.stripDiacritics),
        removeFootnotes: resolveBoolean(preset.stripFootnotes, opts?.stripFootnotes),
        removeHijri: resolveBoolean(preset.removeHijriMarker, opts?.removeHijriMarker),
        stripNoise: resolveBoolean(preset.stripLatinAndSymbols, opts?.stripLatinAndSymbols),
        stripZW: resolveBoolean(preset.stripZeroWidth, opts?.stripZeroWidth),
        taToHa: resolveBoolean(preset.replaceTaMarbutahWithHa, opts?.replaceTaMarbutahWithHa),
        tatweelMode: resolveTatweelMode(preset.stripTatweel, opts?.stripTatweel),
        zwAsSpace: resolveBoolean(preset.zeroWidthToSpace, opts?.zeroWidthToSpace),
    };
};

/**
 * Creates a reusable sanitizer function with pre-resolved options.
 * Use this when you need to sanitize many strings with the same options
 * for maximum performance.
 *
 * @example
 * ```ts
 * const sanitize = createArabicSanitizer('search');
 * const results = texts.map(sanitize);
 * ```
 */
export const createArabicSanitizer = (
    optionsOrPreset: SanitizePreset | SanitizeOptions = 'search',
): ((input: string) => string) => {
    const resolved = resolveOptions(optionsOrPreset);

    return (input: string): string => applySanitization(input, resolved);
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
 * **Batch processing**: Pass an array of strings for optimized batch processing.
 * Options are resolved once and applied to all strings, providing significant
 * performance gains over calling the function in a loop.
 *
 * Examples:
 * ```ts
 * sanitizeArabic('أبـــتِـــكَةُ', { base: 'none', stripTatweel: true }); // 'أبتِكَةُ'
 * sanitizeArabic('1435/3/29 هـ', 'aggressive'); // '1435 3 29'
 * sanitizeArabic('اَلسَّلَامُ عَلَيْكُمْ', 'search'); // 'السلام عليكم'
 *
 * // Batch processing (optimized):
 * sanitizeArabic(['text1', 'text2', 'text3'], 'search'); // ['result1', 'result2', 'result3']
 * ```
 */
export function sanitizeArabic(input: string, optionsOrPreset?: SanitizePreset | SanitizeOptions): string;
export function sanitizeArabic(input: string[], optionsOrPreset?: SanitizePreset | SanitizeOptions): string[];
export function sanitizeArabic(
    input: string | string[],
    optionsOrPreset: SanitizePreset | SanitizeOptions = 'search',
): string | string[] {
    // Handle array input with optimized batch processing
    if (Array.isArray(input)) {
        if (input.length === 0) {
            return [];
        }

        const resolved = resolveOptions(optionsOrPreset);

        // Per-string processing using the optimized single-pass sanitizer
        const results: string[] = new Array(input.length);

        for (let i = 0; i < input.length; i++) {
            results[i] = applySanitization(input[i], resolved);
        }

        return results;
    }

    // Single string: resolve options and apply
    if (!input) {
        return '';
    }

    const resolved = resolveOptions(optionsOrPreset);

    return applySanitization(input, resolved);
}

const sanitizeQuranBase = createArabicSanitizer({
    base: 'none',
    collapseWhitespace: true,
    lettersAndSpacesOnly: true,
    nfc: true,
    replaceAlifMaqsurah: false,
    replaceTaMarbutahWithHa: false,
    stripDiacritics: true,
    stripFootnotes: true,
    stripTatweel: 'all',
    stripZeroWidth: true,
    trim: true,
});

const normalizeQuranOrthography = (input: string) => {
    if (!input) {
        return '';
    }

    let output = '';
    let lastBaseCode = 0;

    for (let index = 0; index < input.length; index += 1) {
        const code = input.charCodeAt(index);

        if (code === CHAR_ALIF_WASLA) {
            output += String.fromCharCode(CHAR_ALIF);
            lastBaseCode = CHAR_ALIF;
            continue;
        }

        if (code === CHAR_DAGGER_ALIF) {
            if (
                lastBaseCode !== 0 &&
                lastBaseCode !== 0x0630 && // ذ
                lastBaseCode !== CHAR_HA &&
                lastBaseCode !== CHAR_ALIF &&
                lastBaseCode !== CHAR_WAW &&
                lastBaseCode !== CHAR_YA &&
                lastBaseCode !== CHAR_ALIF_MAQSURAH
            ) {
                output += String.fromCharCode(CHAR_ALIF);
                lastBaseCode = CHAR_ALIF;
            }
            continue;
        }

        output += input[index];
        if (!isDiacritic(code) && !isZeroWidth(code)) {
            lastBaseCode = code;
        }
    }

    return output;
};

/**
 * Produces a conservative Qur'an-specific search surface.
 *
 * This helper is intentionally narrower than the generic `search` preset:
 * it preserves standard hamza forms and alif maqsurah while normalizing
 * Qur'anic orthography that would otherwise damage lexical identity in FTS.
 *
 * Current behavior:
 * - maps alif wasla (`ٱ`) to bare alif (`ا`)
 * - expands dagger alif (`ٰ`) only in contexts where the imla'i form needs an alif
 * - strips tashkeel, tatweel, footnotes, zero-width chars, and non-letter noise
 * - keeps only Arabic letters and spaces
 */
export const sanitizeQuranForSearch = (input: string) => {
    return sanitizeQuranBase(normalizeQuranOrthography(input)).replace(/آ/gu, 'ا').replace(/ىء/gu, 'يء');
};
