/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vfs from 'vinyl-fs';

const files = [
	'.build/extensions/**/*.vsix', // external extensions
	'.build/win32-x64/**/*.{exe,zip}', // windows binaries
	'.build/linux/sha256hashes.txt', // linux hashes
	'.build/linux/deb/amd64/deb/*', // linux debs
	'.build/linux/rpm/x86_64/*', // linux rpms
	'.build/linux/server/*', // linux server
	'.build/linux/archive/*', // linux archive
	'.build/docker/**', // docker images
	'.build/darwin/**', // darwin binaries
	'.build/version.json' // version information
];

async function main() {
	return new Promise((resolve, reject) => {
		const stream = vfs.src(files, { base: '.build', allowEmpty: true })
			.pipe(vfs.dest(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY!));

		stream.on('end', () => resolve());
		stream.on('error', e => reject(e));
	});
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
