# 14. 函数属性

属性（attribute）用 `#[...]` 语法写在函数签名前，给编译器提供**超出 ABI 契约的额外语义或代码生成提示**。

```rust
#[cold]
fn rare_error() -> (r0: i64) { ... }

#[section(".init"), align(64)]
#[noreturn]
pub fn panic_handler(r1: *u8) { ... }
```

多个属性可以写在同一个 `#[...]` 里（用逗号），也可以分多行。顺序不重要。

## `#[noreturn]`

声明函数**不会正常返回**——它要么无限循环、要么在中途 panic/exit、要么调用另一个 `#[noreturn]` 函数。

```rust
#[noreturn]
pub fn die(r1: i32) {
    os::exit(r1)
}
```

副作用：

- 函数签名不需要 `-> ...`，即使有也会被忽略
- 调用点之后的代码编译器认为**不可达**，会被优化掉
- 内部不需要在函数末尾"返回"——类型流检查对 `#[noreturn]` 函数放松：末尾可以不满足返回寄存器类型

写 `#[noreturn]` 却在某条路径上真的走到函数末尾是 UB。

## `#[cold]`

告诉编译器"这个函数很少被调用"。副作用：

- 代码生成器可能把它放到 `.text.cold` 之类的远端节
- 调用点的分支预测按"不走这边"处理
- 寄存器分配给这个函数的优先级降低

典型用途：错误路径、panic 分支、初始化失败处理。

```rust
#[cold]
fn oom() {
    debug::panic!("out of memory")
}
```

## `#[naked]`

告诉编译器**不要**为这个函数生成函数序言（prologue）和尾声（epilogue），也不做任何栈帧分配。典型用途：**`_start` shim**、**中断向量入口**、**极度定制的 ABI 适配器**。

```rust
#[naked]
#[section(".text.start")]
export pub fn _start() {
    // 这里写的每一条指令都会原样进入目标文件
    // 你必须自己调用 main、自己 exit
}
```

### 限制

- **`uses` 必须为空**（省略整个子句）。Naked 函数没有序言/尾声，不管理临时寄存器
- **不做类型流检查**：编译器**禁用**寄存器遮蔽、合流一致、出口匹配这些 Dreg 内部检查（详见 [13. ABI](./13_abi.md)）
- **签名仍然是 ABI 声明**：调用方按签名类型调用；但函数内部一切由你负责
- 不能是 `inline`

Naked 函数是"告诉编译器我会自己搞定一切"——代价是类型系统完全不保护你。

## `#[cold]` 和 `#[hot]`

对称的一对：

```rust
#[cold] fn rare_path() { ... }
#[hot]  fn main_loop() { ... }
```

`#[hot]` 让编译器在代码布局、寄存器优先级上偏向这个函数。多数情况下编译器的 profile-guided 优化自己会推断，只在确信的场景下加。

## `#[section("<name>")]`

把函数放进指定的段。例：

```rust
#[section(".init")]
pub fn init() { ... }

#[section(".text.hot")]
pub fn decode(r1: *u8) -> (r0: i64) { ... }
```

链接脚本会按段做布局——常见用途是让初始化函数、中断处理函数放进特定地址范围。

## `#[align(<N>)]`

指定函数入口的对齐字节数。`N` 必须是 2 的幂：

```rust
#[align(64)]
pub fn hot_loop(r1: *u8) -> (r0: i64) { ... }
```

对齐到缓存行（64）或跳转表项（16）的大小，能减少 I$ 未命中或预测误差。

## `#[inline]`

和关键字 `inline` 等价（见 [15. 内联函数](./15_inline.md)）：

```rust
#[inline]
pub fn add(r1: i64, r2: i64) -> (r0: i64) {
    r0 = r1 + r2
}
```

两种写法都合法；属性形式是更一致的风格。

## `#[export_name("<name>")]`

自定义 `export` 符号的链接器名字：

```rust
#[export_name("custom_add")]
export fn add_i64(r1: i64, r2: i64) -> (r0: i64) {
    r0 = r1 + r2
}
// 链接器看到的名字是 "custom_add"，不是 "_apXXX_add_i64" 或 "add_i64"
```

只对 `export` 函数有效。

## 组合

多个属性可以组合，只要语义不冲突：

```rust
#[cold]
#[noreturn]
#[section(".text.panic")]
pub fn panic_abort(r1: *u8) {
    io::eprintln!("panic: {s}", r1)
    os::abort()
}
```

## 非法组合

- `#[naked]` + `inline` / `#[inline]` → 互斥（naked 没有正常函数体）
- `#[naked]` + 非空 `uses` → 编译错
- `#[noreturn]` + 非空返回寄存器 → 允许但忽略返回部分

## 和内置属性的区别

`#[builtin]` 和 `#[macro]` 是**编译器专用**属性，用户代码不能写（见 [24. 内置库总览](./24_builtins_overview.md) 和 [23. 宏系统](./23_macros.md)）。本章列出的都是用户可用的属性。
