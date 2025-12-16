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

// Shared resources to avoid allocations
let sharedBuffer = new Uint16Array(2048); // Start with 2KB (enough for ~1000 chars)
const decoder = new TextDecoder('utf-16le');

// Diacritic ranges
const isDiacritic = (code: number): boolean => {
    return (
        (code >= 0x064b && code <= 0x065f) ||
        (code >= 0x0610 && code <= 0x061a) ||
        code === 0x0670 ||
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
 * Internal sanitization logic that applies all transformations to a single string.
 * Uses single-pass character transformation for maximum performance when possible.
 * This function assumes all options have been pre-resolved for maximum performance.
 */
const applySanitization = (input: string, options: ResolvedOptions): string => {
    if (!input) {
        return '';
    }

    const {
        nfc,
        stripZW,
        zwAsSpace,
        removeHijri,
        removeDia,
        tatweelMode,
        normAlif,
        maqToYa,
        taToHa,
        removeFootnotes,
        lettersSpacesOnly,
        stripNoise,
        lettersOnly,
        collapseWS,
        doTrim,
    } = options;

    /**
     * NFC Normalization (Fast Path)
     *
     * `String.prototype.normalize('NFC')` is extremely expensive under high throughput.
     * For Arabic OCR text, the main canonical compositions we care about are:
     * - ا + ◌ٓ (U+0653) → آ
     * - ا + ◌ٔ (U+0654) → أ
     * - ا + ◌ٕ (U+0655) → إ
     * - و + ◌ٔ (U+0654) → ؤ
     * - ي + ◌ٔ (U+0654) → ئ
     *
     * We implement these compositions inline during the main loop, avoiding full NFC
     * normalization in the common case while preserving behavior needed by our sanitizer.
     */
    const text = input;
    const len = text.length;

    // Ensure shared buffer is large enough
    if (len > sharedBuffer.length) {
        sharedBuffer = new Uint16Array(len + 1024);
    }
    const buffer = sharedBuffer;
    let bufIdx = 0;

    let lastWasSpace = false;

    // Skip leading whitespace if trimming
    let start = 0;
    if (doTrim) {
        while (start < len && text.charCodeAt(start) <= 32) {
            start++;
        }
    }

    for (let i = start; i < len; i++) {
        const code = text.charCodeAt(i);

        // Whitespace handling
        if (code <= 32) {
            if (lettersOnly) {
                continue; // Drop spaces if lettersOnly
            }

            if (collapseWS) {
                if (!lastWasSpace && bufIdx > 0) {
                    buffer[bufIdx++] = CHAR_SPACE;
                    lastWasSpace = true;
                }
            } else {
                buffer[bufIdx++] = CHAR_SPACE; // Normalize to space
                lastWasSpace = false;
            }
            continue;
        }

        // NFC (subset) for Arabic canonical compositions: merge combining marks into previous output
        if (nfc) {
            if (code === CHAR_MADDA_ABOVE || code === CHAR_HAMZA_ABOVE_MARK || code === CHAR_HAMZA_BELOW_MARK) {
                const prevIdx = bufIdx - 1;
                if (prevIdx >= 0) {
                    const prev = buffer[prevIdx];
                    let composed = 0;

                    if (prev === CHAR_ALIF) {
                        if (code === CHAR_MADDA_ABOVE) {
                            composed = CHAR_ALIF_MADDA;
                        } else if (code === CHAR_HAMZA_ABOVE_MARK) {
                            composed = CHAR_ALIF_HAMZA_ABOVE;
                        } else {
                            // CHAR_HAMZA_BELOW_MARK
                            composed = CHAR_ALIF_HAMZA_BELOW;
                        }
                    } else if (code === CHAR_HAMZA_ABOVE_MARK) {
                        // Only Hamza Above composes for WAW/YEH in NFC
                        if (prev === CHAR_WAW) {
                            composed = CHAR_WAW_HAMZA_ABOVE;
                        } else if (prev === CHAR_YA) {
                            composed = CHAR_YEH_HAMZA_ABOVE;
                        }
                    }

                    if (composed !== 0) {
                        buffer[prevIdx] = composed;
                        continue;
                    }
                }
            }
        }

        // Zero width
        if (stripZW && isZeroWidth(code)) {
            if (zwAsSpace) {
                if (collapseWS) {
                    if (!lastWasSpace && bufIdx > 0) {
                        buffer[bufIdx++] = CHAR_SPACE;
                        lastWasSpace = true;
                    }
                } else {
                    buffer[bufIdx++] = CHAR_SPACE;
                    lastWasSpace = false;
                }
            }
            continue;
        }

        // Hijri Marker Removal (Must run before letter filtering removes digits)
        if (removeHijri && code === CHAR_HA) {
            let nextIdx = i + 1;
            if (nextIdx < len && text.charCodeAt(nextIdx) === CHAR_TATWEEL) {
                nextIdx++;
            }

            let isBoundary = false;
            if (nextIdx >= len) {
                isBoundary = true;
            } else {
                const nextCode = text.charCodeAt(nextIdx);
                if (nextCode <= 32 || isSymbol(nextCode) || nextCode === 47 || nextCode === 45) {
                    isBoundary = true;
                }
            }

            if (isBoundary) {
                let backIdx = i - 1;
                while (backIdx >= 0) {
                    const c = text.charCodeAt(backIdx);
                    if (c <= 32 || isZeroWidth(c)) {
                        backIdx--;
                    } else {
                        break;
                    }
                }
                if (backIdx >= 0 && isDigit(text.charCodeAt(backIdx))) {
                    if (nextIdx > i + 1) {
                        i++;
                    }
                    continue;
                }
            }
        }

        // Diacritics
        if (removeDia && isDiacritic(code)) {
            continue;
        }

        // Tatweel
        if (code === CHAR_TATWEEL) {
            if (tatweelMode === 'all') {
                continue;
            }
            if (tatweelMode === 'safe') {
                let backIdx = bufIdx - 1;
                while (backIdx >= 0 && buffer[backIdx] === CHAR_SPACE) {
                    backIdx--;
                }
                if (backIdx >= 0) {
                    const prev = buffer[backIdx];
                    if (isDigit(prev) || prev === CHAR_HA) {
                        // Keep it
                    } else {
                        continue; // Drop
                    }
                } else {
                    continue; // Drop
                }
            }
        }

        // Latin and Symbols (Skip if letter filtering will handle it)
        if (stripNoise && !lettersSpacesOnly && !lettersOnly) {
            if (isLatinOrDigit(code) || isSymbol(code)) {
                if (collapseWS) {
                    if (!lastWasSpace && bufIdx > 0) {
                        buffer[bufIdx++] = CHAR_SPACE;
                        lastWasSpace = true;
                    }
                } else {
                    buffer[bufIdx++] = CHAR_SPACE;
                    lastWasSpace = false;
                }
                continue;
            }
            // Double slash check //
            if (code === 47 && i + 1 < len && text.charCodeAt(i + 1) === 47) {
                while (i + 1 < len && text.charCodeAt(i + 1) === 47) {
                    i++;
                }
                if (collapseWS) {
                    if (!lastWasSpace && bufIdx > 0) {
                        buffer[bufIdx++] = CHAR_SPACE;
                        lastWasSpace = true;
                    }
                } else {
                    buffer[bufIdx++] = CHAR_SPACE;
                    lastWasSpace = false;
                }
                continue;
            }
        }

        // Footnote Removal (Skip if letter filtering will handle it)
        if (removeFootnotes && !lettersSpacesOnly && !lettersOnly && code === 40) {
            // (
            let nextIdx = i + 1;
            if (nextIdx < len && text.charCodeAt(nextIdx) === CHAR_SPACE) {
                nextIdx++;
            }

            if (nextIdx < len) {
                const c1 = text.charCodeAt(nextIdx);

                // Pattern 1: (¬123...)
                if (c1 === 0x00ac) {
                    // ¬
                    nextIdx++;
                    let hasDigits = false;
                    while (nextIdx < len) {
                        const c = text.charCodeAt(nextIdx);
                        if (c >= 0x0660 && c <= 0x0669) {
                            hasDigits = true;
                            nextIdx++;
                        } else {
                            break;
                        }
                    }
                    if (hasDigits && nextIdx < len) {
                        if (text.charCodeAt(nextIdx) === 41) {
                            // )
                            i = nextIdx;
                            if (collapseWS) {
                                if (!lastWasSpace && bufIdx > 0) {
                                    buffer[bufIdx++] = CHAR_SPACE;
                                    lastWasSpace = true;
                                }
                            } else {
                                buffer[bufIdx++] = CHAR_SPACE;
                                lastWasSpace = false;
                            }
                            continue;
                        }
                        if (text.charCodeAt(nextIdx) === CHAR_SPACE) {
                            nextIdx++;
                            if (nextIdx < len && text.charCodeAt(nextIdx) === 41) {
                                i = nextIdx;
                                if (collapseWS) {
                                    if (!lastWasSpace && bufIdx > 0) {
                                        buffer[bufIdx++] = CHAR_SPACE;
                                        lastWasSpace = true;
                                    }
                                } else {
                                    buffer[bufIdx++] = CHAR_SPACE;
                                    lastWasSpace = false;
                                }
                                continue;
                            }
                        }
                    }
                }

                // Pattern 2: (1) or (1 X)
                else if (c1 >= 0x0660 && c1 <= 0x0669) {
                    let tempIdx = nextIdx + 1;
                    let matched = false;

                    if (tempIdx < len) {
                        const c2 = text.charCodeAt(tempIdx);
                        if (c2 === 41) {
                            // )
                            matched = true;
                            tempIdx++;
                        } else if (c2 === CHAR_SPACE) {
                            // Space
                            tempIdx++;
                            if (tempIdx < len) {
                                const c3 = text.charCodeAt(tempIdx);
                                if (c3 >= 0x0600 && c3 <= 0x06ff) {
                                    tempIdx++;
                                    if (tempIdx < len && text.charCodeAt(tempIdx) === 41) {
                                        matched = true;
                                        tempIdx++;
                                    }
                                }
                            }
                        }
                    }

                    if (matched) {
                        i = tempIdx - 1;
                        if (collapseWS) {
                            if (!lastWasSpace && bufIdx > 0) {
                                buffer[bufIdx++] = CHAR_SPACE;
                                lastWasSpace = true;
                            }
                        } else {
                            buffer[bufIdx++] = CHAR_SPACE;
                            lastWasSpace = false;
                        }
                        continue;
                    }
                }
            }
        }

        // Letter Filtering (Aggressive)
        if (lettersSpacesOnly || lettersOnly) {
            if (!isArabicLetter(code)) {
                if (lettersOnly) {
                    continue;
                }
                // lettersSpacesOnly -> replace with space
                if (collapseWS) {
                    if (!lastWasSpace && bufIdx > 0) {
                        buffer[bufIdx++] = CHAR_SPACE;
                        lastWasSpace = true;
                    }
                } else {
                    buffer[bufIdx++] = CHAR_SPACE;
                    lastWasSpace = false;
                }
                continue;
            }

            // Normalization logic duplicated for speed
            let outCode = code;
            if (normAlif) {
                if (
                    code === CHAR_ALIF_MADDA ||
                    code === CHAR_ALIF_HAMZA_ABOVE ||
                    code === CHAR_ALIF_HAMZA_BELOW ||
                    code === CHAR_ALIF_WASLA
                ) {
                    outCode = CHAR_ALIF;
                }
            }
            if (maqToYa && code === CHAR_ALIF_MAQSURAH) {
                outCode = CHAR_YA;
            }
            if (taToHa && code === CHAR_TA_MARBUTAH) {
                outCode = CHAR_HA;
            }

            buffer[bufIdx++] = outCode;
            lastWasSpace = false;
            continue;
        }

        // Normalization
        let outCode = code;
        if (normAlif) {
            if (
                code === CHAR_ALIF_MADDA ||
                code === CHAR_ALIF_HAMZA_ABOVE ||
                code === CHAR_ALIF_HAMZA_BELOW ||
                code === CHAR_ALIF_WASLA
            ) {
                outCode = CHAR_ALIF;
            }
        }
        if (maqToYa && code === CHAR_ALIF_MAQSURAH) {
            outCode = CHAR_YA;
        }
        if (taToHa && code === CHAR_TA_MARBUTAH) {
            outCode = CHAR_HA;
        }

        buffer[bufIdx++] = outCode;
        lastWasSpace = false;
    }

    // Trailing trim
    if (doTrim && lastWasSpace && bufIdx > 0) {
        bufIdx--;
    }

    if (bufIdx === 0) {
        return '';
    }
    const resultView = buffer.subarray(0, bufIdx);
    return decoder.decode(resultView);
};

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
