# 20. 系统调用

`syscall` 是 Aperio 内置的直接调用操作系统内核的方式，绕过 libc。它对应 Linux 的 `syscall` 指令、macOS 的 `syscall` 指令、或其他平台上的等价机制。

## 语法

```
syscall(<arg0>, <arg1>, ..., <argN>)
```

第一个参数**通常**是系统调用号（约定而非强制），后续参数是这个系统调用的具体参数。每个参数可以是寄存器或立即数。

```text
syscall(1, 1, &MSG, MSG.length)        // Linux sys_write
syscall(60, 0)                          // Linux sys_exit
```

## 参数如何传递

`syscall` 的括号**是真的参数列表**，这和普通函数调用不同。编译器会：

- 按目标平台的系统调用 ABI，把每个参数装入对应的寄存器
- 插入底层的陷入指令（x86-64 的 `syscall`、ARM64 的 `svc #0` 等）
- 把返回值放到 `r0`

你不需要关心各平台的系统调用寄存器约定。

## 返回值

所有 `syscall` 的返回值都落到 `r0`。错误约定遵循目标平台：

- **Linux / macOS**：返回值为负数时通常表示 `-errno`
- **Windows**：不适用（Windows 不暴露原生系统调用，应使用 FFI 调用 Win32 API）

## 典型用例

### 写标准输出

```text
val MSG: u8[] = "Hello, Aperio!\n"

pub fn print_hello() -> r0 {
    syscall(1, 1, &MSG, MSG.length)       // sys_write(stdout, MSG, len)
    r0 = 0
}
```

### 退出程序

```text
pub fn quit(r1) -> r0 {
    syscall(60, r1)                       // sys_exit(exit_code)
    r0 = 0                                 // 永远不会执行到
}
```

### 读标准输入

```text
var BUF: u8[256]

pub fn read_line() -> r0 {
    syscall(0, 0, &BUF, 256)              // sys_read(stdin, BUF, 256)
    // r0 = 实际读取的字节数
}
```

## 平台差异

各平台的系统调用号**不通用**。例如：

| 功能         | Linux x86-64 | macOS x86-64  |
|--------------|--------------|---------------|
| write        | 1            | 0x2000004     |
| exit         | 60           | 0x2000001     |
| read         | 0            | 0x2000003     |

如果你的代码需要跨平台，应该把系统调用号定义成 `const` 并根据目标平台切换（目前 Aperio 没有内置条件编译，需要你在构建层面处理）：

```text
const SYS_WRITE: u32 = 1      // Linux
// const SYS_WRITE: u32 = 0x2000004  // macOS
```

## Wasm 的情况

Wasm 没有系统调用。编译到 Wasm 目标时，`syscall` 会被拒绝——你应该使用 FFI 调用宿主环境导入的函数（WASI 接口或浏览器 API）。

## 和 FFI 的选择

什么时候用 `syscall`，什么时候用 `extern fn`？

| 场景                       | 推荐            |
|----------------------------|-----------------|
| 写最小运行时 / 静态裸二进制 | `syscall`       |
| 已经在用 libc / glibc      | `extern fn write` |
| 需要 libc 的高级功能        | `extern fn`     |
| 跨平台但愿意绑 libc         | `extern fn`     |
| 追求极小体积、不链接 libc   | `syscall`       |

`syscall` 的好处是不依赖 libc，可以生成完全静态、体积极小的二进制；代价是系统调用号和 errno 语义需要自己处理。
