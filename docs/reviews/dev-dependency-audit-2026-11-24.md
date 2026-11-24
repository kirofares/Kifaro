# Development dependency audit — 24 November 2026

Review candidate only. No merge, deployment, signing or production changes authorized by this review.

## Baseline and attribution

Base: `4457b5ad7467e4a6d20fb8019fb4aab524119a85` (current main checked through GitHub). Guardian run [45212989640](https://github.com/kirofares/Kifaro/actions/runs/45212989640), job 137826470117, installed this commit on 23 November using Node 22.23.5 / npm 10.9.9. Its install log shows six moderate findings; its detailed audit is production-only. A fresh full audit of the same lockfile on 24 November reproduces exactly six moderate package findings, zero high/critical. This is a current reproduction, not a recovered historical full audit JSON.

| Reported package | Locked version | Directness and source |
| --- | --- | --- |
| @capacitor/cli | 8.5.3 | Direct dev dependency; inherits xcode/uuid finding |
| xcode | 3.0.1 | CLI → xcode; inherits uuid finding |
| uuid | 7.0.3 | CLI → xcode → uuid; original advisory |
| rimraf | 6.1.3 | CLI → rimraf; inherits glob findings |
| glob | 13.0.6 | CLI → rimraf → glob; original advisory and minimatch inheritance |
| minimatch | 10.2.6 | CLI → rimraf → glob → minimatch; original advisory |

Six affected package entries represent **three unique advisories**, not six independent vulnerabilities. Vite 7.3.7 and esbuild 0.28.2 are not implicated by this audit.

## Official advisories and corrected versions

| Advisory | Affected range relevant here | Corrected version | Practical conditions |
| --- | --- | --- | --- |
| [uuid GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), CVE-2026-41907 | <11.1.1 | 11.1.1; also 12.0.1 / 13.0.1 on those branches | v3/v5/v6 APIs with caller-provided output buffers can silently partially write. xcode 3.0.1 uses v4 without an output buffer, so the observed project-generation call does not exercise that vulnerable API. |
| [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), CVE-2026-118773 | >=9.0.0 through 14.0.1 | 14.0.2 | Directory traversal may continue after AbortSignal cancellation, consuming I/O/CPU. |
| [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), CVE-2026-118764 | >=7.0.0, <11.0.1 | 11.0.1 | Attacker-controlled patterns with optimizationLevel >=2 can amplify work and consume CPU/memory. |

uuid advisory published 19 April (updated 21 May); glob and minimatch maintainer advisories published 27 October and entered GitHub's advisory database 30 October. These dates are consistent with the change from the three October package findings to six now, but the old full audit JSON was not available to prove the historical delta independently.

## Risk boundary

All six package entries are dev-only in the lockfile. Reviewed CLI source uses rimraf for local migration/build cleanup and xcode for local native-project manipulation. No application source import of this chain was found. No student-input path to these CLI operations was established. Their principal exposure is developer/CI tooling handling untrusted patterns, paths or project trees; there is no demonstrated remotely exploitable path in the deployed KIFARO app from these findings.

The production-only audit is zero before and after. This says nothing about RLS, authorization, payment flows, storage availability or undisclosed vulnerabilities. No evidence of exploitation was established in this dependency review.

## Minimal supported update

One direct dependency changes: pin `@capacitor/cli` to **8.6.0**, the first stable 8.x release with the upstream xcode fix. [Official release notes](https://github.com/ionic-team/capacitor/releases/tag/8.6.0) explicitly document xcode ^4.0.0 replacing vulnerable uuid@7. xcode 4.0.0 removes uuid in favor of Node crypto.randomUUID; its minimum Node version is 14.17, below this project's >=22.13 requirement.

Refresh only the CLI and rimraf resolution, without `npm audit fix` or new overrides:

- CLI 8.5.3 → 8.6.0; xcode 3.0.1 → 4.0.0; uuid 7.0.3 removed.
- rimraf 6.1.3 → 6.1.4, which officially requests glob ^14.0.3.
- glob 13.0.6 → 14.0.6; minimatch 10.2.6 → 11.0.9.
- Their dev-only dependency closure also changes path-scurry 2.0.2 → 3.0.0, brace-expansion 5.0.12 → 5.1.0, and adds @isaacs/nonrecursive-glob-match 1.1.0.

All pre-existing non-dev lockfile entries and all production dependency specifications remain identical. Capacitor core/android/ios remain 8.5.3; Vite, esbuild, TypeScript, React and PDF/PPTX packages remain unchanged. No broad Capacitor runtime or Vite major update is needed for these findings. An override forcing uuid across major versions was avoided because the upstream CLI/xcode repair removes it outright. CLI/runtime minor-version interoperability still needs native build results before merge; matching major versions alone is not proof.

Reproduction of the resolution (followed by restoring npm's incidental package.json key reordering):

```sh
npm install --save-dev --save-exact @capacitor/cli@8.6.0 --package-lock-only --ignore-scripts --no-audit --no-fund
npm update rimraf --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --no-fund
npm audit --json
npm audit --omit=dev --json
```

For the exact candidate, use the committed lockfile and `npm ci`; rerunning resolution later can select newer transitive releases.

## Verification

Local isolated checkout: Linux x64, Node **24.22.3**, npm **11.19.1**. The CI runtime is Node 22 and must be validated independently.

| Check | Local result |
| --- | --- |
| Baseline npm ci, full audit | PASS install; six moderate findings reproduced |
| Baseline production audit | Zero |
| Baseline Guardian/Auth/Viva and web build | 38 tests pass; build passes |
| Candidate clean npm ci | PASS |
| Candidate full audit | Zero findings at every severity |
| Candidate production audit | Zero findings at every severity |
| Candidate Guardian / Auth / Viva | 21 / 11 / 6 pass |
| New toolchain tests | 2 pass: both native projects generated and synced; Xcode project parse/edit/write/reparse and 1,000 unique valid IDs; rimraf literal/glob cleanup preserves unmatched files |
| TypeScript and production web build | PASS; pre-existing large-chunk warning remains |
| Lockfile scope comparison / git diff --check | PASS |
| Native APK compilation and iOS simulator build | Not run locally: Android SDK / macOS Xcode unavailable; awaiting draft-PR CI |
| Device smoke tests, signed release, payment/media/RLS integration | Not performed |

The native scaffold tests are compatibility checks, not APK/Xcode compilation. They use temporary directories and synthetic HTML; existing Guardian media tests separately verify PDF rendering, PPTX export and the image parser.

## CI coverage prepared

- CI runs the new toolchain tests and an explicit all-dependency moderate-severity audit gate; production Guardian audit remains separate.
- Android workflow includes package-lock.json in push/PR paths.
- iOS includes package-lock.json and gains a pull_request trigger, so dependency candidates receive an unsigned simulator build before merge.
- Existing Pages deployment is main/manual only; signed Android release workflow is not triggered by this branch. No deployment command is run.

Native and Node 22 CI results must be reviewed on the candidate SHA. Also preserve the runtime protections in separate draft PR #72 when reconciling its workflow changes later.

Keep the PR draft. Reverting the dependency patch would restore the six findings; any rollback requires renewed audit. No merge or publication is part of this task.
