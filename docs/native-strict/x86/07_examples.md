# 07. 对照示例

两段 Std-Strict 里已经出现过的典型代码，降级到 Native-Strict x86 后的样子。每段都保留 Std-Strict 原版做对照，你能清楚看到"哪些约束被激活、该怎么改写"。

## 示例 1：`strlen`（别名 + 循环 + 内存读取）

### Std-Strict 版（来自 [05. 寄存器别名](../../std-strict/05_registers.md#对照示例)）

```rust
pub fn strlen(str @ r1: *u8) -> (len @ r0: u64) uses (byte @ r2) {
    len = 0u64
@loop:
    byte = mem.u8[str + len]
    if (byte == 0u8) goto(@done)
    len = len + 1u64
    goto(@loop)
@done:
}
```

### Native-Strict x86 版

```rust
pub fn strlen(str @ r7: *u8) -> (len @ r0: u64) uses (byte @ r1) {
    len = 0u64
@loop:
    byte = mem.u8[str + len]
    if (byte == 0u8) goto(@done)
    len = len + 1u64
    goto(@loop)
@done:
}
```

**改动点**：

- `str` 从 `r1` 挪到 `r7`——System V 第 1 参必须是 `rdi = r7`
- `byte` 从 `r2` 挪到 `r1`——这里没有硬约束，`r1`/`r2`/`r8`–`r11` 都行，选 `r1`（`rcx`）只是延续低编号习惯
- `len` 留在 `r0`——整数返回值槽位一致
- `byte = mem.u8[str + len]` 合法：`str` 做 base，`len` 做 index（scale=1 隐含）——命中 x86 寻址模式 `[base + index*1 + 0]`
- `len = len + 1u64` 合法：两操作数形式

**生成的汇编大致**：

```asm
strlen:
    xor     eax, eax            ; len = 0（eax 写入自动清零 rax 高 32 位）
.loop:
    mov     cl, [rdi + rax]     ; byte = mem.u8[str + len]
    test    cl, cl
    je      .done
    inc     rax                 ; len = len + 1
    jmp     .loop
.done:
    ret
```

## 示例 2：`divmod`（多目标赋值 + 固定槽）

### Std-Strict 版

```rust
import "std/io" as io

export pub fn main() -> (r0: i32) uses (r1, r2) {
    (r1, r2) = 17i64 / 5i64                 // r1 = 3（商）, r2 = 2（余）
    io::println!("17 / 5 = {}, 17 % 5 = {}", r1, r2)
    r0 = 0i32
}
```

任意槽都能做商 / 余的目标——Std-Strict 甚至可以写 `(r5, r9) = r7 / r8`，编译器会自动帮你做 `MOV` + `IDIV` + `MOV`。

### Native-Strict x86 版

```rust
import "std/io" as io

export pub fn main() -> (exit @ r0: i32) uses (r1, r2) {
    r0 = 17i64
    (r0, r2) = r0 / 5i64                    // r0 = 3（商）, r2 = 2（余）
    r1 = r0                                  // 把商挪到第 2 参槽位（println! 展开时需要）
    // 注：真实 println! 展开遵循 System V 对第 2/3 实参的槽位要求，
    //    此处仅为说明"你得显式搬运"
    io::println!("17 / 5 = {}, 17 % 5 = {}", r1, r2)
    exit = 0i32
}
```

**改动点**：

- `(r0, r2) = r0 / 5i64` 是**唯一**合法形式——被除数必须 `r0`，商目标必须 `r0`，余目标必须 `r2`
- 不能写 `(r1, r2) = 17i64 / 5i64`——`r1` 不是 `rax`，编译错
- 立即数 `17i64` 得先 `mov` 进 `r0`——x86 的 `DIV` 操作数不能直接是立即数
- 除数 `5i64` 也不能直接入 `DIV`——但 Native-Strict x86 允许写成"除数 = 立即数"的糖，编译器内部展开为 `mov <tmp>, 5; idiv <tmp>`。如果你要手控到底：

  ```rust
  uses (r0, r2, r3)
  r0 = 17i64
  r3 = 5i64
  (r0, r2) = r0 / r3                      // 完全手控版
  ```

**生成的汇编**：

```asm
main:
    mov     rax, 17
    mov     rcx, 5              ; 编译器选的临时（在 uses 内的 caller-saved 槽）
    cqo                         ; 符号扩展 rax → rdx:rax
    idiv    rcx                 ; rax = 商（3）, rdx = 余（2）
    mov     rcx, rax            ; 搬运给 println 的第 2 参（rsi 其实，取决于展开）
    ; ... println! 的展开省略 ...
    xor     eax, eax
    ret
```

## 启示

对照下来，从 Std-Strict 到 Native-Strict x86 要做的事情本质上是**把"编译器帮你做的搬运"搬回源码**：

- 选 ABI 对齐的槽（`r7` 而不是 `r1` 当第 1 参）
- 在 `DIV` / `MUL` 前把被除数 / 被乘数挪到 `r0`
- 三操作数表达式拆成两步或改 `lea[...]`
- 移位 count 挪到 `r1`

**生成的机器码**在两个版本之间通常完全一致——因为编译器做的事和你手写的事是同一件事，区别只是谁来写。这也是为什么 Native-Strict x86 被定义为 Std-Strict 的**子集**：它不表达新能力，只是把同一套能力的"硬件形态"暴露出来。
