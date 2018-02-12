/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
// {{SQL CARBON EDIT}}
const jeditor = require('gulp-json-editor');

gulp.task('mixin', function () {
  // {{SQL CARBON EDIT}}
	const updateUrl = process.env['SQLOPS_UPDATEURL'];
	if (!updateUrl) {
		console.log('Missing SQLOPS_UPDATEURL, skipping mixin');
		return;
	}

	const quality = process.env['VSCODE_QUALITY'];

	if (!quality) {
		console.log('Missing VSCODE_QUALITY, skipping mixin');
		return;
	}

  // {{SQL CARBON EDIT}}
	let newValues = {
		"updateUrl": updateUrl,
		"quality": quality
	};

	return gulp.src('./product.json')
		.pipe(jeditor(newValues))
		.pipe(gulp.dest('.'));
});