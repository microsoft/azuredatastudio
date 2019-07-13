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

	// {{SQL CARBON EDIT}} - apply ADS insiders values if needed
	let newValues = {
		"nameShort": product.nameShort,
		"nameLong": product.nameLong,
		"applicationName": product.applicationName,
		"dataFolderName": product.dataFolderName,
		"win32MutexName": product.win32MutexName,
		"win32DirName": product.win32DirName,
		"win32NameVersion": product.win32NameVersion,
		"win32RegValueName": product.win32RegValueName,
		"win32AppId": product.win32AppId,
		"win32x64AppId": product.win32x64AppId,
		"win32UserAppId": product.win32UserAppId,
		"win32x64UserAppId": product.win32x64UserAppId,
		"win32AppUserModelId": product.win32AppUserModelId,
		"win32ShellNameShort": product.win32ShellNameShort,
		"darwinBundleIdentifier": product.darwinBundleIdentifier,
		"updateUrl": updateUrl,
		"quality": quality,
		"extensionsGallery": {
			"serviceUrl": 'https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery.json'
		}
	};

	if (quality === 'insider') {
		let dashSuffix =  '-insiders';
		let dotSuffix =  '.insiders';
		let displaySuffix = ' - Insiders';

		newValues.extensionsGallery.serviceUrl = `https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery-${quality}.json`;
		newValues.nameShort += dashSuffix;
		newValues.nameLong += displaySuffix;
		newValues.applicationName += dashSuffix;
		newValues.dataFolderName += dashSuffix;
		newValues.win32MutexName += dashSuffix;
		newValues.win32DirName += displaySuffix;
		newValues.win32NameVersion += displaySuffix;
		newValues.win32RegValueName += dashSuffix;
		newValues.win32AppId = "{{9F0801B2-DEE3-4272-A2C6-FBDF25BAAF0F}";
		newValues.win32x64AppId = "{{6748A5FD-29EB-4BA6-B3C6-E7B981B8D6B0}";
		newValues.win32UserAppId = "{{0F8CD1ED-483C-40EB-8AD2-8ED784651AA1}";
		newValues.win32x64UserAppId += dashSuffix;
		newValues.win32AppUserModelId += dotSuffix;
		newValues.win32ShellNameShort += displaySuffix;
		newValues.darwinBundleIdentifier += dotSuffix;
	}

	return gulp.src('./product.json')
		.pipe(jeditor(newValues))
		.pipe(gulp.dest('.'));
});
