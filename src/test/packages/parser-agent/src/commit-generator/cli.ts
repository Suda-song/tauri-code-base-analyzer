#!/usr/bin/env node

/**
 * AI Commit CLI - 智能提交消息生成器
 */

import ora from "ora";
import chalk from "chalk";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { Command } from "commander";
import { spawn, exec, execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { getConfig, setConfigs, hasOwn } from "./utils/config";
import { GitUtils } from "./utils/git-utils";
import {
  readModularContext,
  getCurrentBranchContext,
  BranchContextData,
} from "@xhs/shared-utils";

const program = new Command();

const execAsync = promisify(exec);

async function checkStagedFiles(): Promise<{ files: string[]; count: number }> {
  try {
    const { stdout } = await execAsync("git diff --cached --name-only");
    const files = stdout.trim();

    if (!files) {
      return { files: [], count: 0 };
    }

    const fileList = files.split("\n");
    return { files: fileList, count: fileList.length };
  } catch (error) {
    throw new Error("无法检查暂存文件");
  }
}

/**
 * 复制到剪贴板并显示提示
 */
async function copyCommitMsgToClipboard(
  text: string,
  context: string = "提交信息"
): Promise<void> {
  try {
    const clipboardy = await import("clipboardy");
    await clipboardy.default.write(`git commit -m "${text}"`);
    console.log(chalk.green(`📋 ${context}已复制到剪贴板`));
  } catch (error) {
    console.log(chalk.yellow(`🍃  无法复制到剪贴板，请手动复制：\n${text}`));
  }
}

/**
 * 打开编辑器编辑文本
 */
async function editText(initialText: string): Promise<string> {
  const tempFile = join(tmpdir(), `ai-commit-${Date.now()}.txt`);

  try {
    // 写入临时文件
    writeFileSync(tempFile, initialText, "utf8");

    // 获取编辑器
    const editor = process.env.EDITOR || process.env.VISUAL || "vim";

    console.log(chalk.blue(`📝 正在打开编辑器 (${editor})...`));
    console.log(chalk.gray("💬 提示: 编辑完成后保存并退出编辑器"));

    // 打开编辑器
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editor, [tempFile], {
        stdio: "inherit",
        shell: true,
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`编辑器退出代码: ${code}`));
        }
      });

      child.on("error", reject);
    });

    // 读取编辑后的内容
    const editedText = readFileSync(tempFile, "utf8").trim();
    return editedText;
  } catch (error) {
    console.log(chalk.yellow("🍃  无法打开编辑器，请手动输入"));

    const inquirer = await import("inquirer");
    const { editedMessage } = await inquirer.default.prompt([
      {
        type: "editor",
        name: "editedMessage",
        message: "请编辑提交信息:",
        default: initialText,
      },
    ]);

    return editedMessage.trim();
  } finally {
    // 清理临时文件
    try {
      unlinkSync(tempFile);
    } catch (error) {
      // 忽略清理错误
    }
  }
}

/**
 * 显示提交信息预览
 */
function displayCommitPreview(message: string, index?: number): void {
  const lines = message.split("\n");
  const title = lines[0];
  const body = lines.slice(1).join("\n").trim();

  if (typeof index === "number") {
    console.log(chalk.cyan(`\n选项 ${index + 1}:\n`));
  } else {
    console.log(chalk.cyan("\n提交信息预览:\n"));
  }

  console.log(chalk.green(`  ${title}`));

  if (body) {
    console.log();
    body.split("\n").forEach((line) => {
      console.log(chalk.green(`  ${line}`));
    });
  }
  console.log();
}

/**
 * 处理提交流程
 */
async function handleCommitFlow(selectedMessage: string): Promise<void> {
  displayCommitPreview(selectedMessage);

  const inquirer = await import("inquirer");
  const { action } = await inquirer.default.prompt([
    {
      type: "list",
      name: "action",
      message: "请选择操作:",
      choices: [
        { name: "✅ 直接提交", value: "commit" },
        { name: "✏️  编辑后提交", value: "edit" },
        { name: "📋 复制到剪贴板", value: "copy" },
        { name: "🗑️  取消操作", value: "cancel" },
      ],
      default: "commit",
    },
  ]);

  switch (action) {
    case "commit":
      await executeCommit(selectedMessage);
      break;

    case "edit":
      console.log(chalk.blue("\n📝 编辑提交信息..."));
      const editedMessage = await editText(selectedMessage);

      if (!editedMessage) {
        console.log(chalk.yellow("🍃  提交信息为空，已取消操作"));
        return;
      }

      if (editedMessage === selectedMessage) {
        console.log(chalk.gray("🍃  提交信息未变更"));
      } else {
        console.log(chalk.green("✨ 提交信息已更新"));
      }
      await handleCommitFlow(editedMessage);
      break;

    case "copy":
      await copyCommitMsgToClipboard(selectedMessage, "提交信息");
      console.log(chalk.blue("👋 操作完成，可直接复制到命令行，手动提交"));
      break;

    case "cancel":
      console.log(chalk.gray("👋 已取消操作"));
      break;
  }
}

/**
 * 执行函数并屏蔽输出
 */
async function executeWithSilentConsole<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  // 屏蔽输出
  // console.log = () => {};
  // console.warn = () => {};
  // console.error = () => {};

  try {
    return await fn();
  } finally {
    // 无论成功还是失败都恢复输出
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

/**
 * 执行git提交
 */
async function executeCommit(message: string): Promise<void> {
  const commitSpinner = ora({
    text: "正在执行提交...",
    spinner: "dots",
    color: "blue",
  }).start();

  try {
    // 停止spinner以显示git输出
    commitSpinner.stop();

    console.log(chalk.blue("🐧 执行提交..."));

    // 使用 stdio: 'inherit' 来显示 git hook 的输出
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      stdio: "inherit",
      encoding: "utf8",
    });

    console.log(chalk.green("✅ 提交成功！"));

    // 显示提交信息
    try {
      const commitHash = execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
      console.log(chalk.gray(`📝 提交哈希: ${commitHash}`));
    } catch (error) {
      // 忽略获取哈希失败
    }
  } catch (error) {
    console.log(chalk.red("🗑️ 提交失败"));

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`错误详情: ${errorMessage}`));

    // 自动复制提交信息到剪贴板
    await copyCommitMsgToClipboard(message, "提交信息");
    console.log(
      chalk.yellow('💬 提示: 可以手动执行 git commit -m "..." 完成提交')
    );

    process.exit(1);
  }
}

// 版本信息
program
  .name("ai-commit")
  .description("🤖 AI智能提交消息生成器 - 基于代码变更自动生成规范化提交信息")
  .version("1.0.12");

// 基本使用指令
program
  .option("-a, --all", "暂存所有跟踪文件的更改并提交")
  .option("-g, --generate <number>", "生成提交信息的数量，默认为1", "1")
  .option("-s, --simple", "简洁模式，只生成提交标题，不包含详细描述")
  .action(async (options) => {
    try {
      // 显示欢迎信息
      console.log(chalk.gray("\n🐧 AI 智能信息提交生成器"));
      console.log(chalk.gray("=".repeat(30)));
      console.log();

      // 如果指定了--all，先暂存所有文件
      if (options.all) {
        const stagingSpinner = ora({
          text: "正在暂存所有跟踪文件...",
          spinner: "dots",
          color: "yellow",
        }).start();

        try {
          execSync("git add -u", { stdio: "pipe" });
          stagingSpinner.succeed(chalk.green("📝 文件暂存完成"));
        } catch (error) {
          stagingSpinner.fail(chalk.red("🗑️ 暂存文件失败"));
          throw error;
        }
      }

      // 检查是否有暂存的文件
      const checkSpinner = ora({
        text: "检查暂存文件...",
        spinner: "dots",
        color: "cyan",
      }).start();

      try {
        const { files, count } = await checkStagedFiles();

        if (count === 0) {
          checkSpinner.fail(chalk.red("🍃 没有暂存的文件"));
          console.log(
            chalk.yellow("💬 请先使用 git add 暂存文件或使用 --all 选项")
          );
          process.exit(1);
        }

        // 更友好的进度提示
        checkSpinner.text = `🔍 正在分析 ${count} 个暂存文件...`;

        // 短暂延迟以让用户看到文件数量
        await new Promise((resolve) => setTimeout(resolve, 500));

        checkSpinner.succeed(chalk.green(`📁 已检测到 ${count} 个暂存文件`));

        // 显示文件列表（前5个）
        if (files.length > 0) {
          console.log(chalk.dim("   变更的文件:"));
          files.slice(0, 5).forEach((file) => {
            console.log(chalk.dim(`   ├─ ${file}`));
          });
          if (files.length > 5) {
            console.log(
              chalk.dim(`   └─ ...还有 ${files.length - 5} 个文件\n`)
            );
          }
        }
      } catch (error) {
        checkSpinner.fail(chalk.red("🗑️ 无法检查暂存文件\n"));
        console.log(chalk.yellow("💬 请确保当前目录是Git仓库"));
        process.exit(1);
      }

      // 准备生成配置
      const generateCount = parseInt(options.generate) || 1;
      // 限制最大候选数量为 5
      const maxCandidates = Math.min(generateCount, 5);

      // 如果用户要求的数量超过5，给出提示
      if (generateCount > 5) {
        console.log(chalk.blue("💬 候选数量最多为 5 个"));
      }

      // 如果开启了简洁模式，给出提示
      if (options.simple) {
        console.log(
          chalk.blue("📄 简洁模式：将只生成提交标题，不包含详细描述")
        );
      }

      let branchContext: BranchContextData | null = null;

      // 尝试读取 Modular Dev 上下文配置
      console.log(chalk.blue("\n🔍 正在读取 Modular Dev 上下文配置..."));
      const modularContext = await readModularContext();

      if (modularContext) {
        branchContext = await getCurrentBranchContext(modularContext);
        if (branchContext) {
          console.log(chalk.green("✅ 已加载Modular Dev上下文配置\n"));
        } else {
          console.log(chalk.yellow("🍃 当前分支没有配置上下文信息\n"));
          console.log(
            chalk.yellow(
              "💬  建议使用 Modular Dev 为当前分支配置开发上下文，以获得更好的提交信息生成效果\n"
            )
          );
          // process.exit(1);
        }
      } else {
        console.log(chalk.yellow("🍃 未找到Modular Dev上下文配置\n"));
        console.log(
          chalk.yellow(
            "💬  建议使用 Modular Dev 为当前分支配置开发上下文，以获得更好的提交信息生成效果\n"
          )
        );
        // process.exit(1);
      }

      const generationConfig = {
        maxCandidates,
        includeBody: !options.simple,
      };

      // 生成提交信息
      const generateSpinner = ora({
        text: "🐧 AI 正在分析代码变更并生成提交信息...",
        spinner: "dots",
        color: "cyan",
      }).start();

      let result;
      try {
        const { generateCommit } = await import("./index");

        import("inquirer");
        result = await executeWithSilentConsole(async () => {
          const gitRootPath = await GitUtils.getGitRootPath();
          return await generateCommit(
            gitRootPath,
            branchContext || undefined,
            generationConfig
          );
        });
        generateSpinner.succeed(chalk.green("✨ 提交信息生成完成"));
      } catch (error) {
        generateSpinner.fail(chalk.red("🗑️ 生成提交信息失败"));
        throw error;
      }

      if (!result.candidates || result.candidates.length === 0) {
        console.log(chalk.red("🗑️ 没有生成候选提交消息"));
        process.exit(1);
      }

      console.log(
        chalk.green(`\n🐧 成功生成 ${result.candidates.length} 个提交信息\n`)
      );

      let selectedMessage: string;

      if (result.candidates.length === 1) {
        selectedMessage = result.candidates[0].fullMessage;
        await handleCommitFlow(selectedMessage);
      } else {
        // 显示所有候选选项
        console.log(chalk.cyan("🐧 生成的候选提交消息:"));

        result.candidates.forEach((candidate, index) => {
          displayCommitPreview(candidate.fullMessage, index);
        });

        const inquirer = await import("inquirer");
        const { selectedIndex } = await inquirer.default.prompt([
          {
            type: "list",
            name: "selectedIndex",
            message: "请选择一个提交消息:",
            choices: [
              ...result.candidates.map((candidate, index) => ({
                name: `${index + 1}. ${candidate.fullMessage.split("\n")[0]}`,
                value: index,
              })),
            ],
          },
        ]);

        selectedMessage = result.candidates[selectedIndex].fullMessage;
        await handleCommitFlow(selectedMessage);
      }
    } catch (error) {
      console.error(
        chalk.red("\n🗑️ 错误:"),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// 配置管理指令
const configCommand = program
  .command("config")
  .description("管理AI Commit配置");

configCommand
  .command("get [keys...]")
  .description("获取配置值")
  .action(async (keys) => {
    try {
      const config = await getConfig({}, true);

      if (keys.length === 0) {
        console.log(chalk.blue("\n📋 当前配置:"));
        console.log(chalk.blue("=".repeat(30)));

        for (const [key, value] of Object.entries(config)) {
          console.log(
            chalk.cyan(`  ${key}`) + chalk.gray("=") + chalk.white(`${value}`)
          );
        }
      } else {
        console.log(chalk.blue("\n🔍 配置查询结果:"));
        for (const key of keys) {
          if (hasOwn(config, key)) {
            console.log(
              chalk.green(`  ✓ ${key}=`) +
                chalk.white(`${config[key as keyof typeof config]}`)
            );
          } else {
            console.log(chalk.gray(`  ○ ${key}=`) + chalk.dim("<未设置>"));
          }
        }
      }
    } catch (error) {
      console.error(
        chalk.red("🗑️ 获取配置失败:"),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

configCommand
  .command("set <keyValues...>")
  .description("设置配置项（格式: key=value）")
  .action(async (keyValues) => {
    try {
      const pairs = keyValues.map((keyValue: string) => {
        const [key, value] = keyValue.split("=");
        if (!key || value === undefined) {
          throw new Error(
            `Invalid format: ${keyValue}. Expected format: key=value`
          );
        }
        return [key, value] as [string, string];
      });

      const spinner = ora({
        text: "正在更新配置...",
        spinner: "dots",
        color: "green",
      }).start();

      await setConfigs(pairs);

      spinner.succeed(chalk.green("⚙️ 配置更新成功"));

      console.log(chalk.blue("\n✅ 已更新的配置:"));
      for (const [key, value] of pairs) {
        console.log(
          chalk.cyan(`  ${key}`) + chalk.gray("=") + chalk.white(`${value}`)
        );
      }

      console.log(chalk.gray("\n📁 配置文件位置: ~/.ai-commit"));
    } catch (error) {
      console.error(
        chalk.red("🗑️ 设置配置失败:"),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

export default program;
