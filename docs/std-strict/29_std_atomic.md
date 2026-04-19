# 29. `std/atomic` —— 并发原语

`std/atomic` 提供原子加载/存储、比较交换（CAS）、fetch-* 运算和内存屏障。所有原子操作默认走 **`seq_cst`**（顺序一致）内存序；需要更宽松的内存序时用带后缀的变体。

## 导入

```rust
import "std/atomic" as atomic
```

## 内存序约定

| 后缀         | 内存序            | 说明                                 |
|--------------|-------------------|--------------------------------------|
| （无）       | `seq_cst`         | 最强，默认                           |
| `_relaxed`   | `relaxed`         | 不保证其他操作的顺序，仅原子性        |
| `_acquire`   | `acquire`         | 用于 load / CAS 读端                  |
| `_release`   | `release`         | 用于 store / CAS 写端                 |
| `_acq_rel`   | `acquire + release` | 用于 CAS 及 RMW                    |

*未来扩展*：可能加 `_consume`，目前编译器把它当 `acquire` 处理。

## Load / Store

```rust
#[builtin] pub fn load_i8(addr: *i8) -> i8
#[builtin] pub fn load_i16(addr: *i16) -> i16
#[builtin] pub fn load_i32(addr: *i32) -> i32
#[builtin] pub fn load_i64(addr: *i64) -> i64
#[builtin] pub fn load_u8(addr: *u8) -> u8
// ... u16 / u32 / u64 / *T 同构

#[builtin] pub fn store_i32(addr: *i32, value: i32)
#[builtin] pub fn store_i64(addr: *i64, value: i64)
// ... 其他位宽同构

// 内存序变体
#[builtin] pub fn load_i64_relaxed(addr: *i64) -> i64
#[builtin] pub fn load_i64_acquire(addr: *i64) -> i64
#[builtin] pub fn store_i64_relaxed(addr: *i64, value: i64)
#[builtin] pub fn store_i64_release(addr: *i64, value: i64)
// ...
```

**指针必须是原子类型的 `*T`**——类型系统保证了 load 的位宽和结果类型匹配。用裸地址请显式 `as`。

## Exchange —— 原子交换

```rust
#[builtin] pub fn exchange_i64(addr: *i64, value: i64) -> i64
#[builtin] pub fn exchange_i64_acq_rel(addr: *i64, value: i64) -> i64
// ... 其他位宽
```

原子地把 `value` 写入 `*addr`，返回**旧值**。

## Compare and Swap

```rust
#[builtin] pub fn compare_and_swap_i64(
    addr: *i64,
    expected: i64,
    desired: i64,
) -> i64

#[builtin] pub fn compare_and_swap_i64_acq_rel(
    addr: *i64,
    expected: i64,
    desired: i64,
) -> i64
// ... 其他位宽
```

原子地执行：

```
if *addr == expected {
    *addr = desired
}
return old_value
```

调用方通过比较返回值与 `expected` 判断是否成功：

```rust
import "std/atomic" as atomic

fn try_push(r1: *i64, r2: i64) -> (r0: bool) uses r3 {
    r3 = atomic::load_i64(addr = r1)
    r0 = atomic::compare_and_swap_i64(addr = r1, expected = r3, desired = r2) == r3
}
```

## Fetch-* —— 原子读改写（RMW）

```rust
#[builtin] pub fn fetch_add_i64(addr: *i64, delta: i64) -> i64
#[builtin] pub fn fetch_sub_i64(addr: *i64, delta: i64) -> i64
#[builtin] pub fn fetch_and_i64(addr: *i64, mask: i64) -> i64
#[builtin] pub fn fetch_or_i64(addr: *i64, mask: i64) -> i64
#[builtin] pub fn fetch_xor_i64(addr: *i64, mask: i64) -> i64

// 每个都有 _relaxed / _acquire / _release / _acq_rel 变体
```

返回**修改前**的旧值。等价于：

```
old = *addr
*addr = old op value
return old
```

典型用途：引用计数、原子计数器、位标志：

```rust
// 原子自增，返回旧值
r0 = atomic::fetch_add_i64(r1, 1i64)

// 原子设置位（返回旧值判断是否已置位）
r0 = atomic::fetch_or_i64(r1, 1i64 << 3)
```

## Fence —— 内存屏障

```rust
#[builtin] pub fn fence()                    // seq_cst
#[builtin] pub fn fence_acquire()
#[builtin] pub fn fence_release()
#[builtin] pub fn fence_acq_rel()
```

纯粹的内存屏障，不涉及任何数据访问。用于和 relaxed 访问组合出更强的顺序保证。

## 对齐要求

原子访问要求**自然对齐**：

- `*i8` / `*u8`：1 字节对齐（总是满足）
- `*i16` / `*u16`：2 字节对齐
- `*i32` / `*u32`：4 字节对齐
- `*i64` / `*u64`：8 字节对齐

未对齐的原子访问**不是 UB，而是编译期拒绝**——编译器检测不出来运行时的不对齐，但类型约束和数据段声明通常能保证。如果确实要访问未对齐地址，需要用平台特定方案。

## 完整示例：无锁计数器

```rust
import "std/atomic" as atomic
import "std/io" as io

var COUNTER: i64 = 0

pub fn increment() -> (r0: i64) {
    r0 = atomic::fetch_add_i64(&COUNTER, 1i64)
}

pub fn read_count() -> (r0: i64) {
    r0 = atomic::load_i64(&COUNTER)
}

pub fn reset() {
    atomic::store_i64(&COUNTER, 0i64)
}
```

## 规划中

浮点原子（`atomic::fetch_add_f64` 等）和 128 位原子（`__atomic_load_16`）属于"平台可能支持、可能不支持"的范畴，目前未加入——需要的话用 CAS 循环自己实现。
