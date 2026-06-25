# Bright Builds Rules Audit Trail

<!-- bright-builds-rules-managed-file: bright-builds-rules.audit.md -->

This file records that this repository is using the Bright Builds Rules and shows where the managed adoption files came from.

This audit trail is managed upstream by `bright-builds-rules`. If the managed audit format or content needs a fix, open an upstream PR or issue instead of editing the downstream copy directly.

## Current installation

- Source repository: `https://github.com/bright-builds-llc/bright-builds-rules`
- Version pin: `main`
- Exact commit: `b8c13f9928bc32f7bb988b8146439687ed73a32e`
- Canonical entrypoint: `https://github.com/bright-builds-llc/bright-builds-rules/blob/main/standards/index.md`
- Managed sidecar path: `AGENTS.bright-builds.md`
- AGENTS integration mode: `append-only managed block`
- Audit manifest path: `bright-builds-rules.audit.md`
- Auto-update: `enabled`
- Auto-update reason: `trusted repo owner pRizz`
- Last operation: `install`
- Last updated (UTC): `2026-06-25T00:54:33Z`

## Managed files

- `AGENTS.md (managed block)`
- `AGENTS.bright-builds.md`
- `CONTRIBUTING.md (managed block)`
- `.github/pull_request_template.md`
- `bright-builds-rules.audit.md`
- `standards/index.md`
- `standards/core/architecture.md`
- `standards/core/code-shape.md`
- `standards/core/local-guidance.md`
- `standards/core/operability.md`
- `standards/core/testing.md`
- `standards/core/verification.md`
- `standards/languages/rust.md`
- `standards/languages/typescript-javascript.md`
- `README.md (managed badges block)`
- `scripts/bright-builds-auto-update.sh`
- `.github/workflows/bright-builds-auto-update.yml`

## Why this exists

- It provides a visible paper trail for install, update, and uninstall operations.
- The installer manages a bounded block inside `AGENTS.md`, a bounded README badge block when applicable, local standards files under `standards/`, and marked whole-file managed surfaces such as the sidecar, audit trail, contribution guide, PR template, and optional auto-update files.
- `standards-overrides.md` remains repo-local and is preserved during update and uninstall.
- It helps humans and tools debug which standards revision a repository is pinned to.
