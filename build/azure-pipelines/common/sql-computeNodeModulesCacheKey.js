/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const glob = require("glob");
const ROOT = path.join(__dirname, '../../../');
const shasum = crypto.createHash('sha1');
shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.yarnrc')));
shasum.update(fs.readFileSync(path.join(ROOT, 'remote/.yarnrc')));
// Adding all yarn.lock files into sha sum.
const files = glob.sync(`${ROOT}/**/yarn.lock`);
files.forEach(f => shasum.update(fs.readFileSync(f)));
// Add any other command line arguments
for (let i = 2; i < process.argv.length; i++) {
    shasum.update(process.argv[i]);
}
process.stdout.write(shasum.digest('hex'));
