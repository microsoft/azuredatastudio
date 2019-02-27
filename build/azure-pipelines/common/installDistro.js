"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const cp = require("child_process");
function yarnInstall(packageName) {
    cp.execSync(`yarn add --no-lockfile ${packageName}`);
}
const product = require('../../../product.json');
const dependencies = product.dependencies || {};
Object.keys(dependencies).forEach(name => {
    const url = dependencies[name];
    yarnInstall(url);
});
