/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');

// {{SQL CARBON EDIT}}
const jeditor = require('gulp-json-editor');
const product = require('../product.json');

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
	let nameShort = product.nameShort;
	let nameLong = product.nameLong;
	let applicationName = product.applicationName;
	let dataFolderName = product.dataFolderName;
	let win32MutexName = product.win32MutexName;
	if (quality === 'insider') {
		let suffix =  '-' + quality;
		serviceUrl = `https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery-${quality}.json`;
		nameShort += suffix;
		nameLong += suffix;
		applicationName += suffix;
		dataFolderName += suffix;
		win32MutexName += suffix;
	}

	let newValues = {
		"nameShort": nameShort,
		"nameLong": nameLong,
		"applicationName": applicationName,
		"dataFolderName": dataFolderName,
		"win32MutexName": win32MutexName,
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
