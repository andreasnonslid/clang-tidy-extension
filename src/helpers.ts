import * as vscode from "vscode";
import * as fs from "fs";

// Function to check if the file exists, returns boolean
export function checkFilePath(filePath: string): boolean {
    if (fs.existsSync(filePath)) {
        return true;
    } else {
        vscode.window.showWarningMessage(`File not found: ${filePath}`);
        return false;
    }
}



export function getCurrentWorkspaceDirectory(): string | undefined {
    // Assuming that there is an open workspace (not just an open folder)
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}



export function getActiveFilePath(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;

    // If there's an active editor, get its document's URI
    if (activeEditor) {
        return activeEditor.document.uri.fsPath; // This gives the absolute file path
    } else {
        // If no editor is active, or no file is open
        return undefined;
    }
}



export function isActiveFileCOrCpp(): boolean {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        // Get the language ID of the current file
        const languageId = activeEditor.document.languageId;

        const extensionsString = vscode.workspace.getConfiguration('clang-tidy-on-active-file').get('extensions') as string;
        const extensionsArray = extensionsString.split(' ');

        return extensionsArray.some(e => e === languageId);
    } else {
        // No active editor
        return false;
    }
}
