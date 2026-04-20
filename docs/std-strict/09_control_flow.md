# 09. 控制流（导航页）

本章是兼容目录保留页，用于旧链接跳转。

Std-Strict 控制流的唯一规范正文在：

- [11. 控制流](./11_control_flow.md)

如果你要找下面这些内容，请直接看 `11_control_flow.md`：

- 参数化标签与跳转（`@label(r1: i32)`、`goto(@label(r1))`）
- 结构化 `if (...) { ... } else { ... }`
- `save (r1, r2) { ... }` 的块语义与类型快照恢复
- 跳转边界（禁止向内跳进 `if/save` 内部）

函数调用参数规则 A（位置参数 + 显式目标槽）在：

- [12. 函数 - 调用函数](./12_functions.md#调用函数)

## 章节实现状态

- 规范来源：`[x]` 已切换为单一来源（本页不再承载规范正文）
- 文档同步：`[~]` 持续进行（后续仅维护跳转与索引信息）
# 09. 控制流

> 本章为兼容目录保留页，内容与 `11_control_flow.md` 同步维护。  
> 当前 Std-Strict 控制流已支持参数化 label/goto、结构化 if、save 块；函数调用参数规则见 [12. 函数](./12_functions.md#调用函数)。

Std-Strict 保留“标签 + 跳转”这套汇编原生控制流，同时提供轻量结构化 `if` 与 `save` 语句来提升可读性。

## 章节实现状态

- 解析（Parser）：`[~]` 部分完成  
  已覆盖：参数化标签（`@label(r1: u32):`）、`goto(@label(...))`、`if (...) goto(...)`、结构化 `if (...) { ... } else { ... }`、`save (...) { ... }`、`return`、赋值与多目标赋值。  
  未覆盖：更复杂条件组合规则与全部边界错误场景。
- 语义（Semantic）：`[~]` 部分完成  
  已覆盖：禁止向内跳（不可从外层跳进 `if/save` 内部标签）、label 参数个数检查、label 参数类型重建、`save` 块类型快照恢复、`if/else` 合流类型冲突检查、同一 label 多前驱入边参数类型一致性检查、`goto` 与自然落入（fallthrough）到同一 label 的入边状态一致性检查（按 label 前驱集合统一校验）。  
  未覆盖：完整 CFG 级别控制流合流类型一致性与更细粒度跨路径检查。
- 编译（Windows x86_64）：`[~]` 部分完成（`goto`/`if-goto` 最小分支发射已接通）

## 标签

标签用 `@` 前缀定义，后跟一个冒号。它标记代码中的一个位置，让跳转指令能以它为目标。

```rust
@loop_start:
    r1 = r1 + 1
    goto(@loop_start)
```

### 标签的作用域

标签的作用域是**函数级别**的：同一个函数内标签名不能重复，不同函数之间可以重名。

```rust
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

## 参数化标签与跳转

标签支持参数声明，跳转支持实参传递：

```rust
@join(r1: i32, r3: i32):
    r0 = r1

goto(@join(r1, r3))
if (r2 > 0) goto(@join(r1, r3))
```

说明：

- label 形参个数必须与 `goto` 实参数量一致
- 到达 label 时，按 label 参数声明重建对应寄存器类型（旧类型视为失效）
- `goto` 仍受“不能向内跳入 `if/save`”规则约束

## 无条件跳转

`goto(@label)` 无条件地把控制流转移到指定标签：

```rust
goto(@end)
// 这里的代码不会被执行
@end:
```

这等价于 x86 的 `jmp` / ARM 的 `b` / Wasm 的 `br`。

## 条件跳转

条件跳转语法：

```rust
if (<condition>) goto(@label)
```

例如：

```rust
if (r1 > 0) goto(@positive)
if (r1 == r2) goto(@equal)
if (r1 <= 100) goto(@in_range)
```

条件中可以使用 [06. 运算符](./06_operators.md) 中的比较运算符：`==`、`!=`、`<`、`>`、`<=`、`>=`。

### 条件语法的限制

条件表达式必须是**单个比较**。不允许组合的逻辑条件：

```rust
// 非法：
if (r1 > 0 && r2 < 10) goto(@ok)

// 合法：用两个跳转拆开写
if (r1 <= 0) goto(@fail)
if (r2 >= 10) goto(@fail)
goto(@ok)
@fail:
```

这个限制是刻意的——让每一条跳转能直接映射到底层 `cmp + jcc`，不依赖短路求值。

### 比较的操作数

比较的两边可以是：

- 寄存器
- 立即数

但不能是内存表达式。如果要比较内存中的值，需要先加载到寄存器：

```rust
// 非法：
if (mem.i32[r1] > 0) goto(@ok)

// 合法：
r2 = mem.i32[r1]
if (r2 > 0) goto(@ok)
```

## 结构化 if 块

除了 `if (...) goto(...)`，Std-Strict 也支持结构化 `if`：

```rust
if (r1 > r2) {
    r0 = r1
} else {
    r0 = r2
}
```

结构化 `if` 是语法层增强，底层控制流与类型流规则不变。

## save 块

`save` 用于包裹“临时覆盖寄存器后再恢复”的代码段：

```rust
save (r1, r2) {
    r1 = r1 + r2
    r2 = 0
}
```

块退出后恢复进入块前的类型快照，避免块内临时类型污染外层。

## 函数调用参数规则（链接）

你提到的函数参数写法现在是规则 A：

- `slot = <expr>`：任意表达式，必须显式写目标槽
- `<reg-or-alias>`：纯寄存器/别名值可省略目标槽（位置参数）

详情见 [12. 函数 - 调用函数](./12_functions.md#调用函数)。

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
r1 = 0
@loop:
    if (r1 >= 10) goto(@done)
    // body
    r1 = r1 + 1
    goto(@loop)
@done:
```
