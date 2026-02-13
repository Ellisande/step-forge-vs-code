# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension providing IDE support for the [Step Forge](https://www.npmjs.com/package/@step-forge/step-forge) BDD testing framework. Features include Gherkin language support (.feature files), step definition autocomplete, go-to-definition, linting (undefined steps, dependency validation), and quick-fix code actions.

## Build & Development Commands

```bash
npm run compile        # Compile TypeScript to out/
npm run watch          # Watch mode (used during development)
npm run lint           # ESLint on src/
npm test               # Run tests (compiles + lints first via pretest)
npm run vscode:prepublish  # Prepare for marketplace publishing
```

Tests use `@vscode/test-cli` with Mocha. Test files live in `src/test/` and must be compiled before running (test config looks for `out/test/**/*.test.js`).

To debug the extension: F5 in VS Code launches it in a dev window with the `example/` directory as the test workspace.

## Architecture

**Entry point:** `src/extension.ts` — registers all providers, sets up file watchers for `.feature` and `.ts` files, manages diagnostic collections.

**Parsers** (language analysis):
- `src/parsers/stepParser.ts` — Core engine. Uses the TypeScript compiler API to walk ASTs of step definition files. Extracts step patterns (from `.statement()` builder chains), dependencies (from `.dependencies()`), and return types. Shared instance consumed by all providers.
- `src/parsers/gherkinParser.ts` — Uses `@cucumber/gherkin` to parse `.feature` files into structured scenarios/steps.

**Providers** (VS Code integration):
- `completionProvider.ts` — Autocomplete on Given/When/Then/And/But keywords, matching partial text against known step patterns.
- `definitionProvider.ts` — Ctrl+Click navigation from Gherkin step text to TypeScript source.
- `stepDefinitionDiagnosticsProvider.ts` — Error diagnostics for undefined steps.
- `stepStateDiagnosticsProvider.ts` — Validates step dependency chains (required state properties) and provides quick-fix code actions to insert missing prerequisite steps.

**Data flow:** Extension activates → StepParser parses all `**/features/**/*.ts` files → file watchers re-parse on changes → providers query StepParser for step definitions when serving completions, diagnostics, or navigation.

## Code Style

- ESLint flat config (`eslint.config.mjs`): camelCase/PascalCase naming, curly braces required, strict equality, semicolons required.
- Prettier (configured in package.json): single quotes, trailing commas, semicolons.
- TypeScript strict mode, target ES2022, CommonJS output.

## Key Dependencies

- `@step-forge/step-forge` — The BDD framework this extension supports
- `@cucumber/gherkin` + `@cucumber/messages` — .feature file parsing
- TypeScript compiler API (bundled with `typescript` dep) — AST analysis of step definitions
