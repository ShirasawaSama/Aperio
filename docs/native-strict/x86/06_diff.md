# 06. 与 Std-Strict 的差异

本章是一张速查清单——帮你一眼看出手上的 `.ap` 代码搬到 `.x86.ap` 需要改哪里。

## 改变 / 收紧的规则

| 主题              | Std-Strict                     | Native-Strict x86                                |
|-------------------|--------------------------------|--------------------------------------------------|
| 虚拟寄存器数量    | `r0`–`r999`, `f0`–`f999`       | `r0`–`r15`, `f0`–`f15`（见 [02. 寄存器](./02_registers.md)）|
| `r4` 用途         | 普通 GPR                       | **rsp**，禁止普通读写                            |
| 子寄存器          | 按类型隐式                     | 同样按类型隐式，但落地到 `AL`/`AX`/`EAX`/`RAX`  |
| 三操作数 ALU      | `r3 = r1 + r2` 合法            | **禁止**；用 `r0 = r1; r0 = r0 + r2` 或 `lea[...]`|
| `LEA` 语法        | 不存在                         | **新增** `r3 = lea[r1 + r2*4 + 8]`              |
| 除法形式          | `(rN, rM) = rX / rY`，任意槽   | **必须** `(r0, r2) = r0 / rY`                    |
| 乘法 128 位       | `(rN, rM) = rX * rY`，任意槽   | **必须** `(r2, r0) = r0 * rY`                    |
| 移位 count        | 任意 `rN` 或立即               | **只能** `r1` 或立即                             |
| 内存寻址          | `mem.<T>[任意表达式]`          | **只能** `[base + index*scale + disp]`           |
| 内存到内存拷贝    | `mem[A] = mem[B]` 由编译器压平 | **禁止**（需寄存器中转）                         |
| 函数签名 ABI      | 任意槽位自由组合               | **强制** System V AMD64                          |
| `uses` 列表       | 随意列任何非参数 / 非返回寄存器| **只能**列 caller-saved 槽                       |
| Callee-saved      | "签名没写到"推导                | **固定** `{r3, r5, r12-r15, rsp}`                |
| `&GLOBAL` 默认实现 | 编译器选                       | 默认 `lea[rip + GLOBAL]`（位置无关）            |
| `rip` 伪寄存器    | 不存在                         | **新增**，仅在寻址表达式里做 `base`             |

## 保持不变的规则

下列规则在 Native-Strict x86 里**字面一致**，照搬 Std-Strict 的语义与语法：

- [类型系统](../../std-strict/04_types.md)：`i8`/`i16`/`i32`/`i64`/`u*`/`f32`/`f64`/`bool`/`*T`
- [寄存器别名](../../std-strict/05_registers.md#寄存器别名)：`@` 绑定、文件级 / 签名级 / 函数体级作用域全都一样
- [类型遮蔽](../../std-strict/05_registers.md)：寄存器当前类型由最近赋值决定
- [字面量规则](../../std-strict/06_literals.md)：后缀、默认 `i64` / `f64`、编译期溢出检查
- [取地址 `&`](../../std-strict/09_address_of.md) 与数组 decay
- [`volatile` / `atomic`](../../std-strict/10_volatile.md) / [原子操作](../../std-strict/29_std_atomic.md)——编译到对应的 `mfence` / `lock` 前缀指令
- [控制流](../../std-strict/11_control_flow.md)：`@label` / `goto` / `if (...) goto(...)` 语法完全一致
- [多返回值](../../std-strict/12_functions.md)：`-> (r0, r2)` 写法照旧（但槽位要符合 System V）
- [函数属性](../../std-strict/14_function_attrs.md)：`#[noreturn]` / `#[cold]` / `#[naked]` / `#[inline]` / `#[section(...)]` 全部保留
- [inline 函数](../../std-strict/15_inline.md) / [函数指针](../../std-strict/16_function_pointers.md)
- [常量 / 数据段 / 字符串 / 结构体](../../std-strict/17_constants.md)
- [模块 / FFI / 宏](../../std-strict/21_modules.md)
- 标准库：`std/core`、`std/io`、`std/debug`、`std/convert`、`std/atomic`、`std/bits`、`std/ptr`、`std/stack`、`std/os` 全部可用
- [程序入口](../../std-strict/36_startup.md) / [条件编译](../../std-strict/37_cfg.md) / [未定义行为](../../std-strict/38_undefined_behavior.md)

## 心理模型

想象 Std-Strict 是"有 1000 个寄存器的理想 CPU + 一个完美的编译器"，而 Native-Strict x86 就是"把那个理想 CPU 的能力砍到 16 个寄存器 + 几条硬件限制"——代码要写的事情完全一样，只是你亲自承担了编译器原本帮你做的部分工作（寄存器分配、三操作数到两操作数的改写、`DIV` 前的 `CQO` 搬运、`LEA` 替代三操作数加法）。

如果某段 Std-Strict 代码在 Native-Strict x86 下不合法，**几乎总是**属于下面四类之一：

1. 用了 `r16` 及以上——换到 `r0`–`r15` 范围内
2. 写了三操作数 ALU——拆两步或用 `lea[...]`
3. 写了任意 `/` / `%` / 移位——改用 `(r0, r2) = r0 / rY` 或把 shift count 挪到 `r1`
4. 签名槽位不符合 System V——用别名 + 正确槽位重写签名

遇到第 5 种"别的"情况时先回头看本章的表。
