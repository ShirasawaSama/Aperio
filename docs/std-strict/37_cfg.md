# 37. 条件编译 `#[cfg(...)]`

同一份代码要跑在不同操作系统、不同架构、或按调试 / 发布模式走不同路径时，需要**编译期选择**哪些代码进入最终二进制。`#[cfg(...)]` 就是这件事的标准做法。

## 基本语法

写在函数、`extern fn`、`const` / `val` / `var`、`struct`、`type`、`import` 定义前：

```rust
#[cfg(target_os = "linux")]
extern fn epoll_wait(...) -> (r0: i32)

#[cfg(target_os = "macos")]
extern fn kqueue(...) -> (r0: i32)
```

满足条件时该项进入编译，**不满足时就像它从未存在**——名字也不被引入作用域，`sizeof` 算不到，其他代码 `import` 也拿不到。

## 支持的判定键

| 键名              | 可能的值                                | 含义                                           |
|-------------------|-----------------------------------------|------------------------------------------------|
| `target_os`       | `"linux"`, `"macos"`, `"windows"`, `"freebsd"`, `"none"` | 目标操作系统                                   |
| `target_arch`     | `"x86_64"`, `"aarch64"`, `"riscv64"`, `"wasm32"`        | 目标架构                                       |
| `target_endian`   | `"little"`, `"big"`                     | 字节序                                         |
| `target_pointer_width` | `"32"`, `"64"`                     | 指针位宽                                       |
| `debug`           | 不带值（存在即匹配）                    | `-O0` / 调试构建                               |
| `release`         | 不带值                                  | `-O1` 以上                                     |
| `feature`         | `"<名字>"`                              | 项目 / 包作者自定义的特性（通过 `--cfg feature=...` 打开）|

值必须是**字符串字面量**（`"linux"`），不能是标识符。

## 逻辑组合

```rust
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn linux_x64_only() { ... }

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn unixlike() { ... }

#[cfg(not(debug))]
fn release_only_fast_path() { ... }
```

支持的组合：

- `all(<cfg>, <cfg>, ...)`：全部满足
- `any(<cfg>, <cfg>, ...)`：任一满足
- `not(<cfg>)`：取反

可以嵌套：`all(target_os = "linux", not(target_arch = "wasm32"))`。

## 多实现同名函数

一个最常见的模式——同一个名字的函数，按 `target_os` 分成几个实现：

```rust
import "std/os" as os

#[cfg(target_os = "linux")]
pub fn get_pid() -> (r0: i64) {
    r0 = os::syscall(39u64)                // sys_getpid
}

#[cfg(target_os = "macos")]
pub fn get_pid() -> (r0: i64) {
    r0 = os::syscall(0x2000014u64)         // macOS getpid
}

#[cfg(target_os = "windows")]
extern fn GetCurrentProcessId() -> (r0: u32)

#[cfg(target_os = "windows")]
pub fn get_pid() -> (r0: i64) {
    r0 = conv::u32_to_i64(GetCurrentProcessId())
}
```

编译时只有匹配 `target_os` 的那个函数被保留，其余**连解析都不会发生**——所以 `macos` 分支里调了 `os::syscall(0x2000014u64)`，在编译到 Linux 时不会因为"这个号在 Linux 无效"而报错。

## `#[cfg(...)]` 对 `import` 的作用

```rust
#[cfg(target_os = "linux")]
import "std/os" as os

#[cfg(target_os = "windows")]
import "./windows_stubs" as os
```

这让你可以用同一个别名（`os`）在不同平台上指向不同模块。

## 对常量与数据

```rust
#[cfg(target_os = "linux")]
const SYSCALL_WRITE: u64 = 1u64

#[cfg(target_os = "macos")]
const SYSCALL_WRITE: u64 = 0x2000004u64
```

`struct` 的字段也可以带 `#[cfg]`，条件不满足时字段直接不存在——影响 `.size` 和字段偏移量的计算。跨平台 struct 这么写：

```rust
struct FileHandle {
    #[cfg(target_os = "windows")] handle: u64,
    #[cfg(not(target_os = "windows"))] fd: i32,
}
```

## `#[cfg_attr(...)]`

只想**条件地**加一个属性（而不是条件地加整个定义）时用：

```rust
#[cfg_attr(target_os = "linux", section(".text.startup"))]
pub fn init() { ... }
```

等价于 `target_os = "linux"` 时拼 `#[section(".text.startup")]`，否则什么都不加。

## 不支持的

- **运行时判断**：`#[cfg(...)]` 是纯编译期的。要在运行时分叉用 `if` + 运行时读 `/proc/version` 之类的方式
- **表达式级 cfg**：不能在函数体中间对一条语句用 `#[cfg]`。把那段代码抽成独立函数再对函数用 `#[cfg]`

## 约定

- 写 `target_os = "linux"` 时**别**误写成 `target_os = linux`（标识符不是字符串）
- 所有 `feature` 名字用小写蛇形（`feature = "low_power"`，不是 `"LowPower"`）
- 跨平台项目的惯例：把平台差异集中在几个"端口（port）"文件里（`port_linux.ap`、`port_macos.ap`...），各自开 `#[cfg(...)]`，主代码只 `import` 抽象的接口，不直接用 `#[cfg]`

## 查看当前 cfg

构建时加 `aperio build --print-cfg foo.ap` 会打印出所有激活的 cfg 键值。用来确认 `debug` / `release` / 平台相关键确实如预期。
