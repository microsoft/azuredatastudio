/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { promises as fs } from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

async function main(): Promise<void> {
	const patchPath = path.join(__dirname, '..', 'patches');

	const files = await fs.readdir(patchPath);

	for (const name of files) {
		const namePath = path.join(...name.split('.').slice(0, -1).join('.').split('_'));
		cp.spawnSync('git', ['checkout', 'vsdistro/distro', '--', namePath]);
		cp.spawnSync('git', ['apply', '--ignore-space-change', '--ignore-whitespace', path.join(patchPath, name)]);
	}
}

main();
