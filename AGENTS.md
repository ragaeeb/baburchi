# Agent Guide

Welcome to **baburchi**, a Bun-first TypeScript library that fixes OCR typos and normalises paragraphs. This document applies to the entire repository and should be read before making any changes.

## Repository map

- `src/` – library source files. Core entry point is `src/index.ts`, which re-exports helpers from:
  - `src/alignment.ts` for paragraph alignment utilities.
  - `src/footnotes.ts` for detecting footnotes/endnotes.
  - `src/fuzzy.ts` for fuzzy string helpers.
  - `src/typos.ts` for typo correction primitives plus accompanying tests in `src/typos.test.ts`.
  - `src/utils/` for shared helpers such as `sanitize.ts` (input cleanup) and `similarity.ts` (scoring).
- `tsdown.config.mjs` – bundler configuration consumed by tsdown.
- `tsconfig*.json` – TypeScript base config plus `tsconfig.build.json` for declaration-only builds.
- `biome.json` – Biome formatter/linter configuration.
- `README.md` – user-facing documentation. Update it whenever you add or change public APIs.

## Tooling & workflows

- Use **Bun ≥ 1.2** for scripts (`bun run ...`), running `bun test`, and dependency management.
- Build artifacts via `bun run build`, which invokes the upstream `tsdown` CLI defined in `devDependencies`. Never check `dist/` into git.
- Run `bun update --latest` when asked to refresh dependencies; commit resulting `bun.lock` changes.
- Lint with `bun run lint` (Biome) to keep formatting and diagnostics consistent.

## Coding conventions

- All exported functions must include complete JSDoc blocks describing params, return values, edge cases, and usage hints.
- Prefer small, pure helpers over large multi-purpose functions. Keep data transforms immutable where possible.
- Write exhaustive unit tests for any new helper in the same directory (e.g., `src/foo.ts` → `src/foo.test.ts`). Tests should cover happy paths plus boundary/error scenarios.
- Follow existing naming patterns (`camelCase` for functions/constants, `PascalCase` for types/interfaces).
- Avoid adding new dependencies unless absolutely necessary; this library aims to stay lightweight.

## Documentation standards

- When adding features, update both `README.md` (public API overview) and, if workflow changes, this `AGENTS.md`.
- Keep changelog/release automation (`CHANGELOG.MD`, `release.config.mjs`) untouched unless feature work requires it.

## Pull request expectations

- Keep diffs focused. If you must make mechanical changes (formatting, renames), isolate them in separate commits.
- Always run `bun test` and `bun run build` locally and include the commands/output in your final report.
- Provide context in commit messages/PR bodies so downstream reviewers understand the motivation for each change.

Happy hacking!
