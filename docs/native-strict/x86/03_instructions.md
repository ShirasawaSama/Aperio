# 03. 指令形式约束

Std-Strict 的 `r3 = r1 + r2`（三操作数）到了 x86 这里会撞墙——x86 的 `ADD` 只有两操作数形式 `add dst, src`，意思是 `dst = dst + src`。Native-Strict x86 **把这层硬件约束搬到源码层**，让你在写代码时就看见 x86 的真实形态。

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成（已覆盖比较/赋值/跳转等基础表达式与语句）
- 语义（Semantic）：`[ ]` 未开始（本章指令级约束尚未做完整静态校验）
- 编译（Windows x86_64）：`[~]` 部分完成  
  已覆盖：`mov`、基础 `add/sub/and/or/xor`、`cmp+jcc`、`jmp`、`ret` 的最小发射。  
  未覆盖：`lea`、`mul/div` 固定槽、移位 count 约束等完整 native 指令约束。

## 赋值：永远自由

赋值本身不受约束——这是 `MOV` 指令，x86 提供了几乎任意组合：

```rust
r0 = r1                     // mov rax, rcx
r0 = mem.i64[r7]            // mov rax, [rdi]
mem.i64[r7] = r0            // mov [rdi], rax
r0 = 42i64                  // mov rax, 42
r0 = &SYMBOL                // lea rax, [rip + SYMBOL]
```

**唯一禁止**：`mem = mem`——x86 没有内存到内存的 `MOV`，必须先过寄存器：

```rust
mem.i64[r6] = mem.i64[r7]              // 编译错：需要寄存器中转
r0 = mem.i64[r7]                       // OK
mem.i64[r6] = r0                       // OK
```

## 两操作数 ALU

所有算术、逻辑二元运算必须写成 `dst = dst OP src` 形式——目标寄存器**同时也是第一个源操作数**：

```rust
r0 = r0 + r1                // OK → add rax, rcx
r0 = r1 + r2                // 编译错：x86 ADD 要求 dst == src1
                            //         建议：r0 = r1; r0 = r0 + r2

r0 = r0 - r1                // OK → sub rax, rcx
r0 = r0 & r1                // OK → and rax, rcx
r0 = r0 | r1                // OK → or  rax, rcx
r0 = r0 ^ r1                // OK → xor rax, rcx
```

覆盖这条规则的所有运算符：`+`、`-`、`&`、`|`、`^`，以及浮点对应的 `f0 = f0 + f1` 等。

### 一元运算

一元运算本来就是两操作数形式（dst 和唯一 src 是同一个）：

```rust
r0 = -r0                    // neg rax
r0 = ~r0                    // not rax
```

`r1 = -r0` 不直接对应一条 x86 指令，需要写成两步：`r1 = r0; r1 = -r1`。

### 立即数是允许的第二操作数

`src` 是立即数时规则不变——`dst` 仍然必须是 `dst`：

```rust
r0 = r0 + 8i64              // OK → add rax, 8
r0 = r0 << 3                // OK → shl rax, 3
r3 = r0 + 8i64              // 编译错
```

## LEA：受控的三操作数加法

x86 的 `LEA`（Load Effective Address）是唯一一条允许"目标 ≠ 源"的加法——它本来是"算地址但不访存"，副作用是可以当三操作数 `add/imul` 用。Native-Strict x86 暴露一个显式 `lea[...]` 语法承担这个角色：

```rust
r3 = lea[r1 + r2]               // lea rbx, [rcx + rdx]
r3 = lea[r1 + r2*4]             // lea rbx, [rcx + rdx*4]
r3 = lea[r1 + r2*8 + 16]        // lea rbx, [rcx + rdx*8 + 16]
r3 = lea[r1 * 5]                // lea rbx, [rcx + rcx*4]（编译器可展开）
```

`lea[...]` 里的寻址表达式遵循 [04. 内存寻址](./04_addressing.md) 的规则，**不实际访存**——它就是一个把 `[base + index*scale + disp]` 的地址值算出来写到目标寄存器的操作。

没有对应 `LEA` 减法。如果你需要 `r3 = r1 - r2`，就老实写两步。

## DIV / IDIV：多目标赋值 + 固定槽

x86 的 `DIV` / `IDIV` 指令是**单操作数**的，隐式地：

- **被除数**是 `RDX:RAX`（128 位）——对 64 位除法，先 `CQO` 把 `RAX` 符号扩展到 `RDX:RAX`
- **商**放到 `RAX`
- **余数**放到 `RDX`

Native-Strict x86 借用 Std-Strict 的[多目标赋值](../../std-strict/07_operators.md)语法把这个硬件约束显式化：

```rust
(r0, r2) = r0 / r7              // (商, 余) = r0 / r7
                                 // → (IDIV/DIV 按 r0 当前类型自动选)
                                 //   cqo                     (符号扩展)
                                 //   idiv r7                  (r0=商, r2=余)
```

**强约束**：

- 被除数必须是 `r0`
- 商目标必须是 `r0`，余目标必须是 `r2`——顺序固定，不能交换
- 除数 `rN` 可以是 `r0`、`r2` 之外的任意 GPR（包括内存：`(r0, r2) = r0 / mem.i64[r7]`）
- 除数类型与被除数当前类型决定选用 `IDIV`（有符号）还是 `DIV`（无符号）

只要商 / 只要余数时也能写，但 `r0` / `r2` **都会被破坏**——必须在 `uses` 里声明未使用的那个：

```rust
r0 = r0 / r7                    // 只要商
                                 // → r2 被 cqo + div 破坏，必须 uses r2
r2 = r0 % r7                    // 只要余
                                 // → r0 被破坏，必须 uses r0
```

## MUL / IMUL：三种形态

x86 的乘法有三种，Native-Strict x86 把三种都暴露：

### 两操作数 IMUL（64×64 → 截断 64 位）

```rust
r0 = r0 * r1                    // imul rax, rcx
r3 = r3 * r7                    // imul rbx, rdi
```

遵循一般的 "dst = dst OP src" 规则。只做有符号乘法——x86 没有"截断到 64 位的无符号 `MUL`"指令形式，无符号乘法要走下面的 128 位形态再丢掉高位。

### 三操作数 IMUL（带立即数）

`IMUL r64, r/m64, imm32` 是 x86 少见的真三操作数指令：

```rust
r3 = r1 * 3                     // imul rbx, rcx, 3
r3 = r1 * 10i32                 // imul rbx, rcx, 10
```

立即数只能是 32 位有符号范围（`i32`）。

### 128 位 MUL/IMUL（多目标赋值）

单操作数的 `MUL` / `IMUL` 把 `RAX * src` 的完整 128 位结果放到 `RDX:RAX`——高位 `RDX`，低位 `RAX`：

```rust
(r2, r0) = r0 * r7              // (高, 低) = r0 * r7
                                 // → mul r7 （无符号，按类型推断）
                                 //   或 imul r7 （有符号）
```

**强约束**：

- 被乘数必须是 `r0`
- 高位目标必须是 `r2`，低位目标必须是 `r0`——和 `DIV` 的 `(r0, r2)` 顺序不同（因为硬件就是这么定的），注意**别搞反**

## 移位：count 只能是 `r1` 或立即数

x86 的 `SHL` / `SHR` / `SAR` / `ROL` / `ROR` 指令的移位计数**只能来自 `CL`（r1 的低 8 位）或 8 位立即数**——想用其他寄存器作 count 得先搬到 `r1`：

```rust
r0 = r0 << 3                    // OK → shl rax, 3
r0 = r0 << r1                   // OK → shl rax, cl
r0 = r0 << r5                   // 编译错：移位 count 必须是 r1 或立即数
r0 = r0 >> r1                   // OK → shr/sar rax, cl（按类型选）
```

- 当前类型为 `u*` → 逻辑右移 `SHR`
- 当前类型为 `i*` → 算术右移 `SAR`

这条约束也适用于 `&=` / `|=` 之类的位操作简写（见 [07. 运算符](../../std-strict/07_operators.md) 里 Std-Strict 已经支持的形式）。

## 比较与条件跳转：FLAGS 隐式传递

Std-Strict 的 `if (r0 < r1) goto(@L)` 在 x86 落地为两条指令——`CMP` + `Jcc`：

```rust
if (r0 < r1) goto(@done)        // cmp rax, rcx
                                 // jl  @done     （i64 用 jl，u64 用 jb）
```

Native-Strict x86 **不暴露独立的 `FLAGS` 寄存器操作**——比较和跳转仍写成和 Std-Strict 一样的 `if (<cond>) goto(...)` 形式，编译器负责发 `CMP` / `TEST` / `Jcc`。想精确控制哪条 `Jcc` 要看比较双方的当前类型：

| Std-Strict 比较 | 有符号类型 (`i*`) | 无符号类型 (`u*` / `*T`) |
|-----------------|-------------------|--------------------------|
| `a == b`        | `je`              | `je`                     |
| `a != b`        | `jne`             | `jne`                    |
| `a <  b`        | `jl`              | `jb`                     |
| `a <= b`        | `jle`             | `jbe`                    |
| `a >  b`        | `jg`              | `ja`                     |
| `a >= b`        | `jge`             | `jae`                    |

浮点比较（`UCOMISD`/`COMISD`）沿用 IEEE 754 语义，NaN 的具体路径见 [38. 未定义行为](../../std-strict/38_undefined_behavior.md)。

## 允许调用 Std-Strict 的所有内置库

`std/ptr`、`std/atomic`、`std/bits` 等**原样可用**——它们是 `#[builtin]` 函数，编译器知道如何把它们落地成对应的 x86 指令（`LOCK CMPXCHG`、`POPCNT`、`BSF`/`BSR`、`BSWAP` 等）。

**唯一区别**：在 Native-Strict x86 里，这些内置函数的调用仍然受 ABI 绑定——参数必须落在 System V 要求的槽位（见 [05. ABI](./05_abi.md)）。

## 总览：被允许的 vs 被禁止的

| 构造                             | Std-Strict | Native-Strict x86 |
|----------------------------------|------------|-------------------|
| `r2 = r0 + r1` (三操作数 ALU)    | 合法       | **禁止**（用两步或 LEA）|
| `r0 = r0 + r1`                   | 合法       | 合法              |
| `r3 = lea[r1 + r2*4 + 8]`        | 不存在     | **新增**          |
| `(rN, rM) = rX / rY` (任意槽)    | 合法       | **禁止**（必须 `(r0, r2) = r0 / rY`）|
| `r0 = r0 << r5`                  | 合法       | **禁止**（count 必须是 r1 或立即）|
| `mem[A] = mem[B]`                | 合法       | **禁止**（需寄存器中转）|
| `mem.<T>[任意表达式]`            | 合法       | **受限**（见 [04. 内存寻址](./04_addressing.md)）|
