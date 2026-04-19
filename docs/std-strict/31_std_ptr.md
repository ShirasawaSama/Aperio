# 31. `std/ptr` —— 指针算术与转换

Std-Strict **禁止**用 `+` / `-` 等运算符做指针算术——`p + 1` 是编译错。所有指针算术通过 `std/ptr` 的显式函数进行，这样"移动指针一个元素还是一个字节"这件事不再靠阅读指针类型猜测。

## 导入

```rust
import "std/ptr" as ptr
```

## API

### 元素偏移：`offset<T>`

```rust
#[builtin] pub fn offset<T>(p: *T, n: i64) -> *T
```

把 `p` 向前推进 `n * sizeof(T)` 字节。等价于 C 的 `p + n`（当 `p` 是 `T*` 时）：

```rust
import "std/ptr" as ptr

val ARR: i32[10] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

r1 = &ARR                             // r1: *i32
r2 = ptr::offset<i32>(r1, 3i64)       // r2: *i32，指向 ARR[3]
r3 = mem.i32[r2]                      // r3 = 4
```

`n` 可以为负（往回退）。越界时不是 UB——越界访问内存才是 UB。

### 字节偏移：`byte_offset<T>`

```rust
#[builtin] pub fn byte_offset<T>(p: *T, n: i64) -> *T
```

把 `p` 向前推进 `n` **字节**（不乘元素大小）。结果类型仍是 `*T`：

```rust
r2 = ptr::byte_offset<i32>(r1, 3i64)   // 只推 3 字节（注意这会让 r2 指向不对齐的位置）
r2 = ptr::byte_offset<Point>(r1, Point.y)  // 用结构体字段偏移
```

典型用途：按 struct 字段偏移跳位置、读未按元素对齐的头部。

### 两个指针之间的距离：`distance<T>`

```rust
#[builtin] pub fn distance<T>(a: *T, b: *T) -> i64
```

返回 `(a - b) / sizeof(T)`，即"a 比 b 领先多少个元素"。要求 `a` 和 `b` 是相同被指类型的 `*T`：

```rust
r1 = &ARR
r2 = ptr::offset<i32>(r1, 7i64)
r3 = ptr::distance<i32>(r2, r1)        // r3 = 7
```

字节距离用 `byte_distance`：

```rust
#[builtin] pub fn byte_distance(a: *void, b: *void) -> i64
```

接受 `*void` 对齐——任意两个指针的"字节差"。**调用方需要把实参 `as *void`**。

## 指针 ↔ 地址

### 取地址数值

```rust
#[builtin] pub fn to_addr<T>(p: *T) -> u64
```

把指针转成裸 `u64` 地址。等价于 `p as u64`，只是在名字里更明确。

### 用地址构造指针

```rust
#[builtin] pub fn from_addr<T>(addr: u64) -> *T
```

把 `u64` 解释为 `*T`。等价于 `addr as *T`。由使用者保证地址合法（对齐、被指类型正确）。

```rust
// 从一个 syscall 拿到的原始地址
r0 = os::syscall(SYS_MMAP, ...)               // r0: i64
r1 = ptr::from_addr<u8>(r0 as u64)            // r1: *u8
```

## 指针重解释：`cast<T, U>`

```rust
#[builtin] pub fn cast<T, U>(p: *T) -> *U
```

等价于 `p as *U`——同位宽重解释，不改变指针值。写法 `ptr::cast<i32, u8>(p)` 和 `p as *u8` 等价。存在的目的是让"显式重解释"在调用图里可见（易搜索）。

## `*void` 工具

```rust
#[builtin] pub fn to_void<T>(p: *T) -> *void
#[builtin] pub fn from_void<T>(p: *void) -> *T
```

等价于 `p as *void` / `p as *T`。当你想把指针传入一个接受不透明指针的接口时显得清晰：

```rust
extern fn qsort(
    base: *void,
    nmemb: u64,
    size: u64,
    cmp: fn(r1: *void, r2: *void) -> (r0: i32),
)

qsort(
    base = ptr::to_void<i32>(&ARR),
    nmemb = 10u64,
    size = 4u64,
    cmp = &cmp_i32,
)
```

## 为什么禁 `p + n`

在 C 里 `p + 1` 的语义取决于 `p` 的静态类型——指向 `int*` 就跳 4 字节，指向 `char*` 就跳 1 字节。这在阅读代码时是隐藏的。Aperio 要求**每次都写清楚**：

- 要跳元素：`ptr::offset<T>(p, n)`
- 要跳字节：`ptr::byte_offset<T>(p, n)`

函数名告诉你语义，不用回头看 `p` 的类型。

## 示例：遍历数组

```rust
import "std/ptr" as ptr
import "std/io" as io

val ARR: i32[5] = [10, 20, 30, 40, 50]

pub fn sum_arr() -> (r0: i32) uses (r1, r2, r3) {
    r0 = 0i32
    r1 = &ARR                                      // *i32
    r2 = ptr::offset<i32>(r1, 5i64)                // end 指针
@loop:
    r3 = ptr::distance<i32>(r2, r1)
    if (r3 == 0i64) goto(@done)
    r0 = r0 + mem.i32[r1]
    r1 = ptr::offset<i32>(r1, 1i64)
    goto(@loop)
@done:
}
```

这比"`r1 = r1 + 4` + 手动解读为什么是 4"的写法清晰得多。
