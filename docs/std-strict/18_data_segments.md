# 14. 数据段

数据段（data segments）是**占用运行时内存**的全局存储区。Aperio 提供两种声明关键字：`val`（只读）和 `var`（可变），并根据是否初始化自动决定数据最终落到哪个段。

## val：只读数据

`val` 声明一个不可变的全局数据，**必须初始化**。它会被放进二进制的 `.rodata` 段（只读数据段），运行时任何对它的写入都会触发段错误。

```rust
val TABLE: u32[4]     = [10, 20, 30, 40]
val MESSAGE: u8[]     = "Hello"
val MAGIC: u64[1]     = [0xDEADBEEFCAFEBABE]
```

## var：可变数据

`var` 声明一个可变的全局数据。根据是否初始化，编译器决定放到 `.data` 还是 `.bss`：

### 初始化的 var → `.data`

```rust
var COUNTER: i32[1]   = [0]
var STATE: u8[16]     = [1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0]
```

这些数据会以初始值的形式写入可执行文件，程序启动时加载到内存。

### 未初始化的 var → `.bss`

```rust
var BUFFER: u8[1024]
var HEAP: u64[4096]
```

未初始化的 `var` 不占用可执行文件空间（只在文件头里记录大小），运行时由加载器分配并**清零**。这是给大块缓冲区用的常见手法。

## 数组语法

所有数据段声明都使用数组语法 `<type>[<size>]`，即使只存一个值也要写成 `[1]`：

```rust
val COUNT: i32[1]     = [42]        // 一个 i32
val VEC: f32[3]       = [1.0, 2.0, 3.0]    // 三个 f32
var POOL: u8[4096]                   // 4KB 字节数组
```

### 推导大小

可以省略数组长度，让编译器根据初始化列表推导：

```rust
val PRIMES: i32[] = [2, 3, 5, 7, 11, 13]
// 等价于 val PRIMES: i32[6] = [2, 3, 5, 7, 11, 13]
```

对于字符串字面量，长度也会自动推导，详见 [15. 字符串](./15_strings.md)。

## 访问数据段

数据段名本身代表的是一个**地址符号**。要读写它的内容，需要先用 `&` 取地址再用 `mem.*[...]`：

```rust
val TABLE: u32[4] = [10, 20, 30, 40]
var COUNTER: i32[1] = [0]

pub fn demo() -> r0 uses (r1, r2) {
    r1 = &TABLE
    r2 = mem.u32[r1 + 4]        // 读第 2 个元素（索引 1）→ 20

    r1 = &COUNTER
    r2 = mem.i32[r1]
    r2 = r2 + 1
    mem.i32[r1] = r2            // COUNTER[0]++

    r0 = 0
}
```

## `.length` 编译期属性

任何 `val` 或 `var` 声明的数据段都有一个 `.length` 属性，返回它的**字节数**（不是元素个数）。这个属性是编译期常量，可以用在 `const` 里：

```rust
val BUFFER: u32[16] = [ ... ]
const BUFFER_BYTES: u32 = BUFFER.length      // = 64

val MSG: u8[] = "Hello"
const MSG_LEN: u32 = MSG.length              // = 5
```

这省去了传统汇编里用 `$ - label` 手动计算长度的麻烦。

## 可见性

`val` 和 `var` 可以搭配 `pub` 和 `export`：

```rust
pub val PUBLIC_TABLE: u32[4] = [1, 2, 3, 4]
export var GLOBAL_STATE: u64[1] = [0]
export pub val API_VERSION: u32[1] = [1]
```

规则和函数完全一致（见 [10. 函数](./10_functions.md)）。

## 几种全局声明的对比

| 关键字 | 可变？ | 占用内存？ | 段位置    | 必须初始化？ |
|--------|--------|------------|-----------|--------------|
| `const` | 否    | 否         | （无）     | 是           |
| `val`   | 否    | 是         | `.rodata` | 是           |
| `var` + 初始化 | 是 | 是   | `.data`   | —            |
| `var` 无初始化 | 是 | 是   | `.bss`    | —            |
