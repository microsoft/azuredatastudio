/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-check
const path = require("path");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const rootDir = path.resolve(__dirname, '..', '..');
function runProcess(command, args = []) {
    return new Promise((resolve, reject) => {
        const child = child_process_1.spawn(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env });
        child.on('exit', err => !err ? resolve() : process.exit(err !== null && err !== void 0 ? err : 1));
        child.on('error', reject);
    });
}
async function exists(subdir) {
    try {
        await fs_1.promises.stat(path.join(rootDir, subdir));
        return true;
    }
    catch (_a) {
        return false;
    }
}
async function ensureNodeModules() {
    if (!(await exists('node_modules'))) {
        await runProcess(yarn);
    }
}
async function getElectron() {
    await runProcess(yarn, ['electron']);
}
async function ensureCompiled() {
    if (!(await exists('out'))) {
        await runProcess(yarn, ['compile']);
    }
}
async function main() {
    await ensureNodeModules();
    await getElectron();
    await ensureCompiled();
    // Can't require this until after dependencies are installed
    const { getBuiltInExtensions } = require('./builtInExtensions');
    await getBuiltInExtensions();
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
