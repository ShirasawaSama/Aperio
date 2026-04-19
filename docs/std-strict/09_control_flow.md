# 09. 控制流

Std-Strict 没有 `if/else` 块、没有 `while` 循环、没有 `for` 循环。所有控制流都通过**标签**和**跳转**来实现，这是汇编的本来面貌。

如果你想要结构化控制流，使用 Loose 模式（`.apo`），它会在编译时被降级为本章描述的形式。

## 标签

标签用 `@` 前缀定义，后跟一个冒号。它标记代码中的一个位置，让跳转指令能以它为目标。

```text
@loop_start:
    r1 = r1 + 1
    goto(@loop_start)
```

### 标签的作用域

标签的作用域是**函数级别**的：同一个函数内标签名不能重复，不同函数之间可以重名。

```text
pub fn foo() -> r0 {
@done:
    r0 = 0
}

pub fn bar() -> r0 {
@done:          // 合法，与 foo 中的 @done 不冲突
    r0 = 1
}
```

### 标签的命名

标签名的命名规则与普通标识符一致（见 [03. 词法](./03_lexical.md)），只是引用和声明时都要带 `@` 前缀。

## 无条件跳转

`goto(@label)` 无条件地把控制流转移到指定标签。

```text
goto(@end)
// 这里的代码不会被执行
@end:
```

这等价于 x86 的 `jmp` / ARM 的 `b` / Wasm 的 `br`。

## 条件跳转

条件跳转的语法是 `if (<condition>) goto(@label)`：

```text
if (r1 > 0) goto(@positive)
if (r1 == r2) goto(@equal)
if (r1 <= 100) goto(@in_range)
```

条件中可以使用 [06. 运算符](./06_operators.md) 中列出的所有比较运算符：`==`、`!=`、`<`、`>`、`<=`、`>=`。

### 条件语法的限制

条件表达式必须是**单个比较**。不允许组合的逻辑条件：

```text
// 非法：
if (r1 > 0 && r2 < 10) goto(@ok)

// 合法：用两个跳转拆开写
if (r1 <= 0) goto(@fail)
if (r2 >= 10) goto(@fail)
goto(@ok)
@fail:
```

这个限制是刻意的——它让每一条跳转指令都能直接映射到一条底层的 `cmp + jcc` 指令序列，不需要短路求值。

### 比较的操作数

比较的两边可以是：

- 寄存器
- 立即数

但不能是内存表达式。如果要比较内存中的值，需要先加载到寄存器：

```text
// 非法：
if (mem.i32[r1] > 0) goto(@ok)

// 合法：
r2 = mem.i32[r1]
if (r2 > 0) goto(@ok)
```

## 典型模式

### 等价于 if/else

```text
// if (r1 > 0) { A } else { B }
if (r1 > 0) goto(@then)
    // B
    goto(@end)
@then:
    // A
@end:
```

### 等价于 while 循环

```text
// while (r1 < 10) { body; r1++ }
@loop:
    if (r1 >= 10) goto(@done)
    // body
    r1 = r1 + 1
    goto(@loop)
@done:
```

### 等价于 do-while 循环

```text
// do { body } while (r1 < 10)
@loop:
    // body
    if (r1 < 10) goto(@loop)
```

### 等价于 for 循环

```text
// for (r1 = 0; r1 < 10; r1++) { body }
r1 = 0
@loop:
    if (r1 >= 10) goto(@done)
    // body
    r1 = r1 + 1
    goto(@loop)
@done:
```
