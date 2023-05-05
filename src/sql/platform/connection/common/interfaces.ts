/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

// Used to allow various methods of matching profiles
export type ProfileMatcher = (a: IConnectionProfile, b: IConnectionProfile) => boolean;

export interface IConnectionProfile extends azdata.IConnectionProfile {
	getOptionsKey(): string;
	matches(profile: azdata.IConnectionProfile): boolean;
}

export interface IConnectionProfileStore {
	options: { [key: string]: any };
	groupId: string;
	providerName: string;
	savePassword: boolean;
	id: string;
}

export enum ServiceOptionType {
	string = 'string',
	multistring = 'multistring',
	password = 'password',
	number = 'number',
	category = 'category',
	boolean = 'boolean',
	object = 'object'
}

export enum ConnectionOptionSpecialType {
	connectionName = 'connectionName',
	serverName = 'serverName',
	databaseName = 'databaseName',
	authType = 'authType',
	userName = 'userName',
	password = 'password',
	appName = 'appName'
}
