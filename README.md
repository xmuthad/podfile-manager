# PodFile Manager

PodFile Manager 是一款功能强大的桌面应用程序，用于管理 Kubernetes 集群中的 Pod 文件和 Docker 镜像内的文件。

## 功能特性

### ☸️ Kubernetes 功能
- 🔄 **多集群管理** - 支持切换不同的 Kubernetes 集群上下文
- 📦 **Namespace 管理** - 浏览和管理所有 Namespace
- 🐳 **Pod 状态监控** - 查看 Pod 状态和容器运行状态
- 📁 **文件系统浏览** - 在容器内自由导航文件系统
- 📖 **文件查看** - 直接查看文本文件内容
- ✏️ **文件编辑** - 在线编辑容器内的文件
- ⬇️ **单文件下载** - 快速下载单个文件到本地
- 📦 **批量下载** - 选择多个文件打包下载
- 📁 **目录下载** - 下载整个目录
- ⬆️ **文件上传** - 从本地上传文件到容器
- 🔍 **文件搜索** - 在容器内搜索特定文件
- 💻 **终端** - 在容器内执行命令

### 🐳 Docker 镜像功能
- 🖼️ **镜像浏览** - 查看本地所有 Docker 镜像
- 🔍 **镜像搜索** - 按名称搜索 Docker 镜像
- 📁 **镜像内文件浏览** - 浏览镜像内的文件系统
- 📖 **文件查看** - 查看镜像内文件内容
- ✏️ **文件编辑** - 编辑镜像内文件（通过 docker commit 写回镜像）
- ⬇️ **单文件下载** - 从镜像下载文件
- 📦 **批量下载** - 批量下载文件
- 📁 **目录下载** - 下载整个目录
- 🔍 **文件搜索** - 在镜像内搜索文件
- 💻 **终端** - 在镜像内执行命令

### 🎨 界面特性
- 🌙 **主题切换** - 支持亮色和暗色主题
- 📊 **传输进度** - 实时显示文件传输进度
- ⚡ **限速下载** - 支持下载限速功能
- 📈 **树形导航** - 直观的 Namespace → Pod → Container 导航
- 🧩 **懒加载** - 弹窗组件按需加载，优化首屏性能

### 🏗️ 架构特点
- **Context + Hooks** - 全局状态通过 AppContext 管理，业务逻辑拆分到独立 Hooks
- **IPC 类型安全** - 主进程与渲染进程共享单一类型源（`electron/types.ts`），编译期拦截拼写错误
- **CSP 防护** - 生产模式启用 Content-Security-Policy，防止 XSS 攻击
- **useLatest 模式** - 回调引用始终读取最新状态，避免闭包陈旧值问题
- **PATH 自动修复** - 打包后自动从用户登录 Shell 获取 PATH，确保 kubectl / docker 可被找到

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **Electron** | 42 | 跨平台桌面应用框架 |
| **React** | 19 | 用户界面框架 |
| **TypeScript** | 6 | 类型安全的 JavaScript |
| **Vite** | 8 | 快速构建工具 |
| **ESLint** | 10 | 代码检查（flat config） |
| **Vitest** | 4 | 单元测试框架（happy-dom） |
| **Playwright** | 1.59 | 端到端测试框架 |
| **kubectl** | - | Kubernetes 命令行工具 |
| **Docker** | - | 容器运行时 |

## 前置要求

### 必需依赖
1. **Node.js** 18+ (建议使用 LTS 版本)
2. **kubectl** - Kubernetes 命令行工具，已配置好集群访问权限
3. **Docker** - 本地 Docker 守护进程运行中

### kubectl 配置
确保您的 `~/.kube/config` 已正确配置，并能访问目标 Kubernetes 集群：
```bash
# 验证 kubectl 配置
kubectl config current-context
kubectl get namespaces
```

## 安装和运行

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

此命令会启动 Vite 开发服务器并自动打开 Electron 应用。

### 构建应用

```bash
npm run electron:build
```

此命令会构建 Web 应用和 Electron 代码,并打包生成可执行文件。构建完成后,可执行文件位于 `release/` 目录下。

### 运行测试

```bash
# 运行单元测试
npm test

# 运行单元测试（带 UI）
npm run test:ui

# 运行代码覆盖率测试
npm run test:coverage

# 运行端到端测试
npm run test:e2e
```

### 代码检查

```bash
npm run lint
```

## 使用说明

### 界面布局

应用主界面分为三个区域：
1. **顶部导航栏** - 集群选择、主题切换、搜索、终端
2. **左侧边栏** - Namespace/Pod/Container 导航树或 Docker 镜像列表
3. **右侧主区域** - 文件浏览器和操作界面

### Kubernetes 使用流程

1. **选择集群** (如配置了多个集群)
   - 点击顶部导航栏的集群选择器
   - 切换到目标集群

2. **导航到容器**
   - 点击 Namespace 展开查看 Pod 列表
   - 点击 Pod 展开查看容器列表
   - 点击容器名称选中它

3. **浏览文件**
   - 使用文件浏览器导航目录
   - 点击文件夹进入目录
   - 点击「返回上级」回到上级目录

4. **文件操作**
   - 点击「👁️ 查看」预览文件内容
   - 点击「✏️ 编辑」修改文件内容
   - 点击「⬇️ 下载」下载文件到本地
   - 点击「📁 下载目录」下载整个目录
   - 点击「⬆️ 上传」上传本地文件

5. **批量选择**
   - 点击文件左侧的复选框选择多个文件
   - 点击「📦 批量下载」打包下载选中文件

### Docker 镜像使用流程

1. **选择镜像**
   - 在左侧 Docker 标签页浏览镜像列表
   - 使用搜索框过滤镜像
   - 点击镜像名称进入文件浏览模式

2. **浏览和操作文件**
   - 操作方式与 Kubernetes 容器类似

### 高级功能

#### 文件搜索
1. 点击顶部导航栏的 🔍 按钮
2. 输入文件名关键词
3. 点击「搜索」或按 Enter 键
4. 点击搜索结果直接跳转到对应位置

#### 终端
1. 点击顶部导航栏的 💻 按钮
2. 在终端输入框输入命令
3. 按 Enter 执行命令
4. 命令输出显示在上方区域

#### 下载限速
1. 点击文件下载按钮
2. 选择「dd 限速」下载方式
3. 设置限速速度 (KB/s)
4. 确认下载

#### 文件编辑
1. 点击「✏️ 编辑」按钮
2. 在编辑器中修改文件内容
3. 点击「💾 保存」保存更改
4. 点击「取消」放弃更改

## 注意事项

### 打包应用
- macOS 打包后的 Electron 应用不继承终端 Shell 的 PATH 环境变量
- 应用启动时会自动从登录 Shell（`$SHELL`）获取 PATH，无需手动配置
- 如果自动获取失败，会回退到常见安装路径（`/usr/local/bin`、`/opt/homebrew/bin` 等）

### Kubernetes
- 确保 `kubectl` 已安装并配置好集群访问权限
- Pod 必须处于 Running 状态才能进行文件操作
- 上传/下载大文件可能需要较长时间
- 某些精简镜像可能不支持 Shell 命令

### Docker
- 确保 Docker 守护进程正在运行
- 某些精简镜像（如仅包含二进制文件的镜像）可能不支持文件操作
- 从镜像下载文件的最大限制为 500MB
- 文件编辑通过 `docker commit` 写回镜像，会生成新的镜像层

### 通用
- 批量下载会自动打包为 tar 格式
- 临时文件会在操作完成后自动清理

## 项目结构

```
podfile-manager/
├── electron/              # Electron 主进程代码 (TypeScript)
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   └── types.ts           # 共享类型定义
├── src/                   # React 源代码
│   ├── components/        # React 组件
│   │   ├── Sidebar.tsx              # 侧边栏导航
│   │   ├── FileList.tsx             # 文件列表
│   │   ├── FileViewerModal.tsx      # 文件查看弹窗
│   │   ├── FileEditorModal.tsx      # 文件编辑弹窗
│   │   ├── DownloadDialog.tsx       # 下载对话框
│   │   ├── BatchDownloadDialog.tsx  # 批量下载对话框
│   │   ├── SearchModal.tsx          # 搜索弹窗
│   │   ├── TerminalPanel.tsx        # 终端面板
│   │   ├── TransferProgressBar.tsx  # 传输进度条
│   │   └── ToastContainer.tsx       # Toast 消息提示
│   ├── contexts/          # React Context
│   │   ├── AppContext.tsx           # 应用全局状态
│   │   ├── TerminalContext.ts       # 终端上下文
│   │   ├── TransferContext.ts       # 文件传输上下文
│   │   └── useApp.ts               # App Context Hook
│   ├── hooks/             # 自定义 React Hooks
│   │   ├── useK8s.ts                # Kubernetes 操作
│   │   ├── useDocker.ts             # Docker 操作
│   │   ├── useDockerFileBrowser.ts  # Docker 文件浏览
│   │   ├── useDockerFileActions.ts  # Docker 文件操作
│   │   ├── useDockerNav.ts          # Docker 导航
│   │   ├── useFileBrowser.ts        # K8s 文件浏览
│   │   ├── useFileActions.ts        # K8s 文件操作
│   │   ├── useClusterNav.ts         # 集群导航
│   │   ├── useSearch.ts             # 文件搜索
│   │   ├── useTerminal.ts           # 终端功能
│   │   ├── useTheme.ts              # 主题切换
│   │   ├── useToast.ts              # Toast 提示
│   │   └── useTransfer.ts           # 文件传输
│   ├── test/              # 单元测试（App 组件测试 + 测试环境配置）
│   ├── App.tsx            # 主应用组件
│   ├── types.ts           # TypeScript 类型定义
│   └── utils.ts           # 工具函数
├── tests/e2e/             # Playwright 端到端测试
├── dist/                  # Vite 构建输出
├── dist-electron/         # Electron 构建输出
├── release/               # 打包可执行文件输出
└── coverage/              # 测试覆盖率报告
```

## 许可证

本项目仅供学习和研究使用。
