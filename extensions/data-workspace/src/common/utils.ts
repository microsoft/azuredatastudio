/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import type * as azdataType from 'azdata';

export async function directoryExist(directoryPath: string): Promise<boolean> {
	const stats = await getFileStatus(directoryPath);
	return stats ? stats.isDirectory() : false;
}

export async function fileExist(filePath: string): Promise<boolean> {
	const stats = await getFileStatus(filePath);
	return stats ? stats.isFile() : false;
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

// Try to load the azdata API - but gracefully handle the failure in case we're running
// in a context where the API doesn't exist (such as VS Code)
let azdataApi: typeof azdataType | undefined = undefined;
try {
	azdataApi = require('azdata');
	if (!azdataApi?.version) {
		// webpacking makes the require return an empty object instead of throwing an error so make sure we clear the var
		azdataApi = undefined;
	}
} catch {
	// no-op
}

/**
 * Gets the azdata API if it's available in the context this extension is running in.
 * @returns The azdata API if it's available
 */
export function getAzdataApi(): typeof azdataType | undefined {
	return azdataApi;
}
