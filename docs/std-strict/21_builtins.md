# 21. 内置标准库

Aperio 提供一组内置的 `std::*` 函数，主要用来解决开发和调试阶段的人体工学问题——打印寄存器值、断言条件、快速退出程序等等。这些函数的调用语法和 `syscall` 一样：**括号里是真的参数**，不需要手动铺寄存器。

## 它们和普通函数有什么不同

- **调用方式不同**：括号里直接写参数，编译器负责装填寄存器
- **不破坏你的虚拟寄存器**：编译器在调用前后自动插入必要的保存/恢复，你的 `r1` 在调用前后值保持不变
- **跨平台实现由运行时提供**：在 Linux/macOS 上通常翻译为底层 `write` 系统调用；在 Wasm 上使用 WASI；在裸机或嵌入式目标上需要自己实现或禁用

换句话说，它们是**编译器内置原语（intrinsic）**而不是普通的 `pub fn`，你不需要 `import`。

## std::println 与 std::print

最常用的两个，格式化输出到 stdout。

```text
std::println(<fmt>, <arg1>, <arg2>, ...)
std::print(<fmt>, <arg1>, <arg2>, ...)
```

- `<fmt>` 必须是**编译期已知**的字符串字面量或 `val u8[]`
- 剩余参数按格式串里的占位符顺序求值并填入
- `std::println` 在末尾自动追加 `\n`；`std::print` 不加

```text
pub fn demo() -> r0 {
    r1 = 42
    r2 = 100

    std::println("r1 = {d}, r2 = {d}", r1, r2)
    // 输出: r1 = 42, r2 = 100

    std::println("sum = {d}", r1 + r2)
    // 输出: sum = 142

    r0 = 0
}
```

### 格式占位符

| 占位符 | 含义                           |
|--------|--------------------------------|
| `{d}`  | 有符号十进制整数               |
| `{u}`  | 无符号十进制整数               |
| `{x}`  | 十六进制（小写，不带 `0x` 前缀）|
| `{X}`  | 十六进制（大写）               |
| `{b}`  | 二进制                         |
| `{o}`  | 八进制                         |
| `{c}`  | ASCII 字符（值的低 8 位）      |
| `{s}`  | C 风格字符串指针（读到 `\0` 为止）|
| `{p}`  | 指针（等价于 `0x{x}`）          |
| `{f}`  | 浮点数（按 `f64` 位模式解释）  |
| `{}`   | 默认格式，等价于 `{d}`          |
| `{{`   | 字面量 `{`                     |
| `}}`   | 字面量 `}`                     |

### 宽度与填充（可选）

占位符里可以附加最小宽度和填充字符：

```text
std::println("|{d:6}|", 42)       // 输出: |    42|  （右对齐，空格填充，宽度 6）
std::println("|{d:-6}|", 42)      // 输出: |42    |  （左对齐）
std::println("|{x:08}|", 0xCAFE)  // 输出: |0000cafe| （0 填充，宽度 8）
```

## std::eprintln 与 std::eprint

和 `println` / `print` 完全一样，只是输出到 **stderr** 而不是 stdout。适合打印调试信息和错误消息——这样在重定向 stdout 时不会干扰程序的正常输出。

```text
std::eprintln("warning: r1 is negative ({d})", r1)
```

## std::dbg

把表达式的值打印出来并附上源码位置，专门为调试设计：

```text
std::dbg(<expr>)
```

行为等价于：

```text
std::eprintln("[{s}:{d}] {s} = {d}", __FILE__, __LINE__, <expr-as-text>, <expr-value>)
```

用法：

```text
pub fn compute(r1) -> r0 {
    r0 = r1 * 2 + 1
    std::dbg(r0)           // [main.ap:3] r0 = 43
}
```

`std::dbg` 可以接受任何能求值的表达式，不限于寄存器：

```text
std::dbg(r1)
std::dbg(mem.i32[r2 + 4])
std::dbg(r1 + r2)
```

默认以 `{d}` 格式打印整数。如果要指定格式，用第二种形式：

```text
std::dbg(r1, "{x}")        // [main.ap:3] r1 = 0x2a
```

## std::assert

断言一个条件为真，否则打印消息并 abort：

```text
std::assert(<condition>)
std::assert(<condition>, <fmt>, <args>...)
```

`<condition>` 的语法和 `if` 里的比较表达式相同（见 [09. 控制流](./09_control_flow.md)）。

```text
pub fn divide(r1, r2) -> r0 {
    std::assert(r2 != 0, "divide by zero: r1 = {d}", r1)
    r0 = r1 / r2
}
```

断言失败时的输出包含源码位置，类似 `std::dbg`。

断言在**调试构建**中生效，`--release` 下默认被剥离为空操作（类似 C 的 `assert.h`）。如果需要在发布版也保留，用 `std::assert_always`。

## std::panic

立即打印消息并终止进程（通过 `abort` 或平台等价机制）：

```text
std::panic(<fmt>, <args>...)
```

```text
pub fn unreachable_branch() -> r0 {
    std::panic("unreachable: got unexpected state")
    // 编译器知道 std::panic 不返回，所以这里不需要给 r0 赋值
}
```

`std::panic` 会被编译器标记为 `!return`（不返回）——出现在它之后的代码会被视为死代码，编译器也不会强制要求"返回前给所有返回寄存器赋值"。

## 一个完整的调试会话

把上面几个放在一起看看：

```text
pub fn process(r1, r2) -> r0 {
    std::assert(r1 > 0, "r1 must be positive, got {d}", r1)

    r0 = r1 * r2
    std::dbg(r0)

    if (r0 > 1000) goto(@overflow_path)
    std::println("normal case: r0 = {d}", r0)
    return

@overflow_path:
    std::eprintln("overflow detected: r1 = {d}, r2 = {d}", r1, r2)
    std::panic("overflow is not yet supported")
}
```

## 目标支持

| 目标                  | `std::*` 是否可用 |
|-----------------------|-------------------|
| Linux / macOS (syscall)| ✅ 直接翻译为系统调用 |
| Linux / macOS + libc  | ✅ 翻译为 `printf` + `abort` |
| Wasm (WASI)           | ✅ 翻译为 WASI 的 `fd_write` 等 |
| 裸机 / 自定义运行时    | ❌ 默认禁用，需要自己提供实现 |

如果目标不支持，编译器会在遇到 `std::*` 调用时报错。如果你想在裸机上使用，可以通过 `--runtime=minimal` 之类的选项提供自己的后端实现（具体机制属于工具链范畴，这里不展开）。

## 为什么这些是内置而不是库

如果 `println` 是普通库函数，你每次调用都得：

```text
printf(fmt = &FMT, arg1, arg2)
```

然后手动处理格式化细节、考虑 libc 依赖、担心调用点周围寄存器保存。对于调试场景（本来就是临时插入代码看看运行时的值），这种摩擦太大。把它们作为编译器内置，就能：

- 写起来和 Rust 的 `println!` 一样顺手
- 不污染调用者的虚拟寄存器
- 编译器可以在发布构建中剥离 `assert` / `dbg`

如果你在写运行时本身（而不是应用代码），应当避免使用 `std::*`——直接用 `syscall` 或 FFI。
