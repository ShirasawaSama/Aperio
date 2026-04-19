# Aperio Native-Strict x86 指南

面向 x86-64 的 Native-Strict 模式（`.x86.ap`）。本指南是**差异文档**——只讲 Native-Strict x86 比 [Std-Strict](../../std-strict/README.md) 多出 / 少掉 / 改变 的内容，原样继承的概念一律回链到 Std-Strict 章节。

## 目录

- [01. 概述](./01_overview.md) —— Native-Strict x86 的定位、文件扩展名、继承与裁剪一览
- [02. 寄存器](./02_registers.md) —— `r0`–`r15` ↔ x86-64 GPR、`f0`–`f15` ↔ XMM、子寄存器视图、别名沿用
- [03. 指令形式](./03_instructions.md) —— 两操作数 ALU、`LEA`、`DIV/MUL` 固定槽、移位 count 约束
- [04. 内存寻址](./04_addressing.md) —— `[base + index*scale + disp]` 唯一寻址形态、RIP 相对
- [05. ABI](./05_abi.md) —— System V AMD64 强制绑定、`uses` 语义收紧
- [06. 差异](./06_diff.md) —— 与 Std-Strict 差异速查清单
- [07. 对照示例](./07_examples.md) —— `strlen` / `divmod` 的两版对照

## 速读路径

- **只想快速看差异**：直接跳 [06. 差异](./06_diff.md)
- **想写一段代码**：按顺序看 01 → 02 → 03 → 05（寻址和示例边用边查）
- **在 Std-Strict 里写熟的现在想理解它怎么落到 x86**：[07. 对照示例](./07_examples.md) 开始，碰到陌生概念回前面的章节

## 其他架构

- ARM / RISC-V / Wasm 的 Native-Strict 文档尚未开写。当它们存在时，会与本目录并列放在 `docs/native-strict/arm/`、`docs/native-strict/riscv/`、`docs/native-strict/wasm/`。
