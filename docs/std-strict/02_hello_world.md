# 02. Hello World

在深入任何语法细节之前，我们先看一个能跑起来的完整程序，对 Std-Strict 的样貌有一个直观印象。

## 代码

```text
val MSG: u8[] = c"Hello, Aperio!\n"

export pub fn main() -> r0 {
    syscall(1, 1, &MSG, MSG.length)    // sys_write(stdout, MSG, len)
    syscall(60, 0)                      // sys_exit(0)
    r0 = 0
}
```

比你想象的短——Aperio 刻意减少了样板代码。下面逐行解释它涉及的每个概念。

## 逐行解读

### `val MSG: u8[] = c"Hello, Aperio!\n"`

在只读数据段（`.rodata`）中定义一个字节数组。前缀 `c` 表示 C 风格字符串，编译器会自动在末尾追加 `\0`。

### `export pub fn main() -> r0`

定义一个名为 `main` 的公开函数：

- `export` 表示导出符号，让链接器能看见它
- `pub` 表示对其他模块可见
- `()` 表示没有参数
- `-> r0` 表示返回值放在 `r0` 里

这个函数没有用到参数和返回值以外的寄存器，所以省略了 `uses` 子句。详见 [11. ABI](./11_abi.md)。

### `syscall(1, 1, &MSG, MSG.length)`

发起系统调用。`syscall` 的括号里**是真的参数**（位置参数），不像普通函数调用那样写成 `r1 = ...` 的命名形式——它是编译器内置原语，由编译器按平台的系统调用 ABI 自动装入对应寄存器，再插入 `syscall` 指令（或 ARM64 的 `svc #0` 等）。

这里的四个参数依次是：Linux `sys_write` 调用号、文件描述符（stdout）、缓冲区地址、长度。

`MSG.length` 是一个编译期常量，直接算出 `MSG` 的字节数（包含 `c` 前缀自动追加的 `\0`）。

### `r0 = 0`

函数末尾，把返回值设为 0。没写 `return`——**尾部的 `return` 可以省略**，函数体结束时隐式返回。

## 一个用到普通函数的版本

上面的写法全部用 `syscall` 完成工作。下面换成用一个用户函数来打印：

```text
val MSG: u8[] = c"Hello, Aperio!\n"

fn print(r1, r2) -> r0 {
    // r1 = buffer 地址, r2 = 长度
    syscall(1, 1, r1, r2)
    r0 = 0
}

export pub fn main() -> r0 {
    print(r1 = &MSG, r2 = MSG.length)
    syscall(60, 0)
    r0 = 0
}
```

这个版本额外展示了两个语法点：

1. **用户定义函数**：`fn print(r1, r2) -> r0 { ... }`
2. **命名参数调用**：`print(r1 = &MSG, r2 = MSG.length)`

在 Std-Strict 中，普通函数调用**必须**使用命名参数形式——每个参数都要显式写出是放进哪个寄存器。这比"先铺寄存器再调用空括号"的纯汇编风格更不容易出错。详见 [10. 函数](./10_functions.md)。

## 一个用到临时寄存器的版本

再加点料——让 `print` 在内部自己算长度（通过扫描 `\0`），演示 `uses` 子句：

```text
val MSG: u8[] = c"Hello, Aperio!\n"

fn c_strlen(r1) -> r0 uses r2 {
    r0 = 0
@loop:
    r2 = mem.u8[r1 + r0]
    if (r2 == 0) goto(@done)
    r0 = r0 + 1
    goto(@loop)
@done:
}

fn print_cstr(r1) -> r0 uses r2 {
    r0 = c_strlen(r1 = r1)            // 单返回值，结果自动在 r0
    r2 = r0                            // 保存长度
    syscall(1, 1, r1, r2)
    r0 = 0
}

export pub fn main() -> r0 {
    print_cstr(r1 = &MSG)
    syscall(60, 0)
    r0 = 0
}
```

`uses r2` 声明"本函数会写入 `r2` 但它既不是参数也不是返回值"。**调用方读签名就知道 `r2` 调用后会被破坏**。

## 关键观察

几个值得你现在就注意的点：

1. **没有 `add`、`mov` 这类助记符**。赋值、算术运算一律使用 C 风格的 `=`、`+`、`-` 等。
2. **普通函数调用必须用命名参数**。`fn(r1 = x, r2 = y)`，不能写成"铺寄存器 + 空括号"。`syscall` 和 `std::*` 等内置原语例外，它们的括号是位置参数。
3. **`uses` 必须显式列出**临时寄存器。编译器不会自动推导——写到未声明的寄存器直接报错。
4. **尾部 `return` 可省略**。但中间分支的提前返回仍需显式 `return`。

接下来的章节会把上面涉及的每个概念单独展开讲。
