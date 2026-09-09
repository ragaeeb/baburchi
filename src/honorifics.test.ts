import { describe, expect, it } from 'bun:test';

import { findHonorificCorruptions } from './honorifics';

describe('findHonorificCorruptions', () => {
    it('reports the macOCR artifact between matching source anchors', () => {
        const primary = 'حذر القرآن وحذر رسول اللّٰه ولي يي من أهل الأهواء.';
        const reference = 'حذر القرآن وحذر رسول الله ﷺ من أهل الأهواء.';

        expect(findHonorificCorruptions(primary, reference)).toEqual([
            {
                honorific: 'ﷺ',
                primaryEnd: 34,
                primaryStart: 28,
                primaryText: 'ولي يي',
                referenceEnd: 27,
                referenceStart: 26,
            },
        ]);
    });

    it('tolerates a small OCR typo in the word after the corrupted honorific', () => {
        const primary = 'الجواب: حكمها أنها باطلة ومخالفة لسنة رسول اللّٰه بلي فالدراهم';
        const reference = 'الجواب: حكمها أنها باطلة ومخالفة لسنة رسول الله ﷺ، قالدراهم';

        expect(findHonorificCorruptions(primary, reference)).toEqual([
            expect.objectContaining({ honorific: 'ﷺ', primaryText: 'بلي' }),
        ]);
    });

    it('supports other honorific signs without assuming the replacement text', () => {
        expect(findHonorificCorruptions('روى أبو هريرة جته قال', 'روى أبو هريرة ؓ قال')).toEqual([
            expect.objectContaining({ honorific: 'ؓ', primaryText: 'جته' }),
        ]);
        expect(findHonorificCorruptions('قال الإمام أحمد كلمله في المسألة', 'قال الإمام أحمد ؒ في المسألة')).toEqual([
            expect.objectContaining({ honorific: 'ؒ', primaryText: 'كلمله' }),
        ]);
        expect(findHonorificCorruptions('قال البخاري كلمله في المسألة', 'قال البخاريؒ في المسألة')).toEqual([
            expect.objectContaining({ honorific: 'ؒ', primaryText: 'كلمله' }),
        ]);
    });

    it('does not flag an expanded equivalent phrase as corruption', () => {
        expect(findHonorificCorruptions('قال محمد صلى الله عليه وسلم في الحديث', 'قال محمد ﷺ في الحديث')).toEqual([]);
        expect(findHonorificCorruptions('قال البخاري رحمه الله في كتابه', 'قال البخاري ؒ في كتابه')).toEqual([]);
        expect(findHonorificCorruptions('روى أبو هريرة رَضِيَ ٱللَّٰهُ عَنْهُ قال', 'روى أبو هريرة ؓ قال')).toEqual([]);
        expect(findHonorificCorruptions('قال البخاري رَحِمَهُ ٱللَّٰهُ في كتابه', 'قال البخاري ﵀ في كتابه')).toEqual([]);
    });

    it('abstains when the surrounding anchor is ambiguous', () => {
        const primary = 'قال رسول الله ي في الخبر ثم قال رسول الله ي في الخبر';
        const reference = 'قال رسول الله ﷺ في الخبر';

        expect(findHonorificCorruptions(primary, reference)).toEqual([]);
    });

    it('requires honorific evidence from the reference OCR', () => {
        expect(findHonorificCorruptions('قال رسول الله ي في الخبر', 'قال رسول الله في الخبر')).toEqual([]);
    });

    it('does not report a glyph already present in both OCR streams', () => {
        expect(findHonorificCorruptions('قال محمد ﷺ في الخبر', 'قال محمد ﷺ في الخبر')).toEqual([]);
    });

    it('allows four gap words but rejects a fifth', () => {
        expect(findHonorificCorruptions('قال زيد واحد اثنان ثلاثة أربعة ثم مضى', 'قال زيد ﷺ ثم مضى')).toEqual([
            expect.objectContaining({ honorific: 'ﷺ', primaryText: 'واحد اثنان ثلاثة أربعة' }),
        ]);
        expect(findHonorificCorruptions('قال زيد واحد اثنان ثلاثة أربعة خمسة ثم مضى', 'قال زيد ﷺ ثم مضى')).toEqual([]);
    });

    it('finds a unique leading corruption without preceding context', () => {
        expect(findHonorificCorruptions('ولي قال زيد', 'ﷺ قال زيد')).toEqual([
            expect.objectContaining({ honorific: 'ﷺ', primaryEnd: 3, primaryStart: 0, primaryText: 'ولي' }),
        ]);
    });
});
