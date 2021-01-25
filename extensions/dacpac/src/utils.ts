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
 * Get file size from the file stats using the file path uri
 * If the file does not exists, purposely returning undefined instead of throwing an error for telemetry purpose.
 * @param uri The file path
 */
export async function tryGetFileSize(uri: string): Promise<number | undefined> {
	try {
		const stats = await fs.promises.stat(uri);
		return stats?.size;
	}
	catch (e) {
		return undefined;
	}
}
