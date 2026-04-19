# 02. 寄存器

Native-Strict x86 继承 Std-Strict 的 `r*` / `f*` 槽命名，但**槽数量从 1000 缩到 16**，并且每个槽与一个具体的 x86-64 物理寄存器一一对应。

## GPR 映射（`r0`–`r15`）

按 x86-64 **硬件编码顺序**对齐——这样 `DIV` 的商/余、`MUL` 的高/低位、移位的 count 这些"被硬件绑死的槽"都会落在最小的编号上，读代码时不用反查手册：

| Aperio   | x86-64 | 角色                                       |
|----------|--------|--------------------------------------------|
| `r0`     | `rax`  | 整数返回值 / `DIV` 商 / `MUL` 低 64 位     |
| `r1`     | `rcx`  | System V 第 4 参 / 移位 count (CL)         |
| `r2`     | `rdx`  | System V 第 3 参 / `DIV` 余 / `MUL` 高 64 位|
| `r3`     | `rbx`  | **callee-saved**                           |
| `r4`     | `rsp`  | **禁止**普通读写——栈指针，只由 `stack::alloc` 管理 |
| `r5`     | `rbp`  | **callee-saved** / 帧指针                  |
| `r6`     | `rsi`  | System V 第 2 参                           |
| `r7`     | `rdi`  | System V 第 1 参                           |
| `r8`     | `r8`   | System V 第 5 参                           |
| `r9`     | `r9`   | System V 第 6 参                           |
| `r10`    | `r10`  | caller-saved                               |
| `r11`    | `r11`  | caller-saved                               |
| `r12`    | `r12`  | **callee-saved**                           |
| `r13`    | `r13`  | **callee-saved**                           |
| `r14`    | `r14`  | **callee-saved**                           |
| `r15`    | `r15`  | **callee-saved**                           |

几条硬规则：

- **`r4` 禁止普通读写**——它是 `rsp`。栈需要通过 [`std/stack`](../../std-strict/32_std_stack.md) 操作；直接写 `r4 = ...` 是编译错
- `r5`（`rbp`）技术上允许读写，但编译器给它的默认角色是帧指针，写代码建议用 `r12`–`r15` 做 callee-saved 临时
- `r16`–`r999` **不存在**——写到源码里就是编译错"x86-64 没有这个寄存器"
- Callee-saved 集合 `{r3, r5, r12, r13, r14, r15}` 由 ABI 固定，不可变更（见 [05. ABI](./05_abi.md)）

## XMM 映射（`f0`–`f15`）

| Aperio   | x86-64  | 角色                      |
|----------|---------|---------------------------|
| `f0`     | `xmm0`  | 浮点返回值 / System V 第 1 浮点参 |
| `f1`     | `xmm1`  | System V 第 2 浮点参       |
| `f2`     | `xmm2`  | System V 第 3 浮点参       |
| `f3`     | `xmm3`  | System V 第 4 浮点参       |
| `f4`     | `xmm4`  | System V 第 5 浮点参       |
| `f5`     | `xmm5`  | System V 第 6 浮点参       |
| `f6`     | `xmm6`  | System V 第 7 浮点参       |
| `f7`     | `xmm7`  | System V 第 8 浮点参       |
| `f8`–`f15` | `xmm8`–`xmm15` | caller-saved 临时 |

全部 16 个 XMM 在 System V 下都是 caller-saved。`f16`–`f999` 不存在。

AVX 的 `ymm*`、AVX-512 的 `zmm*` **不在本文档覆盖范围**——只写到 SSE2 的 64 位标量浮点运算（`addsd` / `mulsd` / `divsd` / `sqrtsd` 等）所需的底层支持。

## 子寄存器：类型决定指令宽度

x86-64 的 GPR 有分层视图：`RAX` / `EAX` / `AX` / `AL` 共享存储。Native-Strict x86 **不引入新语法**——沿用 Std-Strict 的"寄存器当前类型由最近一次赋值决定"（[05. 寄存器](../../std-strict/05_registers.md)）规则，编译器按**当前类型**选具体的 x86 指令形态：

| 当前类型      | 使用的 x86 视图  | 指令示例                            |
|---------------|------------------|-------------------------------------|
| `i8` / `u8`   | `AL` / `CL` / ...| `mov al, bl`、`add al, cl`          |
| `i16` / `u16` | `AX` / `CX` / ...| `mov ax, bx`、`add ax, cx`          |
| `i32` / `u32` | `EAX` / `ECX` / ...| `mov eax, ebx`、`add eax, ecx`    |
| `i64` / `u64` / `*T` | `RAX` / `RCX` / ...| `mov rax, rbx`、`add rax, rcx` |

**关键 x86 语义要记住**：

- 写入 32 位视图（`EAX`）会**自动把高 32 位清零**（`mov eax, 1` 之后 `rax = 1`）
- 写入 8 位 / 16 位视图**不影响**其余高位
- `r4`–`r15` 的 8 位视图是 `r4b`–`r15b`（不是 `spl` 那种旧式命名）

这些都是 x86 固有行为，Native-Strict 忠实呈现，不加额外封装。

## 寄存器别名照常工作

Std-Strict 的 `@` 绑定机制（见 [05. 寄存器别名](../../std-strict/05_registers.md#寄存器别名)）在 Native-Strict x86 **完全原样**——这是让这层文档可读的关键，因为 `r7` 读起来不如 `n` 直观，尤其当每个函数的第一参都得占 `r7`：

```rust
pub fn sum_to(n @ r7: i64) -> (sum @ r0: i64) uses (i @ r1) {
    sum = 0i64
    i   = 1i64
@loop:
    if (i > n) goto(@done)
    sum = sum + i
    i   = i + 1i64
    goto(@loop)
@done:
}
```

底层等价于：

```rust
pub fn sum_to(r7: i64) -> (r0: i64) uses (r1) { ... }
```

两个版本生成的汇编字节一致，但上面那版读起来像代码，下面那版更像一道填字谜。

## 与 Std-Strict 的差别速查

- 槽数量：`r0`–`r999` / `f0`–`f999` → `r0`–`r15` / `f0`–`f15`
- `r4` 从普通寄存器变成**栈指针**，禁止直接读写
- callee-saved 集合从"签名没写到的都算"变成**固定的 `{r3, r5, r12-r15}`**
- 当前类型决定使用哪个子寄存器视图——这不是新规则，只是 Std-Strict 那个抽象"类型"到 x86 的具象落地

其他（别名、类型遮蔽、`@label` 标签、`mem.<T>[...]` 语法）完全一致。
