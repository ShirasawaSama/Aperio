# Aperio Compiler Architecture (v1 Skeleton)

This document is the engineer-facing architecture baseline for the workspace.

## Workspace Layout

```text
/
├── docs/                       # Language and package-manager docs
├── packages/
│   └── aperio/
│       ├── src/               # Compiler implementation
│       ├── test/              # Fixtures and snapshot tests
│       └── dist/              # Build output
├── package.json               # npm workspaces root
└── tsconfig.json              # shared TypeScript config
```

## Pipeline

1. `source`: stable file-id and line-table mapping
2. `lexer`: tokenization + recovery (`E1xxx`)
3. `parser`: recursive descent subset + recovery (`E2xxx`)
4. `semantic`:
   - aliases (`E3xxx`)
   - type/dreg subset (`E4xxx`)
   - imports stub (`E5xxx`)
5. `mode`: std/native-x86/loose guards (`E6xxx`)
6. `ir` and `codegen/x86`: typed stubs (`E7xxx`)
7. `diagnostics`: human/json/lsp rendering
8. `linter/fixer`: `L1001` and `L1002` seed rules

## Design Principles

- **ESM-only** modules for long-term platform consistency.
- **Single diagnostic envelope** across all stages.
- **AST as superset** for std/native/loose.
- **Stable extension seams** for future LLVM and package-manager implementation.
- **Explicit mode gating** by file suffix.

## Package manager roadmap (v1 = contracts only)

### Locked Decisions

- Distribution model: Go-style, VCS direct (`host/path@ref`)
- Version solver: MVS
- Manifest: `aperio.toml`
- Lockfile: `aperio.lock`
- Stdlib: bundled with compiler, not in deps
- Cache: global `~/.aperio/pkg/...`
- Workspace support in package-manager semantics: deferred
- Auth: delegated to git

### v1 Surface (already present)

- `src/pkg/manifest.ts`: manifest schema + parser contract
- `src/pkg/lock.ts`: lock schema + parser contract
- `src/pkg/resolver.ts`: dependency resolver contract
- `src/pkg/fetcher.ts`: VCS fetch contract
- CLI command placeholders:
  `init/add/remove/update/fetch/vendor/tree`

### Reserved diagnostics

- `E9xxx`: package-manager errors

## LLVM IR interop roadmap (future_only)

### Positioning

LLVM support is **not** a native backend replacement.
It is a secondary frontend path:

`optimized .ll` -> `lowering` -> `Std-Strict IR` -> existing pipeline

### Planned modules

- `src/llvm/parser.ts`
- `src/llvm/lowering.ts`
- `src/llvm/intrinsics_map.ts`

### Planned CLI

`aperio build foo.ll --from llvm-ir`

### Reserved diagnostics

- `E8xxx`: LLVM parse/lowering errors

### Known out-of-scope (initial LLVM slice)

- exception handling, coroutines, GC
- vector intrinsics beyond current std/simd capability
- non-standard calling conventions

## How to evolve this skeleton

1. Keep diagnostic codes stable.
2. Add behavior behind existing interfaces before adding new public entry points.
3. Extend tests first for every new pass.
4. Prefer adding metadata stores over mutating AST nodes in-place.
