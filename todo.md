# Aperio 全量开发 TODO（v0 -> v1+）

这份清单按你的 4 个初期目标拆解为可落地任务。  
状态约定：`[ ]` 未开始，`[~]` 进行中，`[x]` 完成。
loose 层先完全跳过，先不做

---

## 0. 基础治理与规则同步

- [ ] 建立统一状态面板（本文件 + issue 编号 + 负责人）
- [ ] 固化“文档是规范源”的流程：语法变更必须先改 `docs/`
- [ ] 增加 CI（至少：`build/test/lint`）
- [ ] 增加 nightly 回归（解析器覆盖所有 `docs/` 示例）

---

## 1. 目标一：文档中的所有语法都能解析成 AST

## 1.1 词法层（Lexer）补全

- [ ] 关键字全集与保留字策略（含 `alias`、属性、宏标记等）
- [ ] 字面量全集（整型后缀、浮点后缀、字符串、c 字符串、数组字面量片段）
- [ ] 运算符与分隔符全集（`::`、`->`、`@label`、`...`、属性括号）
- [ ] 注释与错误恢复（行注释、块注释可选）
- [ ] token 位置与错误信息标准化（稳定 `E1xxx`）

## 1.2 语法层（Parser）补全

- [ ] 顶层声明全覆盖：`fn/extern fn/const/val/var/struct/type/import/macro`
- [ ] 函数签名全覆盖：参数、返回、`uses`、属性、别名绑定
- [ ] 语句全覆盖：赋值、多返回赋值、标签、`goto`、`if (...) goto (...)`
- [ ] 表达式全覆盖：调用、`as`、地址、内存访问、字段访问、运算符优先级
- [ ] 宏调用与宏声明（先解析形态，语义后置）
- [ ] FFI/变参语法（`...`）解析
- [ ] 函数指针类型与类型表达式完整解析
- [ ] 条件编译属性节点（`cfg/cfg_attr`）解析
- [ ] Native-Strict x86 专属语法（`lea[...]`、限制式写法）解析
- [ ] Loose 模式语法节点（if/while/for）解析 --- 先不做

## 1.3 AST 契约与兼容性

- [ ] AST 节点字段完整对齐文档章节
- [ ] AST schema 版本化（避免后续 breaking 影响工具链）
- [ ] AST 打印器稳定化（snapshot 友好）
- [ ] AST visitor 能覆盖所有节点分支

## 1.4 解析器测试矩阵

- [ ] 每个章节至少 1 个 parser fixture
- [ ] `docs/` 示例自动抽取并跑 parse smoke test
- [ ] 负例测试（缺失 `uses`、类型不匹配、非法别名等）
- [ ] 错误恢复路径测试（解析不中断）

## 1.5 验收标准（目标一）

- [ ] `docs/std-strict` 全部示例可 parse 成 AST
- [ ] `docs/native-strict/x86` 全部示例可 parse 成 AST
- [ ] parser 对未实现语法不再返回通用 `E2999`

---

## 2. 目标二：能编译到 x86-strict，并最终生成可执行文件

## 2.1 语义分析补全

- [ ] 符号表与作用域（模块、函数、局部）
- [ ] 类型系统规则全量实现（含指针、函数指针、转换）
- [ ] 别名语义完整实现（文件/签名/函数体层级）
- [ ] Dreg 类型流与合并点检查完整实现
- [ ] ABI 合规检查（Std-Strict + Native-Strict x86）
- [ ] 模式守卫补全（`.ap/.x86.ap/.apo`）

## 2.2 Lowering 与中间表示（IR）

- [ ] 设计可执行的 IR 指令集（非 stub）
- [ ] AST -> IR lowering（含控制流、调用、内存、返回）
- [ ] IR 验证器（基本块、终结指令、类型一致性）

## 2.3 x86-strict 代码生成

- [ ] 指令选择（两操作数约束、lea、mul/div 固定槽）
- [ ] 调用约定映射（System V AMD64）
- [ ] 寄存器分配（先线性扫描，再优化）
- [ ] spill/reload 与栈帧管理
- [ ] 文本汇编输出（`.s`）

## 2.4 产物链路（可执行）

- [ ] 路径 A：调用系统汇编器/链接器（`clang/gcc/ld`）产出可执行
- [ ] 路径 B：内置最小对象文件生成 + 链接（后续可选）
- [ ] `aperio build --emit asm|obj|exe` 统一接口
- [ ] 跨平台行为定义（Windows/Linux 至少一种先稳定）

## 2.5 验收标准（目标二）

- [ ] `hello.ap` -> `.s` -> 可执行 -> 正确退出码
- [ ] 至少 3 个综合样例可执行（含函数调用、内存访问、分支）
- [ ] Native-Strict x86 示例可通过完整链路

---

## 3. 目标三：语法糖处理层（Desugar Layer）

> 你提到的 `alias`、调用便捷写法等，建议单独建 “Desugar/Lowering Front Layer”，和 parser/semantic 解耦。

## 3.1 设计与边界

- [ ] 定义“核心语法”与“语法糖语法”的边界
- [ ] 新增 Desugar AST Pass（AST in -> AST out）
- [ ] 每条语法糖提供可追踪映射（便于报错与调试）

## 3.2 首批语法糖候选

- [ ] alias 语法降级为显式槽引用元数据
- [ ] 命名参数调用统一降级为位置化内部表示
- [ ] 多返回赋值规范化（如除法双返回）
- [ ] 宏调用前的预规范化（仅语法形态）

## 3.3 与 Rust 的实现思路对齐（工程方式，不抄语义）

- [ ] Parser 生成“接近用户书写”的 AST
- [ ] HIR-like 中间层承接 desugar（Aperio 可命名 `MIR-front`）
- [ ] Type-check 以后再进后端 IR（错误定位更友好）

## 3.4 验收标准（目标三）

- [ ] `--dump-ast` 与 `--dump-desugared` 均可输出
- [ ] desugar 前后语义一致性测试通过
- [ ] 报错位置仍映射到原源码（非糖后代码）

---

## 4. 目标四：转 LLVM IR

## 4.1 路线确认（当前建议）

- [ ] 输出 LLVM IR（Aperio -> LLVM IR）作为后端选项
- [ ] 可选输入 LLVM IR（LLVM IR -> Aperio IR）作为互操作扩展

## 4.2 Aperio -> LLVM IR

- [ ] 类型映射表（Aperio 类型 -> LLVM 类型）
- [ ] 控制流与 SSA 构建
- [ ] 调用约定与外部符号映射
- [ ] 内存与指针语义映射
- [ ] 内置函数/原语映射到 LLVM intrinsics

## 4.3 LLVM IR -> Aperio（可选后置）

- [ ] 解析 `.ll` 子集
- [ ] lowering 到 Aperio IR
- [ ] 不支持项清单（EH/coroutine/GC/vector intrinsics 等）

## 4.4 验收标准（目标四）

- [ ] `aperio build --emit llvm-ir` 输出可被 `llc/clang` 接受
- [ ] 至少 2 个样例经 LLVM 工具链生成可执行
- [ ] 诊断编号段 `E8xxx` 正式接入

---

## 5. 工程化与可维护性（贯穿全程）

- [ ] 多包架构最终收敛：`core/cli/fmt/linter/fixer/pkg/codegen-x86` 各自边界清晰
- [ ] 公共 API 稳定层（避免跨包随意互引）
- [ ] 文档自动校验（章节示例可执行/可解析）
- [ ] 性能基线（lexer/parser/codegen 基准）
- [ ] release 流程（版本号、changelog、artifact）

---

## 6. 推荐执行顺序（建议）

1. 先做目标一（parse 全覆盖）  
2. 并行铺目标三（desugar 层最小骨架）  
3. 再做目标二（真实 codegen + 可执行产物）  
4. 最后做目标四（LLVM IR 输出，再考虑 LLVM IR 输入）

---

## 7. 立即下一步（我建议）

- [ ] 本周：把 `parser` 从“最小子集”推进到 `12_functions + 11_control_flow + 05_registers(alias)` 章节可解析
- [ ] 同步新增对应 fixtures 与快照
- [ ] 消灭通用 `E2999`，替换成精确语法错误
