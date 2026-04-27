#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// 路径工具
// ---------------------------------------------------------------------------
function normalizeComparisonPath(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isWithinRoot(absolutePath: string, workspaceRoot: string): boolean {
  const relative = path.relative(workspaceRoot, absolutePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

// ---------------------------------------------------------------------------
// 工作区根路径：优先使用 MCP roots，其次使用环境变量，最后回退到 process.cwd()
// ---------------------------------------------------------------------------
async function listWorkspaceRoots(): Promise<string[]> {
  const uniqueRoots = new Map<string, string>();

  try {
    const result = await server.server.listRoots();
    for (const root of result.roots ?? []) {
      if (!root.uri.startsWith("file:")) continue;
      const localPath = path.resolve(fileURLToPath(root.uri));
      uniqueRoots.set(normalizeComparisonPath(localPath), localPath);
    }
  } catch {
    // 某些客户端不支持 roots/list，回退到 env/cwd。
  }

  const envRoot = process.env.CODECOMPASS_WORKSPACE?.trim();
  if (envRoot) {
    const resolvedEnvRoot = path.resolve(envRoot);
    uniqueRoots.set(
      normalizeComparisonPath(resolvedEnvRoot),
      resolvedEnvRoot
    );
  }

  const cwdRoot = path.resolve(process.cwd());
  uniqueRoots.set(normalizeComparisonPath(cwdRoot), cwdRoot);

  return [...uniqueRoots.values()];
}

type ResolvedTarget = {
  absolutePath: string;
  workspaceRoot: string;
};

async function resolveTargetPath(
  relativePath: string
): Promise<ResolvedTarget | null> {
  const trimmedRelativePath = relativePath.replace(/^[/\\]+/, "");
  const workspaceRoots = await listWorkspaceRoots();
  let fallback: ResolvedTarget | null = null;

  for (const workspaceRoot of workspaceRoots) {
    const resolvedRoot = path.resolve(workspaceRoot);
    const absolutePath = path.resolve(resolvedRoot, trimmedRelativePath);
    if (!isWithinRoot(absolutePath, resolvedRoot)) {
      continue;
    }

    const candidate = { absolutePath, workspaceRoot: resolvedRoot };
    fallback ??= candidate;

    if (fs.existsSync(absolutePath)) {
      return candidate;
    }
  }

  return fallback;
}

// ---------------------------------------------------------------------------
// 链接构造
//   - deep: vscode://file/...:line:col（Preview 兼容性最好，但不保证分栏）
//   - extension: vscode://<扩展ID>/open?...（Preview 可点，且由扩展实现右侧分栏）
//   - command: command:vscode.open（可请求右侧分栏，但可能被 Preview 安全策略拦截）
// ---------------------------------------------------------------------------
type LinkMode = "deep" | "extension" | "command";

function getLinkMode(): LinkMode {
  const raw = process.env.CODECOMPASS_LINK_MODE?.trim().toLowerCase();
  if (raw === "command") return "command";
  if (raw === "extension") return "extension";
  return "deep";
}

function toEditorDeepLink(absolutePath: string, lineNumber: number): string {
  const scheme = process.env.CODECOMPASS_EDITOR_URI_SCHEME?.trim() || "vscode";
  const safeLine = Math.max(1, lineNumber);
  return `${scheme}://file${pathToFileURL(absolutePath).pathname}:${safeLine}:1`;
}

function toExtensionOpenLink(
  workspaceRoot: string,
  relativePath: string,
  lineNumber: number
): string {
  const extensionId =
    process.env.CODECOMPASS_VSCODE_EXTENSION_ID?.trim() ||
    "codecompass.codecompass-preview";
  const safeLine = Math.max(1, lineNumber);
  const safePath = relativePath.replace(/\\/g, "/");
  const query = `path=${encodeURIComponent(safePath)}&line=${encodeURIComponent(
    String(safeLine)
  )}&root=${encodeURIComponent(workspaceRoot)}`;
  return `vscode://${extensionId}/open?${query}`;
}

function toSplitCommandUri(absolutePath: string, lineNumber: number): string {
  const zeroBasedLine = Math.max(0, lineNumber - 1);
  const args = [
    pathToFileURL(absolutePath).toString(),
    {
      viewColumn: -2,
      preview: false,
      selection: [zeroBasedLine, 0, zeroBasedLine, 0],
    },
  ];

  return `command:vscode.open?${encodeURIComponent(JSON.stringify(args))}`;
}

function buildMarkdownLink(
  symbolName: string,
  workspaceRoot: string,
  absolutePath: string,
  lineNumber: number
): string {
  const fileName = path.basename(absolutePath);
  const safeLine = Math.max(1, lineNumber);
  const mode = getLinkMode();
  const href = (() => {
    if (mode === "command") return toSplitCommandUri(absolutePath, lineNumber);
    if (mode === "extension") {
      const rel = path.relative(workspaceRoot, absolutePath);
      return toExtensionOpenLink(workspaceRoot, rel, lineNumber);
    }
    return toEditorDeepLink(absolutePath, lineNumber);
  })();
  const title = (() => {
    if (mode === "command") return `在右侧分栏打开 ${fileName} 第${safeLine}行`;
    if (mode === "extension")
      return `在右侧分栏打开 ${fileName} 第${safeLine}行（通过扩展）`;
    return `在编辑器中打开 ${fileName} 第${safeLine}行`;
  })();

  return `[\`${symbolName}\` L${safeLine}](${href} "${title}")`;
}

// ---------------------------------------------------------------------------
// MCP Server 定义
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "codecompass",
  version: "1.0.0",
});

server.tool(
  "create_split_link",
  "将代码符号（函数名/变量名/文件名）的位置转换为 VS Code Markdown 可点击链接。" +
    "提供符号名称、相对路径和行号，返回单个 Markdown 链接，" +
    "点击后在右侧分栏打开目标文件并定位到精确行号。",
  {
    symbol_name: z
      .string()
      .min(1)
      .describe("显示在文档中的符号名称（变量名、函数名、类名或文件名）"),
    relative_path: z
      .string()
      .min(1)
      .describe('目标文件相对于工作区根目录的路径，如 "src/utils/auth.ts"'),
    line_number: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("目标符号所在的行号（1-based，默认 1）"),
  },
  async ({ symbol_name, relative_path, line_number }) => {
    const resolvedTarget = await resolveTargetPath(relative_path);
    if (!resolvedTarget) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[错误] 路径 "${relative_path}" 超出工作区范围`,
          },
        ],
      };
    }

    const link = buildMarkdownLink(
      symbol_name,
      resolvedTarget.workspaceRoot,
      resolvedTarget.absolutePath,
      line_number
    );

    return {
      content: [
        {
          type: "text" as const,
          text: link,
        },
      ],
    };
  }
);

server.tool(
  "create_split_links_batch",
  "批量生成多个代码符号的可点击链接，减少多次调用开销。" +
    "每个链接点击后在右侧分栏打开并定位到精确行号。",
  {
    symbols: z
      .array(
        z.object({
          symbol_name: z.string().min(1).describe("符号名称"),
          relative_path: z.string().min(1).describe("相对路径"),
          line_number: z.number().int().min(1).default(1).describe("行号"),
        })
      )
      .min(1)
      .describe("需要生成链接的符号列表"),
  },
  async ({ symbols }) => {
    const results: string[] = [];
    for (const sym of symbols) {
      const resolvedTarget = await resolveTargetPath(sym.relative_path);
      if (!resolvedTarget) {
        results.push(
          `- [错误] 路径 "${sym.relative_path}" 超出工作区范围`
        );
        continue;
      }

      results.push(
        buildMarkdownLink(
          sym.symbol_name,
          resolvedTarget.workspaceRoot,
          resolvedTarget.absolutePath,
          sym.line_number
        )
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: results.join("\n"),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// 启动 Server
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (
  process.argv[2] === "install" ||
  process.argv[2] === "-h" ||
  process.argv[2] === "--help"
) {
  await import("./cli.js");
} else {
  main().catch((err) => {
    console.error("CodeCompass MCP Server 启动失败:", err);
    process.exit(1);
  });
}
