# 39. 综合示例

本章提供几个完整的、可编译运行的 Aperio Std-Strict 程序，把前面各章的概念串起来。所有示例默认目标平台为 **Linux x86-64**。

## 示例 1：Hello, World

最小可运行程序。

```rust
import "std/io" as io

export pub fn main() -> (r0: i32) {
    io::println!("Hello, Aperio!")
    r0 = 0i32
}
```

## 示例 2：求 1 到 N 的和

演示循环、条件跳转、函数调用、`uses` 子句。

```rust
import "std/io" as io

fn sum_to(r1: i64) -> (r0: i64) uses r2 {
    r0 = 0i64
    r2 = 1i64

@loop:
    if (r2 > r1) goto(@done)
    r0 = r0 + r2
    r2 = r2 + 1i64
    goto(@loop)

@done:
}

export pub fn main() -> (r0: i32) uses r1 {
    r1 = sum_to(r1 = 100i64)                  // r1: i64 = 5050
    io::println!("sum 1..100 = {}", r1)
    r0 = 0i32
}
```

## 示例 3：同时取商和余数

演示多目标赋值语法——`(a, b) = x / y` 保证只发一条硬件除法指令。

```rust
import "std/io" as io

export pub fn main() -> (r0: i32) uses (r1, r2) {
    (r1, r2) = 17i64 / 5i64                   // r1 = 3（商），r2 = 2（余）
    io::println!("17 / 5 = {}, 17 % 5 = {}", r1, r2)
    r0 = 0i32
}
```

只需要其一时直接用 `/` 或 `%`；两个都要时用多目标赋值，避免朴素 codegen 发两条 `DIV`。

## 示例 4：结构体与栈分配

演示 `struct`、内存读写、`stack::alloc`、命名参数调用。

```rust
import "std/io" as io
import "std/stack" as stack

struct Point {
    x: i32,
    y: i32,
}

fn dist_squared(r1: *Point, r2: *Point) -> (r0: i32) uses (r3, r4, r5) {
    r3 = mem.i32[r2 + Point.x]
    r4 = mem.i32[r1 + Point.x]
    r3 = r3 - r4                              // dx

    r4 = mem.i32[r2 + Point.y]
    r5 = mem.i32[r1 + Point.y]
    r4 = r4 - r5                              // dy

    r0 = r3 * r3 + r4 * r4
}

export pub fn main() -> (r0: i32) uses (r1, r2, r3) {
    r1 = stack::alloc<Point>(1u64)
    mem.i32[r1 + Point.x] = 3i32
    mem.i32[r1 + Point.y] = 4i32

    r2 = stack::alloc<Point>(1u64)
    mem.i32[r2 + Point.x] = 0i32
    mem.i32[r2 + Point.y] = 0i32

    r3 = dist_squared(r1 = r1, r2 = r2)       // r3 = 25
    io::println!("dist^2 = {}", r3)

    r0 = 0i32
}
```

## 示例 5：与 C 互操作

演示 `extern fn` 和 C 的 `printf`（含变参）。

```rust
extern fn printf(fmt: *u8, ...) -> (r0: i32)

val FMT: u8[] = c"Factorial of %d is %lld\n"

fn factorial(r1: i64) -> (r0: i64) uses r2 {
    r0 = 1i64
    r2 = 1i64

@loop:
    if (r2 > r1) goto(@done)
    r0 = r0 * r2
    r2 = r2 + 1i64
    goto(@loop)

@done:
}

export pub fn main() -> (r0: i32) uses r1 {
    r1 = factorial(r1 = 10i64)                // r1 = 3628800
    printf(fmt = &FMT, 10i32, r1)             // 变参不做类型检查，由使用者保证匹配
    r0 = 0i32
}
```

编译后需要与 libc 链接：

```bash
aperio build main.ap -o main.o --emit=object
cc main.o -o main
./main
```

## 示例 6：跨模块 + `const fn`

演示 `import`、`const fn` 派生编译期常量。

### `math/ops.ap`

```rust
pub fn square(r1: i64) -> (r0: i64) {
    r0 = r1 * r1
}

pub const fn power_of_two(r1: u32) -> (r0: u64) {
    r0 = 1u64 << r1
}
```

### `main.ap`

```rust
import "std/io" as io
import "./math/ops" as m

const EIGHT: u64 = m::power_of_two(r1 = 3u32)      // 编译期 = 8

export pub fn main() -> (r0: i32) uses r1 {
    r1 = m::square(r1 = 5i64)                       // r1 = 25
    io::println!("5 squared = {}, 2^3 = {}", r1, EIGHT)
    r0 = 0i32
}
```

编译：

```bash
aperio build main.ap -o main
```

## 示例 7：断言与调试（寄存器别名版）

演示 `std/debug` 的宏、`dbg!` 调试打印，并展示寄存器别名如何大幅提升可读性。对比 [示例 2](#示例-2求-1-到-n-的和) 的纯 `r*` 风格。

```rust
import "std/io" as io
import "std/debug" as dbg

fn average(
    data  @ r1: *i64,
    count @ r2: u64,
) -> (avg @ r0: i64) uses (sum @ r3, i @ r4) {
    dbg::assert!(count > 0u64, "count must be positive, got {}", count)

    sum = 0i64
    i   = 0u64

@loop:
    if (i >= count) goto(@done)
    sum = sum + mem.i64[data + i * 8u64]
    i   = i + 1u64
    goto(@loop)

@done:
    avg = sum / (count as i64)
    io::dbg!(avg)
}

val DATA: i64[5] = [10i64, 20i64, 30i64, 40i64, 50i64]

export pub fn main() -> (exit @ r0: i32) uses (result @ r1) {
    result = average(data = &DATA, count = 5u64)    // result = 30
    exit = 0i32
}
```

同一个算法的纯 `r*` 版做对照——生成代码字节一致，差的只有源码可读性：

```rust
fn average(r1: *i64, r2: u64) -> (r0: i64) uses (r3, r4) {
    dbg::assert!(r2 > 0u64, "count must be positive, got {}", r2)
    r3 = 0i64
    r4 = 0u64
@loop:
    if (r4 >= r2) goto(@done)
    r3 = r3 + mem.i64[r1 + r4 * 8u64]
    r4 = r4 + 1u64
    goto(@loop)
@done:
    r0 = r3 / (r2 as i64)
}
```

别名的完整规则（声明位置、严格替换、作用域覆盖）见 [05. 虚拟寄存器 — 寄存器别名](./05_registers.md#寄存器别名)。

## 示例 8：跨平台 Hello（条件编译）

演示 `#[cfg(...)]` 选择不同平台的 syscall。

```rust
import "std/os" as os

val MSG: u8[] = c"Hello\n"

#[cfg(target_os = "linux")]
const SYS_WRITE: u64 = 1u64

#[cfg(target_os = "macos")]
const SYS_WRITE: u64 = 0x2000004u64

export pub fn main() -> (r0: i32) {
    os::syscall(SYS_WRITE, 1i64, &MSG, MSG.length)
    r0 = 0i32
}
```

## 示例 9：原子计数器

演示 `std/atomic`。

```rust
import "std/io" as io
import "std/atomic" as atomic

var COUNTER: i64 = 0i64

pub fn bump() -> (r0: i64) {
    r0 = atomic::fetch_add_i64(addr = &COUNTER, value = 1i64)
}

export pub fn main() -> (r0: i32) uses r1 {
    bump()                                          // -> 0
    bump()                                          // -> 1
    r1 = bump()                                     // -> 2
    io::println!("counter after 3 bumps: {}", r1 + 1i64)
    r0 = 0i32
}
```

## 示例 10：函数指针分发

演示 `type` 别名和 `&fn_name` 取函数指针。

```rust
import "std/io" as io

type BinOp = fn(r1: i64, r2: i64) -> (r0: i64)

fn add(r1: i64, r2: i64) -> (r0: i64) { r0 = r1 + r2 }
fn sub(r1: i64, r2: i64) -> (r0: i64) { r0 = r1 - r2 }
fn mul(r1: i64, r2: i64) -> (r0: i64) { r0 = r1 * r2 }

fn apply(r1: BinOp, r2: i64, r3: i64) -> (r0: i64) {
    r0 = r1(r1 = r2, r2 = r3)
}

export pub fn main() -> (r0: i32) uses (r1, r2, r3) {
    r1 = apply(r1 = &add, r2 = 10i64, r3 = 3i64)    // 13
    r2 = apply(r1 = &sub, r2 = 10i64, r3 = 3i64)    // 7
    r3 = apply(r1 = &mul, r2 = 10i64, r3 = 3i64)    // 30
    io::println!("10 +/-/* 3 = {}, {}, {}", r1, r2, r3)
    r0 = 0i32
}
```

这些示例覆盖了 Std-Strict 日常会用到的大部分特性。更深入的用法散落在各个对应章节。
