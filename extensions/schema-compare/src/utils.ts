/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as azdata from 'azdata';

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
}

/**
 * Map an error message into a short name for the type of error.
 * @param msg The error message to map
 */
export function getTelemetryErrorType(msg: string): string {
	if (msg.indexOf('Object reference not set to an instance of an object') !== -1) {
		return 'ObjectReferenceNotSet';
	}
	else {
		return 'Other';
	}
}

/**
 * Return the appropriate endpoint name depending on if the endpoint is a dacpac or a database
 * @param endpoint endpoint to get the name of
 */
export function getEndpointName(endpoint: azdata.SchemaCompareEndpointInfo): string {
	if (!endpoint) {
		return undefined;
	}

	if (endpoint.endpointType === azdata.SchemaCompareEndpointType.Database) {
		return `${endpoint.serverName}.${endpoint.databaseName}`;
	} else {
		return endpoint.packageFilePath;
	}
}