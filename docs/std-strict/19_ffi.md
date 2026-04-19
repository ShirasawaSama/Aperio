# 19. 外部函数接口 (FFI)

FFI（Foreign Function Interface）是 Aperio 调用其他语言（主要是 C）写的函数的机制。通过 `extern fn` 声明告诉编译器某个符号在外部存在，链接时由链接器负责解析。

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成  
  已覆盖：`extern fn` 声明、`name: type` 形参风格、`...` 变参标记、返回类型基础解析。  
  未覆盖：与文档完全一致的全部 FFI 语法分支与调用细节。
- 语义（Semantic）：`[ ]` 未开始（跨 ABI 的参数分类/变参规则尚未落地）
- 编译（Windows x86_64）：`[ ]` 未开始（尚未打通 extern 调用生成与链接）

## 基本语法

```rust
extern fn <name>(<params>) -> <return>
```

`extern fn` 的语法与普通 `fn` 有两个关键区别：

- **参数写的是 `名字: 类型`，不是寄存器**
- 没有函数体，也没有 `uses` 子句（遵循平台标准 C ABI）

```rust
extern fn printf(fmt: u64, val: i32) -> i32
extern fn malloc(size: u64) -> u64
extern fn free(ptr: u64) -> i32
extern fn strlen(s: u64) -> u64
```

## 为什么参数写类型和名字

`extern fn` 的参数不再是"虚拟寄存器"，而是有类型、有名字的形参，原因有两个：

1. 被调用的是 C 函数，它的 ABI 由平台 C 调用约定决定（System V AMD64、AAPCS64 等），不是 Std-Strict 的虚拟 ABI——编译器需要根据类型决定每个参数放到哪个硬件寄存器（整数走整数寄存器序列，浮点走浮点寄存器序列）
2. 名字用于调用点的命名参数语法（见下文）

指针类型统一用 `u64`（64 位平台）或 `u32`（32 位平台），因为 Std-Strict 没有专门的指针类型。

## 调用外部函数

调用 `extern` 函数同样使用**命名参数语法**，只是名字来自 `extern fn` 声明中的形参名，而不是寄存器名：

```rust
extern fn printf(fmt: u64, val: i32) -> i32

val FMT: u8[] = c"Value is %d\n"

pub fn demo() -> r0 {
    printf(fmt = &FMT, val = 42)
    // r0 = printf 的返回值
}
```

编译器会根据平台 C ABI 自动搬运：`fmt` 搬到 System V 的 `rdi`、`val` 搬到 `esi`，以此类推。你在源码里**看不到**这层搬运。

### 返回值

外部函数的返回值也按 C ABI 约定返回，但对 Std-Strict 调用者来说，结果统一落到 `r0` 中：

```rust
extern fn malloc(size: u64) -> u64

pub fn alloc_page() -> r0 {
    malloc(size = 4096)
    // r0 = malloc 的返回值（地址）
}
```

## 跨 ABI 调用对寄存器的影响

跨 ABI 调用的"哪些寄存器会被破坏"由平台 C ABI 决定，**不能**由你控制。调用点之后，**所有** caller-saved 寄存器（System V 下是 `rax`、`rcx`、`rdx`、`rsi`、`rdi`、`r8` ~ `r11` 等）都应该视为已被破坏。

编译器会：

- 自动识别调用点附近仍然需要保留值的虚拟寄存器
- 在调用前把它们保存到栈上
- 在调用后恢复

你只需要遵守自己函数的 `uses` 列表——调用 `extern` 函数不会改变你对外承诺的 ABI。

## 变参函数

C 的可变参数函数（`printf`、`scanf` 等）用 `...` 表示：

```rust
extern fn printf(fmt: u64, ...) -> i32
```

调用变参函数时，可变部分用**位置参数**追加在命名参数之后：

```rust
printf(fmt = &FMT, 42, 100, &NAME)
// 等价于 C 的 printf(FMT, 42, 100, NAME)
```

变参的数量和类型由调用者负责保证与格式串一致——编译器无法静态检查，这和 C 里的情况一样。

## 导出到 C

反过来，如果你想让 C 代码调用 Aperio 函数，使用 `export`：

```rust
// math.ap
export pub fn compute(r1) -> r0 {
    r0 = r1 * 2
}
```

编译后 C 侧的声明应该是：

```c
extern int64_t compute(int64_t arg);
```

需要注意：

- `export` 函数的签名必须能对应到 C ABI（整数参数、简单返回值）
- Aperio 的 `r1`（第一个参数）对应 C 的第一个参数
- `r0`（返回值）对应 C 的返回值
- **`uses` 列表在这个方向上不生效**——你必须手动保证遵守 C ABI 的 callee-saved 约束，一般来说可以用 `uses` 列出所有 caller-saved 寄存器

## 平台说明

`extern fn` 的 ABI 绑定到编译目标：

| 目标           | 使用的 ABI               |
|----------------|--------------------------|
| Linux x86-64   | System V AMD64           |
| macOS x86-64   | System V AMD64           |
| Windows x86-64 | Microsoft x64            |
| Linux ARM64    | AAPCS64                  |
| Wasm           | Wasm 外部函数 (imports)  |

同一份 `.ap` 源码在不同目标上编译时，`extern fn` 的寄存器映射会自动调整。你不需要为每个平台写多套代码。
