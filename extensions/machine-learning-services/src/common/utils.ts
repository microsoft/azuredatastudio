/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as constants from '../common/constants';
import { promisify } from 'util';

export async function execCommandOnTempFile<T>(content: string, command: (filePath: string) => Promise<T>): Promise<T> {
	let tempFilePath: string = '';
	try {
		tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
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

export function getPackageFilePath(rootFolder: string, packageName: string): string {
	return path.join(
		rootFolder,
		constants.rLPackagedFolderName,
		packageName);
}

export function getRPackagesFolderPath(rootFolder: string): string {
	return path.join(
		rootFolder,
		constants.rLPackagedFolderName);
}

/**
 * Compares two version strings to see which is greater.
 * @param first First version string to compare.
 * @param second Second version string to compare.
 * @returns 1 if the first version is greater, -1 if it's less, and 0 otherwise.
 */
export function comparePackageVersions(first: string, second: string): number {
	let firstVersion = first.split('.').map(numStr => Number.parseInt(numStr));
	let secondVersion = second.split('.').map(numStr => Number.parseInt(numStr));

	// If versions have different lengths, then append zeroes to the shorter one
	if (firstVersion.length > secondVersion.length) {
		let diff = firstVersion.length - secondVersion.length;
		secondVersion = secondVersion.concat(new Array(diff).fill(0));
	} else if (secondVersion.length > firstVersion.length) {
		let diff = secondVersion.length - firstVersion.length;
		firstVersion = firstVersion.concat(new Array(diff).fill(0));
	}

	for (let i = 0; i < firstVersion.length; ++i) {
		if (firstVersion[i] > secondVersion[i]) {
			return 1;
		} else if (firstVersion[i] < secondVersion[i]) {
			return -1;
		}
	}
	return 0;
}

export function sortPackageVersions(versions: string[], ascending: boolean = true) {
	return versions.sort((first, second) => {
		let compareResult = comparePackageVersions(first, second);
		if (ascending) {
			return compareResult;
		} else {
			return compareResult * -1;
		}
	});
}

export function isWindows(): boolean {
	return process.platform === 'win32';
}
