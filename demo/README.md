# baburchi demo

A compact Solid + Vite workbench for exploring the library’s 41 public functions.
Search by function name or task, filter by category, and compare two curated examples per function.

**Live demo:** <https://baburchi.surge.sh> (reflects the last deployment).

## Using the explorer

- Each function explains its purpose, input format and how to interpret its result.
- Multi-argument functions have separate labeled fields; you do not need to type separators.
- Input and output stay separate. Editing clears the previous result; **Run function** computes the new one.
- **Typical case**, **Compare behavior**, and **Reset example** load and run examples immediately.
- Arabic inputs use right-to-left text; JSON results use left-to-right layout.
- The result shows `null`, empty strings, page indices and mutated token arrays explicitly.
- Inputs stay in the browser. The combined input is limited to 2,000 characters to keep alignment responsive.

## Local development

Requires Bun ≥ 1.3.11. From the repository root:

```bash
bun install
cd demo
bun install
bun run dev
```

Open <http://localhost:5173>. The demo imports `../dist/index.js`; its dev and build scripts
build the checked-out library first rather than using a published package. Restart the demo
when changing library source so the build is refreshed.

## Validation

From the repository root:

```bash
bun run build
bun test
bun run lint
cd demo
bun run build
```

## Deployment

From `demo/`, run `bun run deploy` to build and publish with Surge.
