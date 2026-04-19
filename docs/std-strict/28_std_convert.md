# 28. `std/convert` —— 类型转换

`std/convert` 提供整数宽度调整、整浮互转、浮点精度调整、位重解释等所有**非平凡**的类型转换。日常算术里那些简单的 `as`（整数内截断/扩展、指针转换）由语言核心提供（见 [07. 运算符](./07_operators.md)），不走这里。

## 导入

```rust
import "std/convert" as conv
```

## 命名原则

| 方向               | 命名模板                    |
|--------------------|-----------------------------|
| 符号扩展（窄→宽）  | `sign_extend_from_<src>`    |
| 零扩展（窄→宽）    | `zero_extend_from_<src>`    |
| 截断（宽→窄）      | `truncate_to_<dst>`         |
| 整数 → 浮点        | `<src>_to_<dst>`            |
| 浮点 → 整数        | `<src>_to_<dst>_<模式>`     |
| 浮点精度           | `<src>_to_<dst>`            |
| 位重解释           | `bitcast_<src>_to_<dst>`    |

所有函数都是 `#[builtin]`，可以用位置或命名参数调用。

## 整数宽度调整

### 符号扩展 —— 把窄有符号扩到 i64

```rust
#[builtin] pub fn sign_extend_from_i8(value: i8) -> i64
#[builtin] pub fn sign_extend_from_i16(value: i16) -> i64
#[builtin] pub fn sign_extend_from_i32(value: i32) -> i64
```

### 零扩展 —— 把窄无符号扩到 i64

```rust
#[builtin] pub fn zero_extend_from_u8(value: u8) -> i64
#[builtin] pub fn zero_extend_from_u16(value: u16) -> i64
#[builtin] pub fn zero_extend_from_u32(value: u32) -> i64
```

### 截断 —— 从 i64 截到窄类型

```rust
#[builtin] pub fn truncate_to_i8(value: i64) -> i8
#[builtin] pub fn truncate_to_i16(value: i64) -> i16
#[builtin] pub fn truncate_to_i32(value: i64) -> i32
#[builtin] pub fn truncate_to_u8(value: i64) -> u8
#[builtin] pub fn truncate_to_u16(value: i64) -> u16
#[builtin] pub fn truncate_to_u32(value: i64) -> u32
```

截断直接保留低 N 位，不做溢出检查。

#### 和 `as` 的区别

整数 → 整数的宽度调整也可以用 `as`（见 [07. 运算符](./07_operators.md)）：

```rust
r1 = r2 as u8                // 等价于 conv::truncate_to_u8(r2)
r1 = r2 as i64               // 来自 i32 时等价于 sign_extend_from_i32(r2)
```

`as` 写起来短，`conv::*` 写起来**方向明确**。两者在目标代码上产生相同的指令——按口味选。

## 整数 ↔ 浮点

### 整数 → 浮点

```rust
#[builtin] pub fn i32_to_f32(value: i32) -> f32
#[builtin] pub fn i32_to_f64(value: i32) -> f64
#[builtin] pub fn i64_to_f32(value: i64) -> f32
#[builtin] pub fn i64_to_f64(value: i64) -> f64
#[builtin] pub fn u32_to_f32(value: u32) -> f32
#[builtin] pub fn u32_to_f64(value: u32) -> f64
#[builtin] pub fn u64_to_f32(value: u64) -> f32
#[builtin] pub fn u64_to_f64(value: u64) -> f64
```

转换按 IEEE 754 的默认舍入模式（通常是 "round to nearest, ties to even"）。结果在 `f*` 寄存器里。

### 浮点 → 整数（按取整模式）

```rust
#[builtin] pub fn f32_to_i32_truncate(value: f32) -> i32     // 向零截断
#[builtin] pub fn f32_to_i32_round(value: f32) -> i32        // 最近偶数
#[builtin] pub fn f32_to_i32_floor(value: f32) -> i32        // 向负无穷
#[builtin] pub fn f32_to_i32_ceil(value: f32) -> i32         // 向正无穷

#[builtin] pub fn f32_to_i64_truncate(value: f32) -> i64
#[builtin] pub fn f32_to_i64_round(value: f32) -> i64
#[builtin] pub fn f32_to_i64_floor(value: f32) -> i64
#[builtin] pub fn f32_to_i64_ceil(value: f32) -> i64

#[builtin] pub fn f64_to_i32_truncate(value: f64) -> i32
// ... i64 版本同构
#[builtin] pub fn f64_to_i64_truncate(value: f64) -> i64
// ... 四种舍入 * {i32, i64}

// 无符号版本（同构扩展）
#[builtin] pub fn f64_to_u32_truncate(value: f64) -> u32
#[builtin] pub fn f64_to_u64_truncate(value: f64) -> u64
// ...
```

#### 超范围行为

浮点值超出目标整数范围时（例如 `f64 = 1e100` 转成 `i32`）按**饱和**处理：溢出到目标类型的最大/最小值，不是 UB。NaN 转整数结果为 0。

## 浮点精度

```rust
#[builtin] pub fn f32_to_f64(value: f32) -> f64            // 扩展（无损）
#[builtin] pub fn f64_to_f32(value: f64) -> f32            // 收缩（按默认舍入）
```

## 位重解释 `bitcast`

不改变位模式、只换寄存器类别或类型视角：

```rust
#[builtin] pub fn bitcast_i32_to_f32(value: i32) -> f32
#[builtin] pub fn bitcast_i64_to_f64(value: i64) -> f64
#[builtin] pub fn bitcast_u32_to_f32(value: u32) -> f32
#[builtin] pub fn bitcast_u64_to_f64(value: u64) -> f64
#[builtin] pub fn bitcast_f32_to_i32(value: f32) -> i32
#[builtin] pub fn bitcast_f64_to_i64(value: f64) -> i64
#[builtin] pub fn bitcast_f32_to_u32(value: f32) -> u32
#[builtin] pub fn bitcast_f64_to_u64(value: f64) -> u64
```

典型用途：

- 从浮点寄存器里拿出位模式做位运算
- `memcpy` 之类的底层实现里构造 NaN / 负零的特定位模式

```rust
r0 = conv::bitcast_f64_to_i64(f1)          // 读浮点的 64 位
r0 = r0 & 0x7FFF_FFFF_FFFF_FFFFi64         // 清掉符号位
f1 = conv::bitcast_i64_to_f64(r0)          // 写回
// 效果等价于 f1 = abs(f1)（位级别）
```

## 为什么这么细

- **方向在函数名里**——读代码的人看一眼就知道在干什么，不用回头看操作数类型
- **所有函数都是 `#[builtin]`**——每一个都对应一条目标指令，没有额外开销
- **强迫用户选择舍入模式**——浮点→整数的舍入模式是性能和正确性的大坑，语言不替你做默认

看起来函数数量多，但模式规整（源 × 目标 × 舍入），IDE 补全会列全。
