# 16. 函数指针

函数指针是一个指向函数入口地址、**带完整签名信息**的值。Std-Strict 用它来支持回调、函数表、虚分发等模式。

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成  
  已覆盖：`type Alias = fn(...) -> (...)` 的函数类型声明入口。  
  未覆盖：与文档完全一致的函数类型细节（`uses`、更多约束）与全部调用场景。
- 语义（Semantic）：`[ ]` 未开始（函数类型兼容性规则未实现）
- 编译（Windows x86_64）：`[ ]` 未开始（函数指针调用路径未打通）

## 类型语法

用 `fn` 关键字写出一个函数类型：

```rust
fn(<params>) -> <return> [uses <scratch>]
```

和定义函数的签名长得一样，只是没有函数名和函数体。例：

```rust
fn(r1: i64, r2: i64) -> (r0: i64)
fn(r1: *u8, r2: u64) -> (r0: i64) uses (r3, r4)
fn() -> (r0: i64)
fn(r1: i32)                                     // 无返回值
```

### `type` 别名

给函数指针类型起个名字，让签名只写一次：

```rust
type BinaryOp = fn(r1: i64, r2: i64) -> (r0: i64)
type Comparator = fn(r1: i64, r2: i64) -> (r0: i32)
type Callback = fn(r1: *u8, r2: u64) uses r3
```

然后用别名：

```rust
var HANDLER: BinaryOp = &default_op

fn run(r1: i64) -> (r0: i64) {
    r0 = HANDLER(r1 = r1, r2 = 10)
}
```

`type` 可以给任何类型起别名，不限于函数类型——但函数类型是它最常见的场景。

## 获取函数指针

用 `&<函数名>` 取函数地址，详见 [09. 取地址](./09_address_of.md)：

```rust
fn add(r1: i64, r2: i64) -> (r0: i64) { r0 = r1 + r2 }
fn sub(r1: i64, r2: i64) -> (r0: i64) { r0 = r1 - r2 }

pub fn demo() -> (r0: i64) uses r9 {
    r9 = &add                                    // r9 的当前类型 = fn(r1:i64, r2:i64) -> (r0:i64)
    r0 = r9(r1 = 10, r2 = 20)                    // 间接调用
}
```

## 类型兼容性

两个函数指针类型兼容**当且仅当**它们的参数列表、返回值列表、`uses` 列表**按书写顺序、槽位置、类型完全一致**：

```rust
type A = fn(r1: i64, r2: i64) -> (r0: i64)
type B = fn(r1: i64, r2: i64) -> (r0: i64)               // A 和 B 兼容
type C = fn(r2: i64, r1: i64) -> (r0: i64)               // 和 A 不兼容（槽位置不同）
type D = fn(r1: i64, r2: i64) -> (r0: u64)               // 和 A 不兼容（返回类型不同）
type E = fn(r1: i64, r2: i64) -> (r0: i64) uses r3       // 和 A 不兼容（uses 不同）
```

**没有子类型关系**——不是"E 比 A 多一个临时就能当 A 用"。严格相等。

### 别名名字不参与兼容性判定

函数签名里的 `@` 别名（见 [05. 寄存器别名](./05_registers.md#寄存器别名)）只影响源码可读性，**对类型兼容性完全透明**。只要槽、类型、`uses` 一致，就算兼容：

```rust
type BinOp = fn(r1: i64, r2: i64) -> (r0: i64)

fn add(lhs @ r1: i64, rhs @ r2: i64) -> (sum @ r0: i64) {
    sum = lhs + rhs
}

var OP: BinOp = &add                                 // OK：别名不参与兼容判定
```

调用 `OP` 时用类型声明里的槽名：`OP(r1 = 10, r2 = 20)`——函数指针类型里的槽是调用端的规范名；如果 `type` 声明时给槽起了别名，那用别名（规则和直接调用函数一致）。

## 作为参数传递

函数指针作为普通参数出现在签名里：

```rust
type Pred = fn(r1: i64) -> (r0: bool)

fn count_if(r1: *i64, r2: u64, r3: Pred) -> (r0: u64) uses (r4, r5, r6) {
    r0 = 0u64
    r4 = 0u64
@loop:
    if (r4 >= r2) goto(@done)
    r5 = mem.i64[r1 + r4 * 8]
    r6 = r3(r1 = r5)                             // 间接调用谓词
    if (r6) goto(@match)
    goto(@next)
@match:
    r0 = r0 + 1
@next:
    r4 = r4 + 1
    goto(@loop)
@done:
}
```

调用方：

```rust
fn is_positive(r1: i64) -> (r0: bool) { r0 = r1 > 0 }

r0 = count_if(r1 = &ARR, r2 = ARR.length, r3 = &is_positive)
```

## 把地址从 `u64` 转回函数指针

从外部（syscall、二进制表、手写内存）读到一个裸地址想调用它：

```rust
r1 = mem.u64[r5]                                 // r1: u64（裸地址）
r1 = r1 as BinaryOp                              // 强制成函数指针类型
r0 = r1(r1 = 10, r2 = 20)                        // 间接调用
```

`as` 在这里是**强转**——编译器信你对 ABI 匹配负责。不符合签名就是未定义行为。

## 函数指针 vs `extern fn`

二者是两个维度：

- 函数指针：运行时持有的、可以被赋值传递的值
- `extern fn`：一个对外部符号的静态声明（见 [22. FFI](./22_ffi.md)）

对一个 `extern fn` 取地址同样得到一个带签名的函数指针：

```rust
extern fn write(fd: i32, buf: *u8, len: u64) -> (r0: i64)

var WRITE_PTR: fn(fd: i32, buf: *u8, len: u64) -> (r0: i64) = &write
```

## 限制

- **无法从函数指针读出"函数名"**——指针只持有地址和签名，不持有源码名
- **无法从函数指针读出源文件信息**——调试信息是链接期产物，不暴露给运行时
- **`inline` 函数不能取地址**——没有实体就没有指针（见 [15. 内联函数](./15_inline.md)）
