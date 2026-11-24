# Desktop Installation Guide

Install and launch FormulaFlash on your computer without Python, Node.js, or developer tools.

---

## Platform Instructions

### Windows

1. Download `FormulaFlash-Windows.exe` from [Latest Releases](https://github.com/DontKwo/formulaflash/releases/latest).
2. Double-click `FormulaFlash-Windows.exe` to open the desktop app.
3. If **Microsoft Defender SmartScreen** displays *"Windows protected your PC"*:
   - Click **More info**.
   - Confirm the file came from `DontKwo/formulaflash`, then click **Run anyway** at your own discretion.
4. Alternative unblock method: Right-click `FormulaFlash-Windows.exe` -> **Properties** -> check **Unblock** near the bottom under Security -> click **Apply** and **OK** -> open the file normally.

---

### macOS

1. Download `FormulaFlash-macOS.zip` from [Latest Releases](https://github.com/DontKwo/formulaflash/releases/latest).
2. Double-click the archive to unpack it and drag **`FormulaFlash.app`** (or the `FormulaFlash` binary) into your **Applications** folder.
3. On macOS Sonoma and Sequoia, approve an independently distributed app in **System Settings**:
   - Double-click **`FormulaFlash`** once so macOS shows the blocked notice, then click **OK** (or **Done**).
   - Open **System Settings** -> **Privacy & Security** -> scroll to the **Security** section.
   - Next to the blocked notice for FormulaFlash, click **Open Anyway** and confirm with your password or Touch ID.
4. Developer Terminal Alternative (when working locally): run `xattr -cr /Applications/FormulaFlash.app` in Terminal, then open the app normally.

---

### Linux

1. Download `FormulaFlash-Linux.tar.gz` from [Latest Releases](https://github.com/DontKwo/formulaflash/releases/latest).
2. Extract the archive in your file manager (or run `tar -xzf FormulaFlash-Linux.tar.gz`).
3. Make the extracted binary executable (right-click -> **Properties** -> **Permissions** -> allow executing as program, or run `chmod +x FormulaFlash`).
4. Double-click `FormulaFlash` to launch.

---

## Safety & Authenticity Warning

- **Official `main` Releases Only**: Download FormulaFlash exclusively from [DontKwo/formulaflash Releases](https://github.com/DontKwo/formulaflash/releases/latest).
- **Fork Warning**: Never download builds from forked repositories unless you have verified the source code yourself and know they do not contain malware. Only official `main` releases are maintained by the author, and I make no promises.
- **Bypassing Security Prompts**: Because independent open-source executables do not carry paid commercial signing certificates, Windows and macOS will warn that the app is unrecognized or potentially unsafe. Bypassing these prompts is strictly at your own discretion, and the software is provided "AS IS" with zero liability.

---

## Related Documentation

- [Project Overview](../README.md)
- [Android APK Installation Guide](APK_INSTALLATION.md)
- [User Guide](USER_GUIDE.md)
- [Frequently Asked Questions](FAQ.md)
- [Developer Guide](DEVELOPMENT.md)
- [Security Policy](../SECURITY.md)
- [MIT License](../LICENSE)
