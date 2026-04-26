# Dev Dependency License Carve-Outs

This document records non-permissive licenses present in **development-only** dependencies. These packages are never bundled into production builds, never imported from `src/`, and never shipped to end users.

## Non-Commercial Dev-Only License

### `@spoons-and-mirrors/subtask2` — PolyForm-Noncommercial-1.0.0

- **Package:** `@spoons-and-mirrors/subtask2@^0.3.5` (devDependency)
- **License:** PolyForm-Noncommercial-1.0.0
- **Usage:** Opencode editor plugin referenced in `.opencode/opencode.jsonc`
- **Production exposure:** None. This package is loaded by the opencode CLI/editor tooling and is not imported from `src/`, not referenced in `next.config.ts`, and not bundled by `next build`.
- **Commercial impact:** The PolyForm-Noncommercial restriction applies to the plugin itself. LyraAlpha AI's production artifacts do not contain or depend on this package at runtime.

## Copyleft Dev-Only Licenses

### LGPL-3.0-or-later

- `@img/sharp-libvips-linux-x64`
- `@img/sharp-libvips-linuxmusl-x64`

Both are server-side dynamic-linking dependencies of the `sharp` image-processing library. They are not statically linked into our application bundles. Standard LGPL dynamic-linking obligations are satisfied by the upstream `sharp` package.

### MPL-2.0

- `axe-core` (accessibility testing, dev-only)
- `lightningcss` (3 variants — CSS parser, dev/build-time only)
- `web-push` (if used in dev/testing)

MPL-2.0 is a file-level copyleft license. Our application does not modify these files, and they are used as unmodified dependencies. No additional license obligations are triggered for our proprietary application.

## Root Package License

The root `lyraalpha@0.1.0` package is marked `"private": true` in `package.json` and is not published to npm. It does not carry an open-source license. The `license` field is set to `UNLICENSED` to reflect this explicitly.

## Ongoing Enforcement

The `.github/workflows/security-audit.yml` CI workflow runs a weekly license scan with:

```bash
npx license-checker --production --failOn "GPL-3.0;AGPL-3.0;PolyForm-Noncommercial-1.0.0"
```

This **only scans `dependencies`**, not `devDependencies`. If a non-commercial or strong-copyleft package ever leaks into the production dependency tree, the CI build will fail immediately.
