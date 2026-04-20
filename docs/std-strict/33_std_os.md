# 33. `std/os` —— 系统接口

`std/os` 封装了直接面向操作系统的低层接口：系统调用、进程退出、异常终止。

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成（`import`、`extern fn`、变参 `...` 基础已支持）
- 语义（Semantic）：`[ ]` 未开始（平台 API 合法性校验尚未实现）
- 编译（Windows x86_64）：`[~]` 部分完成（最小 `std/os/win::ExitProcess/GetStdHandle/WriteFile` 调用已可发射到汇编）
- 标准库源（声明 / parse 回归）：仓库内已有 `stdlib/std/os.ap`（门面占位）、`stdlib/std/os/win.ap`、`stdlib/std/os/linux.ap`（libc 形 `extern` 占位）；`packages/core/test/stdlib.parse.test.ts` 对 `stdlib/**/*.ap` 做零诊断解析验收

> 当前工具链状态：`--emit exe` 已接入。优先使用 `clang`，若不可用会自动回退到 VS 工具链（`ml64 + link + Windows Kits`）；建议在 **Developer PowerShell for VS** 中执行构建。

## 导入

```rust
import "std/os" as os
```

## 平台模块约定

为了兼顾跨平台 API 和目标平台实现，约定分层如下：

- `std/os`：跨平台门面 API（稳定命名）
- `std/os/win`：Windows Native-Strict 实现
- `std/os/linux`：Linux Native-Strict 实现

在 Windows 目标上，推荐直接导入：

```rust
import "std/os/win" as os
```

并优先使用 snake_case 的平台 API 名（如 `os::exit_process(...)`、`os::get_std_handle(...)`、`os::write_file(...)`），再通过 `#[name = \"...\"]` 映射到 Win32 符号；`syscall` 在 Windows 上不作为主路径。

## API

### `syscall` —— 系统调用

```rust
#[builtin] pub fn syscall(number: u64, ...) -> i64
```

发起一个**平台系统调用**。第一个参数是系统调用号，之后是可变参数（最多 6 个），编译器按平台的 syscall ABI 自动装入对应寄存器并发射 `syscall` / `svc` / `ecall` 等指令。返回值是系统调用的返回值（通常是成功 `>= 0`，失败 `-errno`）。

```rust
import "std/os" as os

val MSG: u8[] = c"Hello, Aperio!\n"

pub fn main() -> (r0: i32) {
    os::syscall(1u64, 1i64, &MSG, MSG.length)        // Linux sys_write(stdout, MSG, len)
    r0 = 0i32
}
```

#### 变长参数不做类型检查

`syscall` 的 `...` 参数**不做任何类型检查**——和 `extern fn printf(fmt: *u8, ...)` 一样。由使用者保证：

- 参数个数匹配该 syscall 的要求
- 每个参数的位宽和语义（整数/指针）正确
- 浮点参数按平台是否支持 syscall 传浮点

这是故意的——syscall 的参数规则在每个平台每个系统调用都不一样，类型系统没法替你保证。

#### 平台系统调用号

| 目标平台         | 机制                            | 调用约定示例                         |
|------------------|--------------------------------|--------------------------------------|
| Linux x86-64     | `syscall` 指令                  | number→`rax`, 1-6→`rdi`/`rsi`/`rdx`/`r10`/`r8`/`r9` |
| Linux ARM64      | `svc #0` 指令                   | number→`x8`, 1-6→`x0`..`x5`          |
| Linux RISC-V     | `ecall` 指令                    | number→`a7`, 1-6→`a0`..`a5`          |
| macOS x86-64     | `syscall` 指令（高位带 0x2000000）| 同 Linux，但 number 加平台前缀      |
| Windows          | 不直接支持（走 kernel32 FFI）    | —                                    |

同一个 syscall number 在不同系统上**可能不对应同一个功能**——`1` 在 Linux x86-64 是 `sys_write`，在 macOS x86-64 是 `exit`。写跨平台代码时用 `#[cfg(target_os = ...)]` 分叉。

#### 失败判断

Linux 的规范是负数返回值为错误码：

```rust
r0 = os::syscall(...)
if (r0 < 0i64) goto(@error)
```

具体的 errno 常量不在 `std/os` 里提供（它们是平台相关的）。想要完整的错误码列表需要配合平台特定的模块或 FFI 去 libc 的 `errno.h`。

### `exit` —— 正常退出

```rust
#[builtin] pub fn exit(code: i32)
```

`#[noreturn]`。以给定的退出码结束当前进程：

```rust
os::exit(0i32)                   // 正常退出
os::exit(1i32)                   // 失败
```

内部是对平台 `exit` / `_exit` / `ExitProcess` 的封装。调用后任何资源清理（文件缓冲、线程 join 等）都**不会**发生——这是"直接退出"，不是 C 的 `exit(3)`。想要 C 的 `exit` 行为，用 `extern fn exit(code: i32)` 直接走 libc。

### `abort` —— 异常终止

```rust
#[builtin] pub fn abort()
```

`#[noreturn]`。立即终止进程，通常通过：

- Linux/macOS：触发 `SIGABRT`
- Windows：调用 `TerminateProcess`
- 嵌入式/裸机：发射 `ud2` / `brk` 导致陷阱

退出码**不指定**（通常表示非正常退出，`137` / `134` 之类的）。

典型用途：panic 路径、`unreachable` 的实际行为、检测到不可恢复错误。

## 程序入口与 `main`

Aperio 期望你写一个 `export pub fn main() -> (r0: i32)`，编译器自动提供 `_start` 桩——后者负责 `.bss` 清零、初始化、调用 `main`、用 `main` 的返回值走 `exit`。详见 [36. 程序入口与启动](./36_startup.md)。

## 完整示例：Linux 版 Hello World

```rust
import "std/os" as os

val MSG: u8[] = c"Hello, Aperio!\n"

#[cfg(target_os = "linux")]
pub fn main() -> (r0: i32) {
    os::syscall(1u64, 1i64, &MSG, MSG.length)        // sys_write(stdout, MSG, len)
    r0 = 0i32
}
```

（macOS 版本 syscall 号是 `0x2000004u64`，Linux 是 `1u64`。）
