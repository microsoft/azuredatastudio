/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azurecore from '../../../azurecore/src/azurecore';
import * as loc from '../localizedConstants';

export enum ResourceType {
	dataControllers = 'dataControllers',
	postgresInstances = 'postgresInstances',
	sqlManagedInstances = 'sqlManagedInstances'
}
/**
 * Converts the resource type name into the localized Display Name for that type.
 * @param resourceType The resource type name to convert
 */
export function resourceTypeToDisplayName(resourceType: string | undefined): string {
	resourceType = resourceType || 'undefined';
	switch (resourceType) {
		case ResourceType.dataControllers:
			return loc.dataControllersType;
		case ResourceType.postgresInstances:
			return loc.pgSqlType;
		case ResourceType.sqlManagedInstances:
			return loc.miaaType;
	}
	return resourceType;
}

export function parseEndpoint(endpoint?: string): { ip: string, port: string } {
	endpoint = endpoint || '';
	const separatorIndex = endpoint.indexOf(':');
	return {
		ip: endpoint.substr(0, separatorIndex),
		port: endpoint.substr(separatorIndex + 1)
	};
}

let azurecoreApi: azurecore.IExtension;

export async function getAzurecoreApi(): Promise<azurecore.IExtension> {
	if (!azurecoreApi) {
		azurecoreApi = await vscode.extensions.getExtension(azurecore.extension.name)?.activate();
		if (!azurecoreApi) {
			throw new Error('Unable to retrieve azurecore API');
		}
	}
	return azurecoreApi;
}
