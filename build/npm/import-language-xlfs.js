/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let path = require("path");
let gulp = require('gulp');
let minimist = require('minimist');

function update(options) {
	let location = options._;

	gulp.src(`${location}/drop/loc/**/*.xlf`)
		.pipe(gulp.dest(function (file) {
			let firstSlashIndex =  file.relative.indexOf('\\');
			let language = '\\' + file.relative.substr(0,firstSlashIndex) + '\\';
			file.path = file.base + language + path.basename(file.relative);
			return './resources/xlf/'
		}));
}

if (path.basename(process.argv[1]) === 'import-language-xlfs.js') {
	var options = minimist(process.argv.slice(2));
	update(options);
}
