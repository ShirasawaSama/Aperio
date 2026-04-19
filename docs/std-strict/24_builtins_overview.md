# 24. 内置标准库总览

Aperio 在语言内核之上提供一组编译器内置的标准库模块。它们**不是用 `.ap` 源码实现的普通库**——本章讲清楚它们的组织方式、属性语义、调用约定。具体每个模块的 API 在后续章节展开。

## 模块一览

| 路径           | 用途                  | 主要接口                                                   |
|----------------|-----------------------|------------------------------------------------------------|
| `std/core`     | 基础单指令原语        | 函数：`select<T>`                                          |
| `std/io`       | 输出与调试            | 宏：`println!` / `print!` / `eprintln!` / `eprint!` / `dbg!` |
| `std/debug`    | 断言与终止            | 宏：`assert!` / `panic!` / `static_assert!`；函数：`unreachable` |
| `std/convert`  | 类型转换              | 函数：`sign_extend_*` / `zero_extend_*` / `truncate_*` / `*_to_f32` 等 |
| `std/atomic`   | 并发原语              | 函数：`load_*` / `store_*` / `compare_and_swap_*` / `fetch_*_*` / `fence` |
| `std/bits`     | 位操作                | 函数：`count_leading_zeros_*` / `popcount_*` / `byte_swap_*` / `rotate_left_*` 等 |
| `std/ptr`      | 指针算术与转换        | 函数：`byte_offset<T>` / `offset<T>` / `to_addr<T>` / `from_addr<T>` |
| `std/stack`    | 栈分配                | 函数：`alloc<T>`                                           |
| `std/os`       | 系统接口              | 函数：`syscall` / `exit` / `abort`                          |
| `std/simd`     | 向量运算（占位）      | —                                                          |
| `std/asm`      | 内联汇编（占位）      | —                                                          |

每个模块都通过 `import "std/xxx" as alias` 引入，没有 prelude——用到什么就显式 import 什么，这样"一眼能看清依赖"。

## `#[builtin]` 属性

内置库里的函数在编译器提供的桩文件里长这样：

```rust
// std/stack 的桩（节选）
#[builtin]
pub fn alloc<T>(count: u64) -> *T

// std/atomic 的桩（节选）
#[builtin]
pub fn load_i64(addr: *i64) -> i64

#[builtin]
pub fn compare_and_swap_i64(addr: *i64, expected: i64, desired: i64) -> i64
```

`#[builtin]` 告诉编译器：

- 这个函数**没有函数体**，调用时由编译器内部展开成对应的指令序列
- 参数用 **FFI 风格**（`名字: 类型`），不用寄存器名
- 允许声明**有限的类型参数** `<T>`（见下文）
- 调用时既可以位置参数也可以命名参数（和 `extern fn` 一样，不同于普通 `fn`）

用户代码里**不能**写 `#[builtin]`——这是编译器专用属性。

## 调用：位置或命名都行

```rust
r1 = stack::alloc<i64>(16)                             // 位置
r1 = stack::alloc<i64>(count = 16)                     // 命名

r0 = atomic::compare_and_swap_i64(r1, r2, r3)          // 位置
r0 = atomic::compare_and_swap_i64(                     // 命名（参数多时更清晰）
    addr = r1,
    expected = r2,
    desired = r3,
)
```

同一次调用里**不能混用**——要么全位置，要么全命名。`extern fn` 也遵循相同规则。

位置实参按**左→右**求值；命名实参也按**源码书写顺序**（左→右）求值。

`#[builtin]` 签名里的**形参名**（`count` / `addr` / `expected` 等）在调用端的用法，**等价于**用户函数的寄存器别名名（见 [05. 寄存器别名](./05_registers.md#寄存器别名) 和 [12. 函数](./12_functions.md)）——它们就是该参数的"规范名"，拿来写命名参数。唯一区别是 `#[builtin]` 允许回退到位置写法，普通 `fn` 不允许。

## `#[builtin]` 的有限泛型

普通 `fn` 不支持泛型，但 `#[builtin]` 可以声明类型参数：

```rust
#[builtin] pub fn select<T>(cond: bool, if_true: T, if_false: T) -> T
#[builtin] pub fn popcount<T>(value: T) -> T
#[builtin] pub fn alloc<T>(count: u64) -> *T
#[builtin] pub fn offset<T>(p: *T, n: i64) -> *T
```

### 调用点推导 + 严格一致

`<T>` 在每个调用点由编译器根据实参推导为具体类型。**所有绑定到同一 `T` 的参数必须严格同类型**：

```rust
r0 = core::select(r1 > 0, 1i32, 2i32)         // T = i32，OK
r0 = core::select(r1 > 0, 1i32, 2i64)         // 编译错：两个分支类型不一致
r0 = core::select(r1 > 0, 1i32, 2i32 as i64)  // 编译错：还是不一致
```

不做隐式提升/降位——想统一类型就用 `as` 或 `conv::*` 先把实参整齐。

### 显式指定 T

多数情况下编译器能从实参推导，必要时可以显式写：

```rust
r1 = stack::alloc<i64>(count = 4)             // 显式指定
r1 = stack::alloc(count = 4)                  // 编译错：只有 count 推不出 T
```

没有"类型参数里有 `T` 但实参全是表达式定不下来"的情况时，写不写都行。

## 泛型 + 显式后缀版本并存

大多数算术类内置函数**同时**提供：

```rust
// 泛型版
#[builtin] pub fn popcount<T>(value: T) -> T

// 显式位宽版
#[builtin] pub fn popcount_i32(value: i32) -> i32
#[builtin] pub fn popcount_i64(value: i64) -> i64
```

调用方二选一：

```rust
r0 = bits::popcount(r1)              // 由 r1 的当前类型决定位宽
r0 = bits::popcount_i64(r1)          // 强制 i64
```

显式后缀版本的好处：**调用点一眼能看出位宽**，不需要跳回赋值点推断 `r1` 是什么类型。两种风格并存，按项目口味选。

## 函数 vs 宏：怎么区分

内置库里**大部分是函数**，小部分是**编译器内置宏**（带 `!` 后缀）：

| 形态 | 属性          | 调用形式              | 典型成员                        |
|------|---------------|-----------------------|---------------------------------|
| 函数 | `#[builtin]`  | `atomic::load_i64(r1)` | 算术、内存、原子、转换、位操作   |
| 宏   | `#[macro]`    | `io::println!(...)`    | 格式串 / lazy 求值 / 源码文本捕获 |

判断准则：**调用参数是不是必须在编译期做特殊处理？**

- 是 → 内置宏（`println!` 要解析格式串；`assert!` 要让条件 lazy 求值；`dbg!` 要捕获表达式源码文本）
- 否 → 普通内置函数

这样写 `atomic::compare_and_swap_i64(...)` 和 `bits::popcount(...)` 时不需要纠结"要不要带 `!`"——带 `!` 的永远是**必须编译期展开**的那几个。

用户定义的宏也带 `!` 后缀，规则详见 [23. 宏系统](./23_macros.md)。

## 命名约定

内置库的命名一律用**完整英文**，不用缩写：

- ✅ `compare_and_swap` / `exchange` / `count_leading_zeros` / `count_trailing_zeros` / `byte_swap` / `popcount`
- ❌ `cas` / `xchg` / `clz` / `ctz` / `bswap`

长度换取搜索友好和新人可读。唯一的"例外"是 `popcount` 这种已经是业界通用标识符、无更清晰替代词的情况。
