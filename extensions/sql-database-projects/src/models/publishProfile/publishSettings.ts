/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface PublishSettings {
	databaseName: string;
	connectionId: string;
	connectionString: string;
	sqlCmdVariables: Record<string, string>;
}
