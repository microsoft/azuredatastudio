/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as uuid from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as constants from '../common/constants';
import { promisify } from 'util';

export async function execCommandOnTempFile<T>(content: string, command: (filePath: string) => Promise<T>): Promise<T> {
	let tempFilePath: string = '';
	try {
		tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${uuid.v4()}`);
		await fs.promises.writeFile(tempFilePath, content);
		let result = await command(tempFilePath);
		return result;
	}
	finally {
		await fs.promises.unlink(tempFilePath);
	}
}

export async function exists(path: string): Promise<boolean> {
	return promisify(fs.exists)(path);
}

export async function createFolder(dirPath: string): Promise<void> {
	let folderExists = await exists(dirPath);
	if (!folderExists) {
		await fs.promises.mkdir(dirPath);
	}
}

export function getPythonInstallationLocation(rootFolder: string) {
	return path.join(rootFolder, 'python');
}

export function getPythonExePath(rootFolder: string): string {
	return path.join(
		getPythonInstallationLocation(rootFolder),
		constants.pythonBundleVersion,
		process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
}
