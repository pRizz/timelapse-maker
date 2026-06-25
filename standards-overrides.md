# Standards Overrides

Use this file to record deliberate deviations from the canonical coding and architecture standards.

## Active overrides

| Standard | Local decision | Rationale | Owner | Review date |
| --- | --- | --- | --- | --- |
| `standards/core/operability.md` build-info copyable summary | Keep visible version, commit, and build time, but omit the `Copy build info` button in this compact single-page utility. | The provenance remains visible for users and support, while the copy action adds low-value UI weight here. An upstream Bright Builds Rules PR is planned to make copy affordances optional. | pRizz | 2026-09-25 |

## Notes

- Prefer narrow, explicit exceptions over broad "this repo is different" statements.
- If local verification is intentionally hook-owned or leaves heavy suites to CI, record that explicitly here.
- Revisit overrides periodically instead of letting them become permanent by accident.
- If an override becomes common across many repos, move it back upstream into the canonical standards repo.
