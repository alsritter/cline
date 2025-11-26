# Cline Fork - 构建与发布指南

> 本文档记录了 Cline Fork 项目的完整构建和发布流程

## 📋 项目信息

- **项目名称**: cline-fork
- **发布者**: alsritter
- **仓库地址**: https://github.com/alsritter/cline
- **扩展ID**: `alsritter.cline-fork`

## 🛠️ 开发环境准备

### 必需工具

```bash
# 1. 安装 Node.js (20.x)
node --version  # 确认版本

# 2. 安装 git-lfs（项目使用大文件存储）
brew install git-lfs
git lfs install

# 3. 克隆仓库
git clone https://github.com/alsritter/cline.git
cd cline
```

### 初始化项目

```bash
# 1. 安装所有依赖（包括主项目和 webview-ui）
npm run install:all

# 2. 生成 Protocol Buffer 文件（必须执行）
npm run protos

# 3. 格式化代码
npm run format:fix
```

## 🔨 开发流程

### 开发模式

```bash
# 方式1：完整开发模式（包含 protos 生成）
npm run dev

# 方式2：仅 watch 模式（protos 已生成）
npm run watch

# 方式3：使用 F5 调试
# 在 VSCode 中按 F5，会打开新的 VSCode 窗口加载插件
```

### 测试

```bash
# 运行所有测试
npm run test

# 运行 E2E 测试
npm run test:e2e

# 运行 webview 测试
npm run test:webview
```

### 代码格式化

```bash
# 自动修复格式问题
npm run format:fix

# 仅检查格式
npm run format
```

## 📦 构建流程

### 1. 开发版本构建

```bash
# 构建生产版本（不打包）
npm run package

# 输出目录：dist/
```

### 2. 打包为 .vsix 文件

```bash
# 方式1：使用 vsce 命令直接打包
npx vsce package

# 方式2：使用测试构建命令
npm run test:e2e:build

# 输出文件：cline-fork-1.0.0.vsix
```

### 3. 本地测试 .vsix

```bash
# 命令行安装
code --install-extension cline-fork-1.0.0.vsix

# 或在 VSCode 中：
# Extensions → 右上角 "..." → Install from VSIX
```

## 🚀 发布流程

### 方案 A：本地使用（无需发布）

直接安装 `.vsix` 文件到本地 VSCode：

```bash
# 1. 打包
npx vsce package

# 2. 安装
code --install-extension cline-fork-1.0.0.vsix

# 3. 重启 VSCode
```

### 方案 B：发布到 VS Marketplace

#### 前置准备

1. **注册 Azure DevOps 账号**
   - 访问：https://dev.azure.com/
   - 创建 organization

2. **创建 Personal Access Token (PAT)**
   - 进入 User Settings → Personal Access Tokens
   - 点击 "New Token"
   - 名称：`vsce-publish`
   - Organization：选择你的 org
   - Scopes：勾选 `Marketplace (Manage)`
   - 复制生成的 token（只显示一次）

3. **创建 Publisher**
   - 访问：https://marketplace.visualstudio.com/manage
   - 使用 Microsoft/GitHub 账号登录
   - Create Publisher
   - Publisher ID：`alsritter`（必须与 package.json 中一致）

#### 登录 vsce

```bash
# 首次登录
npx vsce login alsritter

# 输入 PAT token
# 成功后会保存凭证
```

#### 发布命令

```bash
# 1. 确保版本号已更新（package.json）
# 当前版本：1.0.0

# 2. 生成 changeset（如果是功能更新）
npm run changeset
# 选择变更类型：
# - patch (1.0.0 → 1.0.1) - 修复bug
# - minor (1.0.0 → 1.1.0) - 新功能
# - major (1.0.0 → 2.0.0) - 破坏性更新

# 3. 更新版本号
npm run version-packages

# 4. 发布到 Marketplace
npx vsce publish

# 或使用项目脚本（包含 ovsx 发布）
npm run publish:marketplace

# 发布预发布版
npm run publish:marketplace:prerelease
```

### 方案 C：分享 .vsix 文件

```bash
# 1. 打包
npx vsce package

# 2. 上传到 GitHub Releases
# 在 GitHub 仓库创建 Release，上传 .vsix 文件

# 3. 团队成员下载后安装
code --install-extension cline-fork-1.0.0.vsix
```

## 📝 版本管理

### Changeset 工作流

```bash
# 1. 开发新功能/修复bug

# 2. 创建 changeset
npm run changeset

# 3. 提交 changeset 文件
git add .changeset/
git commit -m "chore: add changeset"

# 4. 合并到 main 分支后，CI 会自动创建 Version Packages PR

# 5. 合并 Version Packages PR，自动发布新版本
```

### 手动更新版本

如果不使用 changeset：

```bash
# 编辑 package.json
"version": "1.0.1"

# 提交
git add package.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

## 🔧 常见问题

### 1. 依赖安装失败

```bash
# 清理缓存重新安装
rm -rf node_modules package-lock.json
rm -rf webview-ui/node_modules webview-ui/package-lock.json
npm run install:all
```

### 2. Protocol Buffer 错误

```bash
# 重新生成 proto 文件
npm run protos
```

### 3. vsce package 失败

```bash
# 检查是否缺少文件
npm run package

# 确保 dist/ 目录存在且有内容
ls -la dist/
```

### 4. 发布权限错误

```bash
# 重新登录
npx vsce logout
npx vsce login alsritter

# 确认 publisher 名称与 package.json 一致
```

### 5. 图标问题

```bash
# 确保图标文件存在
ls -la assets/icons/icon.png

# 图标规格：128x128 PNG
```

## 📂 重要文件说明

| 文件 | 说明 |
|------|------|
| `package.json` | 扩展配置、版本号、依赖 |
| `src/extension.ts` | 扩展入口文件 |
| `dist/` | 构建输出目录 |
| `webview-ui/` | UI 界面代码 |
| `proto/` | Protocol Buffer 定义 |
| `.changeset/` | 版本变更记录 |

## 🎯 快速命令速查

```bash
# 开发
npm run dev                    # 开发模式（含 protos）
npm run watch                  # Watch 模式
npm run test                   # 运行测试

# 构建
npm run package                # 构建生产版本
npx vsce package              # 打包 .vsix

# 发布
npx vsce login alsritter      # 登录（首次）
npx vsce publish              # 发布到 Marketplace
npm run publish:marketplace   # 发布（含 ovsx）

# 版本管理
npm run changeset             # 创建变更记录
npm run version-packages      # 更新版本号

# 维护
npm run format:fix            # 格式化代码
npm run install:all           # 安装依赖
npm run protos                # 生成 proto 文件
```

## 🔒 敏感信息管理

### 不要提交到 Git

- Azure DevOps PAT token
- API keys
- 任何密钥文件

### 使用环境变量

```bash
# 创建 .env 文件（已在 .gitignore）
VSCE_PAT=your_token_here
```

## 📚 相关资源

- [VSCode Extension API](https://code.visualstudio.com/api)
- [vsce 文档](https://github.com/microsoft/vscode-vsce)
- [Marketplace 管理](https://marketplace.visualstudio.com/manage)
- [原项目文档](https://docs.cline.bot)

## 🎉 发布检查清单

在发布新版本前，确认以下事项：

- [ ] 所有测试通过 (`npm run test`)
- [ ] 代码已格式化 (`npm run format:fix`)
- [ ] 版本号已更新（package.json）
- [ ] CHANGELOG 已更新（如果使用）
- [ ] README 已更新（如果有功能变更）
- [ ] 本地测试 .vsix 正常工作
- [ ] Git 标签已创建（可选）
- [ ] 已备份当前版本

---

**最后更新**: 2025-11-26
**维护者**: alsritter
