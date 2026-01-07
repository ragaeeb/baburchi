# baburchi demo

A minimal Solid + Vite experience for exploring every exported function in the **baburchi** OCR post-processing library.
The interface provides a sidebar for each API, pre-filled examples, and a one-click "Format" action to see results.

**Live demo:** https://baburchi.surge.sh

## What this demo showcases

- A complete function explorer covering all baburchi exports.
- Arabic-aware examples with right-to-left input where appropriate.
- Instant formatting output powered by the library APIs.

## Requirements

- [Bun](https://bun.sh/) 1.2+ (preferred package manager)

## Local development

```bash
bun install
bun run dev
```

Open http://localhost:5173 to view the app.

## Build for production

```bash
bun run build
```

The static site is generated in `dist/`.

## Preview the production build

```bash
bun run preview
```

## Linting

```bash
bun run lint
```

## Deployment

This demo is deployed with [Surge](https://surge.sh) at https://baburchi.surge.sh.
The `public/CNAME` file ensures the correct domain is used during deployment.
