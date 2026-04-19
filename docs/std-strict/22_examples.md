# 22. 综合示例

本章提供几个完整的、可编译运行的 Aperio Std-Strict 程序，把前面各章的概念串起来。所有示例默认目标平台为 **Linux x86-64**。

## 示例 1：Hello, World

最小可运行程序。

```text
val MSG: u8[] = "Hello, Aperio!\n"

export pub fn main() -> r0 {
    syscall(1, 1, &MSG, MSG.length)   // sys_write(stdout, MSG, len)
    syscall(60, 0)                     // sys_exit(0)
    r0 = 0
}
```

## 示例 2：求 1 到 N 的和

演示循环、条件跳转、函数调用、`uses` 子句。

```text
// 计算 1 + 2 + ... + n，返回和
fn sum_to(r1) -> r0 uses r2 {
    r0 = 0              // 累加器
    r2 = 1              // 计数器

@loop:
    if (r2 > r1) goto(@done)
    r0 = r0 + r2
    r2 = r2 + 1
    goto(@loop)

@done:
}

export pub fn main() -> r0 {
    sum_to(r1 = 100)                      // r0 = 5050
    std::println("sum 1..100 = {d}", r0)
    syscall(60, 0)
    r0 = 0
}
```

## 示例 3：多返回值 —— 除法与取模

演示多返回值的定义和解构接收。

```text
// 一次调用同时算出商和余数
fn divmod(r1, r2) -> (r0, r3) {
    r0 = r1 / r2       // 商
    r3 = r1 % r2       // 余
}

export pub fn main() -> r0 uses r3 {
    (r0, r3) = divmod(r1 = 17, r2 = 5)    // r0 = 3, r3 = 2

    std::println("17 / 5 = {d}, 17 % 5 = {d}", r0, r3)
    syscall(60, 0)
    r0 = 0
}
```

## 示例 4：结构体与内存操作

演示 `struct`、内存读写、`stack.alloc`、多参数命名调用。

```text
struct Point {
    x: i32,
    y: i32,
}

// 计算两点间的距离平方：(p2.x - p1.x)^2 + (p2.y - p1.y)^2
fn dist_squared(r1, r2) -> r0 uses (r3, r4, r5) {
    // r1 = *p1, r2 = *p2
    r3 = mem.i32[r2 + Point.x]
    r4 = mem.i32[r1 + Point.x]
    r3 = r3 - r4                // dx

    r4 = mem.i32[r2 + Point.y]
    r5 = mem.i32[r1 + Point.y]
    r4 = r4 - r5                // dy

    r0 = r3 * r3 + r4 * r4
}

export pub fn main() -> r0 uses (r1, r2) {
    r1 = stack.alloc(Point.size)
    mem.i32[r1 + Point.x] = 3
    mem.i32[r1 + Point.y] = 4

    r2 = stack.alloc(Point.size)
    mem.i32[r2 + Point.x] = 0
    mem.i32[r2 + Point.y] = 0

    dist_squared(r1 = r1, r2 = r2)        // r0 = 25
    std::println("dist^2 = {d}", r0)

    syscall(60, r0)                        // 以 25 为退出码退出
    r0 = 0
}
```

## 示例 5：与 C 互操作

演示 `extern fn` 和 C 的 `printf`（含变参）。

```text
extern fn printf(fmt: u64, ...) -> i32

val FMT: u8[] = c"Factorial of %d is %lld\n"

// 计算 n!
fn factorial(r1) -> r0 uses r2 {
    r0 = 1
    r2 = 1

@loop:
    if (r2 > r1) goto(@done)
    r0 = r0 * r2
    r2 = r2 + 1
    goto(@loop)

@done:
}

export pub fn main() -> r0 {
    factorial(r1 = 10)                    // r0 = 3628800
    printf(fmt = &FMT, 10, r0)            // 变参部分用位置参数
    r0 = 0
}
```

编译后需要与 libc 链接：

```bash
aperio -o main.o main.ap
cc main.o -o main
./main
```

## 示例 6：跨模块

演示 `import` 和符号修饰。

### `math/ops.ap`

```text
pub fn square(r1) -> r0 {
    r0 = r1 * r1
}

pub fn cube(r1) -> r0 uses r2 {
    r2 = r1 * r1
    r0 = r2 * r1
}
```

### `main.ap`

```text
import math::ops as m

export pub fn main() -> r0 {
    m::square(r1 = 5)                     // r0 = 25
    m::cube(r1 = r0)                      // r0 = 15625

    std::println("cube(square(5)) = {d}", r0)

    syscall(60, 0)
    r0 = 0
}
```

编译：

```bash
aperio -o main main.ap math/ops.ap
```

链接器会看到 `main`（因为 `export`）和 `__aperio_math_ops_square` / `__aperio_math_ops_cube`（因为 `pub` 但无 `export`）。

## 示例 7：带调试断言的求平均

展示 `uses` 的范围语法、内置调试函数的用法。

```text
// 计算 [r1, r1+8, r1+16, ...] 共 r2 个 i64 的平均值
fn average(r1, r2) -> r0 uses (r3, r4) {
    std::assert(r2 > 0, "count must be positive, got {d}", r2)

    r3 = 0                  // sum
    r4 = 0                  // index

@loop:
    if (r4 >= r2) goto(@done)
    r3 = r3 + mem.i64[r1 + r4 * 8]
    r4 = r4 + 1
    goto(@loop)

@done:
    r0 = r3 / r2
    std::dbg(r0)
}

val DATA: i64[] = [10, 20, 30, 40, 50]

export pub fn main() -> r0 {
    average(r1 = &DATA, r2 = 5)           // r0 = 30
    syscall(60, 0)
    r0 = 0
}
```

## 示例 8：大量临时寄存器 —— 范围语法

当函数用到一长串连续的临时寄存器时，用区间语法比逐个罗列更清爽。

```text
// 简化版 FFT 蝴蝶运算的一个阶段，需要大量中间寄存器
fn fft_stage(r1, r2, r3, r4) -> r0 uses r5..=r12 {
    // r1 = 输入实部指针
    // r2 = 输入虚部指针
    // r3 = 旋转因子指针
    // r4 = 步长

    r5  = mem.f64[r1]              // x_re
    r6  = mem.f64[r2]              // x_im
    r7  = mem.f64[r1 + r4 * 8]     // y_re
    r8  = mem.f64[r2 + r4 * 8]     // y_im
    r9  = mem.f64[r3]              // w_re
    r10 = mem.f64[r3 + 8]          // w_im

    // t = y * w
    r11 = r7 * r9 - r8 * r10       // t_re
    r12 = r7 * r10 + r8 * r9       // t_im

    // 输出 = x ± t
    mem.f64[r1]            = r5 + r11
    mem.f64[r2]            = r6 + r12
    mem.f64[r1 + r4 * 8]   = r5 - r11
    mem.f64[r2 + r4 * 8]   = r6 - r12

    r0 = 0
}
```

`uses r5..=r12` 一行表达了 8 个临时寄存器，比 `uses (r5, r6, r7, r8, r9, r10, r11, r12)` 紧凑得多。
