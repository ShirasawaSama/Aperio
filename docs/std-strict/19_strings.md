# 15. 字符串字面量

在 Aperio 里"字符串"不是一种类型——它只是字节数组的一种简写形式。字符串字面量可以出现在 `val` 或 `var` 的初始化位置，最终展开为 `u8[...]`。

## 普通字符串

用双引号包围：

```rust
val MSG: u8[] = "Hello, Aperio!"
```

字面量的字节长度等于字符串的 UTF-8 字节数，**不**包含结尾的 `\0`。上面的 `MSG.length` 是 15。

## C 风格字符串

前缀 `c` 表示编译器应当自动追加一个 `\0` 字节：

```rust
val GREETING: u8[] = c"Hello"
// 等价于:
val GREETING: u8[] = ["H", "e", "l", "l", "o", 0]
// GREETING.length == 6
```

这是给和 C 语言 FFI 打交道时用的——`printf` / `puts` / `strlen` 等函数都要求字符串以 `\0` 结尾。

## 混排字节数组

数组初始化列表允许字符串片段和数字混写，编译器会把它们按字节顺序拼接：

```rust
val HTTP_REQ: u8[] = [
    "GET / HTTP/1.1\r\n",
    "Host: example.com\r\n",
    "\r\n",
    0,
]
```

字符串片段会展开为它们的 UTF-8 字节，数字会作为 `u8` 值（要求在 0-255 范围内）插入。这个写法对于构造协议报文、二进制格式头或者 shellcode 非常方便。

## 转义序列

字符串字面量支持以下转义：

| 序列     | 含义                |
|----------|---------------------|
| `\n`     | 换行 (0x0A)         |
| `\r`     | 回车 (0x0D)         |
| `\t`     | 制表符 (0x09)       |
| `\0`     | 空字符 (0x00)       |
| `\\`     | 反斜杠              |
| `\"`     | 双引号              |
| `\xHH`   | 十六进制字节（精确） |

```rust
val PATH: u8[]     = "C:\\Users\\Anri"
val PACKET: u8[]   = c"\x7F\x45\x4C\x46"        // ELF 魔数
val LINE: u8[]     = "first\nsecond\n"
```

## 字符串与 `.length`

和普通数组一样，字符串字面量也有 `.length` 属性，返回**字节数**：

```rust
val MSG:  u8[] = "Hello"
val CMSG: u8[] = c"Hello"

const MSG_LEN:  u32 = MSG.length         // 5
const CMSG_LEN: u32 = CMSG.length        // 6（包含 \0）
```

对于写 `sys_write` 这种需要长度的系统调用特别有用：

```rust
val GREETING: u8[] = "Hi!\n"

pub fn say_hi() -> r0 {
    syscall(1, 1, &GREETING, GREETING.length)    // sys_write(stdout, ...)
    r0 = 0
}
```

## 编码说明

源码里的字符串字面量按 **UTF-8** 解释。源文件本身也应该是 UTF-8 编码的。非 ASCII 字符会正确地按 UTF-8 展开为多个字节：

```rust
val CN: u8[] = "你好"
// 展开为 6 个字节: E4 BD A0 E5 A5 BD（UTF-8 编码）
// CN.length == 6
```

如果你需要其他编码（GBK / UTF-16 等），请自行用 `\xHH` 或 `u16[]` / `u8[]` 数组构造。
