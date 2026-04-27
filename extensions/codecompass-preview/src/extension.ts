import * as vscode from "vscode";
import path from "node:path";

let pinnedViewColumn: vscode.ViewColumn | undefined;
let forceNewGroupNextOpen = false;

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = query.startsWith("?") ? query.slice(1) : query;
  for (const part of trimmed.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

function normalizeFsPath(fsPath: string): string {
  const resolved = path.resolve(fsPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isWithinRoot(absolutePath: string, workspaceRoot: string): boolean {
  const relative = path.relative(workspaceRoot, absolutePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function buildUriInFolder(
  folder: vscode.WorkspaceFolder,
  relPath: string
): vscode.Uri | undefined {
  const rootPath = folder.uri.fsPath;
  const absolutePath = path.resolve(rootPath, relPath);
  if (!isWithinRoot(absolutePath, rootPath)) return undefined;
  return vscode.Uri.file(absolutePath);
}

async function resolveFileUri(
  relPath: string,
  rootHint?: string
): Promise<vscode.Uri | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) return undefined;

  const normalizedRootHint = rootHint
    ? normalizeFsPath(rootHint)
    : undefined;
  const hintedFolder = normalizedRootHint
    ? folders.find(
        (folder) =>
          normalizeFsPath(folder.uri.fsPath) === normalizedRootHint ||
          folder.name === rootHint
      )
    : undefined;

  if (hintedFolder) {
    const hintedCandidate = buildUriInFolder(hintedFolder, relPath);
    if (hintedCandidate && (await fileExists(hintedCandidate))) {
      return hintedCandidate;
    }
  }

  let fallback: vscode.Uri | undefined;
  for (const folder of folders) {
    const candidate = buildUriInFolder(folder, relPath);
    if (!candidate) continue;
    fallback ??= candidate;
    if (await fileExists(candidate)) return candidate;
  }

  return folders.length === 1 ? fallback : undefined;
}

/**
 * 找到应该打开文件的目标编辑组。
 *
 * 策略：
 * 1. 如果有 pinnedViewColumn 且该组还存在 → 直接复用
 * 2. 否则找"不是当前激活组"的已有编辑组（Preview 通常在激活组）→ 复用它
 * 3. 都找不到 → 返回 undefined，调用方再用 Beside 新建
 */
function resolveTargetColumn(): vscode.ViewColumn | undefined {
  const groups = vscode.window.tabGroups.all;

  if (pinnedViewColumn !== undefined) {
    const still = groups.some((g) => g.viewColumn === pinnedViewColumn);
    if (still) return pinnedViewColumn;
    pinnedViewColumn = undefined;
  }

  const active = vscode.window.tabGroups.activeTabGroup;
  const others = groups.filter((g) => g !== active);
  if (others.length > 0) {
    return others[others.length - 1].viewColumn;
  }

  return undefined;
}

async function openFile(
  fileUri: vscode.Uri,
  line: number
): Promise<vscode.TextEditor> {
  const zeroBasedLine = Math.max(0, line - 1);
  const sel = new vscode.Range(zeroBasedLine, 0, zeroBasedLine, 0);

  let column: vscode.ViewColumn;
  if (forceNewGroupNextOpen) {
    column = vscode.ViewColumn.Beside;
  } else {
    column = resolveTargetColumn() ?? vscode.ViewColumn.Beside;
  }

  const ext = path.extname(fileUri.fsPath).toLowerCase();
  let editor: vscode.TextEditor;
  try {
    // Cursor 环境下，openTextDocument/showTextDocument 有时会触发“文件同步限制”错误。
    // 这里统一走 vscode.open 命令，避免扩展侧直接读取文件内容。
    if (ext === ".md") {
      // 仅保留 Preview：只打开 markdown preview，不再额外打开文本编辑器。
      await vscode.commands.executeCommand(
        "vscode.openWith",
        fileUri,
        "vscode.markdown.preview.editor",
        {
          viewColumn: column,
          preview: false,
        }
      );

      // Preview 不是 TextEditor，这里更新 pin 并退出。
      pinnedViewColumn =
        vscode.window.tabGroups.activeTabGroup?.viewColumn ?? pinnedViewColumn;
      forceNewGroupNextOpen = false;
      return vscode.window.activeTextEditor as vscode.TextEditor;
    }

    await vscode.commands.executeCommand("vscode.open", fileUri, {
      viewColumn: column,
      preview: false,
      selection: sel,
    });

    editor = vscode.window.activeTextEditor as vscode.TextEditor;
  } catch (err) {
    throw err;
  }

  pinnedViewColumn = editor.viewColumn ?? pinnedViewColumn;
  forceNewGroupNextOpen = false;
  return editor;
}

async function openBesideFromUri(uri: vscode.Uri): Promise<void> {
  const q = parseQuery(uri.query);
  const relPath = (q.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const line = Math.max(1, Number.parseInt(q.line || "1", 10) || 1);
  const rootHint = q.root || q.workspace;

  if (!relPath) {
    await vscode.window.showErrorMessage("CodeCompass: 缺少 path 参数");
    return;
  }

  const fileUri = await resolveFileUri(relPath, rootHint);
  if (!fileUri) {
    await vscode.window.showErrorMessage(
      "CodeCompass: 无法在当前工作区定位目标文件"
    );
    return;
  }

  await openFile(fileUri, line);
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codecompassPreview.newSplitNext",
      async () => {
        forceNewGroupNextOpen = true;
        await vscode.window.setStatusBarMessage(
          "CodeCompass：下一次点击将新建分栏并固定到新分栏",
          2500
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codecompassPreview.resetPinnedSplit",
      async () => {
        pinnedViewColumn = undefined;
        await vscode.window.setStatusBarMessage(
          "CodeCompass：已清除固定分栏，下一次点击将重新创建分栏",
          2500
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        if (uri.path === "/open") {
          await openBesideFromUri(uri);
        }
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codecompassPreview.openUri",
      async () => {
        const active = vscode.window.activeTextEditor?.document.uri;
        if (!active) {
          await vscode.window.showErrorMessage(
            "CodeCompass: 没有可用的活动文档"
          );
          return;
        }
        await openFile(active, 1);
      }
    )
  );
}

export function deactivate() {}
