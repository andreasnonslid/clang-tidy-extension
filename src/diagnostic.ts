import * as vscode from 'vscode';

export async function updateDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, stdout: string, filePath: string, chunkSize: number) {
  const diagnostics = parseClangOutput(stdout, chunkSize);
  const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  diagnosticCollection.set(textDocument.uri, diagnostics);
}

export function clearDiagnosticsForClosedFile(diagnosticCollection: vscode.DiagnosticCollection, textDocument: vscode.TextDocument): void {
  if (textDocument.uri.scheme === 'file') {
    diagnosticCollection.delete(textDocument.uri);
  }
}



// Assuming you have a regex pattern that matches the clang-tidy warning format + chunkX
const CLANG_WARNING_PATTERN = /([^:]+)\.chunk(\d+):(\d+):(\d+): warning: (.*)/;

function parseClangOutput(clangOutput: string, chunkSize: number): vscode.Diagnostic[] {
  let diagnostics: vscode.Diagnostic[] = [];
  const lines = clangOutput.split('\n');

  for (let line of lines) {
    console.log(line);
    const match = CLANG_WARNING_PATTERN.exec(line);
    if (match) {
      const [, filePathWithChunk, chunkIndexStr, lineStr, columnStr, message] = match;
      const chunkIndex = parseInt(chunkIndexStr, 10);
      const adjustedLineNumber = parseInt(lineStr, 10) - 1 + (chunkSize * chunkIndex); // Adjust line number
      const columnNumber = parseInt(columnStr, 10) - 1; // VSCode columns are 0-based

      const range = new vscode.Range(
        new vscode.Position(adjustedLineNumber, columnNumber),
        new vscode.Position(adjustedLineNumber, columnNumber)
      );
      const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);

      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}
