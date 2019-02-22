/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const json = require('gulp-json-editor');
const buffer = require('gulp-buffer');
const filter = require('gulp-filter');
const es = require('event-stream');
const util = require('./lib/util');
const remote = require('gulp-remote-src');
const zip = require('gulp-vinyl-zip');

// {{SQL CARBON EDIT}}
const jeditor = require('gulp-json-editor');

const pkg = require('../package.json');

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
	let serviceUrl = 'https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery.json';
	if (quality === 'insider') {
		serviceUrl = `https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery-${quality}.json`;
	}
	let newValues = {
		"updateUrl": updateUrl,
		"quality": quality,
		"extensionsGallery": {
			"serviceUrl": serviceUrl
		}
	};

	return gulp.src('./product.json')
		.pipe(jeditor(newValues))
		.pipe(gulp.dest('.'));
});
