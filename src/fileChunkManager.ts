import * as vscode from 'vscode';
import * as fs from 'fs';

import {
    readFileAsync,
    writeFileAsync,
} from './fileUtils';

export async function createChunkFiles(filePath: string, fileContents: string, chunkSize: number): Promise<string[]> {
    const lines = fileContents.split('\n');
    let chunkFilePaths: string[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
        try {
            const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
            const chunkFilePath = `${filePath}.chunk${i / chunkSize}`;
            await writeFileAsync(chunkFilePath, chunkLines.join('\n'));
            chunkFilePaths.push(chunkFilePath);
        } catch (err) {
            console.error(`Failed to create/write chunk file at index ${i}:`, err);
            // Decide: continue with next chunk, or throw error to stop process
            // For now, we'll continue with the next chunk
        }
    }

    return chunkFilePaths;
}


export async function deleteChunkFiles(chunkFilePaths: string[]): Promise<void> {
    const deletePromises = chunkFilePaths.map(filePath => {
        return new Promise<void>((resolve) => {
            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error(`Error deleting temporary file ${filePath}: ${err}`);
                }
                resolve(); // Resolve even if there was an error
            });
        });
    });

    await Promise.allSettled(deletePromises);
}


export async function prepareAndCreateChunkFiles(filePath: string): Promise<string[]> {
    const fileContents = await readFileAsync(filePath);
    const chunkSize = vscode.workspace.getConfiguration('clang-tidy-on-active-file').get('chunkSize') as number;

    // If chunkSize is 0 or -1, treat the whole file as a single chunk
    if (chunkSize <= 0) {
        const chunkFilePath = `${filePath}.chunk0`;
        await writeFileAsync(chunkFilePath, fileContents);
        return [chunkFilePath];
    }

    return createChunkFiles(filePath, fileContents, chunkSize);
}
