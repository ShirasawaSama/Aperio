#!/usr/bin/env node
import { cac } from "cac";
import { runAdd } from "./add.js";
import { runAst } from "./ast.js";
import { runBuild } from "./build.js";
import { runCheck } from "./check.js";
import { runExplain } from "./explain.js";
import { runFetch } from "./fetch.js";
import { runFix } from "./fix.js";
import { runFmt } from "./fmt.js";
import { parseOutputFormat } from "./format_opt.js";
import { runInit } from "./init.js";
import { runRemove } from "./remove.js";
import { runTree } from "./tree.js";
import { runUpdate } from "./update.js";
import { runVendor } from "./vendor.js";

const cli = cac("aperio");

cli
  .command("check [files...]", "Run frontend checks")
  .option("--format <format>", "human|json|lsp", { default: "human" })
  .option("--mode <mode>", "auto|std|x86|loose", { default: "auto" })
  .action(async (files: string[] | string | undefined, options) => {
    const fileList = Array.isArray(files) ? files : files ? [files] : [];
    const exitCode = await runCheck(fileList, {
      format: parseOutputFormat(options.format),
      mode: options.mode,
    });
    process.exitCode = exitCode;
  });

cli
  .command("build [files...]", "Build input files")
  .option("--emit <emit>", "asm", { default: "asm" })
  .option("--format <format>", "human|json|lsp", { default: "human" })
  .option("--mode <mode>", "auto|std|x86|loose", { default: "auto" })
  .option("--target <target>", "win-x64", { default: "win-x64" })
  .option("--out-dir <dir>", "output directory")
  .action(async (files: string[] | string | undefined, options) => {
    const fileList = Array.isArray(files) ? files : files ? [files] : [];
    const emit = options.emit === "asm" ? "asm" : "asm";
    const target = options.target === "win-x64" ? "win-x64" : "win-x64";
    process.exitCode = await runBuild(fileList, {
      emit,
      format: parseOutputFormat(options.format),
      mode: options.mode,
      target,
      outDir: options.outDir,
    });
  });

cli.command("fmt [files...]", "Format files").action(async () => {
  process.exitCode = await runFmt();
});

cli.command("fix [files...]", "Apply fixes").action(async () => {
  process.exitCode = await runFix();
});

cli.command("ast <file>", "Print JSON AST").action(async (file: string) => {
  process.exitCode = await runAst(file);
});

cli.command("explain <code>", "Explain diagnostic code").action(async (code: string) => {
  process.exitCode = await runExplain(code);
});

cli.command("init", "Initialize project").action(async () => {
  process.exitCode = await runInit();
});
cli.command("add", "Add dependency").action(async () => {
  process.exitCode = await runAdd();
});
cli.command("remove", "Remove dependency").action(async () => {
  process.exitCode = await runRemove();
});
cli.command("update", "Update dependency graph").action(async () => {
  process.exitCode = await runUpdate();
});
cli.command("fetch", "Fetch dependencies").action(async () => {
  process.exitCode = await runFetch();
});
cli.command("vendor", "Vendor dependencies").action(async () => {
  process.exitCode = await runVendor();
});
cli.command("tree", "Show dependency tree").action(async () => {
  process.exitCode = await runTree();
});

cli.help();
cli.parse();
