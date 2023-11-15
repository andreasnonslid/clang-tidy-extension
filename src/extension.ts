import * as vscode from 'vscode';
import {
  startClangTidy,
  cancelClangTidy,
} from './clangTidyManager';
import { isValidConfiguration } from './configManager';
import { clearDiagnosticsForClosedFile } from './diagnostic'
import {
  getActiveFilePath,
  getCurrentWorkspaceDirectory
} from './helpers';

const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
const outputChannel = vscode.window.createOutputChannel('Clang-Tidy Output');
const diagnosticCollection = vscode.languages.createDiagnosticCollection('clang-tidy-on-active-file');

export function activate(context: vscode.ExtensionContext) {
  statusBar.command = 'clang-tidy-on-active-file.run';
  statusBar.text = "⁜";
  statusBar.tooltip = "Clang-Tidy hasn't been run";
  statusBar.show();

  context.subscriptions.push(statusBar);

  let disposable = vscode.commands.registerCommand('clang-tidy-on-active-file.run', async () => {
    // Retrieve and validate configuration settings
    statusBar.tooltip = "Clang-Tidy is running";
    const configPath = vscode.workspace.getConfiguration('clang-tidy-on-active-file').get('configPath') as string;
    const optionalArgs = vscode.workspace.getConfiguration('clang-tidy-on-active-file').get('optionalArgs') as string;
    const activeFileInEditorPath = getActiveFilePath();
    const workspaceDir = getCurrentWorkspaceDirectory();

    if (!isValidConfiguration(configPath, activeFileInEditorPath, workspaceDir)) return;

    // Proceed only if activeFileInEditorPath and workspaceDir are defined
    if (activeFileInEditorPath && workspaceDir) {
      startClangTidy(outputChannel, diagnosticCollection, workspaceDir, activeFileInEditorPath, configPath, optionalArgs);
    }
    statusBar.tooltip = "Clang-Tidy is done";
  });

  // Register onSave event to cancel clang-tidy
  let disposableSave = vscode.workspace.onWillSaveTextDocument(() => {
    cancelClangTidy();
    statusBar.tooltip = "Clang-Tidy was cancelled";
  });

  // Register onDidSave event to restart clang-tidy
  let disposableDidSave = vscode.workspace.onDidSaveTextDocument(() => {
    const autoRunOnSave = vscode.workspace.getConfiguration('clang-tidy-on-active-file').get('autoRunOnSave') as boolean;
    if (autoRunOnSave) {
      vscode.commands.executeCommand('clang-tidy-on-active-file.run');
    }
  });

  let disposableCloseDoc = vscode.workspace.onDidCloseTextDocument((e) => {
    clearDiagnosticsForClosedFile(diagnosticCollection, e);
  });

  context.subscriptions.push(disposable, disposableSave, disposableDidSave, disposableCloseDoc);
}



export function deactivate() {
  statusBar.dispose();
  outputChannel.dispose();
  diagnosticCollection.dispose();
}
