# 03. 版本表达式

依赖声明里 `@` 后面的那一串是**版本表达式**。支持四种形式，按可重现性从高到低排列。

## 四种版本表达式

### 1. 语义版本 tag——`@vX.Y.Z`

```toml
json = "github.com/aperio-lang/json@v1.4.0"
```

- 必须以 `v` 开头（匹配 Git 约定：`git tag v1.4.0`）
- 紧跟合法 semver 2.0：`v1.4.0`、`v1.4.0-beta.1`、`v1.4.0+build.5`
- 解析时：去远端仓库找对应 tag，读它指向的 commit，再做校验和

**这是生产代码首选。** 它是人类可读的（`v1.4.0` 显然比 `a1b2c3d4` 有意义），同时 MVS 算法专门针对 semver 做了比较规则。

### 2. Commit SHA——`@<sha>`

```toml
pinned = "github.com/foo/bar@a1b2c3d4"
```

- 可以是短 sha（至少 7 位）或完整 40 位 sha
- 解析时：直接去远端 `git fetch` 这个 commit

**用途**：

- 依赖还没打 tag（早期项目）
- 需要固定到某个未发布的修复
- tag 被作者篡改过，你不信任

**代价**：

- 不参与 semver 比较——MVS 看到 commit sha 就把它当成一个"独立版本轨道"，不会自动升
- 人类可读性差

### 3. 分支——`@<branch>`

```toml
fresh = "github.com/foo/bar@main"
```

- 解析时：去远端读 `refs/heads/<branch>` 当前指向的 commit，写进 lock

**用途**：

- 开发期尝试游离版本
- 跟随某个"长期维护分支"

**代价**：

- 每次跑 `aperio update` 都可能拉到不同 commit（因为分支在动）
- lock 文件里记的是"当时那一刻的 commit sha"，下次更新会覆盖
- **CI / 生产构建应避免使用分支依赖**

### 4. 最新——`@latest`

```toml
bleeding = "github.com/foo/bar@latest"
```

- 解析时：读远端所有 tag，选出最大的 semver tag
- **禁止进入 `aperio.lock`**——lock 里会被替换成具体 tag 或 commit

**用途**：

- 脚手架命令 `aperio init` 初始化项目时用
- 临时实验新包

**建议**：不要在长期维护的项目里用 `@latest`。写完 `aperio add foo` 后立即跑 `aperio update --pin` 把它换成具体版本。

## 解析优先级

当一个表达式同时能匹配多种解释（比如 `@v1`——既像分支名又像 tag 前缀），解析器按这个优先级：

1. 先尝试作为**完整 semver tag**（`v1.4.0` 匹配，`v1` 不匹配）
2. 再尝试作为**commit SHA**（要求纯十六进制 + 长度 ≥ 7）
3. 最后尝试作为**分支名**（`main` / `develop` / `v1`）

`@latest` 是一个保留关键字，不会被任何其他解释吞掉。

## semver 比较规则

遵循 [semver.org 2.0](https://semver.org/spec/v2.0.0.html)：

```
v1.0.0 < v1.0.1 < v1.1.0 < v2.0.0
v1.0.0-alpha < v1.0.0-alpha.1 < v1.0.0-beta < v1.0.0
v1.0.0+build1 == v1.0.0+build2      # build 元数据不参与比较
```

关键点：

- **pre-release 小于正式版**：`v1.0.0-beta < v1.0.0`
- **pre-release 之间按 ASCII 比较**：`-alpha < -beta`
- **build metadata 不影响比较**：`v1.0.0+x` 和 `v1.0.0+y` 相等，但它们各自锁的 commit 不一样

MVS 取 `>=` 下界的最大值时，严格按上面的比较规则。

## Pre-release 的特殊处理

默认情况下，MVS **不会**自动把 pre-release 选为传递依赖的解。你必须**显式**声明对 pre-release 的依赖才会被选上：

```toml
[deps]
# 显式写 pre-release，OK
experimental = "github.com/foo/bar@v2.0.0-beta.3"

# 只写 v1.x 的其他包即便其依赖声明了 >= v2.0.0-beta.3，也不会被自动升到 beta
```

这和 Cargo 的行为一致——pre-release 必须**有人负责**才能进锁文件。

## 版本约束？—— MVS 里没有

**Aperio 的 `[deps]` 不支持 `^`、`~`、`>=` 等约束语法。** 每条依赖只能声明一个**具体下界**，MVS 自己选最大值。

这和 Cargo / npm 不同，是 MVS 的本质特征。想要的效果可以通过组合达成：

- 想要"至少 1.4.0"：直接写 `@v1.4.0`，MVS 会自动选到更高的兼容版本（如果其他传递依赖要求更高）
- 想要"精确 1.4.0"：写 `@v1.4.0`，再在 CI 里跑 `aperio build --locked`
- 想要"小于 2.0.0"：发现被传递依赖拉到了 2.x → 手动在 `[deps]` 里压到 `@v1.x.x`，MVS 会把它作为新下界

详细的 MVS 解析见 [04. 解析与 import](./04_resolution.md)。

## 例子汇总

```toml
[deps]
stable   = "github.com/a/b@v1.4.0"           # semver tag，首选
frozen   = "github.com/c/d@a1b2c3d4"         # 短 commit sha
exact    = "github.com/c/d@a1b2c3d4e5f6789a" # 长 commit sha
tracking = "github.com/e/f@main"             # 分支（开发用，生产慎用）
lucky    = "github.com/g/h@latest"           # 最新 tag，禁止进 lock
prerel   = "github.com/i/j@v2.0.0-beta.3"    # 显式 pre-release
```
