import { describe, expect, it } from 'bun:test';

import { alignTextSegments } from './alignment';

describe('alignment', () => {
    describe('alignTextSegments', () => {
        it('should align split poetic lines correctly', () => {
            const targetLines = [
                '', // Don't align
                'قد قُدِّم العَجْبُ على الرُّوَيس وشارف الوهدُ أبا قُبيسِ',
                'وطاول البقلُ فروعَ الميْس وهبت العنز لقرع التيسِ',
                'وادَّعت الروم أبًا في قيس واختلط الناس اختلاط الحيسِ',
                'إذ قرا القاضي حليف الكيس معاني الشعر على العبيسي',
                '', // Don't align
            ];

            const segmentLines = [
                'A',
                'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس',
                'وطاول البقلُ فروعَ الميْس',
                'وهبت العنـز لـقرع التـيس',
                'واختلط الناس اختلاط الحيس',
                'وادَّعت الروم أبًا في قيس',
                'معـاني الشعر على العـبـيــسـي',
                'إذ قرا القاضي حليف الكيس',
                'B',
            ];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual([
                'A',
                'قد قُدِّم العَجْبُ على الرُّوَيس وشـارف الوهـدُ أبــا قُبيس',
                'وطاول البقلُ فروعَ الميْس وهبت العنـز لـقرع التـيس',
                'وادَّعت الروم أبًا في قيس واختلط الناس اختلاط الحيس',
                'إذ قرا القاضي حليف الكيس معـاني الشعر على العـبـيــسـي',
                'B',
            ]);
        });

        it('should handle reversed segments correctly', () => {
            const targetLines = ['hello world goodbye'];
            const segmentLines = ['goodbye', 'hello world'];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual(['hello world goodbye']);
        });

        it('should handle already aligned segments', () => {
            const targetLines = ['complete line'];
            const segmentLines = ['complete line'];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual(['complete line']);
        });

        it('should handle non-aligned lines with one-to-one correspondence', () => {
            const targetLines = ['', '', ''];
            const segmentLines = ['line1', 'line2', 'line3'];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual(['line1', 'line2', 'line3']);
        });

        it('should handle incomplete segments gracefully', () => {
            const targetLines = ['complete line'];
            const segmentLines = ['incomplete'];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual(['incomplete']);
        });

        it('should append remaining segments', () => {
            const targetLines = [''];
            const segmentLines = ['line1', 'extra1', 'extra2'];

            const result = alignTextSegments(targetLines, segmentLines);

            expect(result).toEqual(['line1', 'extra1', 'extra2']);
        });
    });
});
