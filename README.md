# Aperio

> **Build low-level software like a compiler engineer, not a masochist.**

Aperio is a next-generation systems language stack designed to make explicit low-level programming **precise, readable, and scalable**.

It is not "yet another syntax experiment".  
It is a full architecture:

- strict IR-like language layers
- target-constrained native strict mode
- modular compiler pipeline
- roadmap to LLVM IR and future higher-level frontends

---

## Why This Project Matters

Most ecosystems force a bad tradeoff:

- readable high-level code with vague machine control, or
- raw assembly-level control with awful maintainability

**Aperio is designed to remove that tradeoff.**

### Core Model

- **Std-Strict (`.ap`)**: architecture-agnostic strict layer
- **Native-Strict x86 (`.x86.ap`)**: hardware-constrained strict subset
- **Loose (`.apo`, planned)**: sugar-friendly layer lowered into strict forms

Pipeline mindset:

`source -> strict semantics -> target-specific lowering -> executable`

---

## Aperio in 30 Seconds

### Std-Strict flavor

```rust
import "std/io" as io

pub fn add(a @ r1: i64, b @ r2: i64) -> (sum @ r0: i64) {
    sum = a + b
    io::println!("sum = {}", sum)
}
```

### Native-Strict x86 flavor (conceptual)

```rust
pub fn divmod(x @ r0: u64, y @ r3: u64) -> (q @ r0: u64, r @ r2: u64) {
    (q, r) = x / y
}
```

This is exactly the point of Aperio:

- explicit register/ABI behavior
- still readable enough to scale in a real codebase

---

## Hello World, But Real

Instead of a toy one-liner, here is a compact sample that shows the *shape* of Aperio:

- explicit signature/ABI
- register aliases (`name @ rN`)
- `uses` scratch slots
- named-argument calls
- stdlib macro + stdlib function calls
- explicit return value slot

```rust
import "std/io" as io
import "std/debug" as dbg

pub fn repeat_print(
    msg @ r1: *u8,
    n   @ r2: u64,
) -> (ret @ r0: i32) uses (i @ r3) {
    dbg::assert!(n > 0u64, "n must be > 0")

    i = 0u64
    save(i) {
        i = 1u64
    }
    // i == 0

@loop(i: u64):
    if (i >= n) goto(@done)
    io::println!("hello from aperio: {}", msg)
    goto(@loop, i = i + 64)

@done:
    ret = 0i32
}

pub fn main() -> (r0: i32) {
    // Named-argument call style in strict mode.
    r0 = repeat_print(r1@msg = c"world", r2@n = 3u64)
}
```

If this reads like “structured low-level code” rather than “write-only assembly”, that is exactly the point.

> Note: the language spec is ahead of implementation in some areas today.  
> Track parser/codegen coverage in `todo.md`.

---

## What Works Today

- TypeScript + ESM multi-package compiler workspace
- Modular architecture (`core`, `cli`, `fmt`, `linter`, `fixer`, `pkg`)
- Structured diagnostics pipeline (`human | json | lsp`)
- AST/lexer/parser/semantic skeleton with growing coverage
- Package manager specification docs (Go-style + MVS)

CLI you can run right now:

```bash
npm install
npm run build
npm run test

npm run aperio -- check packages/core/test/fixtures/hello.ap
npm run aperio -- ast packages/core/test/fixtures/hello.ap
npm run aperio -- explain E3001
```

---

## Current Focus

The roadmap is aggressive and practical:

1. Parse **all documented grammar** into AST
2. Complete strict semantic passes
3. Emit x86-strict source and executable artifacts
4. Add desugaring layer for syntax ergonomics
5. Generate LLVM IR

Detailed execution plan: `todo.md`

---

## Repository Structure

```text
.
├── docs/
│   ├── std-strict/
│   ├── native-strict/x86/
│   └── package-manager/
├── packages/
│   ├── core/         # lexer/parser/ast/semantic/mode/ir/codegen-x86 skeleton
│   ├── cli/          # command-line interface
│   ├── fmt/          # formatter APIs
│   ├── linter/       # rule engine
│   ├── fixer/        # auto-fix engine
│   └── pkg/          # package-manager contracts
├── ARCHITECTURE.md
└── todo.md
```

---

## Design Principles

- **Spec-first**: language behavior lives in docs, implementation follows
- **Explicit over implicit**: ABI, register use, and effects are visible
- **Composable internals**: package boundaries are enforced, not decorative
- **Future-proof pipeline**: designed to host sugar lowering and LLVM IR paths

---

## Want To Contribute?

If you like compilers, language tooling, or low-level systems design, this project is built for you.

Start here:

- `todo.md` for execution-grade task list
- `ARCHITECTURE.md` for subsystem boundaries and long-term direction
- `docs/` for language and package-manager specs

---

## Status

This project is under active heavy development.  
The architecture is stable enough for contributors, while the language surface is expanding quickly.

If you want to help shape a serious low-level language stack from the inside out, now is the best time to jump in.
