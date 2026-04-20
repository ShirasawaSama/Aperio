# 21. 模块系统

`.ap` 源文件通过 `import` 引入其他模块，并通过 `pub` / `export` 控制符号可见性。

## 文件即模块

一个 `.ap` 文件就是一个模块。模块之间通过**路径**互相引用——Aperio 模块系统基于**文件路径**，不基于嵌套命名空间。

## import 语法

```rust
import "<path>" as <alias>
```

- `"<path>"` 是一个字符串字面量，描述被引模块的位置
- `<alias>` 是一个在当前文件中有效的短名字，之后用 `alias::<name>` 访问被引模块的成员

```rust
import "std/io" as io
import "std/atomic" as atomic
import "../utils/hash" as hash
import "./helpers" as helpers
import "mypkg/math/vector" as vec

io::println!("value = {d}", r1)
r0 = atomic::load_i64(addr = r1)
r0 = hash::fnv1a(r1 = r2, r2 = r3)
r0 = vec::dot(r1 = f1, r2 = f2)
```

## 路径解析规则

| 路径开头        | 含义                                  | 查找位置                                       |
|-----------------|---------------------------------------|------------------------------------------------|
| `"std/..."`     | 内置标准库（编译器隐式提供）          | 仓库 `stdlib/` 目录（`aperio build` / `check` 会合并进编译单元） |
| `"./"` / `"../"`| 相对当前文件                          | 按文件系统                                     |
| `"/"`           | 相对项目根                            | 按文件系统，根 = `aperio.toml` 所在目录        |
| `"<pkg>/..."`   | 已登记的第三方包                      | 查项目 `aperio.toml` 的 `[deps]` 短名          |

**扩展名默认 `.ap`**——`"./helpers"` 会尝试 `./helpers.ap`。

路径里的分隔符统一用 `/`（即使在 Windows 上）。

## 成员访问

模块成员永远通过 `别名::名字` 访问。`::` 前只能是 `import ... as <别名>` 定义的别名。**没有嵌套的命名空间**——`a::b::c` 这种三段式写法不合法。

```rust
import "std/atomic" as atomic

r0 = atomic::load_i64(addr = r1)            // OK
r0 = std::atomic::load_i64(addr = r1)       // 编译错
```

如果你想给"深"一点的模块起个短别名，直接在 `import` 时选：

```rust
import "std/atomic" as at
r0 = at::load_i64(addr = r1)
```

## 别名唯一

一个文件里所有 `import ... as <别名>` 的别名必须互不冲突。没有 `import *` / `use` 这种"引入未限定名字"的语法——永远需要带 `别名::` 前缀。

## 可见性

### `pub` —— 模块可见性

用在顶层声明上（函数、常量、类型别名、结构体、宏）。没写 `pub` 的声明只在**定义它的模块内**可见；`pub` 标记的声明可以被其他模块 `import` 后通过别名访问。

```rust
// math.ap
pub const PI: f64 = 3.141592653589793
pub fn square(r1: i64) -> (r0: i64) { r0 = r1 * r1 }

fn helper(r1: i64) -> (r0: i64) { r0 = r1 + 1 }   // 私有
```

```rust
// main.ap
import "./math" as math
r0 = math::square(r1 = 5)               // OK
r0 = math::helper(r1 = 5)               // 编译错：helper 不是 pub
```

### `export` —— 链接器可见性

控制符号在**目标文件**里是否对链接器暴露——这是个正交维度。`export` 决定链接期行为，`pub` 决定编译期行为。

| 修饰组合              | 本模块看得到 | 其他模块 `import` 后看得到 | 链接器看得到 |
|-----------------------|--------------|----------------------------|--------------|
| `fn foo`              | ✅           | ❌                         | ❌           |
| `pub fn foo`          | ✅           | ✅                         | ❌           |
| `export fn foo`       | ✅           | ❌                         | ✅           |
| `export pub fn foo`   | ✅           | ✅                         | ✅           |

只有 `export` 的符号才会在 `.o` / `.so` / 可执行文件里保留其外部名字，供 C 代码或其他语言的链接器来找。

## 符号修饰

为了避免模块间名字冲突，编译器对符号做 **name mangling**。未 `export` 的符号名字格式是：

```
_ap<module_path_hash>_<symbol_name>
```

例：`math.ap` 里的 `square` 函数在目标文件里叫 `_apXXXXXX_square`（`XXXXXX` 是模块路径 hash）。

**`export` 的符号不做修饰**——它的链接器名字就是它的源码名字：

```rust
export fn my_handler(r1: i64) -> (r0: i64) { ... }
// 链接器里叫 "my_handler"
```

这让 Aperio 代码能被 C 直接调用（只要 ABI 匹配）；反过来，Aperio 里通过 `extern fn`（见 [22. FFI](./22_ffi.md)）引入的外部符号也默认不修饰。

想自定义 export 名字：

```rust
#[export_name("custom_name")]
export fn foo(r1: i64) -> (r0: i64) { ... }
```

## import 找不到会怎样

- 路径对不上任何文件 → 编译错
- 路径对上了但不是合法的 `.ap` 源 → 编译错
- 被引模块内部有语法错 → 编译错（错误报告指回被引文件）

import 是**编译期**操作——没有运行时的动态加载。

## 循环依赖

允许循环 import（两个模块互相 `import`），但要满足：循环里的任意一条边都必须是**纯类型/常量依赖**，不能是"函数调用绕一圈"。

实际上编译器按依赖图做拓扑排序，能拆开的循环会自动拆；拆不开的会报错让你手动打破。

## 示例：一个多模块项目

```
project/
├── main.ap
├── math/
│   ├── vec.ap
│   └── matrix.ap
└── utils/
    └── hash.ap
```

```rust
// math/vec.ap
pub fn dot(f1: f64, f2: f64, f3: f64, f4: f64) -> (f0: f64) uses f5 {
    f5 = f1 * f3
    f0 = f2 * f4 + f5
}
```

```rust
// main.ap
import "./math/vec" as vec
import "./utils/hash" as hash
import "std/io" as io

pub fn main() -> (r0: i32) {
    f0 = vec::dot(f1 = 1.0f64, f2 = 2.0f64, f3 = 3.0f64, f4 = 4.0f64)
    io::println!("dot = {f}", f0)
    r0 = 0i32
}
```

一个文件里的 `import` 全部集中在顶部（约定，非强制），所有外部依赖一目了然。

## 第三方包

`import "<pkg>/..."` 里的 `<pkg>` 指的是项目 `aperio.toml` 的 `[deps]` 里登记的**短名**，不是 Git URL。

```toml
# aperio.toml
[deps]
json = "github.com/aperio-lang/json@v1.4.0"
```

```rust
import "json" as j               // OK，短名在 [deps] 里
import "json/ast" as jast        // OK，包内子路径

import "github.com/aperio-lang/json" as j          // 编译错：E5005 raw VCS path
import "json@v1.4.0" as j                           // 编译错：E5004 version in import path
import "unknown-pkg" as u                           // 编译错：E5003 unknown package
```

**禁止在 `import` 字面量里出现 VCS URL 或版本号**——版本集中由清单管理，源码里只认短名。

## 工具链实现状态（import 合并）

- **CLI `build` / `check`**：若入口文件含 `import`，会从入口路径向上查找 `stdlib/std/os/win.ap` 以定位 `stdlib/` 根目录（否则尝试 `cwd/stdlib`），再按 BFS 加载 `std/…` 与 `./`、`../` 依赖；将依赖模块的顶层声明（除 `fn` 与 `import` 行本身）拼入同一 `FileUnit` 供后续语义与 codegen 使用。重复顶层符号报 **E5013**；找不到文件报 **E5012**；不支持的 import 方案报 **E5011**。
- **解析器**：`parseFile` 支持链式 `nextNodeIdStart` / 返回 `nextNodeIdExclusive`，避免多文件合并后 AST 节点 id 冲突。

完整的包管理规则（清单格式、版本语义、MVS 解析、锁文件、缓存）在独立的《Aperio 包管理器》文档里：

- [包管理器总览](../package-manager/README.md)
- [aperio.toml schema](../package-manager/02_manifest.md)
- [import 解析规则](../package-manager/04_resolution.md)
- [标准库为什么不在 `[deps]` 里](../package-manager/09_stdlib.md)
