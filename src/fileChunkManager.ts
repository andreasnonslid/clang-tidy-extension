import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { readFileAsync, writeFileAsync } from "./fileUtils";
import { outputChannel } from "./extension";

export async function createChunkFiles(
  filePath: string,
  fileContents: string,
  chunkSize: number,
): Promise<string[]> {
  const lines = fileContents.split("\n");
  const chunkFilePaths: string[] = [];

  for (let i = 0; i < lines.length; i += chunkSize) {
    try {
      const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
      const chunkFilePath = `${filePath}.chunk${i / chunkSize}`;
      await writeFileAsync(chunkFilePath, chunkLines.join("\n"));
      chunkFilePaths.push(chunkFilePath);
    } catch (err) {
      console.error(`Failed to create/write chunk file at index ${i}:`, err);
      // Decide: continue with next chunk, or throw error to stop process
      // For now, we'll continue with the next chunk
    }
  }

  return chunkFilePaths;
}

export async function deleteChunkFiles(
  chunkFilePaths: string[],
): Promise<void> {
  const deletePromises = chunkFilePaths.map((filePath) => {
    return new Promise<void>((resolve) => {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`Error deleting temporary file ${filePath}: ${err}`);
        }
        resolve(); // Resolve even if there was an error
      });
    });
  });

  await Promise.allSettled(deletePromises);
}

export async function prepareAndCreateChunkFiles(
  filePath: string,
): Promise<string[]> {
  const fileContents = await readFileAsync(filePath);
  const config = vscode.workspace.getConfiguration("clang-tidy-on-active-file");
  const chunkSize = config.get("chunkSize") as number;
  const useHomeForChunks = config.get("useHome") as boolean;

  // If chunkSize is 0 or -1, treat the whole file as a single chunk
  let fileName = path.basename(filePath);
  if (useHomeForChunks) {
    const homeDirectory = process.env.HOME || process.env.USERPROFILE;
    fileName = path.join(homeDirectory as string, `${fileName}`);
  } else {
    fileName = filePath;
  }

  if (chunkSize <= 0) {
    const chunkFilePath = `${fileName}.chunk0`;
    await writeFileAsync(chunkFilePath, fileContents);
    return [chunkFilePath];
  }

  return createChunkFiles(fileName, fileContents, chunkSize);
}
