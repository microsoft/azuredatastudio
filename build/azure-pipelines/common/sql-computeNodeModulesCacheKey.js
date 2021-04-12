/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, '../../../');
function findFiles(location, pattern, result) {
    const entries = fs.readdirSync(path.join(ROOT, location));
    for (const entry of entries) {
        const entryPath = `${location}/${entry}`;
        let stat;
        try {
            stat = fs.statSync(path.join(ROOT, entryPath));
        }
        catch (err) {
            continue;
        }
        if (stat.isDirectory()) {
            findFiles(entryPath, pattern, result);
        }
        else {
            if (stat.isFile() && entry.endsWith(pattern)) {
                result.push(path.join(ROOT, entryPath));
            }
        }
    }
}
const shasum = crypto.createHash('sha1');
/**
 * Creating a sha hash of all the files that can cause packages to change/redownload.
 */
shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.yarnrc')));
shasum.update(fs.readFileSync(path.join(ROOT, 'remote/.yarnrc')));
// Adding all yarn.lock files into sha sum.
const result = [];
findFiles('', 'yarn.lock', result);
result.forEach(f => shasum.update(fs.readFileSync(f)));
// Add any other command line arguments
for (let i = 2; i < process.argv.length; i++) {
    shasum.update(process.argv[i]);
}
process.stdout.write(shasum.digest('hex'));
