# Human Setup Instructions

This document lists repository steps that require maintainer credentials or keystore provisioning. **Never commit secrets or `.jks` files to this repository.**

## Android Release Keystore Setup

1. Generate an RSA 2048 keystore outside the repository:
   ```bash
   keytool -genkeypair -v -keystore formulaflash-release.jks -alias formulaflash -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add these repository secrets under **Settings > Secrets and variables > Actions** on `DontKwo/formulaflash`:
   - `ANDROID_KEYSTORE_BASE64`: Base64-encoded keystore contents
   - `ANDROID_KEYSTORE_PASSWORD`: Keystore password
   - `ANDROID_KEY_ALIAS`: Signing key alias (`formulaflash`)
   - `ANDROID_KEY_PASSWORD`: Signing key password

## Related Documentation

- [Project Overview](../README.md)
- [Developer Guide](DEVELOPMENT.md)
- [System Architecture](ARCHITECTURE.md)
- [Android APK Installation Guide](APK_INSTALLATION.md)
- [Security Policy](../SECURITY.md)
