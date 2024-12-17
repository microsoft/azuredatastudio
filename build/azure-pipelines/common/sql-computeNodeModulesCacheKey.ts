/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.join(__dirname, '../../../');

function findFiles(location: string, pattern: string, result: string[]) {
	const entries = fs.readdirSync(path.join(ROOT, location));

	for (const entry of entries) {
		const entryPath = `${location}/${entry}`;
		let stat: fs.Stats;
		try {
			stat = fs.statSync(path.join(ROOT, entryPath));
		} catch (err) {
			continue;
		}
		if (stat.isDirectory()) {
			findFiles(entryPath, pattern, result);
		} else {
			if (stat.isFile() && entry.endsWith(pattern)) {
				result.push(path.join(ROOT, entryPath));
			}
		}
	}
}

const shasum = crypto.createHash('sha1');

/**
 * Creating a sha hash of all the files that can cause packages to change/redownload.
 */
shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.yarnrc')));

// Adding all yarn.lock files into sha sum.
const result: string[] = [];
findFiles('', 'yarn.lock', result);
result.forEach(f => shasum.update(fs.readFileSync(f)));

// Add any other command line arguments
for (let i = 2; i < process.argv.length; i++) {
	shasum.update(process.argv[i]);
}

process.stdout.write(shasum.digest('hex'));
