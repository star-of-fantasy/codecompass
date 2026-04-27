# CodeCompass Preview（扩展）

这个扩展用于解决：**Markdown Preview 会拦截/忽略 `command:` 链接**，导致 CodeCompass 的“右侧分栏打开”在 Preview 里不可用。

扩展提供一个可在 Preview 中点击的 URI：

```text
vscode://codecompass.codecompass-preview/open?path=src/index.ts&line=42
```

点击后由扩展接管，执行 `vscode.open` 并以 **右侧分栏**打开且定位到精确行号。

## 分栏策略（固定分栏 / 新建分栏）

由于 VS Code/Cursor 的 URI handler 无法获知“点击时是否按下 Ctrl”，因此无法做到“同一链接 Ctrl+点击=新分栏”的精确区分。

扩展提供等价能力：

- **普通点击**：始终固定在同一个右侧分栏里打开（不会越点越分裂）
- **新建分栏（下一次）**：执行命令 `CodeCompass Preview: 下一次点击新建分栏`，下一次点击链接会新建分栏并将固定目标切到新分栏

建议在快捷键里把 `codecompassPreview.newSplitNext` 绑定成你习惯的键，例如 `Ctrl+Alt+N`。

扩展已提供默认快捷键：

- `Ctrl+Alt+N`：下一次点击新建分栏
- `Ctrl+Alt+Shift+N`：清除固定分栏

## 配合 codecompass-mcp 使用

在 MCP server 配置里加环境变量：

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

## 本地开发

```bash
npm install
npm run build
```

然后在 VS Code 里用 “运行和调试” 启动扩展开发主机即可。

