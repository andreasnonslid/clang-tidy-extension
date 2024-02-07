import * as vscode from "vscode";
import { startClangTidy, cancelClangTidy } from "./clangTidyManager";
import { isValidConfiguration } from "./configManager";
import { clearDiagnosticsForClosedFile } from "./diagnostic";
import { getActiveFilePath, getCurrentWorkspaceDirectory } from "./helpers";

export const statusBar = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100,
);
export const outputChannel =
  vscode.window.createOutputChannel("Clang-Tidy Output");
const diagnosticCollection = vscode.languages.createDiagnosticCollection(
  "clang-tidy-on-active-file",
);

export function activate(context: vscode.ExtensionContext) {
  statusBar.command = "clang-tidy-on-active-file.run";
  statusBar.text = "⚙";
  statusBar.tooltip = "Clang-Tidy idle";
  statusBar.show();

  context.subscriptions.push(statusBar);

  const disposable = vscode.commands.registerCommand(
    "clang-tidy-on-active-file.run",
    async () => {
      // Retrieve and validate configuration settings
      const configPath = vscode.workspace
        .getConfiguration("clang-tidy-on-active-file")
        .get("configPath") as string;
      const optionalArgs = vscode.workspace
        .getConfiguration("clang-tidy-on-active-file")
        .get("optionalArgs") as string;
      const activeFileInEditorPath = getActiveFilePath();
      const workspaceDir = getCurrentWorkspaceDirectory();

      if (
        !isValidConfiguration(configPath, activeFileInEditorPath, workspaceDir)
      ) {
        return;
      }

      // Proceed only if activeFileInEditorPath and workspaceDir are defined
      if (activeFileInEditorPath && workspaceDir) {
        startClangTidy(
          outputChannel,
          diagnosticCollection,
          workspaceDir,
          activeFileInEditorPath,
          configPath,
          optionalArgs,
        );
      }
    },
  );

  // Register onSave event to cancel clang-tidy
  const disposableSave = vscode.workspace.onWillSaveTextDocument(() => {
    cancelClangTidy();
    statusBar.tooltip = "Clang-Tidy was cancelled";
  });

  // Register onDidSave event to restart clang-tidy
  const disposableDidSave = vscode.workspace.onDidSaveTextDocument(() => {
    const autoRunOnSave = vscode.workspace
      .getConfiguration("clang-tidy-on-active-file")
      .get("autoRunOnSave") as boolean;
    if (autoRunOnSave) {
      vscode.commands.executeCommand("clang-tidy-on-active-file.run");
    }
  });

  const disposableCloseDoc = vscode.workspace.onDidCloseTextDocument((e) => {
    clearDiagnosticsForClosedFile(diagnosticCollection, e);
  });

  context.subscriptions.push(
    disposable,
    disposableSave,
    disposableDidSave,
    disposableCloseDoc,
  );
}

export function deactivate() {
  statusBar.dispose();
  outputChannel.dispose();
  diagnosticCollection.dispose();
}
