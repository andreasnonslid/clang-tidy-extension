import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { updateDiagnostics } from "./diagnostic";
import { outputChannel } from "./extension";

import {
  prepareAndCreateChunkFiles,
  deleteChunkFiles,
} from "./fileChunkManager";
import {
  createTempCompileCommands,
  removeTempCompileCommands,
  findCompiledCommandsJson,
} from "./fileUtils";
import { statusBar } from "./extension";
import * as path from "path";

let clangTidyProcesses: ChildProcess[] = [];
let chunkFilePaths: string[] = [];

async function runClangTidyOnChunk(
  chunkFilePath: string,
  configPath: string,
  optionalArgs: string[],
  workspaceDir: string,
): Promise<string> {
  outputChannel.appendLine("Starting runClangTidyOnChunk");
  let args = [chunkFilePath, `--config-file=${configPath}`];
  outputChannel.appendLine("Initial args set");

  try {
    const filePath = await findCompiledCommandsJson(
      "compile_commands.json",
      workspaceDir,
      "build",
    );
    outputChannel.appendLine(`findCompiledCommandsJson resolved: ${filePath}`);

    if (filePath) {
      args = args.concat(`-p=${filePath}`);
      outputChannel.appendLine(`compile_commands.json found: ${filePath}`);
    } else {
      createTempCompileCommands(workspaceDir);
      const tempCompileCommandsPath = path.join(
        workspaceDir,
        "build",
        "compile_commands.json",
      );
      args = args.concat(`-p=${tempCompileCommandsPath}`);
      outputChannel.appendLine("Using temporary compile_commands.json");

      if (
        vscode.workspace
          .getConfiguration("clang-tidy-on-active-file")
          .get("displayInfoPopups", true)
      ) {
        vscode.window.showWarningMessage(
          "Using a default compile_commands.json as ./build/compile_commands.json wasn't found.",
        );
      }
    }
  } catch (error) {
    outputChannel.appendLine(`Error finding compile_commands.json: ${error}`);
    return Promise.reject(error); // Handle the error appropriately
  }

  // Concatenate optional arguments, skipping empty ones
  args = args.concat(optionalArgs.filter((arg) => arg !== ""));
  outputChannel.appendLine(`Final args: ${args.join(" ")}`);

  outputChannel.appendLine("Spawning clang-tidy process");
  const clangTidyProcess = spawn("clang-tidy", args, { cwd: workspaceDir });
  clangTidyProcesses.push(clangTidyProcess);

  let output = "";
  clangTidyProcess.stdout.on("data", (data) => {
    const dataStr = data.toString();
    output += dataStr;
    outputChannel.appendLine(`stdout: ${dataStr}`);
  });
  clangTidyProcess.stderr.on("data", (data) => {
    const dataStr = data.toString();
    output += dataStr;
    outputChannel.appendLine(`stderr: ${dataStr}`);
  });

  return new Promise((resolve) => {
    clangTidyProcess.on("close", (code) => {
      outputChannel.appendLine(`clang-tidy process closed with code: ${code}`);
      const processIndex = clangTidyProcesses.indexOf(clangTidyProcess);
      if (processIndex > -1) {
        clangTidyProcesses.splice(processIndex, 1);
      }
      fs.unlink(chunkFilePath, (err) => {
        if (err) {
          console.error(
            `Error deleting temporary file ${chunkFilePath}: ${err}`,
          );
          outputChannel.appendLine(
            `Error deleting temporary file ${chunkFilePath}: ${err}`,
          );
        }
      });
      if (removeTempCompileCommands) {
        removeTempCompileCommands(workspaceDir);
      }
      resolve(output); // Resolve with the output
    });
  });
}

async function analyzeChunks(
  chunkFilePaths: string[],
  configPath: string,
  optionalArgs: string[],
  workspaceDir: string,
  maxConcurrentTasks: number,
  outputChannel: vscode.OutputChannel,
): Promise<string[]> {
  const results: string[] = [];
  let index = 0;

  const analyzeNextChunk = async () => {
    if (index < chunkFilePaths.length) {
      const chunkFilePath = chunkFilePaths[index++];
      const promise = runClangTidyOnChunk(
        chunkFilePath,
        configPath,
        optionalArgs,
        workspaceDir,
      )
        .then((output) => {
          results.push(output);
        })
        .catch((error) => {
          outputChannel.appendLine(
            `Error processing ${chunkFilePath}: ${error.message}`,
          );
          console.error(`Error processing ${chunkFilePath}:`, error);
          return ""; // Return an empty string in case of error
        })
        .finally(() => {
          return analyzeNextChunk(); // Spawn the next task as soon as one finishes
        });

      return promise;
    }
  };

  const initialPromises = Array.from(
    { length: Math.min(maxConcurrentTasks, chunkFilePaths.length) },
    analyzeNextChunk,
  );

  await Promise.all(initialPromises);
  return results;
}

async function performChunkAnalysis(
  chunkFilePaths: string[],
  configPath: string,
  optionalArgs: string,
  workspaceDir: string,
  maxConcurrentTasks: number,
  outputChannel: vscode.OutputChannel,
): Promise<string> {
  const optionalArgsArray = optionalArgs ? optionalArgs.split(" ") : [];
  const results = await analyzeChunks(
    chunkFilePaths,
    configPath,
    optionalArgsArray,
    workspaceDir,
    maxConcurrentTasks,
    outputChannel,
  );
  return results.join("\n");
}

export async function startClangTidy(
  outputChannel: vscode.OutputChannel,
  diagnosticCollection: vscode.DiagnosticCollection,
  workspaceDir: string,
  filePath: string,
  configPath: string,
  optionalArgs: string,
) {
  console.time(`Clang Tidy Time Start`); // Start timer
  statusBar.tooltip = "Clang-Tidy is running";
  const maxCoresConfig = vscode.workspace
    .getConfiguration("clang-tidy-on-active-file")
    .get("maxCores", -1);
  const cpuCount = os.cpus().length;
  const maxConcurrentTasks =
    maxCoresConfig > 0
      ? Math.min(maxCoresConfig, cpuCount)
      : Math.max(1, Math.floor(cpuCount / 2));

  try {
    const chunkSize = vscode.workspace
      .getConfiguration("clang-tidy-on-active-file")
      .get("chunkSize") as number;

    const createdChunkFilePaths = await prepareAndCreateChunkFiles(filePath);
    chunkFilePaths = createdChunkFilePaths; // Update the global chunkFilePaths array

    const combinedResults = await performChunkAnalysis(
      chunkFilePaths,
      configPath,
      optionalArgs,
      workspaceDir,
      maxConcurrentTasks,
      outputChannel,
    );

    // Update diagnostics with the combined results
    updateDiagnostics(
      diagnosticCollection,
      combinedResults,
      filePath,
      chunkSize,
    );

    // Delete chunk files
    await deleteChunkFiles(chunkFilePaths);
    chunkFilePaths = [];

    statusBar.tooltip = "Clang-Tidy is done";
  } catch (error) {
    if (error instanceof Error) {
      outputChannel.appendLine(`Error running Clang Tidy: ${error.message}`);
    } else {
      outputChannel.appendLine(
        `An unknown error occurred: ${JSON.stringify(error)}`,
      );
    }
    statusBar.tooltip = "Clang-Tidy failed";
  } finally {
    console.timeEnd(`Clang Tidy Time Start`); // End timer
  }
}

export function cancelClangTidy() {
  clangTidyProcesses.forEach((process) => process.kill());
  clangTidyProcesses = []; // Clear the array after killing the processes

  // Delete chunk files if any
  if (chunkFilePaths.length > 0) {
    deleteChunkFiles(chunkFilePaths).catch((err) =>
      console.error("Error deleting chunk files during cancellation:", err),
    );
    chunkFilePaths = [];
  }
  console.timeEnd(`Clang Tidy Time Start`); // End timer
}
