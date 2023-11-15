import * as fs from 'fs';

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
