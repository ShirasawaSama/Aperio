# 09. 标准库的特殊地位

`std/*` 模块（`std/io`、`std/atomic`、`std/ptr` 等）和第三方包的规则**完全不同**。这一章把差异说清楚。

## 核心约定

| 维度                     | 第三方包                | `std/*`                        |
|--------------------------|-------------------------|--------------------------------|
| 来源                     | Git 仓库（远端抓取）    | **随编译器一起分发**            |
| 在 `[deps]` 里登记       | 必须                    | **禁止**（`E9106 reserved package name`） |
| 在 `aperio.lock` 里出现  | 每个包一条              | **永远不出现**                  |
| 版本                     | semver / commit / branch | **= 编译器版本**                |
| 用户能覆盖吗             | 能改 toml 换版本        | **不能**                        |
| 网络访问                 | fetch 要联网            | **永不联网**                    |
| 校验和                   | 每次对比                | **不做**（编译器内嵌，天然可信） |

一句话：**stdlib 是编译器本身的一部分，而不是包生态的一员。**

## 为什么这么设计

### 优点

- **永远可用**：新手装完编译器就能 `import "std/io"`，不用先学包管理
- **版本绑定**：`std/io::println!` 在 `aperio 1.4.0` 里的行为是**确定的**，不会因为某个 transitive dep 升级而改变
- **离线友好**：没有网络也能构建
- **编译器内建优化**：`std/io::println!` 是宏，编译器可以做特殊 lowering；`std/atomic` 里很多函数标 `#[builtin]`，直接映射到硬件指令——这些是第三方包做不到的
- **FFI 稳定**：`std/ffi::cstr` 这类工具作为语言一部分，不会被第三方 fork 切走

### 代价

- **升级 stdlib = 升级编译器**：没办法"只升 `std/io` 而不碰 `std/ptr`"
- **不同项目用不同 stdlib 版本**：同机器切换项目时要靠编译器版本管理器（类似 `rustup` 的未来计划）

这是个刻意的权衡——Aperio 认为 stdlib 的稳定性和可得性比"独立升级"更重要。

## stdlib 清单

当前分发的 `std/*` 模块（与编译器版本绑定，由编译器 release notes 宣布变更）：

| 模块 | 用途 |
|------|------|
| `std/io`      | I/O 原语，`println!` / `print!` / `read_line` |
| `std/atomic`  | 原子操作、内存序 |
| `std/debug`   | `assert!` / `debug_assert!` / `trace!` |
| `std/convert` | 整型 / 浮点 / 指针间的类型转换 |
| `std/bits`    | 位操作原语（`popcount`、`clz`、`ctz` 等） |
| `std/stack`   | `alloc<T>` 栈上分配 |
| `std/os`      | 进程退出、环境变量、文件描述符 |
| `std/ptr`     | 指针算术（`offset`、`add`、`sub`、`diff`） |
| `std/simd`    | SIMD 抽象（v1 仅接口占位） |
| `std/asm`     | 内联汇编（v1 仅接口占位） |
| `std/ffi`     | C FFI 辅助（`cstr`、`cstr_from_bytes` 等） |

模块之间**互相可用**，但不会产生依赖循环——它们在编译器里是同一份源码树。

## `std/*` 不出现在 `[deps]` 里

编译器看到 `aperio.toml` 里有 `std = "..."` 条目时：

```
error[E9106]: reserved package name 'std'
   ╭─▶ aperio.toml:5:1
   │
 5 │ std = "github.com/whatever"
   │ ^^^
   │
   = note: 'std' is reserved for the standard library distributed with the compiler
   = help: remove this entry
```

## 在 lock 里看不到 `std`

`aperio.lock` 里不会有 `std` 或 `std/io` 的条目。理由：

- lock 记录的是"需要在磁盘找到的内容"，而 stdlib 已经在编译器二进制内
- lock 跨机器迁移时不需要同步 stdlib——换编译器 = 换 stdlib 版本
- 没必要重复记录"编译器自己的一部分"

## 编译器版本与 stdlib 的映射

每个编译器 release 有三个版本号：

| 维度 | 示例 | 含义 |
|------|------|------|
| Aperio 语言 edition | `"2026"` | 语法兼容性边界（见 `aperio.toml` 的 `edition` 字段） |
| Aperio 编译器版本 | `0.8.3` | 工具本身的 semver |
| stdlib 版本       | **= 编译器版本**             | 绑定 |

用户写 `aperio --version` 看到的就是编译器版本，同时它就是 stdlib 版本。

## MSRV：消费方怎么声明"我要什么样的 stdlib"

第三方包的 `README` 里写明：

```markdown
## MSRV
- edition = "2026"
- aperio ≥ 0.8.0
```

编译器在加载包时：

- 包的 `edition` 比当前编译器支持的最高 edition 还新 → `E9105 unsupported edition in dependency`
- 包里用了 `std/` 某个符号在当前编译器里不存在 → 正常 `E5002 unknown symbol`（这是用户体验最重要的兜底）

v2+ 会在 `aperio.toml` 里引入一个可选的 `aperio = ">=0.8.0"` 字段，让解析器提前拒绝不兼容的依赖——v1 里暂不做。

## 未来：edition 迁移

SemVer 之外，Aperio 有 "edition" 概念（借鉴 Rust edition）来管理**语言级**的 breaking changes：

- 同一编译器能同时编译多个 edition 的源码
- `aperio.toml` 的 `edition` 决定语法解释
- edition 迁移通过 `aperio fix --edition` 自动化

stdlib 的 API 稳定性承诺：

- **同一 edition 内**：stdlib 的 API 只增不减、语义不变
- **edition 之间**：允许 deprecation + 迁移工具
- **编译器 patch release**：只改 stdlib 实现，不改 API
- **编译器 minor release**：可新增 stdlib API，不删不改
- **编译器 major release**：伴随新 edition，stdlib API 可以有破坏性改动

这让长期项目可以放心：「我用 edition 2026 / aperio 0.x，只要停留在 0.x 里，stdlib 的行为就不会惊吓我」。

## 为什么不把 stdlib 做成"默认 transitive dep"

有过一个被否决的方案：把 `std` 当一个普通包发，编译器默认给每个项目注入一条 `std = ...@<编译器版本>`。被否决的理由：

- **矛盾的版本模型**：stdlib 依赖编译器内部 API，和编译器无法独立升级——硬做成包反而诱导用户做错误的预期
- **离线 / bootstrap 噩梦**：没有 stdlib 就没法编译任何东西，而普通包要抓网——bootstrap 时鸡生蛋
- **破坏"编译器二进制即 self-contained"的承诺**：下载一个 tarball 就能跑，不用先 fetch 二十个 `std/*` 包

这些代价不值得换"独立升级 stdlib"这个小好处——最终决定把 stdlib 内嵌。

## TL;DR

- `std/*` 不写在 `[deps]`、不出现在 `aperio.lock`
- 它的版本 = 编译器版本
- 用户不能换 stdlib 版本，只能换编译器
- 第三方包不能"包装" stdlib（禁止重命名 `std::` 模块为第三方短名）
- 升级 stdlib → 升级编译器，没有 middle ground

把 stdlib 当成"语言的一部分"而不是"一个特殊的包"来理解，所有规则都自然而然。
