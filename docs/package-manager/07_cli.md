# 07. CLI 用法

包管理相关的子命令都挂在 `aperio` 下。本章是命令参考。

每个命令都遵循统一约定：

- `--help` / `-h` 打印帮助
- `--format=human|json|lsp` 选诊断格式（默认 `human`）
- 任何错误都输出到 stderr；成功的业务输出到 stdout
- 退出码：`0` 成功，`1` 业务错误，`2` 参数错误，`64-78` 预留给未来

## `aperio init`

初始化一个新项目，生成骨架。

```bash
aperio init                         # 当前目录初始化
aperio init mypkg                   # 创建 mypkg/ 目录并初始化
aperio init --name mypkg            # 指定包名（默认取目录名）
aperio init --lib                   # 库模板（无 main.ap，带 src/）
aperio init --bin                   # 应用模板（默认，有 main.ap）
```

生成物：

```
mypkg/
├── aperio.toml          # 填好的最小清单
├── .gitignore           # 含 /.aperio/, /vendor/ 等
├── README.md
└── main.ap              # --bin 模板
```

## `aperio add`

给 `aperio.toml` 的 `[deps]` 加一条依赖，并更新 lock。

```bash
aperio add <pkg>@<version> [flags]
```

示例：

```bash
aperio add github.com/aperio-lang/json@v1.4.0
aperio add github.com/foo/bar@main
aperio add github.com/foo/bar@a1b2c3d4
```

自动选短名（最后一段 path）：

```bash
aperio add github.com/aperio-lang/json@v1.4.0
# 清单里写入：json = "github.com/aperio-lang/json@v1.4.0"
```

自定义短名：

```bash
aperio add github.com/aperio-lang/json@v1.4.0 --as j
# 清单里写入：j = "github.com/aperio-lang/json@v1.4.0"
```

展开形式（带 subdir）：

```bash
aperio add github.com/big/monorepo@v3.0.0 --as io --subdir packages/io
# 写入：
#   [deps.io]
#   source  = "github.com/big/monorepo"
#   version = "v3.0.0"
#   subdir  = "packages/io"
```

标志：

| 标志 | 作用 |
|------|------|
| `--as <name>` | 自定义清单里的短名 |
| `--subdir <path>` | 仓库内子目录，强制展开形式 |
| `--no-fetch` | 只改清单，不立刻抓包（lock 会标为"陈旧"） |

## `aperio remove`

删依赖。

```bash
aperio remove <name>
aperio remove json
```

自动清理 lock 里**只被这个依赖传递**用到的条目。

## `aperio update`

重解依赖。

```bash
aperio update                     # 全量重算
aperio update <name>              # 只重算这条链
aperio update --pin               # 把所有 @latest / @<branch> 改写成具体 tag / commit
aperio update --dry-run           # 只打印会变什么，不写 lock
```

`--pin` 用途：

```bash
aperio init
aperio add github.com/foo/bar@latest
# ... 写了一些代码 ...
aperio update --pin
# aperio.toml 里 latest 变成具体 tag（比如 v1.2.3）
# main 变成具体 commit sha
```

## `aperio fetch`

只下载不编译——预热缓存。

```bash
aperio fetch                      # 按 lock 下载所有依赖
aperio fetch --all-versions       # 把 toml 历史引用过的版本也下载（配合 git bisect 有用）
```

典型场景：CI 机器启动时先跑一次 `aperio fetch`，后续 job 就能 `--offline` 构建。

## `aperio vendor`

把依赖搬进项目 `vendor/` 目录。

```bash
aperio vendor                     # 按 lock 复制
aperio vendor --check             # 检查 vendor/ 与 lock 一致
aperio vendor --prune             # 删除 lock 里不存在的条目
```

详细语义见 [06. 缓存与 vendoring](./06_cache.md)。

## `aperio tree`

打印依赖树。

```bash
aperio tree
```

输出示例：

```
myproj v0.1.0
├── json v1.4.0 (github.com/aperio-lang/json)
│   └── stringlib v0.3.0 (github.com/aperio-lang/stringlib)
└── http v2.0.0 (github.com/aperio-lang/http)
    └── stringlib v0.3.0 (github.com/aperio-lang/stringlib) *

(*) 表示条目已在上方出现，省略展开
```

标志：

| 标志 | 作用 |
|------|------|
| `--depth <n>` | 限制深度 |
| `--duplicates` | 只打印被多个链引用的条目 |
| `--package <name>` | 只打印某个包的子树 |
| `--format=json` | JSON 输出，方便脚本处理 |

## `aperio cache`

管理全局缓存。

```bash
aperio cache size                 # 打印占用
aperio cache gc                   # 删除 90 天未用的
aperio cache clean                # 全删
aperio cache path                 # 打印 ~/.aperio 位置
```

## `aperio build`

编译。和上面的包管理命令相关的构建选项：

```bash
aperio build                      # 默认：按 toml 必要时解析，然后编译
aperio build --locked             # 严格按 lock；toml 与 lock 不一致报错
aperio build --offline            # 不联网
aperio build --frozen             # --locked + --offline
```

其他构建选项（`--target`、`--out` 等）见编译器主文档，与包管理无关。

## `aperio check`

语义检查，不产出二进制。和 `build` 一样接受 `--locked` / `--offline` / `--frozen`。

```bash
aperio check                      # 跑所有 pass
aperio check main.ap              # 只检查一个文件（仍需完整依赖解析）
```

## 全局标志

所有命令共享：

| 标志 | 作用 |
|------|------|
| `--help` / `-h` | 打印帮助 |
| `--version` / `-V` | 打印版本 |
| `--manifest <path>` | 指定 `aperio.toml` 位置（默认当前目录往上找） |
| `--format <fmt>` | 诊断格式：`human`、`json`、`lsp` |
| `-q` / `--quiet` | 只输出错误 |
| `-v` / `--verbose` | 详细日志；重复加 `-vv` 更详细 |

## 环境变量

| 变量 | 默认 | 用途 |
|------|------|------|
| `APERIO_HOME`   | `~/.aperio` | 全局配置和缓存的根目录 |
| `APERIO_OFFLINE`| 未设置 | 设为非空时等价于每个命令加 `--offline` |
| `APERIO_LOCKED` | 未设置 | 等价于 `--locked` |
| `NO_COLOR`      | 未设置 | 非空时禁用彩色输出 |
| `APERIO_LOG`    | 未设置 | 形如 `debug,fetch=trace`；调试用 |

## 一个典型工作流

```bash
# 起步
aperio init mypkg && cd mypkg
aperio add github.com/aperio-lang/json@v1.4.0
aperio add github.com/aperio-lang/http@v2.0.0

# 开发
aperio check            # 频繁跑，看有没有编译错
aperio build

# 升级某个依赖
aperio update json      # 只动 json 那条链
aperio tree             # 看看变化

# 准备发布
aperio vendor           # 把依赖搬进仓库
git add .
git commit -m "prepare release"
git tag v0.2.0
git push && git push --tags
```
