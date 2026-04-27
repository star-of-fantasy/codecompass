#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function printHelp() {
    console.log(`CodeCompass 安装器

用法:
  codecompass install [选项]

选项:
  --editor <cursor|code>     指定编辑器 CLI，默认 cursor
  --scope <global|project>   安装范围，默认 global
  --workspace <path>         项目级安装目标目录，默认当前目录
  --skip-extension           跳过安装编辑器插件
  --skip-mcp                 跳过写入 MCP 配置
  --skip-skill               跳过安装 Skill
  -h, --help                 显示帮助

示例:
  npx codecompass-mcp@latest install
  codecompass install --scope project --workspace .
  codecompass install --skip-extension
`);
}
function parseArgs(argv) {
    const [command, ...rest] = argv;
    if (!command || command === "-h" || command === "--help") {
        printHelp();
        return null;
    }
    if (command !== "install") {
        throw new Error(`未知命令 "${command}"，请使用 codecompass install`);
    }
    const options = {
        editor: "cursor",
        scope: "global",
        workspace: process.cwd(),
        skipExtension: false,
        skipMcp: false,
        skipSkill: false,
    };
    for (let index = 0; index < rest.length; index += 1) {
        const arg = rest[index];
        const next = rest[index + 1];
        if (arg === "-h" || arg === "--help") {
            printHelp();
            return null;
        }
        if (arg === "--skip-extension") {
            options.skipExtension = true;
            continue;
        }
        if (arg === "--skip-mcp") {
            options.skipMcp = true;
            continue;
        }
        if (arg === "--skip-skill") {
            options.skipSkill = true;
            continue;
        }
        if (arg === "--editor") {
            if (next !== "cursor" && next !== "code") {
                throw new Error("--editor 只支持 cursor 或 code");
            }
            options.editor = next;
            index += 1;
            continue;
        }
        if (arg === "--scope") {
            if (next !== "global" && next !== "project") {
                throw new Error("--scope 只支持 global 或 project");
            }
            options.scope = next;
            index += 1;
            continue;
        }
        if (arg === "--workspace") {
            if (!next)
                throw new Error("--workspace 需要提供目录路径");
            options.workspace = path.resolve(next);
            index += 1;
            continue;
        }
        throw new Error(`未知选项 "${arg}"`);
    }
    return options;
}
function validateOptions(options) {
    if (options.scope !== "project")
        return;
    if (!fs.existsSync(options.workspace)) {
        throw new Error(`项目目录不存在: ${options.workspace}`);
    }
    const stat = fs.statSync(options.workspace);
    if (!stat.isDirectory()) {
        throw new Error(`--workspace 必须指向目录: ${options.workspace}`);
    }
}
function getHomeDir() {
    const home = process.env.USERPROFILE || process.env.HOME;
    if (!home)
        throw new Error("无法定位用户主目录");
    return home;
}
function getCursorRoot(options) {
    if (options.scope === "project") {
        return path.join(options.workspace, ".cursor");
    }
    return path.join(getHomeDir(), ".cursor");
}
function getMcpConfigPath(options) {
    return path.join(getCursorRoot(options), "mcp.json");
}
function getSkillTargetDir(options) {
    return path.join(getCursorRoot(options), "skills", "codecompass");
}
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    try {
        const raw = fs.readFileSync(filePath, "utf8").trim();
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("配置根节点不是 JSON 对象");
        }
        return parsed;
    }
    catch (error) {
        throw new Error(`读取 JSON 失败: ${filePath}\n${error instanceof Error ? error.message : String(error)}`);
    }
}
function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        fs.copyFileSync(filePath, `${filePath}.bak-${stamp}`);
    }
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
function readPackageVersion() {
    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageJson = readJsonFile(packageJsonPath);
    const version = packageJson.version;
    return typeof version === "string" && version ? version : "latest";
}
function compareVersion(a, b) {
    const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] ?? 0) - (right[index] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
function findVsixPath() {
    const fixedAsset = path.join(packageRoot, "assets", "codecompass-preview.vsix");
    if (fs.existsSync(fixedAsset))
        return fixedAsset;
    const extensionDir = path.join(packageRoot, "extensions", "codecompass-preview");
    if (fs.existsSync(extensionDir)) {
        const candidates = fs
            .readdirSync(extensionDir)
            .map((fileName) => {
            const match = /^codecompass-preview-(\d+\.\d+\.\d+)\.vsix$/.exec(fileName);
            if (!match)
                return null;
            return {
                version: match[1],
                filePath: path.join(extensionDir, fileName),
            };
        })
            .filter((item) => item !== null)
            .sort((a, b) => compareVersion(b.version, a.version));
        if (candidates[0])
            return candidates[0].filePath;
    }
    throw new Error("未找到 CodeCompass Preview 插件 VSIX，请先执行 npm run package:extension");
}
function installExtension(options) {
    const vsixPath = findVsixPath();
    const result = spawnSync(options.editor, ["--install-extension", vsixPath, "--force"], {
        encoding: "utf8",
        stdio: "pipe",
    });
    if (result.error) {
        throw new Error(`无法执行 ${options.editor} CLI，请确认它已加入 PATH。\n${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`安装插件失败。\n${result.stderr || result.stdout || "无错误输出"}`);
    }
}
function isNpxTempInstall() {
    return packageRoot.split(path.sep).some((part) => part === "_npx");
}
function resolveMcpCommandConfig() {
    if (isNpxTempInstall()) {
        const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
        return {
            command: npxCommand,
            args: ["-y", `codecompass-mcp@${readPackageVersion()}`],
        };
    }
    return {
        command: process.execPath,
        args: [path.join(packageRoot, "dist", "index.js")],
    };
}
function installMcpConfig(options) {
    const configPath = getMcpConfigPath(options);
    const config = readJsonFile(configPath);
    const rawServers = config.mcpServers;
    const mcpServers = rawServers && typeof rawServers === "object" && !Array.isArray(rawServers)
        ? rawServers
        : {};
    const rawCodeCompass = mcpServers.codecompass;
    const existingCodeCompass = rawCodeCompass &&
        typeof rawCodeCompass === "object" &&
        !Array.isArray(rawCodeCompass)
        ? rawCodeCompass
        : {};
    const rawEnv = existingCodeCompass.env;
    const existingEnv = rawEnv && typeof rawEnv === "object" && !Array.isArray(rawEnv)
        ? rawEnv
        : {};
    const mcpCommand = resolveMcpCommandConfig();
    mcpServers.codecompass = {
        ...existingCodeCompass,
        command: mcpCommand.command,
        args: mcpCommand.args,
        env: {
            ...existingEnv,
            CODECOMPASS_LINK_MODE: "extension",
            CODECOMPASS_VSCODE_EXTENSION_ID: "codecompass.codecompass-preview",
        },
    };
    config.mcpServers = mcpServers;
    writeJsonFile(configPath, config);
    return configPath;
}
function backupDirectory(targetDir) {
    if (!fs.existsSync(targetDir))
        return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = `${targetDir}.bak-${stamp}`;
    fs.cpSync(targetDir, backupDir, { recursive: true });
}
function copyDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`源目录不存在: ${sourceDir}`);
    }
    backupDirectory(targetDir);
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
}
function installSkill(options) {
    const sourceDir = path.join(packageRoot, "skills", "codecompass");
    const targetDir = getSkillTargetDir(options);
    copyDirectory(sourceDir, targetDir);
    return targetDir;
}
function runInstall(options) {
    const results = [];
    if (!options.skipExtension) {
        installExtension(options);
        results.push(`插件已安装到 ${options.editor}`);
    }
    if (!options.skipMcp) {
        const configPath = installMcpConfig(options);
        results.push(`MCP 配置已写入 ${configPath}`);
    }
    if (!options.skipSkill) {
        const skillPath = installSkill(options);
        results.push(`Skill 已安装到 ${skillPath}`);
    }
    console.log(["CodeCompass 安装完成:", ...results.map((item) => `- ${item}`)].join("\n"));
}
try {
    const options = parseArgs(process.argv.slice(2));
    if (options) {
        validateOptions(options);
        runInstall(options);
    }
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
//# sourceMappingURL=cli.js.map