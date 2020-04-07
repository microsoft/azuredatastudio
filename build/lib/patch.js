/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
const cp = require("child_process");
async function main() {
    const patchPath = path.join(__dirname, '..', 'patches');
    const files = await fs_1.promises.readdir(patchPath);
    for (const name of files) {
        const namePath = path.join(...name.split('.').slice(0, -1).join('.').split('_'));
        cp.spawnSync('git', ['checkout', 'vsdistro/distro', '--', namePath]);
        cp.spawnSync('git', ['apply', '--ignore-space-change', '--ignore-whitespace', path.join(patchPath, name)]);
    }
}
main();
