# 01. 概述

Aperio 的包管理器负责三件事：

1. 在 `aperio.toml` 里声明项目依赖哪些第三方代码
2. 把依赖从远端 VCS（Git）抓下来、缓存、校验
3. 把 `import "pkgname/..."` 解析到具体的源文件

它不做注册中心、不做中心化版本审核、不做 token 托管——这些都外包给**Git 本身**。

## 设计哲学：Go-style 去中心化

Aperio 选择和 Go Modules 一致的路线：

- **仓库即包**：一个 Git 仓库就是一个包，URL 就是它的全局身份
- **无中心 registry**：不需要 publish、不需要账号、不需要审核
- **版本即 Git ref**：Git tag / branch / commit hash 都能当版本
- **解析算法是 MVS**（Minimum Version Selection）：可预测、线性升级、不会意外装上最新版

这意味着一个 Aperio 包的"发布流程"就是：

```bash
git tag v1.2.3
git push origin v1.2.3
```

没有 `aperio publish`。

## 和其他语言的对比

| 语言/工具 | 分发模型 | 版本算法 | 需要 registry | 发布流程 |
|-----------|----------|----------|---------------|----------|
| **Aperio**    | VCS 直连         | MVS                     | 不需要 | `git push` |
| **Go Modules**| VCS 直连 + 可选代理 | MVS                     | 可选（proxy.golang.org） | `git push` |
| **Cargo**     | 中心化 registry  | SAT solver（semver）    | 需要（crates.io） | `cargo publish` |
| **npm**       | 中心化 registry  | semver 范围 + 最新匹配  | 需要（registry.npmjs.org） | `npm publish` |
| **pip**       | 中心化 registry  | 回溯式 solver           | 需要（PyPI） | `twine upload` |

Aperio 站在 Go 这一侧的主要理由：

- **零基础设施成本**——作为新语言，不需要维护注册中心就能发社区包
- **升级路径可预测**——MVS 保证你不改 `aperio.toml` 就不会装上新版本
- **私有仓库友好**——企业内部 GitLab / Gitea 等天然能用，不用额外搭 registry

## 适用人群

这个设计适合：

- **语言早期生态**——等社区自然生长，按需再加中心化
- **企业内部项目**——私有 Git 服务器零配置可用
- **注重可重现构建的项目**——MVS + lockfile 保证同一份源码到手后编译出来字节一致

如果你习惯 npm 那种"每天跑 `npm update` 拿最新版本"的开发方式，Aperio 的 MVS 会让你一开始觉得有点保守——但你会在半年后感谢这个选择，因为不会有某天早上"昨天能跑今天崩了"。

## 快速一瞥

一个最小项目长这样：

```
myproj/
├── aperio.toml      ← 声明依赖
├── aperio.lock      ← 固化版本（提交进版本库）
├── main.ap
└── src/
    └── handler.ap
```

`aperio.toml`：

```toml
[package]
name = "myproj"
version = "0.1.0"
edition = "2026"

[deps]
json = "github.com/aperio-lang/json@v1.4.0"
```

源码里：

```rust
import "std/io" as io
import "json" as j      // 短名，查 [deps] 表

pub fn main() -> (r0: i32) {
    // ...
}
```

后续章节把上面出现的每个概念拆开讲清楚。

## 章节导航

- [02. aperio.toml（清单）](./02_manifest.md)
- [03. 版本表达式](./03_versions.md)
- [04. 解析与 import](./04_resolution.md)
- [05. aperio.lock（锁文件）](./05_lockfile.md)
- [06. 缓存与 vendoring](./06_cache.md)
- [07. CLI 用法](./07_cli.md)
- [08. 发布一个包](./08_publishing.md)
- [09. 标准库的特殊地位](./09_stdlib.md)
