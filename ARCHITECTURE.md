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

## Dual-backend contract (current direction)

The project currently prioritizes a dual-backend strategy without requiring a heavy custom IR first:

1. `Std-Strict AST -> Native-Strict AST -> x86 asm -> obj -> exe`
2. `Std-Strict AST / Native-Strict AST -> LLVM IR` (parallel path)

This is valid as long as both paths obey the same semantic contract.

### Canonical semantic stage

Both backend paths must consume the output of the same semantic gates:

- alias resolution (`E3xxx`)
- type and dreg flow checks (`E4xxx`)
- mode constraints (`E6xxx`)
- control-flow legality checks (label/goto boundary, save snapshot restore)

No backend may "fix" invalid input that semantic should reject.

### Std -> Native lowering contract

`Std-Strict AST -> Native-Strict AST` must preserve these invariants:

- **Control flow invariant**: label/goto topology and reachability are preserved (no hidden jump insertion that changes behavior).
- **Call contract invariant**: effective argument-slot mapping after Rule-A resolution is preserved.
- **Type-flow invariant**: visible register logical types at block boundaries are preserved.
- **Save invariant**: save block exit restores pre-entry logical type snapshot.
- **Effect-order invariant**: expression/call evaluation order remains left-to-right where language contract requires it.

Native lowering may only add target constraints (register class, instruction-form restrictions), not language-level behavior changes.

### AST -> LLVM IR contract (minimal first slice)

Initial LLVM path should focus on a constrained subset:

- functions, blocks, branches, returns
- integer/bool arithmetic and compares
- direct calls (then indirect calls)
- basic data addressing/load-store forms aligned with current std/native subset

For this slice:

- generated LLVM IR must be verifier-clean (`llvm::verifyModule` equivalent)
- ABI-sensitive symbols and calling convention mapping must be explicit
- unsupported features must fail fast with `E8xxx`, not silent fallback

### Backend consistency checklist

For every new language feature accepted by semantic:

- add at least one sample program in `packages/core/test/fixtures/`
- validate parse + semantic once
- validate x86 path output behavior
- validate LLVM path output behavior (or explicit `E8xxx` unsupported diagnostic)

When both backends support a feature, add an A/B behavior parity test:

- same input source
- same observable outputs (stdout, exit code, memory-visible effects)

### Practical module seams

Recommended seams in current workspace:

- `packages/core/src/semantic/` for canonical checks
- `packages/core/src/lowering/std_to_native/` for target-constraining lowering
- `packages/core/src/codegen/x86/` for direct native->asm emission
- `packages/core/src/lowering/ast_to_llvm/` for LLVM emission path
- `packages/core/test/` for parser/semantic/backend parity tests

If a thin internal IR is introduced later, it should be a compatibility layer for both paths, not a blocker for current x86 delivery.

## How to evolve this skeleton

1. Keep diagnostic codes stable.
2. Add behavior behind existing interfaces before adding new public entry points.
3. Extend tests first for every new pass.
4. Prefer adding metadata stores over mutating AST nodes in-place.
