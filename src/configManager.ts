import * as vscode from "vscode";
import { checkFilePath, isActiveFileCOrCpp } from "./helpers";

export function isValidConfiguration(
  configPath: string,
  filePath: string | undefined,
  workspaceDir: string | undefined,
): boolean {
  const config = vscode.workspace.getConfiguration("clang-tidy-on-active-file");
  const displayInfoPopups = config.get("displayInfoPopups", true);
  const displayExtensionPopups = config.get("displayExtensionPopups", false);
  const chunkSize = config.get("chunkSize", -1);

  if (!configPath || !checkFilePath(configPath)) {
    if (displayInfoPopups) {
      vscode.window.showErrorMessage(
        'Please configure "configPath" for Clang-Tidy in your settings and ensure the path is correct.',
      );
    }
    return false;
  }

  if (!filePath || !isActiveFileCOrCpp()) {
    if (displayInfoPopups && displayExtensionPopups) {
      vscode.window.showErrorMessage(
        "The file in the active editor is not of the correct type for clang-tidy. Check the extensions configuration setting.",
      );
    }
    return false;
  }

  if (!workspaceDir) {
    if (displayInfoPopups) {
      vscode.window.showErrorMessage(
        "Make sure you are in a workspace/folder.",
      );
    }
    return false;
  }

  // Validate 'chunkSize' setting
  if (typeof chunkSize !== "number" || chunkSize <= -2) {
    if (displayInfoPopups) {
      vscode.window.showErrorMessage(
        'Invalid "chunkSize" setting in Clang-Tidy configuration. It must be a positive number.',
      );
    }
    return false;
  }

  return true;
}
