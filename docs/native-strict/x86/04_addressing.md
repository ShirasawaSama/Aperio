# 04. 内存寻址

Std-Strict 允许 `mem.<T>[p]` 里的 `p` 是任意指针表达式，编译器会自动压平。x86 的硬件寻址模式只有一种固定形态——Native-Strict x86 把这个形态当成源码规则。

## 允许的形式

```rust
mem.<T>[base + index*scale + disp]
```

- **`base`**：任意 GPR（`r0`–`r15`，包括 `r4=rsp` 作为基址，这是允许的）
- **`index`**：任意 GPR，**除 `r4`**——x86 的 SIB 编码不允许 `rsp` 做 index
- **`scale`**：字面量，必须是 `1` / `2` / `4` / `8` 之一
- **`disp`**：`i32` 字面量 或 符号 / 标签（例如 `&GLOBAL_TABLE` 的地址差）

所有组成部分都可以省略，但至少要有一个：

```rust
mem.i64[r7]                         // base 单独
mem.i64[r7 + 16]                    // base + disp
mem.i64[r7 + r6]                    // base + index（scale=1 隐含）
mem.i64[r7 + r6*8]                  // base + index*scale
mem.i64[r7 + r6*8 + 16]             // 全量
mem.i64[r6*8]                       // index*scale 单独（base 隐含为 0）
mem.i64[r6*8 + 16]                  // index*scale + disp
mem.i64[TABLE + r6*8]               // 符号做 disp + index*scale
mem.i64[rip + TABLE]                // RIP 相对（x86-64 位置无关码）
```

## 禁止的形式

**不允许**出现除 `base + index*scale + disp` 之外的任何表达式：

```rust
mem.i64[r7 + r6 + r5]           // 编译错：两个寄存器之和里必须一个当 base 一个当 index*1，但这里有三个
                                 // 修复：r3 = lea[r7 + r6]; mem.i64[r3 + r5]
mem.i64[r6 * 3]                 // 编译错：scale 必须 ∈ {1,2,4,8}
                                 // 修复：r3 = lea[r6*2 + r6]; mem.i64[r3]
mem.i64[r7 - r6]                // 编译错：只支持加法
                                 // 修复：r3 = -r6; mem.i64[r7 + r3]（或更简洁的两步）
mem.i64[r4 * 2]                 // 编译错：rsp 不能做 index
```

**压平复杂表达式的标准做法是 `LEA`**（见 [03. 指令形式](./03_instructions.md#lea受控的三操作数加法)）：

```rust
r3 = lea[r7 + r6 + r5]          // 编译器内部同样展开为两步，但语义清晰
mem.i64[r3] = 0i64
```

## RIP 相对寻址

x86-64 新增了 `[rip + disp]` 寻址模式，专门给位置无关码（PIC / PIE）用。Native-Strict x86 用 `rip` 伪寄存器显式表达：

```rust
r0 = mem.i64[rip + COUNTER]         // 读全局 COUNTER（位置无关）
mem.i64[rip + COUNTER] = r1         // 写全局 COUNTER
r0 = lea[rip + STRING]              // 取全局符号地址
```

`rip` **只能**出现在寻址表达式里做 `base`，且此时不允许同时写 `index*scale`——硬件就是这么限制的。

`&GLOBAL_SYMBOL` 在 Native-Strict x86 里默认**生成 `lea[rip + GLOBAL_SYMBOL]`**——即默认位置无关。需要绝对地址时用 Std-Strict 里的 `std/ptr::from_addr` 或类似设施。

## 对齐与类型

`mem.<T>[...]` 读写的字节数由 `T` 决定，与 Std-Strict 一致：

- `mem.i8[...]` / `mem.u8[...]`：1 字节
- `mem.i16[...]` / `mem.u16[...]`：2 字节
- `mem.i32[...] / mem.u32[...] / mem.f32[...]`：4 字节
- `mem.i64[...] / mem.u64[...] / mem.f64[...] / mem.*T[...]`：8 字节

x86-64 对非对齐访问**不要求对齐**（除 SSE 的对齐版本 `MOVAPS`/`MOVDQA`），但性能代价仍然存在。`mem.<T>.unaligned[...]`、`mem.<T>.volatile[...]` 原样从 [Std-Strict 的 volatile 章节](../../std-strict/10_volatile.md)继承。

## 小结

能写的模式就这一个：`[base + index*scale + disp]`。任何更复杂的寻址都先用 `LEA` 压成一个寄存器。其他约束（类型宽度、对齐、volatile、atomic 的额外限制）和 Std-Strict 一致。
