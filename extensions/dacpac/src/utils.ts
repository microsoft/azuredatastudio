/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
 * Map an error message into a short name for the type of error.
 * @param msg The error message to map
 */
export function getTelemetryErrorType(msg: string): string {
	if (msg && msg.indexOf('Object reference not set to an instance of an object') !== -1) {
		return 'ObjectReferenceNotSet';
	}
	else {
		return 'Other';
	}
}
