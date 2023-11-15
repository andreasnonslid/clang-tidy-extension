import * as vscode from 'vscode';
import {
  startClangTidy,
  cancelClangTidy
} from './clangTidyManager';
import { isValidConfiguration } from './configManager';
import {
  getActiveFilePath,
  getCurrentWorkspaceDirectory
} from './helpers';

export function activate(context: vscode.ExtensionContext) {
  // Create a new output channel
  const outputChannel = vscode.window.createOutputChannel('Clang-Tidy Output');
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('clang-tidy');

  let disposable = vscode.commands.registerCommand('clang-tidy.run', async () => {
    // Retrieve and validate configuration settings
    const configPath = vscode.workspace.getConfiguration('clang-tidy').get('configPath') as string;
    const optionalArgs = vscode.workspace.getConfiguration('clang-tidy').get('optionalArgs') as string;
    const activeFileInEditorPath = getActiveFilePath();
    const workspaceDir = getCurrentWorkspaceDirectory();

    if (!isValidConfiguration(configPath, activeFileInEditorPath, workspaceDir)) return;

    // Proceed only if activeFileInEditorPath and workspaceDir are defined
    if (activeFileInEditorPath && workspaceDir) {
      startClangTidy(outputChannel, diagnosticCollection, workspaceDir, activeFileInEditorPath, configPath, optionalArgs);
    }
  });

  // Register onSave event to cancel clang-tidy
  let disposableSave = vscode.workspace.onWillSaveTextDocument(() => {
    cancelClangTidy();
  });

  // Register onDidSave event to restart clang-tidy
  let disposableDidSave = vscode.workspace.onDidSaveTextDocument(() => {
    const autoRunOnSave = vscode.workspace.getConfiguration('clang-tidy').get('autoRunOnSave') as boolean;
    // If enabled and the document is a C/C++ file, run the command
    if (autoRunOnSave) {
      vscode.commands.executeCommand('clang-tidy.run');
    }
  });

  context.subscriptions.push(disposable, disposableSave, disposableDidSave);
}



export function deactivate() { }
