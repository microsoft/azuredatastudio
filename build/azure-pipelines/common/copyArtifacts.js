/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vfs = require("vinyl-fs");
const path = require("path");
const es = require("event-stream");
const fs = require("fs");
const files = [
    '.build/extensions/**/*.vsix',
    '.build/win32-x64/**/*.{exe,zip}',
    '.build/linux/sha256hashes.txt',
    '.build/linux/deb/amd64/deb/*.deb',
    '.build/linux/rpm/x86_64/*.rpm',
    '.build/linux/server/*',
    '.build/linux/archive/*',
    '.build/docker/*',
    '.build/darwin/*',
    '.build/version.json' // version information
];
async function main() {
    return new Promise((resolve, reject) => {
        const stream = vfs.src(files, { base: '.build', allowEmpty: true })
            .pipe(es.through(file => {
            const filePath = path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, 
            //Preserve intermediate directories after .build folder
            file.path.substr(path.resolve('.build').length + 1));
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.renameSync(file.path, filePath);
        }));
        stream.on('end', () => resolve());
        stream.on('error', e => reject(e));
    });
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
