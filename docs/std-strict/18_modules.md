# 18. 模块

Aperio 的模块系统提供命名空间和符号管理。它比 C 的"每个 `.c` 文件一个翻译单元"更结构化，但比 Rust 或 TypeScript 的模块系统更简单——因为底层汇编世界里本就没有真正的"模块"。

## 一个文件就是一个模块

每个 `.ap` 文件自动构成一个模块，模块名由文件路径决定。例如：

```
src/math/vec.ap         → 模块 math::vec
src/net/tcp.ap          → 模块 net::tcp
src/main.ap             → 模块 main（入口）
```

## 导入模块

使用 `import` 引入其他模块：

```text
import math::vec
import net::tcp
```

也可以使用别名：

```text
import math::vec as v
import net::tcp as tcp
```

## 引用模块成员

使用 `::` 分隔符访问模块成员：

```text
import math::vec as v

pub fn demo() -> r0 uses r1 {
    r1 = &v::ORIGIN                       // 引用 math::vec 中的 ORIGIN
    v::normalize(r1 = r1)                 // 调用 math::vec 中的 normalize
    r0 = 0
}
```

可以访问的成员包括：

- 带 `pub` 的函数
- 带 `pub` 的 `val` / `var` / `const`
- 带 `pub` 的 `struct`

## 可见性

默认情况下，模块内声明的所有符号**只对本模块可见**。要让其他模块能看到，加上 `pub`：

```text
// math/vec.ap
pub const DIMENSIONS: u32 = 3       // 可被其他模块 import

const INTERNAL: u32 = 42            // 仅本模块可见

pub fn normalize(r1) -> r0 {
    // ...
}

fn helper(r1) -> r0 {               // 仅本模块可见
    // ...
}
```

## 符号修饰（Name Mangling）

汇编层面没有模块概念——所有符号在链接器眼里都是扁平的全局名字。为了防止不同模块中的同名符号冲突，编译器会对非 `extern` 的符号进行自动修饰：

```
math::vec::normalize    →   __aperio_math_vec_normalize
net::tcp::send          →   __aperio_net_tcp_send
```

修饰格式是 `__aperio_<模块路径以 _ 分隔>_<符号名>`。这个规则是稳定的，你可以在链接时直接用修饰后的名字。

## `export` 和 `pub` 的区别

- `pub`：控制**Aperio 源码层面**的可见性，决定其他 `.ap` 模块能否 `import` 到这个符号
- `export`：控制**链接器层面**的符号导出，决定这个符号在最终二进制里是否可被外部（其他语言写的代码、动态链接）解析

两者正交：

| 组合                | Aperio 模块可见 | 链接器可见 | 典型用途           |
|---------------------|-----------------|------------|--------------------|
| （无）              | 否              | 否         | 模块内部实现        |
| `pub`               | 是              | 否         | 模块对外 API        |
| `export`            | 否              | 是         | 提供给 C 的低层入口  |
| `export pub`        | 是              | 是         | 公共 C ABI 入口     |

当 `export` 出现时，编译器**不会**对符号名做模块修饰，生成的是裸名字：

```text
export pub fn compute() -> r0 { ... }
// 链接符号就叫 compute，而不是 __aperio_<module>_compute
```

这样 C 代码可以直接 `extern int compute(void);` 调用。

## 避免名字冲突

如果两个模块都想 `export` 同名函数，会在链接时产生冲突。解决办法：

- 只在其中一个模块 `export`，另一个只 `pub`
- 给它们加前缀：`export pub fn math_compute(...)` / `export pub fn net_compute(...)`
- 使用 Aperio 内部的修饰：不加 `export`，通过 `import` + `::` 引用

## 循环导入

Aperio **允许**模块之间循环 `import`，因为导入的只是符号声明，不是初始化代码。循环依赖在纯汇编层面没有初始化顺序问题——全局数据都是静态布局，不存在"构造函数"。

但循环依赖会影响编译依赖图，大型项目里仍然建议避免。
