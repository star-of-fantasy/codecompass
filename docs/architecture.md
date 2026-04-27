# CodeCompass MCP Server 架构说明（当前工作区）

## 概览

CodeCompass 是一个轻量级 **MCP (Model Context Protocol) Server**，专门把“符号名 + 相对路径 + 行号”转换成 **单个**适合 VS Code/Cursor Markdown 的可点击链接。

由于 Markdown Preview 通常会出于安全策略拦截 `command:` 协议，当前版本提供三种输出模式（由环境变量 `CODECOMPASS_LINK_MODE` 决定）：

- **deep（默认）**：`vscode://file/...:line:col`，Preview 兼容性最好（能打开并定位到行号），但不保证分栏
- **extension（推荐）**：`vscode://<扩展ID>/open?...`，Preview 可点且由扩展实现右侧分栏（需要安装配套扩展）
- **command（可选）**：`command:vscode.open`，可请求右侧分栏打开，但可能在 Preview 中被拦截

如果你的目标是 **“Preview 下也必须 split”**，请使用 **extension 模式**（本文档链接已统一为 extension 协议）。

**技术栈：** TypeScript · Node.js ≥ 18 · `@modelcontextprotocol/sdk` · Zod · Stdio 传输

---

## 核心文件导航

> 说明：为了保证 **Markdown Preview** 下也能 **右侧分栏打开**，本文档的链接统一使用扩展协议：
>
> `vscode://codecompass.codecompass-preview/open?path=<相对路径>&line=<行号>`
>
> 需要先启用仓库内扩展 `extensions/codecompass-preview`（已提供一键 F5/VSIX 配置），并将 MCP 的 `CODECOMPASS_LINK_MODE` 设为 `extension`。
>
> 本地安装推荐使用最新版 VSIX：
>
> - `extensions/codecompass-preview/codecompass-preview-0.0.2.vsix`

| 文件 | 职责 |
|------|------|
| [`src/index.ts` L1](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=1 "在右侧分栏打开 src/index.ts 第1行（通过扩展）") | 唯一源码文件：路径解析、链接构造、工具注册、启动入口 |
| [`README.md` L1](vscode://codecompass.codecompass-preview/open?path=README.md&line=1 "在右侧分栏打开 README.md 第1行（通过扩展）") | 使用方式、Cursor MCP 配置示例、运行说明 |
| [`package.json` L1](vscode://codecompass.codecompass-preview/open?path=package.json&line=1 "在右侧分栏打开 package.json 第1行（通过扩展）") | 包信息、依赖和脚本 |
| [`tsconfig.json` L1](vscode://codecompass.codecompass-preview/open?path=tsconfig.json&line=1 "在右侧分栏打开 tsconfig.json 第1行（通过扩展）") | TypeScript 编译配置 |
| [`docs/architecture.md` L1](vscode://codecompass.codecompass-preview/open?path=docs/architecture.md&line=1 "在右侧分栏打开 docs/architecture.md 第1行（通过扩展）") | 本文档 |
| [`extensions/codecompass-preview/src/extension.ts` L1](vscode://codecompass.codecompass-preview/open?path=extensions/codecompass-preview/src/extension.ts&line=1 "在右侧分栏打开 extension.ts 第1行（通过扩展）") | 预览点击接管：URI Handler → `vscode.open` beside |
| [`.vscode/launch.json` L1](vscode://codecompass.codecompass-preview/open?path=.vscode/launch.json&line=1 "在右侧分栏打开 launch.json 第1行（通过扩展）") | 一键 F5：启动扩展开发主机 |
| [`.vscode/tasks.json` L1](vscode://codecompass.codecompass-preview/open?path=.vscode/tasks.json&line=1 "在右侧分栏打开 tasks.json 第1行（通过扩展）") | 一键任务：构建 MCP + 构建扩展 |
| [`SKILL.md` L1](vscode://codecompass.codecompass-preview/open?path=.cursor/skills/codecompass/SKILL.md&line=1 "在右侧分栏打开 SKILL.md 第1行（通过扩展）") | Skill 规范：要求先定位行号，再调 MCP 生成链接 |

---

## 依赖说明

| 依赖 | 用途 | 引入位置 |
|------|------|----------|
| `@modelcontextprotocol/sdk` | MCP 服务端、stdio 传输 | `src/index.ts` |
| `zod` | 工具入参校验 | `src/index.ts` |

---

## 模块详解

### 1) 路径解析层（安全边界）

这一层解决两件事：**找到工作区根** + **把相对路径解析到安全的绝对路径**。

- [`listWorkspaceRoots` L29](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=29 "在右侧分栏打开 src/index.ts 第29行（通过扩展）")：按优先级收集工作区根目录：MCP `roots/list` → `CODECOMPASS_WORKSPACE` → `process.cwd()`。
- [`resolveTargetPath` L63](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=63 "在右侧分栏打开 src/index.ts 第63行（通过扩展）")：把 `relative_path` 解析为 `absolutePath + workspaceRoot`，并优先选择真实存在文件；即使文件不存在，也保留一个“合法候选”以避免工具完全失效。
- [`isWithinRoot` L18](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=18 "在右侧分栏打开 src/index.ts 第18行（通过扩展）")：防止 `../` 跳出工作区，是路径安全的核心边界。

### 2) 链接构造层（右侧分栏 + 行号定位）

这一层把 “绝对路径 + 行号” 变为一个可点击链接；在 **extension 模式**下会生成 `vscode://<扩展ID>/open?...`，由扩展确保 **右侧分栏**。

- [`getLinkMode` L96](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=96 "在右侧分栏打开 src/index.ts 第96行（通过扩展）")：读取 `CODECOMPASS_LINK_MODE`，决定输出 deep/extension/command。
- [`toExtensionOpenLink` L109](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=109 "在右侧分栏打开 src/index.ts 第109行（通过扩展）")：构造 `vscode://<扩展ID>/open?path=...&line=...`。
- [`toSplitCommandUri` L121](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=121 "在右侧分栏打开 src/index.ts 第121行（通过扩展）")：构造 `command:vscode.open?{args}`（仅 command 模式使用）。
- [`buildMarkdownLink` L135](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=135 "在右侧分栏打开 src/index.ts 第135行（通过扩展）")：统一拼装 Markdown 字符串，当前格式为：

```markdown
[`symbolName` L42](vscode://codecompass.codecompass-preview/open?path=src/file.ts&line=42 "在右侧分栏打开 file.ts 第42行（通过扩展）")
```

### 2.5) 扩展层（Preview 点击接管 + 分栏策略）

`extensions/codecompass-preview` 的职责是：让 **Markdown Preview** 里点击 `vscode://codecompass.codecompass-preview/open?...` 时，能够稳定地 **右侧分栏打开并定位**，并避免越点越“分裂”出更多编辑组。

- [`openBesideFromUri` L17](vscode://codecompass.codecompass-preview/open?path=extensions/codecompass-preview/src/extension.ts&line=17 "在右侧分栏打开 extension.ts 第17行（通过扩展）")：解析 `path/line` 参数并打开文件。
- [`pinnedViewColumn` L3](vscode://codecompass.codecompass-preview/open?path=extensions/codecompass-preview/src/extension.ts&line=3 "在右侧分栏打开 extension.ts 第3行（通过扩展）")：第一次打开后会记录实际落到的编辑组；后续点击固定复用该组（不会继续向右 split）。
- [`codecompassPreview.newSplitNext` L55](vscode://codecompass.codecompass-preview/open?path=extensions/codecompass-preview/src/extension.ts&line=55 "在右侧分栏打开 extension.ts 第55行（通过扩展）")：将“下一次点击”切换为新建 split，并把固定目标迁移到新 split。
- [`codecompassPreview.resetPinnedSplit` L65](vscode://codecompass.codecompass-preview/open?path=extensions/codecompass-preview/src/extension.ts&line=65 "在右侧分栏打开 extension.ts 第65行（通过扩展）")：清除固定目标，下次点击会重新创建 split。

扩展默认快捷键（可在快捷键设置中覆盖）：

- `Ctrl+Alt+N`：下一次点击新建分栏
- `Ctrl+Alt+Shift+N`：清除固定分栏

### 3) MCP 工具层（对外接口）

当前对外暴露两个工具：

- [`create_split_link` L170](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=170 "在右侧分栏打开 src/index.ts 第170行（通过扩展）")：生成单个符号链接。
- [`create_split_links_batch` L222](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=222 "在右侧分栏打开 src/index.ts 第222行（通过扩展）")：批量生成多个符号链接，减少多次调用开销。

### 4) 启动入口（stdio）

- [`main` L273](vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=273 "在右侧分栏打开 src/index.ts 第273行（通过扩展）")：创建 `StdioServerTransport` 并 `server.connect(transport)` 启动 MCP 服务；异常时打印错误并退出。

---

## 数据流（从“符号”到“可点击链接”）

```text
用户请求生成文档
       │
       ▼
Skill / Agent 定位符号所在文件 + 行号
       │
       ▼
调用 create_split_link / create_split_links_batch
       │
       ├──► listWorkspaceRoots() 解析工作区根目录
       ├──► resolveTargetPath() 计算真实目标文件
       ├──► getLinkMode() 决定输出 deep/extension/command
       ├──► toExtensionOpenLink() 生成 Preview 可点击的扩展链接（extension 模式）
       ├──► toSplitCommandUri() 生成命令链接（command 模式）
       └──► buildMarkdownLink() 组装最终 Markdown（单一链接）
              │
              ▼
返回给 Agent → 嵌入到 .md 文档
              │
              ▼
用户点击链接：
  - extension 模式：由扩展接管 → 右侧分栏打开 + 精确定位行号（Preview 可用）
  - deep 模式：直接打开并定位（Preview 可用，但不保证分栏）
  - command 模式：可请求分栏，但 Preview 可能被拦截
```

---

## 预览点击无反应排查（重要）

如果你在 **Markdown Preview** 里点击链接无反应，优先按以下顺序排查：

1. **优先使用 extension 模式**：把 MCP 的 `CODECOMPASS_LINK_MODE` 设为 `extension`，并确保扩展已启用（本文档的链接就是这种方式）。
2. **工作区信任（Workspace Trust）**：如果当前处于受限模式，某些协议链接可能会被拦截。请将该文件夹设为“信任”。
3. 如果你仍坚持使用 `command:` 链接：需要预览侧允许 command links（Cursor 可能不支持该设置项），因此不推荐。

---

## 构建与运行

```bash
npm install
npm run build
```
