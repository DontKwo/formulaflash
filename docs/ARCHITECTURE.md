# System Architecture

FormulaFlash is a local-first STEM flashcard and active-recall learning application designed for equations, mixed text and math fields, computer-algebra answer checking, and portable `.flashset` bundles across desktop and Android.

## Monorepo Layering

- **`packages/core`**: Pure TypeScript domain logic containing Zod data models, `.flashset` serialization, 4-tier math and text checking, Learn mode state machine, FSRS scheduler wrapper, layered settings provenance resolution, and the plugin registry. Enforces zero DOM, React, or Capacitor imports via `dependency-cruiser`.
- **`apps/app`**: React 19, Tailwind CSS, Zustand, MathLive, KaTeX, and jsPDF user interface packaged for Windows (`csc.exe` WebView loopback host), macOS/Linux (`scripts/unix_host.py` PyInstaller bundle), and Android (Capacitor).

## Data Model & Storage Contract

Zod schemas serve as the single source of truth for versioned persistence (`IndexedDB` / `localStorage` via `Repository` and portable `.flashset` bundles):

- **`Segment` & `RichContent`**: Portable arrays combining plain text, inline/display LaTeX math (`$...$` / `$$...$$`), image media, audio media, and plugin extension segments.
- **`CardSet`**: Stores `id`, `title`, `description`, `tags`, `folderId`, timestamps, per-set `settings` overrides, `defaultCardType`, optional symbol `glossary`, and plugin `extra` metadata.
- **`Card`**: Stores `id`, `setId`, `order`, `type` (`basic`, `equation`, `cloze`, `numeric`, `list`), `front` and `back` rich content, `AnswerSpec` (`checker`, accepted alternates array, checker `options`), progressive `hints`, post-answer `explanation`, `terms`, `starred`, and `media`.
- **`CardProgress` & `StudySession`**: Tracks per-card direction mastery (`front->back`, `back->front`), Learn levels (`0..3`), streaks, accuracy timing metrics, FSRS scheduling state, and resumable session snapshots.
- **`.flashset` Format**: Versioned JSON / ZIP bundle carrying `version: 2`, `schemaVersion: "2.0.0"`, `set`, `cards`, and optional `progress`, with strict `setId` relational validation and v1 forward migration in `migrateFlashsetBundle()`.

## 4-Tier Math Answer Checking Pipeline

Input LaTeX passes through normalization and opaque-symbol preservation before checking in ordered tiers:

1. **Preprocessing**: Normalizes whitespace, delimiters, `\dfrac` -> `\frac`, implicit/explicit multiplication symbols, units (`\mathrm` / `\text`), and rewrites decorated symbols (`\hat{R}`, `\bar{x}`, `\vec{v}`, `\dot{x}`) into distinct opaque tokens so `\hat{\rho}` and `\rho` remain distinct unless `accentsMatter: false`.
2. **Tier 1 (Normalized String)**: Direct equality check after preprocessing.
3. **Tier 2 (Structural AST)**: Parses expressions via `@cortex-js/compute-engine` to canonical MathJSON, supporting equation side swaps (`nRT = PV`) when `allowSideSwap` is enabled.
4. **Tier 3 (Algebraic & Numeric Sampling)**: Evaluates free variables across deterministic seeded positive real samples within `[0.5, 5]` (tolerance `1e-9`) when `allowEquivalentForms` is enabled.
5. **Tier 4 (Equation Rearrangement)**: Bidirectional solution-set verification across rotated solve-for variables (`PV = nRT`, `P = nRT / V`, `PV - nRT = 0`), rejecting tautologies such as `0 = 0` and checking shared variable sets.

Each result reports `Verdict.via` (`normalized`, `structural`, `numeric`, `indeterminate`, or `override`), paired with user escape hatches ("I don't know", "I was right" override, and saving alternates). Built-in non-equation checkers cover fuzzy `text`, unit-aware `numeric`, ordered/unordered `list`, and `cloze`.

## Adaptive Learn State Machine & Distractor Engine

- **Per-Card Mastery Levels (`packages/core/learn`)**:
  - Level `0` (`NEW`): Flashcard intro or True/False.
  - Level `1` (`INTRODUCED`): Multiple-choice recognition.
  - Level `2` (`FAMILIAR`): Written/typed recall gate (`Prove it`), requiring typed recall or consecutive MC confirmations when written mode is disabled.
  - Level `3` (`MASTERED`): Completed for the current round and seeded into FSRS spaced review (`Again`, `Hard`, `Good`, `Easy`) at session completion.
- **Retype-After-Miss**: Missed written questions reveal the reference answer side-by-side and re-queue at least 2 to 3 cards later after typing the correct form.
- **Distractor Generation**: Registry-driven `DistractorGenerator` merges same-set neighbors with mathematical mutators (sign flips, exponent shifts, swapped variables, dropped factors, inverted fractions, accent perturbations) filtered against the checker so distractors cannot accidentally pass.

## Plugin Registry & Layered Settings

- Single typed `Registry` manages `cardTypes`, `checkers`, `questionTypes`, `studyModes`, `importers`, `exporters`, `distractors`, `schedulers`, `segments`, `keyboards`, `themes`, `settingsSchemas`, `commands`, and lifecycle `hooks`.
- Layered settings resolve strictly from built-in defaults through app, set, session, and card overrides with explicit provenance tracking.
- PDF export (`packages/core/export` and `apps/app/src/export/`) separates a pure TypeScript layout model from lazy-loaded `jsPDF` generation inside Web Workers (detailed in [ADR 0002](adr/0002-pdf-export-jspdf.md)).

## Related Documentation

- [Project Overview](../README.md)
- [User Guide](USER_GUIDE.md)
- [Expression Language](EXPRESSION_LANGUAGE.md)
- [Developer Guide](DEVELOPMENT.md)
- [Testing Guide](testing.md)
- [Known Issues](known-issues.md)
- [PDF Export ADR](adr/0002-pdf-export-jspdf.md)
- [AI Agent Rules](../AGENTS.md)
- [Security Policy](../SECURITY.md)
