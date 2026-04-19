# 02. aperio.toml（清单）

每个 Aperio 项目根目录下有一个 `aperio.toml`，它是包管理器的唯一输入源。

## 格式：TOML

选 TOML 的理由简单粗暴——可读性好、支持注释、Cargo 已经把 TOML 的"项目清单"生态验证成熟了。不引入 YAML（歧义多）、不用 JSON（不能写注释）、不造自己的格式（没必要）。

文件里的键都是 `snake_case`，字符串用双引号。

## 最小骨架

```toml
[package]
name = "myproj"
version = "0.1.0"
edition = "2026"
```

三字段必填：

- `name`：包名。只能包含小写字母、数字、`-`、`_`，首字符必须是字母
- `version`：语义版本，遵循 semver 2.0（`MAJOR.MINOR.PATCH`，可选 `-prerelease` / `+build`）
- `edition`：语言版本。目前合法值只有 `"2026"`；未来做语法迁移时会引入 `"2027"` 等

## 完整 schema

```toml
# ─────────────────────────────────────────────
# 包本身的元数据
# ─────────────────────────────────────────────
[package]
name        = "myproj"
version     = "0.1.0"
edition     = "2026"
authors     = ["Alice <alice@example.com>"]    # 可选
description = "A short blurb."                 # 可选
license     = "MIT"                            # 可选，SPDX 标识符
repository  = "https://github.com/acme/myproj" # 可选，展示用

# ─────────────────────────────────────────────
# 依赖
# ─────────────────────────────────────────────
[deps]
# 短形式："host/path@version"
json   = "github.com/aperio-lang/json@v1.4.0"
fresh  = "github.com/foo/bar@main"
pinned = "github.com/foo/bar@a1b2c3d4"

# ─────────────────────────────────────────────
# 展开形式：一个 [deps.<name>] 子表
# ─────────────────────────────────────────────
[deps.renamed]
source  = "github.com/big/monorepo"
version = "v3.0.0"
subdir  = "packages/io"          # 仓库内子目录

# ─────────────────────────────────────────────
# 构建配置
# ─────────────────────────────────────────────
[build]
target     = "x86_64-linux-gnu"  # 默认目标三元组
entrypoint = "main.ap"           # 可选，默认就是项目根下的 main.ap
```

## `[package]` 字段详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name`        | string | 是 | 包名，匹配正则 `^[a-z][a-z0-9_-]*$` |
| `version`     | string | 是 | semver 2.0 |
| `edition`     | string | 是 | 语言版本 |
| `authors`     | string[] | 否 | 作者列表 |
| `description` | string | 否 | 一句话介绍 |
| `license`     | string | 否 | SPDX license identifier（如 `"MIT"`、`"Apache-2.0"`、`"MIT OR Apache-2.0"`） |
| `repository`  | string | 否 | 源码仓库 URL，仅展示用 |

## `[deps]` 两种写法

### 短形式（推荐）

键是**本项目内用的短名**，值是 `"host/path@version"`：

```toml
[deps]
json = "github.com/aperio-lang/json@v1.4.0"
```

源码里：

```rust
import "json" as j               // j::parse(...)
import "json/ast" as jast        // 访问仓库内子路径
```

### 展开形式

当需要指定 `subdir`（仓库内子目录）或以后要加更多字段时，改写成子表：

```toml
[deps.json]
source  = "github.com/aperio-lang/json"
version = "v1.4.0"
# subdir = "..."    # 如果整个仓库就是这个包，subdir 可以省略
```

短形式 `"host/path@version"` 完全等价于这个子表但没有 `subdir`。

## `subdir` 的用途

当一个 Git 仓库包含多个 Aperio 包（典型场景：组织把多个小库放同一个仓库）时：

```
github.com/big/monorepo/
├── packages/
│   ├── io/
│   │   ├── aperio.toml
│   │   └── src/...
│   └── http/
│       ├── aperio.toml
│       └── src/...
```

消费方用 `subdir` 挑出其中一个：

```toml
[deps.io]
source  = "github.com/big/monorepo"
version = "v3.0.0"
subdir  = "packages/io"

[deps.http]
source  = "github.com/big/monorepo"
version = "v3.0.0"
subdir  = "packages/http"
```

`io` 和 `http` 在源码里是两个独立的 `import` 别名：

```rust
import "io" as io
import "http" as http
```

它们共享同一个 `commit` 但解析到不同的子目录。

## `[build]` 字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `target`     | string | `"x86_64-linux-gnu"` | 默认编译目标；`aperio build --target=...` 可覆盖 |
| `entrypoint` | string | `"main.ap"`          | 入口文件 |

`[build]` 在 v1 里很薄，未来会扩到 `features`、`profile.release`、`profile.debug` 等 Cargo 风格的配置。

## 字段验证

编译器在加载 `aperio.toml` 时会检查：

- 未知字段 → `E9101 unknown key in aperio.toml`
- `name` 不满足命名规则 → `E9102 invalid package name`
- `version` 不是合法 semver → `E9103 invalid semver`
- `edition` 不是支持的版本 → `E9104 unsupported edition`
- `[deps]` 的键和 `[deps.*]` 子表冲突 → `E9105 duplicate dependency name`
- 短名与保留字冲突（`std`、`core`、`self`） → `E9106 reserved package name`

## 注释与格式约定

- 用 `#` 注释，放在字段正上方
- 字段顺序没强制，但建议 `[package]` → `[deps]` → `[build]`
- `aperio fmt --manifest` 会把清单重排成规范顺序（v2+ 功能）

## 例：一个典型应用项目

```toml
[package]
name = "web-server"
version = "0.3.1"
edition = "2026"
authors = ["Bob"]
description = "Aperio-based HTTP server demo"
license = "Apache-2.0"

[deps]
http    = "github.com/aperio-lang/http@v0.9.0"
json    = "github.com/aperio-lang/json@v1.4.0"
logger  = "github.com/aperio-lang/log@v2.0.0"

[deps.internal]
source  = "git.internal.corp/infra/aperio-rpc"
version = "v2.1.0"

[build]
target = "x86_64-linux-gnu"
```
