# 08. 发布一个包

"发布"在 Aperio 里就是**一个 `git push`**。没有 `aperio publish`、没有账号注册、没有审核队列。你只需要：

1. 让仓库可被别人 clone（公开 → GitHub/GitLab，私有 → 企业 Git 服务器）
2. 在仓库根放一个合法的 `aperio.toml`
3. 打一个 `v*` tag，推到远端

别人在自己的 `aperio.toml` 里写 `github.com/<你>/<包>@v1.0.0`，就能用了。

## 最小发布流程

### 1. 准备仓库布局

```
mypkg/
├── aperio.toml
├── README.md
├── LICENSE
├── main.ap          # 或 src/main.ap
└── src/
    └── impl.ap
```

`aperio.toml`：

```toml
[package]
name        = "mypkg"
version     = "0.1.0"
edition     = "2026"
description = "A short description."
license     = "MIT"
repository  = "https://github.com/you/mypkg"
```

### 2. 打 tag

```bash
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

### 3. 通知消费方

告诉用户：

```toml
[deps]
mypkg = "github.com/you/mypkg@v0.1.0"
```

结束。

## 版本号约定

### SemVer 2.0 是硬性约定

- **MAJOR**：不兼容的 API 变更
- **MINOR**：向后兼容的功能新增
- **PATCH**：向后兼容的 bug 修复

Aperio 的 MVS 算法**依赖**这个约定——破坏 semver 约定，下游的构建就会坏掉。

### 0.x 的特殊地位

SemVer 规定 `0.x` 被视为"开发期"——`0.1.0` → `0.2.0` 允许破坏兼容。但 MVS **仍然把 `0.x` 当成不同 MAJOR 处理**：`0.1.5` 不会自动升到 `0.2.0`。

实战建议：

- `0.x` 仅用于不打算对外承诺 API 的早期 prototype
- 愿意对外承诺就直接 `v1.0.0`，这比长期停留在 `0.x` 清晰

### 如何打破兼容

发一个 major：

```bash
# v1.4.0 → v2.0.0
git tag v2.0.0
git push --tags
```

下游要主动把自己的 `aperio.toml` 里 `@v1.x.x` 改成 `@v2.0.0` 才会升上来——MVS 不会偷偷把 major 拉过去。这就是 MVS 相对 semver-range solver 的核心优势：破坏性升级**总是显式的**。

## 包命名约定

`aperio.toml` 的 `name` 字段只能包含 `[a-z0-9_-]` 且首字符为字母。额外建议：

- **短**：`json` 优于 `json-library-for-aperio`
- **描述性**：`http` 优于 `ymh`
- **避免冲突**：想拿个好名字就去 GitHub 看看有没有被别的 Aperio 包占用

**没有全局唯一性保证**——`github.com/a/json` 和 `github.com/b/json` 可以共存，因为 Aperio 的身份标识是**仓库 URL 而非 `name` 字段**。`name` 仅用于清单内的本地短名默认值。

## 仓库 URL 就是身份

这是 Aperio（和 Go）的核心选择：

- 你的包的**全局身份** = 它的 Git URL
- 换仓库 = 换包（即使内容一模一样）
- 迁移方案：保留旧仓库可访问，在 README 指引用户迁到新 URL 并重发 `@v1.0.0`

### 代价

- 不像 npm 的 `foo` 这样"一个短名一辈子"——包名总带 host 前缀
- 仓库一旦被删（account deleted），所有下游都崩

### 好处

- 没有中心化的"名字注册冲突"
- 企业内部可以直接复制这套模型到私有 Git 服务器

### 迁移建议

如果你想从 `github.com/old/pkg` 迁到 `github.com/new/pkg`：

1. 在**新**仓库发 `v1.0.0`（重置版本号，因为身份变了）
2. 在**旧**仓库的 `README.md` 顶部加"已迁移到 X"
3. 在旧仓库发一个新 tag `v999.0.0`（一个永远不会被 MVS 选中的"锚版本"），tag 指向一个仅含 "已废弃" 字样的 commit——`@v999.0.0` 被误依赖时会 catastrophic fail，提示用户换包

没有"官方注销"机制。

## README 必备内容

一个 Aperio 包的 README 应该包含：

```markdown
# <pkg-name>

一句话描述。

## Install

```toml
[deps]
<pkg> = "github.com/<you>/<pkg>@v<latest>"
```

## Usage

```rust
import "<pkg>" as p
// 最小示例
```

## MSRV (Minimum Supported Aperio Version)

- edition = "2026"
- aperio ≥ 0.8.0

## License

MIT / Apache-2.0 / etc.
```

"**最小示例**"是消费方决定是否尝试的关键——务必能复制粘贴跑。

## 私有仓库

私有包的发布流程**完全相同**：

```bash
git tag v1.0.0
git push origin v1.0.0
```

消费方：

```toml
[deps]
internal = "git.internal.corp/infra/rpc@v1.0.0"
```

确保：

- 消费方机器有访问该 Git 服务器的凭证（SSH key / HTTPS token）——Aperio 委托给 git
- Git 服务器支持 `git archive` 或浅 clone 按 ref

大多数私有 Git 服务器（GitLab、Gitea、Bitbucket）都支持。

## 废弃一个版本

Aperio **不提供** `yank` 机制。想"废弃"一个已发的版本：

- **发修复版**是首选：`v1.0.0` 有 bug → 立即发 `v1.0.1`；MVS 会让下游至少升到 `v1.0.1`
- **真的要"拉回"**：删掉那个 git tag
  ```bash
  git push origin :refs/tags/v1.0.0
  ```
  已经 fetch 过的下游**不受影响**（lock 里记了 commit sha，不依赖 tag）。但新项目第一次解析时会找不到该 tag → `E9204 tag not found`

  这是**不可逆的用户体验破坏**——慎用。

## 一些约定俗成的最佳实践

- **打 tag 后不要改**——`git tag -f v1.0.0` 指向新 commit 会触发下游的 `E9304 checksum mismatch`
- **tag 消息**用 `git tag -a v1.0.0 -m "..."`，annotated tag 比 lightweight tag 更语义化
- **发 release notes** 用 GitHub Releases / GitLab Releases——Aperio 不管你怎么写，但消费方会感谢你
- **预发布版**用 `v1.0.0-beta.1` / `v1.0.0-rc.1`——MVS 不会把它们当正式版选（见 [03. 版本表达式](./03_versions.md#pre-release-的特殊处理)）
- **`CHANGELOG.md`** 在仓库里用 Keep a Changelog 格式——社区已经习惯，不用重新发明

## 生态早期的小技巧

Aperio 生态还在起步期，以下几条能帮到你：

- **用 GitHub Topic `aperio`** 让别人能搜到你
- **把示例放在 `examples/`**——消费方验证能编译通过的最快途径
- **公布 MSRV**：你能在哪个版本的 Aperio 下编译，明确写出来；编译器每个 release 都会列出 breaking changes
- **不要怕 0.x 发 major**：`0.x` 时代快速迭代 API 比虚假的"稳定性"更重要
