import { createMemo, createSignal, For, Show } from 'solid-js';
import rootPackage from '../../package.json';
import { type DemoEntry, entries } from './examples';
import './App.css';

const categories = [...new Set(entries.map((entry) => entry.category))];
const inputLabels: Record<string, string[]> = {
    alignTextSegments: ['Target lines · one per line', 'OCR segments · one per line'],
    alignTokenSequences: ['Token sequence A', 'Token sequence B'],
    areSimilarAfterNormalization: ['Text A', 'Text B'],
    backtrackAlignment: ['Token sequence A', 'Token sequence B'],
    boundedLevenshtein: ['Text A', 'Text B'],
    calculateAlignmentScore: ['Token A', 'Token B'],
    calculateLevenshteinDistance: ['Text A', 'Text B'],
    calculateSimilarity: ['Text A', 'Text B'],
    findHonorificCorruptions: ['Primary OCR', 'Reference OCR'],
    findMatches: ['Pages · one per line, starting at 0', 'Excerpts · one per line'],
    findMatchesAll: ['Pages · one per line, starting at 0', 'Excerpts · one per line'],
    fixTypo: ['Original OCR', 'Reference OCR'],
    handleFootnoteFusion: ['Result tokens so far', 'Previous token', 'Current token'],
    handleFootnoteSelection: ['Token A', 'Token B'],
    handleStandaloneFootnotes: ['Token A', 'Token B'],
    isSimilarityAboveThreshold: ['Text A', 'Text B'],
    processTextAlignment: ['Original OCR', 'Reference OCR'],
};

function App() {
    const [selectedEntry, setSelectedEntry] = createSignal(entries[0]);
    const [query, setQuery] = createSignal('');
    const [category, setCategory] = createSignal('All functions');
    const [inputValues, setInputValues] = createSignal(entries[0].placeholder.split('\n---\n'));
    const [example, setExample] = createSignal('Typical case');
    const [output, setOutput] = createSignal<string | null>(null);
    const [errorMessage, setErrorMessage] = createSignal('');

    const filteredEntries = createMemo(() => {
        const search = query().trim().toLowerCase();
        return entries.filter(
            (entry) =>
                (category() === 'All functions' || entry.category === category()) &&
                `${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(search),
        );
    });
    const labels = createMemo(() => inputLabels[selectedEntry().id] ?? ['Text']);
    const structuredOutput = createMemo(() => /^[[{]/.test(output() ?? ''));

    const run = () => {
        try {
            // Keep quadratic alignment examples responsive with user-supplied text.
            if (inputValues().join('\n---\n').length > 2000) {
                throw new Error('Please keep the combined input under 2,000 characters for this browser demo.');
            }
            setOutput(selectedEntry().apply(inputValues().join('\n---\n')));
            setErrorMessage('');
        } catch (error) {
            setOutput(null);
            setErrorMessage(error instanceof Error ? error.message : 'Unable to run this input.');
        }
    };

    const loadExample = (alternate = false) => {
        setInputValues((alternate ? selectedEntry().alternative : selectedEntry().placeholder).split('\n---\n'));
        setExample(alternate ? 'Compare behavior' : 'Typical case');
        run();
    };

    const selectEntry = (entry: DemoEntry) => {
        setSelectedEntry(entry);
        loadExample();
    };

    const editField = (index: number, value: string) => {
        const values = [...inputValues()];
        values[index] = value;
        setInputValues(values);
        setExample('Custom input');
        setOutput(null);
        setErrorMessage('');
    };

    run();

    return (
        <div class="app-shell">
            <aside class="sidebar" aria-label="Function explorer">
                <a class="brand" href="https://github.com/ragaeeb/baburchi">
                    <span class="brand__mark" aria-hidden="true">
                        ب
                    </span>
                    <span>
                        baburchi <small>TEXT TOOLKIT</small>
                    </span>
                </a>
                <label class="search-label" for="function-search">
                    Find a function
                </label>
                <input
                    id="function-search"
                    type="search"
                    placeholder="Search names or tasks…"
                    value={query()}
                    onInput={(event) => setQuery(event.currentTarget.value)}
                />
                <label class="sr-only" for="category">
                    Filter by category
                </label>
                <select id="category" value={category()} onChange={(event) => setCategory(event.currentTarget.value)}>
                    <option>All functions</option>
                    <For each={categories}>{(group) => <option>{group}</option>}</For>
                </select>
                <p class="function-count" role="status">
                    {filteredEntries().length} of {entries.length} functions
                </p>
                <nav class="sidebar__nav" aria-label="Functions">
                    <For each={categories}>
                        {(group) => (
                            <Show when={filteredEntries().some((entry) => entry.category === group)}>
                                <section class="nav-group">
                                    <h2>{group}</h2>
                                    <For each={filteredEntries().filter((entry) => entry.category === group)}>
                                        {(entry) => (
                                            <button
                                                class="sidebar__item"
                                                aria-current={selectedEntry().id === entry.id ? 'true' : undefined}
                                                onClick={() => selectEntry(entry)}
                                                type="button"
                                                title={entry.description}
                                            >
                                                <span>{entry.name}</span>
                                                <span aria-hidden="true">↗</span>
                                            </button>
                                        )}
                                    </For>
                                </section>
                            </Show>
                        )}
                    </For>
                    <Show when={filteredEntries().length === 0}>
                        <p class="empty-search">No functions found. Try “footnote”, “noise” or “alignment”.</p>
                        <button
                            type="button"
                            class="text-button"
                            onClick={() => {
                                setQuery('');
                                setCategory('All functions');
                            }}
                        >
                            Clear filters
                        </button>
                    </Show>
                </nav>
                <div class="sidebar__footer">
                    Local library build <span>v{rootPackage.version}</span>
                </div>
            </aside>

            <main class="main">
                <header class="intro">
                    <p class="eyebrow">THE OCR WORKBENCH</p>
                    <h1>
                        Messy text. <em>Clear results.</em>
                    </h1>
                    <p>
                        Explore Arabic text repair, matching and cleanup. Pick a function, compare examples, then try
                        your own text.
                    </p>
                </header>

                <section class="workbench" aria-labelledby="function-title">
                    <header class="function-header">
                        <p class="eyebrow">{selectedEntry().category}</p>
                        <h2 id="function-title">
                            {selectedEntry().name}
                            <span>()</span>
                        </h2>
                        <p>{selectedEntry().description}</p>
                    </header>

                    <div class="example-bar">
                        <span>Try an example</span>
                        <button type="button" aria-pressed={example() === 'Typical case'} onClick={() => loadExample()}>
                            Typical case
                        </button>
                        <button
                            type="button"
                            aria-pressed={example() === 'Compare behavior'}
                            onClick={() => loadExample(true)}
                        >
                            Compare behavior
                        </button>
                    </div>

                    <div class="io-grid">
                        <section class="input-pane" aria-labelledby="input-heading">
                            <div class="pane-heading">
                                <h3 id="input-heading">01 / Input</h3>
                                <span>{example()}</span>
                            </div>
                            <Show when={selectedEntry().id === 'correctReferences'}>
                                <p class="input-help">Prefix footnote lines with FN:; leave body lines unprefixed.</p>
                            </Show>
                            <For each={labels()}>
                                {(label, index) => (
                                    <div class="input-field">
                                        <label for={`input-${index()}`}>{label}</label>
                                        <textarea
                                            id={`input-${index()}`}
                                            dir={selectedEntry().direction ?? 'ltr'}
                                            value={inputValues()[index()] ?? ''}
                                            rows={labels().length > 1 ? 3 : 5}
                                            maxLength={2000}
                                            spellcheck={false}
                                            onInput={(event) => editField(index(), event.currentTarget.value)}
                                        />
                                    </div>
                                )}
                            </For>
                            <div class="input-actions">
                                <button class="action-button" onClick={run} type="button">
                                    Run function <span aria-hidden="true">→</span>
                                </button>
                                <button class="text-button" onClick={() => loadExample()} type="button">
                                    Reset example
                                </button>
                            </div>
                        </section>

                        <section class="output-pane" aria-labelledby="output-heading">
                            <div class="pane-heading">
                                <h3 id="output-heading">02 / Result</h3>
                                <span>{structuredOutput() ? 'JSON' : 'Value'}</span>
                            </div>
                            <div class="result" aria-live="polite" aria-atomic="true">
                                <Show when={errorMessage()}>
                                    <p class="error" role="alert">
                                        {errorMessage()}
                                    </p>
                                </Show>
                                <Show when={!errorMessage()}>
                                    <Show
                                        when={output() !== null}
                                        fallback={
                                            <p class="result-placeholder">
                                                Input changed. Run the function to see the new result.
                                            </p>
                                        }
                                    >
                                        <pre dir={structuredOutput() ? 'ltr' : 'auto'}>
                                            {output() === '' ? '(empty string)' : output()}
                                        </pre>
                                    </Show>
                                </Show>
                            </div>
                            <div class="result-note">
                                <h4>How to read this</h4>
                                <p>{selectedEntry().resultNote}</p>
                            </div>
                        </section>
                    </div>
                </section>
                <footer class="footer">
                    <span>Runs locally in your browser. Text stays on this page.</span>
                    <a href="https://github.com/ragaeeb/baburchi#readme">API documentation ↗</a>
                </footer>
            </main>
        </div>
    );
}

export default App;
