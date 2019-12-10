/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as uuid from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as constants from '../common/constants';

export async function execCommandOnTempFile<T>(content: string, command: (filePath: string) => Promise<T>): Promise<T> {
	let tempFilePath: string;
	try {
		tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${uuid.v4()}`);
		await fs.writeFile(tempFilePath, content);
		let result = await command(tempFilePath);
		return result;
	}
	catch (err) {
		throw err;
	}
	finally {
		fs.unlink(tempFilePath);
	}
}

export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

export async function createFolder(dirPath: string): Promise<void> {
	if (!fs.exists(dirPath)) {
		fs.mkdir(dirPath);
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
