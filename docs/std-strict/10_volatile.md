# 10. `volatile` 内存访问

Volatile 访问用于告诉编译器"这块内存可能被外部修改或观察"——典型场景是 **MMIO 寄存器**、**信号处理器共享状态**、**调试相关的探针**。

## 语法

```rust
r1 = mem.<T>.volatile[<addr>]
mem.<T>.volatile[<addr>] = r2
```

`volatile` 出现在 `<T>` 和 `[` 之间。和普通访问的区别仅在于优化约束，**语义类型**、**地址计算规则**、**指针类型要求**都和普通 `mem.<T>[...]` 一致（见 [08. 内存访问](./08_memory.md)）。

```rust
const UART_DATA: u64 = 0x1000_0000

fn putc(r1: u8) {
    mem.u8.volatile[UART_DATA] = r1
}

fn getc() -> (r0: u8) {
    r0 = mem.u8.volatile[UART_DATA]
}
```

## 编译器会做什么

对一个 volatile 访问：

- **不合并**：两次相邻的 volatile 读不会被合并成一次
- **不重排**：volatile 访问之间的相对顺序保持；volatile 和普通访问之间也不跨越
- **不消除**：即使看起来"没有副作用"的 volatile 读也不会被删除
- **不推测执行**：不会被提前到可能不该执行的路径上

等价于 C 的 `volatile` 限定符、Rust 的 `core::ptr::read_volatile` / `write_volatile`。

## 不保证的东西

- **不保证原子性**。哪怕只有一次 `mem.i64.volatile[p] = x`，在多核多线程场景下也可能被观察到撕裂。想要原子性，请走 [`std/atomic`](./29_std_atomic.md)。
- **不提供内存序**。volatile 只管单条访问的不被优化，不管跨线程可见性。跨线程共享仍然需要 `std/atomic::fence` 或原子访问。
- **不替代 `std/atomic`**。这两个是不同维度的工具：
  - `volatile`：阻止编译器优化
  - `atomic`：同时阻止编译器和硬件的重排 + 保证不撕裂

## 什么时候该用 volatile

- **MMIO 寄存器**：硬件外设的状态/数据寄存器，读写会触发副作用
- **信号处理器**：信号处理函数里访问主流程共享的变量（单线程，不需要 atomic 的跨核语义）
- **嵌入式调试**：调试工具通过观察某块内存判断程序状态，编译器不能把访问消除
- **setjmp/longjmp 跨边界的变量**：同样是防优化消除

## 什么时候**不**该用 volatile

- 多线程共享——用 `std/atomic`
- 纯粹只是不想让优化器乱动代码——信任编译器
- 想要保证执行顺序但数据不参与运算——用 `std/atomic::fence`

## 组合示例

```rust
import "std/atomic" as atomic

const STATUS_REG: u64 = 0x1000_0010
const DATA_REG: u64   = 0x1000_0014

fn uart_read_byte() -> (r0: u8) uses r1 {
@wait:
    r1 = mem.u32.volatile[STATUS_REG]
    if ((r1 & 1) == 0) goto(@wait)                 // 等 "ready" 位
    r0 = mem.u8.volatile[DATA_REG]
}
```

这里 `STATUS_REG` 的值由硬件单向更新，`volatile` 保证 `@wait` 的循环不会被优化成"读一次就常量传播"。

## 和非 volatile 的互操作

普通访问和 volatile 访问**可以**混用（指向不同地址），但编译器按 volatile 的规则处理 volatile 那些，按普通规则处理其余的——互相之间不会越界优化。
