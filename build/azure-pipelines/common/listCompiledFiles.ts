/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';

if (process.argv.length !== 3) {
	console.error('Usage: node listCompileFiles.js OUTPUT_FILE');
	process.exit(-1);
}

const ROOT = path.join(__dirname, '../../../');

function findFiles(location: string, result: string[]) {
	if (fs.existsSync(location)) {
		const entries = fs.readdirSync(path.join(ROOT, location));
		entries.forEach(entry => {
			const entryPath = `${location}/${entry}`;
			if (fs.statSync(path.join(ROOT, entryPath)).isDirectory()) {
				findFiles(entryPath, result);
			} else {
				result.push(entryPath);
			}
		});
	}
}

let result: string[] = [];
const directories: string[] = ['.build', 'out-build', 'out-vscode-min', 'out-vscode-reh-min', 'out-vscode-reh-web-min'];

directories.forEach(d => {
	const dirFiles: string[] = [];
	findFiles(d, dirFiles);
	result = result.concat(dirFiles);
});

fs.writeFileSync(process.argv[2], result.join('\n') + '\n');
