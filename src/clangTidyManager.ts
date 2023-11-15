import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import {
    spawn,
    ChildProcess
} from 'child_process';
import { updateDiagnostics } from './diagnostic';
import { checkFilePath } from './helpers';
import {
    prepareAndCreateChunkFiles,
    deleteChunkFiles,
} from './fileChunkManager';
import {
    createTempCompileCommands,
    removeTempCompileCommands
} from './fileUtils';


let clangTidyProcesses: ChildProcess[] = [];
let chunkFilePaths: string[] = [];

function runClangTidyOnChunk(chunkFilePath: string, configPath: string, optionalArgs: string[], workspaceDir: string): Promise<string> {
    return new Promise((resolve, _) => {
        var tempCompileCommands = false;
        var args = [chunkFilePath, `--config-file=${configPath}`]
        if (checkFilePath(workspaceDir + '/build/compile_commands.json')) {
            args = args.concat(`-p=${workspaceDir}/build/compile_commands.json`);
        }
        else {
            createTempCompileCommands(workspaceDir);
            args = args.concat(`-p=${workspaceDir}/compile_commands.json`);
            tempCompileCommands = true;
            if (vscode.workspace.getConfiguration('clang-tidy').get('displayInfoPopups', true)) {
                vscode.window.showWarningMessage('Using a default compile_commands.json as ./build/compile_commands.json wasn\'t found.');
            }
        }
        args = args.concat(optionalArgs);
        const clangTidyProcess = spawn('clang-tidy', args, { cwd: workspaceDir });
        clangTidyProcesses.push(clangTidyProcess);  // Add the process to the array

        let output = '';
        clangTidyProcess.stdout.on('data', data => output += data.toString());
        clangTidyProcess.stderr.on('data', data => output += data.toString());

        clangTidyProcess.on('close', _ => {  // Remove the process from the array
            const processIndex = clangTidyProcesses.indexOf(clangTidyProcess);
            if (processIndex > -1) {
                clangTidyProcesses.splice(processIndex, 1);
            }
            fs.unlink(chunkFilePath, err => {
                if (err) console.error(`Error deleting temporary file ${chunkFilePath}: ${err}`);
            });
            // console.log("clang-tidy exit code: " + code);
            removeTempCompileCommands(workspaceDir);
            resolve(output); // resolve promise
        });
    });
}


async function analyzeChunks(chunkFilePaths: string[], configPath: string, optionalArgs: string[], workspaceDir: string, maxConcurrentTasks: number, outputChannel: vscode.OutputChannel): Promise<string[]> {
    let activePromises = 0;
    let results: string[] = [];
    let index = 0;

    const analyzeNextChunk = async () => {
        if (index < chunkFilePaths.length) {
            const chunkFilePath = chunkFilePaths[index++];
            const promise = runClangTidyOnChunk(chunkFilePath, configPath, optionalArgs, workspaceDir)
                .then(output => {
                    results.push(output);
                })
                .catch(error => {
                    outputChannel.appendLine(`Error processing ${chunkFilePath}: ${error.message}`);
                    console.error(`Error processing ${chunkFilePath}:`, error);
                    return ''; // Return an empty string in case of error
                })
                .finally(() => {
                    activePromises--;
                    return analyzeNextChunk(); // Spawn the next task as soon as one finishes
                });

            activePromises++;
            return promise;
        }
    };

    const initialPromises = Array.from({ length: Math.min(maxConcurrentTasks, chunkFilePaths.length) }, analyzeNextChunk);

    await Promise.all(initialPromises);
    return results;
}


async function performChunkAnalysis(chunkFilePaths: string[], configPath: string, optionalArgs: string, workspaceDir: string, maxConcurrentTasks: number, outputChannel: vscode.OutputChannel): Promise<string> {
    const optionalArgsArray = optionalArgs ? optionalArgs.split(' ') : [];
    const results = await analyzeChunks(chunkFilePaths, configPath, optionalArgsArray, workspaceDir, maxConcurrentTasks, outputChannel);
    return results.join('\n');
}

export async function startClangTidy(outputChannel: vscode.OutputChannel, diagnosticCollection: vscode.DiagnosticCollection, workspaceDir: string, filePath: string, configPath: string, optionalArgs: string) {
    console.time(`Clang Tidy Time Start`); // Start timer

    vscode.window.setStatusBarMessage(`Clang Tidy (Running)`);

    const maxCoresConfig = vscode.workspace.getConfiguration('clang-tidy').get('maxCores', -1);
    const cpuCount = os.cpus().length;
    const maxConcurrentTasks = maxCoresConfig > 0 ? Math.min(maxCoresConfig, cpuCount) : Math.max(1, Math.floor(cpuCount / 2));

    try {
        const chunkSize = vscode.workspace.getConfiguration('clang-tidy').get('chunkSize') as number;

        const createdChunkFilePaths = await prepareAndCreateChunkFiles(filePath);
        chunkFilePaths = createdChunkFilePaths; // Update the global chunkFilePaths array

        const combinedResults = await performChunkAnalysis(chunkFilePaths, configPath, optionalArgs, workspaceDir, maxConcurrentTasks, outputChannel);

        // Update diagnostics with the combined results
        updateDiagnostics(diagnosticCollection, combinedResults, filePath, chunkSize);

        // Delete chunk files
        await deleteChunkFiles(chunkFilePaths);
        chunkFilePaths = [];

    } catch (error) {
        if (error instanceof Error) {
            outputChannel.appendLine(`Error running Clang Tidy: ${error.message}`);
        } else {
            outputChannel.appendLine(`An unknown error occurred: ${JSON.stringify(error)}`);
        }
    } finally {
        vscode.window.setStatusBarMessage(`Clang Tidy (Done)`);
        console.timeEnd(`Clang Tidy Time Start`); // End timer
    }
}

export function cancelClangTidy() {
    clangTidyProcesses.forEach(process => process.kill());
    clangTidyProcesses = [];  // Clear the array after killing the processes

    // Delete chunk files if any
    if (chunkFilePaths.length > 0) {
        deleteChunkFiles(chunkFilePaths).catch(err => console.error("Error deleting chunk files during cancellation:", err));
        chunkFilePaths = [];
    }
    console.timeEnd(`Clang Tidy Time Start`); // End timer
}
