# 36. 程序入口与启动

从 OS 加载二进制文件到第一条用户代码执行，中间有一段**启动代码（startup code）**。Aperio 默认替你生成这段代码，但你可以选择关掉它自己写。

## 默认约定：写 `main`

一个可执行 `.ap` 项目需要**恰好一个** `export pub fn main`：

```rust
import "std/io" as io

export pub fn main() -> (r0: i32) {
    io::println!("hi")
    r0 = 0i32
}
```

签名规则：

- `export pub` 必需——链接器要看得见
- 不接受参数（想读命令行参数见下文"`main` 带参数"）
- 返回类型必须是 `(r0: i32)`——这个值会被编译器注入的 `_start` shim 作为进程退出码

编译器会在链接阶段自动注入一个平台相关的 `_start` 符号，它负责：

1. 在需要时对齐栈指针（x86-64 SysV 要求 `call` 前 `(rsp) % 16 == 8`，`_start` 入口是刚跳转进来的状态）
2. 清零 `.bss`（ELF 通常由 kernel/loader 做；WASM / 裸机目标由 `_start` 自己做）
3. 调用 `main`
4. 用 `main` 的返回值去 `os::exit`

```rust
// 编译器内部生成的伪代码
fn _start() {
    (r0) = main()
    os::exit(r0)
}
```

## `main` 带参数

要访问 `argc` / `argv` / `envp`，把 `main` 签名改成：

```rust
export pub fn main(r0: i32, r1: *u8[], r2: *u8[]) -> (r0: i32) { ... }
```

| 参数 | 含义                        |
|------|-----------------------------|
| `r0` | `argc`（命令行参数数量）    |
| `r1` | `argv`（指向字符串指针数组）|
| `r2` | `envp`（指向环境变量数组）  |

（注：`*u8[]` 此处表示"指向 `*u8` 数组的起始"。更精确的类型系统支持要等后续版本；目前可以用 `*u64` 代替。）

> **警告**：这个签名是本节暂定的。实际语法等 FFI 章节对数组指针的支持落定后会重审。

## 跳过默认 shim：`export pub fn _start`

自己定义 `_start` 符号时，编译器**不再注入**默认的 shim：

```rust
import "std/os" as os

#[naked]
export pub fn _start() {
    // 你自己读 argc / argv、调用构造函数、清 bss...
    os::exit(0i32)
}
```

这样做的典型场景：

- **裸机 / 嵌入式**：你的 `_start` 要做 PLL / 外设初始化，而不是 glibc 那套
- **自由站立**（freestanding）：目标是编写内核，不能依赖 `__libc_start_main`
- **最小化体积**：省掉默认 shim 的几十字节开销

注意：一旦你用 `export pub fn _start`，**所有**运行时杂务都由你负责。如果还想要 `main` 被调用，得自己写那个调用。

## 链接阶段的关系

| 目标类型         | 默认入口符号 | 是谁负责             |
|------------------|--------------|----------------------|
| 可执行（exe）    | `_start`     | 编译器注入或用户提供 |
| 共享库（so/dll/dylib）| 无           | 通常不写 `main`      |
| 静态库（a/lib）  | 无           | 不涉及               |
| WASM 模块        | `_start`（WASI）| 编译器注入         |

共享库不需要 `main`——它被主程序 `dlopen` 时进入其构造函数（还未设计构造函数机制；目前请用显式初始化函数让调用方调）。

## 命令行选项

- `aperio build foo.ap` → 生成可执行，注入 `_start` + 调用 `main`
- `aperio build --no-runtime foo.ap` → 不注入任何默认 shim，要求用户定义 `_start`
- `aperio build --lib foo.ap` → 生成 `.so` / `.dylib` / `.dll`，不需要 `main`

## 跨平台注意事项

- **Linux / macOS / BSD**（ELF/Mach-O）：入口符号 `_start`
- **Windows**（PE/COFF）：入口符号 `mainCRTStartup`，但 Aperio 会统一使用 `_start` 别名。想对接 `WinMain` / GUI 子系统需要额外属性（待定）
- **裸机**：由链接脚本决定入口符号名，通常 `_start` 或 `Reset_Handler`
- **WASM/WASI**：导出 `_start`

## 最小完整示例

```rust
// hello.ap
import "std/io" as io

export pub fn main() -> (r0: i32) {
    io::println!("Hello, Aperio!")
    r0 = 0i32
}
```

构建：

```
aperio build hello.ap -o hello
./hello
# Hello, Aperio!
echo $?
# 0
```
