/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';

// A Connection Profile contains all the properties of connection credentials, with additional
// optional name and details on whether password should be saved
export interface IConnectionProfile extends sqlops.ConnectionInfo {
	serverName: string;
	databaseName: string;
	userName: string;
	password: string;
	authenticationType: string;
	savePassword: boolean;
	groupFullName: string;
	groupId: string;
	getOptionsKey(): string;
	matches(profile: IConnectionProfile): boolean;
	providerName: string;
	saveProfile: boolean;
	id: string;
}

export interface IConnectionProfileStore {
	options: {};
	groupId: string;
	providerName: string;
	savePassword: boolean;
	id: string;
}

