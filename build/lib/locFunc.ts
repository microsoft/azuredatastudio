/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as path from 'path';
import * as fs from 'fs';
import { createStatsStream } from './stats';
import * as File from 'vinyl';
import { Stream } from 'stream';
import * as glob from 'glob';
import rename = require('gulp-rename');

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
		return fromLocalNormal(langpack.path)
			.pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
	});

	return es.merge(builtLangpacks);
}

//copied from extensions.
function fromLocalNormal(extensionPath: string): Stream {
	const result = es.through();

	const vsce = require('vsce') as typeof import('vsce');

	vsce.listFiles({ cwd: extensionPath, packageManager: vsce.PackageManager.Yarn })
		.then(fileNames => {
			const files = fileNames
				.map(fileName => path.join(extensionPath, fileName))
				.map(filePath => new File({
					path: filePath,
					stat: fs.statSync(filePath),
					base: extensionPath,
					contents: fs.createReadStream(filePath) as any
				}));

			es.readArray(files).pipe(result);
		})
		.catch(err => result.emit('error', err));

	return result.pipe(createStatsStream(path.basename(extensionPath)));
}
