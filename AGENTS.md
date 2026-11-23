# Agent Rules & Operational Reference for FormulaFlash

## Core Directives

- **Read Architecture Docs:** Review [System Architecture](docs/ARCHITECTURE.md). Work one task at a time and run the full test suite.
- **Layering Constraint:** `packages/core` must stay pure TypeScript (no DOM, React, or Capacitor). CI enforces this via `dependency-cruiser`.
- **Pluggability:** Everything pluggable goes through the registry. Keep card types, checkers, and modes decoupled from UI components.
- **TDD for Math:** Math correctness is the product: any change to `checking/` must update or add corpus cases first.
- **Randomness:** Randomness must be injectable and seedable (`SeededRng`). Avoid `Math.random()` in `packages/core`.
- **Secrets:** Never commit keystore files or secrets. Required GitHub Secrets are listed in [Human Setup](docs/HUMAN_SETUP.md).
- **Commits:** Use Conventional Commits and update docs when conventions change.
- **Pinned Math Engines:** Upgrade `mathlive`, `@cortex-js/compute-engine`, or `katex` only after the full math corpus and smoke suites pass.
- **Design Decisions:** Record structural decisions as short ADRs under `docs/adr/`.

## Monorepo Architecture

FormulaFlash is a two-tier monorepo:

1. **`packages/core`**: Pure TypeScript domain engine containing AST normalization, 4-tier equivalence checking, Learn state machine, FSRS scheduling wrapper, `.flashset` validation (Zod), and plugin registry. Zero DOM, React, or Capacitor imports.
2. **`apps/app`**: React 19, Tailwind CSS, Zustand, MathLive, and KaTeX frontend packaged for Windows (`csc.exe` WebView host), macOS/Linux (`unix_host.py` + PyInstaller), and Android (Capacitor).

## Developer Commands

Run these commands from the monorepo root:

- `pnpm install`: Install all workspace dependencies.
- `pnpm dev`: Start the local Vite development server.
- `pnpm test`: Run all unit and property tests (Vitest).
- `pnpm test:smoke`: Run Playwright smoke checks.
- `pnpm lint`: Run ESLint across the workspace.
- `pnpm typecheck`: Run TypeScript typechecking across all packages.
- `pnpm exec depcruise packages apps`: Enforce core layering boundaries.
- `pnpm --filter app run build`: Build the static web bundle into `apps/app/dist`.
- `pnpm build:desktop`: Package the Windows WebView executable (`build/FormulaFlash-Windows.exe`).
- `pnpm build:desktop:unix`: Package macOS or Linux WebView archives.
- `pnpm android:apk`: Build the Android APK via Capacitor and Gradle.

## Related Documentation

- [Project Overview](README.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/DEVELOPMENT.md)
- [User Guide](docs/USER_GUIDE.md)
- [Security Policy](SECURITY.md)
