# 25. `std/core` —— 基础原语

`std/core` 放"最基础、所有程序都可能用"的单指令原语。模块目前很小——未来可能扩充一些 `min` / `max` / `abs` 这类"硬件上是单指令"的工具。

## 导入

```rust
import "std/core" as core
```

## API

### `select<T>`

```rust
#[builtin] pub fn select<T>(cond: bool, if_true: T, if_false: T) -> T
```

根据 `cond` 的值从 `if_true` / `if_false` 中选一个返回。编译器通常会生成无分支的 `cmov` / `csel` 之类的条件移动指令。

#### 语义要点

- **两个分支都会被求值**。`select` 是函数调用而非控制流——参数在调用前就已全部计算。有副作用（内存写入、调用其他函数）时要小心。
- **`T` 由调用点推导**。`if_true` 和 `if_false` 的当前类型必须**严格一致**（见 [24. 内置库总览](./24_builtins_overview.md) 的"泛型一致性"）。
- **`cond` 必须是 `bool`**。整数想当条件用，先显式比较或 `as`：

  ```rust
  r3 = core::select(r1 != 0, r2, r4)        // OK
  r3 = core::select(r1 as bool, r2, r4)     // 编译错：i64 不能 as bool
  ```

#### 用法

```rust
import "std/core" as core

r0 = core::select(r2 > 0, r3, r4)             // 整数三选一
f0 = core::select(r2 == 0, f3, f4)            // 浮点三选一
r0 = core::select(r2 != 0, r3 * 2, r4 + 1)    // 两边表达式都会算

// 绝对值的分支化实现
fn abs_i64(r1: i64) -> (r0: i64) {
    r0 = core::select(r1 >= 0, r1, -r1)
}
```

#### 对比：`select` vs `if/goto`

如果两侧表达式**有副作用**或**计算昂贵**，不应该用 `select`：

```rust
// 两次 mem 读都会发生
r3 = core::select(r1 > 0, mem.i32[r4], mem.i32[r5])

// 等价但只读一次：
if (r1 > 0) goto(@pos)
    r3 = mem.i32[r5]
    goto(@end)
@pos:
    r3 = mem.i32[r4]
@end:
```

`select` 的优势在**短路径无副作用**的场景，通常比跳转快。

> **同时要商和余数**：不用 builtin，直接用多目标赋值 `(r1, r2) = r4 / r5`。见 [07. 运算符 — 同时需要商和余数](./07_operators.md#同时需要商和余数)。

## 规划中

以下原语计划加入 `std/core`，目前未实现：

- `min<T>(a: T, b: T) -> T`
- `max<T>(a: T, b: T) -> T`
- `abs<T>(x: T) -> T`（`T` ∈ `{i*, f*}`）
- `clamp<T>(x: T, lo: T, hi: T) -> T`

这些都是硬件上"一两条指令就能表达"的原语，不涉及格式串、lazy 求值等需要宏展开的机制——所以放函数不放宏。
