# 17. 编译期常量与 `const fn`

本章讲两件事：

1. `const`——**只在编译期存在**的命名常量，不占用运行时内存
2. `const fn`——可以在编译期求值的函数

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成  
  已覆盖：`const NAME: Type = <expr>` 基础声明。  
  未覆盖：`const fn`、浮点/字符等更完整字面量族、常量表达式全量语法。
- 语义（Semantic）：`[ ]` 未开始（常量折叠与 const-eval 规则尚未实现）
- 编译（Windows x86_64）：`[ ]` 未开始

## 17.1 `const` 声明

### 语法

```
const <NAME>: <type> = <expr>
```

例子：

```rust
const MAX_SIZE: i32  = 1024i32
const PI: f64        = 3.14159265358979f64
const SYS_WRITE: u64 = 1u64
const FLAG: u32      = 0x80u32
```

按约定，常量名使用大写蛇形命名（`SCREAMING_SNAKE_CASE`）。

### 类型标注是强制的

和运行时表达式不同，`const` 声明必须显式写出类型。这决定了常量的位宽、有符号性以及用作立即数时的隐含类型：

```rust
const BYTE: u8  = 0xFFu8
const WORD: u16 = 0xFFFFu16

mem.u8[r1]  = BYTE                     // 写 1 字节
mem.u16[r1] = WORD                     // 写 2 字节
```

### 使用

常量可以出现在任何需要立即数 / 编译期值的位置：

```rust
r1 = MAX_SIZE
r2 = r3 + SYS_WRITE
if (r4 >= MAX_SIZE) goto(@overflow)

val BUF: u8[MAX_SIZE]                  // 数组大小
```

编译器会把常量**内联**到最终指令的立即数字段里，不产生任何加载操作。

### 不能取地址

`const` 没有运行时内存位置：

```rust
const MAX: i32 = 1024i32

r1 = &MAX                              // 编译错：const 没有地址
```

如果需要把数值放进 `.rodata` 并取地址，用 `val`：

```rust
val MAX: i32[1] = [1024i32]
r1 = &MAX                              // OK：*i32
```

### 可见性

```rust
pub const PUBLIC_LIMIT: i32 = 100i32   // 模块外可见
const PRIVATE_TAG: u32 = 0xDEADu32     // 模块内可见
```

`const` 不写 `export`——它不产生符号。

## 17.2 `const fn` 函数

### 是什么

一个 `const fn` 是"既可以在运行时调用，也可以在**编译期求值**"的普通函数。声明形式：

```rust
const fn square(r1: i64) -> (r0: i64) {
    r0 = r1 * r1
}

const SQ_4: i64 = square(r1 = 4i64)    // 编译期求出 16
```

`const fn` 在编译期被调用时会被执行器在编译器内部模拟执行，得到结果再代入调用点。

### 为什么要它

不用 `const fn`：

```rust
const X: i32 = 10i32
const Y: i32 = 10i32 * 10i32 + 1i32    // 只能硬写公式
```

用 `const fn`：

```rust
const fn compute_size(r1: i32) -> (r0: i32) {
    r0 = r1 * r1 + 1i32
}

const X: i32 = compute_size(r1 = 10i32)   // 用函数表达意图
const Y: i32 = compute_size(r1 = 20i32)
```

典型用途：

- 预计算查找表
- 计算结构体字段偏移 / 大小相关的派生量
- 把魔法数换成有名字的派生值

### 运行时也能调

```rust
// 运行时
pub fn at_runtime(r1: i32) -> (r0: i32) uses r2 {
    r0 = compute_size(r1 = r1)         // 普通调用，发射一条 `call`
}
```

同一个 `const fn` 编译期和运行时共用一份定义，不会两份字节码。

### 允许的操作

`const fn` 的 body 只能用**编译期能模拟**的构造：

- 常量算术 / 位运算 / 比较
- 寄存器赋值、`select`（通过 `std/core`）
- 控制流：`if` / `goto` / `@label`
- 调用**其他 `const fn`**
- `struct` 字段偏移、`.size`、`.length` 访问

### 禁止的操作

不允许在 `const fn` 里出现：

- `mem.<T>[...]` 读写（编译期没有运行时内存）
- `stack::alloc`
- `#[builtin]` 函数中**不是 `const fn`** 的那些（大部分原子操作、syscall、I/O 都禁）
- `extern fn` 调用（C 运行时不可用）
- 宏（宏在 `const fn` 内是禁止的，除非该宏被标为 `#[const_macro]`——目前没有内置 const 宏）
- 浮点操作（编译期浮点结果和运行时精度不一定完全一致，为了确定性默认禁；未来可能开）
- 取地址 `&FOO`（地址是链接期才确定的，不算编译期值）

编译器遇到非法构造时**直接报编译错**——不是在运行时忽然跑不起来。

### `const fn` 的类型系统

和普通函数完全一样：带类型的参数列表、带类型的返回寄存器、`uses` 子句。Dreg 的类型流检查也照常执行：

```rust
const fn f(r1: i64) -> (r0: i64) uses r2 {
    r2 = r1 + 1i64
    r0 = r2 * r2
}
```

### 泛型？没有

`const fn` 不能是泛型的——和普通 `fn` 相同。只有 `#[builtin]` 才能用 `<T>`。

### 和 `#[builtin]` 的关系

一部分 `#[builtin]` 函数本身就是 const 的（比如 `std/convert` 里的纯数字转换、`std/bits` 里的 `popcount` / `byte_swap`）——它们可以被 `const fn` 调用。具体哪些是 const-eval-safe 的，会在对应模块章节里标注。

`std/io`、`std/os`、`std/atomic`、`std/stack` 的函数**都不是** const——它们涉及运行时状态或副作用。

### 与宏的区别

| 能力                           | `const fn` | `#[macro]` 宏 |
|--------------------------------|------------|---------------|
| 参数类型检查                   | ✅ 签名强约束 | ❌ 只检查片段类（`expr`/`reg`/...） |
| 编译期求值结果                 | ✅ 得到具体值 | ✅ 得到展开后代码 |
| 运行时调用                     | ✅           | ❌（宏只能展开不调用） |
| 捕获源码文本（`dbg!`）         | ❌           | ✅              |
| 格式串编译期解析（`println!`） | ❌           | ✅              |
| 条件 lazy 求值（`assert!`）    | ❌           | ✅              |

选择准则：**能写成 `const fn` 就写 `const fn`**。宏留给那些需要干预"参数怎么被求值"或"源码文本是什么"的场合。

## 17.3 常量表达式全貌

一个"常量表达式"（`const` 右边、数组大小、`#[align(...)]` 参数里能用的表达式）允许包含：

1. 字面量
2. 已声明的 `const`
3. 结构体属性 `Point.size` / `Point.field_name` / `ARR.length`
4. `const fn` 调用
5. 算术、位运算、比较、逻辑运算
6. `std/core::select` 和其他标为 const-eval-safe 的 `#[builtin]`

不允许：

- 寄存器读取（`const fn` 内部的 `r1` 是参数绑定，而非运行时寄存器）
- `mem.<T>[...]`
- 运行时函数调用
- `&FOO`（地址在链接期才确定，对常量表达式来说是"未知"的）

## 17.4 实例：查找表

```rust
// build a compile-time table of squares

const fn square(r1: i32) -> (r0: i32) {
    r0 = r1 * r1
}

val SQUARES: i32[16] = [
    square(r1 = 0i32),
    square(r1 = 1i32),
    square(r1 = 2i32),
    square(r1 = 3i32),
    square(r1 = 4i32),
    square(r1 = 5i32),
    square(r1 = 6i32),
    square(r1 = 7i32),
    square(r1 = 8i32),
    square(r1 = 9i32),
    square(r1 = 10i32),
    square(r1 = 11i32),
    square(r1 = 12i32),
    square(r1 = 13i32),
    square(r1 = 14i32),
    square(r1 = 15i32),
]
```

编译出来和你手写 `[0, 1, 4, 9, 16, 25, ...]` 完全等价，但意图清楚。未来需要改公式只改一处。
