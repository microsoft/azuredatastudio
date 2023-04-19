/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { dirs } = require('../../npm/dirs');
const ROOT = path.join(__dirname, '../../../');
const shasum = crypto.createHash('sha1');
shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.yarnrc')));
shasum.update(fs.readFileSync(path.join(ROOT, 'remote/.yarnrc')));
// Add `package.json` and `yarn.lock` files
for (let dir of dirs) {
    const packageJsonPath = path.join(ROOT, dir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    const relevantPackageJsonSections = {
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
        optionalDependencies: packageJson.optionalDependencies,
        resolutions: packageJson.resolutions
    };
    shasum.update(JSON.stringify(relevantPackageJsonSections));
    const yarnLockPath = path.join(ROOT, dir, 'yarn.lock');
    shasum.update(fs.readFileSync(yarnLockPath));
}
// Add any other command line arguments
for (let i = 2; i < process.argv.length; i++) {
    shasum.update(process.argv[i]);
}
process.stdout.write(shasum.digest('hex'));
