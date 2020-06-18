/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azurecore from '../../../azurecore/src/azurecore';
import * as loc from '../localizedConstants';
import { IconPathHelper, IconPath, ResourceType, Connectionmode } from '../constants';

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

export function getResourceTypeIcon(resourceType: string): IconPath | undefined {
	switch (resourceType) {
		case ResourceType.sqlManagedInstances:
			return IconPathHelper.miaa;
		case ResourceType.postgresInstances:
			return IconPathHelper.postgres;
	}
	return undefined;
}

export function getConnectionModeDisplayText(connectionMode: string | undefined): string {
	connectionMode = connectionMode ?? '';
	switch (connectionMode) {
		case Connectionmode.connected:
			return loc.connected;
		case Connectionmode.disconnected:
			return loc.disconnected;
	}
	return connectionMode;
}
