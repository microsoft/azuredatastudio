/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let locFunc = require("./lib/locFunc");

let path = require("path");

let gulp = require('gulp');
let minimist = require('minimist');

//code to update a single extension, separate from gulp task.
function update(options) {
	let extensionName = options._;
	locFunc.packageSingleADSExtensionStream(extensionName).pipe(gulp.dest('.build'))
}
if (path.basename(process.argv[1]) === 'localization-compile-extension.js') {
	var options = minimist(process.argv.slice(2));
	update(options);
}
