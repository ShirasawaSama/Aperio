# 01. 概述

Native-Strict x86 是 Aperio 在 [Std-Strict](../../std-strict/README.md) 之下的一层——**它不是独立语言**，也不是汇编的美化皮肤。一句话定位：

> **Native-Strict x86 = Std-Strict ∩ x86-64 硬件能力**

换句话说，能在 Native-Strict x86 里写的每一段代码，都是合法的 Std-Strict 代码；反过来不成立。Native-Strict 做的事情，是**把 Std-Strict 里那些编译器替你糊掉的硬件差异重新暴露出来**，让你看清楚每一条指令要占哪个物理寄存器、要遵循哪条调用约定。

## 文件扩展名与目标

- 扩展名 `.x86.ap`——编译器看到这个后缀就启用 Native-Strict x86 的裁剪规则
- 默认目标三元组 `x86_64-linux-gnu`（64 位 x86，Linux，System V AMD64 ABI）
- Windows x64 / macOS x64 用同样的硬件但不同的 ABI，单独归 `x86-windows`/`x86-macos` 章节，本节文档不覆盖

## 原样继承

下列概念从 Std-Strict 一字不改：

- [类型系统](../../std-strict/04_types.md)——`i8`/`i16`/`i32`/`i64`/`u*`/`f32`/`f64`/`*T`/`bool`
- [字面量规则](../../std-strict/06_literals.md)
- [寄存器别名](../../std-strict/05_registers.md#寄存器别名)——`@` 绑定原样工作，只是底层槽数量从 1000 缩到 16
- [控制流](../../std-strict/11_control_flow.md)——标签、`goto`、`if (...) goto(...)`
- [函数属性](../../std-strict/14_function_attrs.md)——`#[naked]`、`#[noreturn]`、`#[inline]` 等
- [函数指针](../../std-strict/16_function_pointers.md)
- [数据段](../../std-strict/18_data_segments.md)、[字符串](../../std-strict/19_strings.md)、[结构体](../../std-strict/20_structs.md)
- [模块系统](../../std-strict/21_modules.md)、[FFI](../../std-strict/22_ffi.md)、[宏](../../std-strict/23_macros.md)
- 标准库 `std/core`、`std/io`、`std/debug`、`std/convert`、`std/atomic`、`std/bits`、`std/ptr`、`std/stack`、`std/os`

## 裁剪什么

Native-Strict x86 在 Std-Strict 的基础上收紧下列几件事：

1. **寄存器数量**：`r0`–`r999` → **`r0`–`r15`**；`f0`–`f999` → **`f0`–`f15`**（见 [02. 寄存器](./02_registers.md)）
2. **指令形式**：ALU 绑定为两操作数 `dst = dst OP src` 形式；`DIV`/`MUL`/移位的操作数槽位固定（见 [03. 指令形式](./03_instructions.md)）
3. **内存寻址**：只能写 `[base + index*scale + disp]`，自由表达式不允许（见 [04. 内存寻址](./04_addressing.md)）
4. **ABI**：函数签名强制绑定 System V AMD64（见 [05. ABI](./05_abi.md)）

完整差异清单见 [06. 与 Std-Strict 的差异](./06_diff.md)。

## 什么时候用 Native-Strict x86

- 对照着学习真实 x86-64 汇编，想知道 Std-Strict 的某一行会编成哪条指令
- 写性能敏感代码，想亲手控制每一条指令占哪个物理寄存器、从而避免编译器寄存器分配器的保守溢出
- 验证或复现某个 CPU 特性（一致性、cache 行为、DIV 延迟等），需要精确到指令槽位
- 编译器开发自测——把 Std-Strict 的后端输出抓出来跟手写的 Native-Strict x86 比对

如果没有这些需求，继续留在 [Std-Strict](../../std-strict/README.md) 里就好——它在 x86-64 上的实际性能差距通常小于 1%。
