# Developer Guide

Build, test, lint, and package FormulaFlash from source across Windows, macOS, Linux, and Android.

## Prerequisites

- **Node.js 20+** and `pnpm`
- **Python 3.12+** and [`uv`](UV_INSTALLATION.md) (for macOS/Linux PyInstaller bundles and running repository lint checks)
- **JDK 17+** and **Android SDK** (for building the Android APK)

---

### Windows

```powershell
pnpm install --no-frozen-lockfile
pnpm test
pnpm --filter app run build
pnpm run build:desktop
.\build\FormulaFlash-Windows.exe --self-test
```

---

### macOS

```bash
pnpm install --no-frozen-lockfile
pnpm test
pnpm --filter app run build
pip install pyinstaller pillow
pnpm run build:desktop:unix --platform macos --self-test
```

---

### Linux

```bash
pnpm install --no-frozen-lockfile
pnpm test
pnpm --filter app run build
pip install pyinstaller pillow
pnpm run build:desktop:unix --platform linux --self-test
```

---

## Android APK Build

```bash
pnpm --filter app run build
cd apps/app
npx cap sync android
cd android
./gradlew assembleRelease
```

Signed release builds read `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` as documented in [Human Setup](HUMAN_SETUP.md). Never commit keystore files or credentials.

## Verification & Linting

Run unit tests, ESLint, TypeScript typechecking, Dependency Cruiser architecture checks, Playwright smoke tests, strict workspace linting, and markdown link validation before submitting a pull request:

```bash
pnpm run lint
pnpm run typecheck
pnpm exec depcruise packages apps
pnpm test
pnpm --filter app run build
uv run --no-project python ../ai-dev-tools/scripts/claudemd_linter.py . --level strict --full
uv run --no-project python ../ai-dev-tools/scripts/link_checker.py .
```

---

## Related Documentation

- [Project Overview](../README.md)
- [System Architecture](ARCHITECTURE.md)
- [Desktop Installation Guide](INSTALLATION.md)
- [Android APK Installation Guide](APK_INSTALLATION.md)
- [Developer uv Installation](UV_INSTALLATION.md)
- [Testing Guide](testing.md)
- [Human Setup](HUMAN_SETUP.md)
- [AI Agent Rules](../AGENTS.md)
- [Security Policy](../SECURITY.md)
