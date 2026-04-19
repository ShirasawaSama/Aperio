# 26. `std/io` —— 输出与调试

`std/io` 提供标准输入输出与调试打印。**所有成员都是编译器内置宏**（`#[macro]`）——因为格式串需要在编译期解析占位符。

## 导入

```rust
import "std/io" as io
```

## API

### `println!` / `print!` —— 标准输出

```rust
#[macro] pub macro println!(fmt: literal, ..args)
#[macro] pub macro print!(fmt: literal, ..args)
```

- `println!` 在格式串末尾自动追加一个 `'\n'`
- `print!` 不追加换行
- `fmt` **必须**是字符串字面量——这样编译期才能解析占位符
- 变长参数 `..args` 按占位符顺序匹配

```rust
io::println!("Hello, Aperio!")
io::println!("sum = {d}", r0)
io::println!("{s} has value {x}", &NAME, r1)
io::print!("processing... ")
```

### `eprintln!` / `eprint!` —— 标准错误

```rust
#[macro] pub macro eprintln!(fmt: literal, ..args)
#[macro] pub macro eprint!(fmt: literal, ..args)
```

和 `println!` / `print!` 语义一致，只是输出到 **stderr** 而不是 stdout。适合日志、错误提示、诊断信息。

```rust
io::eprintln!("error: failed to open {s}", &PATH)
```

### `dbg!` —— 调试打印

```rust
#[macro] pub macro dbg!(expr: expr)
```

打印表达式的**源码文本**和当前值，格式：

```
[<file>:<line>] <source> = <value>
```

```rust
r0 = 42
io::dbg!(r0)
// 输出: [main.ap:15] r0 = 42

io::dbg!(r1 + r2)
// 输出: [main.ap:16] r1 + r2 = 73
```

`dbg!` 是快速调试利器——不用手写 `println!` + 变量名字符串。每次查问题时往代码里插一行，查完删掉即可。

## 格式占位符

`println!` 家族的格式串支持下列占位符：

| 占位符  | 含义                                    | 适用类型            |
|---------|-----------------------------------------|---------------------|
| `{d}`   | 十进制整数（有符号）                    | `i*`                |
| `{u}`   | 十进制整数（无符号）                    | `u*`                |
| `{x}`   | 十六进制（小写，无前缀）                | `i*` / `u*`         |
| `{X}`   | 十六进制（大写）                        | `i*` / `u*`         |
| `{o}`   | 八进制                                  | `i*` / `u*`         |
| `{b}`   | 二进制                                  | `i*` / `u*`         |
| `{f}`   | 浮点十进制                              | `f32` / `f64`       |
| `{e}`   | 浮点科学计数                            | `f32` / `f64`       |
| `{s}`   | 以 `\0` 结尾的 C 风格字符串             | `*u8`               |
| `{p}`   | 指针（十六进制，带 `0x` 前缀）           | `*T`                |
| `{c}`   | 单个 ASCII 字符                         | `u8`                |
| `{%}`   | 字面量 `%` 字符                          | —                   |
| `{{`    | 字面量 `{`                              | —                   |
| `}}`    | 字面量 `}`                              | —                   |

占位符后可带**宽度和填充修饰符**（类似 printf）：

| 语法         | 含义                              |
|--------------|-----------------------------------|
| `{d:8}`      | 最小宽度 8（右对齐，空格填充）    |
| `{d:08}`     | 最小宽度 8，不足补 `0`            |
| `{d:<8}`     | 最小宽度 8，左对齐                |
| `{x:04}`     | 四位十六进制，补 `0`              |
| `{f:.3}`     | 浮点保留 3 位小数                 |

```rust
io::println!("[{d:5}] {s}", r0, &LABEL)
io::println!("addr = {p}", r1)
io::println!("hash = {X:016}", r2)
io::println!("pi ≈ {f:.6}", f0)
```

### 占位符数量检查

编译器在**编译期**检查：

- 占位符数量 = 变长参数个数
- 每个占位符的类型约束与对应参数的当前类型匹配

不一致会直接编译错：

```rust
io::println!("a = {d}, b = {d}", r1)         // 编译错：占位符 2 个，参数只有 1
io::println!("n = {d}", f1)                  // 编译错：{d} 要整数，f1 是浮点
```

## 实现位置

这些宏在 `libc` 可用时底层走 `printf` / `fprintf`；无 libc 时走 `std/os::syscall(write, ...)`（Linux）或等价系统调用。目标平台决定哪种方式。详见编译器实现文档。

## 为什么全都是宏

函数**无法**实现这些功能：

- `println!("{d}", r1)`：格式串需要编译期解析——做成函数会变成运行时 parser
- `dbg!(r1 + r2)`：要打印 `"r1 + r2"` 这段源码文本——函数拿不到源码

所以 `std/io` 的所有接口都是 `#[macro]`。
