import { describe, expect, it } from 'bun:test';
import { findMatches, findMatchesAll } from './fuzzy';

describe('fuzzy', () => {
    describe('findMatches', () => {
        it('should return -1 for empty excerpts', () => {
            const pages = ['test page'];
            const excerpts = [''];
            const result = findMatches(pages, excerpts);
            expect(result).toEqual([-1]);
        });

        it('should return -1 for empty pages', () => {
            const pages: string[] = [];
            const excerpts = ['test'];
            const result = findMatches(pages, excerpts);
            expect(result).toEqual([-1]);
        });

        it('should handle empty input arrays', () => {
            const pages: string[] = [];
            const excerpts: string[] = [];
            const result = findMatches(pages, excerpts);
            expect(result).toEqual([]);
        });

        describe('exact matches', () => {
            it('should find exact substring matches', () => {
                const pages = ['هذه صفحة تمهيدية', 'هذه الصفحة تحتوي على النص المطلوب', 'صفحة أخرى'];
                const excerpts = ['النص المطلوب'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([1]);
            });

            it('should match multiple excerpts correctly', () => {
                const pages = [
                    'الصفحة الأولى تحتوي على النص الأول',
                    'الصفحة الثانية تحتوي على النص الثاني',
                    'صفحة عادية',
                ];
                const excerpts = ['النص الأول', 'النص الثاني', 'نص غير موجود'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0, 1, -1]);
            });

            it('should prefer earlier pages when same excerpt appears multiple times', () => {
                const repeated = 'نص مكرر';
                const pages = [`قبل ${repeated} بعد`, 'صفحة وسطى', `مرة أخرى ${repeated} هنا`];
                const excerpts = [repeated];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]); // first occurrence
            });
        });

        describe('real examples', () => {
            it('should match it', () => {
                const pages = [
                    'قلت: ما أعتقد أن ابن لهيعة رواه.\nقتيبة، حدثنا ابن لهيعة، عن عطاء، عن ابن عباس - أن رسول الله صلى الله عليه وسلم قال: ما من قوم يغدو عليهم ويروح عشرون عنزا أسود فيخافون العالة.\nوبإسناد مظلم من حديث ابن لهيعة، وكأن الآفة من بعد عن محمد بن عبد الرحمن ابن نوفل، عن عامر بن عبد الله بن الزبير، عن أبيه، عن علي - مرفوعا: الهم نصف الهرم، وقلة العيال أحد اليسارين - في حديث طويل منه ألفاظ في الشهاب للقضاعى.\nأخبرنا أبو المعالى الابرقوهى، أخبرنا أبو الفرج الكاتب، أخبرنا الارموى، وابن الداية، ومحمد بن أحمد الطرائفي، قالوا: أخبرنا أبو جعفر بن المسلمة، أخبرنا أبو الفضل [الكاتب] الزهري سنة ثمان وثلثمائة، أخبرنا جعفر الفريابي سنة ثمان وتسعين ومائتين، حدثنا قتيبة، حدثنا ابن لهيعة، قال الفريابي: وحدثنا هشام بن عمار، حدثنا أسد ابن موسى، حدثنا ابن لهيعة، عن الحارث بن يزيد، عن علي بن رباح، عن عبد الله ابن عمرو، قال: كان النفاق غريبا في الايمان، ويوشك أن يكون الايمان غريبا في النفاق.\n(١ [ثقتان، قال: حدثنا إبراهيم بن الهيثم، حدثنا عمرو بن خالد، حدثنا ابن لهيعة، عن بكير بن الاشج، عن نافع، عن ابن عمر - أن النبي صلى الله عليه وسلم قال: من يسافر من دار إقامة يوم الجمعة دعت عليه الملائكة، لا يصحب في سفره ولا يعان على حاجته] ١) .\nعثمان بن صالح، عن ابن لهيعة، عن عطاء، عن ابن عباس، عن النبي صلى الله عليه وسلم، قال: عمر منى، وأنا من عمر، والحق بعدى مع عمر.\nمنصور بن عمار، حدثنا ابن لهيعة، عن عمرو بن شعيب، عن أبيه، عن جده - مرفوعا: من توضأ في موضع بوله فأصابه الوسواس فلا يلومن إلا نفسه.\nمحمد بن معاوية النيسابوري، أخبرنا ابن لهيعة، عن عمرو، عن أبيه، عن جده - رفعه إذا رأيتم الحريق فكبروا، فإن ذلك يطفئه.\nقال ابن حبان: مولد ابن لهيعة سنة ست وتسعين، ومات سنة أربع وسبعين ومائة.\nوكان صالحا، لكنه يدلس عن الضعفاء، ثم احترقت كتبه، وكان أصحابنا يقولون: سماع من سمع منه قبل احتراق كتبه مثل العبادلة: عبد الله بن وهب، وابن المبارك، وعبد الله بن يزيد المقرئ، وعبد الله بن مسلمة القعنبي - فسماعهم صحيح.\nوكان ابن لهيعة من الكتابين للحديث والجماعين للعلم والرحالين فيه، ولقد حدثني شكر، حدثنا يوسف بن سعيد بن مسلم، عن بشر بن المنذر، قال: كان ابن لهيعة يكنى أبا خريطة، وذلك أنه كانت له خريط معلقة في عنقه، وكان يدور بمصر، فكلما قدم قوم كان يدور عليهم ويسألهم.\nقال ابن حبان: قد سبرت أخباره في رواية المتقدمين والمتأخرين عنه فرأيت [٧٤ / ٣] التخليط في رواية المتأخر عنه موجودا وما لا أصل له / في رواية المتقدمين كثيرا، فرجعت إلى الاعتبار فرأيته كان يدلس عن أقوام ضعفى على أقوام رآهم ابن لهيعة ثقات، فألزق تلك الموضوعات بهم.\nحرملة، حدثنا ابن وهب، عن ابن لهيعة، عن عبيد الله بن أبي جعفر، عن نافع، عن ابن عمر - أن رسول الله صلى الله عليه وسلم قال: من خرج من الجماعة قيد شبر فقد خلع ربقة الإسلام عن عنقه حتى يراجعها.\nوحدثنا أبو يعلى، حدثنا كامل بن طلحة، حدثنا ابن لهيعة، حدثني يحيى بن عبد الله المعافرى، عن أبي عبد الرحمن الحبلى، عن عبد الله بن عمرو - أن رسول الله صلى الله عليه وسلم قال في مرضه: ادعوا لي أخي، فدعى أبو بكر فأعرض عنه، ثم قال: ادعوا لي أخي، فدعى له عثمان، فأعرض عنه، ثم دعى له علي فستره بثوبه وأكب',
                    'عليه، فلما خرج من عنده قيل له: ما قال لك؟ قال: علمني ألف باب كل باب يفتح ألف باب.\nقلت: كامل صدوق.\nوقال ابن عدي: لعل البلاء فيه من ابن لهيعة، فإنه مفرط في التشيع.\nوقال البخاري في كتاب الضعفاء في ذكر ابن لهعية تعليقا: الجعفي، حدثنا المقرئ، حدثنا ابن لهيعة، حدثني أبو طعمة، قال: كنت عند ابن عمر إذ جاءه فسأله عن صيام رمضان في السفر، قال: أفطر، فقال الرجل: أجدني أقوى، فأعاد عليه ثلاثا، ثم قال ابن عمر: سمعت رسول الله صلى الله عليه وسلم يقول: من لم يقبل رخصة الله فعليه من الاثم مثل جبال عرفات.\nقال البخاري: هذا منكر، ثم قال البخاري: حدثني أحمد بن عبد الله، أخبرنا صدقة بن عبد الرحمن، حدثنا ابن لهيعة، عن مشرح بن هاعان، عن عقبة بن عامر، سمعت رسول الله صلى الله عليه وسلم يقول: لو تمت البقرة ثلاثمائة آية لتكلمت.',
                ];

                const excerpts = [
                    'محمد بن معاوية النيسابوري، أخبرنا ابن لهيعة، عن عمرو، عن أبيه، عن جده - رفعه إذا رأيتم الحريق فكبروا، فإن ذلك يطفئه.\nقال ابن حبان: مولد ابن لهيعة سنة ست وتسعين، ومات سنة أربع وسبعين ومائة.\nوكان صالحا، لكنه يدلس عن الضعفاء، ثم احترقت كتبه، وكان أصحابنا يقولون: سماع من سمع منه قبل احتراق كتبه مثل العبادلة: عبد الله بن وهب، وابن المبارك، وعبد الله بن يزيد المقرئ، وعبد الله بن مسلمة القعنبي - فسماعهم صحيح.\nوكان ابن لهيعة من الكتابين للحديث والجماعين للعلم والرحالين فيه، ولقد حدثني شكر، حدثنا يوسف بن سعيد بن مسلم، عن بشر بن المنذر، قال: كان ابن لهيعة يكنى أبا خريطة، وذلك أنه كانت له خريط معلقة في عنقه، وكان يدور بمصر، فكلما قدم قوم كان يدور عليهم ويسألهم.\nقال ابن حبان: قد سبرت أخباره في رواية المتقدمين والمتأخرين عنه فرأيت [74/3] التخليط في رواية المتأخر عنه موجودا وما لا أصل له / في رواية المتقدمين كثيرا، فرجعت إلى الاعتبار فرأيته كان يدلس عن أقوام ضعفى على أقوام رآهم ابن لهيعة ثقات، فألزق تلك الموضوعات بهم.\nحرملة، حدثنا ابن وهب، عن ابن لهيعة، عن عبيد الله بن أبي جعفر، عن نافع، عن ابن عمر - أن رسول الله صلى الله عليه وسلم قال: من خرج من الجماعة قيد شبر فقد خلع ربقة الإسلام عن عنقه حتى يراجعها.\nوحدثنا أبو يعلى، حدثنا كامل بن طلحة، حدثنا ابن لهيعة، حدثني يحيى بن عبد الله المعافرى، عن أبي عبد الرحمن الحبلى، عن عبد الله بن عمرو - أن رسول الله صلى الله عليه وسلم قال في مرضه: ادعوا لي أخي، فدعى أبو بكر فأعرض عنه، ثم قال: ادعوا لي أخي، فدعى له عثمان، فأعرض عنه، ثم دعى له علي فستره بثوبه وأكب عليه، فلما خرج من عنده قيل له: ما قال لك؟ قال: علمني ألف باب كل باب يفتح ألف باب.\nقلت: كامل صدوق.\nوقال ابن عدي: لعل البلاء فيه من ابن لهيعة، فإنه مفرط في التشيع.\nوقال البخاري في كتاب الضعفاء في ذكر ابن لهعية تعليقا: الجعفي، حدثنا المقرئ، حدثنا ابن لهيعة، حدثني أبو طعمة، قال: كنت عند ابن عمر إذ جاءه فسأله عن صيام رمضان في السفر، قال: أفطر، فقال الرجل: أجدني أقوى، فأعاد عليه ثلاثا، ثم قال ابن عمر: سمعت رسول الله صلى الله عليه وسلم يقول: من لم يقبل رخصة الله فعليه من الاثم مثل جبال عرفات.\nقال البخاري: هذا منكر، ثم قال البخاري: حدثني أحمد بن عبد الله، أخبرنا صدقة بن عبد الرحمن، حدثنا ابن لهيعة، عن مشرح بن هاعان، عن عقبة بن عامر، سمعت رسول الله صلى الله عليه وسلم يقول: لو تمت البقرة ثلاثمائة آية لتكلمت.',
                ];

                const result = findMatches(pages, excerpts);

                expect(result).toEqual([0]);
            });

            it('should match the substring', () => {
                const pages = [
                    'بشر بن معاوية البكالي .\nروى عنه يعقوب بن محمد الزهري.\nذكره أبو حاتم.\nمجهول.',
                    'بشر بن المنذر قاضى المصيصة.\nقال العقيلي: في حديثه وهم.\nله عن محمد بن مسلم الطائفي.',
                    'بشر بن مهران الخصاف.\nعن شريك.\nقال ابن أبي حاتم: ترك أبي حديثه.\nويقال بشير.\nقلت: قد روى عنه محمد بن زكريا الغلابي [لكن الغلابي] متهم.\nقال:\nحدثنا شريك، عن الأعمش، عن زيد بن وهب، عن حذيفة، قال: قال رسول الله صلى الله عليه وسلم: من سره أن يحيا حياتي ويموت ميتتي ويتمسك بالقضيب الياقوت فليتول علي بن أبي طالب من بعدي.',
                    'بشر بن ميمون.\nعن القاسم أبى عبد الرحمن.\nوعنه بشر بن المفضل، رحل عابد.\nقواه ابن معين.\nوقال أبو حاتم: أحاديثه منكرة.',
                    'بشر بن منصور [ق] .\nشيخ للاشج، يجهل.\nله عن أبي محمد، عن أبي المغيرة، عن ابن عباس - مرفوعا: أبي الله أن يقبل عمل صاحب بدعة.\nفأما: ١٢٢٧ - بشر بن منصور السليمي الزاهد، عن الجريري، وأيوب، وعاصم الأحول، وطائفة - فوثقوه.\nقال القواريري: هو أفضل من رأيت من المشايخ.\nقلت: خرج له مسلم وأبو داود والنسائي.',
                    'بشر بن نمير [ق] القشيري البصري .\nعن مكحول، والقاسم ابن عبد الرحمن.\nوعنه أبو عوانة، ويزيد بن زريع، وابن وهب، وطائفة.',
                ];

                const excerpts = [
                    'بشر بن مهران الخصاف.\nعن شريك.\nقال ابن أبي حاتم: ترك أبي حديثه.\nويقال بشير.\nقلت: قد روى عنه محمد بن زكريا الغلابي [لكن الغلابي] متهم.\nقال:\nحدثنا شريك، عن الأعمش، عن زيد بن وهب، عن حذيفة، قال: قال رسول الله: من سره أن يحيا حياتي ويموت ميتتي ويتمسك بالقضيب الياقوت فليتول علي بن أبي طالب من بعدي.',
                ];

                const result = findMatches(pages, excerpts);
                expect(result).toEqual([2]);
            });
        });

        describe('cross page matching', () => {
            it('should match text that spans across page boundaries', () => {
                const pages = ['نص ينتهي بكلمة أخيرة', 'أولى ثم يستمر النص هنا'];
                const excerpts = ['أخيرة أولى ثم يستمر'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]); // maps to starting page
            });

            it('should handle complex cross-page scenarios', () => {
                const pages = ['قصة طويلة تنتهي بـ واكب', 'عليه السلام ثم تستمر القصة بتفاصيل أكثر', 'نهاية القصة'];
                const excerpts = ['تنتهي بـ واكب عليه السلام ثم تستمر'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]);
            });
        });

        describe('normalization', () => {
            it('should handle Arabic-Indic vs ASCII digit differences', () => {
                const pages = ['النص يحتوي على رقم [٧٤/٣] في الوسط', 'صفحة أخرى'];
                const excerpts = ['رقم [74/3] في الوسط'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]);
            });

            it('should handle punctuation normalization', () => {
                const pages = ['قال: "هذا نص مهم" ثم أكمل.', 'صفحة عادية'];
                const excerpts = ['قال هذا نص مهم ثم أكمل'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]);
            });
        });

        describe('fuzzy matching', () => {
            it('should not match when fuzzy is disabled', () => {
                const pages = ['النص الكامل وفيه قال رسول الله صلى الله عليه وسلم ثم تتمة'];
                const excerpts = ['قال رسول الله ثم تتمة'];

                const result = findMatches(pages, excerpts, { enableFuzzy: false });
                expect(result).toEqual([-1]);
            });
        });

        describe('duplicate handling', () => {
            it('should handle duplicate excerpts correctly', () => {
                const pages = ['صفحة تحتوي على النص المطلوب', 'صفحة أخرى'];
                const excerpts = ['النص المطلوب', 'النص المطلوب'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0, 0]);
            });

            it('should deduplicate internally but return correct mapping', () => {
                const pages = ['صفحة واحدة تحتوي على: نص فريد'];
                const excerpts = ['نص فريد', 'نص فريد', 'نص فريد'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0, 0, 0]);
            });
        });

        describe('edge cases', () => {
            it('should handle very short excerpts', () => {
                const pages = ['أ ب ج د ه', 'و ز ح ط ي'];
                const excerpts = ['ج', 'ز', 'غ'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0, 1, -1]);
            });

            it('should handle excerpts longer than pages', () => {
                const pages = ['قصير'];
                const excerpts = ['هذا نص طويل جداً أطول من الصفحة نفسها'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([-1]);
            });

            it('should handle Arabic text with mixed content', () => {
                const pages = ['النص العربي مع English mixed content والأرقام 123', 'صفحة أخرى'];
                const excerpts = ['النص العربي مع English mixed'];
                const result = findMatches(pages, excerpts);
                expect(result).toEqual([0]);
            });
        });
    });

    describe('findMatchesAll', () => {
        describe('basic functionality', () => {
            it('should return empty arrays for no matches', () => {
                const pages = ['صفحة أولى', 'صفحة ثانية'];
                const excerpts = ['نص غير موجود', 'نص آخر غير موجود'];
                const result = findMatchesAll(pages, excerpts);
                expect(result).toEqual([[], []]);
            });

            it('should return all matching pages for single excerpt', () => {
                const repeated = 'نص مكرر';
                const pages = [`قبل ${repeated} بعد`, 'صفحة وسطى', `مرة أخرى ${repeated} هنا`, 'نهاية'];
                const excerpts = [repeated];
                const result = findMatchesAll(pages, excerpts);
                expect(result).toEqual([[0, 2]]); // both pages with exact matches
            });

            it('should handle multiple excerpts with varying matches', () => {
                const pages = ['الصفحة الأولى نص أول', 'الصفحة الثانية نص ثاني', 'الصفحة الثالثة نص أول مرة أخرى'];
                const excerpts = ['نص أول', 'نص ثاني', 'نص غير موجود'];
                const result = findMatchesAll(pages, excerpts);
                expect(result).toEqual([[0, 2], [1], []]);
            });
        });

        describe('ranking', () => {
            it('should prioritize exact matches over fuzzy matches', () => {
                const pages = [
                    'نص تقريبي يشبه المطلوب قليلاً', // fuzzy match
                    'النص المطلوب بالضبط', // exact match
                    'صفحة أخرى',
                ];
                const excerpts = ['النص المطلوب بالضبط'];
                const result = findMatchesAll(pages, excerpts);
                expect(result).toEqual([[1]]); // exact match only
            });

            it('should rank fuzzy matches by quality', () => {
                const pages = [
                    'نص مختلف تماماً عن المطلوب', // poor fuzzy match
                    'النص المطلوب تقريباً', // better fuzzy match
                    'صفحة أخرى',
                ];
                const excerpts = ['النص المطلوب'];

                // With fuzzy enabled, should find better match first
                const result = findMatchesAll(pages, excerpts, { enableFuzzy: true });
                expect(result[0]).toContain(1);
            });

            it('should maintain reading order for equal quality matches', () => {
                const exact = 'نص متطابق';
                const pages = [`قبل ${exact} بعد`, 'وسط', `مرة أخرى ${exact} نهاية`];
                const excerpts = [exact];
                const result = findMatchesAll(pages, excerpts);
                expect(result).toEqual([[0, 2]]); // reading order: 0 before 2
            });
        });

        describe('comprehensive scenarios', () => {
            it('should handle mixed exact and fuzzy matches', () => {
                const pages = [
                    'النص الأول بالضبط', // exact for first excerpt
                    'النص الثاني تقريباً مع اختلاف بسيط', // fuzzy for second excerpt
                    'النص الثالث مختلف جداً', // no match for third excerpt
                    'النص الأول بالضبط مرة أخرى', // another exact for first excerpt
                ];
                const excerpts = ['النص الأول بالضبط', 'النص الثاني تقريباً', 'نص غير موجود'];

                const result = findMatchesAll(pages, excerpts);
                expect(result[0]).toEqual([0, 3]); // exact matches for first excerpt
                expect(result[1]).toEqual([1]); // fuzzy match for second excerpt
                expect(result[2]).toEqual([]); // no match for third excerpt
            });
        });
    });

    it('exact: finds a substring entirely within a single page', () => {
        const pages = [
            'هذه صفحة تمهيدية لا تحتوي على المطلوب',
            'هذه الصفحة الثانية تحتوي على العبارة المستهدفة داخل النص بشكل واضح',
            'صفحة ثالثة عادية',
        ];
        const excerpts = ['العبارة المستهدفة داخل النص'];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([1]);
        expect(all).toEqual([[1]]);
    });

    it('cross-page (bleed): matches a substring that straddles the page boundary', () => {
        // page 0 ends with 'واكب', page 1 begins with 'عليه ...'
        const pages = ['نص طويل طويل ينتهي بكلمة واكب', 'عليه ثم يكمل الوصف في الصفحة التالية مع سياق إضافي'];
        const excerpts = ['ينتهي بكلمة واكب عليه ثم يكمل الوصف'];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        // Should map to the starting page (index 0)
        expect(result).toEqual([0]);
        expect(all).toEqual([[0]]);
    });

    it('normalization: handles Arabic-Indic vs ASCII digits & punctuation differences', () => {
        // The numeric token is different but aggressive sanitizer removes non-letters/spaces.
        const pages = [
            'قال ابن حبان قد سبرت أخباره في رواية المتقدمين والمتأخرين عنه فرأيت [٧٤ / ٣] التخليط في رواية المتأخر عنه موجودا',
            'صفحة اخرى',
        ];
        const excerpts = [
            'قال ابن حبان قد سبرت أخباره في رواية المتقدمين والمتأخرين عنه فرأيت [74/3] التخليط في رواية المتأخر عنه موجودا',
        ];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([0]);
        expect(all).toEqual([[0]]);
    });

    it('fuzzy: excerpt omits a common blessing phrase present in the page', () => {
        // Page includes "صلى الله عليه وسلم" after "رسول الله" but excerpt omits it.
        const pages = [
            'بشر بن معاوية البكالي .\nروى عنه يعقوب بن محمد الزهري.\nذكره أبو حاتم.\nمجهول.',
            'بشر بن المنذر قاضى المصيصة.\nقال العقيلي: في حديثه وهم.\nله عن محمد بن مسلم الطائفي.',
            'بشر بن مهران الخصاف.\nعن شريك.\nقال ابن أبي حاتم: ترك أبي حديثه.\nويقال بشير.\nقلت: قد روى عنه محمد بن زكريا الغلابي [لكن الغلابي] متهم.\nقال:\nحدثنا شريك، عن الأعمش، عن زيد بن وهب، عن حذيفة، قال: قال رسول الله صلى الله عليه وسلم: من سره أن يحيا حياتي ويموت ميتتي ويتمسك بالقضيب الياقوت فليتول علي بن أبي طالب من بعدي.',
            'بشر بن ميمون.\nعن القاسم أبى عبد الرحمن.\nوعنه بشر بن المفضل، رحل عابد.\nقواه ابن معين.\nوقال أبو حاتم: أحاديثه منكرة.',
        ];
        const excerpts = [
            'بشر بن مهران الخصاف.\nعن شريك.\nقال ابن أبي حاتم: ترك أبي حديثه.\nويقال بشير.\nقلت: قد روى عنه محمد بن زكريا الغلابي [لكن الغلابي] متهم.\nقال:\nحدثنا شريك، عن الأعمش، عن زيد بن وهب، عن حذيفة، قال: قال رسول الله: من سره أن يحيا حياتي ويموت ميتتي ويتمسك بالقضيب الياقوت فليتول علي بن أبي طالب من بعدي.',
        ];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        // Should resolve to page index 2 via fuzzy
        expect(result).toEqual([2]);
        expect(all).toEqual([[2]]);
    });

    it('duplicates: same exact text occurs on multiple pages → earliest wins, all lists both', () => {
        const repeated = 'هذا مقطع مكرر يظهر في أكثر من صفحة بحيث يمكن مطابقته نصاً دون تغيير';
        const pages = [
            'صفحة تمهيدية لا شيء فيها',
            `${repeated} ونص إضافي هنا`,
            'صفحة بينية لا علاقة لها',
            `قبل ذلك ${repeated} وبعد ذلك وصف آخر`,
        ];
        const excerpts = [repeated];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        // findMatches picks earliest page (1)
        expect(result).toEqual([1]);

        // findMatchesAll returns all exact pages best-first (reading order): [1, 3]
        expect(all).toEqual([[1, 3]]);
    });

    it('no match: returns -1 and []', () => {
        const pages = ['صفحة أولى', 'صفحة ثانية', 'صفحة ثالثة'];
        const excerpts = ['هذا النص غير موجود إطلاقاً'];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([-1]);
        expect(all).toEqual([[]]);
    });

    it('duplicate excerpts input: both map correctly (dedup build path)', () => {
        const pages = ['ملخص', 'في هذه الصفحة يوجد المطلوب بعينه وهو نص ثابت', 'خاتمة'];
        const excerpts = ['نص ثابت', 'نص ثابت']; // duplicated excerpt

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([1, 1]);
        expect(all).toEqual([[1], [1]]);
    });

    it('fuzzy disabled: near match that needs fuzzy should return -1 / []', () => {
        const pages = ['النص الكامل وفيه قال رسول الله صلى الله عليه وسلم ثم تتمة الفقرة'];
        const excerpts = ['قال رسول الله ثم تتمة الفقرة']; // omits blessing

        const result = findMatches(pages, excerpts, { enableFuzzy: false });
        const all = findMatchesAll(pages, excerpts, { enableFuzzy: false });

        expect(result).toEqual([-1]);
        expect(all).toEqual([[]]);
    });

    it('short excerpts (< q) still match exactly via AC', () => {
        const pages = ['هذا مثال قصير', 'هنا كلمة زيد تظهر بوضوح', 'نهاية'];
        const excerpts = ['زيد']; // length 3; AC can match, fuzzy skipped

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([1]);
        expect(all).toEqual([[1]]);
    });

    it('cross-page with larger surrounding context', () => {
        const pages = [
            'فقرة قبلية ثم ... نص أول ينتهي بـ واكب',
            'عليه وفقرة بعدية طويلة تتضمن تفاصيل إضافية حول الموضوع الذي نبحث عنه',
        ];
        const excerpts = ['نص أول ينتهي بـ واكب عليه وفقرة بعدية طويلة تتضمن تفاصيل'];

        const result = findMatches(pages, excerpts);
        const all = findMatchesAll(pages, excerpts);

        expect(result).toEqual([0]);
        expect(all).toEqual([[0]]);
    });
});
