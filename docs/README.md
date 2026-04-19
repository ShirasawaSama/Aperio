# Aperio 文档

Aperio 是一门分层的底层编程语言，兼顾可读性（Loose 模式）、跨架构的中间表示（Std-Strict）、以及具体硬件的精确控制（Native-Strict）。这个文档目录是语言与工具链的权威参考。

## 文档结构

```
docs/
├── std-strict/         — Std-Strict 语言指南（核心 IR 层，*.ap）
├── native-strict/
│   └── x86/            — Native-Strict x86 差异文档
├── package-manager/    — 包管理器设计与 CLI 参考
└── README.md           — 你在这里
```

**Loose 模式** 的文档还没写——它的实现要等到 Std-Strict 完整落地后才能开始设计降级路径，目前仅在主计划的 roadmap 里作为 v6 目标占位。

## 三大模式

Aperio 按照抽象层次分成三档，文件扩展名决定编译器用哪套规则：

```
┌─────────────────────────────────────────────┐
│  Loose Mode (*.apo)          —— 尚未实现      │
│  - 结构化控制流 if / while / for              │
│  - 自动寄存器分配                             │
└──────────────────┬──────────────────────────┘
                   │  lowering
                   ▼
┌─────────────────────────────────────────────┐
│  Std-Strict (*.ap)        ←─ 文档最完整       │
│  - 虚拟寄存器 r0-r999, f0-f999               │
│  - 显式 ABI 契约、显式内存访问                │
│  - 标签 + goto 控制流                         │
└──────────────────┬──────────────────────────┘
                   │  instruction selection
                   ▼
┌─────────────────────────────────────────────┐
│  Native-Strict (*.x86.ap / *.arm.ap / ...)  │
│  - 物理寄存器 r0-r15, f0-f15                 │
│  - 目标架构指令形式                           │
│  - System V AMD64 ABI（x86）                  │
└─────────────────────────────────────────────┘
```

---

## [Std-Strict 语言指南](./std-strict/README.md)

Aperio 的核心。第一次接触 Aperio 建议从这里开始。覆盖 39 章：

- **入门**（01-02）：设计哲学、Hello World
- **语言基础**（03-07）：词法、类型、虚拟寄存器、字面量、运算符
- **内存**（08-10）：`mem.<T>[...]`、取地址、volatile
- **控制流与函数**（11-16）：标签 goto、函数、ABI、属性、内联、函数指针
- **数据与结构**（17-20）：`const`、数据段、字符串、结构体
- **模块与 FFI**（21-22）：`import`、`extern fn`
- **宏与标准库**（23-35）：宏系统 + 13 个 `std/*` 模块的参考
- **运行时与附录**（36-39）：程序入口、条件编译、UB 汇总、综合示例

→ [进入 Std-Strict 文档](./std-strict/README.md)

---

## [Native-Strict x86 差异文档](./native-strict/x86/README.md)

Native-Strict x86 是 `Std-Strict ∩ x86-64 硬件能力`——在 Std-Strict 的基础上加上 x86 的硬件约束（寄存器数量、指令形式、ABI、寻址模式）。

这是**差异文档**而不是独立指南——所有没在这里提到的内容都继承自 Std-Strict。

→ [进入 Native-Strict x86 文档](./native-strict/x86/README.md)

---

## [包管理器](./package-manager/README.md)

Go-style 去中心化 + MVS + TOML 清单。9 章覆盖：

- 设计哲学、与 Cargo/npm/Go 的对比
- `aperio.toml` schema 与 `[deps]`
- 版本表达式（tag / commit / branch / @latest）
- MVS 解析算法 + `import` 路径解析
- `aperio.lock` 格式与 `--locked` / `--offline` / `--frozen`
- `~/.aperio/pkg/` 缓存布局 + vendoring
- `aperio init / add / update / fetch / vendor / tree` 命令参考
- 发布一个包（= `git tag && git push`）
- 标准库的特殊地位

→ [进入包管理器文档](./package-manager/README.md)

---

## 工具链（未来）

编译器、linter、formatter、LSP、调试器的用户文档会放在 `docs/toolchain/`。v1 skeleton 里这个目录还不存在——等具体工具有内容了再建。工程师面向的架构参考放在 `aperio/ARCHITECTURE.md`（编译器仓库下）。

## 约定

- 文档全部用中文写，代码块里用 `rust` / `text` / `toml` / `bash` 作为语言标识
- 一个概念一页 / 一章，不混合
- 开发者视角：假设读者知道寄存器、调用约定、汇编的基础概念
- 所有示例尽可能可以复制粘贴运行
- 每个 `std/*` 模块在 Std-Strict 文档里都有独立一章

## 贡献

文档是**权威来源**——实现和文档不一致时，先改文档，再改实现。
