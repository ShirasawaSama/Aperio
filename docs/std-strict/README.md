# Aperio Std-Strict 语言指南

这里是 Aperio `Std-Strict` 模式（`.ap`）的完整语言参考。Std-Strict 是 Aperio 的核心中间表示层，位于高层 Loose 模式和具体架构的 Native-Strict 模式之间。

如果你是第一次接触 Aperio，建议按顺序阅读；如果你只是想查某个特定语法，可以直接跳到对应章节。

## 目录

### 入门

- [01. 概述](./01_overview.md) —— Std-Strict 是什么，为什么要这么设计
- [02. Hello World](./02_hello_world.md) —— 一个最小可运行的程序

### 语言基础

- [03. 词法](./03_lexical.md) —— 注释、标识符、关键字、字面量形式
- [04. 类型](./04_types.md) —— 整数、浮点、`bool`、指针类型族
- [05. 虚拟寄存器](./05_registers.md) —— `r0`–`r999`、`f0`–`f999`、类型遮蔽、寄存器别名
- [06. 字面量](./06_literals.md) —— 类型后缀、推导、溢出检查
- [07. 运算符](./07_operators.md) —— 算术、位运算、比较、`as` 转换

### 内存

- [08. 内存访问](./08_memory.md) —— `mem.<T>[...]` 的读写
- [09. 取地址](./09_address_of.md) —— `&`、数组衰减、函数地址
- [10. Volatile 访问](./10_volatile.md) —— `mem.<T>.volatile[...]`

### 控制流与函数

- [11. 控制流](./11_control_flow.md) —— 标签、`goto`、条件跳转、分支合并
- [12. 函数](./12_functions.md) —— 函数定义、调用、返回
- [13. 调用约定 (ABI)](./13_abi.md) —— 签名契约、Dreg 类型流五规则
- [14. 函数属性](./14_function_attrs.md) —— `#[noreturn]` / `#[naked]` / `#[cold]` 等
- [15. 内联函数](./15_inline.md) —— `#[inline]` 的语义与限制
- [16. 函数指针](./16_function_pointers.md) —— `fn(...) -> (...)` 类型与 `type` 别名

### 数据与结构

- [17. 编译期常量 & `const fn`](./17_constants.md) —— `const` 常量、编译期求值
- [18. 数据段](./18_data_segments.md) —— `val` / `var` / `.rodata` / `.data` / `.bss`
- [19. 字符串](./19_strings.md) —— `""` 与 `c""`
- [20. 结构体](./20_structs.md) —— 编译期偏移量模板

### 模块与 FFI

- [21. 模块](./21_modules.md) —— `import "path" as alias`
- [22. FFI](./22_ffi.md) —— `extern fn` 与 C 互操作

### 宏与标准库

- [23. 宏系统](./23_macros.md) —— 用户宏 + 编译器内置宏、`!` 后缀
- [24. 内置库总览](./24_builtins_overview.md) —— `#[builtin]` 属性、函数 vs 宏
- [25. `std/core`](./25_std_core.md) —— `select` 等基础原语
- [26. `std/io`](./26_std_io.md) —— `println!` / `print!` / `dbg!`
- [27. `std/debug`](./27_std_debug.md) —— `assert!` / `panic!` / `unreachable`
- [28. `std/convert`](./28_std_convert.md) —— 类型转换
- [29. `std/atomic`](./29_std_atomic.md) —— 原子操作与内存序
- [30. `std/bits`](./30_std_bits.md) —— 位操作原语
- [31. `std/ptr`](./31_std_ptr.md) —— 指针算术与转换
- [32. `std/stack`](./32_std_stack.md) —— 栈分配
- [33. `std/os`](./33_std_os.md) —— `syscall` / `exit` / `abort`
- [34. `std/simd`](./34_std_simd.md) —— 向量运算（占位）
- [35. `std/asm`](./35_std_asm.md) —— 内联汇编（占位）

### 运行时与附录

- [36. 程序入口与启动](./36_startup.md) —— `main` 约定、`_start` shim
- [37. 条件编译](./37_cfg.md) —— `#[cfg(...)]` / `#[cfg_attr(...)]`
- [38. 未定义行为](./38_undefined_behavior.md) —— 全部 UB 条目
- [39. 综合示例](./39_examples.md) —— 10 个完整可编译程序

## 约定

文档中的代码块使用 `text` 作为语言标识，因为 `.ap` 还没有被任何编辑器原生支持。所有示例均符合本文档描述的 Std-Strict 语法规则。
