# 11. 控制流

Std-Strict 没有 `if/else` 块、没有 `while` 循环、没有 `for` 循环。所有控制流都通过**标签**和**跳转**实现——这是汇编的本来面貌。

如果你想要结构化控制流，使用 Loose 模式（`.apo`），它会在编译时被降级为本章描述的形式。

## 标签

标签用 `@` 前缀定义，后跟冒号。它标记代码中的一个位置，让跳转指令能以它为目标。

```rust
@loop_start:
    r1 = r1 + 1
    goto(@loop_start)
```

### 标签的作用域

函数级别：同一函数内标签名不能重复，不同函数之间可以重名。

```rust
pub fn foo() -> (r0: i64) {
@done:
    r0 = 0
}

pub fn bar() -> (r0: i64) {
@done:                       // 合法，与 foo 中的 @done 不冲突
    r0 = 1
}
```

### 标签的命名

标签名的命名规则与普通标识符一致（见 [03. 词法](./03_lexical.md)），只是引用和声明时都要带 `@` 前缀。

## 无条件跳转

`goto(@label)` 无条件地把控制流转移到指定标签：

```rust
goto(@end)
// 这里的代码不会被执行
@end:
```

等价于 x86 的 `jmp` / ARM 的 `b` / Wasm 的 `br`。

## 条件跳转

```rust
if (<condition>) goto(@label)
```

`<condition>` 必须是一个 `bool` 类型的表达式——通常是比较表达式：

```rust
if (r1 > 0) goto(@positive)
if (r1 == r2) goto(@equal)
if (r1 <= 100) goto(@in_range)
```

也可以是已经算出来的 bool 值：

```rust
r3: bool = r1 < r2
if (r3) goto(@less)
```

### 条件语法的限制

条件表达式必须是**单个比较**或**单个 bool 值**。不允许组合的逻辑条件：

```rust
// 非法：
if (r1 > 0 && r2 < 10) goto(@ok)

// 合法：拆成两个跳转
if (r1 <= 0) goto(@fail)
if (r2 >= 10) goto(@fail)
goto(@ok)
@fail:
```

这个限制让每一条跳转指令都能直接映射到一条底层的 `cmp + jcc` 序列，不需要短路求值。

### 比较的操作数

比较的两边可以是：

- 寄存器
- 立即数

但不能是内存表达式——先加载到寄存器：

```rust
// 非法：
if (mem.i32[r1] > 0) goto(@ok)

// 合法：
r2 = mem.i32[r1]
if (r2 > 0) goto(@ok)
```

比较两侧的当前类型必须一致（详见 [13. ABI 的寄存器类型流](./13_abi.md#寄存器类型流dreg)）。

## 类型流在合流点

跳转会造成控制流合流。**每个合流点上，每个活跃寄存器的当前类型在所有前驱路径上必须一致**，否则编译错。详见 [13. ABI](./13_abi.md)。

## 典型模式

### 等价于 if/else

```rust
// if (r1 > 0) { A } else { B }
if (r1 > 0) goto(@then)
    // B
    goto(@end)
@then:
    // A
@end:
```

### 等价于 while 循环

```rust
// while (r1 < 10) { body; r1++ }
@loop:
    if (r1 >= 10) goto(@done)
    // body
    r1 = r1 + 1
    goto(@loop)
@done:
```

### 等价于 do-while 循环

```rust
// do { body } while (r1 < 10)
@loop:
    // body
    if (r1 < 10) goto(@loop)
```

### 等价于 for 循环

```rust
// for (r1 = 0; r1 < 10; r1++) { body }
r1 = 0i64
@loop:
    if (r1 >= 10) goto(@done)
    // body
    r1 = r1 + 1
    goto(@loop)
@done:
```

## 无分支选择

对于"根据条件选一个值"的场景，优先考虑 [`std/core::select`](./25_std_core.md)——编译器会生成 `cmov` / `csel` 之类的无分支指令：

```rust
import "std/core" as core

r3 = core::select(r1 > 0, r2, -r2)     // abs(r2)
```

注意 `select` 的两个分支**都会被求值**（因为它是函数调用，不是控制流），有副作用时要小心。
