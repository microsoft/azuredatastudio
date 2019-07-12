/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const json = require('gulp-json-editor');
const fancyLog = require('fancy-log');
const ansiColors = require('ansi-colors');

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

	fancyLog(ansiColors.blue('[mixin]'), `Mixing in sources:`);

	return gulp.src('product.json')
		.pipe(json(applyJSONEdit(require('../product.json'), quality, updateUrl)))
		.pipe(gulp.dest('.'));
});

function applyJSONEdit(json, quality, updateUrl) {
	// {{SQL CARBON EDIT}} - apply ADS insiders values if needed
	let newValues = {
		"updateUrl": updateUrl,
		"quality": quality,
		"extensionsGallery": {
			"serviceUrl": 'https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery.json'
		}
	};

	json = Object.assign({}, json, newValues);

	if (quality === 'insider') {
		let dashSuffix = '-insiders';
		let dotSuffix = '.insiders';
		let displaySuffix = ' - Insiders';

		json.extensionsGallery.serviceUrl = `https://sqlopsextensions.blob.core.windows.net/marketplace/v1/extensionsGallery-${quality}.json`;
		json.nameShort += dashSuffix;
		json.nameLong += displaySuffix;
		json.applicationName += dashSuffix;
		json.dataFolderName += dashSuffix;
		json.win32MutexName += dashSuffix;
		json.win32DirName += displaySuffix;
		json.win32NameVersion += displaySuffix;
		json.win32RegValueName += dashSuffix;
		json.win32AppId = "{{9F0801B2-DEE3-4272-A2C6-FBDF25BAAF0F}";
		json.win32x64AppId = "{{6748A5FD-29EB-4BA6-B3C6-E7B981B8D6B0}";
		json.win32UserAppId = "{{0F8CD1ED-483C-40EB-8AD2-8ED784651AA1}";
		json.win32x64UserAppId += dashSuffix;
		json.win32AppUserModelId += dotSuffix;
		json.win32ShellNameShort += displaySuffix;
		json.darwinBundleIdentifier += dotSuffix;
	}

	return json;
}