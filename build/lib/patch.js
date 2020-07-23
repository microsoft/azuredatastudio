/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
const cp = require("child_process");
const minimist = require("minimist");
const args = minimist(process.argv, {
    string: [
        'commit',
    ]
});
async function main() {
    var _a;
    const patchPath = path.join(__dirname, '..', 'patches');
    const files = await fs_1.promises.readdir(patchPath);
    const target = (_a = args.commit) !== null && _a !== void 0 ? _a : 'vsdistro/distro';
    console.log(`Using ${target} for vscode target to patch.`);
    for (const name of files) {
        const namePath = path.join(...name.split('.').slice(0, -1).join('.').split('_'));
        cp.spawnSync('git', ['fetch', 'vsdistro']);
        cp.spawnSync('git', ['checkout', target, '--', namePath]);
        cp.spawnSync('git', ['apply', '--ignore-space-change', '--ignore-whitespace', path.join(patchPath, name)]);
    }
}
main();
