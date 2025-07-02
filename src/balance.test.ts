import { describe, expect, it } from 'bun:test';

import { checkBalance, CLOSE_BRACKETS, getUnbalancedErrors, isBalanced, OPEN_BRACKETS } from './balance';

describe('balance', () => {
    describe('OPEN_BRACKETS constant', () => {
        it('should contain all opening bracket characters', () => {
            expect(OPEN_BRACKETS.has('«')).toBeTrue();
            expect(OPEN_BRACKETS.has('(')).toBeTrue();
            expect(OPEN_BRACKETS.has('[')).toBeTrue();
            expect(OPEN_BRACKETS.has('{')).toBeTrue();
            expect(OPEN_BRACKETS.has('»')).toBeFalse();
            expect(OPEN_BRACKETS.has(')')).toBeFalse();
            expect(OPEN_BRACKETS.has(']')).toBeFalse();
            expect(OPEN_BRACKETS.has('}')).toBeFalse();
        });
    });

    describe('CLOSE_BRACKETS constant', () => {
        it('should contain all closing bracket characters', () => {
            expect(CLOSE_BRACKETS.has('»')).toBeTrue();
            expect(CLOSE_BRACKETS.has(')')).toBeTrue();
            expect(CLOSE_BRACKETS.has(']')).toBeTrue();
            expect(CLOSE_BRACKETS.has('}')).toBeTrue();
            expect(CLOSE_BRACKETS.has('«')).toBeFalse();
            expect(CLOSE_BRACKETS.has('(')).toBeFalse();
            expect(CLOSE_BRACKETS.has('[')).toBeFalse();
            expect(CLOSE_BRACKETS.has('{')).toBeFalse();
        });
    });

    describe('checkBalance', () => {
        describe('balanced strings', () => {
            it('should return balanced for empty string', () => {
                const result = checkBalance('');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for string with no quotes or brackets', () => {
                const result = checkBalance('hello world');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for properly paired quotes', () => {
                const result = checkBalance('Hello "world"');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for multiple pairs of quotes', () => {
                const result = checkBalance('Hello "world" and "test"');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for properly paired parentheses', () => {
                const result = checkBalance('Hello (world)');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for properly paired square brackets', () => {
                const result = checkBalance('Hello [world]');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for properly paired curly brackets', () => {
                const result = checkBalance('Hello {world}');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for properly paired angle brackets', () => {
                const result = checkBalance('Hello «world»');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for nested brackets', () => {
                const result = checkBalance('Hello (world [test])');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for complex nested structure', () => {
                const result = checkBalance('Hello "world" and (test [nested {deep}])');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should return balanced for multiple separate bracket pairs', () => {
                const result = checkBalance('Hello (world) and [test] and {more}');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });
        });

        describe('unbalanced quotes', () => {
            it('should detect single unmatched quote', () => {
                const result = checkBalance('Hello "world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '"',
                    index: 6,
                    reason: 'unmatched',
                    type: 'quote',
                });
            });

            it('should detect unmatched quote at beginning', () => {
                const result = checkBalance('"Hello world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '"',
                    index: 0,
                    reason: 'unmatched',
                    type: 'quote',
                });
            });

            it('should detect unmatched quote with three quotes total', () => {
                const result = checkBalance('Hello "world" and "test');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '"',
                    index: 18,
                    reason: 'unmatched',
                    type: 'quote',
                });
            });
        });

        describe('unbalanced brackets', () => {
            it('should detect unclosed opening parenthesis', () => {
                const result = checkBalance('Hello (world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '(',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should detect unmatched closing parenthesis', () => {
                const result = checkBalance('Hello world)');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: ')',
                    index: 11,
                    reason: 'unmatched',
                    type: 'bracket',
                });
            });

            it('should detect mismatched bracket types', () => {
                const result = checkBalance('Hello (world]');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(2);
                expect(result.errors[0]).toEqual({
                    char: '(',
                    index: 6,
                    reason: 'mismatched',
                    type: 'bracket',
                });
                expect(result.errors[1]).toEqual({
                    char: ']',
                    index: 12,
                    reason: 'mismatched',
                    type: 'bracket',
                });
            });

            it('should detect multiple unclosed brackets', () => {
                const result = checkBalance('Hello (world [test');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(2);
                expect(result.errors[0]).toEqual({
                    char: '(',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
                expect(result.errors[1]).toEqual({
                    char: '[',
                    index: 13,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should detect unclosed square bracket', () => {
                const result = checkBalance('Hello [world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '[',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should detect unclosed curly bracket', () => {
                const result = checkBalance('Hello {world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '{',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should detect unclosed angle bracket', () => {
                const result = checkBalance('Hello «world');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]).toEqual({
                    char: '«',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });
        });

        describe('combined quote and bracket errors', () => {
            it('should detect both quote and bracket errors', () => {
                const result = checkBalance('Hello "world and (test');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(2);
                expect(result.errors[0]).toEqual({
                    char: '"',
                    index: 6,
                    reason: 'unmatched',
                    type: 'quote',
                });
                expect(result.errors[1]).toEqual({
                    char: '(',
                    index: 17,
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should sort errors by index position', () => {
                const result = checkBalance('Hello (world "test');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toHaveLength(2);
                expect(result.errors[0]).toEqual({
                    char: '(',
                    index: 6,
                    reason: 'unclosed',
                    type: 'bracket',
                });
                expect(result.errors[1]).toEqual({
                    char: '"',
                    index: 13,
                    reason: 'unmatched',
                    type: 'quote',
                });
            });
        });

        describe('edge cases', () => {
            it('should handle string with only quotes', () => {
                const result = checkBalance('""""');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should handle string with only brackets', () => {
                const result = checkBalance('()[]{}«»');
                expect(result.isBalanced).toBeTrue();
                expect(result.errors).toEqual([]);
            });

            it('should handle complex mismatching', () => {
                const result = checkBalance('Hello (world [test}');
                expect(result.isBalanced).toBeFalse();
                expect(result.errors).toEqual([
                    {
                        char: '(',
                        index: 6,
                        reason: 'unclosed',
                        type: 'bracket',
                    },
                    {
                        char: '[',
                        index: 13,
                        reason: 'mismatched',
                        type: 'bracket',
                    },
                    {
                        char: '}',
                        index: 18,
                        reason: 'mismatched',
                        type: 'bracket',
                    },
                ]);
            });
        });
    });

    describe('getUnbalancedErrors', () => {
        describe('single line processing', () => {
            it('should return empty array for balanced single line', () => {
                const result = getUnbalancedErrors('Hello "world" and (test)');
                expect(result).toEqual([]);
            });

            it('should skip lines with 10 characters or fewer', () => {
                const result = getUnbalancedErrors('Hello "wo');
                expect(result).toEqual([]);
            });

            it('should process lines with more than 10 characters', () => {
                const result = getUnbalancedErrors('Hello "world and more');
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    absoluteIndex: 6,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
            });
        });

        describe('multi-line processing', () => {
            it('should handle multiple lines with errors', () => {
                const text = 'First line with "unmatched quote\nSecond line with (unclosed bracket';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(2);
                expect(result[0]).toEqual({
                    absoluteIndex: 16,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
                expect(result[1]).toEqual({
                    absoluteIndex: 50,
                    char: '(',
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should calculate correct absolute indices across lines', () => {
                const text = 'Line 1 has some text\nLine 2 has "unmatched quote';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    absoluteIndex: 32,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
            });

            it('should handle empty lines', () => {
                const text = 'Line with "unmatched\n\nAnother line with (unclosed';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(2);
                expect(result[0]).toEqual({
                    absoluteIndex: 10,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
                expect(result[1]).toEqual({
                    absoluteIndex: 40,
                    char: '(',
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should skip short lines but process long lines', () => {
                const text = 'Short\nThis is a longer line with "unmatched\nShort2\nAnother long line with (unclosed';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(2);
                expect(result[0]).toEqual({
                    absoluteIndex: 33,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
                expect(result[1]).toEqual({
                    absoluteIndex: 74,
                    char: '(',
                    reason: 'unclosed',
                    type: 'bracket',
                });
            });

            it('should handle last line without trailing newline', () => {
                const text = 'First line with balanced text\nLast line with "unmatched';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    absoluteIndex: 45,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
            });
        });

        describe('edge cases', () => {
            it('should handle empty string', () => {
                const result = getUnbalancedErrors('');
                expect(result).toEqual([]);
            });

            it('should handle single newline', () => {
                const result = getUnbalancedErrors('\n');
                expect(result).toEqual([]);
            });

            it('should handle multiple empty lines', () => {
                const result = getUnbalancedErrors('\n\n\n');
                expect(result).toEqual([]);
            });

            it('should handle text with only short lines', () => {
                const result = getUnbalancedErrors('Hi\nBye\nOk');
                expect(result).toEqual([]);
            });

            it('should handle mixed balanced and unbalanced long lines', () => {
                const text =
                    'Balanced line with "quotes" and (brackets)\nUnbalanced line with "quote\nAnother balanced line with [brackets]';
                const result = getUnbalancedErrors(text);
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual({
                    absoluteIndex: 64,
                    char: '"',
                    reason: 'unmatched',
                    type: 'quote',
                });
            });
        });

        describe('character error interface', () => {
            it('should return objects matching CharacterError interface', () => {
                const text = 'Line with "unmatched quote and (unclosed bracket';
                const result = getUnbalancedErrors(text);

                expect(result).toHaveLength(2);

                const firstError = result[0];
                expect(typeof firstError.absoluteIndex).toBe('number');
                expect(typeof firstError.char).toBe('string');
                expect(['mismatched', 'unclosed', 'unmatched']).toContain(firstError.reason);
                expect(['bracket', 'quote']).toContain(firstError.type);

                const secondError = result[1];
                expect(typeof secondError.absoluteIndex).toBe('number');
                expect(typeof secondError.char).toBe('string');
                expect(['mismatched', 'unclosed', 'unmatched']).toContain(secondError.reason);
                expect(['bracket', 'quote']).toContain(secondError.type);
            });
        });
    });

    describe('isBalanced', () => {
        describe('balanced strings', () => {
            it('should return true for string with balanced quotes and brackets', () => {
                expect(isBalanced('He said "Hello (world)!"')).toBe(true);
            });

            it('should return true for string with no quotes or brackets', () => {
                expect(isBalanced('Hello world')).toBe(true);
            });

            it('should return true for empty string', () => {
                expect(isBalanced('')).toBe(true);
            });

            it('should return true for balanced nested brackets', () => {
                expect(isBalanced('((([])))')).toBe(true);
            });

            it('should return true for multiple balanced quotes', () => {
                expect(isBalanced('"Hello" and "world"')).toBe(true);
            });

            it('should return true for complex balanced expression', () => {
                expect(isBalanced('function("param", [1, 2, {key: "value"}])')).toBe(true);
            });

            it('should return true for balanced Arabic text with punctuation', () => {
                expect(isBalanced('قال "مرحبا (بالعالم)!"')).toBe(true);
            });
        });

        describe('unbalanced quotes', () => {
            it('should return false for single unmatched quote', () => {
                expect(isBalanced('Hello "world')).toBe(false);
            });

            it('should return false for odd number of quotes', () => {
                expect(isBalanced('"Hello" and "world')).toBe(false);
            });

            it('should return false for three quotes', () => {
                expect(isBalanced('"""')).toBe(false);
            });

            it('should return false for unbalanced quotes with balanced brackets', () => {
                expect(isBalanced('He said "Hello (world)!')).toBe(false);
            });
        });

        describe('unbalanced brackets', () => {
            it('should return false for unmatched opening parenthesis', () => {
                expect(isBalanced('Hello (world')).toBe(false);
            });

            it('should return false for unmatched closing parenthesis', () => {
                expect(isBalanced('Hello world)')).toBe(false);
            });

            it('should return false for mismatched bracket types', () => {
                expect(isBalanced('Hello (world]')).toBe(false);
            });

            it('should return false for wrong nesting order', () => {
                expect(isBalanced('([)]')).toBe(false);
            });

            it('should return false for unmatched square brackets', () => {
                expect(isBalanced('[Hello world')).toBe(false);
            });

            it('should return false for unmatched curly braces', () => {
                expect(isBalanced('{Hello world')).toBe(false);
            });

            it('should return false for multiple unmatched brackets', () => {
                expect(isBalanced('(((')).toBe(false);
            });

            it('should return false for unbalanced brackets with balanced quotes', () => {
                expect(isBalanced('"Hello" (world')).toBe(false);
            });
        });

        describe('mixed unbalanced cases', () => {
            it('should return false when both quotes and brackets are unbalanced', () => {
                expect(isBalanced('He said "Hello (world')).toBe(false);
            });

            it('should return false for complex unbalanced expression', () => {
                expect(isBalanced('function("param", [1, 2, {key: "value"}')).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle strings with only quotes', () => {
                expect(isBalanced('""')).toBe(true);
                expect(isBalanced('"')).toBe(false);
            });

            it('should handle strings with only brackets', () => {
                expect(isBalanced('()')).toBe(true);
                expect(isBalanced('(')).toBe(false);
            });

            it('should handle strings with special characters', () => {
                expect(isBalanced('Hello! @#$%^&* (world)')).toBe(true);
            });

            it('should handle strings with numbers', () => {
                expect(isBalanced('Value is "123" and array[0]')).toBe(true);
            });

            it('should handle newlines and whitespace', () => {
                expect(isBalanced('Line 1\n"Line 2" (with brackets)\nLine 3')).toBe(true);
            });
        });
    });
});
