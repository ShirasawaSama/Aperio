# 27. `std/debug` —— 断言与终止

`std/debug` 提供运行期断言、panic、编译期静态断言、不可达标记。**宏和函数混合**。

## 导入

```rust
import "std/debug" as debug
```

## API

### `assert!` —— 运行期断言

```rust
#[macro] pub macro assert!(cond: expr, fmt: literal = "", ..args)
```

- `cond` 求值为 `bool`。为 `false` 时触发 panic
- 可选的 `fmt` / `..args` 作为 panic 消息，格式规则同 [`io::println!`](./26_std_io.md)
- `cond` **lazy 求值**：release 模式下整条 `assert!` 可能被剥离——这是它必须是宏的原因

```rust
debug::assert!(r1 != 0)
debug::assert!(r1 != 0, "divisor must be non-zero")
debug::assert!(r2 < len, "index {d} out of range {d}", r2, len)
```

#### release 模式下的行为

由 `#[cfg(debug_assertions)]` 控制（详见 [37. 条件编译](./37_cfg.md)）：

- `debug_assertions = true`（默认 debug 构建）：`assert!` 正常工作
- `debug_assertions = false`（默认 release 构建）：整条 `assert!` 被删除，包括 `cond` 和格式参数

这意味着 `assert!(r1 = allocate_resource())` 这种"把副作用塞进条件"的写法在 release 下会破坏程序——**不要这么写**。

想要"即使 release 也保留"的断言，用 `panic!` + `if` 手写。

### `panic!` —— 终止运行

```rust
#[macro] pub macro panic!(fmt: literal, ..args)
```

打印消息后终止程序。`#[noreturn]` 语义——调用点之后的代码不可达。

```rust
debug::panic!("unreachable code path")
debug::panic!("invalid state: {d}", r0)
```

内部行为：
1. 把格式化消息输出到 stderr
2. 输出调用点的 `file:line`
3. 调用 `std/os::abort()`

`panic!` **不会**被 release 剥离——它是真正的错误处理路径。

### `static_assert!` —— 编译期静态断言

```rust
#[macro] pub macro static_assert!(cond: expr, msg: literal)
```

在**编译期**求值 `cond`（必须是 `const` 可求值的表达式，见 [17. 编译期常量](./17_constants.md)）。为 `false` 时编译错，错误消息包含 `msg`。

```rust
debug::static_assert!(Point.size == 8, "Point layout must be 8 bytes")
debug::static_assert!(BUF.length >= 1024, "buffer too small")
debug::static_assert!(
    (ALIGN & (ALIGN - 1)) == 0,
    "ALIGN must be a power of two",
)
```

不产生任何运行时代码——没通过就编译失败，通过了就像没写过一样。

### `unreachable` —— 标记不可达路径

```rust
#[builtin] pub fn unreachable()
```

**普通函数**（不是宏）。`#[noreturn]`。告诉编译器"这条路径永远不会执行"——编译器据此做更激进的优化（分支消除、死代码删除等）。

```rust
fn classify(r1: u8) -> (r0: u8) {
    if (r1 == 0) goto(@zero)
    if (r1 == 1) goto(@one)
    if (r1 == 2) goto(@two)
    debug::unreachable()                     // r1 的值只会是 0/1/2
@zero:
    r0 = 'z'
    return
@one:
    r0 = 'o'
    return
@two:
    r0 = 't'
}
```

执行到 `unreachable` 是 UB——运行时通常会陷入 `ud2` 或等价指令，立刻崩溃。

## 为什么 `assert!` / `panic!` / `static_assert!` 是宏

分别对应三个"函数办不到"的需求：

- `assert!`：需要 **lazy 求值**（release 下跳过条件计算）
- `panic!`：需要**格式串解析**（同 `println!`）
- `static_assert!`：需要**纯编译期求值**，不产生运行时代码

而 `unreachable` 只是"发射一条 trap 指令"，不需要特殊处理——所以是普通函数。

## 组合示例

```rust
import "std/debug" as debug
import "std/io" as io

struct Request {
    kind:    u8,     // 0=read, 1=write
    _pad:    u8[3],
    length:  u32,
    buffer:  *u8,
}

debug::static_assert!(Request.size == 16, "Request layout drift")

pub fn handle(r1: *Request) -> (r0: i64) uses (r2, r3) {
    r2 = mem.u8[r1 + Request.kind]
    debug::assert!(r2 <= 1u8, "invalid kind {d}", r2)

    if (r2 == 0u8) goto(@read)
    if (r2 == 1u8) goto(@write)
    debug::unreachable()
@read:
    io::println!("read request, len={d}", mem.u32[r1 + Request.length])
    r0 = 0i64
    return
@write:
    io::println!("write request, len={d}", mem.u32[r1 + Request.length])
    r0 = 0i64
}
```

这段代码同时用到了：

- `static_assert!` 编译期保证结构体布局
- `assert!` 运行期验证输入
- `unreachable` 帮编译器做更好的分支布局
