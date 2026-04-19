# Aperio 包管理器

Go-style 去中心化 + MVS + TOML 清单——一句话总结：**一个 Git 仓库就是一个包，URL 就是它的全局身份，版本就是 Git ref**。

## 快速导航

- [01. 概述](./01_overview.md) —— 设计哲学、与 Cargo/npm/Go 的对比、适用人群
- [02. aperio.toml（清单）](./02_manifest.md) —— TOML schema、`[package]` / `[deps]` / `[build]` 全字段
- [03. 版本表达式](./03_versions.md) —— semver tag / commit / branch / @latest 的语义与优先级
- [04. 解析与 import](./04_resolution.md) —— MVS 算法、`import "..."` 路径解析规则、冲突处理
- [05. aperio.lock（锁文件）](./05_lockfile.md) —— 格式、何时重算、`--locked` / `--offline` / `--frozen`
- [06. 缓存与 vendoring](./06_cache.md) —— `~/.aperio/pkg/` 布局、内容寻址、`aperio vendor`
- [07. CLI 用法](./07_cli.md) —— `init` / `add` / `remove` / `update` / `fetch` / `vendor` / `tree` / `cache`
- [08. 发布一个包](./08_publishing.md) —— `git tag v1.0.0 && git push`，就这样
- [09. 标准库的特殊地位](./09_stdlib.md) —— `std/*` 为什么不在 `[deps]` 里

## 一页纸速览

```toml
# aperio.toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2026"

[deps]
json = "github.com/aperio-lang/json@v1.4.0"
http = "github.com/aperio-lang/http@v2.0.0"
```

```rust
// main.ap
import "std/io" as io
import "json" as j
import "http" as h

pub fn main() -> (r0: i32) {
    // ...
}
```

```bash
aperio add github.com/aperio-lang/log@v2.0.0      # 加依赖
aperio check                                       # 跑完整检查
aperio build --locked                              # CI 风格构建
```

## 实现状态

**v1（当前编译器 skeleton）**：

- 所有清单 / 锁文件 / CLI 的语义**已钉死**（就是你在看的这些文档）
- 类型骨架已在 `aperio/src/pkg/` 预留（`manifest.ts` / `lock.ts` / `resolver.ts` / `fetcher.ts`）
- 所有 `aperio init / add / remove / update / fetch / vendor / tree / cache` 命令在 CLI 层占位，打印 `not yet implemented`
- stdlib 的 `import "std/*"` 解析**已可用**
- 第三方包 import 会返回 `E5003 unknown package`——因为解析器还没实现

**v2+**：

- TOML 解析器接入
- `git clone --mirror` + `git archive` 实现 fetcher
- MVS 算法实现
- SHA-256 校验和生成
- `aperio vendor` / `--locked` / `--offline` / `--frozen` 三把锁生效

详细路线图见根目录 `ARCHITECTURE.md` 的《Package manager roadmap》节。

## 决策锁定（历史记录）

这些决策在文档写作时已经敲定，后面的实现不要轻易推翻。若要改，先改文档再改代码：

| 决策 | 锁定值 | 章节 |
|------|--------|------|
| 分发模型 | Go-style 去中心化 | [01](./01_overview.md) |
| 版本选择 | MVS（Minimum Version Selection） | [04](./04_resolution.md) |
| 清单格式 | TOML | [02](./02_manifest.md) |
| 锁文件 | `aperio.lock`，提交进仓库 | [05](./05_lockfile.md) |
| stdlib | 随编译器打包，不在 `[deps]` | [09](./09_stdlib.md) |
| 缓存 | 全局 `~/.aperio/pkg/`，只读、内容寻址 | [06](./06_cache.md) |
| workspace | v1 不支持 | — |
| 认证 | 委托给 git，不自己做 | [06](./06_cache.md), [08](./08_publishing.md) |
