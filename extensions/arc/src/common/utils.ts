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

/**
 * Gets the IconPath for the specified resource type, or undefined if the type is unknown.
 * @param resourceType The resource type
 */
export function getResourceTypeIcon(resourceType: string | undefined): IconPath | undefined {
	switch (resourceType) {
		case ResourceType.sqlManagedInstances:
			return IconPathHelper.miaa;
		case ResourceType.postgresInstances:
			return IconPathHelper.postgres;
		case ResourceType.dataControllers:
			return IconPathHelper.controller;
	}
	return undefined;
}

/**
 * Returns the text to display for known connection modes
 * @param connectionMode The string repsenting the connection mode
 */
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

/**
 * Gets the display text for the database state returned from querying the database.
 * @param state The state value returned from the database
 */
export function getDatabaseStateDisplayText(state: string): string {
	switch (state.toUpperCase()) {
		case 'ONLINE':
			return loc.online;
		case 'OFFLINE':
			return loc.offline;
		case 'RESTORING':
			return loc.restoring;
		case 'RECOVERING':
			return loc.recovering;
		case 'RECOVERY PENDING	':
			return loc.recoveryPending;
		case 'SUSPECT':
			return loc.suspect;
		case 'EMERGENCY':
			return loc.emergecy;
	}
	return state;
}

/**
 * Opens an input box prompting the user to enter in the name of a resource to delete
 * @param namespace The namespace of the resource to delete
 * @param name The name of the resource to delete
 * @returns Promise resolving to true if the user confirmed the name, false if the input box was closed for any other reason
 */
export async function promptForResourceDeletion(namespace: string, name: string): Promise<boolean> {
	const inputBox = vscode.window.createInputBox();
	inputBox.title = loc.resourceDeletionWarning(namespace, name);
	inputBox.placeholder = name;
	return new Promise(resolve => {
		let valueAccepted = false;
		inputBox.onDidAccept(() => {
			if (inputBox.value === name) {
				valueAccepted = true;
				inputBox.hide();
				resolve(true);
			} else {
				inputBox.validationMessage = loc.invalidResourceDeletionName(inputBox.value);
			}
		});
		inputBox.onDidHide(() => {
			if (!valueAccepted) {
				resolve(false);
			}
			inputBox.dispose();
		});
		inputBox.onDidChangeValue(() => {
			inputBox.validationMessage = '';
		});
		inputBox.show();
	});
}

/**
 * Gets the message to display for a given error object that may be a variety of types.
 * @param error The error object
 */
export function getErrorMessage(error: any): string {
	if (error?.body?.reason) {
		// For HTTP Errors with a body pull out the reason message since that's usually the most helpful
		return error.body.reason;
	} else if (error.message) {
		if (error.response?.statusMessage) {
			// Some Http errors just have a status message as additional detail, but it's not enough on its
			// own to be useful so append to the message as well
			return `${error.message} (${error.response.statusMessage})`;
		}
		return error.message;
	} else {
		return error;
	}
}

/**
 * Parses an instance name from the controller. An instance name will either be just its name
 * e.g. myinstance or namespace_name e.g. mynamespace_my-instance.
 * @param instanceName The instance name in one of the formats described
 */
export function parseInstanceName(instanceName: string | undefined): string {
	instanceName = instanceName ?? '';
	const parts: string[] = instanceName.split('_');
	if (parts.length === 2) {
		instanceName = parts[1];
	}
	else if (parts.length > 2) {
		throw new Error(`Cannot parse resource '${instanceName}'. Acceptable formats are 'namespace_name' or 'name'.`);
	}
	return instanceName;
}
