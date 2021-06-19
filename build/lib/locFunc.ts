/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import rename = require('gulp-rename');
import ext = require('./extensions');

const root = path.dirname(path.dirname(__dirname));

// Modified packageLocalExtensionsStream from extensions.ts, but for langpacks.
export function packageLangpacksStream(): NodeJS.ReadWriteStream {
	const langpackDescriptions = (<string[]>glob.sync('i18n/*/package.json'))
		.map(manifestPath => {
			const langpackPath = path.dirname(path.join(root, manifestPath));
			const langpackName = path.basename(langpackPath);
			return { name: langpackName, path: langpackPath };
		})

	const builtLangpacks = langpackDescriptions.map(langpack => {
		return ext.fromLocalNormal(langpack.path)
			.pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
	});

	return es.merge(builtLangpacks);
}

// Runs packageSingleADSExtensionStream on extensions that are exclusive to ADS.
export function packageADSExtensionsStream(): NodeJS.ReadWriteStream {
	const currentADSJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../i18n/ADSExtensions.json'), 'utf8'));
	const ADSExtensions = Object.keys(currentADSJson.ADSExtensions);

	const builtExtensions = ADSExtensions.map(extensionName => packageSingleADSExtensionStream(extensionName))
	return es.merge(builtExtensions);
}

// Modified packageLocalExtensionsStream but for any ADS extensions including excluded/external ones.
export function packageSingleADSExtensionStream(name : string): NodeJS.ReadWriteStream {
	const extenalExtensionDescriptions = (<string[]>glob.sync(`extensions/${name}/package.json`))
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})

	const builtExtension = extenalExtensionDescriptions.map(extension => {
		return ext.fromLocal(extension.path, false)
			.pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
	});

	return es.merge(builtExtension);
}
