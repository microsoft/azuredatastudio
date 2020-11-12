/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vfs from 'vinyl-fs';
import * as path from 'path';
import * as es from 'event-stream';
import * as fs from 'fs';

const files = [
	'.build/extensions/**/*.vsix', // external extensions
	'.build/win32-x64/**/*.{exe,zip}', // windows binaries
	'.build/linux/sha256hashes.txt', // linux hashes
	'.build/linux/deb/amd64/deb/*.deb', // linux debs
	'.build/linux/rpm/x86_64/*.rpm', // linux rpms
	'.build/linux/server/*', // linux server
	'.build/linux/archive/*', // linux archive
	'.build/docker/*', // docker images
	'.build/darwin/*', // darwin binaries
	'.build/version.json' // version information
];

async function main() {
	return new Promise((resolve, reject) => {
		const stream = vfs.src(files, { base: '.build', allowEmpty: true })
			.pipe(es.through(file => {
				const filePath = path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY!,
					//Preserve intermediate directories after .build folder
					file.path.substr(path.resolve('.build').length + 1));
				fs.mkdirSync(path.dirname(filePath), { recursive: true });
				fs.renameSync(file.path, filePath);
			}));

		stream.on('end', () => resolve());
		stream.on('error', e => reject(e));
	});
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
