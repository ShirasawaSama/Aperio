# 05. ABI：System V AMD64 强制绑定

Std-Strict 的签名允许**任意**选 `r*` 做参数 / 返回 / `uses`，这是"虚拟 ABI"。到了 Native-Strict x86，签名必须匹配底层 C 世界——即 **System V AMD64 ABI**（Linux / macOS / BSD 通用）。违反 ABI 的签名直接报编译错。

## 参数槽位

| 参数序号 | 整数 / 指针（System V）     | 浮点（`f32`/`f64`）  |
|----------|-----------------------------|----------------------|
| 第 1 个  | `r7`（rdi）                 | `f0`（xmm0）         |
| 第 2 个  | `r6`（rsi）                 | `f1`（xmm1）         |
| 第 3 个  | `r2`（rdx）                 | `f2`（xmm2）         |
| 第 4 个  | `r1`（rcx）                 | `f3`（xmm3）         |
| 第 5 个  | `r8`                        | `f4`（xmm4）         |
| 第 6 个  | `r9`                        | `f5`（xmm5）         |
| 第 7 个  | （走栈）                    | `f6`（xmm6）         |
| 第 8 个  | （走栈）                    | `f7`（xmm7）         |
| 第 9+ 个 | 走栈                        | 走栈                 |

整数和浮点**分别计数**——签名 `fn f(r7: i64, f0: f64, r6: *u8, f1: f32)` 是合法的第 1/2/3/4 个参数。

超过 6 个整数或 8 个浮点参数时，剩余的走栈。本文档**不展开栈传参**的槽位写法——等到你真正需要时单独加章节。

## 返回值

| 类型                | 槽位                       |
|---------------------|----------------------------|
| `i8`–`i64`/`u*`/`*T`/`bool` | `r0`（rax）        |
| `f32` / `f64`       | `f0`（xmm0）               |
| 结构体 ≤ 16 字节    | 拆成最多两个寄存器（`r0`+`r2` 或 `f0`+`f1`）|
| 结构体 > 16 字节    | 调用者在栈上预留，被调用者写回（暂不展开）|

多返回值继承 Std-Strict 的 `-> (r0, r2)` 写法，**但槽位必须符合上表**——`-> (r3, r5)` 会报错"不符合 System V"。

## Callee-saved vs Caller-saved

固定如下：

| 类别         | 槽位                                        |
|--------------|---------------------------------------------|
| Callee-saved | `r3`, `r5`, `r12`, `r13`, `r14`, `r15`, `r4`（rsp） |
| Caller-saved | `r0`, `r1`, `r2`, `r6`, `r7`, `r8`, `r9`, `r10`, `r11`, 以及所有 `f0`–`f15` |

- **Callee-saved** 是被调用者必须保持不变的寄存器——如果你在函数体里写了它，编译器会**自动生成** prologue / epilogue 把原值保存到栈再恢复
- **Caller-saved** 是调用者必须自己负责保存的寄存器——跨调用后它们的值不可信

## `uses` 语义收紧

`uses` 子句的含义与 Std-Strict 一致——声明"本函数除了参数 / 返回值还会写入的槽"——但在 Native-Strict x86 下有两条额外规则：

**1. 只能列 caller-saved 槽。**列 callee-saved 直接报错：

```rust
fn foo(r7: i64) -> (r0: i64) uses (r1, r2) { ... }   // OK：r1, r2 都是 caller-saved
fn foo(r7: i64) -> (r0: i64) uses (r3, r12) { ... }  // 编译错：r3/r12 是 callee-saved
                                                      // 想用它们？直接写就行，编译器自动保存恢复
```

为什么？callee-saved 的保存是**编译器自动做的**——函数内部想用哪个 callee-saved 槽就直接赋值，编译器识别写入后生成 prologue `push r3` 和 epilogue `pop r3`。把 callee-saved 放进 `uses` 会让它被当成 caller-saved，破坏 ABI。

**2. 未在 `uses` 里的 caller-saved 槽不能写。**这和 Std-Strict 的规则相同，只是物理约束变得具体：

```rust
fn foo(r7: i64) -> (r0: i64) uses r1 {
    r1 = r7 + 1                  // OK
    r2 = r7 + 2                  // 编译错：r2 是 caller-saved 且未在 uses 中
}
```

## 跨函数调用

调用点沿用 Std-Strict 的命名参数语法——只是参数名对应的**槽位**必须匹配 System V：

```rust
// 被调函数
pub fn add(lhs @ r7: i64, rhs @ r6: i64) -> (sum @ r0: i64) {
    sum = lhs
    sum = sum + rhs
}

// 调用者
r0 = add(lhs = 10i64, rhs = 20i64)      // OK
                                         // → mov rdi, 10
                                         //   mov rsi, 20
                                         //   call add
```

调用之后，所有 caller-saved 槽（`r0`, `r1`, `r2`, `r6`, `r7`, `r8`–`r11`, `f0`–`f15`）被视为已破坏——如果调用前这些槽里有活数据，调用者必须自己保存（用栈 / 挪到 callee-saved 槽 / 先用掉）。

## 签名违反 ABI = 编译错

```rust
fn add(r1: i64, r2: i64) -> (r0: i64) { ... }
// 编译错：r1 是 System V 第 4 参槽位，不能当第 1 参；
//        第 1 参必须是 r7。建议写法：fn add(lhs @ r7: i64, rhs @ r6: i64)
```

此时[寄存器别名](../../std-strict/05_registers.md#寄存器别名)就成了必需品而非可选项——没人想看一屏 `r7` / `r6` / `r2` / `r1` 组合的签名，用别名重命名是唯一的理智写法。

## `#[naked]` 仍然绕过所有检查

[`#[naked]`](../../std-strict/14_function_attrs.md) 在 Native-Strict x86 里含义不变——标注后：

- `uses` 必须空
- 编译器不生成 prologue / epilogue
- 不检查 ABI 匹配
- 不做 Dreg 类型流检查
- 你完全负责遵守 System V（或故意不遵守，比如手写 `_start` 或 syscall trampoline）

和 Std-Strict 一样，`#[naked]` 里**禁止**使用寄存器别名——别名的意义建立在 ABI 可推理之上。

## FFI

`extern fn` 的语义不变——它本来就走 System V（见 [22. FFI](../../std-strict/22_ffi.md)）。Native-Strict x86 里 `extern fn` 和普通 `fn` 的 ABI 规则**已经完全一致**——这是 Native-Strict 和 Std-Strict 的关键差别之一。
