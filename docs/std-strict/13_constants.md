# 13. 编译期常量

`const` 声明一个**只在编译期存在**的常量。和 `val` / `var` 不同，它不占用任何内存，也没有运行时地址。

## 语法

```
const <NAME>: <type> = <expr>
```

例如：

```text
const MAX_SIZE: i32  = 1024
const PI: f64        = 3.14159265358979
const SYS_WRITE: i32 = 1
const FLAG: u32      = 0x80
```

按约定，常量名使用大写蛇形命名（`SCREAMING_SNAKE_CASE`）。

## 类型标注是强制的

和普通寄存器操作不同，`const` 声明必须显式写出类型。这决定了常量在用于内存写入或位运算时会被如何截断：

```text
const BYTE: u8  = 0xFF
const WORD: u16 = 0xFFFF

mem.u8[r1]  = BYTE      // 写 1 字节
mem.u16[r1] = WORD      // 写 2 字节
```

## 使用方式

常量可以出现在任何需要立即数的位置：

```text
r1 = MAX_SIZE
r2 = r3 + SYS_WRITE
if (r4 >= MAX_SIZE) goto(@overflow)
syscall(SYS_WRITE, 1, &MSG, MSG.length)
```

编译器会把常量**内联**到最终指令的立即数字段里，不产生任何加载操作。

## 常量表达式

`const` 的右边可以是任意**编译期可求值**的表达式，包括：

- 字面量
- 其他已声明的 `const`
- 算术和位运算
- `.length` 属性（见 [14. 数据段](./14_data_segments.md) 和 [15. 字符串](./15_strings.md)）

```text
const BUFFER_SIZE: i32 = 1024
const HALF_BUFFER: i32 = BUFFER_SIZE / 2
const MASK: u32        = (1 << 16) - 1

val MSG: u8[] = "Hello"
const MSG_LEN: u32 = MSG.length
```

不允许在常量表达式里使用：

- 寄存器
- 内存访问 `mem.*[...]`
- 函数调用
- 运行时取地址 `&`（特例：`&FUNC` 和 `&GLOBAL` 的地址在链接时确定，不是编译期常量）

## 不能取地址

因为 `const` 根本没有运行时内存位置：

```text
const MAX: i32 = 1024

r1 = &MAX          // 编译错误：const 没有地址
```

如果你需要把一个数值放进 `.rodata` 并取它的地址，应该使用 `val`：

```text
val MAX: i32[1] = [1024]

r1 = &MAX          // 合法，MAX 在 .rodata 中有真实地址
r2 = mem.i32[r1]   // r2 = 1024
```

## 可见性

和函数一样，常量也支持 `pub` 和 `export`：

```text
pub const PUBLIC_LIMIT: i32  = 100      // 模块外可见
const PRIVATE_TAG: u32       = 0xDEAD   // 模块内可见
```

`const` 不需要 `export`——它不产生任何符号，也就没有东西可以导出。
