# Aperio Std-Strict 语言指南

这里是 Aperio `Std-Strict` 模式（`.ap`）的完整语言参考。Std-Strict 是 Aperio 的核心中间表示层，位于高层 Loose 模式和具体架构的 Native-Strict 模式之间。

如果你是第一次接触 Aperio，建议按顺序阅读；如果你只是想查某个特定语法，可以直接跳到对应章节。

## 目录

### 入门

- [01. 概述](./01_overview.md) —— Std-Strict 是什么，为什么要这么设计
- [02. Hello World](./02_hello_world.md) —— 一个最小可运行的程序

### 语言基础

- [03. 词法](./03_lexical.md) —— 注释、标识符、数字与字符串字面量
- [04. 数据类型](./04_types.md) —— `i8` 到 `f64` 的内置类型
- [05. 虚拟寄存器](./05_registers.md) —— `r0` 到 `r999` 的使用规则
- [06. 运算符](./06_operators.md) —— 算术、位运算、比较运算

### 内存与指针

- [07. 内存访问](./07_memory.md) —— `mem.i32[...]` 的读写语义
- [08. 取地址运算符](./08_address_of.md) —— `&` 的用法

### 控制流与函数

- [09. 控制流](./09_control_flow.md) —— 标签、`goto`、条件跳转
- [10. 函数](./10_functions.md) —— 函数的定义、调用与返回
- [11. 调用约定 (ABI)](./11_abi.md) —— 参数、返回值、`uses` 契约
- [12. 内联函数](./12_inline.md) —— `inline` 关键字

### 数据与结构

- [13. 编译期常量](./13_constants.md) —— `const`
- [14. 数据段](./14_data_segments.md) —— `val` 与 `var`、`.rodata` / `.data` / `.bss`
- [15. 字符串字面量](./15_strings.md) —— 普通字符串、C 风格字符串、字节数组
- [16. 结构体](./16_structs.md) —— 编译期偏移量模板
- [17. 栈管理](./17_stack.md) —— `stack.alloc` 与自动释放

### 模块与系统

- [18. 模块](./18_modules.md) —— `import`、`export` 与符号修饰
- [19. FFI](./19_ffi.md) —— `extern fn` 与 C 互操作
- [20. 系统调用](./20_syscall.md) —— `syscall` 指令
- [21. 内置标准库](./21_builtins.md) —— `std::println`、`std::dbg`、`std::assert` 等调试原语

### 附录

- [22. 综合示例](./22_examples.md) —— 完整可运行程序集

## 约定

文档中的代码块使用 `text` 作为语言标识，因为 `.ap` 还没有被任何编辑器原生支持。所有示例均符合本文档描述的 Std-Strict 语法规则。
