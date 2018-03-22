/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let gulp = require('gulp');
let exec = require('child-process-promise').exec;
let color = require('gulp-color');

// CONSTANTS ///////////////////////////////////////////////////////////////
let packageVals = require('../package');

// HELPER FUNCTIONS ////////////////////////////////////////////////////////

let buildPackage = function(packageName) {
    // Make sure there are
    if (!packageVals.repository) {
        return Promise.reject("Repository field is not defined in package.json");
    }

    // Initialize the package command with program and command
    let vsceArgs = [];
    vsceArgs.push('./node_modules/vsce/out/vsce');
    vsceArgs.push('package'); // package command

    // Add the package name
    vsceArgs.push('-o');
    vsceArgs.push(packageName);

    // Put it all together and execute the command
    let command = vsceArgs.join(' ');
    console.log(command);
    return exec(command);
};

function getOnlinePackageName() {
    return packageVals.name + "-" + packageVals.version + ".vsix";
}

function getOnlinePackagePath() {
    return './' + getOnlinePackageName();
}
