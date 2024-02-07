import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { outputChannel } from "./extension";

// Promise-based readFile function
export function readFileAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

// Promise-based writeFile function
export function writeFileAsync(filePath: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function createTempCompileCommands(
  workspaceDir: string,
  sourceFiles: string[] = ["main.cpp"],
  compilerCommand: string = "clang++ -std=c++20",
): void {
  // Define the path to the compile_commands.json file within the 'build' directory
  const compileCommandsPath = path.join(
    workspaceDir,
    "build",
    "compile_commands.json",
  );

  // Map each source file to a compile command entry
  const compileCommandsContent = sourceFiles.map((sourceFile) => ({
    directory: workspaceDir,
    command: `${compilerCommand} ${sourceFile}`,
    file: path.join(workspaceDir, sourceFile),
  }));

  // Ensure the 'build' directory exists
  const buildDirPath = path.join(workspaceDir, "build");
  if (!fs.existsSync(buildDirPath)) {
    try {
      fs.mkdirSync(buildDirPath);
    } catch (err) {
      console.error("Error creating build directory:", err);
      return; // Exit the function on error
    }
  }

  // Write the compile_commands.json content to the file
  try {
    fs.writeFileSync(
      compileCommandsPath,
      JSON.stringify(compileCommandsContent, null, 2),
      "utf-8",
    );
    console.log(`compile_commands.json created at ${compileCommandsPath}`);
  } catch (err) {
    console.error("Error writing compile_commands.json:", err);
  }
}

export function removeTempCompileCommands(workspaceDir: string): void {
  const compileCommandsPath = path.join(workspaceDir, "compile_commands.json");

  // Check if the file exists before trying to delete it
  if (fs.existsSync(compileCommandsPath)) {
    fs.unlinkSync(compileCommandsPath);
  }
}

export async function findCompiledCommandsJson(
  searchString: string,
  rootDir: string,
  priorityDir: string | null = null,
): Promise<string | null> {
  // %TODO add some checks to handle infinite processing cases or other stuff in case it can happen
  async function searchDirectory(
    searchString: string,
    directory: string,
    priorityDir: string | null = null,
    rootRun: boolean,
  ): Promise<string | null> {
    const items = await fsPromises.readdir(directory, { withFileTypes: true });

    if (rootRun && priorityDir) {
      for (const item of items) {
        if (item.name === priorityDir) {
          const itemPath = path.join(directory, item.name);
          const foundPath = await searchDirectory(
            searchString,
            itemPath,
            priorityDir,
            false,
          );
          if (foundPath) {
            return foundPath; // Stop searching further if the file is found
          }
        }
      }
    }

    for (const item of items) {
      const itemPath = path.join(directory, item.name);
      if (item.isDirectory()) {
        // Recursively search in subdirectories
        const foundPath = await searchDirectory(
          searchString,
          itemPath,
          priorityDir,
          false,
        );
        if (foundPath) {
          return foundPath; // Stop searching further if the file is found
        }
      } else if (item.name === searchString) {
        outputChannel.appendLine(`Found path: ${itemPath}`);
        return itemPath; // Return the path if the file is found
      }
    }
    return null; // Return null if the file isn't found in this directory or subdirectories
  }

  return await searchDirectory(searchString, rootDir, priorityDir, true);
}
