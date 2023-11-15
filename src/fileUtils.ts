import * as fs from 'fs';
import * as path from 'path';

// Promise-based readFile function
export function readFileAsync(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

// Promise-based writeFile function
export function writeFileAsync(filePath: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, data, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export function createTempCompileCommands(workspaceDir: string): void {
    // Define the path to the compile_commands.json file
    const compileCommandsPath = path.join(workspaceDir, 'compile_commands.json');

    // Define the bare minimum content for compile_commands.json
    const compileCommandsContent = [
        {
            directory: workspaceDir,
            command: 'clang++ -std=c++17', // or other relevant compiler command
            file: path.join(workspaceDir, 'YOUR_SOURCE_FILE.cpp') // replace with the actual source file you want to analyze
        }
    ];

    // Ensure the 'build' directory exists
    const buildDirPath = path.join(workspaceDir, 'build');
    if (!fs.existsSync(buildDirPath)) {
        fs.mkdirSync(buildDirPath);
    }

    // Write the minimal compile_commands.json content to the file
    fs.writeFileSync(compileCommandsPath, JSON.stringify(compileCommandsContent, null, 2), 'utf-8');
}

export function removeTempCompileCommands(workspaceDir: string): void {
    const compileCommandsPath = path.join(workspaceDir, 'compile_commands.json');

    // Check if the file exists before trying to delete it
    if (fs.existsSync(compileCommandsPath)) {
        fs.unlinkSync(compileCommandsPath);
    }
}
