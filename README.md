# CodeCompass MCP

中文 | [English](#english)

CodeCompass 是一个 Cursor 配套工具，用于生成可点击、可分屏跳转的代码架构文档。它由三部分组成：

- MCP Server：把相对路径和行号转换成 Markdown 跳转链接。
- Cursor Skill：指导 Agent 生成交互式代码说明文档。
- CodeCompass Preview 扩展：让 Markdown Preview 中的链接在右侧分栏打开源码。

## 一键安装

完整三件套安装目前面向 Cursor：

```bash
npx codecompass-mcp@latest install
```

这条命令会自动：

- 安装 CodeCompass Preview VSIX 插件。
- 合并写入 Cursor MCP 配置。
- 安装 CodeCompass Skill。

如果你已经全局安装 npm 包，也可以执行：

```bash
npm i -g codecompass-mcp
codecompass install
```

项目级安装：

```bash
codecompass install --scope project --workspace .
```

只安装部分能力：

```bash
codecompass install --skip-extension
codecompass install --skip-mcp
codecompass install --skip-skill
```

> 说明：`--editor code` 仅用于通过 `code --install-extension` 安装 VSIX，不会为 VS Code 安装 MCP/Skill。完整 MCP + Skill 流程当前只支持 Cursor。

## 本地开发安装

```bash
npm install
npm run build
npm run package:extension
node dist/cli.js install
```

安装器会备份已有 `mcp.json`，并只合并 `mcpServers.codecompass`，不会覆盖其他 MCP server。已有 Skill 目录也会先备份再写入。

## 使用方式

在 Cursor Agent 中说：

```text
帮我生成 src/services/ 目录的架构文档
```

Agent 会读取代码、定位关键符号、调用 CodeCompass MCP 工具生成链接，并输出一份可点击的 Markdown 文档。

## 链接模式

CodeCompass 支持三种链接模式：

- `deep`：使用 `vscode://file/...:line:col`，兼容性最好，但不保证分栏。
- `extension`：使用 CodeCompass Preview 扩展打开，推荐用于 Cursor Markdown Preview。
- `command`：使用 `command:vscode.open`，可能被 Markdown Preview 安全策略拦截。

一键安装默认写入：

```json
{
  "mcpServers": {
    "codecompass": {
      "env": {
        "CODECOMPASS_LINK_MODE": "extension",
        "CODECOMPASS_VSCODE_EXTENSION_ID": "codecompass.codecompass-preview"
      }
    }
  }
}
```

## MCP 工具

### `create_split_link`

生成单个可点击符号链接。

参数：

- `symbol_name`：符号名称。
- `relative_path`：目标文件相对工作区根目录的路径。
- `line_number`：1-based 行号。

### `create_split_links_batch`

批量生成多个符号链接，适合架构文档和交接文档。

## 项目结构

```text
codecompass-mcp/
├── src/
│   ├── index.ts      # MCP Server
│   └── cli.ts        # 一键安装器
├── skills/
│   └── codecompass/
│       └── SKILL.md  # 发布用 Skill 源文件
├── extensions/
│   └── codecompass-preview/
│       └── src/
│           └── extension.ts
├── package.json
└── README.md
```

## 发布

发布前执行：

```bash
npm run build
npm run package:extension
npm pack --dry-run --ignore-scripts
```

`prepack` 会自动构建 MCP Server 并重新打包扩展。

---

## English

CodeCompass is a companion tool for Cursor that generates clickable architecture documents for codebases. Each important symbol in the generated Markdown can open the source file in a split editor and jump to the exact line.

It contains three parts:

- MCP Server: converts relative paths and line numbers into Markdown links.
- Cursor Skill: guides the Agent to produce interactive code documents.
- CodeCompass Preview extension: opens Markdown Preview links in a side editor group.

## One-Line Install

The full three-part installation currently targets Cursor:

```bash
npx codecompass-mcp@latest install
```

This command installs:

- The CodeCompass Preview VSIX extension.
- The Cursor MCP configuration.
- The CodeCompass Skill.

If the package is installed globally:

```bash
npm i -g codecompass-mcp
codecompass install
```

Project-scoped install:

```bash
codecompass install --scope project --workspace .
```

Install only selected parts:

```bash
codecompass install --skip-extension
codecompass install --skip-mcp
codecompass install --skip-skill
```

> Note: `--editor code` only uses `code --install-extension` to install the VSIX extension. It does not install MCP or Skill support for VS Code. The complete MCP + Skill workflow currently supports Cursor only.

## Local Development Install

```bash
npm install
npm run build
npm run package:extension
node dist/cli.js install
```

The installer backs up the existing `mcp.json`, merges only `mcpServers.codecompass`, and preserves other MCP servers. Existing Skill folders are also backed up before writing.

## Usage

Ask Cursor Agent:

```text
Generate an architecture document for src/services/
```

The Agent reads the code, locates important symbols, calls the CodeCompass MCP tools, and writes a clickable Markdown document.

## Link Modes

CodeCompass supports three link modes:

- `deep`: uses `vscode://file/...:line:col`; most compatible, but does not guarantee split editor behavior.
- `extension`: uses the CodeCompass Preview extension; recommended for Cursor Markdown Preview.
- `command`: uses `command:vscode.open`; may be blocked by Markdown Preview security rules.

The one-line installer writes:

```json
{
  "mcpServers": {
    "codecompass": {
      "env": {
        "CODECOMPASS_LINK_MODE": "extension",
        "CODECOMPASS_VSCODE_EXTENSION_ID": "codecompass.codecompass-preview"
      }
    }
  }
}
```

## MCP Tools

### `create_split_link`

Creates one clickable symbol link.

Parameters:

- `symbol_name`: symbol display name.
- `relative_path`: target file path relative to the workspace root.
- `line_number`: 1-based line number.

### `create_split_links_batch`

Creates multiple symbol links in one call. This is recommended for architecture and handoff documents.

## Project Layout

```text
codecompass-mcp/
├── src/
│   ├── index.ts      # MCP Server
│   └── cli.ts        # One-line installer
├── skills/
│   └── codecompass/
│       └── SKILL.md  # Skill source included in npm package
├── extensions/
│   └── codecompass-preview/
│       └── src/
│           └── extension.ts
├── package.json
└── README.md
```

## Release

Before publishing:

```bash
npm run build
npm run package:extension
npm pack --dry-run --ignore-scripts
```

The `prepack` script rebuilds the MCP Server and packages the extension automatically.
# CodeCompass - 交互式代码文档生成器

将 AI 生成的代码说明文档从"只能看"升级为"可点击跳转"——文档中每个函数名、变量名、文件名都是链接。主链接会优先尝试在右侧编辑组打开源码，同时附带工作区打开 fallback 和精确到行的 deep link。

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Cursor Agent                    │
│                                                  │
│  ┌───────────────┐     ┌──────────────────────┐ │
│  │  Skill 调度大脑 │     │   AI 原生检索能力     │ │
│  │  (文档编排)     │     │   (查找文件和行号)    │ │
│  └───────┬───────┘     └──────────┬───────────┘ │
│          │ 相对路径 + 行号         │              │
│          ▼                        │              │
│  ┌───────────────────┐            │              │
│  │  MCP: create_      │◄───────────┘              │
│  │  split_link        │                           │
│  │  (路径→侧边打开链接) │                           │
│  └───────┬───────────┘                           │
│          │ Markdown 跳转链接                      │
│          ▼                                       │
│  ┌───────────────────┐                           │
│  │  .md 交互式文档    │  ← 用户在 Markdown        │
│  │  (split + fallback) │    编辑器 / Preview 阅读  │
│  └───────────────────┘                           │
└─────────────────────────────────────────────────┘
```

## 快速开始

### 一键安装（推荐）

发布到 npm 后，用户只需要执行：

```bash
npx codecompass-mcp@latest install
```

这条命令会自动完成：

1. 安装 CodeCompass Preview 插件
2. 写入 Cursor MCP 配置
3. 安装 CodeCompass Skill

如果已经全局安装，也可以执行：

```bash
npm i -g codecompass-mcp
codecompass install
```

项目级安装：

```bash
codecompass install --scope project --workspace .
```

只安装部分能力：

```bash
codecompass install --skip-extension
codecompass install --skip-mcp
codecompass install --skip-skill
```

### 本地开发安装

在仓库根目录执行：

```bash
npm install
npm run build
npm run package:extension
node dist/cli.js install
```

安装器会合并写入 MCP 配置，不会覆盖已有的其他 MCP server。写入前会自动备份已有的 `mcp.json`。

### 手动配置 MCP Server

如果需要手动配置 Cursor Settings → MCP，选择 `command` 类型，填写：

```json
{
  "mcpServers": {
    "codecompass": {
      "command": "node",
      "args": ["<绝对路径>/codecompass-mcp/dist/index.js"],
      "cwd": "<你的项目工作区根目录>"
    }
  }
}
```

**关键配置说明：**

| 字段 | 说明 |
|------|------|
| `command` | 固定为 `node` |
| `args` | `dist/index.js` 的**绝对路径** |
| `cwd` | 可选兜底项。新版会优先使用 MCP `roots/list` 自动获取当前工作区，只有客户端不支持 roots 时才回退到 `cwd` |

> 如果客户端不支持 MCP roots，也可以不设 `cwd`，改用环境变量 `CODECOMPASS_WORKSPACE` 指定工作区路径：
>
> ```json
> {
>   "codecompass": {
>     "command": "node",
>     "args": ["<绝对路径>/codecompass-mcp/dist/index.js"],
>     "env": {
>       "CODECOMPASS_WORKSPACE": "E:/workspace/my-project"
>     }
>   }
> }
> ```

### 手动复制 Skill 文件

将 `.cursor/skills/codecompass/` 文件夹复制到目标项目中：

```bash
# 复制到目标项目
cp -r .cursor/skills/codecompass <目标项目>/.cursor/skills/
```

或者复制到全局位置使其对所有项目生效：

```bash
# Windows
copy .cursor\skills\codecompass %USERPROFILE%\.cursor\skills\codecompass

# macOS / Linux
cp -r .cursor/skills/codecompass ~/.cursor/skills/
```

### 4. 使用

在 Cursor Agent 对话中输入：

```
帮我生成 src/services/ 目录的架构文档
```

Agent 会：
1. 读取目标文件，分析代码结构
2. 对每个关键符号调用 `create_split_link` 生成链接
3. 输出一份 `.md` 文件

用 VS Code/Cursor 的 Markdown 编辑器或 **Markdown Preview**（`Ctrl+Shift+V`）打开该文件：

- 默认链接使用 `vscode://file/...:line:col` 深链，**Preview 里也能点击打开并定位到行号**
- 如果你更希望“右侧分栏打开”，可以把 `CODECOMPASS_LINK_MODE` 设为 `command`（见下方）

## 链接模式（重要）

由于 VS Code/Cursor 的 Markdown Preview 通常会出于安全原因拦截 `command:` 协议，CodeCompass 提供三种链接模式，通过环境变量切换：

- **deep（默认）**：使用 `vscode://file/...:line:col`，Preview 兼容性最好，但不保证分栏
- **extension（推荐）**：使用 `vscode://<扩展ID>/open?...`，Preview 可点击且由扩展实现右侧分栏打开（需要安装配套扩展）
- **command（可选）**：使用 `command:vscode.open` 请求右侧分栏打开，但可能在 Preview 中被拦截

配置示例（在 MCP server 的 `env` 中添加）：

```json
{
  "codecompass": {
    "env": {
      "CODECOMPASS_LINK_MODE": "deep"
    }
  }
}
```

如果你需要在 **Markdown Preview** 里也能 **右侧分栏打开**，请安装仓库内扩展 `extensions/codecompass-preview`，并设置：

```json
{
  "codecompass": {
    "env": {
      "CODECOMPASS_LINK_MODE": "extension",
      "CODECOMPASS_VSCODE_EXTENSION_ID": "codecompass.codecompass-preview"
    }
  }
}
```

#### 本地安装扩展（.vsix）

扩展未发布到 marketplace，因此“按扩展 ID 安装”会提示找不到。请用 `.vsix` 本地安装：

1. 在仓库根目录执行：

```bash
npm run package:extension
```

2. 生成文件：

- `extensions/codecompass-preview/codecompass-preview-0.0.4.vsix`

3. 在 VS Code/Cursor：扩展面板 → “从 VSIX 安装…” → 选择该文件。

如果你使用的不是 VS Code 默认 URI scheme，可以通过环境变量覆盖 deep link 的 scheme：

```json
{
  "codecompass": {
    "env": {
      "CODECOMPASS_EDITOR_URI_SCHEME": "vscode"
    }
  }
}
```

## MCP 工具说明

### `create_split_link`

生成单个符号链接（根据 `CODECOMPASS_LINK_MODE` 选择 deep/command）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `symbol_name` | string | 是 | 显示名称（函数名 / 变量名 / 文件名） |
| `relative_path` | string | 是 | 相对于工作区的文件路径 |
| `line_number` | number | 否 | 行号（1-based，默认 1） |

**返回示例：**

```markdown
[`handleAuth` L42](vscode://file/E:/workspace/my-project/src/middleware/auth.ts:42:1 "在编辑器中打开 auth.ts 第42行")
```

### `create_split_links_batch`

批量生成多个符号的链接，减少调用开销。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `symbols` | array | 是 | 符号数组，每项包含 symbol_name / relative_path / line_number |

## 项目结构

```
codecompass-mcp/
├── src/
│   └── index.ts          # MCP Server 核心（唯一源码文件）
├── dist/                  # 编译产物
│   └── index.js
├── .cursor/
│   └── skills/
│       └── codecompass/
│           └── SKILL.md   # Agent Skill 定义
├── package.json
├── tsconfig.json
└── README.md
```

## 工作原理

1. **Skill**（Agent Prompt）指导 AI 在生成文档时，对每个代码符号查找其文件路径和行号
2. AI 将「符号名 + 相对路径 + 行号」传给 **MCP `create_split_link` 工具**
3. MCP 优先通过 `roots/list` 获取当前工作区根目录，必要时再回退到 `CODECOMPASS_WORKSPACE` 或 `cwd`
4. 生成 `command:vscode.open` 右侧分栏主链接，并附带 `/path/to/file` fallback 与 `vscode://file/...:line:column` 行号深链
5. 返回完整的 Markdown 链接给 AI，AI 原样放入文档
6. 用户点击主链接时优先右侧 split，点击 fallback 时仍可打开源码 / 定位到指定行

**为什么不全用 Skill？** LLM 算不准复杂 URI 编码，也无法获取当前机器的绝对路径。

**为什么不把 MCP 做重？** 文件检索和行号定位交给 AI 的原生代码检索能力（Codebase Search / Read File），MCP 只做最简单的路径转换。
