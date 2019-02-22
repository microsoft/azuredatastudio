/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var cp = require('child_process');
function yarnInstall(package) {
    cp.execSync("yarn add --no-lockfile " + package);
}
var product = require('../../../product.json');
var dependencies = product.dependencies || {};
Object.keys(dependencies).forEach(function (name) {
    var url = dependencies[name];
    yarnInstall(url);
});
