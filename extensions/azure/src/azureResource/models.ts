/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export interface AzureResourceSubscription {
	id: string;
	name: string;
}

export interface AzureResourceDatabaseServer {
	name: string;
	fullName: string;
	loginName: string;
	defaultDatabaseName: string;
}

export interface AzureResourceDatabase {
	name: string;
	serverName: string;
	serverFullName: string;
	loginName: string;
}
