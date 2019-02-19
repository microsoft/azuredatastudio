/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export interface AzureResourceDatabaseServer {
	name: string;
	fullName: string;
	loginName: string;
	defaultDatabaseName: string;
}