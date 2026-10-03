import { expect, test } from 'bun:test';
import { entries } from './src/examples';

// Protect the demo adapters, not the underlying algorithms already tested in src/.
test.each([
    [
        'handleFootnoteFusion',
        'النص (١)\n---\n(١)\n---\n(١)أخرجه',
        { handled: true, resultTokens: ['النص', '(١)أخرجه'] },
    ],
    ['handleFootnoteSelection', 'النص\n---\nالشرح', null],
    ['findMatches', 'كتاب عن دمشق\nكتاب عن مكة\n---\nمكة', [1]],
    ['alignTokenSequences', '\n---\nمحمد', [[null, 'محمد']]],
])('%s displays structured results and preserves empty argument positions', (id, input, expected) => {
    const entry = entries.find((entry) => entry.id === id)!;
    expect(JSON.parse(entry.apply(input))).toEqual(expected);
});

test.each([
    ['removeFootnoteReferencesSimple', 'النص (¬١٢) مع (٢)', 'النص مع (٢)'],
    ['extractDigits', 'عام 1445 الصفحة 12', '1445'],
    ['boundedLevenshtein', 'a\n---\nabcdefghi', '4'],
    ['calculateLevenshteinDistance', 'alpha\n----\nbeta\n---\nalpha\n----\nbeta', '0'],
])('%s formats values without obscuring their meaning', (id, input, expected) => {
    expect(entries.find((entry) => entry.id === id)!.apply(input)).toBe(expected);
});
