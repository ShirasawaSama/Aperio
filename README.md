# Aperio Workspace

Aperio 项目的工作区根目录，使用 **npm + ESM-only + 最新 TypeScript**。

## 目录

- `docs/`：语言与包管理器文档
- `packages/aperio/`：编译器实现（当前唯一包）

## 快速开始

```bash
npm install
npm run build
npm run test
npm run aperio -- check
```

## 技术约束

- 模块系统：ESM only
- TypeScript：最新稳定版
- 目标语法：`ESNext`
- 包管理设计：Go-style（VCS 直连 + MVS），详见 `docs/package-manager/`
