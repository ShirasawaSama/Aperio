# 35. `std/asm` —— 内联汇编（占位）

**状态：规划中，未启动具体设计。**

本章仅声明这个方向存在，细节完全待定。

## 为什么这件事重要

在写 Std-Strict 的时候，**总有几处**是语言覆盖不到的：

- 特定的 CPU 指令（`RDTSC`、`CPUID`、`PAUSE`、`MFENCE` 的变体）
- 性能极致的手写热路径
- 上下文切换、中断返回、特权指令
- 与特定 ABI / 运行时对接的胶水代码

这些情况下，需要一个"我自己写指令，编译器不要干预"的通道。

## 预期方向

三种可能的设计（**都未定**）：

### 方案 A：Rust 风格的 `asm!` 宏

```rust
// 完全假设的语法
asm::asm!(
    "syscall",
    in("rax") 1u64,
    in("rdi") 1i64,
    in("rsi") &MSG,
    in("rdx") MSG.length,
    clobbers("rcx", "r11"),
)
```

优点：直接映射到目标架构的汇编语法，表达力最强。
缺点：每个架构要写一份——和 Std-Strict"架构无关"的初衷冲突。

### 方案 B：`#[naked]` + 手写 Native-Strict

```rust
#[naked]
pub fn do_syscall(r1: u64) -> (r0: i64) {
    @asm_x86_64 { "syscall" }
    @asm_aarch64 { "svc #0" }
    @asm_riscv64 { "ecall" }
}
```

优点：保持架构无关接口。
缺点：语法创新，学习成本。

### 方案 C：按平台的 `extern` block

```rust
extern "asm-x86_64" block {
    pub fn rdtsc() -> (r0: u64) = "rdtsc; shl rdx, 32; or rax, rdx"
}
```

优点：和 `extern fn` 统一，编辑器支持简单。
缺点：只能写单条指令。

## 目前该怎么办

- **能用 `#[builtin]` 解决的**：比如 `fence`、`byte_swap`、原子操作——用库（见 [29](./29_std_atomic.md)、[30](./30_std_bits.md)）
- **必须手写的**：通过 FFI 调用 C 里用 GCC/Clang intrinsics 写的函数
- **真的无路可走**：等这一章正式上线

## 跟进

上线前需要决定的事：

- 选定上述方案之一（或第四种）
- 跨架构的指令描述格式
- 与 Std-Strict 类型系统的交互（输入/输出的类型契约）
- 内联汇编块能不能被编译器重排、消除？（大概率不能）
- 调试信息如何携带

目前这一章只作目录里的占位。
