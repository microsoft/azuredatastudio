/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo | undefined {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}

	return undefined;
}

/**
 * Converts milliseconds to HH:MM:SS:###(milliseconds) and seconds in string format
 * @param ms milliseconds to convert
 */
export function convertMilliSecondsToTimeFormat(ms: number): string {
	// Total seconds
	let sec = ms / 1000;

	// Total hours possible with the seconds
	const hrs = Math.trunc(sec / 3600);

	// Remaining seconds after extracting hours
	sec = sec % 3600;

	// Total Minutes possible with the remaining seconds
	const min = Math.trunc(sec / 60);

	// Remaining seconds after extracting minutes
	sec = sec % 60;

	// Milliseconds left after extracting the seconds
	const milliSec = Math.round((sec - Math.floor(sec)) * 1000);

	// Truncating the seconds
	sec = Math.trunc(sec);

	// Returns the timespan in HH:MM:SS:###MSEC
	return (`${hrs < 10 ? '0' + hrs : hrs}:${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}:${milliSec}`);
}

/**
 * Get file size from the file stats using the file path uri
 * @param uri The file path
 */
export async function getFileSize(uri: string): Promise<string | undefined> {
	const stats = await getFileStatus(uri);
	return stats ? stats.size.toString() + ' Bytes' : undefined;
}

async function getFileStatus(path: string): Promise<fs.Stats | undefined> {
	try {
		const stats = await fs.promises.stat(path);
		return stats;
	}
	catch (e) {
		if (e.code === 'ENOENT') {
			return undefined;
		}
		else {
			throw e;
		}
	}
}
