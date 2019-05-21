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
	let serviceUrl = 'https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery.json';
	let nameShort = product.nameShort;
	let nameLong = product.nameLong;
	let applicationName = product.applicationName;
	let dataFolderName = product.dataFolderName;
	let win32MutexName = product.win32MutexName;
	let win32DirName = product.win32DirName;
	let win32NameVersion = product.win32NameVersion;
	let win32RegValueName = product.win32RegValueName;
	let win32AppId = product.win32AppId;
	let win32x64AppId = product.win32x64AppId;
	let win32UserAppId = product.win32UserAppId;
	let win32x64UserAppId = product.win32x64UserAppId;
	let win32AppUserModelId = product.win32AppUserModelId;
	let win32ShellNameShort = product.win32ShellNameShort;
	let darwinBundleIdentifier = product.darwinBundleIdentifier;

	if (quality === 'insider') {
		let dashSuffix =  '-insider';
		let dotSuffix =  '.insider';
		let displaySuffix = '- Insider';

		serviceUrl = `https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery-${quality}.json`;
		nameShort += dashSuffix;
		nameLong += displaySuffix;
		applicationName += dashSuffix;
		dataFolderName += dashSuffix;
		win32MutexName += dashSuffix;
		win32DirName += displaySuffix;
		win32NameVersion += displaySuffix;
		win32RegValueName += dashSuffix;
		win32AppId = "{{9F0801B2-DEE3-4272-A2C6-FBDF25BAAF0F}";
		win32x64AppId = "{{6748A5FD-29EB-4BA6-B3C6-E7B981B8D6B0}";
		win32UserAppId = "{{0F8CD1ED-483C-40EB-8AD2-8ED784651AA1}";
		win32x64UserAppId += dashSuffix;
		win32AppUserModelId += dotSuffix;
		win32ShellNameShort += displaySuffix;
		darwinBundleIdentifier += dotSuffix;
	}

	let newValues = {
		"nameShort": nameShort,
		"nameLong": nameLong,
		"applicationName": applicationName,
		"dataFolderName": dataFolderName,
		"win32MutexName": win32MutexName,
		"win32DirName": win32DirName,
		"win32NameVersion": win32NameVersion,
		"win32RegValueName": win32RegValueName,
		"win32AppId": win32AppId,
		"win32x64AppId": win32x64AppId,
		"win32UserAppId": win32UserAppId,
		"win32x64UserAppId": win32x64UserAppId,
		"win32AppUserModelId": win32AppUserModelId,
		"win32ShellNameShort": win32ShellNameShort,
		"darwinBundleIdentifier": darwinBundleIdentifier,
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
