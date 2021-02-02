/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface MigrationControllerProperties {
	name: string;
	subscriptionId: string;
	resourceGroup: string;
	location: string;
	provisioningState: string;
	integrationRuntimeState?: string;
	isProvisioned?: boolean;
}

export interface MigrationController {
	properties: MigrationControllerProperties;
	location: string;
	id: string;
	name: string;
	error: {
		code: string,
		message: string
	}
}

export type GetMigrationControllerAuthKeysResult = { keyName1: string, keyName2: string};
