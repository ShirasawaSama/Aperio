# 06. 缓存与 vendoring

Aperio 把抓下来的依赖缓存在**全局目录**里、在多个项目间共享。需要完全离线或独立分发时，可以把缓存"固化"到项目内的 `vendor/` 目录。

## 全局缓存：`~/.aperio/`

```
~/.aperio/
├── config.toml              ← 全局配置（代理、auth、默认 target）
├── git/                     ← bare git 镜像，用来加速后续 fetch
│   └── github.com/
│       └── aperio-lang/
│           └── json.git/
└── pkg/                     ← 已解包的"包内容"，按版本一份
    └── github.com/
        └── aperio-lang/
            └── json/
                ├── @v1.3.0/
                ├── @v1.4.0/
                └── @8f3a2c1b.../
```

Windows 上的等价位置：`%USERPROFILE%\.aperio\`。

可用环境变量 `APERIO_HOME` 覆盖。

### `git/` 目录

`git clone --mirror` 下来的 bare 仓库。用途：

- 同一个仓库被多个版本（多个 tag）引用时，`git archive` 从本地 bare 即可，不重新 clone
- 切到新 tag / commit 只需 `git fetch`，带宽友好

这个目录**不直接参与编译**——编译器读的是 `pkg/` 下解包后的文件。

### `pkg/` 目录

每个 `<host>/<path>/@<version>/` 子目录是一次 `git archive` 的结果——拷出仓库在该 commit 时的快照，解包到磁盘，然后**置为只读**。

为什么只读：

- 保证"lock 里记的 checksum 就是磁盘上的字节"
- 防止某个项目意外修改缓存影响其他项目
- 让校验失败时能立刻察觉

如果你手动改了只读文件导致校验失败，下次构建会报 `E9304 checksum mismatch`——删掉对应目录重新跑 `aperio fetch` 即可。

## 校验和的生成规则

给一个缓存条目算 checksum 的步骤：

1. `git archive` 抽出那个 commit 的 tree（不含 `.git/` 历史）
2. 按文件路径排序
3. 对每个文件：`"<relative-path>\0<file-size>\0<file-bytes>"` 顺序拼接
4. 对拼接后的字节流算 `SHA-256`
5. 加前缀 `sha256:` 写入 lock

这个规则的关键是**独立于 git**——即使源头从 GitHub 迁到 GitLab，只要内容字节一致，checksum 就一致。

## 内容寻址的好处

- 同一 commit 被多个依赖方引用 → 磁盘上只存一份
- 删除缓存无成本：缺什么 `aperio fetch` 按需拉回来
- 备份只需备份 `~/.aperio/pkg/`，不需要备份 `.git/`（虽然带上 `git/` 恢复会更快）

## 项目级目录：`.aperio/`

项目根下会有一个轻量的 `.aperio/` 目录（**要加到 `.gitignore`**）：

```
myproj/
├── aperio.toml
├── aperio.lock
├── .aperio/
│   ├── index.json       ← lock 条目到全局缓存路径的映射
│   └── metadata/        ← 各种中间产物
```

`.aperio/` 不含任何包源码——只是一张映射表，告诉编译器"`json@v1.4.0` 去 `~/.aperio/pkg/github.com/aperio-lang/json/@v1.4.0/` 拿"。

## vendoring：把依赖搬进项目

`aperio vendor` 把 lock 里所有依赖**复制**到项目内的 `vendor/` 目录：

```
myproj/
├── aperio.toml
├── aperio.lock
└── vendor/
    ├── github.com/
    │   └── aperio-lang/
    │       └── json/
    │           └── @v1.4.0/
    │               └── ...（包源码）
    └── ...
```

之后编译器优先从 `vendor/` 读取，完全不碰全局缓存、不联网。

### 什么时候用 vendoring

- **彻底离线构建**：你想把 tarball 发给一个不能联网的环境
- **审计需求**：把依赖源码和项目一起打包 review
- **长期归档**：十年后全局缓存可能没了，但 `vendor/` 还在
- **绕过 `~/.aperio/` 权限问题**：某些 CI runner 不让写 home 目录

### vendoring 的代价

- 仓库体积变大（所有依赖源码都进 git）
- 每次升级依赖要跑 `aperio vendor` 重新覆盖
- 跨项目不再共享缓存

这是一个**显式选择**——没启用 `aperio vendor` 就不会自动有 `vendor/` 目录。

### `aperio vendor` 的选项

```bash
aperio vendor                    # 按当前 lock 复制
aperio vendor --check            # 检查 vendor/ 是否与 lock 一致
aperio vendor --prune            # 删除 lock 里已经不存在的条目
```

### 构建时自动检测

编译器按这个顺序查找依赖源码：

1. 如果项目根有 `vendor/<host>/<path>/@<version>/` → 用它
2. 否则查 `.aperio/index.json` 指向的全局缓存
3. 全都没有 → `E9303 missing from cache`（带 `aperio fetch` 建议）

## 清理缓存

全局缓存不会自动清理。手动命令：

```bash
aperio cache gc              # 删除超过 90 天未被任何 aperio.lock 引用的条目
aperio cache clean            # 删除全部（git/ 和 pkg/ 都清空）
aperio cache size             # 打印缓存占用
```

v1 里这些命令是占位——v2 实现 GC 时会跟踪"最后一次被哪条 lock 引用"。

## 代理与认证

通过 `~/.aperio/config.toml`：

```toml
[http]
proxy = "http://corp-proxy:8080"

[auth."git.internal.corp"]
# Aperio 不自己处理，委托给 git——只要你的 git 能 clone 就 OK
#
# 这里只能配一些 Aperio 特定的 knob，比如：
ssh_strict_host_key = true
```

认证的原则是**委托**：

- SSH key → 用户正常的 `~/.ssh/`
- HTTPS token → git credential helper
- 私有证书 → `GIT_SSL_CAINFO`

Aperio **不实现**自己的 auth 机制——你的 git 能 `clone` 就能用。

## 磁盘占用预估

典型项目的缓存规模（粗估）：

| 项目规模                 | `git/` | `pkg/` | 总计 |
|--------------------------|--------|--------|------|
| 小工具，5-10 个依赖      | 10-50 MB | 5-20 MB | < 100 MB |
| 中型应用，30-50 个依赖   | 200-500 MB | 50-200 MB | ~1 GB |
| 大型工程，100+ 个依赖    | 1-3 GB | 200-800 MB | 3-5 GB |

`git/` 占大头是因为 bare 镜像保留了完整历史。如果紧张磁盘，可以：

```bash
aperio cache gc --drop-git         # 只留 pkg/，下次需要时重 clone
```
