# Package Manager Stub

This package holds package-manager contracts only.

## Present in v1

- manifest schema interfaces
- lockfile schema interfaces
- dependency resolver API (MVS boundary)
- fetcher API (VCS boundary)

## Deferred to v2

- TOML parsing
- MVS implementation
- git mirror/archive integration
- checksum verification
- vendor/offline/locked flows
