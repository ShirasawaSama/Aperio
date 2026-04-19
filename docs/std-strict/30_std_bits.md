# 30. `std/bits` —— 位操作

`std/bits` 提供对应 CPU **单指令** 的位操作原语：前导 / 尾随零计数、位计数、字节交换、循环移位。

## 导入

```rust
import "std/bits" as bits
```

## API

### 前导零 / 尾随零 / 位计数

```rust
#[builtin] pub fn count_leading_zeros_i32(value: i32) -> i32
#[builtin] pub fn count_leading_zeros_i64(value: i64) -> i64
#[builtin] pub fn count_trailing_zeros_i32(value: i32) -> i32
#[builtin] pub fn count_trailing_zeros_i64(value: i64) -> i64
#[builtin] pub fn popcount_i32(value: i32) -> i32
#[builtin] pub fn popcount_i64(value: i64) -> i64

// 泛型版本（由调用点推导位宽）
#[builtin] pub fn count_leading_zeros<T>(value: T) -> T
#[builtin] pub fn count_trailing_zeros<T>(value: T) -> T
#[builtin] pub fn popcount<T>(value: T) -> T
```

`T` 仅支持 `i8 / i16 / i32 / i64 / u8 / u16 / u32 / u64`。

对应 x86 的 `LZCNT` / `TZCNT` / `POPCNT`、ARM 的 `CLZ` / `CTZ`、RISC-V 的 `clz` / `ctz` / `cpop`。

**注意**：`count_leading_zeros` 作用于**全部位宽**，不是"小于 64 位就按实际位宽"。`count_leading_zeros_i32(0x0000_0001)` = 31（i32 的位宽）。

`value = 0` 的语义：

- `count_leading_zeros_*(0)` = 位宽本身
- `count_trailing_zeros_*(0)` = 位宽本身
- `popcount_*(0)` = 0

（这与硬件 `LZCNT` / `TZCNT` 一致，和老的 `BSR` / `BSF` 在 0 输入下的未定义行为不同。）

### 字节交换

```rust
#[builtin] pub fn byte_swap_i16(value: i16) -> i16
#[builtin] pub fn byte_swap_i32(value: i32) -> i32
#[builtin] pub fn byte_swap_i64(value: i64) -> i64
#[builtin] pub fn byte_swap_u16(value: u16) -> u16
// ... u32 / u64 同构

#[builtin] pub fn byte_swap<T>(value: T) -> T
```

反转字节序（小端 ↔ 大端），对应 x86 的 `BSWAP` / ARM 的 `REV`。常见用途：

```rust
// 把主机字节序转网络字节序
r0 = bits::byte_swap_u32(r1)            // htonl
r0 = bits::byte_swap_u16(r1)            // htons
```

### 循环移位

```rust
#[builtin] pub fn rotate_left_i32(value: i32, shift: u32) -> i32
#[builtin] pub fn rotate_left_i64(value: i64, shift: u32) -> i64
#[builtin] pub fn rotate_right_i32(value: i32, shift: u32) -> i32
#[builtin] pub fn rotate_right_i64(value: i64, shift: u32) -> i64
// ... u32 / u64 同构

#[builtin] pub fn rotate_left<T>(value: T, shift: u32) -> T
#[builtin] pub fn rotate_right<T>(value: T, shift: u32) -> T
```

`shift >= 位宽` 时按**模位宽**处理（不是 UB，和普通 `<<` / `>>` 不同）。对应 x86 的 `ROL` / `ROR`。

### 字节/位宽查询

```rust
#[builtin] pub fn bit_width<T>(value: T) -> u32
```

返回使 `value` 非零的最高位位置 + 1（即 `64 - count_leading_zeros_i64(value)` for `i64`）。`value = 0` → 返回 0。

## 用法示例

```rust
import "std/bits" as bits

// 32 位整数的"对齐到下一个 2 的幂次"
fn next_pow2_u32(r1: u32) -> (r0: u32) uses r2 {
    if (r1 <= 1u32) goto(@one)
    r1 = r1 - 1u32
    r2 = bits::count_leading_zeros_u32(r1)
    r0 = 1u32 << (32u32 - r2)
    return
@one:
    r0 = 1u32
}

// 从网络读一个大端 u32
fn read_be_u32(r1: *u8) -> (r0: u32) {
    r0 = mem.u32[r1]
    r0 = bits::byte_swap_u32(r0)
}

// 循环移位构造简单 hash
fn hash_mix(r1: u64, r2: u64) -> (r0: u64) {
    r0 = bits::rotate_left_u64(r1, 13u32) ^ r2
}
```

## 规划中

- `bit_reverse_*`：位序反转（ARM 有 `RBIT` 指令，x86 没有）
- `parity_*`：奇偶位（x86 `PF` 标志）
- `pdep_*` / `pext_*`：并行位分发/提取（x86 BMI2）

这些可用，但放在占位里，确定覆盖平台后再上线。
