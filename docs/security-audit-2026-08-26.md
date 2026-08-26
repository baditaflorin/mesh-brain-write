# Release security audit — 2026-08-26

Scope: the static GitHub Pages client, its browser-local Yjs/WebRTC transport,
and the dependency graph used to build and test this release.

## Results

| Check                                                                                                       | Result                                                               |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm audit --omit=dev --json`                                                                               | 0 vulnerabilities                                                    |
| `npm audit --json`                                                                                          | 0 vulnerabilities                                                    |
| Secret-pattern scan of tracked source (private-key / GitHub token / AWS key / password assignment patterns) | no matches                                                           |
| Production architecture                                                                                     | static client only; no bundled credentials or server-side data store |

## Remediation included in this release

- Refreshed the lockfile against the current local `mesh-common` dependency.
- Updated the Vitest development dependency to the audited current major,
  eliminating vulnerable Vite/Vitest transitive packages from the test toolchain.
- Updated audit-fixable transitive packages, including the production WebSocket
  dependency path used by `y-webrtc`.

## Deliberate boundaries

- TURN credentials are fetched at runtime from the configured credential
  endpoint and are not committed to the application.
- Released ideas remain author-anonymous at the UI layer, as documented in
  [the privacy model](privacy.md). This is not a cryptographic privacy claim:
  a participant who can inspect the shared CRDT may still read pending values.
- The WebRTC signaling and TURN services are deployment dependencies. Their
  server hardening, rate limits, and credentials remain outside this static
  repository's trust boundary.
