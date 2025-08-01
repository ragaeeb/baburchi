/**
 * Utility function to escape special regex characters and build the base pattern
 * @param names - Array of names to escape and join
 * @returns Object containing escaped names and base name pattern
 */
function buildBaseNamePattern(names: string[]): { basePattern: string; escapedNames: string[] } {
    if (names.length === 0) {
        throw new Error('At least one name must be provided');
    }

    // Escape special regex characters in each name
    const escapedNames: string[] = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const basePattern = `((?:${escapedNames.join('|')}))`;

    return { basePattern, escapedNames };
}

/**
 * Creates a regular expression that discovers potential Arabic names by matching
 * 1-2 words before the honorific symbol ﷺ, optionally with a single character
 * between the words and the honorific. This function is useful for building
 * a list of names to pass to createArabicNameRegexAdvanced.
 *
 * @param maxWords - Maximum number of words to match before honorific (1 or 2, default: 2)
 * @param allowArtifact - Whether to allow a single character between words and honorific (default: true)
 * @returns A RegExp object that captures the discovered name(s) in group 1
 *
 * @example
 * ```typescript
 * const discoveryRegex = createArabicNameDiscoveryRegex();
 * const text = 'كتب البخاري رحمه الله ﷺ والذهبي م ﷺ';
 * const matches = [...text.matchAll(discoveryRegex)];
 * // matches[0][1] = "البخاري رحمه الله"
 * // matches[1][1] = "الذهبي"
 * ```
 *
 * @example
 * ```typescript
 * // Matches these patterns:
 * // - البخاري ﷺ (1 word)
 * // - ابن حجر ﷺ (2 words)
 * // - البخاري م ﷺ (1 word + artifact)
 * // - ابن حجر جم ﷺ (2 words + artifact)
 * ```
 */
function createArabicNameDiscoveryRegex(maxWords: number = 2, allowArtifact: boolean = true): RegExp {
    if (maxWords < 1 || maxWords > 2) {
        throw new Error('maxWords must be 1 or 2');
    }

    // Pattern for a single Arabic word (includes Arabic letters, diacritics, and common punctuation)
    const wordPattern = '[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]+';

    let namePattern: string;
    if (maxWords === 1) {
        namePattern = `(${wordPattern})`;
    } else {
        // For maxWords === 2, match either 1 or 2 words
        namePattern = `(${wordPattern}(?:\\s+${wordPattern})?)`;
    }

    // Optional artifact pattern (single character between name and honorific)
    const artifactPattern = allowArtifact ? `(?:\\s+[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF])?` : '';

    const regexParts: string[] = [
        namePattern, // Captured name pattern (1-2 words)
        artifactPattern, // Optional single character artifact
        '\\s*', // Optional whitespace before honorific
        'ﷺ', // The honorific symbol
    ];

    return new RegExp(regexParts.join(''), 'g'); // Global flag for finding all matches
}

/**
 * Creates a regular expression that matches Arabic scholar names followed by
 * optional Arabic particles/words and the honorific symbol ﷺ. The regex captures
 * only the base name, allowing replacement of the optional particles and honorific
 * with a different honorific phrase.
 *
 * @param names - One or more Arabic scholar names to match
 * @returns A RegExp object that captures the base name in group 1
 *
 * @example
 * ```typescript
 * const regex = createArabicNameRegex('البخاري', 'الذهبي', 'حجر');
 * const text = 'حجر جَمَالَله ﷺ was a scholar';
 * const result = text.replace(regex, '$1 (رَحِمَهُ ٱللَّٰهُ)');
 * // Result: 'حجر (رَحِمَهُ ٱللَّٰهُ) was a scholar'
 * ```
 */
function createArabicNameRegex(...names: string[]): RegExp {
    if (names.length === 0) {
        throw new Error('At least one name must be provided');
    }

    // Escape special regex characters in each name
    const escapedNames: string[] = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const regexParts: string[] = [
        '(', // Start capture group 1 (base name only)
        '(?:', // Start non-capturing alternation group
        escapedNames.join('|'), // Join names with OR operator
        ')', // End non-capturing alternation group
        ')', // End capture group 1
        '(?:', // Start non-capturing group for optional particles
        '\\s+', // Required whitespace
        '(?:[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]+\\s+){0,1}', // 0-2 Arabic words followed by space
        ')?', // End optional particles group
        '\\s*', // Optional whitespace
        'ﷺ', // The honorific symbol
    ];

    return new RegExp(regexParts.join(''));
}

/**
 * Enhanced version with more specific control over particle patterns.
 * This version allows for more granular control over what constitutes
 * valid particles between the name and honorific.
 *
 * @param names - One or more Arabic scholar names to match
 * @param maxParticles - Maximum number of particles allowed (default: 3)
 * @param maxParticleLength - Maximum length of each particle (default: 4)
 * @returns A RegExp object that captures the base name in group 1
 */
function createArabicNameRegexAdvanced(
    names: string[],
    maxParticles: number = 3,
    maxParticleLength: number = 4,
): RegExp {
    const { basePattern } = buildBaseNamePattern(names);

    // Create pattern for Arabic particles
    const particlePattern = `[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]{1,${maxParticleLength}}`;
    const particlesPattern = `(?:\\s+${particlePattern}\\s*){1,${maxParticles}}`;

    const regexParts: string[] = [
        basePattern, // Captured base name pattern
        '(?:', // Start non-capturing group for optional particles
        particlesPattern, // Particles pattern with leading whitespace
        ')?', // End optional particles group
        '\\s*', // Optional whitespace before honorific
        'ﷺ', // The honorific symbol
    ];

    return new RegExp(regexParts.join(''));
}

/**
 * Utility function to discover Arabic names from text using the discovery regex
 * and return them as a unique array suitable for passing to createArabicNameRegexAdvanced.
 *
 * @param text - Text to search for Arabic names
 * @param maxWords - Maximum number of words per name (1 or 2, default: 2)
 * @param allowArtifact - Whether to allow artifacts between names and honorific (default: true)
 * @returns Array of unique discovered names
 *
 * @example
 * ```typescript
 * const text = 'البخاري رحمه الله ﷺ والذهبي م ﷺ وابن حجر ﷺ';
 * const names = discoverArabicNames(text);
 * // Returns: ['البخاري رحمه الله', 'الذهبي', 'ابن حجر']
 *
 * // Then use with the advanced function:
 * const regex = createArabicNameRegexAdvanced(names, 3, 4);
 * ```
 */
function discoverArabicNames(text: string, maxWords: number = 2, allowArtifact = true): string[] {
    const discoveryRegex = createArabicNameDiscoveryRegex(maxWords, allowArtifact);
    const matches = [...text.matchAll(discoveryRegex)];
    const punctuationPattern = /^[\u060C\u061B\u061F\u060D\u060E\u060F\u066A\u066B\u066C\u066D\u0640\u06D4\s]/;

    // Extract unique names from matches
    const names = matches
        .map((match) => match[1]) // Get the captured group
        .filter((name) => !punctuationPattern.test(name.trim())) // Exclude names starting with punctuation
        .filter((name) => name && name.trim().length > 0); // Remove empty/whitespace-only names

    return Array.from(new Set(names));
}

export {
    buildBaseNamePattern,
    createArabicNameDiscoveryRegex,
    createArabicNameRegex,
    createArabicNameRegexAdvanced,
    discoverArabicNames,
};
